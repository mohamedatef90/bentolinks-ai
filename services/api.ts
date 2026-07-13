// Data layer for the RefVault backend: content_items/folders tables + Edge Functions.
// Replaces the old hybrid localStorage/Supabase `db` object.

import { supabase } from './supabase';
import { ContentItem, Link, Category } from '../types';

const ITEM_COLUMNS =
  'id, url, title, description, summary, key_points, tags, topic, source_type, status, ' +
  'site_name, thumbnail_url, favicon_url, is_pinned, is_starred, read_status, section, ' +
  'created_at, item_folders(folder_id)';

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
    status: item.status,
    summary: item.summary,
    tags: item.tags,
    thumbnailUrl: item.thumbnail_url,
    favicon: item.favicon_url || undefined,
  };
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
        .select(ITEM_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as ContentItem | null;
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

    async create(name: string, color: string, icon: string): Promise<Category> {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('folders')
        .insert({ user_id: user.id, name, color, icon })
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
};
