import React from 'react';
import { LinkCardSkeleton } from './LoadingSkeleton';

export const InitialLoading: React.FC = () => (
  <div className="space-y-4">
    {/* Logo pulse */}
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse">
        <i className="fas fa-bookmark text-6xl text-brand-neon" />
      </div>
    </div>
    
    {/* Loading text */}
    <p className="text-center text-gray-400 animate-pulse">
      Loading your links...
    </p>
    
    {/* Skeleton cards */}
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <LinkCardSkeleton />
      <LinkCardSkeleton />
      <LinkCardSkeleton />
    </div>
  </div>
);
