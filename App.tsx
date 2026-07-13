
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Category, Link, AppTheme, Folder, SmartCollection } from './types';
import LinkCard from './components/LinkCard';
import AddLinkModal from './components/AddLinkModal';
import ImportModal from './components/ImportModal';
import ProgressModal from './components/ProgressModal';
import SettingsView from './components/SettingsView';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import AuthView from './components/AuthView';
import FolderSidebar from './components/FolderSidebar';
import LibraryView, { LibraryMode } from './views/LibraryView';
import ReaderView from './views/ReaderView';
import FeedsView from './views/FeedsView';
import { ParsedBookmark } from './services/bookmarkService';
import { supabase } from './services/supabase';
import { api, toLink } from './services/api';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

type SortOption = 'date' | 'name' | 'custom';

interface LibraryLayoutProps {
  folders: Folder[];
  smartCollections: SmartCollection[];
  onDeleteSmartCollection: (id: string) => void;
  children: React.ReactNode;
}

/** Module-level (not defined inside App) so it keeps a stable component identity across
 * App's frequent re-renders (e.g. the once-a-second clock tick) — otherwise React would
 * remount this subtree on every tick and the child view's data fetch would never finish. */
const LibraryLayout: React.FC<LibraryLayoutProps> = ({ folders, smartCollections, onDeleteSmartCollection, children }) => (
  <div className="flex gap-8 items-start">
    <FolderSidebar folders={folders} smartCollections={smartCollections} onDeleteSmartCollection={onDeleteSmartCollection} />
    <div className="flex-grow min-w-0">{children}</div>
  </div>
);

const App: React.FC = () => {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('bento-theme');
    return (saved as AppTheme) || 'default';
  });

  const [links, setLinks] = useState<Link[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [smartCollections, setSmartCollections] = useState<SmartCollection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [draggedPinnedId, setDraggedPinnedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'link' | 'category', id: string, name: string } | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, active: false });

  const categoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !session) return;
    fetchVaultData();

    // Live pipeline updates: pending -> parsing -> enriching -> ready
    const unsubscribe = api.items.subscribeToChanges((updated) => {
      setLinks(prev => prev.map(l => {
        if (l.id !== updated.id) return l;
        return {
          ...l,
          title: (updated.title as string) ?? l.title,
          description: (updated.summary as string) ?? (updated.description as string) ?? l.description,
          status: (updated.status as Link['status']) ?? l.status,
          summary: (updated.summary as string) ?? l.summary,
          tags: (updated.tags as string[]) ?? l.tags,
          favicon: (updated.favicon_url as string) ?? l.favicon,
          thumbnailUrl: (updated.thumbnail_url as string) ?? l.thumbnailUrl,
        };
      }));
    });
    return unsubscribe;
  }, [session, isAuthLoading]);

  const fetchVaultData = async () => {
    try {
      const [items, cats, folderTree, collections] = await Promise.all([
        api.items.fetchAll(),
        api.folders.fetchAll(),
        api.folders.fetchTree(),
        api.smartCollections.fetchAll(),
      ]);
      setCategories(cats);
      setFolders(folderTree);
      setSmartCollections(collections);
      setLinks(items.map(toLink));
    } catch (err) {
      console.error("Failed to fetch vault data:", err);
    }
  };

  const refreshFolders = async () => {
    try {
      setFolders(await api.folders.fetchTree());
    } catch (err) {
      console.error("Failed to refresh folders:", err);
    }
  };

  const refreshSmartCollections = async () => {
    try {
      setSmartCollections(await api.smartCollections.fetchAll());
    } catch (err) {
      console.error("Failed to refresh smart collections:", err);
    }
  };

  const handleDeleteSmartCollection = async (id: string) => {
    try {
      await api.smartCollections.delete(id);
      setSmartCollections(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  useEffect(() => {
    localStorage.setItem('bento-theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const addLink = async (url: string, folderId?: string) => {
    const result = await api.items.save(url, folderId);
    if (result.duplicate) {
      throw new Error('Already saved — this URL is in your vault.');
    }
    const item = await api.items.fetchOne(result.id);
    if (item) setLinks(prev => [toLink(item), ...prev]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdateLink = async (id: string, updates: Partial<Link>) => {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    try {
      await api.items.update(id, {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.isPinned !== undefined ? { is_pinned: updates.isPinned } : {}),
      });
    } catch (e: any) {
      alert(`Update sync failed: ${e.message}`);
      fetchVaultData();
    }
  };

  const handleAddCategory = async (name: string, color: string, icon: string) => {
    try {
      const created = await api.folders.create(name, color, icon);
      setCategories(prev => [...prev, created]);
      refreshFolders();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateCategory = async (id: string, name: string, color: string, icon: string) => {
    try {
      await api.folders.update(id, { name, color, icon });
      setCategories(prev => prev.map(c => c.id === id ? { id, name, color, icon } : c));
      refreshFolders();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const confirmDeleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (cat) setDeleteTarget({ type: 'category', id, name: cat.name });
  };

  const executeDeleteCategory = async (id: string) => {
    if (activeCategory === id) setActiveCategory(null);
    try {
      await api.folders.delete(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      // Items in the folder become unfiled (assignments cascade server-side)
      setLinks(prev => prev.map(l => l.categoryId === id ? { ...l, categoryId: '' } : l));
      refreshFolders();
    } catch (e: any) {
      alert(`Failed to delete folder: ${e.message}`);
    }
  };

  const handleReorderCategories = (startIndex: number, endIndex: number) => {
    setCategories(prev => {
      const newCats = [...prev];
      const [removed] = newCats.splice(startIndex, 1);
      newCats.splice(endIndex, 0, removed);
      return newCats;
    });
  };

  const handleImport = async (parsedBookmarks: ParsedBookmark[], mode: 'add' | 'replace') => {
    const uniqueInput = Array.from(new Map(parsedBookmarks.map(item => [item.url.toLowerCase(), item])).values());
    if (uniqueInput.length === 0) return;

    if (mode === 'replace') {
      try {
        await api.items.deleteAll();
        setLinks([]);
      } catch (e: any) {
        alert(`Failed to clear vault: ${e.message}`);
        return;
      }
    }

    const urls = uniqueInput.map(b => b.url);
    const BATCH = 100;
    const totalBatches = Math.ceil(urls.length / BATCH);
    setImportProgress({ current: 0, total: urls.length, active: true });

    let imported = 0;
    for (let i = 0; i < totalBatches; i++) {
      const slice = urls.slice(i * BATCH, (i + 1) * BATCH);
      try {
        const results = await api.items.saveBatch(slice);
        imported += results.filter(r => !r.error && !r.duplicate).length;
      } catch (e) {
        console.error(`Import batch ${i + 1}/${totalBatches} failed:`, e);
      }
      setImportProgress(prev => ({ ...prev, current: Math.min((i + 1) * BATCH, urls.length) }));
    }

    setImportProgress({ current: 0, total: 0, active: false });
    await fetchVaultData();
    if (imported < urls.length) {
      console.info(`Import: ${imported} new, ${urls.length - imported} duplicates/errors skipped.`);
    }
  };

  const confirmDeleteLink = (id: string) => {
    const link = links.find(l => l.id === id);
    if (link) setDeleteTarget({ type: 'link', id, name: link.title });
  };

  const executeDeleteLink = async (id: string) => {
    try {
      await api.items.delete(id);
      setLinks(prev => prev.filter(l => l.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const togglePin = async (id: string) => {
    const item = links.find(l => l.id === id);
    if (!item) return;
    const next = !item.isPinned;
    setLinks(prev => prev.map(l => l.id === id ? { ...l, isPinned: next } : l));
    try {
      await api.items.update(id, { is_pinned: next });
    } catch (e: any) {
      alert(e.message);
      setLinks(prev => prev.map(l => l.id === id ? { ...l, isPinned: !next } : l));
    }
  };

  const handleCategoryChange = async (linkId: string, categoryId: string) => {
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, categoryId } : l));
    try {
      await api.items.setFolder(linkId, categoryId || null);
    } catch (e: any) {
      alert(e.message);
      fetchVaultData();
    }
  };

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

  const handlePinnedDragStart = (id: string) => {
    setDraggedPinnedId(id);
  };

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

  const pinnedLinks = useMemo<Link[]>(() => links.filter(l => l.isPinned), [links]);

  const processingLinks = useMemo<Link[]>(
    () => links.filter(l => l.status === 'pending' || l.status === 'parsing' || l.status === 'enriching'),
    [links]
  );

  const sortedLinks = useMemo<Link[]>(() => {
    let result = [...links];
    if (sortBy === 'date') result.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'name') result.sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [links, sortBy]);

  const filteredLinks = useMemo<Link[]>(() => {
    const q = searchQuery.toLowerCase();
    return sortedLinks.filter(link => {
      const matchesSearch = link.title.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        (link.summary || '').toLowerCase().includes(q) ||
        (link.tags || []).some(t => t.includes(q));
      const matchesCategory = activeCategory ? link.categoryId === activeCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [sortedLinks, searchQuery, activeCategory]);

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

  const stats = useMemo(() => ({
    total: links.length,
    enriched: links.filter(l => !!l.summary).length,
    processing: processingLinks.length,
  }), [links, processingLinks]);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const renderLibrary = (mode: LibraryMode) => (
    <LibraryView
      mode={mode}
      searchQuery={searchQuery}
      folders={folders}
      smartCollections={smartCollections}
      onSmartCollectionsChanged={refreshSmartCollections}
    />
  );

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
      <ProgressModal current={importProgress.current} total={importProgress.total} isComplete={!importProgress.active} />

      {deleteTarget && (
        <DeleteConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;
            if (deleteTarget.type === 'link') executeDeleteLink(deleteTarget.id);
            else executeDeleteCategory(deleteTarget.id);
          }}
          title={`Delete ${deleteTarget.type === 'link' ? 'Resource' : 'Folder'}`}
          message={deleteTarget.type === 'link' ? `Delete "${deleteTarget.name}" permanently?` : `Delete folder "${deleteTarget.name}"? Items will become unfiled.`}
        />
      )}

      <nav className="h-20 flex items-center justify-between px-6 lg:px-12 sticky top-0 bg-[#0c0c0e]/80 backdrop-blur-xl z-40 border-b border-white/[0.02]">
        <div className="flex items-center gap-12">
          <NavLink to="/" className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveCategory(null)}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform duration-300 overflow-hidden p-1 shadow-lg border border-white/10">
              <img src="https://i.postimg.cc/L5YGmDmQ/0058ae6839e5283293bcada1598f2309.jpg" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <span className="font-extrabold text-xl tracking-tighter uppercase">BentoLinks</span>
          </NavLink>
          <div className="hidden lg:flex items-center bg-[#151518] border border-white/[0.04] rounded-full p-1.5 shadow-xl">
            <NavLink to="/" end onClick={() => setActiveCategory(null)} className={({ isActive }) => `px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${isActive ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}>Vault Hub</NavLink>
            <NavLink to="/library" className={({ isActive }) => `px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${isActive ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}>Library</NavLink>
            <NavLink to="/settings" className={({ isActive }) => `px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${isActive ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}>Configuration</NavLink>
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
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Cloud Live
              </span>
            </div>
            <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 overflow-hidden cursor-pointer hover:border-red-500 transition-all group relative">
              <img src={`https://ui-avatars.com/api/?name=${session?.user?.email || 'Local'}&background=c1ff00&color=000`} alt="avatar" />
              <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <i className="fa-solid fa-power-off text-xs"></i>
              </div>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6 lg:p-12 space-y-12 pb-24">
        <Routes>
          <Route path="/" element={
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
                      <div className="flex flex-col"><span className="text-[9px] font-black text-zinc-500 uppercase">AI Enriched</span><span className="text-2xl font-black text-zinc-400">{stats.enriched}</span></div>
                    </div>
                  </div>
                </div>
                <div className="w-1/2 relative bg-zinc-900/30 p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">AI Pipeline</p>
                    {stats.processing > 0 && (
                      <span className="px-3 py-1 bg-[#c1ff00]/10 border border-[#c1ff00]/30 rounded-full text-[9px] font-black text-[#c1ff00] uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                        {stats.processing} processing
                      </span>
                    )}
                  </div>
                  <div className="flex-grow overflow-y-auto no-scrollbar space-y-3">
                    {processingLinks.length > 0 ? (
                      processingLinks.slice(0, 6).map(link => (
                        <div key={`pipe-${link.id}`} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                          <i className="fa-solid fa-spinner fa-spin text-[#c1ff00] text-xs shrink-0"></i>
                          <div className="min-w-0 flex-grow">
                            <p className="text-[11px] font-bold text-zinc-300 truncate">{link.title}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{link.status === 'pending' ? 'Queued' : link.status === 'parsing' ? 'Reading content' : 'AI analysis'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                        <i className="fa-solid fa-circle-check text-2xl text-zinc-600"></i>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Pipeline idle — all items processed</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Priority Vault Card - Grid Style */}
              <div className="lg:col-span-4 bento-card p-8 flex flex-col shadow-2xl min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1c1c1c] border border-white/10 flex items-center justify-center text-white">
                      <i className="fa-solid fa-thumbtack text-xs"></i>
                    </div>
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Priority Vault</p>
                  </div>
                  <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                    {pinnedLinks.length} Items
                  </span>
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
                        className="group relative flex flex-col items-center justify-center p-3 bg-white/[0.02] rounded-2xl border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer text-center min-h-[80px]"
                      >
                        <div className="w-[34px] h-[34px] rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-lg mb-2">
                          <img
                            src={link.favicon || `https://www.google.com/s2/favicons?sz=64&domain=${link.url}`}
                            alt=""
                            className="w-5 h-5 object-contain"
                            onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${link.title}&background=18181b&color=fff`)}
                          />
                        </div>
                        <p className="text-[9px] font-black text-zinc-400 truncate w-full uppercase tracking-tighter leading-tight">
                          {link.title}
                        </p>
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
                  {/* Left Arrow */}
                  <button
                    onClick={() => scrollCategories('left')}
                    className="absolute -left-4 z-20 w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 text-white flex items-center justify-center hover:bg-neon-accent hover:text-black transition-all opacity-0 group-hover/nav:opacity-100 shadow-xl"
                  >
                    <i className="fa-solid fa-chevron-left text-[10px]"></i>
                  </button>

                  <div
                    ref={categoryScrollRef}
                    className="flex items-center bg-[#151518] border border-white/[0.04] rounded-full p-1.5 w-full xl:w-auto overflow-x-auto no-scrollbar shadow-2xl relative"
                  >
                    <button onClick={() => setActiveCategory(null)} className={`whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${!activeCategory ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}>Primary Feed</button>
                    {categories.map(cat => (
                      <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeCategory === cat.id ? `${cat.color} text-black shadow-lg` : 'text-zinc-500 hover:text-white'}`}>{cat.name}</button>
                    ))}
                  </div>

                  {/* Right Arrow */}
                  <button
                    onClick={() => scrollCategories('right')}
                    className="absolute -right-4 z-20 w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 text-white flex items-center justify-center hover:bg-neon-accent hover:text-black transition-all opacity-0 group-hover/nav:opacity-100 shadow-xl"
                  >
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
                            <LinkCard link={link} category={categories.find(c => c.id === link.categoryId)} categories={categories} onDelete={confirmDeleteLink} onTogglePin={togglePin} onUpdateLink={handleUpdateLink} onChangeCategory={handleCategoryChange} />
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
                          <LinkCard link={link} category={categories.find(c => c.id === link.categoryId)} categories={categories} onDelete={confirmDeleteLink} onTogglePin={togglePin} onUpdateLink={handleUpdateLink} onChangeCategory={handleCategoryChange} />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-24 text-center space-y-4">
                        <i className="fa-solid fa-box-open text-4xl text-zinc-800"></i>
                        <div className="space-y-1">
                          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">The vault is empty</p>
                          <p className="text-zinc-700 text-[10px] font-bold">Save a URL and the AI pipeline will parse, summarize and tag it.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
          } />
          <Route path="/inbox" element={<LibraryLayout folders={folders} smartCollections={smartCollections} onDeleteSmartCollection={handleDeleteSmartCollection}>{renderLibrary('inbox')}</LibraryLayout>} />
          <Route path="/library" element={<LibraryLayout folders={folders} smartCollections={smartCollections} onDeleteSmartCollection={handleDeleteSmartCollection}>{renderLibrary('library')}</LibraryLayout>} />
          <Route path="/folder/:folderId" element={<LibraryLayout folders={folders} smartCollections={smartCollections} onDeleteSmartCollection={handleDeleteSmartCollection}>{renderLibrary('folder')}</LibraryLayout>} />
          <Route path="/collection/:collectionId" element={<LibraryLayout folders={folders} smartCollections={smartCollections} onDeleteSmartCollection={handleDeleteSmartCollection}>{renderLibrary('collection')}</LibraryLayout>} />
          <Route path="/feeds" element={<LibraryLayout folders={folders} smartCollections={smartCollections} onDeleteSmartCollection={handleDeleteSmartCollection}><FeedsView /></LibraryLayout>} />
          <Route path="/item/:id" element={<ReaderView />} />
          <Route path="/settings" element={<SettingsView categories={categories} currentTheme={theme} onThemeChange={setTheme} onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={confirmDeleteCategory} onReorderCategories={handleReorderCategories} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AddLinkModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} categories={categories} onAdd={addLink} />
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImport} existingCount={links.length} />
    </div>
  );
};

export default App;
