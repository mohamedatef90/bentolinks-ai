import { useState, useEffect } from 'react';
import { Category } from '../types';
import { INITIAL_CATEGORIES } from '../constants';
import { db } from '../services/supabase';

export const useCategories = (session: any) => {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);

  useEffect(() => {
    if (session !== undefined) {
      fetchCategories();
    }
  }, [session]);

  const fetchCategories = async () => {
    try {
      const fetchedCats = await db.categories.fetchAll();
      let mergedCats = [...fetchedCats];

      if (session) {
        // Sync default categories for logged-in users
        for (const initCat of INITIAL_CATEGORIES) {
          if (!mergedCats.find(c => c.name.toLowerCase() === initCat.name.toLowerCase())) {
            const newCat = { ...initCat, user_id: session.user.id };
            try {
              await db.categories.upsert(newCat);
              mergedCats.push(newCat);
            } catch (e) {
              console.warn("Failed to sync default category:", initCat.name);
            }
          }
        }
      } else {
        // Add default categories for local mode
        INITIAL_CATEGORIES.forEach(initCat => {
          if (!mergedCats.find(c => c.name.toLowerCase() === initCat.name.toLowerCase())) {
            mergedCats.push(initCat);
          }
        });
      }

      setCategories(mergedCats);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const addCategory = async (name: string, color: string, icon: string) => {
    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name,
      color,
      icon,
      user_id: session?.user?.id
    };
    await db.categories.upsert(newCategory);
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = async (id: string, name: string, color: string, icon: string) => {
    const updated = { id, name, color, icon, user_id: session?.user?.id };
    await db.categories.upsert(updated);
    setCategories(prev => prev.map(c => c.id === id ? updated : c));
  };

  const deleteCategory = async (id: string) => {
    await db.categories.delete(id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const reorderCategories = (startIndex: number, endIndex: number) => {
    setCategories(prev => {
      const newCats = [...prev];
      const [removed] = newCats.splice(startIndex, 1);
      newCats.splice(endIndex, 0, removed);
      return newCats;
    });
  };

  return {
    categories,
    setCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    refreshCategories: fetchCategories
  };
};
