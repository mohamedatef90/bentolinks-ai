// Data layer for the RefVault backend: content_items/folders tables + Edge Functions.
// Replaces the old hybrid localStorage/Supabase `db` object.

import { supabase } from './supabase';
import { ContentItem, Link, Category, Folder, SmartCollection, FilterState, RssSubscription, FeedCandidate } from '../types';

const ITEM_COLUMNS =
  'id, url, title, description, summary, key_points, tags, topic, source_type, status, saved_via, ' +
  'site_name, thumbnail_url, favicon_url, is_pinned, is_starred, read_status, section, ' +
  'published_at, created_at, item_folders(folder_id)';

const ITEM_COLUMNS_FULL = ITEM_COLUMNS + ', content_text';

export interface SaveItemResult {
  id: string;
  url: string;
  title: string | null;
  status: string;
  duplicate: boolean;
  error?: string;
  message?: string;
}

/** Map a content_items row onto the legacy Link card shape. */
export function toLink(item: ContentItem): Link {
  return {
    id: item.id,
    url: item.url,
    title: item.title || item.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80),
    description: item.summary || item.description || '',
    categoryId: item.item_folders?.[0]?.folder_id ?? '',
    section: item.section || undefined,
    createdAt: Date.parse(item.created_at),
    isPinned: item.is_pinned,
    isStarred: item.is_starred,
    readStatus: item.read_status,
    status: item.status,
    summary: item.summary,
    tags: item.tags,
    thumbnailUrl: item.thumbnail_url,
    favicon: item.favicon_url || undefined,
    sourceType: item.source_type,
    savedVia: item.saved_via,
  };
}

/** functions.invoke throws FunctionsHttpError on non-2xx; surface the server's JSON message. */
async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const details = await (error as any).context?.json?.();
      if (details?.message || details?.error) message = details.message || details.error;
    } catch { /* keep the generic message */ }
    throw new Error(message);
  }
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
  return data as T;
}

export const api = {
  items: {
    async fetchAll(): Promise<ContentItem[]> {
      const { data, error } = await supabase
        .from('content_items')
        .select(ITEM_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw new Error(`Failed to load items: ${error.message}`);
      return (data ?? []) as unknown as ContentItem[];
    },

    async fetchOne(id: string): Promise<ContentItem | null> {
      const { data, error } = await supabase
        .from('content_items')
        .select(ITEM_COLUMNS_FULL)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as ContentItem | null;
    },

    /** Apply a FilterState (the same shape stored in smart_collections.query) as a direct query. */
    async fetchByFilter(filter: FilterState): Promise<ContentItem[]> {
      // Resurface system collection: only items in the nightly daily_picks set.
      const columns = filter.system === 'resurface'
        ? ITEM_COLUMNS + ', daily_picks!inner(item_id)'
        : ITEM_COLUMNS;
      let query = supabase.from('content_items').select(columns);
      if (filter.source_type?.length) query = query.in('source_type', filter.source_type);
      if (filter.saved_via?.length) query = query.in('saved_via', filter.saved_via);
      if (filter.read_status?.length) query = query.in('read_status', filter.read_status);
      if (filter.topic) query = query.eq('topic', filter.topic);
      if (filter.is_starred) query = query.eq('is_starred', true);
      if (filter.tags?.length) query = query.overlaps('tags', filter.tags);

      const [sortCol, sortDir] = filter.sort === 'title_asc'
        ? ['title', true] as const
        : filter.sort === 'date_asc'
          ? ['created_at', true] as const
          : ['created_at', false] as const;
      query = query.order(sortCol, { ascending: sortDir }).limit(500);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to load items: ${error.message}`);
      return (data ?? []) as unknown as ContentItem[];
    },

    async fetchByFolder(folderId: string): Promise<ContentItem[]> {
      const { data, error } = await supabase
        .from('content_items')
        .select(ITEM_COLUMNS.replace(', item_folders(folder_id)', '') + ', item_folders!inner(folder_id)')
        .eq('item_folders.folder_id', folderId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw new Error(`Failed to load folder items: ${error.message}`);
      return (data ?? []) as unknown as ContentItem[];
    },

    /** Keyword search via the search_items RPC (Postgres FTS + ts_rank). */
    async search(q: string, filters: FilterState = {}): Promise<ContentItem[]> {
      const { data, error } = await supabase.rpc('search_items', { q, filters });
      if (error) throw new Error(`Search failed: ${error.message}`);
      return (data ?? []) as unknown as ContentItem[];
    },

    async setReadStatus(id: string, readStatus: 'unread' | 'reading' | 'read') {
      const { error } = await supabase.from('content_items').update({ read_status: readStatus }).eq('id', id);
      if (error) throw new Error(`Update failed: ${error.message}`);
    },

    async setStarred(id: string, isStarred: boolean) {
      const { error } = await supabase.from('content_items').update({ is_starred: isStarred }).eq('id', id);
      if (error) throw new Error(`Update failed: ${error.message}`);
    },

    /** Save a URL through the save-item Edge Function (parse + AI enrich happen async). */
    async save(url: string, folderId?: string): Promise<SaveItemResult> {
      const { data, error } = await supabase.functions.invoke('save-item', {
        body: { url, folder_id: folderId || undefined },
      });
      if (error) throw new Error(`Save failed: ${error.message}`);
      if (data?.error) throw new Error(data.message || data.error);
      return data as SaveItemResult;
    },

    /** Batch save (bookmark import). Max 100 URLs per call. */
    async saveBatch(urls: string[]): Promise<SaveItemResult[]> {
      const { data, error } = await supabase.functions.invoke('save-item', {
        body: { urls },
      });
      if (error) throw new Error(`Import failed: ${error.message}`);
      return (data?.items ?? []) as SaveItemResult[];
    },

    async update(id: string, updates: Partial<Pick<ContentItem,
      'title' | 'description' | 'is_pinned' | 'is_starred' | 'read_status' | 'tags' | 'section'>>) {
      const { error } = await supabase.from('content_items').update(updates).eq('id', id);
      if (error) throw new Error(`Update failed: ${error.message}`);
    },

    async delete(id: string) {
      const { error } = await supabase.from('content_items').delete().eq('id', id);
      if (error) throw new Error(`Delete failed: ${error.message}`);
    },

    async deleteAll() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('content_items').delete().eq('user_id', user.id);
      if (error) throw new Error(`Delete failed: ${error.message}`);
    },

    /** Move an item to a single folder (Phase 1 UI keeps one-folder semantics). */
    async setFolder(itemId: string, folderId: string | null) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error: delError } = await supabase.from('item_folders').delete().eq('item_id', itemId);
      if (delError) throw new Error(delError.message);
      if (folderId) {
        const { error } = await supabase
          .from('item_folders')
          .insert({ item_id: itemId, folder_id: folderId, user_id: user.id });
        if (error) throw new Error(error.message);
      }
    },

    /** Subscribe to live status changes (pending -> parsing -> enriching -> ready). */
    subscribeToChanges(onChange: (item: Partial<ContentItem> & { id: string }) => void) {
      const channel = supabase
        .channel('content-items-changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'content_items' },
          (payload) => onChange(payload.new as Partial<ContentItem> & { id: string }),
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
  },

  folders: {
    async fetchAll(): Promise<Category[]> {
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, color, icon, position')
        .order('position', { ascending: true });
      if (error) throw new Error(`Failed to load folders: ${error.message}`);
      return (data ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        color: f.color || 'bg-zinc-100',
        icon: f.icon || 'fa-folder',
      }));
    },

    /** Full tree shape (parent_id) for FolderSidebar, max depth 3. */
    async fetchTree(): Promise<Folder[]> {
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, color, icon, parent_id, position')
        .order('position', { ascending: true });
      if (error) throw new Error(`Failed to load folders: ${error.message}`);
      return (data ?? []) as Folder[];
    },

    async create(name: string, color: string, icon: string, parentId?: string | null): Promise<Category> {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('folders')
        .insert({ user_id: user.id, name, color, icon, parent_id: parentId ?? null })
        .select('id, name, color, icon')
        .single();
      if (error) throw new Error(`Create folder failed: ${error.message}`);
      return data as Category;
    },

    async update(id: string, updates: { name?: string; color?: string; icon?: string }) {
      const { error } = await supabase.from('folders').update(updates).eq('id', id);
      if (error) throw new Error(`Update folder failed: ${error.message}`);
    },

    async delete(id: string) {
      // Items are unassigned (item_folders rows cascade), never deleted.
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw new Error(`Delete folder failed: ${error.message}`);
    },
  },

  smartCollections: {
    async fetchAll(): Promise<SmartCollection[]> {
      const { data, error } = await supabase
        .from('smart_collections')
        .select('id, name, icon, position, is_system, query')
        .order('position', { ascending: true });
      if (error) throw new Error(`Failed to load smart collections: ${error.message}`);
      return (data ?? []) as unknown as SmartCollection[];
    },

    async fetchOne(id: string): Promise<SmartCollection | null> {
      const { data, error } = await supabase
        .from('smart_collections')
        .select('id, name, icon, position, is_system, query')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as SmartCollection | null;
    },

    async create(name: string, query: FilterState, icon?: string): Promise<SmartCollection> {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('smart_collections')
        .insert({ user_id: user.id, name, query, icon: icon || '🔎', is_system: false })
        .select('id, name, icon, position, is_system, query')
        .single();
      if (error) throw new Error(`Create smart collection failed: ${error.message}`);
      return data as unknown as SmartCollection;
    },

    async delete(id: string) {
      const { error } = await supabase.from('smart_collections').delete().eq('id', id);
      if (error) throw new Error(`Delete smart collection failed: ${error.message}`);
    },
  },

  feeds: {
    async list(): Promise<RssSubscription[]> {
      const { data, error } = await supabase
        .from('rss_subscriptions')
        .select('id, feed_url, site_url, title, favicon_url, last_fetched_at, last_error, error_count, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to load feeds: ${error.message}`);
      return (data ?? []) as RssSubscription[];
    },

    /** Discover/validate feeds for a URL via the discover-feed Edge Function. */
    async discover(url: string): Promise<FeedCandidate[]> {
      const data = await invokeFn<{ candidates: FeedCandidate[] }>('discover-feed', { url });
      return data.candidates ?? [];
    },

    /** Insert a validated candidate. The poller fills title/site/favicon on first fetch. */
    async subscribe(candidate: FeedCandidate): Promise<RssSubscription> {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      let domain = '';
      try { domain = new URL(candidate.feed_url).hostname; } catch { /* keep empty */ }
      const { data, error } = await supabase
        .from('rss_subscriptions')
        .insert({
          user_id: user.id,
          feed_url: candidate.feed_url,
          title: candidate.title,
          favicon_url: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null,
        })
        .select('id, feed_url, site_url, title, favicon_url, last_fetched_at, last_error, error_count, is_active, created_at')
        .single();
      if (error) {
        if (error.code === '23505') throw new Error('Already subscribed to this feed.');
        throw new Error(`Subscribe failed: ${error.message}`);
      }
      return data as RssSubscription;
    },

    /** Force-poll one subscription right now (first fetch after subscribing / manual sync). */
    async syncNow(id: string): Promise<{ inserted: number; skipped: boolean }> {
      return await invokeFn('rss-poller', { subscription_id: id });
    },

    async setActive(id: string, isActive: boolean) {
      const updates: Record<string, unknown> = { is_active: isActive };
      if (isActive) {
        updates.error_count = 0;
        updates.last_error = null;
      }
      const { error } = await supabase.from('rss_subscriptions').update(updates).eq('id', id);
      if (error) throw new Error(`Update feed failed: ${error.message}`);
    },

    /** Items already ingested from the feed stay in the vault. */
    async unsubscribe(id: string) {
      const { error } = await supabase.from('rss_subscriptions').delete().eq('id', id);
      if (error) throw new Error(`Unsubscribe failed: ${error.message}`);
    },
  },

  tts: {
    /** Returns a 24h signed URL for the item's audio; generates it on first call. */
    async generate(itemId: string, mode: 'summary' | 'full'): Promise<{ url: string; cached: boolean }> {
      return await invokeFn('tts-generate', { item_id: itemId, mode });
    },
  },
};
