import React, { useState, useEffect, useRef } from 'react';
import { NewsItem } from '../types';

interface NewsVerticalFeedProps {
  news: NewsItem[];
  isLoading: boolean;
}

const NewsVerticalFeed = ({ news = [], isLoading }: NewsVerticalFeedProps) => {
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Auto-scroll effect
  useEffect(() => {
    if (!news || news.length === 0 || isPaused) return;

    const container = scrollRef.current;
    if (!container) return;

    // Duplicate news items for infinite scroll
    const scrollHeight = container.scrollHeight / 2;

    const interval = setInterval(() => {
      setScrollPosition((prev) => {
        const newPosition = prev + 1;
        // Reset to 0 when reaching halfway (seamless loop)
        return newPosition >= scrollHeight ? 0 : newPosition;
      });
    }, 30); // Smooth 30ms scroll

    return () => clearInterval(interval);
  }, [news, isPaused]);

  // Apply scroll position
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  if (isLoading) {
    return (
      <div className="w-full h-full bg-[#151518] rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Loading Tech Pulse...
        </p>
      </div>
    );
  }

  if (!news || news.length === 0) {
    return (
      <div className="w-full h-full bg-[#151518] rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center p-8 text-center">
        <i className="fa-solid fa-rss text-2xl text-zinc-700 mb-4"></i>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          No news updates found.
        </p>
      </div>
    );
  }

  // Duplicate news for infinite scroll
  const duplicatedNews = [...news, ...news];

  return (
    <div className="relative w-full h-full bg-[#151518] rounded-[2.5rem] border border-white/5 overflow-hidden group">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-[#151518] via-[#151518] to-transparent p-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Tech Pulse
            </span>
            <span className="text-[9px] text-zinc-600 uppercase">
              • Live Feed
            </span>
          </div>
          
          {/* Pause/Play button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-purple-500/20 hover:border-purple-500/30 text-gray-400 hover:text-purple-400"
            aria-label={isPaused ? 'Resume scrolling' : 'Pause scrolling'}
          >
            <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'} text-[9px]`}></i>
          </button>
        </div>
      </div>

      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="absolute inset-0 overflow-y-scroll pt-20 pb-8 px-6"
        style={{ scrollBehavior: 'auto' }}
      >
        <div className="space-y-4">
          {duplicatedNews.map((item, index) => (
            <a
              key={`${item.id}-${index}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group/card"
            >
              <article className="relative bg-[#1c1c21] border border-white/5 rounded-2xl p-5 transition-all duration-300 hover:bg-[#222227] hover:border-purple-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10">
                {/* Source & Time */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-purple-500 rounded-full"></div>
                    <span className="text-[8px] font-black text-purple-400 uppercase tracking-wider">
                      {item.source}
                    </span>
                  </div>
                  <span className="text-[8px] font-bold text-[#c1ff00] uppercase tracking-wider">
                    {item.timestamp}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xs font-bold text-white leading-tight mb-2 line-clamp-2 group-hover/card:text-purple-300 transition-colors">
                  {item.title}
                </h3>

                {/* Summary */}
                <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-2 mb-3">
                  {item.summary}
                </p>

                {/* Read more indicator */}
                <div className="flex items-center gap-2 text-[9px] font-black text-purple-400 uppercase tracking-widest opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <span>Read Full Story</span>
                  <i className="fa-solid fa-arrow-right text-[8px]"></i>
                </div>

                {/* Gradient accent */}
                <div className="absolute -right-8 -bottom-8 w-20 h-20 bg-purple-500/5 blur-2xl rounded-full pointer-events-none"></div>
              </article>
            </a>
          ))}
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#151518] via-[#151518]/80 to-transparent pointer-events-none z-10"></div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-pause text-xs text-purple-400"></i>
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">
              Paused
            </span>
          </div>
        </div>
      )}

      {/* Scrollbar hide */}
      <style>{`
        .overflow-y-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .overflow-y-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-y-scroll::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.3);
          border-radius: 10px;
        }
        .overflow-y-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.5);
        }
      `}</style>
    </div>
  );
};

export default NewsVerticalFeed;
