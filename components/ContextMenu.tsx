import React from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  options: Array<{
    label: string;
    icon: string;
    onClick: () => void;
    danger?: boolean;
  }>;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options }) => {
  return (
    <div
      className="fixed bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-2 z-50 min-w-[200px]"
      style={{ top: y, left: x }}
      role="menu"
      aria-label="Context menu"
    >
      {options.map((option, index) => (
        <button
          key={index}
          onClick={option.onClick}
          className={`
            w-full px-4 py-2 text-left flex items-center gap-3
            hover:bg-zinc-800 transition-colors
            min-h-[44px]
            ${option.danger ? 'text-red-400 hover:text-red-300' : 'text-white'}
          `}
          role="menuitem"
        >
          <i className={`${option.icon} w-4`} aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};
