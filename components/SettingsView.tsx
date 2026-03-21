
import React, { useState } from 'react';
import { Category, AppTheme } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';

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
            <div className="flex items-center gap-4 text-zinc-500 font-black uppercase tracking-widest text-[10px]">
              <i className="fa-solid fa-folder-tree"></i>
              Manage Segments
            </div>
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Drag items to reorder</span>
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
                  <div className="text-gray-400 group-hover:text-gray-300 transition-colors">
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
                    className="p-2 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit category"
                  >
                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  {cat.name !== 'Uncategorized' && (
                    <button 
                      onClick={() => onDeleteCategory(cat.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
                className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-neon-accent transition-all font-bold"
              />
              <div className="flex flex-wrap gap-4">
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
                    className={`p-4 rounded-xl bg-white/5 hover:bg-white/10 ${catIcon === icon ? 'text-neon-accent bg-white/10' : 'text-zinc-500'} transition-all`}
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
          <div className="flex items-center gap-4 text-zinc-500 font-black uppercase tracking-widest text-[10px]">
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

          <div className="p-8 bg-zinc-900/50 rounded-3xl border border-white/5">
             <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">
               <i className="fa-solid fa-circle-info mr-2 text-neon-accent"></i>
               Theme preferences are stored locally and will persist across sessions on this device.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
