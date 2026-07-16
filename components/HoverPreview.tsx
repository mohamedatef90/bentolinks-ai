import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HoverPreviewProps {
  title: string;
  summary?: string | null;
  /** Extra context line under the summary (e.g. domain · date). */
  meta?: string | null;
}

interface Pos {
  left: number;
  width: number;
  /** CSS top (below the card) or bottom offset (above the card). */
  top?: number;
  bottom?: number;
}

/**
 * Floating preview panel on card hover: full (unclamped) title + AI summary.
 * Rendered through a portal with fixed positioning because .bento-card clips
 * overflow (glass/spotlight effects) — an absolutely-positioned child could
 * never escape the card. Mount it anywhere inside the card; it attaches
 * mouseenter/mouseleave to the parent card element. pointer-events: none so it
 * never steals clicks; touch devices don't hover, so it never shows there.
 */
const HoverPreview: React.FC<HoverPreviewProps> = ({ title, summary, meta }) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    if (!summary) return;
    const card = anchorRef.current?.parentElement;
    if (!card) return;

    const show = () => {
      timer.current = window.setTimeout(() => {
        const r = card.getBoundingClientRect();
        const fitsAbove = r.top > 190;
        setPos({
          left: r.left + 8,
          width: r.width - 16,
          ...(fitsAbove
            ? { bottom: window.innerHeight - r.top + 10 }
            : { top: r.bottom + 10 }),
        });
      }, 350);
    };
    const hide = () => {
      if (timer.current) window.clearTimeout(timer.current);
      setPos(null);
    };

    card.addEventListener('mouseenter', show);
    card.addEventListener('mouseleave', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      card.removeEventListener('mouseenter', show);
      card.removeEventListener('mouseleave', hide);
      window.removeEventListener('scroll', hide, true);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [summary]);

  if (!summary) return null;
  return (
    <span ref={anchorRef} className="hidden" aria-hidden="true">
      {pos && createPortal(
        <div
          style={{ position: 'fixed', zIndex: 90, pointerEvents: 'none', ...pos }}
          className="animate-in fade-in slide-in-from-bottom-1 duration-200"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0D1B2B]/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/60">
            <p className="text-sm font-bold text-zinc-100 leading-snug mb-1.5">{title}</p>
            <p className="text-xs text-zinc-400 leading-relaxed max-h-32 overflow-hidden">{summary}</p>
            {meta && <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2">{meta}</p>}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
};

export default HoverPreview;
