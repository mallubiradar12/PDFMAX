import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Scissors, Plus, Trash2, FileText, CheckCircle, Download, 
  RefreshCw, AlertTriangle, ChevronRight, LayoutGrid, List, Check,
  Sparkles, FileDown, Layers, CheckSquare, X, Info, Settings, Loader2
} from 'lucide-react';
import { splitPdfFile, getPdfPageCount, formatBytes, renderPdfPageToDataUrl } from '../../utils/pdf';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { useToast } from '../Toast';


interface SplitToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

interface SplitRange {
  start: number;
  end: number;
}

interface PageThumbnailProps {
  bytes: Uint8Array;
  pageNumber: number;
}

// Lazy loaded page thumbnail component to save memory and CPU
function PageThumbnail({ bytes, pageNumber }: PageThumbnailProps) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    
    renderPdfPageToDataUrl(bytes, pageNumber, 0.45)
      .then((dataUrl) => {
        if (active) {
          setUrl(dataUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Split - Thumbnail render error:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [bytes, pageNumber]);

  if (loading) {
    return (
      <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-2 text-[10px] text-slate-500 font-mono">
        <Loader2 className="animate-spin text-indigo-400 mb-1" size={12} />
        Rendering...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-slate-950 flex items-center justify-center text-[10px] text-red-400 font-mono text-center p-2">
        Preview Error
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`Page ${pageNumber}`}
      referrerPolicy="no-referrer"
      className="w-full h-full object-contain pointer-events-none select-none"
    />
  );
}

export default function SplitTool({ onSuccess }: SplitToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  
  // Modes: 
  // 'ranges' = custom ranges list
  // 'every-n' = split every N pages
  // 'all-pages' = individual page extracts
  // 'interactive-cuts' = click-to-cut boundary markings between pages
  // 'selection' = toggle check specific pages to extract
  const [splitMode, setSplitMode] = useState<'ranges' | 'every-n' | 'all-pages' | 'interactive-cuts' | 'selection'>('ranges');
  
  const [ranges, setRanges] = useState<SplitRange[]>([{ start: 1, end: 1 }]);
  const [everyN, setEveryN] = useState<number>(2);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [cutPoints, setCutPoints] = useState<Set<number>>(new Set()); // list of pages AFTER which to cut

  // Selection outcome strategy: 'combine' = build 1 PDF containing chosen, 'separate' = extract each separately
  const [selectionExtractType, setSelectionExtractType] = useState<'combine' | 'separate'>('combine');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [processStep, setProcessStep] = useState<string>('');
  
  // Output configuration state
  const [results, setResults] = useState<{ filename: string; bytes: Uint8Array; url: string }[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [zipFilename, setZipFilename] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      getPdfPageCount(file.bytes).then((count) => {
        setTotalPages(count);
        setRanges([{ start: 1, end: count }]);
        setSelectedPages(new Set([1])); // default selection is first page
        setCutPoints(new Set()); // empty cut points initially
      });
    }
  }, [file]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const fileItem = e.target.files[0];
    const arrayBuffer = await fileItem.arrayBuffer();
    setFile({
      name: fileItem.name,
      size: fileItem.size,
      bytes: new Uint8Array(arrayBuffer),
    });
    setResults([]);
    setZipUrl(null);
  };

  const addRange = () => {
    const lastRange = ranges[ranges.length - 1];
    const nextStart = lastRange ? Math.min(totalPages, lastRange.end + 1) : 1;
    setRanges((prev) => [...prev, { start: nextStart, end: totalPages }]);
  };

  const removeRange = (idx: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRange = (idx: number, field: 'start' | 'end', val: number) => {
    const updated = [...ranges];
    const sanitizedVal = Math.max(1, Math.min(totalPages, val));
    updated[idx][field] = sanitizedVal;
    setRanges(updated);
  };

  // Helper toggle for page selection
  const togglePageSelection = (pgNum: number) => {
    const updated = new Set(selectedPages);
    if (updated.has(pgNum)) {
      updated.delete(pgNum);
    } else {
      updated.add(pgNum);
    }
    setSelectedPages(updated);
  };

  const selectAllPages = () => {
    const updated = new Set<number>();
    for (let i = 1; i <= totalPages; i++) {
      updated.add(i);
    }
    setSelectedPages(updated);
  };

  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  // Helper toggle for cut points
  const toggleCutPoint = (pgNumAfter: number) => {
    const updated = new Set(cutPoints);
    if (updated.has(pgNumAfter)) {
      updated.delete(pgNumAfter);
    } else {
      updated.add(pgNumAfter);
    }
    setCutPoints(updated);
  };

  // Turn cut points into readable active ranges
  const getRangesFromCutPoints = (): SplitRange[] => {
    const pointsList: number[] = [];
    cutPoints.forEach((p) => {
      if (typeof p === 'number') pointsList.push(p);
    });
    const sortedCuts = pointsList.filter(c => c >= 1 && c < totalPages).sort((a, b) => a - b);
    const result: SplitRange[] = [];
    let currentStart = 1;
    
    sortedCuts.forEach((cut) => {
      result.push({ start: currentStart, end: cut });
      currentStart = cut + 1;
    });
    result.push({ start: currentStart, end: totalPages });
    return result;
  };

  // Turn Every N into ranges
  const getRangesFromEveryN = (): SplitRange[] => {
    const result: SplitRange[] = [];
    const step = Math.max(1, everyN);
    for (let i = 1; i <= totalPages; i += step) {
      result.push({ start: i, end: Math.min(totalPages, i + step - 1) });
    }
    return result;
  };

  // Master execution logic
  const triggerSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgressPercent(10);
    setProcessStep('Parsing PDF Structure...');

    try {
      let finalWorkingRanges: SplitRange[] = [];
      const cleanFilenamePrefix = file.name.replace(/\.pdf$/i, '');

      if (splitMode === 'all-pages') {
        for (let i = 1; i <= totalPages; i++) {
          finalWorkingRanges.push({ start: i, end: i });
        }
      } else if (splitMode === 'every-n') {
        finalWorkingRanges = getRangesFromEveryN();
      } else if (splitMode === 'interactive-cuts') {
        finalWorkingRanges = getRangesFromCutPoints();
      } else if (splitMode === 'ranges') {
        // Safe filters on input ranges
        finalWorkingRanges = ranges.filter(r => r.start <= r.end);
        if (finalWorkingRanges.length === 0) {
          toast.warn('No valid split ranges found.');
          setIsProcessing(false);
          return;
        }
      } else if (splitMode === 'selection') {
        const pagesList: number[] = [];
        selectedPages.forEach((p) => {
          if (typeof p === 'number') pagesList.push(p);
        });
        const sortedSelected = pagesList.sort((a, b) => a - b);
        if (sortedSelected.length === 0) {
          toast.warn('Please select at least 1 page to extract.');
          setIsProcessing(false);
          return;
        }
        
        if (selectionExtractType === 'combine') {
          // Compile all selected pages into exactly one single PDF file
          setProcessStep('Opening source document bytes...');
          setProgressPercent(30);
          const originalPdf = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
          const newPdf = await PDFDocument.create();
          
          setProcessStep(`Assembling ${sortedSelected.length} chosen pages...`);
          setProgressPercent(60);
          const indicesToCopy = sortedSelected.map(p => p - 1);
          const copiedPages = await newPdf.copyPages(originalPdf, indicesToCopy);
          copiedPages.forEach((pg) => newPdf.addPage(pg));

          const compiledBytes = await newPdf.save();
          const compiledBlob = new Blob([compiledBytes], { type: 'application/pdf' });
          const outName = `${cleanFilenamePrefix}_extracted_subset.pdf`;
          
          setResults([{
            filename: outName,
            bytes: compiledBytes,
            url: URL.createObjectURL(compiledBlob)
          }]);
          
          // Clear ZIP elements for singular result
          setZipUrl(null);
          onSuccess(outName, compiledBytes.length, compiledBytes);
          setProgressPercent(100);
          setIsProcessing(false);
          return;
        } else {
          // Treat each selection as its own standalone single page PDF
          finalWorkingRanges = sortedSelected.map(p => ({ start: p, end: p }));
        }
      }

      // If we got here, we are performing standard multi-part splitting
      setProcessStep(`Splitting into ${finalWorkingRanges.length} segments...`);
      setProgressPercent(40);

      // Perform split operations using our existing helper
      const pdfParts = await splitPdfFile(file.bytes, finalWorkingRanges);
      
      const parsedResults = pdfParts.map((part, index) => {
        const currentRange = finalWorkingRanges[index];
        const rangeStr = currentRange.start === currentRange.end 
          ? `Page_${currentRange.start}` 
          : `Pages_${currentRange.start}_to_${currentRange.end}`;
          
        const customizedName = `${cleanFilenamePrefix}_part_${index + 1}_(${rangeStr}).pdf`;
        const blob = new Blob([part.bytes], { type: 'application/pdf' });
        
        return {
          filename: customizedName,
          bytes: part.bytes,
          url: URL.createObjectURL(blob)
        };
      });

      setResults(parsedResults);

      // Create ZIP Archive if multi-file output is requested (zero server uploads)
      if (parsedResults.length > 1) {
        setProcessStep('Compressing outputs into browser ZIP archive...');
        setProgressPercent(80);
        
        const zip = new JSZip();
        parsedResults.forEach((item) => {
          zip.file(item.filename, item.bytes);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const archiveName = `${cleanFilenamePrefix}_split_sections.zip`;
        
        setZipUrl(URL.createObjectURL(zipBlob));
        setZipFilename(archiveName);

        // Success callbacks with zip payload
        const dummyBuffer = new Uint8Array(await zipBlob.arrayBuffer());
        onSuccess(archiveName, dummyBuffer.length, dummyBuffer);
      } else if (parsedResults.length === 1) {
        setZipUrl(null);
        onSuccess(parsedResults[0].filename, parsedResults[0].bytes.length, parsedResults[0].bytes);
      }

      setProgressPercent(100);
      setProcessStep('Successfully divided workspace segments.');
    } catch (err: any) {
      console.error(err);
      toast.error('Error splitting PDF file: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSplit = () => {
    setFile(null);
    setTotalPages(0);
    setRanges([{ start: 1, end: 1 }]);
    setSelectedPages(new Set());
    setCutPoints(new Set());
    setResults([]);
    setZipUrl(null);
  };

  // Helper arrays for visual lines
  const computedGroupRanges = splitMode === 'every-n' 
    ? getRangesFromEveryN() 
    : splitMode === 'interactive-cuts' 
      ? getRangesFromCutPoints() 
      : null;

  return (
    <div className="space-y-6">
      {!file ? (
        /* DROPZONE LOADER */
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="split-uploader"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
            ref={fileInputRef}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <Scissors size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a PDF file to split, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Accepts any raw PDF document. Handles massive documents up to 500MB+ locally.</p>
            </div>
          </div>
        </div>
      ) : results.length === 0 ? (
        /* SETUP SPLIT SETTINGS CONTAINER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-left">
          
          {/* LEFT SIDEBAR CONTROLS (5 cols on large screens) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* FILE SPECIFICATION BOX */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center shadow-md">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <div className="p-2 bg-indigo-950 text-indigo-400 rounded-lg">
                  <FileText size={20} />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-200 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {formatBytes(file.size)} • {totalPages} Pages
                  </p>
                </div>
              </div>

              <button
                onClick={resetSplit}
                className="p-1 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded text-[10px] font-semibold transition flex-shrink-0"
              >
                Change
              </button>
            </div>

            {/* CONTROL MODE CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow" id="split-mode-controls">
              <div>
                <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider font-mono">
                  Extraction Settings
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Choose how to partition this file</p>
              </div>

              {/* Range Mode buttons list */}
              <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-850">
                <button
                  onClick={() => setSplitMode('ranges')}
                  className={`px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition ${
                    splitMode === 'ranges' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>1. Split by page range</span>
                  <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono">Custom</span>
                </button>
                <button
                  onClick={() => setSplitMode('every-n')}
                  className={`px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition ${
                    splitMode === 'every-n' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 Whitespace'
                  }`}
                >
                  <span>2. Split every N pages</span>
                  <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-indigo-305 font-mono">N-Chops</span>
                </button>
                <button
                  onClick={() => setSplitMode('all-pages')}
                  className={`px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition ${
                    splitMode === 'all-pages' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>3. Extract all into individual pages</span>
                  <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono">ZIP Output</span>
                </button>
                <button
                  onClick={() => setSplitMode('interactive-cuts')}
                  className={`px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition ${
                    splitMode === 'interactive-cuts' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>4. Visual Split Boundaries</span>
                  <span className="text-[9px] bg-indigo-950 border border-indigo-900/30 px-1.5 py-0.5 rounded text-indigo-400 font-mono">Scissor Cuts</span>
                </button>
                <button
                  onClick={() => setSplitMode('selection')}
                  className={`px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition ${
                    splitMode === 'selection' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>5. Select specific pages to extract</span>
                  <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono">Flexible</span>
                </button>
              </div>

              {/* MODE CONFIG INTERFACES */}
              <div className="border-t border-slate-850 pt-4 space-y-3.5">
                {splitMode === 'ranges' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-405 font-bold uppercase tracking-wider font-mono">
                      <span>Interactive range bounds</span>
                    </div>

                    <div className="space-y-2.5 max-h-[25vh] overflow-y-auto pr-1">
                      {ranges.map((range, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 border border-slate-850 rounded-lg">
                          <span className="text-[10px] font-mono text-slate-500 w-5 text-center">#{idx + 1}</span>
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input
                              type="number"
                              min="1"
                              max={totalPages}
                              value={range.start}
                              onChange={(e) => updateRange(idx, 'start', parseInt(e.target.value) || 1)}
                              className="w-full bg-slate-905 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded px-2 py-1 text-xs text-slate-200 font-mono text-center"
                              title="Start page"
                            />
                            <span className="text-[10px] text-slate-500 font-mono">to</span>
                            <input
                              type="number"
                              min="1"
                              max={totalPages}
                              value={range.end}
                              onChange={(e) => updateRange(idx, 'end', parseInt(e.target.value) || 1)}
                              className="w-full bg-slate-905 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded px-2 py-1 text-xs text-slate-200 font-mono text-center"
                              title="End page"
                            />
                          </div>
                          <button
                            onClick={() => removeRange(idx)}
                            disabled={ranges.length === 1}
                            className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-25 transition"
                            title="Delete range segment"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addRange}
                      className="w-full py-2 border border-dashed border-slate-800 hover:border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 transition"
                    >
                      <Plus size={13} />
                      Add custom segment range
                    </button>
                  </div>
                )}

                {splitMode === 'every-n' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400">
                      Partition continuous PDF every:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={everyN}
                        onChange={(e) => setEveryN(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-24 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-slate-200 font-mono text-center"
                      />
                      <span className="text-xs text-slate-400 font-semibold">pages.</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1.5">
                      This splits the PDF sequentially. If you input {everyN} pages on a {totalPages}-page document, we will build{' '}
                      <strong>{Math.ceil(totalPages / everyN)} discrete PDFs</strong> as output targets.
                    </p>
                  </div>
                )}

                {splitMode === 'all-pages' && (
                  <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-lg text-slate-400 text-xs flex items-start gap-2 max-w-lg">
                    <Info className="text-indigo-400 flex-shrink-0 mt-0.5" size={14} />
                    <p>
                      <strong>Individual Extracts:</strong> Generates exactly <strong>{totalPages} single-page documents</strong>. Because client web engines download files individually, they will be bundled into a <strong>single .zip archive</strong>.
                    </p>
                  </div>
                )}

                {splitMode === 'interactive-cuts' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-lg text-slate-400 flex items-start gap-2">
                      <Scissors className="text-indigo-400 flex-shrink-0 mt-0.5" size={14} />
                      <div>
                        <strong className="text-slate-200 block mb-0.5">Click-to-Cut Boundaries:</strong>
                        Rearrange cuts by hovering over gaps between page thumbnails in the grid on the right, and clicking the scissor icon.
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[11px]">
                      <span className="text-slate-500">Active Cuts:</span>
                      <span className="text-indigo-305 font-bold">{cutPoints.size} custom split lines</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[11px]">
                      <span className="text-slate-500">Partitions output:</span>
                      <span className="text-emerald-400 font-bold">{getRangesFromCutPoints().length} PDF files</span>
                    </div>
                  </div>
                )}

                {splitMode === 'selection' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={selectAllPages}
                        className="py-1.5 bg-slate-850 hover:bg-slate-800 text-[10px] font-semibold rounded text-slate-300"
                      >
                        Select all
                      </button>
                      <button
                        onClick={deselectAllPages}
                        className="py-1.5 bg-slate-850 hover:bg-slate-800 text-[10px] font-semibold rounded text-slate-300"
                      >
                        Clear select
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-400">
                        Compile outcome strategy:
                      </label>
                      <div className="flex border border-slate-850 bg-slate-950 p-1 rounded-lg">
                        <button
                          onClick={() => setSelectionExtractType('combine')}
                          className={`flex-1 py-1 text-[10px] font-semibold rounded transition ${
                            selectionExtractType === 'combine' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Combine into 1 PDF
                        </button>
                        <button
                          onClick={() => setSelectionExtractType('separate')}
                          className={`flex-1 py-1 text-[10px] font-semibold rounded transition ${
                            selectionExtractType === 'separate' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Extract as separate files
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 font-mono text-[10px] text-slate-400 flex justify-between">
                      <span>Total Checked:</span>
                      <strong className="text-indigo-400">{selectedPages.size} / {totalPages} Pages</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Master Process Button */}
              <button
                onClick={triggerSplit}
                disabled={isProcessing || (splitMode === 'selection' && selectedPages.size === 0)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 disabled:text-slate-500 text-white text-xs font-bold rounded-lg shadow-lg hover:shadow-indigo-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Extracting & Compiling...
                  </>
                ) : (
                  <>
                    <Scissors size={14} />
                    Execute Split Operation
                  </>
                )}
              </button>
            </div>

          </div>

          {/* RIGHT INTERACTIVE GRID VIEW CANVAS (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xl min-h-[50vh]">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-slate-350 tracking-wide inline-flex items-center gap-1.5">
                    <LayoutGrid size={13} className="text-indigo-400" />
                    Interactive PDF Canvas Viewer
                  </h3>
                  <p className="text-[10px] text-slate-500">Live pages layout mapped from current loaded file.</p>
                </div>
                
                {/* Active split representation info */}
                <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 px-2.5 border border-slate-850 rounded">
                  {splitMode === 'ranges' && `Custom range groups: ${ranges.length}`}
                  {splitMode === 'every-n' && `N-Cuts defined: ${computedGroupRanges?.length}`}
                  {splitMode === 'all-pages' && `Single pages extract: ${totalPages}`}
                  {splitMode === 'interactive-cuts' && `Boundary cutsets: ${computedGroupRanges?.length}`}
                  {splitMode === 'selection' && `Custom extraction selection`}
                </div>
              </div>

              {/* THUMBNAIL LAYOUTS GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[55vh] overflow-y-auto p-2 border border-slate-850 rounded-xl bg-slate-950/60 scrollbar-thin pr-1 pb-4">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pgNum = i + 1;
                  const isChecked = selectedPages.has(pgNum);
                  
                  // Detect ranges visual style highlighting
                  let rangeIndex = -1;
                  let colorClass = 'border-slate-800 hover:border-slate-700 bg-slate-950';

                  if (splitMode === 'ranges') {
                    // check if page lies inside any specified ranges
                    rangeIndex = ranges.findIndex(r => pgNum >= r.start && pgNum <= r.end);
                  } else if (computedGroupRanges) {
                    rangeIndex = computedGroupRanges.findIndex(r => pgNum >= r.start && pgNum <= r.end);
                  }

                  if (splitMode === 'selection') {
                    if (isChecked) {
                      colorClass = 'border-indigo-500 bg-indigo-950/15 shadow-indigo-950/50 shadow-md ring-1 ring-indigo-500/20';
                    } else {
                      colorClass = 'border-slate-800 opacity-60 bg-slate-950';
                    }
                  } else if (rangeIndex !== -1) {
                    const colorSchemes = [
                      'border-indigo-600/80 bg-indigo-950/10 hover:border-indigo-500 ring-1 ring-indigo-500/10',
                      'border-emerald-600/80 bg-emerald-950/10 hover:border-emerald-500 ring-1 ring-emerald-500/10',
                      'border-amber-600/80 bg-amber-950/10 hover:border-amber-500 ring-1 ring-amber-500/10',
                      'border-pink-600/80 bg-pink-950/10 hover:border-pink-500 ring-1 ring-pink-500/10',
                      'border-cyan-600/80 bg-cyan-950/10 hover:border-cyan-500 ring-1 ring-cyan-500/10',
                    ];
                    colorClass = colorSchemes[rangeIndex % colorSchemes.length];
                  }

                  const hasScissorCutAfter = cutPoints.has(pgNum) && splitMode === 'interactive-cuts';

                  return (
                    <React.Fragment key={pgNum}>
                      {/* CARD */}
                      <div
                        onClick={() => {
                          if (splitMode === 'selection') {
                            togglePageSelection(pgNum);
                          }
                        }}
                        className={`p-1.5 border rounded-lg transition-all duration-200 select-none flex flex-col justify-between aspect-[3/4] relative group/card ${colorClass} ${
                          splitMode === 'selection' ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        {/* Page Counter Label */}
                        <div className="absolute top-2 left-2 z-10 bg-slate-900/90 backdrop-blur-xs border border-slate-750 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-slate-300">
                          {pgNum}
                        </div>

                        {/* Right Top Status Icon overlay */}
                        {splitMode === 'selection' && (
                          <div className={`absolute top-2 right-2 z-10 p-0.5 rounded border transition-colors ${
                            isChecked ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-transparent'
                          }`}>
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}

                        {splitMode !== 'selection' && rangeIndex !== -1 && (
                          <div className="absolute top-2 right-2 z-10 bg-slate-900/90 border border-slate-750 text-[8px] font-semibold px-2 py-0.5 rounded text-slate-450 font-mono">
                            Part {rangeIndex + 1}
                          </div>
                        )}

                        {/* Rendering core vector */}
                        <div className="flex-grow flex items-center justify-center bg-slate-950 border border-slate-900 rounded overflow-hidden aspect-[3/4] relative">
                          <PageThumbnail bytes={file.bytes} pageNumber={pgNum} />
                        </div>

                        <div className="pt-1.5 text-left text-[9px] font-semibold text-slate-400 flex justify-between items-center px-0.5">
                          <span>Page {pgNum}</span>
                          <span className="text-[8px] font-mono text-slate-505 bg-slate-900 outline-1 outline-slate-800 px-1 rounded uppercase">PDF PG</span>
                        </div>
                      </div>

                      {/* Gaps / Split point insertion layer */}
                      {splitMode === 'interactive-cuts' && pgNum < totalPages && (
                        <div className="col-span-2 md:col-span-4 h-5 flex items-center justify-center relative my-0.5 group/gap">
                          {/* visual dashed lines representing cuts */}
                          <div className={`w-full border-t border-dashed transition-all duration-300 ${
                            hasScissorCutAfter ? 'border-red-500 border-2' : 'border-slate-800 group-hover/gap:border-indigo-500'
                          }`}></div>
                          
                          <button
                            onClick={() => toggleCutPoint(pgNum)}
                            className={`absolute px-4 py-1.5 rounded-full text-[9px] font-bold flex items-center gap-1 shadow-lg transition-all border ${
                              hasScissorCutAfter 
                                ? 'bg-red-650 hover:bg-red-600 border-red-500 text-white scale-102' 
                                : 'bg-slate-900 hover:bg-indigo-600 border-slate-755 hover:border-indigo-400 text-slate-400 hover:text-white opacity-20 group-hover/gap:opacity-100'
                            }`}
                          >
                            <Scissors size={10} className={hasScissorCutAfter ? 'rotate-90 text-white' : ''} />
                            {hasScissorCutAfter ? '✂️ Page Split Line active' : 'Click to Split here'}
                          </button>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Instruction footnote footer */}
            <div className="mt-4 pt-3.5 border-t border-slate-850 flex items-start gap-2.5 text-[10px] text-slate-500 leading-normal bg-slate-950/20 p-2.5 rounded-lg">
              <Sparkles className="text-slate-500 flex-shrink-0 mt-0.5" size={13} />
              <div>
                <strong>Sandbox Security Assurance:</strong> Document disassembly and rendering operations execute entirely within local browser sandboxes via WebAssembly layers. Files are never uploaded, keeping your proprietary documents completely private.
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* OUTPUT DOWNLOAD CENTER VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-2xl animate-fade-in text-left">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-850 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-990 border border-emerald-900 text-emerald-400 rounded-xl">
                <CheckCircle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">PDF Split Completed Successfully!</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Generated {results.length} segment documents in browser buffers.
                </p>
              </div>
            </div>

            <button
              onClick={resetSplit}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 bg-indigo-950/40 p-2 border border-indigo-900/30 rounded-lg hover:bg-indigo-900/20 transition self-start sm:self-center"
            >
              <RefreshCw size={13} />
              Split another document
            </button>
          </div>

          {/* ONE-CLICK BRING ZIP DOWNLOAD OPTION FOR MULTI FILES */}
          {zipUrl && (
            <div className="p-4 bg-indigo-950/20 border border-indigo-900/30 hover:border-indigo-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 transition">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 bg-indigo-900/40 text-indigo-300 rounded-xl border border-indigo-800/40">
                  <FileDown size={24} />
                </div>
                <div className="truncate text-left">
                  <p className="text-xs font-bold text-slate-205 truncate">Download All parts as ZIP Bundle</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{zipFilename}</p>
                </div>
              </div>

              <a
                href={zipUrl}
                download={zipFilename}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 hover:scale-101 hover:shadow-lg hover:shadow-emerald-600/10 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Download size={14} />
                Download Zip Bundle
              </a>
            </div>
          )}

          {/* Slices Parts List downloads index */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-450 font-mono pl-0.5">
              Individual Segment Parts ({results.length})
            </h4>
            
            <div className="border border-slate-850 rounded-xl divide-y divide-slate-850/80 bg-slate-950 overflow-hidden max-h-[35vh] overflow-y-auto">
              {results.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3.5 hover:bg-slate-900/30 transition flex-wrap sm:flex-nowrap gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 bg-slate-900 border border-slate-800 text-indigo-400 rounded-lg text-xs font-bold font-mono w-7 text-center">
                      {idx + 1}
                    </div>
                    <div className="truncate text-left pr-2">
                      <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-400 transition">
                        {item.filename}
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>Size: {formatBytes(item.bytes.length)}</span>
                        <span className="text-slate-700">•</span>
                        <span>Vector extracted stream</span>
                      </p>
                    </div>
                  </div>

                  <a
                    href={item.url}
                    download={item.filename}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-indigo-600 border border-slate-800 hover:border-indigo-400 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Download size={12} />
                    Download PDF
                  </a>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Advanced Inline progress details */}
      {isProcessing && (
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3.5 shadow-lg max-w-lg mx-auto animate-pulse">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-405 flex items-center gap-2">
              <RefreshCw className="animate-spin text-indigo-500" size={14} />
              {processStep}
            </span>
            <span className="font-mono text-xs font-bold text-slate-300">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-550 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      )}

    </div>
  );
}
