import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

type TtsMode = 'summary' | 'full';

interface TtsPlayerProps {
  itemId: string;
  hasSummary: boolean;
  hasFullText: boolean;
}

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

const posKey = (itemId: string, mode: TtsMode) => `refvault-tts-pos:${itemId}:${mode}`;

function fmt(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** AI audio player: generates via tts-generate on demand (cached server-side),
 * then plays through a plain HTMLAudioElement with seek + speed control.
 * Playback position is persisted per item+mode in localStorage. */
const TtsPlayer: React.FC<TtsPlayerProps> = ({ itemId, hasSummary, hasFullText }) => {
  const [mode, setMode] = useState<TtsMode>(hasSummary ? 'summary' : 'full');
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSaveRef = useRef(0);

  // Mode switch resets the loaded audio (each mode is a separate file).
  useEffect(() => {
    setUrl(null);
    setError(null);
    setPlaying(false);
    setPosition(0);
    setDuration(0);
  }, [mode, itemId]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const savePosition = (t: number) => {
    try { localStorage.setItem(posKey(itemId, mode), String(t)); } catch { /* storage full/blocked */ }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.tts.generate(itemId, mode);
      setUrl(result.url);

      const audio = new Audio(result.url);
      audioRef.current?.pause();
      audioRef.current = audio;
      audio.playbackRate = SPEEDS[speedIdx];

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        const saved = Number(localStorage.getItem(posKey(itemId, mode)) ?? 0);
        if (saved > 2 && saved < audio.duration - 2) {
          audio.currentTime = saved;
          setPosition(saved);
        }
      };
      audio.ontimeupdate = () => {
        setPosition(audio.currentTime);
        if (Date.now() - lastSaveRef.current > 3000) {
          lastSaveRef.current = Date.now();
          savePosition(audio.currentTime);
        }
      };
      audio.onplay = () => setPlaying(true);
      audio.onpause = () => {
        setPlaying(false);
        savePosition(audio.currentTime);
      };
      audio.onended = () => {
        setPlaying(false);
        savePosition(0);
      };
      audio.onerror = () => setError('Audio playback failed — try regenerating.');

      await audio.play();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => setError('Playback blocked by the browser.'));
    else audio.pause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setPosition(t);
    if (audioRef.current) audioRef.current.currentTime = t;
    savePosition(t);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  if (!hasSummary && !hasFullText) return null;

  return (
    <div className="bento-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          <i className="fa-solid fa-headphones text-neon-accent"></i> Listen
        </p>
        {hasSummary && hasFullText && (
          <div className="flex items-center bg-[#151518] border border-white/[0.04] rounded-full p-1">
            {(['summary', 'full'] as TtsMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-neon-accent text-black' : 'text-zinc-500 hover:text-white'}`}
              >
                {m === 'summary' ? 'Summary' : 'Full text'}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] font-bold text-red-400 flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation"></i> {error}
        </p>
      )}

      {!url ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:border-neon-accent/40 hover:bg-white/[0.05] transition-all text-[10px] font-black uppercase tracking-widest text-zinc-300 disabled:opacity-50"
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-neon-accent"></i>
              Generating audio{mode === 'full' ? ' (long text — up to 2 min)' : ''}…
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-neon-accent"></i>
              Play {mode === 'summary' ? 'AI summary' : 'full text'}
            </>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-neon-accent text-black flex items-center justify-center hover:scale-105 transition-transform shrink-0"
            title={playing ? 'Pause' : 'Play'}
          >
            <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'} text-sm ${playing ? '' : 'ml-0.5'}`}></i>
          </button>

          <div className="flex-grow space-y-1.5">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(position, duration || 0)}
              onChange={handleSeek}
              className="w-full h-1.5 accent-[#c1ff00] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-black text-zinc-600 uppercase tracking-widest">
              <span>{fmt(position)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          <button
            onClick={cycleSpeed}
            className="h-9 px-4 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-zinc-300 hover:border-neon-accent/40 transition-all shrink-0"
            title="Playback speed"
          >
            {SPEEDS[speedIdx]}x
          </button>
        </div>
      )}
    </div>
  );
};

export default TtsPlayer;
