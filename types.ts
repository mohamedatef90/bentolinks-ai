export type ItemStatus = 'pending' | 'parsing' | 'enriching' | 'ready' | 'degraded' | 'failed';

export type SourceType =
  | 'article' | 'youtube' | 'reel' | 'tweet' | 'pdf' | 'rss' | 'reddit' | 'podcast' | 'other';

/** Which client saved the item (web app, Linkat mobile, extension, bulk import, RSS poller). */
export type SavedVia = 'web' | 'mobile' | 'extension' | 'import' | 'rss';

/** Row shape of the content_items table (fields the UI needs). */
export interface ContentItem {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  content_text?: string | null;
  published_at?: string | null;
  summary: string | null;
  key_points: string[] | null;
  tags: string[];
  topic: string | null;
  source_type: SourceType;
  status: ItemStatus;
  saved_via: SavedVia;
  site_name: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  is_pinned: boolean;
  is_starred: boolean;
  read_status: 'unread' | 'reading' | 'read';
  section: string | null;
  created_at: string;
  item_folders?: { folder_id: string }[];
}

/** Row shape of the folders table (tree via parent_id, max depth 3). */
export interface Folder {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  position: number;
}

/** Row shape of the smart_collections table. */
export interface SmartCollection {
  id: string;
  name: string;
  icon: string | null;
  position: number;
  is_system: boolean;
  query: FilterState;
}

/** Filter descriptor — same jsonb shape stored in smart_collections.query. */
export interface FilterState {
  source_type?: SourceType[];
  saved_via?: SavedVia[];
  read_status?: ('unread' | 'reading' | 'read')[];
  tags?: string[];
  topic?: string;
  is_starred?: boolean;
  sort?: 'date_desc' | 'date_asc' | 'title_asc';
  /** Present only on seeded system collections; not user-editable. */
  system?: string;
}

/** Row shape of the rss_subscriptions table. */
export interface RssSubscription {
  id: string;
  feed_url: string;
  site_url: string | null;
  title: string | null;
  favicon_url: string | null;
  last_fetched_at: string | null;
  last_error: string | null;
  error_count: number;
  is_active: boolean;
  created_at: string;
}

/** Feed candidate returned by the discover-feed Edge Function. */
export interface FeedCandidate {
  title: string | null;
  feed_url: string;
  /** true when the function fetched and parsed the feed itself. */
  validated: boolean;
}

/** UI card shape (adapter over ContentItem, kept for existing components). */
export interface Link {
  id: string;
  url: string;
  title: string;
  description: string;
  categoryId: string;
  section?: string;
  createdAt: number;
  user_id?: string;
  favicon?: string;
  isPinned?: boolean;
  isStarred?: boolean;
  readStatus?: 'unread' | 'reading' | 'read';
  status?: ItemStatus;
  summary?: string | null;
  tags?: string[];
  thumbnailUrl?: string | null;
  sourceType?: SourceType;
  savedVia?: SavedVia;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  user_id?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
}

export type AppTheme = 'default' | 'professional' | 'funny';
