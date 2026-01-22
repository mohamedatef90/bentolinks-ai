
import React, { useState, useEffect } from 'react';
import { NewsItem } from '../types';

interface NewsCarouselProps {
  news: NewsItem[];
  isLoading: boolean;
}

// Fixed: Explicitly typed props and provided a default value for news to prevent 'unknown' type errors
const NewsCarousel = ({ news = [], isLoading }: NewsCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextSlide = () => {
    // Added safety check for news array
    if (news && news.length > 0) {
      setActiveIndex((prev) => (prev + 1) % news.length);
    }
  };

  const prevSlide = () => {
    // Added safety check for news array
    if (news && news.length > 0) {
      setActiveIndex((prev) => (prev - 1 + news.length) % news.length);
    }
  };

  useEffect(() => {
    // Added safety check for news array
    if (news && news.length > 0) {
      const interval = setInterval(nextSlide, 8000);
      return () => clearInterval(interval);
    }
  }, [news?.length]);

  if (isLoading) {
    return (
      <div className="w-full h-full bg-[#151518] rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-neon-accent/20 border-t-neon-accent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Syncing Tech Pulse...</p>
      </div>
    );
  }

  // Added safety check for news existence and length
  if (!news || news.length === 0) {
    return (
      <div className="w-full h-full bg-[#151518] rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center p-8 text-center">
        <i className="fa-solid fa-rss text-2xl text-zinc-700 mb-4"></i>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">No news updates found.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center perspective-1000">
      <div className="absolute top-0 left-0 w-full p-8 z-20 flex justify-between items-center">
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Tech Brief</span>
         </div>
         <div className="flex gap-2">
            <button onClick={prevSlide} className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <i className="fa-solid fa-chevron-left text-[8px]"></i>
            </button>
            <button onClick={nextSlide} className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <i className="fa-solid fa-chevron-right text-[8px]"></i>
            </button>
         </div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center py-16 px-6">
        {news.map((item, index) => {
          // Calculate relative position for the stacked effect
          let offset = index - activeIndex;
          if (offset < -1) offset = news.length + offset;
          if (offset > news.length - 2) offset = offset - news.length;

          const isVisible = Math.abs(offset) <= 2;
          const isActive = offset === 0;

          return (
            <div
              key={item.id}
              className={`absolute w-[85%] h-[70%] transition-all duration-700 ease-out border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl overflow-hidden
                ${isActive ? 'z-10 opacity-100 scale-100 translate-y-0 bg-[#1c1c21]' : 'z-0 opacity-40'}
                ${offset === 1 ? 'scale-90 translate-y-6 z-[2] bg-[#151518]' : ''}
                ${offset === 2 ? 'scale-75 translate-y-12 z-[1] bg-[#121215]' : ''}
                ${offset < 0 ? 'scale-110 -translate-y-24 opacity-0 z-[5]' : ''}
              `}
              style={{
                display: isVisible ? 'flex' : 'none',
                filter: isActive ? 'none' : 'blur(1px)'
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <span className="text-[8px] font-black bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20 uppercase">
                     {item.source}
                   </span>
                   <span className="text-[8px] font-bold text-neon-accent uppercase">{item.timestamp}</span>
                </div>
                <h3 className="text-sm font-black text-white leading-tight line-clamp-3">
                  {item.title}
                </h3>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed italic">
                  "{item.summary}"
                </p>
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[9px] font-black text-purple-400 hover:text-white transition-colors uppercase tracking-widest"
                >
                  Read Intelligence <i className="fa-solid fa-arrow-right"></i>
                </a>
              </div>
              
              {/* Background gradient hint */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none"></div>
            </div>
          );
        })}
      </div>

      {/* Progress indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {news.map((_, i) => (
          <div 
            key={i} 
            className={`h-0.5 transition-all duration-500 rounded-full ${i === activeIndex ? 'w-4 bg-purple-500' : 'w-1 bg-white/10'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default NewsCarousel;
