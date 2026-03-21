// DEMO: Toast Notification System
// This file demonstrates the toast system. Delete after testing.

import React from 'react';
import { ToastContainer, useToast } from './components/Toast';

const ToastDemo: React.FC = () => {
  const { toasts, showToast, removeToast } = useToast();

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-4xl font-black text-white">Toast Notification Demo</h1>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => showToast('Link added successfully!', 'success')}
            className="bg-green-600 text-white px-6 py-4 rounded-lg font-bold hover:bg-green-700"
          >
            Success Toast
          </button>
          
          <button
            onClick={() => showToast('Invalid URL format. Please use http:// or https://', 'error')}
            className="bg-red-600 text-white px-6 py-4 rounded-lg font-bold hover:bg-red-700"
          >
            Error Toast
          </button>
          
          <button
            onClick={() => showToast('AI analysis completed', 'info')}
            className="bg-blue-600 text-white px-6 py-4 rounded-lg font-bold hover:bg-blue-700"
          >
            Info Toast
          </button>
          
          <button
            onClick={() => showToast('This resource already exists in your vault', 'warning')}
            className="bg-yellow-600 text-white px-6 py-4 rounded-lg font-bold hover:bg-yellow-700"
          >
            Warning Toast
          </button>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Features:</h2>
          <ul className="text-zinc-400 space-y-2 text-sm">
            <li>✅ Auto-dismiss after 5 seconds</li>
            <li>✅ Manual close button (44x44px touch target)</li>
            <li>✅ ARIA live regions for screen readers</li>
            <li>✅ Slide-in animation</li>
            <li>✅ Stack multiple toasts</li>
            <li>✅ 4 types: success, error, info, warning</li>
          </ul>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Keyboard Shortcuts:</h2>
          <ul className="text-zinc-400 space-y-2 text-sm font-mono">
            <li><kbd className="bg-zinc-800 px-2 py-1 rounded">Cmd/Ctrl + K</kbd> → Open "Add Link" modal</li>
            <li><kbd className="bg-zinc-800 px-2 py-1 rounded">Cmd/Ctrl + I</kbd> → Open "Import" modal</li>
            <li><kbd className="bg-zinc-800 px-2 py-1 rounded">ESC</kbd> → Close modal</li>
          </ul>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default ToastDemo;
