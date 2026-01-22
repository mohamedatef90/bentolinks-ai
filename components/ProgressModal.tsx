
import React from 'react';

interface ProgressModalProps {
  current: number;
  total: number;
  isComplete: boolean;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ current, total, isComplete }) => {
  if (total === 0 || isComplete) return null;

  const percentage = Math.round((current / total) * 100);
  // Estimate 1.5s per link
  const secondsRemaining = Math.max(0, (total - current) * 1.5);
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = Math.floor(secondsRemaining % 60);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
      <div className="w-full max-w-md space-y-12 text-center">
        <div className="relative mx-auto w-32 h-32">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle
              className="text-white/5"
              strokeWidth="4"
              stroke="currentColor"
              fill="transparent"
              r="45"
              cx="50"
              cy="50"
            />
            <circle
              className="text-[#c1ff00] transition-all duration-500 ease-out"
              strokeWidth="4"
              strokeDasharray={282.7}
              strokeDashoffset={282.7 - (282.7 * percentage) / 100}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="45"
              cx="50"
              cy="50"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black tabular-nums">{percentage}%</span>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-black tracking-tighter">Analyzing Resources</h2>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">
            Processed {current} of {total} links
          </p>
        </div>

        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl flex items-center justify-center gap-4">
          <div className="text-left">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Estimated Remaining</p>
            <p className="text-xl font-black text-[#c1ff00] tabular-nums">
              {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
            </p>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <i className="fa-solid fa-wand-magic-sparkles text-xl text-[#c1ff00] animate-pulse"></i>
        </div>

        <p className="text-zinc-600 text-[10px] font-medium italic">
          AI is determining the best categories for your vault. Please stay on this tab.
        </p>
      </div>
    </div>
  );
};

export default ProgressModal;
