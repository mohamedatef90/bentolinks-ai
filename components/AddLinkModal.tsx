
import React, { useState } from 'react';
import { analyzeLink } from '../services/geminiService';
import { validateUrl } from '../services/validation';
import { Category } from '../types';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAdd: (url: string, title: string, description: string, categoryName: string, icon?: string) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const AddLinkModal: React.FC<AddLinkModalProps> = ({ isOpen, onClose, categories, onAdd, showToast }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || 'Uncategorized');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAIAnalyze = async () => {
    if (!url) {
      setUrlError('Please enter a URL first');
      showToast?.('Please enter a URL first', 'warning');
      return;
    }
    
    if (!validateUrl(url)) {
      setUrlError('Please enter a valid URL (http:// or https://)');
      showToast?.('Please enter a valid URL (http:// or https://)', 'error');
      return;
    }

    setUrlError(null);
    setIsAnalyzing(true);
    try {
      const result = await analyzeLink(url, categories.map(c => c.name));
      setTitle(result.suggestedTitle);
      setDescription(result.suggestedDescription);
      setSelectedCategory(result.categoryName);
      showToast?.('AI analysis completed successfully', 'success');
    } catch (err: any) {
      console.error("AI Analysis failed", err);
      const errorMsg = err?.message || "AI analysis failed. Please try again.";
      setUrlError(errorMsg);
      showToast?.(errorMsg, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      setUrlError('URL is required');
      showToast?.('URL is required', 'error');
      return;
    }
    
    if (!validateUrl(url)) {
      setUrlError('Please enter a valid URL (http:// or https://)');
      showToast?.('Please enter a valid URL (http:// or https://)', 'error');
      return;
    }

    setUrlError(null);
    onAdd(url, title || url, description, selectedCategory);
    setUrl('');
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal with slide-in animation */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div 
          className="
            bg-[#151518] 
            rounded-[3rem] 
            w-full max-w-xl
            border border-zinc-800
            shadow-2xl
            transform transition-all duration-300
            scale-100 opacity-100
            overflow-hidden
          "
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-10 border-b border-white/5 flex justify-between items-start bg-white/[0.01]">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 bg-[#c1ff00] rounded-full animate-pulse" aria-hidden="true"></div>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">System Ready</span>
            </div>
            <h2 id="modal-title" className="text-xl font-bold tracking-tighter">New Entry</h2>
          </div>
          <button 
            onClick={onClose} 
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark text-xl" aria-hidden="true"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div className="space-y-3">
            <label htmlFor="url-input" className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Resource URL</label>
            <div className="relative group">
              <input
                id="url-input"
                type="url"
                required
                className="w-full bg-zinc-900/40 border border-white/5 rounded-[1.5rem] px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1ff00]/30 focus:bg-zinc-900 transition-all pr-28 font-bold"
                placeholder="https://cloud.hub.io"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setUrlError(null);
                }}
                aria-required="true"
                aria-invalid={urlError ? "true" : "false"}
                aria-describedby={urlError ? "url-error" : undefined}
              />
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={isAnalyzing || !url}
                className="absolute right-4 top-4 bottom-4 px-6 bg-[#c1ff00] hover:scale-105 active:scale-95 disabled:opacity-20 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 text-black shadow-lg shadow-[#c1ff00]/10 min-h-[44px]"
                aria-label={isAnalyzing ? "Analyzing link with AI" : "Analyze link with AI"}
              >
                {isAnalyzing ? (
                  <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                ) : (
                  <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                )}
                Magic
              </button>
            </div>
            {urlError && (
              <p id="url-error" role="alert" className="text-red-400 text-xs mt-2 px-1">{urlError}</p>
            )}
          </div>
          
          {isAnalyzing && (
            <div role="status" aria-live="polite" className="flex items-center gap-4 text-[#c1ff00] text-sm">
              <span className="sr-only">Analyzing link with AI...</span>
              <div className="w-5 h-5 border-2 border-[#c1ff00]/20 border-t-[#c1ff00] rounded-full animate-spin" aria-hidden="true"></div>
              <p aria-hidden="true">Analyzing with AI...</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-3">
                <label htmlFor="title-input" className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Entry Label</label>
                <input
                  id="title-input"
                  type="text"
                  className="w-full bg-zinc-900/40 border border-white/5 rounded-[1.5rem] px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all font-bold min-h-[44px]"
                  placeholder="Platform Name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
             </div>
             <div className="space-y-3">
                <label htmlFor="category-select" className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Archive Segment</label>
                <div className="relative">
                  <select
                    id="category-select"
                    className="w-full bg-zinc-900/40 border border-white/5 rounded-[1.5rem] px-6 py-5 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none cursor-pointer font-bold min-h-[44px]"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Select category"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none text-[10px]" aria-hidden="true"></i>
                </div>
             </div>
          </div>

          <div className="space-y-3">
            <label htmlFor="description-input" className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-600 px-1">Context / Observation</label>
            <textarea
              id="description-input"
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
              className="flex-1 min-h-[44px] py-5 bg-white/5 border border-white/5 text-zinc-400 font-black rounded-[1.5rem] hover:bg-white/10 transition-all text-[11px] uppercase tracking-[0.2em]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] min-h-[44px] py-5 bg-white text-black font-black rounded-[1.5rem] hover:bg-[#c1ff00] transition-all text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-white/5"
            >
              Finalize Entry
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
};

export default AddLinkModal;
