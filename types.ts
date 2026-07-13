export type ItemStatus = 'pending' | 'parsing' | 'enriching' | 'ready' | 'degraded' | 'failed';

export type SourceType =
  | 'article' | 'youtube' | 'reel' | 'tweet' | 'pdf' | 'rss' | 'reddit' | 'podcast' | 'other';

/** Row shape of the content_items table (fields the UI needs). */
export interface ContentItem {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  key_points: string[] | null;
  tags: string[];
  topic: string | null;
  source_type: SourceType;
  status: ItemStatus;
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
  status?: ItemStatus;
  summary?: string | null;
  tags?: string[];
  thumbnailUrl?: string | null;
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
