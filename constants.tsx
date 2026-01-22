
import { Category } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-ai', name: 'AI Tools', color: 'bg-[#c1ff00]', icon: 'fa-robot' },
  { id: 'cat-1', name: 'Productivity', color: 'bg-zinc-100', icon: 'fa-briefcase' },
  { id: 'cat-2', name: 'Design', color: 'bg-zinc-100', icon: 'fa-palette' },
  { id: 'cat-3', name: 'Development', color: 'bg-zinc-100', icon: 'fa-code' },
  { id: 'cat-4', name: 'Entertainment', color: 'bg-zinc-100', icon: 'fa-play' },
  { id: 'cat-5', name: 'News', color: 'bg-zinc-100', icon: 'fa-newspaper' },
  { id: 'cat-6', name: 'Uncategorized', color: 'bg-zinc-700', icon: 'fa-folder' }
];

export const CATEGORY_COLORS = [
  'bg-[#c1ff00]', 'bg-blue-400', 'bg-pink-400', 'bg-purple-400', 'bg-orange-400',
  'bg-zinc-100', 'bg-teal-400', 'bg-emerald-400'
];

export const CATEGORY_ICONS = [
  'fa-robot', 'fa-sparkles', 'fa-bolt', 'fa-briefcase', 'fa-palette', 'fa-code', 'fa-play', 'fa-newspaper',
  'fa-graduation-cap', 'fa-heart', 'fa-link'
];
