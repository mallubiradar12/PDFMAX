import React, { useState, useEffect } from 'react';
import {
  FileText, Search, Star, Clock, Shield, Sparkles, Command, AlertCircle,
  ArrowLeft, Upload, Grid, GitMerge, Scissors, Layers, Minimize2,
  Lock, Wrench, Edit3, PenTool, FileImage, ScanText, FileCode, Check, RefreshCw,
  Download, BookOpen, Presentation, FileEdit
} from 'lucide-react';

import { ToolId, ToolCategory, PDFTool, RecentFile } from './types';
import { PDF_TOOLS } from './utils/tools';
import { formatBytes } from './utils/pdf';

// Core Tool Import wrappers
import CommandPalette from './components/CommandPalette';
import MergeTool from './components/tools/MergeTool';
import SplitTool from './components/tools/SplitTool';
import CompressTool from './components/tools/CompressTool';
import OrganizeTool from './components/tools/OrganizeTool';
import SignTool from './components/tools/SignTool';
import EditTool from './components/tools/EditTool';
import ProtectTool from './components/tools/ProtectTool';
import RepairTool from './components/tools/RepairTool';
import OcrTool from './components/tools/OcrTool';
import ConvertToPdfTool from './components/tools/ConvertToPdfTool';
import ConvertFromPdfTool from './components/tools/ConvertFromPdfTool';
import LandingPage from './components/LandingPage';

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  const [activeToolId, setActiveToolId] = useState<ToolId | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  
  // Persistent localStorage properties
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  
  // Modals / Overlays triggers
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isGlobalDrag, setIsGlobalDrag] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [latestCompiled, setLatestCompiled] = useState<{ id: string; name: string; size: number; downloadUrl: string } | null>(null);

  // Initialize persistent metrics
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem('pdfmax_favs');
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
      
      const savedRecents = localStorage.getItem('pdfmax_recents');
      if (savedRecents) setRecents(JSON.parse(savedRecents));
    } catch (e) {
      console.warn('Local storage states initialized clean.');
    }
  }, []);

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setActiveToolId(null);
        setDroppedFile(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFavorite = (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated;
    if (favorites.includes(toolId)) {
      updated = favorites.filter((id) => id !== toolId);
    } else {
      updated = [...favorites, toolId];
    }
    setFavorites(updated);
    localStorage.setItem('pdfmax_favs', JSON.stringify(updated));
  };

  const handleToolSuccessLog = (newName: string, size: number, bytes: Uint8Array) => {
    if (!activeToolId) return;
    
    // Convert output array buffer to an object URL for persistent offline browser downloads
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const localUrl = URL.createObjectURL(blob);

    const newRecord: RecentFile = {
      id: Math.random().toString(),
      name: newName,
      size,
      toolUsed: activeToolId,
      timestamp: Date.now(),
      downloadUrl: localUrl,
    };

    const updated = [newRecord, ...recents].slice(0, 20); // hold last 20 entries
    setRecents(updated);
    localStorage.setItem('pdfmax_recents', JSON.stringify(updated));
    setLatestCompiled({
      id: newRecord.id,
      name: newName,
      size,
      downloadUrl: localUrl
    });
  };

  // Drag & drop visual zones triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsGlobalDrag(true);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsGlobalDrag(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      setDroppedFile(file);
    }
  };

  const clearDroppedFile = () => {
    setDroppedFile(null);
  };

  const renderToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'GitMerge':
        return <GitMerge size={18} />;
      case 'Scissors':
        return <Scissors size={18} />;
      case 'Layers':
        return <Layers size={18} />;
      case 'Heading1':
      case 'Minimize2':
        return <Minimize2 size={18} />;
      case 'Lock':
        return <Lock size={18} />;
      case 'Wrench':
        return <Wrench size={18} />;
      case 'Edit3':
        return <Edit3 size={18} />;
      case 'Signature':
      case 'PenTool':
        return <PenTool size={18} />;
      case 'FileImage':
        return <FileImage size={18} />;
      case 'ScanText':
        return <ScanText size={18} />;
      case 'FileText':
        return <FileText size={18} />;
      case 'FileCode':
        return <FileCode size={18} />;
      case 'Sparkles':
        return <Sparkles size={18} />;
      case 'BookOpen':
        return <BookOpen size={18} />;
      case 'Presentation':
        return <Presentation size={18} />;
      case 'FileEdit':
        return <FileEdit size={18} />;
      case 'Grid':
      default:
        return <Grid size={18} />;
    }
  };

  // Map and filter active products
  const filteredTools = PDF_TOOLS.filter((tool) => {
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Render individual tools dynamically
  const renderActiveTool = () => {
    switch (activeToolId) {
      case 'merge':
        return <MergeTool onSuccess={handleToolSuccessLog} />;
      case 'split':
        return <SplitTool onSuccess={handleToolSuccessLog} />;
      case 'compress':
        return <CompressTool onSuccess={handleToolSuccessLog} />;
      case 'organize':
        return <OrganizeTool onSuccess={handleToolSuccessLog} />;
      case 'sign':
        return <SignTool onSuccess={handleToolSuccessLog} />;
      case 'convert-from':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} />;
      case 'convert-to':
        return <ConvertToPdfTool onSuccess={handleToolSuccessLog} />;
      case 'pdf-docx':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="docx" />;
      case 'pdf-xlsx':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="xlsx" />;
      case 'pdf-pptx':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="pptx" />;
      case 'pdf-image':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="png" />;
      case 'pdf-html':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="html" />;
      case 'pdf-txt':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="txt" />;
      case 'pdf-epub':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="epub" />;
      case 'pdf-csv':
        return <ConvertFromPdfTool onSuccess={handleToolSuccessLog} defaultFormat="csv" />;
      case 'docx-pdf':
        return <ConvertToPdfTool onSuccess={handleToolSuccessLog} defaultSourceExt="docx" />;
      case 'xlsx-pdf':
        return <ConvertToPdfTool onSuccess={handleToolSuccessLog} defaultSourceExt="xlsx" />;
      case 'pptx-pdf':
        return <ConvertToPdfTool onSuccess={handleToolSuccessLog} defaultSourceExt="pptx" />;
      case 'image-pdf':
        return <ConvertToPdfTool onSuccess={handleToolSuccessLog} defaultSourceExt="image" />;
      case 'html-pdf':
        return <ConvertToPdfTool onSuccess={handleToolSuccessLog} defaultSourceExt="html" />;
      case 'md-pdf':
        return <ConvertToPdfTool onSuccess={handleToolSuccessLog} defaultSourceExt="md" />;
      case 'protect':
        return <ProtectTool onSuccess={handleToolSuccessLog} />;
      case 'repair':
        return <RepairTool onSuccess={handleToolSuccessLog} />;
      case 'ocr':
        return <OcrTool onSuccess={handleToolSuccessLog} />;
      case 'edit':
        return <EditTool onSuccess={handleToolSuccessLog} />;
      default:
        return null;
    }
  };

  const activeToolMeta = PDF_TOOLS.find((t) => t.id === activeToolId);

  if (viewMode === 'landing') {
    return (
      <LandingPage
        onLaunchApp={() => setViewMode('app')}
        onSelectTool={(id) => {
          setActiveToolId(id);
          setViewMode('app');
        }}
        onDropFile={(file) => {
          setDroppedFile(file);
          setViewMode('app');
        }}
      />
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsGlobalDrag(false)}
      onDrop={handleDropFile}
      className={`min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col md:flex-row relative ${
        isGlobalDrag ? 'ring-4 ring-indigo-500/50' : ''
      }`}
    >
      {/* Dynamic Overlay for drops */}
      {isGlobalDrag && (
        <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center text-indigo-200 pointer-events-none animate-fade-in">
          <Upload className="animate-bounce" size={48} />
          <h2 className="text-xl font-bold mt-4">Drop your document anywhere!</h2>
          <p className="text-xs text-indigo-400 mt-1">PDFMAX will analyze variables locally inside browser memory.</p>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION BAR */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-855 flex flex-col justify-between flex-shrink-0">
        <div className="p-5 space-y-6">
          {/* Logo brand */}
          <div
            onClick={() => {
              setViewMode('landing');
              setActiveToolId(null);
            }}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 select-none group"
          >
            <div className="bg-gradient-to-tr from-indigo-700 to-indigo-500 p-2 rounded-xl text-white shadow-md shadow-indigo-600/20 group-hover:scale-103 transition">
              <FileText size={20} />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                PDFMAX
              </span>
              <span className="block text-[9px] font-semibold text-indigo-400 tracking-wider">Fast. Private. Fast.</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px]">
            100% Free file manipulation. Zero AI bloat. Zero limits. Underwritten by browser-side WASM.
          </p>

          {/* Quick Categories list selection */}
          <nav className="space-y-1.5 pt-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2.5 mb-2">
              Core Categories
            </div>

            <button
              onClick={() => {
                setViewMode('landing');
                setActiveToolId(null);
              }}
              className="w-full flex items-center justify-between text-left px-3 py-2 text-xs rounded-lg transition font-medium text-slate-400 hover:bg-slate-850 hover:text-slate-200 mb-2 border border-slate-800/40 bg-slate-900/40"
            >
              <span className="flex items-center gap-1.5">🏠 Home Landing</span>
              <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-bold font-mono uppercase tracking-wider">
                Home
              </span>
            </button>

            {[
              { id: 'all', label: 'All PDF Tools', count: PDF_TOOLS.length },
              { id: 'organize', label: 'Organize Pages', count: PDF_TOOLS.filter((t) => t.category === 'organize').length },
              { id: 'edit', label: 'Edit & Annotate', count: PDF_TOOLS.filter((t) => t.category === 'edit').length },
              { id: 'convert', label: 'Conversion Tools', count: PDF_TOOLS.filter((t) => t.category === 'convert').length },
              { id: 'security', label: 'Protect & Lock', count: PDF_TOOLS.filter((t) => t.category === 'security').length },
              { id: 'utility', label: 'Optimization', count: PDF_TOOLS.filter((t) => t.category === 'utility').length }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id as ToolCategory);
                  setActiveToolId(null);
                  setSearchQuery('');
                }}
                className={`w-full flex items-center justify-between text-left px-3 py-2 text-xs rounded-lg transition font-medium ${
                  activeCategory === cat.id && !activeToolId
                    ? 'bg-indigo-650/15 border border-indigo-500/20 text-indigo-400'
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <span>{cat.label}</span>
                <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full font-mono font-bold">
                  {cat.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Dashboard storage / bottom credits block */}
        <div className="p-4 border-t border-slate-855 bg-slate-930 text-[10px] text-slate-500 select-none">
          <div className="flex items-center gap-1.5 text-indigo-450 font-bold mb-1">
            <Shield size={11} /> Secured Local Memory
          </div>
          <p className="leading-snug">
            All files are held dynamically inside browser sandboxed state memory. No remote crawler captures.
          </p>
        </div>
      </aside>

      {/* CORE WORKSPACE MAIN WINDOW AREA */}
      <main className="flex-1 flex flex-col justify-between overflow-x-hidden">
        {/* Dynamic header navigation bar */}
        <header className="p-4 bg-slate-900 border-b border-slate-855 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {activeToolId ? (
              <button
                onClick={() => {
                  setActiveToolId(null);
                  setDroppedFile(null);
                }}
                className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg hover:text-white transition flex items-center gap-1 text-xs"
              >
                <ArrowLeft size={14} />
                <span>All Services</span>
              </button>
            ) : (
              <button
                onClick={() => setViewMode('landing')}
                className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg hover:text-white transition flex items-center gap-1 text-xs"
              >
                <ArrowLeft size={14} />
                <span>Home Landing</span>
              </button>
            )}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Sparkles className="text-indigo-450" size={13} />
              <span>Offline Sandboxed Processing Loaded</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCommandOpen(true)}
              className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition border border-slate-800/80 flex items-center gap-1.5 cursor-pointer select-none"
            >
              <Command size={12} />
              <span>Search Services</span>
              <kbd className="hidden md:inline bg-slate-900 px-1 rounded text-[10px] border border-slate-750">Ctrl+K</kbd>
            </button>
          </div>
        </header>

        {/* Dynamic primary stage window templates */}
        <div className="p-6 md:p-8 flex-grow">
          {droppedFile && !activeToolId ? (
            /* INTERATIVE FILE SELECT PROMPT */
            <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-2xl animate-fade-in text-left">
              <div className="flex justify-between items-start">
                <div className="flex gap-2.5 items-center">
                  <div className="p-2 bg-indigo-950/40 text-indigo-400 border border-indigo-905 rounded-xl">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm">Dropped file "{droppedFile.name}"</h3>
                    <span className="text-[10px] text-slate-500 font-mono block">Size: {formatBytes(droppedFile.size)}</span>
                  </div>
                </div>
                <button
                  onClick={clearDroppedFile}
                  className="p-1 text-slate-500 hover:text-slate-350 bg-slate-850 rounded"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">What action would you like to perform?</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'compress', label: 'Optimize Sizing', desc: 'Optimize redundant streams' },
                    { id: 'split', label: 'Split Page Ranges', desc: 'Separate layouts by indexes' },
                    { id: 'sign', label: 'Stamp Signature Seal', desc: 'Seal contracts physically' },
                    { id: 'organize', label: 'Organize Visual Pages', desc: 'Delete, rotate or re-order sheets' },
                    { id: 'protect', label: 'Add Key Locks', desc: 'Encrypt with passwords' },
                    { id: 'edit', label: 'Draw Text/Shapes Annotations', desc: 'Add paragraphs, shapes with history' }
                  ].map((act) => (
                    <button
                      key={act.id}
                      onClick={async () => {
                        const arrayBuffer = await droppedFile.arrayBuffer();
                        // Pre-populate target tool variables
                        if (act.id === 'compress') {
                          setActiveToolId('compress');
                        } else if (act.id === 'split') {
                          setActiveToolId('split');
                        } else if (act.id === 'sign') {
                          setActiveToolId('sign');
                        } else if (act.id === 'organize') {
                          setActiveToolId('organize');
                        } else if (act.id === 'protect') {
                          setActiveToolId('protect');
                        } else if (act.id === 'edit') {
                          setActiveToolId('edit');
                        }
                        
                        // Wait a fraction of a frame for layout registers to render, then locate local DOM inputs
                        setTimeout(() => {
                          const input = document.getElementById(`${act.id}-uploader`) as HTMLInputElement;
                          if (input) {
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(droppedFile);
                            input.files = dataTransfer.files;
                            // Fire simulated change trigger
                            const event = new Event('change', { bubbles: true });
                            input.dispatchEvent(event);
                          }
                        }, 50);

                        setDroppedFile(null);
                      }}
                      className="text-left p-3 rounded-lg bg-slate-950 hover:bg-indigo-650/10 border border-slate-850 hover:border-indigo-500 transition group"
                    >
                      <span className="block text-xs font-bold text-slate-200 group-hover:text-indigo-300">{act.label}</span>
                      <span className="block text-[10px] text-slate-500 leading-normal mt-0.5">{act.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : activeToolId ? (
            /* ACTIVE TOOL WORKSPACE STAGE */
            <section className="max-w-5xl mx-auto space-y-4 animate-fade-in animate-duration-150">
              <div className="flex justify-between items-start gap-4">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">
                    Core Tool Series • Browser Engine
                  </span>
                  <h1 className="text-xl md:text-2xl font-extrabold text-white mt-1">
                    {activeToolMeta?.name}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    {activeToolMeta?.longDescription}
                  </p>
                </div>

                <button
                  onClick={(e) => toggleFavorite(activeToolId, e)}
                  className={`p-2 rounded-xl border transition ${
                    favorites.includes(activeToolId)
                      ? 'bg-yellow-905/10 border-yellow-501 text-yellow-405'
                      : 'border-slate-850 hover:bg-slate-855 text-slate-500 hover:text-slate-200'
                  }`}
                  title="Pin tool"
                >
                  <Star fill={favorites.includes(activeToolId) ? 'currentColor' : 'none'} size={16} />
                </button>
              </div>

              {/* Mount the actual tool */}
              <div className="pt-2">
                {renderActiveTool()}
              </div>
            </section>
          ) : (
            /* LANDING MAIN DIRECTORY DASHBOARD */
            <div className="space-y-10 max-w-6xl mx-auto text-left">
              <header className="relative py-12 p-6 overflow-hidden rounded-2xl border border-slate-855 bg-gradient-to-b from-slate-900 to-indigo-950/20 text-center space-y-4 shadow-xl">
                {/* Background ambient accents */}
                <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/5 blur-[80px] rounded-full"></div>
                <div className="absolute bottom-0 left-0 h-40 w-40 bg-indigo-700/5 blur-[80px] rounded-full"></div>

                <div className="flex justify-center flex-col items-center">
                  <div className="px-3 py-1 bg-indigo-950/70 border border-indigo-900/60 rounded-full text-indigo-400 font-semibold mb-2 text-[10px] tracking-wider uppercase select-none">
                    V1 Launch Active Workspace • Zero AI
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    Everything PDF. No AI. Fast.
                  </h1>
                  <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-xl mx-auto leading-relaxed">
                    Zero paywalls. Zero file limits. Files process entirely on your machine.
                  </p>
                </div>

                {/* CENTRAL DRAG AND DROP LANDING CARD */}
                <div className="max-w-md mx-auto aspect-[3/1] rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/80 p-5 flex flex-col justify-center items-center transition cursor-pointer relative group mt-3">
                  <input
                    type="file"
                    accept=".pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      if (e.target.files?.[0]) {
                        setDroppedFile(e.target.files[0]);
                      }
                    }}
                  />
                  <Upload className="text-indigo-400 group-hover:animate-bounce transition" size={24} />
                  <span className="block text-xs font-bold text-slate-200 mt-2">
                    Drag any PDF directly onto layout screen
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Or select browser browse loop
                  </span>
                </div>
              </header>

              {/* Favorites pin directory */}
              {favorites.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <Star className="text-yellow-500" size={14} fill="currentColor" />
                    <span>Pinned Favorites ({favorites.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {PDF_TOOLS.filter((t) => favorites.includes(t.id)).map((tool) => (
                      <div
                        key={tool.id}
                        onClick={() => setActiveToolId(tool.id)}
                        className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500/70 cursor-pointer transition shadow hover:shadow-indigo-500/5 group relative text-left"
                      >
                        <div className="flex gap-3">
                          <div className="p-2 bg-indigo-950/40 border border-indigo-900/30 rounded-lg text-indigo-400 group-hover:scale-102 transition">
                            {/* Dynamically parsed icons */}
                            {renderToolIcon(tool.iconName)}
                          </div>
                          <div>
                            <h3 className="font-bold text-xs text-slate-200 group-hover:text-indigo-300">
                              {tool.name}
                            </h3>
                            <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main General Directory tools */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-855 pb-2">
                  <div className="flex gap-2 items-center">
                    <Grid className="text-slate-500" size={16} />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      PDFMAX Utilities Directory ({filteredTools.length})
                    </span>
                  </div>

                  <input
                    type="text"
                    placeholder="Fuzzy search tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:border-indigo-505 focus:text-slate-200 text-slate-400 w-44"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTools.map((tool) => {
                    const isFav = favorites.includes(tool.id);
                    return (
                      <div
                        key={tool.id}
                        onClick={() => {
                          setActiveToolId(tool.id);
                          setSearchQuery('');
                        }}
                        className="p-4.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500 hover:shadow shadow-lg hover:shadow-indigo-600/5 cursor-pointer group transition duration-200 flex flex-col justify-between"
                      >
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => toggleFavorite(tool.id, e)}
                            className="absolute top-3 right-3 text-slate-650 hover:text-yellow-405 group-hover:opacity-100 transition p-1 rounded-full hover:bg-slate-800"
                          >
                            <Star fill={isFav ? '#f59e0b' : 'none'} className={isFav ? 'text-yellow-505' : ''} size={13} />
                          </button>

                          <div className="p-2.5 bg-indigo-950/40 border border-indigo-900/30 rounded-xl text-indigo-400 flex-shrink-0 group-hover:scale-103 transition self-start">
                            {renderToolIcon(tool.iconName)}
                          </div>
                          <div className="pr-3 text-left">
                            <h3 className="font-bold text-xs text-slate-100 group-hover:text-indigo-300">
                              {tool.name}
                            </h3>
                            <p className="text-[11px] text-slate-450 mt-1 pr-1.5 leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                        </div>

                        {/* Extra tags */}
                        <div className="pt-4 flex justify-between items-center text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest border-t border-slate-855 mt-4">
                          <span>{tool.category}</span>
                          <span className="text-indigo-455 opacity-0 group-hover:opacity-100 transition duration-150">
                            Launch Tool →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SYSTEM ACTIVITY REGISTRY LOGS */}
              {recents.length > 0 && (
                <div className="space-y-3 animate-fade-in uppercase">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Clock className="text-slate-500" size={14} />
                    <span>Recent Worksheets ({recents.length})</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                    <div className="divide-y divide-slate-855 bg-slate-950">
                      {recents.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-3.5 flex-wrap sm:flex-nowrap gap-3"
                        >
                          <div className="flex items-center gap-3 pr-4 text-left min-w-0">
                            <FileText className="text-indigo-400 flex-shrink-0" size={18} />
                            <div className="truncate">
                              <span className="block text-xs font-bold text-slate-200 truncate normal-case">
                                {item.name}
                              </span>
                              <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
                                {formatBytes(item.size)} • {new Date(item.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          
                          {item.downloadUrl && (
                            <a
                              href={item.downloadUrl}
                              download={item.name}
                              className="px-3.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/20 text-xs font-bold rounded-lg transition self-center flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                            >
                              Download Save
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Dashboard footer */}
        <footer className="p-5 border-t border-slate-855 text-center text-[11px] text-slate-500 bg-slate-900 flex justify-between items-center sm:flex-row flex-col gap-2">
          <div className="flex items-center gap-1 font-semibold text-slate-400">
            <span>© PDFMAX Inc.</span>
            <span>- Client-side browser execution</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-350 select-none">No Paid APIs</span>
            <span className="hover:text-slate-350 select-none">No Watermarks</span>
            <span className="hover:text-slate-350 select-none">No Size Limits</span>
          </div>
        </footer>
      </main>

      {/* COMMAND CONSOLE SEARCH BAR */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelectTool={(id) => {
          setActiveToolId(id);
          setDroppedFile(null);
        }}
      />

      {/* FLOATING DIRECT DOWNLOAD ASSISTANT BANNER */}
      {latestCompiled && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 bg-slate-900 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl z-50 animate-bounce-short text-left transition duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2.5 items-center">
              <div className="p-2 bg-emerald-950/80 text-emerald-400 border border-emerald-900 rounded-xl flex-shrink-0 animate-pulse">
                <Check size={18} />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-mono font-bold tracking-widest text-emerald-400">
                  Document Ready!
                </span>
                <span className="block text-xs font-bold text-slate-100 truncate mt-0.5 normal-case" title={latestCompiled.name}>
                  {latestCompiled.name}
                </span>
                <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                  Size: {formatBytes(latestCompiled.size)}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setLatestCompiled(null)}
              className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded-md transition"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3.5 flex gap-2">
            <a
              href={latestCompiled.downloadUrl}
              download={latestCompiled.name}
              className="flex-1 py-2 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/30 transition flex items-center justify-center gap-2"
              title="Download direct to local machine"
            >
              <Download size={14} />
              <span>Download Final PDF</span>
            </a>
            <button
              onClick={() => setLatestCompiled(null)}
              className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition border border-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
