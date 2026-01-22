
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
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  user_id?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  timestamp: string;
}

export interface AIAnalysisResult {
  categoryName: string;
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedSection: string;
  categoryIcon: string;
}

export type AppTheme = 'default' | 'professional' | 'funny';

export interface UserProfile {
  id: string;
  email?: string;
}
