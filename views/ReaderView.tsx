import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { ContentItem } from '../types';
import TtsPlayer from '../components/TtsPlayer';

const FONT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl'] as const;

const ReaderView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSizeIdx, setFontSizeIdx] = useState(1);
  const hasMarkedRead = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // AI translation (Arabic by default) — fetched on demand, cached server-side.
  type Translation = { title: string | null; summary: string | null; key_points: string[]; body: string | null };
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showArabic, setShowArabic] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    hasMarkedRead.current = false;
    setLoading(true);
    setTranslation(null);
    setShowArabic(false);
    setTranslateError(null);
    api.items.fetchOne(id).then(data => {
      if (cancelled) return;
      setItem(data);
      setLoading(false);
      if (data && data.read_status === 'unread') {
        api.items.setReadStatus(id, 'reading').catch(() => {});
        setItem(prev => prev ? { ...prev, read_status: 'reading' } : prev);
      }
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !id) return;
    const onScroll = () => {
      if (hasMarkedRead.current) return;
      const pct = (el.scrollTop + el.clientHeight) / el.scrollHeight;
      if (pct >= 0.9) {
        hasMarkedRead.current = true;
        api.items.setReadStatus(id, 'read').catch(() => {});
        setItem(prev => prev ? { ...prev, read_status: 'read' } : prev);
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [id, item?.content_text]);

  const paragraphs = useMemo(
    () => (item?.content_text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean),
    [item?.content_text]
  );

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-10 h-10 border-4 border-neon-accent/10 border-t-neon-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-24 text-center space-y-4">
        <i className="fa-solid fa-triangle-exclamation text-3xl text-zinc-700"></i>
        <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Item not found</p>
        <button onClick={() => navigate(-1)} className="text-[11px] font-black uppercase tracking-widest text-neon-accent">Go back</button>
      </div>
    );
  }

  let domain = '';
  try { domain = new URL(item.url).hostname; } catch { /* malformed url */ }

  const handleTranslate = async () => {
    // Once fetched, the button just toggles between Arabic and the original.
    if (translation) { setShowArabic(s => !s); return; }
    setTranslating(true);
    setTranslateError(null);
    try {
      const t = await api.translate(item.id, 'ar');
      setTranslation({ title: t.title, summary: t.summary, key_points: t.key_points, body: t.body });
      setShowArabic(true);
    } catch (e: any) {
      setTranslateError(e.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  const arabicParagraphs = (translation?.body || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[11px] font-black uppercase tracking-widest">
          <i className="fa-solid fa-arrow-left"></i> Back
        </button>
        <div className="flex items-center bg-[#0D1B2B] border border-white/[0.04] rounded-full p-1 shadow-xl">
          <button onClick={() => setFontSizeIdx(i => Math.max(0, i - 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-all" title="Smaller text">
            <i className="fa-solid fa-minus text-[10px]"></i>
          </button>
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black text-zinc-400">Aa</span>
          <button onClick={() => setFontSizeIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-all" title="Larger text">
            <i className="fa-solid fa-plus text-[10px]"></i>
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[calc(100vh-220px)] overflow-y-auto no-scrollbar">
        <div className="max-w-[680px] mx-auto space-y-10 pb-24">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span className="px-3 py-1 bg-white/5 rounded-full">{item.source_type}</span>
              {domain && <span>{domain}</span>}
              {item.published_at && <span>{new Date(item.published_at).toLocaleDateString()}</span>}
            </div>
            <h1 className="text-4xl font-black tracking-tighter leading-tight">{item.title || item.url}</h1>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neon-accent hover:underline">
              Open original <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </a>
          </div>

          {/* Article / post / reel hero image */}
          {item.thumbnail_url && (
            <img
              src={item.thumbnail_url}
              alt=""
              className="w-full rounded-3xl border border-white/[0.06] object-cover max-h-[420px] shadow-2xl shadow-black/40"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}

          <TtsPlayer
            itemId={item.id}
            hasSummary={!!item.summary}
            hasFullText={!!item.content_text && item.content_text.trim().length > 0}
          />

          {/* AI translation to Arabic (NVIDIA/Gemini, cached). Toggles once fetched. */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:border-neon-accent/40 transition-all disabled:opacity-50"
            >
              <i className={`fa-solid ${translating ? 'fa-spinner fa-spin' : 'fa-language'} text-neon-accent`}></i>
              {translating ? 'Translating…' : translation ? (showArabic ? 'Show original' : 'اقرأ بالعربية') : 'ترجم للعربية · Translate to Arabic'}
            </button>
            {translateError && <span className="text-[11px] font-bold text-red-400">{translateError}</span>}
          </div>

          {(item.summary || (item.key_points && item.key_points.length > 0)) && (
            <div className="bento-card p-8 space-y-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles text-neon-accent"></i> AI Summary
              </p>
              {item.summary && <p className="text-zinc-300 text-sm leading-relaxed">{item.summary}</p>}
              {item.key_points && item.key_points.length > 0 && (
                <ul className="space-y-2">
                  {item.key_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                      <i className="fa-solid fa-circle-check text-neon-accent text-[10px] mt-1.5 shrink-0"></i>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {showArabic && translation && (
            <div dir="rtl" className="bento-card p-8 space-y-5 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2 justify-end">
                الترجمة العربية <i className="fa-solid fa-language text-neon-accent"></i>
              </p>
              {translation.title && <h2 className="text-xl font-black text-zinc-100 leading-snug">{translation.title}</h2>}
              {translation.summary && <p className="text-zinc-300 text-sm leading-relaxed">{translation.summary}</p>}
              {translation.key_points.length > 0 && (
                <ul className="space-y-2">
                  {translation.key_points.map((point, i) => (
                    <li key={i} className="flex flex-row-reverse items-start gap-3 text-sm text-zinc-400">
                      <i className="fa-solid fa-circle-check text-neon-accent text-[10px] mt-1.5 shrink-0"></i>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
              {arabicParagraphs.length > 0 && (
                <div className={`${FONT_SIZES[fontSizeIdx]} text-zinc-300 leading-relaxed space-y-6 font-medium`}>
                  {arabicParagraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
            </div>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] font-bold text-zinc-500 lowercase tracking-wide">#{tag}</span>
              ))}
            </div>
          )}

          {paragraphs.length > 0 ? (
            <div className={`${FONT_SIZES[fontSizeIdx]} text-zinc-300 leading-relaxed space-y-6 font-medium`}>
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : (
            <p className="text-zinc-600 text-sm italic">
              {item.status === 'ready' || item.status === 'degraded'
                ? 'No full text was extracted for this item.'
                : 'Content is still being processed…'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReaderView;
