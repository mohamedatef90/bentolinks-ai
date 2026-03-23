import React, { useState, useRef, useEffect } from 'react';
import { Link, Category } from '../types';

interface LinkCardTooltipProps {
  link: Link;
  category?: Category;
  children: React.ReactNode;
}

export const LinkCardTooltip: React.FC<LinkCardTooltipProps> = ({ 
  link, 
  category, 
  children 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const domain = new URL(link.url).hostname;

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Wait 300ms before showing tooltip
    timeoutRef.current = setTimeout(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        // Position tooltip to the right of the card
        const x = rect.right + 20;
        const y = rect.top;
        
        setPosition({ x, y });
        setIsVisible(true);
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Adjust position if tooltip goes off screen
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();
      
      let adjustedX = position.x;
      let adjustedY = position.y;

      // If tooltip goes off right edge, show on left instead
      if (rect.right > window.innerWidth - 20) {
        const cardRect = containerRef.current?.getBoundingClientRect();
        if (cardRect) {
          adjustedX = cardRect.left - rect.width - 20;
        }
      }

      // If tooltip goes off bottom edge, adjust up
      if (rect.bottom > window.innerHeight - 20) {
        adjustedY = window.innerHeight - rect.height - 20;
      }

      // If tooltip goes off top edge, adjust down
      if (adjustedY < 20) {
        adjustedY = 20;
      }

      if (adjustedX !== position.x || adjustedY !== position.y) {
        setPosition({ x: adjustedX, y: adjustedY });
      }
    }
  }, [isVisible, position]);

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <div className="bg-[#1a1a1e] border-2 border-[#c1ff00]/30 rounded-2xl p-6 shadow-2xl shadow-[#c1ff00]/10 w-[400px] max-w-[90vw]">
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-[#c1ff00]/20 bg-zinc-900 shadow-inner shrink-0">
                <img 
                  src={`https://www.google.com/s2/favicons?sz=128&domain=${link.url}`} 
                  alt="" 
                  className="w-10 h-10 object-contain"
                  onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${link.title}&background=18181b&color=c1ff00&size=128`)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-xl mb-1 leading-tight">
                  {link.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <span className="uppercase tracking-widest font-extrabold">
                    {domain}
                  </span>
                  {link.isPinned && (
                    <span className="text-[#c1ff00]">
                      <i className="fas fa-thumbtack text-xs" />
                    </span>
                  )}
                </div>
                {category && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#c1ff00]/10 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c1ff00]" />
                    <span className="text-xs font-bold text-[#c1ff00] uppercase tracking-wider">
                      {category.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-white/5 pt-4">
              <p className="text-sm text-gray-300 leading-relaxed">
                {link.description || 'No detailed description found for this resource.'}
              </p>
            </div>

            {/* Section (if available) */}
            {link.section && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <i className="fas fa-folder text-xs text-gray-500" />
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                    {link.section}
                  </span>
                </div>
              </div>
            )}

            {/* Footer hint */}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                Click to open
              </span>
              <span className="text-[10px] text-gray-600">
                Added {new Date(link.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Arrow indicator */}
          <div 
            className="absolute top-8 -left-2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-[#c1ff00]/30"
            style={{
              filter: 'drop-shadow(-2px 0 4px rgba(193, 255, 0, 0.1))'
            }}
          />
        </div>
      )}
    </>
  );
};
