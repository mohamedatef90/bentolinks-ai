
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { Link, Category } from '../types';

const SUPABASE_URL = 'https://sjskpjgepbvblojohtlr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqc2twamdlcGJ2Ymxvam9odGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzIzMzYsImV4cCI6MjA4NDU0ODMzNn0.x17WuelrlAXL_5UCyWo2FfD5BkH7IrPJbPWa9c125fY';

export const isSupabaseConfigured = true; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('categories').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

const getLocal = <T>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
};

const setLocal = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const db = {
  links: {
    async fetchAll() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return getLocal<Link[]>('bento-links', []);

      const { data, error } = await supabase
        .from('links')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Fetch links error:", error);
        return getLocal<Link[]>('bento-links', []);
      }

      return (data || []).map(row => ({
        id: row.id,
        url: row.url,
        title: row.title,
        description: row.description || '',
        categoryId: row.category_id,
        section: row.section || 'General Archive',
        createdAt: Number(row.created_at),
        isPinned: Boolean(row.is_pinned),
        user_id: row.user_id
      })) as Link[];
    },
    async upsert(link: Link) {
      const links = getLocal<Link[]>('bento-links', []);
      const idx = links.findIndex(l => l.id === link.id);
      if (idx > -1) links[idx] = link;
      else links.unshift(link);
      setLocal('bento-links', links);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const payload = {
          id: link.id,
          url: link.url,
          title: link.title,
          description: link.description || '',
          category_id: link.categoryId,
          section: link.section || 'General Archive',
          created_at: link.createdAt,
          is_pinned: link.isPinned || false,
          user_id: session.user.id
        };

        const { error } = await supabase.from('links').upsert(payload);
        
        if (error) {
          console.error("SUPABASE LINKS UPSERT ERROR:", error);
          throw new Error(`Failed to sync link to cloud: ${error.message}`);
        }
      }
    },
    async delete(id: string) {
      const links = getLocal<Link[]>('bento-links', []);
      setLocal('bento-links', links.filter(l => l.id !== id));

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.from('links').delete().eq('id', id);
        if (error) console.error("SUPABASE LINKS DELETE ERROR:", error);
      }
    }
  },
  categories: {
    async fetchAll() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return getLocal<Category[]>('bento-categories', []);

      const { data, error } = await supabase.from('categories').select('*');
      if (error) {
        console.error("Fetch categories error:", error);
        return getLocal<Category[]>('bento-categories', []);
      }
      return data as Category[];
    },
    async upsert(category: Category) {
      const cats = getLocal<Category[]>('bento-categories', []);
      const idx = cats.findIndex(c => c.id === category.id);
      if (idx > -1) cats[idx] = category;
      else cats.push(category);
      setLocal('bento-categories', cats);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.from('categories').upsert({
          id: category.id,
          name: category.name,
          color: category.color,
          icon: category.icon,
          user_id: session.user.id
        });
        if (error) {
          console.error("SUPABASE CATEGORIES UPSERT ERROR:", error);
          throw new Error(`Failed to sync category to cloud: ${error.message}`);
        }
      }
    },
    async delete(id: string) {
      const cats = getLocal<Category[]>('bento-categories', []);
      setLocal('bento-categories', cats.filter(c => c.id !== id));

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) console.error("SUPABASE CATEGORIES DELETE ERROR:", error);
      }
    }
  }
};
