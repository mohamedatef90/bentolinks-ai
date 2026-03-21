import { useState, useEffect } from 'react';
import { Link } from '../types';
import { db } from '../services/supabase';

export const useLinks = (session: any) => {
  const [links, setLinks] = useState<Link[]>([]);

  useEffect(() => {
    if (session !== undefined) {
      fetchLinks();
    }
  }, [session]);

  const fetchLinks = async () => {
    const data = await db.links.fetchAll();
    setLinks(data);
  };

  const addLink = async (link: Link) => {
    await db.links.upsert(link);
    setLinks(prev => [link, ...prev]);
  };

  const updateLink = async (id: string, updates: Partial<Link>) => {
    const item = links.find(l => l.id === id);
    if (item) {
      const updated = { ...item, ...updates };
      await db.links.upsert(updated);
      setLinks(prev => prev.map(l => l.id === id ? updated : l));
    }
  };

  const deleteLink = async (id: string) => {
    await db.links.delete(id);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const togglePin = async (id: string) => {
    const item = links.find(l => l.id === id);
    if (item) {
      const updated = { ...item, isPinned: !item.isPinned };
      await db.links.upsert(updated);
      setLinks(prev => prev.map(l => l.id === id ? updated : l));
    }
  };

  const changeCategory = async (linkId: string, categoryId: string) => {
    const item = links.find(l => l.id === linkId);
    if (item) {
      const updated = { ...item, categoryId };
      await db.links.upsert(updated);
      setLinks(prev => prev.map(l => l.id === linkId ? updated : l));
    }
  };

  return { 
    links, 
    setLinks,
    addLink, 
    updateLink,
    deleteLink, 
    togglePin,
    changeCategory,
    refreshLinks: fetchLinks 
  };
};
