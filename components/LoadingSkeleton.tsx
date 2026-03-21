import React from 'react';

export const LinkCardSkeleton: React.FC = () => (
  <div className="
    bg-gradient-to-br from-gray-800/50 to-gray-900/50
    rounded-xl p-6 
    border border-gray-700/50
    animate-pulse
  ">
    {/* Icon + Title */}
    <div className="flex items-start gap-4 mb-4">
      <div className="w-12 h-12 bg-gray-700/50 rounded-lg" />
      <div className="flex-1">
        <div className="h-5 bg-gray-700/50 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-700/50 rounded w-1/2" />
      </div>
    </div>
    
    {/* Description */}
    <div className="space-y-2 mb-4">
      <div className="h-3 bg-gray-700/50 rounded w-full" />
      <div className="h-3 bg-gray-700/50 rounded w-5/6" />
    </div>
    
    {/* Tags */}
    <div className="flex gap-2">
      <div className="h-6 w-16 bg-gray-700/50 rounded-full" />
      <div className="h-6 w-20 bg-gray-700/50 rounded-full" />
    </div>
  </div>
);
