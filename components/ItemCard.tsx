import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ContentItem, ItemStatus } from '../types';
import { spotlight } from './magic';

interface ItemCardProps {
  item: ContentItem;
  viewMode: 'grid' | 'list';
  onToggleStar: (id: string) => void;
  onCycleReadStatus: (id: string) => void;
}

const STATUS_META: Record<ItemStatus, { label: string; className: string; spin?: boolean }> = {
  pending:   { label: 'Queued',      className: 'text-zinc-400 border-zinc-600/40 bg-zinc-600/10', spin: true },
  parsing:   { label: 'Reading',     className: 'text-blue-300 border-blue-500/30 bg-blue-500/10', spin: true },
  enriching: { label: 'AI Analysis', className: 'text-[#A8CF38] border-[#A8CF38]/30 bg-[#A8CF38]/10', spin: true },
  ready:     { label: 'Ready',       className: '' },
  degraded:  { label: 'Limited data', className: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  failed:    { label: 'Failed',      className: 'text-red-400 border-red-500/30 bg-red-500/10' },
};

const READ_STATUS_META: Record<ContentItem['read_status'], { icon: string; label: string }> = {
  unread: { icon: 'fa-regular fa-circle', label: 'Unread' },
  reading: { icon: 'fa-solid fa-circle-half-stroke', label: 'Reading' },
  read: { icon: 'fa-solid fa-circle-check', label: 'Read' },
};

/** Publish date (falls back to saved date) as "12 Jun 2026". */
const formatDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const ItemCard: React.FC<ItemCardProps> = ({ item, viewMode, onToggleStar, onCycleReadStatus }) => {
  const navigate = useNavigate();
  let domain = '';
  try { domain = new URL(item.url).hostname; } catch { /* malformed url, ignore */ }
  const status = item.status !== 'ready' ? STATUS_META[item.status] : null;
  const readMeta = READ_STATUS_META[item.read_status];
  const title = item.title || item.url;
  const dateLabel = formatDate(item.published_at) || formatDate(item.created_at);
  const isBookmark = item.item_kind === 'bookmark';
  // A plain website link reads as "bookmark", not its raw source_type ("article").
  const typeLabel = isBookmark ? 'bookmark' : item.source_type;

  // Top-right type marker: book for readable content, bookmark for a plain link.
  const typeBadge = isBookmark
    ? { icon: 'fa-bookmark', cls: 'text-zinc-300 bg-white/[0.05] border-white/10', label: 'Bookmark' }
    : { icon: 'fa-book-open', cls: 'text-[#A8CF38] bg-[#A8CF38]/10 border-[#A8CF38]/30', label: 'Article' };

  // Primary action on content cards: Read / Continue reading / Read again.
  const readAction = item.read_status === 'reading'
    ? { label: 'Continue reading', icon: 'fa-book-open-reader' }
    : item.read_status === 'read'
      ? { label: 'Read again', icon: 'fa-rotate-left' }
      : { label: 'Read', icon: 'fa-book-open' };

  // Bookmarks have no reader content — the card opens the source directly.
  // Content opens the in-app reader (summary, key points, TTS).
  const openCard = () => {
    if (isBookmark) { window.open(item.url, '_blank', 'noopener,noreferrer'); return; }
    navigate(`/item/${item.id}`);
  };
  // Let the inner controls (star, read-status, Visit site) act without triggering the card.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openCard}
      onKeyDown={(e) => { if (e.key === 'Enter') openCard(); }}
      title={isBookmark ? 'Open source link' : 'Open in reader'}
      className={`bento-card spot group relative p-5 transition-all hover:border-white/10 shadow-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8CF38]/60 ${
      viewMode === 'list' ? 'flex items-center gap-5' : 'flex flex-col h-full'
    }`} onMouseMove={spotlight}>
      <div className={viewMode === 'list' ? 'flex items-center gap-4 flex-grow min-w-0' : 'flex items-center justify-between mb-4'}>
        <div className="flex items-center gap-3 min-w-0 flex-grow">
          <div className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 bg-[#0A1320] shadow-inner">
            <img
              src={item.favicon_url || `https://www.google.com/s2/favicons?sz=64&domain=${item.url}`}
              alt=""
              className="w-7 h-7 object-contain"
              onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${title}&background=0D1B2B&color=fff`)}
            />
          </div>
          <div className="min-w-0 flex-grow">
            <h3 className="text-zinc-100 font-bold text-sm line-clamp-1 group-hover:text-[#A8CF38] transition-colors leading-tight">
              {title}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-extrabold block truncate">
              {domain}{viewMode === 'list' && dateLabel ? <span className="normal-case tracking-normal text-zinc-600"> · {dateLabel}</span> : ''}
            </span>
          </div>
        </div>

        <div className="relative shrink-0 flex items-center justify-end min-w-[84px] self-start">
          {/* Default: persistent type marker (book = content, bookmark = link). */}
          {viewMode === 'grid' && (
            <span
              aria-label={typeBadge.label}
              title={typeBadge.label}
              className={`w-9 h-9 rounded-xl border grid place-items-center transition-opacity duration-200 group-hover:opacity-0 ${typeBadge.cls}`}
            >
              <i className={`fa-solid ${typeBadge.icon} text-xs`}></i>
            </span>
          )}
          {/* Hover: read-status + star controls cross-fade in over the badge. */}
          <div className={`hover-reveal flex items-center gap-1 ${viewMode === 'grid' ? 'absolute right-0 top-0 opacity-0 group-hover:opacity-100' : ''} transition-opacity`}>
            <button
              onClick={(e) => { stop(e); onCycleReadStatus(item.id); }}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-500 hover:text-white transition-all"
              title={`Read status: ${readMeta.label} (click to advance)`}
              aria-label={`Read status: ${readMeta.label}`}
            >
              <i className={`${readMeta.icon} text-xs`}></i>
            </button>
            <button
              onClick={(e) => { stop(e); onToggleStar(item.id); }}
              className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-all ${item.is_starred ? 'text-[#A8CF38]' : 'text-zinc-600 hover:text-white'}`}
              title="Toggle starred"
              aria-label="Toggle starred"
            >
              <i className={`fa-solid fa-star text-xs ${item.is_starred ? '' : 'opacity-50'}`}></i>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' && (
        <>
          {status && (
            <div className={`inline-flex items-center gap-2 self-start px-3 py-1 mb-3 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.className}`}>
              {status.spin && <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>}
              {status.label}
            </div>
          )}
          <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed mb-3 flex-grow">
            {item.summary || item.description || (status?.spin ? 'Fetching content and generating AI summary…' : 'No description available.')}
          </p>
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {item.tags.slice(0, 4).map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] font-bold text-zinc-500 lowercase tracking-wide">{tag}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-2 min-w-0">
              <span className="truncate">{typeLabel}</span>
              {dateLabel && <><span className="text-zinc-700">·</span><span className="text-zinc-500 normal-case tracking-normal font-bold shrink-0">{dateLabel}</span></>}
            </span>
            {isBookmark ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={stop}
                className="shrink-0 ml-2 inline-flex items-center gap-2 bg-white/10 text-white hover:bg-[#A8CF38] hover:text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20">
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>Visit site
              </a>
            ) : (
              <button onClick={(e) => { stop(e); navigate(`/item/${item.id}`); }}
                className="shrink-0 ml-2 inline-flex items-center gap-2 text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20 hover:brightness-110"
                style={{ background: 'var(--grad)' }}>
                <i className={`fa-solid ${readAction.icon} text-[10px]`}></i>{readAction.label}
              </button>
            )}
          </div>
        </>
      )}

      {viewMode === 'list' && (
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <span className={`w-8 h-8 rounded-lg border grid place-items-center ${typeBadge.cls}`} title={typeBadge.label} aria-label={typeBadge.label}>
            <i className={`fa-solid ${typeBadge.icon} text-[11px]`}></i>
          </span>
          {status ? (
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.className}`}>
              {status.spin && <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>}
              {status.label}
            </div>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{typeLabel}</span>
          )}
          {isBookmark ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={stop}
              className="inline-flex items-center gap-2 bg-white/10 text-white hover:bg-[#A8CF38] hover:text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20">
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>Visit
            </a>
          ) : (
            <button onClick={(e) => { stop(e); navigate(`/item/${item.id}`); }}
              className="inline-flex items-center gap-2 text-black transition-all px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg shadow-black/20 hover:brightness-110"
              style={{ background: 'var(--grad)' }}>
              <i className={`fa-solid ${readAction.icon} text-[10px]`}></i>{readAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ItemCard;
