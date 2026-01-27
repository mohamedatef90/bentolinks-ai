
import React, { useState } from 'react';
import { analyzeLink } from '../services/geminiService';
import { Category } from '../types';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAdd: (url: string, title: string, description: string, categoryName: string, icon?: string) => void;
}

const AddLinkModal: React.FC<AddLinkModalProps> = ({ isOpen, onClose, categories, onAdd }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || 'Uncategorized');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAIAnalyze = async () => {
    if (!url) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeLink(url, categories.map(c => c.name));
      setTitle(result.suggestedTitle);
      setDescription(result.suggestedDescription);
      setSelectedCategory(result.categoryName);
    } catch (err: any) {
      console.error("AI Analysis failed", err);
      setError(err?.message || "AI analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    onAdd(url, title || url, description, selectedCategory);
    setUrl('');
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#151518] border border-white/10 w-full max-w-xl rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-12 duration-500">
        <div className="p-10 border-b border-white/5 flex justify-between items-start bg-white/[0.01]">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 bg-[#c1ff00] rounded-full animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">System Ready</span>
            </div>
            <h2 className="text-4xl font-black tracking-tighter">New Entry</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/5 rounded-full transition-all">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div className="space-y-3">
            <label className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Resource URL</label>
            <div className="relative group">
              <input
                type="url"
                required
                className="w-full bg-zinc-900/40 border border-white/5 rounded-[1.5rem] px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1ff00]/30 focus:bg-zinc-900 transition-all pr-28 font-bold"
                placeholder="https://cloud.hub.io"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={isAnalyzing || !url}
                className="absolute right-3 top-3 bottom-3 px-5 bg-[#c1ff00] hover:scale-105 active:scale-95 disabled:opacity-20 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 text-black shadow-lg shadow-[#c1ff00]/10"
              >
                {isAnalyzing ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                )}
                Magic
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-xs mt-2 px-1">{error}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-3">
                <label className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Entry Label</label>
                <input
                  type="text"
                  className="w-full bg-zinc-900/40 border border-white/5 rounded-[1.5rem] px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all font-bold"
                  placeholder="Platform Name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
             </div>
             <div className="space-y-3">
                <label className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Archive Segment</label>
                <div className="relative">
                  <select
                    className="w-full bg-zinc-900/40 border border-white/5 rounded-[1.5rem] px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none cursor-pointer font-bold"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none text-[10px]"></i>
                </div>
             </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Context / Observation</label>
            <textarea
              className="w-full bg-zinc-900/40 border border-white/5 rounded-[1.5rem] px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all resize-none h-32 font-medium"
              placeholder="Why is this entry valuable to the hub?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-6 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-5 bg-white/5 border border-white/5 text-zinc-400 font-black rounded-[1.5rem] hover:bg-white/10 transition-all text-[11px] uppercase tracking-[0.2em]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-5 bg-white text-black font-black rounded-[1.5rem] hover:bg-[#c1ff00] transition-all text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-white/5"
            >
              Finalize Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLinkModal;
