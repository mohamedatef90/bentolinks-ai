
import React from 'react';
import { Link, Category, ItemStatus } from '../types';

interface LinkCardProps {
  link: Link;
  category?: Category;
  categories?: Category[];
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onChangeCategory?: (linkId: string, categoryId: string) => void;
  onUpdateLink?: (linkId: string, updates: Partial<Link>) => void;
}

const STATUS_META: Record<ItemStatus, { label: string; className: string; spin?: boolean }> = {
  pending:   { label: 'Queued',     className: 'text-zinc-400 border-zinc-600/40 bg-zinc-600/10', spin: true },
  parsing:   { label: 'Reading',    className: 'text-blue-300 border-blue-500/30 bg-blue-500/10', spin: true },
  enriching: { label: 'AI Analysis', className: 'text-[#c1ff00] border-[#c1ff00]/30 bg-[#c1ff00]/10', spin: true },
  ready:     { label: 'Ready',      className: '' },
  degraded:  { label: 'Limited data', className: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  failed:    { label: 'Failed',     className: 'text-red-400 border-red-500/30 bg-red-500/10' },
};

const LinkCard: React.FC<LinkCardProps> = ({
  link,
  category,
  categories = [],
  onDelete,
  onTogglePin,
  onChangeCategory,
}) => {
  const domain = new URL(link.url).hostname;
  const isAI = category?.name === 'AI Tools';
  const status = link.status && link.status !== 'ready' ? STATUS_META[link.status] : null;
  const isProcessing = !!status?.spin;

  return (
    <div className="group relative bg-[#151518] border border-white/[0.04] rounded-[1.5rem] p-5 transition-all duration-300 hover:bg-[#1a1a1e] hover:border-white/10 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 bg-zinc-900 shadow-inner group-hover:border-[#c1ff00]/30 transition-colors">
            <img
              src={link.favicon || `https://www.google.com/s2/favicons?sz=64&domain=${link.url}`}
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

      {status && (
        <div className={`inline-flex items-center gap-2 self-start px-3 py-1 mb-3 rounded-full border text-[9px] font-black uppercase tracking-widest ${status.className}`}>
          {isProcessing && <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>}
          {status.label}
        </div>
      )}

      <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed mb-3 flex-grow">
        {link.description || (isProcessing ? 'Fetching content and generating AI summary…' : 'No description available for this resource.')}
      </p>

      {link.tags && link.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {link.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-[9px] font-bold text-zinc-500 lowercase tracking-wide">
              {tag}
            </span>
          ))}
        </div>
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
              <option value="" className="bg-[#151518] text-white">Unfiled</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#151518] text-white">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
