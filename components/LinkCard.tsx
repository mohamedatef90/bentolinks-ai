
import React, { useState } from 'react';
import { Link, Category } from '../types';
import { analyzeLink } from '../services/geminiService';

interface LinkCardProps {
  link: Link;
  category?: Category;
  categories?: Category[];
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onChangeCategory?: (linkId: string, categoryId: string) => void;
  onUpdateLink?: (linkId: string, updates: Partial<Link>) => void;
}

const LinkCard: React.FC<LinkCardProps> = ({ 
  link, 
  category, 
  categories = [], 
  onDelete, 
  onTogglePin,
  onChangeCategory,
  onUpdateLink
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const domain = new URL(link.url).hostname;
  const isAI = category?.name === 'AI Tools';

  const handleAIAnalyze = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setAiError(null);
    try {
      const result = await analyzeLink(link.url, categories.map(c => c.name));
      if (onUpdateLink) {
        onUpdateLink(link.id, {
          title: result.suggestedTitle || link.title,
          description: result.suggestedDescription || link.description
        });
      }
    } catch (err: any) {
      console.error("AI Refresh failed:", err);
      setAiError(err?.message || "AI refresh failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="group relative bg-[#151518] border border-white/[0.04] rounded-[1.5rem] p-5 transition-all duration-300 hover:bg-[#1a1a1e] hover:border-white/10 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 bg-zinc-900 shadow-inner group-hover:border-[#c1ff00]/30 transition-colors">
            <img 
              src={`https://www.google.com/s2/favicons?sz=64&domain=${link.url}`} 
              alt="favicon" 
              className="w-7 h-7 object-contain"
              onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${link.title}&background=18181b&color=fff`)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-zinc-100 font-bold text-sm line-clamp-1 group-hover:text-[#c1ff00] transition-colors leading-tight">
              {link.title}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-extrabold block truncate">
              {domain}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={(e) => { e.preventDefault(); onTogglePin?.(link.id); }}
            className={`p-2 transition-all rounded-full hover:bg-white/5 ${link.isPinned ? 'text-[#c1ff00]' : 'text-zinc-600 hover:text-white'}`}
            title="Pin Link"
          >
            <i className={`fa-solid fa-thumbtack text-xs ${link.isPinned ? '' : 'opacity-50'}`}></i>
          </button>
          <button 
            onClick={(e) => { e.preventDefault(); onDelete(link.id); }}
            className="p-2 text-zinc-600 hover:text-red-400 transition-all rounded-full hover:bg-red-400/10"
            title="Delete Link"
          >
            <i className="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>

      <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed mb-4 flex-grow">
        {link.description || 'No detailed description found for this resource.'}
      </p>
      {aiError && (
        <p className="text-red-400 text-[10px] mb-2 px-1">{aiError}</p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
        <div className="relative group/cat min-w-0 flex-grow mr-4">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAI ? 'bg-[#c1ff00]' : 'bg-zinc-600'}`}></div>
            <select
              value={link.categoryId}
              onChange={(e) => onChangeCategory?.(link.id, e.target.value)}
              className="bg-transparent text-[10px] text-zinc-500 font-bold uppercase tracking-wider focus:outline-none cursor-pointer hover:text-white transition-colors w-full appearance-none"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#151518] text-white">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAIAnalyze}
            disabled={isGenerating}
            title="AI Refresh (Title & Description)"
            className="w-8 h-8 flex items-center justify-center bg-white/5 text-zinc-400 hover:text-[#c1ff00] hover:bg-white/10 rounded-full transition-all border border-white/5 disabled:opacity-50 shadow-sm"
          >
            {isGenerating ? (
              <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
            )}
          </button>
          <a 
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-zinc-800/80 text-white hover:bg-[#c1ff00] hover:text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20"
          >
            Visit site
          </a>
        </div>
      </div>
    </div>
  );
};

export default LinkCard;
