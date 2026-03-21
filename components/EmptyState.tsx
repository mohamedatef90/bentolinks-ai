import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon */}
      <div className="mb-6 text-6xl opacity-40">
        {icon}
      </div>
      
      {/* Title */}
      <h3 className="text-xl font-semibold text-white mb-2">
        {title}
      </h3>
      
      {/* Description */}
      <p className="text-gray-400 max-w-md mb-6">
        {description}
      </p>
      
      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="
            px-6 py-3 
            bg-brand-neon text-black font-semibold rounded-lg
            hover:bg-brand-neonHover hover:shadow-neonHover
            transition-all duration-300
            min-h-[44px]
          "
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
