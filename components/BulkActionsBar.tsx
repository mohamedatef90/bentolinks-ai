import React from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onMove: () => void;
  onClearSelection: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onDelete,
  onMove,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div 
      className="
        fixed bottom-6 left-1/2 -translate-x-1/2
        bg-zinc-900 border border-zinc-800 rounded-xl
        shadow-2xl p-4 flex items-center gap-4
        animate-in slide-in-from-bottom duration-300
        z-50
      "
      role="toolbar"
      aria-label="Bulk actions"
    >
      {/* Selected count */}
      <span className="text-white font-medium">
        {selectedCount} selected
      </span>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onMove}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors min-h-[44px]"
          aria-label="Move selected links"
        >
          <i className="fas fa-folder-open mr-2" />
          Move
        </button>

        <button
          onClick={onDelete}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors min-h-[44px]"
          aria-label="Delete selected links"
        >
          <i className="fas fa-trash mr-2" />
          Delete
        </button>

        <button
          onClick={onClearSelection}
          className="px-4 py-2 bg-transparent hover:bg-zinc-800 text-gray-400 rounded-lg transition-colors min-h-[44px]"
          aria-label="Clear selection"
        >
          <i className="fas fa-times" />
        </button>
      </div>
    </div>
  );
};
