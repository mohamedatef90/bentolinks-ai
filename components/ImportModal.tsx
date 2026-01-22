
import React, { useState } from 'react';
import { parseBookmarksHTML, ParsedBookmark } from '../services/bookmarkService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (bookmarks: ParsedBookmark[], mode: 'add' | 'replace', strategy: 'fast' | 'accurate') => void;
  existingCount: number;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, existingCount }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [bookmarks, setBookmarks] = useState<ParsedBookmark[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [strategy, setStrategy] = useState<'fast' | 'accurate'>('accurate');

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsProcessing(true);
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const results = parseBookmarksHTML(content);
      setBookmarks(results);
      setParsedCount(results.length);
      setIsProcessing(false);
    };
    reader.readAsText(selectedFile);
  };

  const handleAction = (mode: 'add' | 'replace') => {
    if (bookmarks.length === 0) return;
    onImport(bookmarks, mode, strategy);
    onClose();
    // Reset state
    setFile(null);
    setBookmarks([]);
    setParsedCount(0);
    setStrategy('accurate');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="bg-[#151518] border border-white/10 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-10 border-b border-white/5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Bulk Importer</span>
            </div>
            <h2 className="text-3xl font-black tracking-tighter">Import Data</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-zinc-600 hover:text-white rounded-full transition-all">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="p-10 space-y-8 text-center">
          {!file ? (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/10 rounded-[2rem] cursor-pointer hover:bg-white/[0.02] transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <i className="fa-solid fa-cloud-arrow-up text-3xl text-zinc-600 group-hover:text-[#c1ff00] mb-4 transition-colors"></i>
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Select HTML Export</p>
                <p className="text-[10px] text-zinc-600 mt-2">Bookmarks.html from your browser</p>
              </div>
              <input type="file" className="hidden" accept=".html" onChange={handleFileChange} />
            </label>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-zinc-900/50 rounded-[2rem] border border-white/5">
                <p className="text-4xl font-black tracking-tighter text-[#c1ff00] mb-1">{parsedCount}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Resources Detected</p>
              </div>

              {/* Strategy Selector */}
              <div className="grid grid-cols-2 gap-4 p-1 bg-white/5 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setStrategy('fast')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${strategy === 'fast' ? 'bg-white/10 text-[#c1ff00] border border-[#c1ff00]/30 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <i className="fa-solid fa-bolt mr-2"></i>
                  Fast Import
                </button>
                <button
                  type="button"
                  onClick={() => setStrategy('accurate')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${strategy === 'accurate' ? 'bg-white/10 text-[#c1ff00] border border-[#c1ff00]/30 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                  AI Analysis
                </button>
              </div>

              <div className="bg-white/[0.02] p-4 rounded-xl text-left">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] leading-relaxed">
                  {strategy === 'fast' 
                    ? "⚡ FAST: Immediate import using basic keyword matching for categories. Best for large collections."
                    : "✨ ACCURATE: Sequential AI analysis to determine precise categories, clean titles, and write descriptions."}
                </p>
              </div>

              {existingCount > 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => handleAction('add')}
                      className="flex-1 py-4 bg-white/5 border border-white/5 text-white font-black rounded-2xl hover:bg-white/10 transition-all text-[10px] uppercase tracking-widest"
                    >
                      Merge Entries
                    </button>
                    <button
                      onClick={() => handleAction('replace')}
                      className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-500 font-black rounded-2xl hover:bg-red-500/20 transition-all text-[10px] uppercase tracking-widest"
                    >
                      Overwrite All
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleAction('add')}
                  className="w-full py-5 bg-[#c1ff00] text-black font-black rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all text-[11px] uppercase tracking-widest shadow-xl shadow-[#c1ff00]/10"
                >
                  Start Import Process
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
