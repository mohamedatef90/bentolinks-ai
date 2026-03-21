import React, { useRef, useState, useEffect } from 'react';
import { Link } from '../types';
import LinkCard from './LinkCard';

interface Props {
  links: Link[];
  onDeleteLink: (id: string) => void;
}

export const VirtualLinkList: React.FC<Props> = ({ links, onDeleteLink }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const containerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 120; // Approximate card height

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const scrollTop = containerRef.current.scrollTop;
      const start = Math.floor(scrollTop / ITEM_HEIGHT);
      const end = start + 20; // Show 20 items
      
      setVisibleRange({ start, end });
    };

    const container = containerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  const visibleLinks = links.slice(visibleRange.start, visibleRange.end);
  const offsetY = visibleRange.start * ITEM_HEIGHT;

  return (
    <div 
      ref={containerRef}
      className="overflow-y-auto h-[600px]"
      style={{ position: 'relative' }}
    >
      <div style={{ height: links.length * ITEM_HEIGHT }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleLinks.map(link => (
            <LinkCard
              key={link.id}
              link={link}
              onDelete={() => onDeleteLink(link.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
