import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { ContentItem, FilterState, Folder, SmartCollection } from '../types';
import FilterBar from '../components/FilterBar';
import ItemCard from '../components/ItemCard';

export type LibraryMode = 'inbox' | 'library' | 'folder' | 'collection';

interface LibraryViewProps {
  mode: LibraryMode;
  searchQuery: string;
  folders: Folder[];
  smartCollections: SmartCollection[];
  onSmartCollectionsChanged: () => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ mode, searchQuery, folders, smartCollections, onSmartCollectionsChanged }) => {
  const { folderId, collectionId } = useParams();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [filter, setFilter] = useState<FilterState>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  const activeCollection = mode === 'collection' ? smartCollections.find(c => c.id === collectionId) : undefined;
  const activeFolder = mode === 'folder' ? folders.find(f => f.id === folderId) : undefined;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let data: ContentItem[];
        if (searchQuery.trim()) {
          const searchFilter = mode === 'collection' ? (activeCollection?.query ?? {}) : filter;
          data = await api.items.search(searchQuery.trim(), searchFilter);
        } else if (mode === 'folder' && folderId) {
          data = await api.items.fetchByFolder(folderId);
        } else if (mode === 'collection') {
          data = await api.items.fetchByFilter(activeCollection?.query ?? {});
        } else if (mode === 'inbox') {
          data = await api.items.fetchByFilter({ sort: 'date_desc' });
        } else {
          data = await api.items.fetchByFilter(filter);
        }
        if (!cancelled) setItems(data);
      } catch (err) {
        console.error('Failed to load library items:', err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mode, folderId, collectionId, filter, searchQuery, activeCollection]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.topic && set.add(i.topic));
    return Array.from(set).sort();
  }, [items]);

  const handleToggleStar = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const next = !item.is_starred;
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_starred: next } : i));
    try {
      await api.items.setStarred(id, next);
    } catch (e: any) {
      alert(e.message);
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_starred: !next } : i));
    }
  };

  const READ_CYCLE: Record<ContentItem['read_status'], ContentItem['read_status']> = {
    unread: 'reading', reading: 'read', read: 'unread',
  };

  const handleCycleReadStatus = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const next = READ_CYCLE[item.read_status];
    setItems(prev => prev.map(i => i.id === id ? { ...i, read_status: next } : i));
    try {
      await api.items.setReadStatus(id, next);
    } catch (e: any) {
      alert(e.message);
      setItems(prev => prev.map(i => i.id === id ? { ...i, read_status: item.read_status } : i));
    }
  };

  const handleSaveAsSmartCollection = async (name: string) => {
    try {
      await api.smartCollections.create(name, filter);
      onSmartCollectionsChanged();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const title = mode === 'inbox' ? 'Inbox'
    : mode === 'library' ? 'Library'
    : mode === 'folder' ? (activeFolder?.name ?? 'Folder')
    : (activeCollection?.name ?? 'Collection');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
            <div className="w-1.5 h-1.5 bg-neon-accent rounded-full"></div>
            {searchQuery.trim() ? `Search results for "${searchQuery.trim()}"` : `${items.length} item${items.length === 1 ? '' : 's'}`}
          </div>
          <h1 className="text-4xl font-black tracking-tighter leading-none">{title}</h1>
        </div>
        <div className="flex items-center bg-[#151518] border border-white/[0.04] rounded-full p-1 shadow-xl shrink-0">
          <button onClick={() => setViewMode('grid')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'}`} title="Grid view">
            <i className="fa-solid fa-grip text-xs"></i>
          </button>
          <button onClick={() => setViewMode('list')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'}`} title="List view">
            <i className="fa-solid fa-list text-xs"></i>
          </button>
        </div>
      </div>

      {(mode === 'library' || mode === 'inbox') && !searchQuery.trim() && (
        <FilterBar
          filter={filter}
          onChange={setFilter}
          availableTags={availableTags}
          availableTopics={availableTopics}
          onSaveAsSmartCollection={handleSaveAsSmartCollection}
        />
      )}

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="w-10 h-10 border-4 border-neon-accent/10 border-t-neon-accent rounded-full animate-spin"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="col-span-full py-24 text-center space-y-4">
          <i className="fa-solid fa-box-open text-4xl text-zinc-800"></i>
          <div className="space-y-1">
            <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Nothing here yet</p>
            <p className="text-zinc-700 text-[10px] font-bold">Save a URL and the AI pipeline will parse, summarize and tag it.</p>
          </div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8' : 'space-y-3'}>
          {items.map(item => (
            <ItemCard key={item.id} item={item} viewMode={viewMode} onToggleStar={handleToggleStar} onCycleReadStatus={handleCycleReadStatus} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LibraryView;
