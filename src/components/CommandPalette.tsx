import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles, AlertCircle } from 'lucide-react';
import { PDF_TOOLS } from '../utils/tools';
import { PDFTool } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (id: any) => void;
}

export default function CommandPalette({ isOpen, onClose, onSelectTool }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      // Let transition play before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredTools.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredTools.length) % filteredTools.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredTools[selectedIndex]) {
          onSelectTool(filteredTools[selectedIndex].id);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, search]);

  const filteredTools = PDF_TOOLS.filter(
    (tool) =>
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[70vh]"
      >
        <div className="relative border-b border-slate-850 p-4 flex items-center gap-3 bg-slate-950">
          <Search className="text-slate-400" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent focus:outline-none border-none text-slate-100 text-sm placeholder:text-slate-500"
            placeholder="Search all tools (e.g. Merge, Sign, Protect)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-2 flex-grow">
          {filteredTools.length > 0 ? (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Tools Match ({filteredTools.length})
              </div>
              {filteredTools.map((tool, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      onSelectTool(tool.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-3 rounded-lg transition duration-150 flex items-center justify-between ${
                      isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-md ${
                          isSelected ? 'bg-indigo-750 text-white' : 'bg-slate-800 text-indigo-400'
                        }`}
                      >
                        <Search size={16} />
                      </div>
                      <div className="truncate">
                        <div className="font-medium text-sm">{tool.name}</div>
                        <div
                          className={`text-xs truncate ${
                            isSelected ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {tool.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] bg-indigo-500/50 border border-indigo-400/30 px-1.5 py-0.5 rounded text-indigo-100 font-mono">
                        ENTER
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500">
              <AlertCircle size={32} className="mb-2 text-slate-600" />
              <div className="text-sm font-medium">No tools matches '{search}'</div>
              <div className="text-xs">Try searching for other core PDF services.</div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-950 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="bg-slate-800 border border-slate-700 px-1 rounded text-slate-300">↑↓</span>
            Navigate
            <span className="bg-slate-800 border border-slate-700 px-1 rounded text-slate-300 ml-1">⏎</span>
            Select
          </div>
          <div className="flex items-center gap-1">
            <Sparkles size={11} className="text-indigo-400" />
            <span>100% Client-Side Privacy Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
