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
  
  // Drag & Drop support
  index?: number;
  isDraggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (index: number) => void;
  onDragEnter?: (index: number) => void;
  onDragEnd?: () => void;
  
  // Multi-select support
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  
  // Context menu support
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

const LinkCard: React.FC<LinkCardProps> = ({ 
  link, 
  category, 
  categories = [], 
  onDelete, 
  onTogglePin,
  onChangeCategory,
  onUpdateLink,
  index = 0,
  isDraggable = false,
  isDragging = false,
  onDragStart,
  onDragEnter,
  onDragEnd,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onContextMenu,
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

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(link.id);
    }
  };

  return (
    <article 
      draggable={isDraggable}
      onDragStart={() => isDraggable && onDragStart?.(index)}
      onDragEnter={() => isDraggable && onDragEnter?.(index)}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => onContextMenu?.(e, link.id)}
      onClick={handleCardClick}
      className={`
        group relative 
        bg-[#151518] 
        rounded-[1.5rem] 
        p-6
        transition-all duration-300
        hover:bg-[#1a1a1e]
        hover:-translate-y-0.5
        flex flex-col h-full
        shadow-lg
        
        ${isDraggable ? 'cursor-move' : ''}
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
        ${isSelectionMode ? 'cursor-pointer' : ''}
        ${isSelected ? 'ring-2 ring-[#c1ff00] bg-[#c1ff00]/5' : ''}
        
        /* Gradient border */
        before:absolute before:inset-0 before:-z-10
        before:rounded-[1.5rem] before:p-[1px]
        before:bg-gradient-to-br before:from-zinc-700 before:via-zinc-800 before:to-zinc-900
        before:transition-all before:duration-300
        
        /* Hover glow */
        hover:before:from-[#c1ff00]/20 hover:before:via-zinc-700 hover:before:to-zinc-900
        hover:shadow-neon
      `}
      role="article"
      aria-label={`Link: ${link.title}`}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(link.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 accent-[#c1ff00] cursor-pointer"
            aria-label={`Select ${link.title}`}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Drag handle */}
          {isDraggable && !isSelectionMode && (
            <div className="shrink-0 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fas fa-grip-vertical text-gray-500 text-sm" aria-hidden="true" />
            </div>
          )}
          
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 bg-zinc-900 shadow-inner group-hover:border-[#c1ff00]/30 transition-colors shrink-0">
            <img 
              src={`https://www.google.com/s2/favicons?sz=64&domain=${link.url}`} 
              alt="" 
              className="w-7 h-7 object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${link.title}&background=18181b&color=fff`)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-zinc-100 font-semibold text-lg line-clamp-1 group-hover:text-[#c1ff00] transition-colors leading-tight">
              {link.title}
            </h3>
            <span className="text-xs uppercase tracking-widest text-gray-500 font-extrabold block truncate">
              {domain}
            </span>
          </div>
        </div>
        {!isSelectionMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin?.(link.id); }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-full hover:bg-white/5 ${link.isPinned ? 'text-[#c1ff00]' : 'text-gray-400 hover:text-[#c1ff00]'}`}
              aria-label={link.isPinned ? `Unpin ${link.title}` : `Pin ${link.title}`}
            >
              <i className={`fa-solid fa-thumbtack text-xs`} aria-hidden="true"></i>
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(link.id); }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-red-400/10"
              aria-label={`Delete ${link.title}`}
            >
              <i className="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed mb-4 flex-grow">
        {link.description || 'No detailed description found for this resource.'}
      </p>
      {aiError && (
        <p role="alert" className="text-red-400 text-[10px] mb-2 px-1">{aiError}</p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
        <div className="relative group/cat min-w-0 flex-grow mr-4">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAI ? 'bg-[#c1ff00]' : 'bg-gray-500'}`} aria-hidden="true"></div>
            <select
              value={link.categoryId}
              onChange={(e) => {
                e.stopPropagation();
                onChangeCategory?.(link.id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-xs text-gray-500 font-bold uppercase tracking-wider focus:outline-none cursor-pointer hover:text-white transition-colors w-full appearance-none min-h-[44px] py-2"
              aria-label={`Change category for ${link.title}`}
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
            onClick={(e) => {
              e.stopPropagation();
              handleAIAnalyze();
            }}
            disabled={isGenerating}
            aria-label={isGenerating ? `Analyzing ${link.title} with AI` : `Refresh ${link.title} with AI`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/5 text-gray-400 hover:text-[#c1ff00] hover:bg-white/10 rounded-full transition-all border border-white/5 disabled:opacity-50 shadow-sm"
          >
            {isGenerating ? (
              <i className="fa-solid fa-spinner fa-spin text-[10px]" aria-hidden="true"></i>
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles text-[10px]" aria-hidden="true"></i>
            )}
          </button>
          <a 
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-800/80 text-white hover:bg-[#c1ff00] hover:text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20 min-h-[44px] inline-flex items-center"
            aria-label={`Open ${link.title} in new tab`}
          >
            Visit site
          </a>
        </div>
      </div>
    </article>
  );
};

export default LinkCard;
