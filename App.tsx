import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, AppTheme } from './types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from './constants';
import LinkCard from './components/LinkCard';
import AddLinkModal from './components/AddLinkModal';
import ImportModal from './components/ImportModal';
import ProgressModal from './components/ProgressModal';
import SettingsView from './components/SettingsView';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import NewsVerticalFeed from './components/NewsVerticalFeed';
import AuthView from './components/AuthView';
import { ToastContainer, useToast } from './components/Toast';
import { EmptyState } from './components/EmptyState';
import { NoLinksIllustration, NoResultsIllustration } from './components/EmptyStateIllustration';
import { InitialLoading } from './components/InitialLoading';
import { ParsedBookmark } from './services/bookmarkService';
import { analyzeLink } from './services/geminiService';
import { supabase, db } from './services/supabase';
import { useAuth } from './hooks/useAuth';
import { useLinks } from './hooks/useLinks';
import { useCategories } from './hooks/useCategories';
import { useTheme } from './hooks/useTheme';
import { useNews } from './hooks/useNews';
import { useDebounce } from './hooks/useDebounce';

type SortOption = 'date' | 'name' | 'custom';

const App: React.FC = () => {
  // Custom Hooks
  const { session, isLoading: isAuthLoading } = useAuth();
  const { links, setLinks, addLink: addLinkHook, updateLink, deleteLink: deleteLinkHook, togglePin, changeCategory } = useLinks(session);
  const { categories, setCategories, addCategory, updateCategory, deleteCategory: deleteCategoryHook, reorderCategories } = useCategories(session);
  const { theme, setTheme } = useTheme();
  const { news, isLoading: isNewsLoading } = useNews();
  const { toasts, showToast, removeToast } = useToast();

  // UI State
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('custom');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [draggedPinnedId, setDraggedPinnedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'link' | 'category', id: string, name: string } | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, active: false });

  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Add link
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsModalOpen(true);
      }
      
      // ESC: Close modal
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
      
      // Cmd/Ctrl + I: Import
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setIsImportModalOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isModalOpen]);

  // Add link handler
  const handleAddLink = async (url: string, title: string, description: string, categoryName: string, icon?: string, sectionLabel?: string) => {
    if (links.some(l => l.url.toLowerCase() === url.toLowerCase())) {
      showToast("This resource is already archived in your vault.", 'warning');
      return;
    }

    let category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

    if (!category) {
      const newCategory = {
        id: `cat-${Date.now()}`,
        name: categoryName,
        color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
        icon: icon || CATEGORY_ICONS[Math.floor(Math.random() * CATEGORY_ICONS.length)],
        user_id: session?.user?.id
      };

      try {
        await db.categories.upsert(newCategory);
        setCategories(prev => [...prev, newCategory]);
        category = newCategory;
        showToast(`Category "${categoryName}" created successfully`, 'success');
      } catch (e: any) {
        showToast(`Failed to create category: ${e.message}`, 'error');
        return;
      }
    }

    const newLink: Link = {
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      title,
      description,
      categoryId: category.id,
      section: sectionLabel || 'General Archive',
      createdAt: Date.now(),
      isPinned: false,
      user_id: session?.user?.id
    };

    try {
      await addLinkHook(newLink);
      setIsModalOpen(false);
      showToast(`Link "${title || url}" added successfully`, 'success');
    } catch (err: any) {
      showToast(`Sync Failed: ${err.message}. Please check your database tables.`, 'error');
    }
  };

  // Import handler
  const handleImport = async (parsedBookmarks: ParsedBookmark[], mode: 'add' | 'replace', strategy: 'fast' | 'accurate') => {
    const uniqueInput = Array.from(new Map(parsedBookmarks.map(item => [item.url.toLowerCase(), item])).values());
    const existingUrls = mode === 'replace' ? new Set<string>() : new Set(links.map(l => l.url.toLowerCase()));
    const toProcess = uniqueInput.filter(b => !existingUrls.has(b.url.toLowerCase()));

    if (toProcess.length === 0) {
      if (mode === 'replace') {
        setLinks([]);
        for (const l of links) await db.links.delete(l.id);
      }
      return;
    }

    const finalLinks: Link[] = mode === 'replace' ? [] : [...links];
    if (mode === 'replace') {
      for (const l of links) await db.links.delete(l.id);
    }

    if (strategy === 'fast') {
      const uncategorizedId = categories.find(c => c.name === 'Uncategorized')?.id || 'cat-6';
      for (let i = 0; i < toProcess.length; i++) {
        const b = toProcess[i];
        const newLink: Link = {
          id: `link-fast-${Date.now()}-${i}`,
          url: b.url,
          title: b.title,
          description: "Quick imported link",
          categoryId: uncategorizedId,
          section: 'General Archive',
          createdAt: b.addDate || Date.now(),
          isPinned: false,
          user_id: session?.user?.id
        };
        finalLinks.unshift(newLink);
        await db.links.upsert(newLink);
      }
      setLinks([...finalLinks]);
      return;
    }

    setImportProgress({ current: 0, total: toProcess.length, active: true });
    const uncategorizedId = categories.find(c => c.name === 'Uncategorized')?.id || 'cat-6';

    for (let i = 0; i < toProcess.length; i++) {
      const b = toProcess[i];
      setImportProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const result = await analyzeLink(b.url, categories.map(c => c.name));
        let targetCategory = categories.find(c => c.name.toLowerCase() === result.categoryName.toLowerCase());

        if (!targetCategory) {
          const newCat = {
            id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: result.categoryName,
            color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
            icon: result.categoryIcon,
            user_id: session?.user?.id
          };
          await db.categories.upsert(newCat);
          setCategories(prev => [...prev, newCat]);
          targetCategory = newCat;
        }

        const newLink: Link = {
          id: `link-import-${Date.now()}-${i}`,
          url: b.url,
          title: result.suggestedTitle || b.title,
          description: result.suggestedDescription,
          categoryId: targetCategory.id,
          section: result.suggestedSection || 'General Archive',
          createdAt: b.addDate || Date.now(),
          isPinned: false,
          user_id: session?.user?.id
        };
        finalLinks.unshift(newLink);
        await db.links.upsert(newLink);

        await new Promise(r => setTimeout(r, 500));
        if (i % 5 === 0 || i === toProcess.length - 1) setLinks([...finalLinks]);
      } catch (err) {
        const fallback: Link = {
          id: `link-import-${Date.now()}-${i}`,
          url: b.url,
          title: b.title,
          description: "Imported link (AI analysis skipped)",
          categoryId: uncategorizedId,
          section: 'General Archive',
          createdAt: b.addDate || Date.now(),
          isPinned: false,
          user_id: session?.user?.id
        };
        finalLinks.unshift(fallback);
        await db.links.upsert(fallback).catch(() => { });
        setLinks([...finalLinks]);
      }
    }
    setImportProgress({ current: 0, total: 0, active: false });
  };

  // Delete handlers
  const confirmDeleteLink = (id: string) => {
    const link = links.find(l => l.id === id);
    if (link) setDeleteTarget({ type: 'link', id, name: link.title });
  };

  const confirmDeleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (cat) setDeleteTarget({ type: 'category', id, name: cat.name });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'link') {
      await deleteLinkHook(deleteTarget.id);
    } else {
      if (activeCategory === deleteTarget.id) setActiveCategory(null);
      const uncategorizedId = categories.find(c => c.name === 'Uncategorized')?.id || 'cat-6';
      const updatedLinks = links.map(l => l.categoryId === deleteTarget.id ? { ...l, categoryId: uncategorizedId } : l);
      
      await deleteCategoryHook(deleteTarget.id);
      setLinks(updatedLinks);
      for (const l of updatedLinks.filter(l => l.categoryId === uncategorizedId)) {
        await db.links.upsert(l);
      }
    }
    setDeleteTarget(null);
  };

  // Drag and drop
  const handleDragStart = (id: string) => {
    if (sortBy !== 'custom') return;
    setDraggedLinkId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (sortBy !== 'custom') return;
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (sortBy !== 'custom' || !draggedLinkId || draggedLinkId === targetId) return;
    setLinks(prev => {
      const newLinks = [...prev];
      const draggedIdx = newLinks.findIndex(l => l.id === draggedLinkId);
      const targetIdx = newLinks.findIndex(l => l.id === targetId);
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      const [removed] = newLinks.splice(draggedIdx, 1);
      newLinks.splice(targetIdx, 0, removed);
      return newLinks;
    });
    setDraggedLinkId(null);
  };

  const handlePinnedDragStart = (id: string) => setDraggedPinnedId(id);

  const handlePinnedDrop = (targetId: string) => {
    if (!draggedPinnedId || draggedPinnedId === targetId) return;
    setLinks(prev => {
      const newLinks = [...prev];
      const draggedIdx = newLinks.findIndex(l => l.id === draggedPinnedId);
      const targetIdx = newLinks.findIndex(l => l.id === targetId);
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      const [removed] = newLinks.splice(draggedIdx, 1);
      newLinks.splice(targetIdx, 0, removed);
      return newLinks;
    });
    setDraggedPinnedId(null);
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 300;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Computed values
  const pinnedLinks = useMemo<Link[]>(() => links.filter(l => l.isPinned), [links]);

  const sortedLinks = useMemo<Link[]>(() => {
    let result = [...links];
    if (sortBy === 'date') result.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'name') result.sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [links, sortBy]);

  const filteredLinks = useMemo<Link[]>(() => {
    return sortedLinks.filter(link => {
      const matchesSearch = link.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        link.url.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesCategory = activeCategory ? link.categoryId === activeCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [sortedLinks, debouncedSearch, activeCategory]);

  const linksBySection = useMemo<Record<string, Link[]> | null>(() => {
    if (!activeCategory) return null;
    const groups: Record<string, Link[]> = {};
    filteredLinks.forEach(link => {
      const sec = link.section || 'General Archive';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(link);
    });
    return groups;
  }, [filteredLinks, activeCategory]);

  // Performance: Memoize links grouped by category
  const linksByCategory = useMemo(() => {
    return links.reduce((acc, link) => {
      const cat = link.categoryId || 'uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(link);
      return acc;
    }, {} as Record<string, Link[]>);
  }, [links]);

  const stats = useMemo(() => ({
    total: links.length,
    ai: links.filter(l => categories.find(c => c.id === l.categoryId)?.name === 'AI Tools').length,
    recent: links.filter(l => Date.now() - l.createdAt < 86400000).length
  }), [links, categories]);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-neon-accent/10 border-t-neon-accent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 animate-pulse">Initializing Vault Protocol</span>
        </div>
      </div>
    );
  }

  if (!session) return <AuthView />;

  return (
    <div className="min-h-screen selection:bg-neon-accent selection:text-black">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ProgressModal current={importProgress.current} total={importProgress.total} isComplete={!importProgress.active} />

      {deleteTarget && (
        <DeleteConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={executeDelete}
          title={`Delete ${deleteTarget.type === 'link' ? 'Resource' : 'Segment'}`}
          message={deleteTarget.type === 'link' ? `Delete "${deleteTarget.name}" permanently?` : `Delete segment "${deleteTarget.name}"? Links will be moved to Uncategorized.`}
        />
      )}

      <nav className="h-20 flex items-center justify-between px-6 lg:px-12 sticky top-0 bg-[#0c0c0e]/80 backdrop-blur-xl z-40 border-b border-white/[0.02]">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform duration-300 overflow-hidden p-1 shadow-lg border border-white/10">
              <img src="https://i.postimg.cc/L5YGmDmQ/0058ae6839e5283293bcada1598f2309.jpg" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <span className="font-extrabold text-xl tracking-tighter uppercase">BentoLinks</span>
          </div>
          <div className="hidden lg:flex items-center bg-[#151518] border border-white/[0.04] rounded-full p-1.5 shadow-xl">
            <button onClick={() => { setActiveCategory(null); setCurrentView('dashboard'); }} className={`px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${currentView === 'dashboard' && !activeCategory ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}>Vault Hub</button>
            <button onClick={() => setCurrentView('settings')} className={`px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${currentView === 'settings' ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}>Configuration</button>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="relative w-64 xl:w-80 group">
            <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px] group-focus-within:text-neon-accent"></i>
            <input type="text" placeholder="GLOBAL SEARCH..." className="w-full bg-white/5 border border-white/5 rounded-full py-3 pl-12 pr-5 focus:outline-none focus:ring-1 focus:ring-neon-accent transition-all text-[10px] font-bold uppercase tracking-widest placeholder:text-zinc-600" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 bg-white/5 border border-emerald-500/30 rounded-full flex items-center gap-2`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Cloud Live</span>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 overflow-hidden cursor-pointer hover:border-red-500 transition-all group relative">
              <img src={`https://ui-avatars.com/api/?name=${session?.user?.email || 'Local'}&background=c1ff00&color=000`} alt="avatar" />
              <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <i className="fa-solid fa-power-off text-xs"></i>
              </div>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6 lg:p-12 space-y-12 pb-24">
        {currentView === 'dashboard' ? (
          <>
            <div className="flex flex-col md:flex-row items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
                  <div className="w-1.5 h-1.5 bg-neon-accent rounded-full"></div>
                  Authenticated Protocol: {session.user.email}
                </div>
                <h1 className="text-6xl font-black tracking-tighter leading-none">Vault Dashboard</h1>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsImportModalOpen(true)} className="bg-[#151518] border border-white/10 text-white px-6 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all">Bulk Sync</button>
                <button onClick={() => setIsModalOpen(true)} className="bg-white text-black px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-neon-accent transition-all shadow-2xl">Create entry</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bento-card p-0 flex group overflow-hidden relative shadow-2xl min-h-[400px]">
                <div className="w-1/2 p-12 flex flex-col justify-between z-10 border-r border-white/5">
                  <div className="space-y-4">
                    <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.2em]">System Pulse</p>
                    <p className="text-7xl font-black text-white leading-none mb-2">{formattedTime}</p>
                    <p className="text-[11px] font-black text-neon-accent uppercase tracking-[0.3em] mb-8">{formattedDate}</p>
                    <div className="flex items-center gap-4 py-3 px-6 bg-white/[0.03] border border-white/[0.05] rounded-2xl">
                      <div className="flex flex-col"><span className="text-[9px] font-black text-zinc-500 uppercase">Records</span><span className="text-2xl font-black">{stats.total}</span></div>
                      <div className="w-px h-8 bg-white/10"></div>
                      <div className="flex flex-col"><span className="text-[9px] font-black text-zinc-500 uppercase">AI Sorted</span><span className="text-2xl font-black text-zinc-400">{stats.ai}</span></div>
                    </div>
                  </div>
                </div>
                <div className="w-1/2 relative bg-zinc-900/30"><NewsVerticalFeed news={news} isLoading={isNewsLoading} /></div>
              </div>

              <div className="lg:col-span-4 bento-card p-8 flex flex-col shadow-2xl min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#1c1c1c] border border-white/10 flex items-center justify-center text-white">
                      <i className="fa-solid fa-thumbtack text-xs"></i>
                    </div>
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Priority Vault</p>
                  </div>
                  <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-zinc-600 uppercase tracking-widest">{pinnedLinks.length} Items</span>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 no-scrollbar grid grid-cols-3 gap-4 content-start">
                  {pinnedLinks.length > 0 ? (
                    pinnedLinks.map(link => (
                      <a
                        key={`pinned-mini-${link.id}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        draggable
                        onDragStart={() => handlePinnedDragStart(link.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handlePinnedDrop(link.id)}
                        className="group relative flex flex-col items-center justify-center p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer text-center min-h-[80px]"
                      >
                        <div className="w-[34px] h-[34px] rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-lg mb-2">
                          <img
                            src={`https://www.google.com/s2/favicons?sz=64&domain=${link.url}`}
                            alt=""
                            className="w-5 h-5 object-contain"
                            onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${link.title}&background=18181b&color=fff`)}
                          />
                        </div>
                        <p className="text-[9px] font-black text-zinc-400 truncate w-full uppercase tracking-tighter leading-tight">{link.title}</p>
                      </a>
                    ))
                  ) : (
                    <div className="col-span-full h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-20">
                      <div className="w-12 h-12 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
                        <i className="fa-solid fa-plus text-zinc-700"></i>
                      </div>
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-10">
              <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 relative group/nav">
                <div className="relative flex items-center w-full xl:w-auto">
                  <button onClick={() => scrollCategories('left')} className="absolute -left-4 z-20 w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 text-white flex items-center justify-center hover:bg-neon-accent hover:text-black transition-all opacity-0 group-hover/nav:opacity-100 shadow-xl">
                    <i className="fa-solid fa-chevron-left text-[10px]"></i>
                  </button>

                  <div ref={categoryScrollRef} className="flex items-center bg-[#151518] border border-white/[0.04] rounded-full p-1.5 w-full xl:w-auto overflow-x-auto no-scrollbar shadow-2xl relative">
                    <button onClick={() => setActiveCategory(null)} className={`whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${!activeCategory ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}>Primary Feed</button>
                    {categories.map(cat => (
                      <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeCategory === cat.id ? `${cat.color} text-black shadow-lg` : 'text-zinc-500 hover:text-white'}`}>{cat.name}</button>
                    ))}
                  </div>

                  <button onClick={() => scrollCategories('right')} className="absolute -right-4 z-20 w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 text-white flex items-center justify-center hover:bg-neon-accent hover:text-black transition-all opacity-0 group-hover/nav:opacity-100 shadow-xl">
                    <i className="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                </div>

                <div className="flex items-center bg-[#151518] border border-white/[0.04] rounded-full p-1 shadow-xl">
                  {(['date', 'name', 'custom'] as SortOption[]).map((option) => (
                    <button key={option} onClick={() => setSortBy(option)} className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === option ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-600 hover:text-zinc-400'}`}>{option}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-16">
                {linksBySection ? (
                  Object.entries(linksBySection).map(([sectionName, sectionLinks]) => (
                    <div key={sectionName} className="space-y-8">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black uppercase tracking-[0.3em] text-zinc-100">{sectionName}</h2>
                        <div className="h-px flex-grow bg-white/5"></div>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{sectionLinks.length} Items</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
                        {sectionLinks.map((link) => (
                          <div key={link.id}>
                            <LinkCard link={link} category={categories.find(c => c.id === link.categoryId)} categories={categories} onDelete={confirmDeleteLink} onTogglePin={togglePin} onUpdateLink={updateLink} onChangeCategory={changeCategory} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
                    {filteredLinks.length > 0 ? (
                      filteredLinks.map((link) => (
                        <div key={link.id} draggable={sortBy === 'custom'} onDragStart={() => handleDragStart(link.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(link.id)} className={sortBy === 'custom' ? 'cursor-grab active:cursor-grabbing' : ''}>
                          <LinkCard link={link} category={categories.find(c => c.id === link.categoryId)} categories={categories} onDelete={confirmDeleteLink} onTogglePin={togglePin} onUpdateLink={updateLink} onChangeCategory={changeCategory} />
                        </div>
                      ))
                    ) : searchQuery ? (
                      <div className="col-span-full">
                        <EmptyState
                          icon={<NoResultsIllustration />}
                          title="No results found"
                          description={`No links matching "${searchQuery}". Try a different search term.`}
                        />
                      </div>
                    ) : (
                      <div className="col-span-full">
                        <EmptyState
                          icon={<NoLinksIllustration />}
                          title="No links yet"
                          description="Start building your collection by adding your first link. Use the button above or press Cmd/Ctrl+K"
                          action={{
                            label: "Add Your First Link",
                            onClick: () => setIsModalOpen(true),
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <SettingsView 
            categories={categories} 
            currentTheme={theme} 
            onThemeChange={setTheme} 
            onAddCategory={addCategory} 
            onUpdateCategory={updateCategory} 
            onDeleteCategory={confirmDeleteCategory} 
            onReorderCategories={reorderCategories} 
          />
        )}
      </main>

      <AddLinkModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} categories={categories} onAdd={handleAddLink} showToast={showToast} />
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImport} existingCount={links.length} />
    </div>
  );
};

export default App;
