import React, { useState, useEffect } from 'react';

export const KeyboardShortcutsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + /
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // ESC to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  if (!isOpen) return null;

  const shortcuts = [
    { keys: ['Cmd/Ctrl', 'K'], action: 'Add new link' },
    { keys: ['Cmd/Ctrl', 'I'], action: 'Import bookmarks' },
    { keys: ['Cmd/Ctrl', '/'], action: 'Show shortcuts' },
    { keys: ['ESC'], action: 'Close modal/panel' },
    { keys: ['Cmd/Ctrl', 'A'], action: 'Select all' },
  ];

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
      >
        <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full border border-zinc-800">
          <h2 id="shortcuts-title" className="text-2xl font-bold mb-4 text-white">
            Keyboard Shortcuts
          </h2>
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-400">{shortcut.action}</span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, i) => (
                    <kbd 
                      key={i} 
                      className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm font-mono text-white"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
