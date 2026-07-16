
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, Category, ItemStatus } from '../types';
import { spotlight } from './magic';

interface LinkCardProps {
  link: Link;
  category?: Category;
  categories?: Category[];
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onCycleReadStatus?: (id: string) => void;
  onChangeCategory?: (linkId: string, categoryId: string) => void;
  onUpdateLink?: (linkId: string, updates: Partial<Link>) => void;
  /** Re-enqueue the parse pipeline (for items where the AI fetch failed/missed data). */
  onRetry?: (id: string) => void;
}

/** Entry date as "12 Jun 2026". */
const formatDate = (ms: number): string | null => {
  if (!ms || isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const READ_META: Record<'unread' | 'reading' | 'read', { icon: string; label: string }> = {
  unread: { icon: 'fa-regular fa-circle', label: 'Unread' },
  reading: { icon: 'fa-solid fa-circle-half-stroke', label: 'Reading' },
  read: { icon: 'fa-solid fa-circle-check', label: 'Read' },
};

const STATUS_META: Record<ItemStatus, { label: string; className: string; spin?: boolean }> = {
  pending:   { label: 'Queued',     className: 'text-zinc-400 border-zinc-600/40 bg-zinc-600/10', spin: true },
  parsing:   { label: 'Reading',    className: 'text-blue-300 border-blue-500/30 bg-blue-500/10', spin: true },
  enriching: { label: 'AI Analysis', className: 'text-[#A8CF38] border-[#A8CF38]/30 bg-[#A8CF38]/10', spin: true },
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
  onToggleStar,
  onCycleReadStatus,
  onChangeCategory,
  onRetry,
}) => {
  const navigate = useNavigate();
  const domain = new URL(link.url).hostname;
  const isAI = category?.name === 'AI Tools';
  const status = link.status && link.status !== 'ready' ? STATUS_META[link.status] : null;
  const isProcessing = !!status?.spin;
  const readMeta = READ_META[link.readStatus ?? 'unread'];
  const isBookmark = link.kind === 'bookmark';
  const dateLabel = formatDate(link.createdAt);
  const fromMobile = link.savedVia === 'mobile';

  // Top-right type marker: book for readable content, bookmark for a plain link.
  const typeBadge = isBookmark
    ? { icon: 'fa-bookmark', cls: 'text-zinc-300 bg-white/[0.05] border-white/10', label: 'Bookmark' }
    : { icon: 'fa-book-open', cls: 'text-[#A8CF38] bg-[#A8CF38]/10 border-[#A8CF38]/30', label: 'Article' };

  const readAction = link.readStatus === 'reading'
    ? { label: 'Continue reading', icon: 'fa-book-open-reader' }
    : link.readStatus === 'read'
      ? { label: 'Read again', icon: 'fa-rotate-left' }
      : { label: 'Read', icon: 'fa-book-open' };

  // Bookmarks open the source directly (no reader content); content opens the reader.
  const openCard = () => {
    if (isBookmark) { window.open(link.url, '_blank', 'noopener,noreferrer'); return; }
    navigate(`/item/${link.id}`);
  };
  // Inner controls (pin, delete, star, read-status, folder select, Visit site) act without triggering the card.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openCard}
      onKeyDown={(e) => { if (e.key === 'Enter') openCard(); }}
      title={isBookmark ? 'Open source link' : 'Open in reader'}
      className="bento-card spot group relative p-5 transition-all duration-300 hover:border-white/10 flex flex-col h-full shadow-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8CF38]/60"
      onMouseMove={spotlight}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 bg-[#0A1320] shadow-inner group-hover:border-[#A8CF38]/30 transition-colors">
            <img
              src={link.favicon || `https://www.google.com/s2/favicons?sz=64&domain=${link.url}`}
              alt="favicon"
              className="w-7 h-7 object-contain"
              onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${link.title}&background=0D1B2B&color=fff`)}
            />
          </div>
          <div className="flex-1 min-w-0">
            {/* Whole card opens the reader (summaries, TTS); "Visit site" below goes to the source. */}
            <h3 className="text-zinc-100 font-bold text-sm line-clamp-1 group-hover:text-[#A8CF38] transition-colors leading-tight">
              {link.title}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-extrabold block truncate">
              {domain}
              {dateLabel && <span className="normal-case tracking-normal text-zinc-600 font-bold"> · {dateLabel}</span>}
            </span>
          </div>
        </div>
        <div className="relative shrink-0 flex items-center justify-end min-w-[84px] self-start">
          {/* Default: persistent type marker (book = content, bookmark = link) + mobile origin. */}
          <div className="flex items-center gap-1.5 transition-opacity duration-200 group-hover:opacity-0">
            {fromMobile && (
              <span
                aria-label="Saved from your phone"
                title="Saved from your phone (Linkat)"
                className="w-9 h-9 rounded-xl border grid place-items-center text-sky-300 bg-sky-400/10 border-sky-400/30"
              >
                <i className="fa-solid fa-mobile-screen text-xs"></i>
              </span>
            )}
            <span
              aria-label={typeBadge.label}
              title={typeBadge.label}
              className={`w-9 h-9 rounded-xl border grid place-items-center ${typeBadge.cls}`}
            >
              <i className={`fa-solid ${typeBadge.icon} text-xs`}></i>
            </span>
          </div>
          {/* Hover: refresh + pin + delete controls cross-fade in over the badges. */}
          <div className="hover-reveal absolute right-0 top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onRetry && (
              <button
                onClick={(e) => { stop(e); if (!isProcessing) onRetry(link.id); }}
                disabled={isProcessing}
                className={`w-10 h-10 flex items-center justify-center transition-all rounded-full hover:bg-white/5 ${isProcessing ? 'text-zinc-700 cursor-default' : 'text-zinc-600 hover:text-[#A8CF38]'}`}
                title="Re-fetch data (re-runs the AI pipeline for this link)"
                aria-label="Re-fetch data"
              >
                <i className={`fa-solid fa-rotate text-xs ${isProcessing ? 'fa-spin' : ''}`}></i>
              </button>
            )}
            <button
              onClick={(e) => { stop(e); onTogglePin?.(link.id); }}
              className={`w-10 h-10 flex items-center justify-center transition-all rounded-full hover:bg-white/5 ${link.isPinned ? 'text-[#A8CF38]' : 'text-zinc-600 hover:text-white'}`}
              title="Pin Link"
              aria-label="Pin link"
            >
              <i className={`fa-solid fa-thumbtack text-xs ${link.isPinned ? '' : 'opacity-50'}`}></i>
            </button>
            <button
              onClick={(e) => { stop(e); onDelete(link.id); }}
              className="w-10 h-10 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-all rounded-full hover:bg-red-400/10"
              title="Delete Link"
              aria-label="Delete link"
            >
              <i className="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div className={`inline-flex items-center gap-2 self-start px-3 py-1 mb-3 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.className}`}>
          {isProcessing && <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>}
          {status.label}
        </div>
      )}

      <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed mb-3 flex-grow">
        {link.description || (isProcessing ? 'Fetching content and generating AI summary…' : 'No description available for this resource.')}
      </p>

      {link.tags && link.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {link.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] font-bold text-zinc-500 lowercase tracking-wide">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
        <div className="relative group/cat min-w-0 flex-grow mr-4">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAI ? 'bg-[#A8CF38]' : 'bg-zinc-600'}`}></div>
            <select
              value={link.categoryId}
              onClick={stop}
              onChange={(e) => onChangeCategory?.(link.id, e.target.value)}
              className="bg-transparent text-[10px] text-zinc-500 font-bold uppercase tracking-wider focus:outline-none cursor-pointer hover:text-white transition-colors w-full appearance-none"
            >
              <option value="" className="bg-[#0D1B2B] text-white">Unfiled</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#0D1B2B] text-white">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onCycleReadStatus && (
            <button
              onClick={(e) => { stop(e); onCycleReadStatus(link.id); }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-500 hover:text-white transition-all"
              title={`Read status: ${readMeta.label} (click to advance)`}
              aria-label={`Read status: ${readMeta.label}`}
            >
              <i className={`${readMeta.icon} text-xs`}></i>
            </button>
          )}
          {onToggleStar && (
            <button
              onClick={(e) => { stop(e); onToggleStar(link.id); }}
              className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-all ${link.isStarred ? 'text-[#A8CF38]' : 'text-zinc-600 hover:text-white'}`}
              title="Toggle starred"
              aria-label="Toggle starred"
            >
              <i className={`fa-${link.isStarred ? 'solid' : 'regular'} fa-star text-xs`}></i>
            </button>
          )}
          {isBookmark ? (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="ml-1 inline-flex items-center gap-2 bg-white/10 text-white hover:bg-[#A8CF38] hover:text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>Visit site
            </a>
          ) : (
            <button
              onClick={(e) => { stop(e); navigate(`/item/${link.id}`); }}
              className="ml-1 inline-flex items-center gap-2 text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20 hover:brightness-110"
              style={{ background: 'var(--grad)' }}
            >
              <i className={`fa-solid ${readAction.icon} text-[10px]`}></i>{readAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkCard;
