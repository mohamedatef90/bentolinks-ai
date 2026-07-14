import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { RssSubscription, FeedCandidate } from '../types';

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const FeedsView: React.FC = () => {
  const [subs, setSubs] = useState<RssSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<FeedCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setSubs(await api.feeds.list());
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const subscribe = async (candidate: FeedCandidate) => {
    // Candidates scraped from <link> tags haven't been fetched yet — validate first.
    let validated = candidate;
    if (!candidate.validated) {
      const found = await api.feeds.discover(candidate.feed_url);
      const ok = found.find(c => c.validated);
      if (!ok) throw new Error('That link is not a valid RSS/Atom feed.');
      validated = { ...ok, title: ok.title ?? candidate.title };
    }
    const sub = await api.feeds.subscribe(validated);
    setSubs(prev => [sub, ...prev]);
    setInput('');
    setCandidates([]);
    // First fetch in the background; refresh the row when it lands.
    api.feeds.syncNow(sub.id).then(refresh).catch(() => {});
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setCandidates([]);
    try {
      const found = await api.feeds.discover(input.trim());
      if (found.length === 0) {
        setError('No RSS/Atom feed found at this URL.');
      } else if (found.length === 1) {
        await subscribe(found[0]);
      } else {
        setCandidates(found);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePickCandidate = async (candidate: FeedCandidate) => {
    setBusy(true);
    setError(null);
    try {
      await subscribe(candidate);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async (id: string) => {
    setSyncingId(id);
    try {
      await api.feeds.syncNow(id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncingId(null);
      refresh();
    }
  };

  const handleToggleActive = async (sub: RssSubscription) => {
    const next = !sub.is_active;
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, is_active: next, ...(next ? { error_count: 0, last_error: null } : {}) } : s));
    try {
      await api.feeds.setActive(sub.id, next);
    } catch (e: any) {
      setError(e.message);
      refresh();
    }
  };

  const handleUnsubscribe = async (id: string) => {
    setConfirmDeleteId(null);
    setSubs(prev => prev.filter(s => s.id !== id));
    try {
      await api.feeds.unsubscribe(id);
    } catch (e: any) {
      setError(e.message);
      refresh();
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-10 h-10 border-4 border-neon-accent/10 border-t-neon-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
            <div className="w-1.5 h-1.5 bg-neon-accent rounded-full"></div>
            Auto-ingestion · polled every 30 min
          </div>
          <h1 className="text-4xl font-black tracking-tighter leading-none">RSS Feeds</h1>
        </div>
        <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          {subs.length} {subs.length === 1 ? 'Subscription' : 'Subscriptions'}
        </span>
      </div>

      {/* Add feed */}
      <div className="bento-card p-8 space-y-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          <i className="fa-solid fa-rss text-neon-accent"></i> Add a feed
        </p>
        <form onSubmit={handleAdd} className="flex gap-3">
          <div className="relative flex-grow">
            <i className="fa-solid fa-link absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]"></i>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="FEED OR SITE URL — WE'LL FIND THE FEED..."
              className="w-full bg-white/5 border border-white/5 rounded-full py-3.5 pl-12 pr-5 focus:outline-none focus:ring-1 focus:ring-neon-accent transition-all text-[10px] font-bold uppercase tracking-widest placeholder:text-zinc-600"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="bg-white text-black px-8 py-3.5 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-neon-accent transition-all disabled:opacity-40 disabled:hover:bg-white shrink-0"
          >
            {busy ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Subscribe'}
          </button>
        </form>

        {error && (
          <p className="text-[11px] font-bold text-red-400 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> {error}
          </p>
        )}

        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Feeds found on this site — pick one:</p>
            {candidates.map(c => (
              <button
                key={c.feed_url}
                onClick={() => handlePickCandidate(c)}
                disabled={busy}
                className="w-full flex items-center justify-between gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:border-neon-accent/40 hover:bg-white/[0.04] transition-all text-left disabled:opacity-40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-300 truncate">{c.title || 'Untitled feed'}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{c.feed_url}</p>
                </div>
                <i className="fa-solid fa-plus text-neon-accent text-xs shrink-0"></i>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Subscriptions */}
      {subs.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-[#0D1B2B] border border-white/[0.06] flex items-center justify-center">
            <i className="fa-solid fa-rss text-2xl text-neon-accent"></i>
          </div>
          <div className="space-y-2">
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">No subscriptions yet</p>
            <p className="text-zinc-700 text-[10px] font-bold max-w-md">
              Paste a feed URL or a site URL above. New posts are pulled every 30 minutes and enriched by the AI pipeline.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(sub => {
            const domain = (() => { try { return new URL(sub.site_url || sub.feed_url).hostname.replace(/^www\./, ''); } catch { return sub.feed_url; } })();
            const deactivated = !sub.is_active && sub.error_count >= 10;
            return (
              <div key={sub.id} className={`bento-card p-5 flex items-center gap-5 ${!sub.is_active ? 'opacity-60' : ''}`}>
                <div className="w-11 h-11 rounded-xl bg-[#0A1320] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {sub.favicon_url
                    ? <img src={sub.favicon_url} alt="" className="w-6 h-6 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <i className="fa-solid fa-rss text-zinc-600 text-sm"></i>}
                </div>

                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-zinc-200 truncate">{sub.title || domain}</p>
                    {!sub.is_active && (
                      <span className="px-2.5 py-0.5 bg-[#16283F] border border-white/10 rounded-full text-[8px] font-black uppercase tracking-widest text-zinc-500 shrink-0">
                        {deactivated ? 'Auto-disabled' : 'Paused'}
                      </span>
                    )}
                    {sub.is_active && sub.error_count > 0 && (
                      <span
                        className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-[8px] font-black uppercase tracking-widest text-amber-400 shrink-0"
                        title={sub.last_error || undefined}
                      >
                        {sub.error_count} {sub.error_count === 1 ? 'failure' : 'failures'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 truncate font-bold">
                    {domain} · fetched {timeAgo(sub.last_fetched_at)}
                    {sub.last_error && !sub.is_active ? ` · ${sub.last_error.slice(0, 80)}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSyncNow(sub.id)}
                    disabled={syncingId === sub.id || !sub.is_active}
                    className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-neon-accent hover:border-neon-accent/40 transition-all disabled:opacity-30 flex items-center justify-center"
                    title="Sync now"
                  >
                    <i className={`fa-solid fa-rotate text-[11px] ${syncingId === sub.id ? 'fa-spin' : ''}`}></i>
                  </button>
                  <button
                    onClick={() => handleToggleActive(sub)}
                    className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/30 transition-all flex items-center justify-center"
                    title={sub.is_active ? 'Pause polling' : 'Resume polling'}
                  >
                    <i className={`fa-solid ${sub.is_active ? 'fa-pause' : 'fa-play'} text-[11px]`}></i>
                  </button>
                  {confirmDeleteId === sub.id ? (
                    <button
                      onClick={() => handleUnsubscribe(sub.id)}
                      onBlur={() => setConfirmDeleteId(null)}
                      autoFocus
                      className="h-9 px-4 rounded-full bg-red-500/90 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(sub.id)}
                      className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                      title="Unsubscribe (saved items stay in the vault)"
                    >
                      <i className="fa-solid fa-trash-can text-[11px]"></i>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeedsView;
