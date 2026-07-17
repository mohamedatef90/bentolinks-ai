
import React, { useEffect, useState } from 'react';
import { Category, AppTheme, ApiKey } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { api } from '../services/api';

const MCP_ENDPOINT = 'https://sjskpjgepbvblojohtlr.supabase.co/functions/v1/mcp';

/** Self-contained "MCP Access" card: mint / list / revoke personal API keys so
 *  AI agents (Claude, Codex, …) can read and write the vault. */
const ApiKeysCard: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null); // shown once
  const [copied, setCopied] = useState<'key' | 'cmd' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.apiKeys.list().then(setKeys).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const plaintext = await api.apiKeys.create(name.trim() || 'API key');
      setNewKey(plaintext);
      setName('');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    try { await api.apiKeys.revoke(id); await load(); } catch (e: any) { setError(e.message); }
  };
  const remove = async (id: string) => {
    try { await api.apiKeys.remove(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const copy = (text: string, which: 'key' | 'cmd') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const addCmd = newKey
    ? `claude mcp add --transport http refvault ${MCP_ENDPOINT} --header "Authorization: Bearer ${newKey}"`
    : '';

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="bento-card p-10 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-zinc-500 font-black uppercase tracking-widest text-[10px]">
          <i className="fa-solid fa-robot text-neon-accent"></i>
          MCP Access · agent API keys
        </div>
        <span className="text-[10px] font-bold text-zinc-600">Let Claude, Codex &amp; other agents read/write your vault</span>
      </div>

      <p className="text-[11px] text-zinc-500 font-bold leading-relaxed -mt-4">
        Generate a personal key, then connect any MCP-capable agent to{' '}
        <code className="text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">{MCP_ENDPOINT}</code>.
        The agent can create categories, save links &amp; notes, search, and organize — scoped only to your account.
      </p>

      {/* one-time plaintext reveal */}
      {newKey && (
        <div className="rounded-2xl border border-neon-accent/40 bg-neon-accent/[0.06] p-5 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-neon-accent flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> Copy this key now — it won't be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-xs font-mono text-zinc-200 bg-[#0A1320] border border-white/10 rounded-xl px-4 py-3">{newKey}</code>
            <button onClick={() => copy(newKey, 'key')} className="shrink-0 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest transition-all">
              {copied === 'key' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">Add to Claude Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-[11px] font-mono text-zinc-400 bg-[#0A1320] border border-white/10 rounded-xl px-4 py-3">{addCmd}</code>
              <button onClick={() => copy(addCmd, 'cmd')} className="shrink-0 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest transition-all">
                {copied === 'cmd' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <button onClick={() => setNewKey(null)} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Done</button>
        </div>
      )}

      {/* existing keys */}
      <div className="space-y-2">
        {keys.length === 0 ? (
          <p className="text-[11px] font-bold text-zinc-600 py-4 text-center">No API keys yet.</p>
        ) : keys.map(k => {
          const revoked = !!k.revoked_at;
          return (
            <div key={k.id} className={`flex items-center justify-between gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 ${revoked ? 'opacity-50' : ''}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">{k.name}</span>
                  {revoked && <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded-full text-[8px] font-black uppercase tracking-widest text-red-400">Revoked</span>}
                </div>
                <p className="text-[10px] text-zinc-600 font-bold font-mono">{k.key_prefix}…· created {fmt(k.created_at)} · used {fmt(k.last_used_at)}</p>
              </div>
              {revoked ? (
                <button onClick={() => remove(k.id)} className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors">Delete</button>
              ) : (
                <button onClick={() => revoke(k.id)} className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all">Revoke</button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-[11px] font-bold text-red-400"><i className="fa-solid fa-triangle-exclamation mr-1"></i>{error}</p>}

      <form onSubmit={generate} className="flex gap-3 pt-6 border-t border-white/5">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="KEY NAME (e.g. CODEX, CLAUDE DESKTOP)"
          className="flex-grow bg-[#0A1320]/50 border border-white/5 rounded-2xl px-6 py-4 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-neon-accent transition-all placeholder:text-zinc-600"
        />
        <button type="submit" disabled={busy} className="shrink-0 px-8 py-4 bg-white text-black font-black rounded-2xl text-[11px] uppercase tracking-widest hover:bg-neon-accent transition-all disabled:opacity-50">
          {busy ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Generate key'}
        </button>
      </form>
    </div>
  );
};

interface SettingsViewProps {
  categories: Category[];
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onAddCategory: (name: string, color: string, icon: string) => void;
  onUpdateCategory: (id: string, name: string, color: string, icon: string) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories: (startIndex: number, endIndex: number) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  categories, 
  currentTheme, 
  onThemeChange, 
  onAddCategory, 
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories
}) => {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(CATEGORY_COLORS[0]);
  const [catIcon, setCatIcon] = useState(CATEGORY_ICONS[0]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleEditClick = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatColor(cat.color);
    setCatIcon(cat.icon);
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setCatName('');
    setCatColor(CATEGORY_COLORS[0]);
    setCatIcon(CATEGORY_ICONS[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    
    if (editingCatId) {
      onUpdateCategory(editingCatId, catName, catColor, catIcon);
    } else {
      onAddCategory(catName, catColor, catIcon);
    }
    
    handleCancelEdit();
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    onReorderCategories(draggedIndex, index);
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tighter">Preferences</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Category Management */}
        <div className="bento-card p-10 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-zinc-500 font-black uppercase tracking-widest text-[10px]">
              <i className="fa-solid fa-folder-tree"></i>
              Manage Segments
            </div>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Drag items to reorder</span>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
            {categories.map((cat, index) => (
              <div 
                key={cat.id} 
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
                className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border transition-all group cursor-grab active:cursor-grabbing ${draggedIndex === index ? 'opacity-30 border-dashed border-neon-accent' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.08]'} ${editingCatId === cat.id ? 'border-neon-accent/50 bg-white/10' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-zinc-600 group-hover:text-neon-accent transition-colors">
                    <i className="fa-solid fa-grip-vertical text-[10px]"></i>
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${cat.color} flex items-center justify-center text-zinc-900 shrink-0`}>
                    <i className={`fa-solid ${cat.icon} text-[10px]`}></i>
                  </div>
                  <span className={`font-bold text-sm tracking-tight ${editingCatId === cat.id ? 'text-neon-accent' : ''}`}>{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEditClick(cat)}
                    className="p-2 text-zinc-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit category"
                  >
                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  {cat.name !== 'Uncategorized' && (
                    <button 
                      onClick={() => onDeleteCategory(cat.id)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete category"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="pt-8 border-t border-white/5 space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                {editingCatId ? 'Edit Segment' : 'Create New Category'}
              </h4>
              {editingCatId && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit}
                  className="text-[10px] text-zinc-600 hover:text-white uppercase font-black tracking-widest"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Category Name"
                className="w-full bg-[#0A1320]/50 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-neon-accent transition-all font-bold"
              />
              <div className="flex flex-wrap gap-3">
                {CATEGORY_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCatColor(color)}
                    className={`w-8 h-8 rounded-full ${color} border-2 ${catColor === color ? 'border-white scale-110' : 'border-transparent'} transition-all`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 pt-2">
                {CATEGORY_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setCatIcon(icon)}
                    className={`p-3 rounded-xl bg-white/5 hover:bg-white/10 ${catIcon === icon ? 'text-neon-accent bg-white/10' : 'text-zinc-500'} transition-all`}
                  >
                    <i className={`fa-solid ${icon}`}></i>
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className={`w-full py-4 font-black rounded-2xl transition-all text-[11px] uppercase tracking-widest ${editingCatId ? 'bg-neon-accent text-black hover:scale-[1.02]' : 'bg-white text-black hover:bg-neon-accent'}`}
              >
                {editingCatId ? 'Update Segment' : 'Add Segment'}
              </button>
            </div>
          </form>
        </div>

        {/* Theme Management */}
        <div className="bento-card p-10 space-y-8">
          <div className="flex items-center gap-3 text-zinc-500 font-black uppercase tracking-widest text-[10px]">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            Visual Interface
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <button 
              onClick={() => onThemeChange('default')}
              className={`p-6 rounded-[2rem] border-2 transition-all text-left flex items-center justify-between group ${currentTheme === 'default' ? 'border-neon-accent bg-white/5' : 'border-white/5 bg-transparent hover:border-white/20'}`}
            >
              <div>
                <h4 className="font-black text-lg mb-1 group-hover:text-neon-accent transition-colors">Bento Dark</h4>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">The Original Aesthetic</p>
              </div>
              <div className="w-4 h-4 rounded-full border-2 border-neon-accent flex items-center justify-center p-0.5">
                {currentTheme === 'default' && <div className="w-full h-full bg-neon-accent rounded-full"></div>}
              </div>
            </button>

            <button 
              onClick={() => onThemeChange('professional')}
              className={`p-6 rounded-[2rem] border-2 transition-all text-left flex items-center justify-between group ${currentTheme === 'professional' ? 'border-blue-500 bg-white/5' : 'border-white/5 bg-transparent hover:border-white/20'}`}
            >
              <div>
                <h4 className="font-black text-lg mb-1 group-hover:text-blue-500 transition-colors">Executive Minimal</h4>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Clean, Sharp, Focused</p>
              </div>
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center p-0.5">
                {currentTheme === 'professional' && <div className="w-full h-full bg-blue-500 rounded-full"></div>}
              </div>
            </button>

            <button 
              onClick={() => onThemeChange('funny')}
              className={`p-6 rounded-[2rem] border-2 transition-all text-left flex items-center justify-between group ${currentTheme === 'funny' ? 'border-pink-500 bg-white/5' : 'border-white/5 bg-transparent hover:border-white/20'}`}
            >
              <div>
                <h4 className="font-black text-lg mb-1 group-hover:text-pink-500 transition-colors">Electric Comic</h4>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Chaos is a Ladder</p>
              </div>
              <div className="w-4 h-4 rounded-full border-2 border-pink-500 flex items-center justify-center p-0.5">
                {currentTheme === 'funny' && <div className="w-full h-full bg-pink-500 rounded-full"></div>}
              </div>
            </button>
          </div>

          <div className="p-8 bg-[#0A1320]/50 rounded-3xl border border-white/5">
             <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">
               <i className="fa-solid fa-circle-info mr-2 text-neon-accent"></i>
               Theme preferences are stored locally and will persist across sessions on this device.
             </p>
          </div>
        </div>
      </div>

      <ApiKeysCard />
    </div>
  );
};

export default SettingsView;
