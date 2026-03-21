
import { Category } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-ai', name: 'AI Tools', color: 'bg-[#c1ff00]', icon: 'fa-robot' },
  { id: 'cat-1', name: 'Productivity', color: 'bg-zinc-600/20', icon: 'fa-briefcase' },
  { id: 'cat-2', name: 'Design', color: 'bg-pink-600/20', icon: 'fa-palette' },
  { id: 'cat-3', name: 'Development', color: 'bg-blue-600/20', icon: 'fa-code' },
  { id: 'cat-4', name: 'Entertainment', color: 'bg-purple-600/20', icon: 'fa-play' },
  { id: 'cat-5', name: 'News', color: 'bg-orange-600/20', icon: 'fa-newspaper' },
  { id: 'cat-6', name: 'Uncategorized', color: 'bg-zinc-700/20', icon: 'fa-folder' }
];

export const CATEGORY_COLORS = [
  'bg-[#c1ff00]', 'bg-blue-600/20', 'bg-pink-600/20', 'bg-purple-600/20', 'bg-orange-600/20',
  'bg-zinc-600/20', 'bg-teal-600/20', 'bg-emerald-600/20'
];

export const CATEGORY_ICONS = [
  'fa-robot', 'fa-sparkles', 'fa-bolt', 'fa-briefcase', 'fa-palette', 'fa-code', 'fa-play', 'fa-newspaper',
  'fa-graduation-cap', 'fa-heart', 'fa-link'
];
