import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Layers, Trash2, RotateCw, Copy, CheckCircle, Download, 
  RefreshCw, AlertCircle, Plus, ChevronLeft, ChevronRight, Scissors, 
  FileText, PlusCircle, CheckSquare, Square, Undo, ArrowRight, CornerDownRight,
  Sparkles, FileUp, HelpCircle
} from 'lucide-react';
import { getPdfPageCount, renderPdfPageToDataUrl, formatBytes } from '../../utils/pdf';
import { PDFDocument, degrees } from 'pdf-lib';
import { useToast } from '../Toast';


interface OrganizeToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

interface OrganizePageItem {
  id: string;              // Unique identifier for rendering and DnD mapping
  type: 'pdf' | 'blank';   // Whether it's a real PDF page or a blank white page
  angle: number;           // Rotation degree: 0, 90, 180, 270
  isSelected: boolean;     // Selection badge state
  thumbnailUrl?: string;   // Page thumbnail data URL (rendered via PDF.js)
  sourceFileId: string;    // 'primary' or secondary imported ID
  originalPageIndex: number; // 0-based index of original source PDF
  sourceFileName: string;  // For visual tracking / badges
}

export default function OrganizeTool({ onSuccess }: OrganizeToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [pages, setPages] = useState<OrganizePageItem[]>([]);
  const [sourcePdfs, setSourcePdfs] = useState<Record<string, Uint8Array>>({});
  
  // Loading and processing UI flags
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // Compiled results
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  // Drag and Drop state references
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Hidden references for imports
  const importInputRef = useRef<HTMLInputElement>(null);

  // Initial primary PDF upload parsing
  useEffect(() => {
    if (!file) return;
    loadPdfPages();
  }, [file]);

  // Clean output blob urls on page/tool updates
  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [outputUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const fileItem = e.target.files[0];
    const arrayBuffer = await fileItem.arrayBuffer();
    const primaryBytes = new Uint8Array(arrayBuffer);

    setFile({
      name: fileItem.name,
      size: fileItem.size,
      bytes: primaryBytes,
    });
    
    // Seed initial primary source
    setSourcePdfs({
      'primary': primaryBytes
    });
    
    setOutputUrl(null);
    setLastClickedIndex(null);
  };

  const loadPdfPages = async () => {
    if (!file) return;
    setIsLoadingPages(true);
    try {
      const pageCount = await getPdfPageCount(file.bytes);
      const initialPages: OrganizePageItem[] = [];
      
      for (let i = 0; i < pageCount; i++) {
        initialPages.push({
          id: `primary-page-${i}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'pdf',
          angle: 0,
          isSelected: false,
          sourceFileId: 'primary',
          originalPageIndex: i,
          sourceFileName: file.name
        });
      }
      setPages(initialPages);

      // Render crisp thumbnails asynchronously
      for (let i = 0; i < pageCount; i++) {
        renderPdfPageToDataUrl(file.bytes, i + 1, 0.4)
          .then((thumbnailUrl) => {
            setPages((prev) =>
              prev.map((p) => (p.sourceFileId === 'primary' && p.originalPageIndex === i ? { ...p, thumbnailUrl } : p))
            );
          })
          .catch((err) => console.error('Thumbnail render error on page', i + 1, err));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error reading PDF structure: ' + err.message);
    } finally {
      setIsLoadingPages(false);
    }
  };

  // 1. Drag & Drop HTML5 Handlers for visual item reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    // Smooth custom drag image support
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setPages((prev) => {
      const updated = [...prev];
      const [draggedItem] = updated.splice(draggedIndex, 1);
      updated.splice(index, 0, draggedItem);
      return updated;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 2. Selection behavior with Shift & Ctrl keys mapping
  const handlePageSelect = (index: number, e: React.MouseEvent) => {
    // Avoid double clicks inside internal action buttons
    if ((e.target as HTMLElement).closest('button')) return;

    setPages((prev) => {
      let updated = [...prev];
      
      if (e.shiftKey && lastClickedIndex !== null) {
        // Shift select range
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        updated = updated.map((p, idx) => {
          if (idx >= start && idx <= end) {
            return { ...p, isSelected: true };
          }
          return p;
        });
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        updated[index] = { ...updated[index], isSelected: !updated[index].isSelected };
      } else {
        // Clean single selection
        updated = updated.map((p, idx) => ({
          ...p,
          isSelected: idx === index
        }));
      }
      return updated;
    });

    setLastClickedIndex(index);
  };

  const selectAllPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, isSelected: true })));
  };

  const selectNonePages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, isSelected: false })));
  };

  // 3. Page transform actions (individual and bulk)
  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, angle: (p.angle + 90) % 360 } : p))
    );
  };

  const rotateSelected = () => {
    setPages((prev) =>
      prev.map((p) => (p.isSelected ? { ...p, angle: (p.angle + 90) % 360 } : p))
    );
  };

  const duplicatePage = (index: number) => {
    setPages((prev) => {
      const source = prev[index];
      const cloned: OrganizePageItem = {
        ...source,
        id: `${source.id}-dup-${Math.random().toString(36).substring(2, 6)}`,
        isSelected: false,
      };
      const updated = [...prev];
      updated.splice(index + 1, 0, cloned);
      return updated;
    });
  };

  const duplicateSelected = () => {
    setPages((prev) => {
      const updated: OrganizePageItem[] = [];
      prev.forEach((p) => {
        updated.push(p);
        if (p.isSelected) {
          updated.push({
            ...p,
            id: `${p.id}-dup-${Math.random().toString(36).substring(2, 6)}`,
            isSelected: false,
          });
        }
      });
      return updated;
    });
  };

  const deletePage = (index: number) => {
    setPages((prev) => prev.filter((_, idx) => idx !== index));
    if (lastClickedIndex === index) setLastClickedIndex(null);
  };

  const deleteSelected = () => {
    setPages((prev) => prev.filter((p) => !p.isSelected));
    setLastClickedIndex(null);
  };

  // 4. Add blank letter page spacer
  const addBlankPage = () => {
    setPages((prev) => [
      ...prev,
      {
        id: `blank-page-${Math.random().toString(36).substring(2, 8)}`,
        type: 'blank',
        angle: 0,
        isSelected: false,
        sourceFileId: 'none',
        originalPageIndex: -1,
        sourceFileName: 'Blank Spacer'
      }
    ]);
  };

  // 5. Import pages from second uploaded document
  const handleImportPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsImporting(true);
    try {
      const importFile = e.target.files[0];
      const arrayBuffer = await importFile.arrayBuffer();
      const importBytes = new Uint8Array(arrayBuffer);

      const importId = `import-${Math.random().toString(36).substring(2, 8)}`;
      
      // Save second document buffer to dict
      setSourcePdfs((prev) => ({
        ...prev,
        [importId]: importBytes,
      }));

      const pageCount = await getPdfPageCount(importBytes);
      const newImportedPages: OrganizePageItem[] = [];

      for (let i = 0; i < pageCount; i++) {
        newImportedPages.push({
          id: `import-page-${importId}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'pdf',
          angle: 0,
          isSelected: false,
          sourceFileId: importId,
          originalPageIndex: i,
          sourceFileName: importFile.name
        });
      }

      setPages((prev) => [...prev, ...newImportedPages]);

      // Process second document thumbnails async
      for (let i = 0; i < pageCount; i++) {
        renderPdfPageToDataUrl(importBytes, i + 1, 0.4)
          .then((thumbnailUrl) => {
            setPages((prev) =>
              prev.map((p) => (p.sourceFileId === importId && p.originalPageIndex === i ? { ...p, thumbnailUrl } : p))
            );
          })
          .catch((err) => console.error('Imported Thumbnail render error:', err));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error importing secondary PDF pages: ' + err.message);
    } finally {
      setIsImporting(false);
      // Clean target
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  // 6. Extract selected pages standalone downloader
  const extractSelectedPages = async () => {
    const selected = pages.filter((p) => p.isSelected);
    if (selected.length === 0) {
      toast.warn('Please select at least one page to extract!');
      return;
    }
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const op of selected) {
        if (op.type === 'blank') {
          // Add default A4 blank slot
          const blankPage = pdfDoc.addPage([595.27, 841.89]);
          if (op.angle !== 0) {
            blankPage.setRotation(degrees(op.angle));
          }
        } else {
          const sourceBytes = sourcePdfs[op.sourceFileId];
          if (!sourceBytes) throw new Error('Reference source document byte buffer missing.');
          const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
          const copied = await pdfDoc.copyPages(sourcePdf, [op.originalPageIndex]);
          const page = copied[0];

          if (op.angle !== 0) {
            // Retain any native parent rotation
            const baseRot = page.getRotation().angle;
            page.setRotation(degrees((baseRot + op.angle) % 360));
          }
          pdfDoc.addPage(page);
        }
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const extractUrl = URL.createObjectURL(blob);
      const extractName = `${file?.name.replace(/\.pdf$/i, '') || 'docs'}_extracted.pdf`;

      // Trigger automatic extraction file download
      const link = document.createElement('a');
      link.href = extractUrl;
      link.download = extractName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(extractUrl);
    } catch (err: any) {
      console.error(err);
      toast.error('Error generating extracted pages layout: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Compile fully modified PDFDocument matrix reordering
  const triggerOrganize = async () => {
    if (!file || pages.length === 0) {
      toast.warn('Your layout contains no pages. Try inserting or duplicating!');
      return;
    }
    
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const op of pages) {
        if (op.type === 'blank') {
          const blankPage = pdfDoc.addPage([595.27, 841.89]);
          if (op.angle !== 0) {
            blankPage.setRotation(degrees(op.angle));
          }
        } else {
          const sourceBytes = sourcePdfs[op.sourceFileId];
          if (!sourceBytes) continue;
          const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
          const copied = await pdfDoc.copyPages(sourcePdf, [op.originalPageIndex]);
          const page = copied[0];

          if (op.angle !== 0) {
            const baseRot = page.getRotation().angle;
            page.setRotation(degrees((baseRot + op.angle) % 360));
          }
          pdfDoc.addPage(page);
        }
      }

      const outputBytes = await pdfDoc.save();
      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const finalUrl = URL.createObjectURL(blob);
      const name = `${file.name.replace(/\.pdf$/i, '')}_organized.pdf`;

      setOutputUrl(finalUrl);
      setOutputSize(outputBytes.length);
      setOutputName(name);

      onSuccess(name, outputBytes.length, outputBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Error building structural PDF reorganization: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPages([]);
    setSourcePdfs({});
    setOutputUrl(null);
    setLastClickedIndex(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const selectedCount = pages.filter((p) => p.isSelected).length;

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-10 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="organize-uploader"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition shadow-lg">
              <Layers size={36} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a document to structure & reorder pages, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                Drag to sort pages, duplicate slides, extract layouts, inject empty spacers, or mix pages by importing secondary files.
              </p>
            </div>
          </div>
        </div>
      ) : !outputUrl ? (
        <div className="space-y-4 animate-fade-in text-left">
          
          {/* Real-time Interactive Control Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            
            {/* Top Row File status tracking */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="text-indigo-400 flex-shrink-0" size={18} />
                <div className="text-xs">
                  <span className="text-slate-400">Primary matrix: </span>
                  <span className="text-slate-200 font-semibold">{file.name}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({formatBytes(file.size)})</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>Total sheets: </span>
                <span className="text-indigo-400 font-bold">{pages.length}</span>
              </div>
            </div>

            {/* Middle Action Controls Block */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              
              {/* Select shortcuts */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAllPages}
                  className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-slate-200 text-[11px] font-semibold rounded transition"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={selectNonePages}
                  className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-350 text-[11px] font-semibold rounded transition"
                >
                  Deselect All
                </button>
              </div>

              {/* Manipulation controls (bulk operations) */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Insert blank page buffer */}
                <button
                  type="button"
                  onClick={addBlankPage}
                  className="px-3 py-1.5 bg-indigo-950/45 hover:bg-indigo-900/40 border border-indigo-900/50 text-indigo-400 text-xs rounded-lg flex items-center gap-1.5 transition font-semibold"
                >
                  <PlusCircle size={13} />
                  Add Blank Page
                </button>

                {/* Import PDF tool file uploader */}
                <label className="px-3 py-1.5 bg-emerald-950/45 hover:bg-emerald-900/40 border border-emerald-900/50 text-emerald-400 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition select-none font-semibold">
                  {isImporting ? (
                    <RefreshCw className="animate-spin text-emerald-400" size={13} />
                  ) : (
                    <FileUp size={13} />
                  )}
                  Import PDF Pages
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleImportPdfChange}
                    className="hidden"
                    disabled={isImporting}
                  />
                </label>

                <div className="h-4 w-[1px] bg-slate-800 hidden sm:block"></div>

                {/* Bulk tools for selection */}
                {selectedCount > 0 ? (
                  <div className="flex items-center gap-1.5 bg-indigo-950/20 border border-indigo-900/30 p-1 rounded-lg animate-fade-in">
                    <span className="text-[10px] text-indigo-400 font-bold px-1.5 py-0.5 uppercase font-mono tracking-wider">
                      Selected ({selectedCount})
                    </span>
                    <button
                      type="button"
                      onClick={rotateSelected}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] rounded transition flex items-center gap-1"
                      title="Rotate all selection 90°"
                    >
                      <RotateCw size={11} />
                      Rotate
                    </button>
                    <button
                      type="button"
                      onClick={duplicateSelected}
                      className="px-2.5 py-1 bg-slate-805 hover:bg-slate-750 text-slate-200 text-[11px] rounded transition flex items-center gap-1"
                      title="Duplicate all selection"
                    >
                      <Copy size={11} />
                      Clone
                    </button>
                    <button
                      type="button"
                      onClick={extractSelectedPages}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded transition flex items-center gap-1"
                      title="Extract only highlighted sheets"
                    >
                      <Scissors size={11} />
                      Extract
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelected}
                      className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 text-[11px] rounded transition flex items-center gap-1"
                      title="Delete all selected"
                    >
                      <Trash2 size={11} />
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic hidden md:flex items-center gap-1">
                    <HelpCircle size={13} />
                    Ctrl-click or Shift-click thumbnails for batch tools
                  </div>
                )}
              </div>

              {/* Compile and Save button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerOrganize}
                  disabled={isProcessing || pages.length === 0}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition shadow"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="animate-spin" size={13} />
                      Sealing document matrix...
                    </>
                  ) : (
                    <>Save & Export PDF</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-350 text-xs rounded-lg transition"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>

          {/* Quick interactive hint line */}
          <p className="text-[10px] text-slate-550 font-mono italic">
            💡 Drag & drop page cards to reorder sheets. Click a checkbox or card to multiselect. Blank spacers will print as empty white sheets.
          </p>

          {/* Main Thumbnails Workspace Grid */}
          {isLoadingPages ? (
            <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="animate-spin text-indigo-400" size={36} />
              <p className="text-sm font-semibold">Generating visual page matrices & rendering vector thumbnails...</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-800 bg-slate-900/10 rounded-xl space-y-2">
              <Layers className="text-slate-700 mx-auto" size={40} />
              <p className="text-xs text-slate-500 font-medium">No pages left in the workspace document. Click "Import" or "Add Blank Page" above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 p-4 bg-slate-950 border border-slate-850 rounded-xl max-h-[65vh] overflow-y-auto">
              {pages.map((p, idx) => {
                const isDragTarget = dragOverIndex === idx;
                
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handlePageSelect(idx, e)}
                    className={`group relative aspect-[3/4.1] bg-slate-900 border-2 rounded-xl transition-all duration-200 cursor-grab active:cursor-grabbing select-none flex flex-col justify-between overflow-hidden ${
                      p.isSelected 
                        ? 'border-indigo-550 ring-2 ring-indigo-500/25 bg-slate-850/80 shadow-indigo-950/50' 
                        : 'border-slate-800 hover:border-slate-700 hover:shadow-lg'
                    } ${draggedIndex === idx ? 'opacity-35 border-dashed border-indigo-400' : ''}`}
                  >
                    
                    {/* Visual Insertion Indicator Bars */}
                    {isDragTarget && draggedIndex !== null && (
                      <div className={`absolute top-0 bottom-0 w-2.5 bg-indigo-500 rounded z-30 shadow animate-pulse ${
                        draggedIndex < idx ? 'right-0' : 'left-0'
                      }`} />
                    )}

                    {/* Page card Header: Checkbox selection overlay and badge */}
                    <div className="absolute top-2 left-2 z-10 flex gap-1.5 items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPages((prev) =>
                            prev.map((item, itemIdx) =>
                              itemIdx === idx ? { ...item, isSelected: !item.isSelected } : item
                            )
                          );
                        }}
                        className={`p-0.5 rounded transition ${
                          p.isSelected ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-350'
                        }`}
                      >
                        {p.isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>

                      {p.type === 'blank' && (
                        <span className="px-1.5 py-0.5 bg-indigo-950/90 text-indigo-400 border border-indigo-900 text-[8px] font-bold uppercase rounded font-sans tracking-wide">
                          Blank Page
                        </span>
                      )}
                      
                      {p.sourceFileId !== 'primary' && p.type === 'pdf' && (
                        <span 
                          className="px-1.5 py-0.5 bg-emerald-950/90 text-emerald-400 border border-emerald-900 text-[8px] font-bold uppercase rounded font-sans tracking-wide truncate max-w-[70px]"
                          title={p.sourceFileName}
                        >
                          Imported
                        </span>
                      )}
                    </div>

                    {/* Hover controls action panel overlay */}
                    <div className="absolute inset-x-0 bottom-10 top-8 bg-slate-950/80 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotatePage(idx);
                        }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition shadow"
                        title="Rotate 90 degrees"
                      >
                        <RotateCw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePage(idx);
                        }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition shadow"
                        title="Duplicate page"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePage(idx);
                        }}
                        className="p-2 bg-red-950/90 hover:bg-red-900 text-red-200 rounded-lg transition shadow border border-red-900/30"
                        title="Delete page"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Page Thumbnail canvas preview display */}
                    <div className="flex-1 flex items-center justify-center bg-white/95 p-3 overflow-hidden relative">
                      {p.type === 'blank' ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 h-full w-full border border-dashed border-slate-250 bg-slate-50 rounded">
                          <FileText size={24} className="stroke-1 text-slate-350" />
                          <span className="text-[10px] font-mono text-slate-400 mt-1 uppercase font-semibold">Empty Space</span>
                        </div>
                      ) : p.thumbnailUrl ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-white">
                          <img
                            src={p.thumbnailUrl}
                            alt={`Slide preview sheet ${idx + 1}`}
                            style={{ transform: `scale(0.95) rotate(${p.angle}deg)` }}
                            className="max-h-full max-w-full object-contain pointer-events-none select-none transition-transform duration-200 p-0.5 bg-white"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <RefreshCw className="animate-spin text-slate-300 stroke-1" size={18} />
                          <span className="text-[9px] text-slate-400 mt-1.5">Rasterizing...</span>
                        </div>
                      )}
                    </div>

                    {/* Page card footer info band */}
                    <div className="bg-slate-950 border-t border-slate-850 px-2.5 py-1.5 flex items-center justify-between text-[10px] select-none text-slate-400 z-10 font-mono">
                      <div className="font-semibold text-slate-300">
                        Nº {idx + 1}
                      </div>
                      {p.type === 'pdf' && (
                        <div className="text-[9px] text-slate-500 font-sans truncate max-w-[85px]" title={p.sourceFileName}>
                          {p.sourceFileName}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* OUTPUT RESULTS REPORT BLOCK */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-5 shadow-xl animate-fade-in max-w-lg mx-auto">
          <div className="flex justify-center">
            <div className="p-3.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-850 shadow-inner">
              <CheckCircle size={32} />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Document Structure Saved!</h3>
            <p className="text-xs text-slate-500 mt-1">Pages have been reordered, cataloged, and exported into dynamic memory successfully.</p>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0 pr-4">
              <Layers className="text-indigo-400 flex-shrink-0" size={18} />
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-slate-200 truncate">{outputName}</p>
                <p className="text-[10px] text-slate-550 font-mono mt-0.5">{formatBytes(outputSize)}</p>
              </div>
            </div>
            <a
              href={outputUrl}
              download={outputName}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-1.5 flex-shrink-0"
            >
              <Download size={14} />
              Download
            </a>
          </div>

          <div className="pt-2">
            <button
              onClick={resetAll}
              className="text-xs text-indigo-400 hover:underline font-semibold transition"
            >
              Perform another structural organization
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
