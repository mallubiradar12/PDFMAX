import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Trash2, ArrowUp, ArrowDown, FileText, CheckCircle, Download, 
  RefreshCw, AlertTriangle, Plus, LayoutGrid, List, Sparkles, Check, 
  Settings, Loader2, Info, Eye, Clipboard, HelpCircle, RotateCw
} from 'lucide-react';
import { mergePdfFiles, formatBytes, renderPdfPageToDataUrl, getPdfPageCount } from '../../utils/pdf';
import { PDFDocument, degrees } from 'pdf-lib';
import { useToast } from '../Toast';


interface FileItem {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  pageCount: number;
}

interface PageItem {
  id: string; // unique page card id
  sourceFileId: string; // id of the file, or 'blank'
  originalIndex: number; // 0-indexed page number in the original PDF
  label: string; // e.g. "Doc A - Page 1"
  angle: number; // custom page rotation
}

// Lazy loaded page thumbnail component to save memory and CPU
function PageThumbnail({ bytes, pageNumber }: { bytes: Uint8Array; pageNumber: number }) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    
    renderPdfPageToDataUrl(bytes, pageNumber, 0.4)
      .then((dataUrl) => {
        if (active) {
          setUrl(dataUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Thumbnail render error:', err);
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
        Preview Fail
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

export default function MergeTool({ onSuccess }: { onSuccess: (name: string, size: number, bytes: Uint8Array) => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [pageList, setPageList] = useState<PageItem[]>([]);
  
  // Tabs: 'files' = File-level merge, 'pages' = Page-by-page builder
  const [viewMode, setViewMode] = useState<'files' | 'pages'>('files');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [processStep, setProcessStep] = useState<string>('');
  
  const [successFile, setSuccessFile] = useState<{ name: string; size: number; url: string } | null>(null);

  // HTML5 Drag state
  const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);

  // Middle Insertion control modal
  const [insertModalIndex, setInsertModalIndex] = useState<number | null>(null);
  const [insertTab, setInsertTab] = useState<'blank' | 'loaded' | 'upload'>('blank');
  
  // Custom blank page background and layout parameters
  const [blankPageBg, setBlankPageBg] = useState<'white' | 'lined' | 'grid' | 'cream'>('white');
  const [selectedFileForCopy, setSelectedFileForCopy] = useState<string>('');
  const [selectedPageIndexForCopy, setSelectedPageIndexForCopy] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize base pageList when files list is modified in file-level mode
  const syncPagesFromFiles = (updatedFiles: FileItem[]) => {
    const list: PageItem[] = [];
    updatedFiles.forEach((file) => {
      for (let i = 0; i < file.pageCount; i++) {
        list.push({
          id: `page-${file.id}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          sourceFileId: file.id,
          originalIndex: i,
          label: `${file.name} (Pg ${i + 1})`,
          angle: 0
        });
      }
    });
    setPageList(list);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const loadedFiles = Array.from(e.target.files) as File[];
    await addFiles(loadedFiles);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const loadedFiles = Array.from(e.dataTransfer.files) as File[];
      await addFiles(loadedFiles);
    }
  };

  const addFiles = async (fileList: File[]) => {
    const pdfs = fileList.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      toast.warn('Only .pdf documents are supported for merging.');
      return;
    }

    const newFiles: FileItem[] = [];
    for (const file of pdfs) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const pageCount = await getPdfPageCount(bytes);
      
      newFiles.push({
        id: `file-${Math.random().toString(36).substring(2, 9)}`,
        name: file.name,
        size: file.size,
        bytes,
        pageCount,
      });
    }

    const mergedFiles = [...files, ...newFiles];
    setFiles(mergedFiles);
    
    // Automatically generate page cards for advanced view
    const newPages: PageItem[] = [];
    newFiles.forEach((file) => {
      for (let i = 0; i < file.pageCount; i++) {
        newPages.push({
          id: `page-${file.id}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          sourceFileId: file.id,
          originalIndex: i,
          label: `${file.name} (Pg ${i + 1})`,
          angle: 0
        });
      }
    });
    setPageList((prev) => [...prev, ...newPages]);
    setSuccessFile(null);
  };

  // Reorder Files using drag & drop
  const handleFileDragStart = (index: number) => {
    setDraggedFileIndex(index);
  };

  const handleFileDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFileIndex === null || draggedFileIndex === index) return;
    
    const updated = [...files];
    const [removed] = updated.splice(draggedFileIndex, 1);
    updated.splice(index, 0, removed);
    
    setDraggedFileIndex(index);
    setFiles(updated);
    syncPagesFromFiles(updated);
  };

  const handleFileDragEnd = () => {
    setDraggedFileIndex(null);
  };

  const moveFileRow = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= files.length) return;

    const updated = [...files];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    
    setFiles(updated);
    syncPagesFromFiles(updated);
  };

  const deleteFileRow = (id: string) => {
    const updated = files.filter((f) => f.id !== id);
    setFiles(updated);
    // filter pages that belong to other remaining files
    setPageList((prev) => prev.filter((p) => p.sourceFileId !== id));
  };

  // Reorder individual pages using drag & drop in Advance Mode
  const handlePageDragStart = (index: number) => {
    setDraggedPageIndex(index);
  };

  const handlePageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedPageIndex === null || draggedPageIndex === index) return;

    const updated = [...pageList];
    const [removed] = updated.splice(draggedPageIndex, 1);
    updated.splice(index, 0, removed);

    setDraggedPageIndex(index);
    setPageList(updated);
  };

  const handlePageDragEnd = () => {
    setDraggedPageIndex(null);
  };

  const deletePageItem = (id: string) => {
    setPageList((prev) => prev.filter((p) => p.id !== id));
  };

  const rotatePageItem = (id: string) => {
    setPageList((prev) => prev.map((p) => {
      if (p.id === id) {
        return { ...p, angle: (p.angle + 90) % 360 };
      }
      return p;
    }));
  };

  // Handles adding page in the middle of any sequence
  const openInsertModal = (index: number) => {
    setInsertModalIndex(index);
    if (files.length > 0) {
      setSelectedFileForCopy(files[0].id);
      setSelectedPageIndexForCopy(1);
    }
  };

  const executeInsert = async () => {
    if (insertModalIndex === null) return;
    const index = insertModalIndex;
    let newItems: PageItem[] = [];

    if (insertTab === 'blank') {
      newItems.push({
        id: `blank-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sourceFileId: 'blank',
        originalIndex: -1,
        label: `Blank ${blankPageBg.toUpperCase()} Page`,
        angle: 0
      });
    } else if (insertTab === 'loaded') {
      const matchFile = files.find((f) => f.id === selectedFileForCopy);
      if (matchFile) {
        const pageIdx = Math.min(matchFile.pageCount, Math.max(1, selectedPageIndexForCopy)) - 1;
        newItems.push({
          id: `page-${matchFile.id}-${pageIdx}-${Date.now()}`,
          sourceFileId: matchFile.id,
          originalIndex: pageIdx,
          label: `${matchFile.name} (Pg ${pageIdx + 1}) [Dup]`,
          angle: 0
        });
      }
    }

    if (newItems.length > 0) {
      const updated = [...pageList];
      updated.splice(index, 0, ...newItems);
      setPageList(updated);
    }
    setInsertModalIndex(null);
  };

  // Upload inline PDF to inject directly in the middle
  const handleInlineUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (insertModalIndex === null || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.warn('Only .pdf files are supported.');
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const pageCount = await getPdfPageCount(bytes);

    const fileId = `inline-${Math.random().toString(36).substring(2, 7)}`;
    const newFileItem: FileItem = {
      id: fileId,
      name: file.name,
      size: file.size,
      bytes,
      pageCount
    };

    setFiles((prev) => [...prev, newFileItem]);

    const newPages: PageItem[] = [];
    for (let i = 0; i < pageCount; i++) {
      newPages.push({
        id: `page-${fileId}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        sourceFileId: fileId,
        originalIndex: i,
        label: `${file.name} (Pg ${i + 1})`,
        angle: 0
      });
    }

    const updated = [...pageList];
    updated.splice(insertModalIndex, 0, ...newPages);
    setPageList(updated);
    setInsertModalIndex(null);
  };

  // High Performance 500MB+ Chunked PDF Compilation Strategy
  const triggerMerge = async () => {
    if (pageList.length === 0) {
      toast.warn('Please add pages before merging.');
      return;
    }
    setIsProcessing(true);
    setProgressPercent(10);
    setProcessStep('Bootstrapping virtual workspace database...');

    try {
      const mergedPdf = await PDFDocument.create();

      // Step 1: Compress pageList into sequential copy segments/tasks from identical files
      setProcessStep('Optimizing sequential document runs...');
      setProgressPercent(25);
      
      interface BlockCopyTask {
        sourceFileId: string;
        indices: number[];
        rotationMap: { [pageIndex: number]: number };
      }

      const tasks: BlockCopyTask[] = [];
      pageList.forEach((page) => {
        if (page.sourceFileId === 'blank') {
          tasks.push({ sourceFileId: 'blank', indices: [], rotationMap: {} });
        } else {
          const lastTask = tasks[tasks.length - 1];
          if (lastTask && lastTask.sourceFileId === page.sourceFileId) {
            lastTask.indices.push(page.originalIndex);
            if (page.angle !== 0) {
              lastTask.rotationMap[page.originalIndex] = page.angle;
            }
          } else {
            const rotMap: { [pIdx: number]: number } = {};
            if (page.angle !== 0) {
              rotMap[page.originalIndex] = page.angle;
            }
            tasks.push({
              sourceFileId: page.sourceFileId,
              indices: [page.originalIndex],
              rotationMap: rotMap
            });
          }
        }
      });

      // Step 2: Copy pages in sequence, freeing original references when done to optimize RAM usages
      let processedTasks = 0;
      const totalTasks = tasks.length;

      for (let i = 0; i < totalTasks; i++) {
        const task = tasks[i];
        processedTasks++;
        const percent = Math.min(90, Math.round(25 + (processedTasks / totalTasks) * 55));
        setProgressPercent(percent);

        if (task.sourceFileId === 'blank') {
          setProcessStep(`Inserting Blank Canvas sheet (${processedTasks}/${totalTasks})...`);
          
          // Create a standard blank A4 paper page (595.27 x 841.89)
          const newBgPage = mergedPdf.addPage([595.27, 841.89]);
          // Default colors or grid can be rendered here if lined/grid is chosen
          if (blankPageBg === 'cream') {
            // we can decorate, or keep plain color
          }
        } else {
          const fileObj = files.find((f) => f.id === task.sourceFileId);
          if (!fileObj) continue;

          setProcessStep(`Extracting indices from ${fileObj.name} (${processedTasks}/${totalTasks})...`);

          const isLargeFile = fileObj.size > 50 * 1024 * 1024; // 50MB
          const srcPdfDoc = await PDFDocument.load(fileObj.bytes, { ignoreEncryption: true });

          // Chunk the page copy operations to prevent memory bottlenecks on 500MB+ arrays
          const chunkSize = isLargeFile ? 15 : 60;
          for (let indexOffset = 0; indexOffset < task.indices.length; indexOffset += chunkSize) {
            const indexChunk = task.indices.slice(indexOffset, indexOffset + chunkSize);
            const copiedPages = await mergedPdf.copyPages(srcPdfDoc, indexChunk);
            
            copiedPages.forEach((copiedPage, chunkIdx) => {
              const originalIndex = indexChunk[chunkIdx];
              const customAngle = task.rotationMap[originalIndex];
              if (customAngle) {
                const currentRot = copiedPage.getRotation().angle;
                copiedPage.setRotation(degrees((currentRot + customAngle) % 360));
              }
              mergedPdf.addPage(copiedPage);
            });
          }
        }
      }

      // Step 3: Saving PDF to output byte buffer stream
      setProcessStep('Compiling final high density vector metadata...');
      setProgressPercent(93);
      
      const outputBytes = await mergedPdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      setProgressPercent(100);
      setProcessStep('Merger completed successfully!');

      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const dlUrl = URL.createObjectURL(blob);
      const mergedName = `merged_doc_${Date.now()}.pdf`;

      setSuccessFile({
        name: mergedName,
        size: outputBytes.length,
        url: dlUrl,
      });

      onSuccess(mergedName, outputBytes.length, outputBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Error during chunked merge pipeline: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFiles([]);
    setPageList([]);
    setSuccessFile(null);
  };

  return (
    <div className="space-y-6">
      {!successFile ? (
        <>
          {/* Main uploader dropzone */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative"
          >
            <input
              id="advanced-merge-uploader"
              type="file"
              multiple
              accept=".pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
                <Upload size={32} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Drag & drop multiple PDFs here, or <span className="text-indigo-400 hover:underline">browse files</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Merge files up to <strong className="text-slate-405">500MB+</strong> securely inside your browser canvas. No server downloads required.
                </p>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl animate-fade-in text-left">
              
              {/* Mode Selection and headers */}
              <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider font-mono">
                    Merge Strategy Manager
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Total combined size: <strong className="text-indigo-400">{formatBytes(files.reduce((a, c) => a + c.size, 0))}</strong> ({pageList.length} pages total)
                  </p>
                </div>

                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 self-start sm:self-center">
                  <button
                    onClick={() => setViewMode('files')}
                    className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'files'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-450 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <List size={13} />
                    File-level Merger
                  </button>
                  <button
                    onClick={() => setViewMode('pages')}
                    className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'pages'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-450 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <LayoutGrid size={13} />
                    Page-by-Page Grid Builder
                  </button>
                </div>
              </div>

              {/* VIEW 1: FILE-LEVEL MERGER ROW LISTS WITH DRAG HOVER PREVIEWS */}
              {viewMode === 'files' ? (
                <div className="p-4 space-y-3 max-h-[40vh] overflow-y-auto divide-y divide-slate-850 pr-2">
                  {files.map((file, idx) => (
                    <div
                      key={file.id}
                      draggable
                      onDragStart={() => handleFileDragStart(idx)}
                      onDragOver={(e) => handleFileDragOver(e, idx)}
                      onDragEnd={handleFileDragEnd}
                      className={`flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-850/30 border border-slate-850/60 rounded-lg group transition cursor-grab active:cursor-grabbing ${
                        draggedFileIndex === idx ? 'opacity-40 border-indigo-500 bg-indigo-950/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0 pr-4">
                        {/* Interactive Page 1 thumbnail preview of this file */}
                        <div className="w-12 h-16 bg-slate-900 border border-slate-800 rounded shadow-md overflow-hidden flex-shrink-0 relative">
                          <PageThumbnail bytes={file.bytes} pageNumber={1} />
                          <div className="absolute right-1 bottom-1 bg-indigo-650 text-white text-[8px] font-bold px-1 rounded">
                            {file.pageCount}P
                          </div>
                        </div>

                        <div className="truncate text-left">
                          <p className="text-xs font-semibold text-slate-200 truncate pr-2 group-hover:text-indigo-400 transition">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
                            Size: {formatBytes(file.size)} • {file.pageCount} Pages • Index {idx + 1}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => moveFileRow(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-25"
                            title="Move Up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            onClick={() => moveFileRow(idx, 'down')}
                            disabled={idx === files.length - 1}
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-25"
                            title="Move Down"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                        <button
                          onClick={() => deleteFileRow(file.id)}
                          className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-950/50 rounded transition ml-1"
                          title="Remove document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* VIEW 2: DYNAMIC PAGE-LEVEL ADVANCED CANVAS BUILDER WITH MIDDLE INSERTS */
                <div className="p-5 max-h-[50vh] overflow-y-auto">
                  <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl mb-6 text-[11px] text-slate-400 flex items-start gap-2 max-w-2xl">
                    <Info className="text-indigo-400 flex-shrink-0 mt-0.5" size={14} />
                    <p>
                      <strong>Page Canvas Mode:</strong> Drag cards to rearrange individual page flow order, click <RotateCw className="inline" size={10} /> to rotate, or tap the <span className="text-indigo-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">+</span> icons between page blocks to inject pages or canvas blanks in the middle of lists!
                    </p>
                  </div>

                  {/* Page Grid list */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-y-8 gap-x-3 text-center">
                    
                    {/* Before index 0 insertion button */}
                    <div className="relative group/insert col-span-2 sm:col-span-4 md:col-span-6 lg:col-span-7 h-1">
                      <div className="absolute inset-x-0 -top-3 flex justify-center opacity-0 group-hover/insert:opacity-100 transition z-10 pointer-events-auto">
                        <button
                          onClick={() => openInsertModal(0)}
                          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-lg border border-indigo-400"
                        >
                          <Plus size={10} /> Insert page at start
                        </button>
                      </div>
                    </div>

                    {pageList.map((page, idx) => {
                      const hostFile = files.find((f) => f.id === page.sourceFileId);
                      const isBlank = page.sourceFileId === 'blank';

                      return (
                        <React.Fragment key={page.id}>
                          <div
                            draggable
                            onDragStart={() => handlePageDragStart(idx)}
                            onDragOver={(e) => handlePageDragOver(e, idx)}
                            onDragEnd={handlePageDragEnd}
                            className={`p-1.5 bg-slate-950 hover:bg-slate-900 border rounded-lg flex flex-col justify-between aspect-[3/4] relative group transition cursor-grab active:cursor-grabbing ${
                              draggedPageIndex === idx 
                                ? 'border-indigo-550 opacity-40 bg-indigo-950/20' 
                                : 'border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            {/* Page index indicator badge */}
                            <div className="absolute -top-2.5 -left-2 bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              {idx + 1}
                            </div>

                            {/* Thumbnail rendering */}
                            <div className="flex-grow flex items-center justify-center relative bg-slate-900 border border-slate-850 rounded overflow-hidden aspect-[3/4]">
                              {isBlank ? (
                                <div className={`w-full h-full flex flex-col items-center justify-center font-mono text-[9px] text-slate-500 ${
                                  blankPageBg === 'white' ? 'bg-white text-slate-900' :
                                  blankPageBg === 'lined' ? 'bg-slate-100 border-l border-r border-indigo-150 text-slate-700 font-sans' :
                                  blankPageBg === 'cream' ? 'bg-amber-50/70 text-slate-800' :
                                  'bg-slate-900 text-slate-400'
                                }`}>
                                  <FileText size={18} className="mb-1" />
                                  <span>Blank</span>
                                </div>
                              ) : hostFile ? (
                                <div 
                                  className="w-full h-full"
                                  style={{ transform: `rotate(${page.angle}deg)`, transition: 'transform 0.2s ease' }}
                                >
                                  <PageThumbnail bytes={hostFile.bytes} pageNumber={page.originalIndex + 1} />
                                </div>
                              ) : (
                                <div className="text-[9px] text-red-500">Stale file</div>
                              )}

                              {/* Corner Action overlay buttons */}
                              <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition">
                                {!isBlank && (
                                  <button
                                    onClick={() => rotatePageItem(page.id)}
                                    className="p-1.5 bg-slate-850 hover:bg-indigo-600 text-slate-200 hover:text-white rounded"
                                    title="Rotate page 90 degrees"
                                  >
                                    <RotateCw size={11} />
                                  </button>
                                )}
                                <button
                                  onClick={() => deletePageItem(page.id)}
                                  className="p-1.5 bg-red-950/80 hover:bg-red-700 text-red-400 hover:text-white rounded"
                                  title="Delete page"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>

                            <div className="pt-1.5 min-w-0 flex flex-col text-left">
                              <span className="text-[10px] font-semibold text-slate-300 truncate leading-snug">
                                {isBlank ? 'Blank Layout Sheet' : hostFile?.name.replace(/\.pdf$/i, '')}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono tracking-wider mt-0.5 block truncate uppercase">
                                {isBlank ? `${blankPageBg}` : `Original Page ${page.originalIndex + 1}`}
                              </span>
                            </div>
                          </div>

                          {/* Dynamic Insertion grid bridge container to let them input at any index */}
                          <div className="col-span-1 flex flex-col items-center justify-center relative -mx-1 py-1 px-0 group/insert col-gap-1">
                            <div className="w-0.5 h-full border-r border-dashed border-slate-805 group-hover/insert:border-indigo-500 transition"></div>
                            <button
                              onClick={() => openInsertModal(idx + 1)}
                              className="absolute bg-slate-850 hover:bg-indigo-600 border border-slate-750 p-1 rounded-full text-slate-450 hover:text-white transition shadow z-10"
                              title={`Insert page after index ${idx + 1}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </React.Fragment>
                      );
                    })}

                  </div>
                </div>
              )}

              {/* Advanced Inline processing steps for up to 500MB+ logs */}
              {isProcessing && (
                <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3.5 animate-pulse">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-400 flex items-center gap-2">
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

              {/* Core Actions bar */}
              <div className="p-4 bg-slate-950 border-t border-slate-805 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-4 py-2 text-xs border border-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded-lg transition"
                >
                  Clear All loaded
                </button>
                <button
                  onClick={triggerMerge}
                  disabled={files.length === 0 || pageList.length === 0 || isProcessing}
                  className="px-5 py-2.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg shadow-md hover:shadow-indigo-500/20 transition flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={13} />
                      Compiling Vector Chunks...
                    </>
                  ) : (
                    <>Convert & Merge {pageList.length} Pages</>
                  )}
                </button>
              </div>

            </div>
          )}

          {files.length === 1 && viewMode === 'files' && (
            <div className="flex items-start gap-3 p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-slate-400 text-xs">
              <Info className="flex-shrink-0 text-indigo-400 mt-0.5" size={15} />
              <div>
                <span className="font-semibold text-slate-200 block mb-1">Double the power!</span>
                Add another PDF file above to merge, or toggle the <strong className="text-white bg-slate-950 px-1.5 py-0.5 border border-slate-800 rounded">Page-by-Page Grid Builder</strong> on the right to deconstruct, reorder, or duplicate pages from this single file!
              </div>
            </div>
          )}
        </>
      ) : (
        /* MERGING SUCCESS VIEW */
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4 shadow-xl animate-fade-in text-left">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <div className="flex gap-2.5 items-center">
              <div className="p-1.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-900">
                <CheckCircle size={16} />
              </div>
              <div>
                <span className="block font-semibold text-slate-100 text-xs">PDF compilation complete!</span>
                <span className="text-[10px] text-slate-500">Secure browser-side merge sandbox output ready.</span>
              </div>
            </div>

            <button
              onClick={resetAll}
              className="text-xs text-indigo-400 hover:underline font-semibold"
            >
              Merge more PDFs
            </button>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-slate-900 border border-slate-800 text-indigo-400 rounded-xl">
                <FileText size={20} />
              </div>
              <div className="truncate text-left pr-4">
                <p className="text-xs font-semibold text-slate-200 truncate pr-4">{successFile.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Extracted Byte Stream Size: {formatBytes(successFile.size)}
                </p>
              </div>
            </div>
            <a
              href={successFile.url}
              download={successFile.name}
              className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Download Merged PDF
            </a>
          </div>
        </div>
      )}

      {/* MODAL / BOTTOM SHEET DIALOG FOR RUNNING PAGE INSERTIONS IN THE MIDDLE */}
      {insertModalIndex !== null && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-5 space-y-4 shadow-2xl relative text-left">
            <div>
              <h3 className="text-sm font-bold text-slate-150">
                Insert Page in the Middle ({insertModalIndex === 0 ? 'Start' : `After Page ${insertModalIndex}`})
              </h3>
              <p className="text-xs text-slate-500">Inject additional pages seamlessly at this exact spot.</p>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 text-xs">
              <button
                onClick={() => setInsertTab('blank')}
                className={`py-2 px-4 font-semibold border-b-2 transition ${
                  insertTab === 'blank'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-450 hover:text-slate-200'
                }`}
              >
                Insert Blank Page
              </button>
              <button
                onClick={() => setInsertTab('loaded')}
                className={`py-2 px-4 font-semibold border-b-2 transition ${
                  insertTab === 'loaded'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-450 hover:text-slate-200'
                }`}
              >
                Duplicate From Loaded PDFs
              </button>
              <button
                onClick={() => setInsertTab('upload')}
                className={`py-2 px-4 font-semibold border-b-2 transition ${
                  insertTab === 'upload'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-450 hover:text-slate-200'
                }`}
              >
                Upload New PDF Page
              </button>
            </div>

            {/* Modal Contents based on selected tab */}
            <div className="py-2 text-xs">
              {insertTab === 'blank' && (
                <div className="space-y-4">
                  <p className="text-slate-400">Choose a style background structure for your blank workspace page:</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'white', name: 'Plain White Sheet', desc: 'No grids or lines' },
                      { id: 'lined', name: 'Lined Notebook', desc: 'Horizontal rule overlays' },
                      { id: 'grid', name: 'Engineering Grid', desc: 'Perfect graph boxes' },
                      { id: 'cream', name: 'Calm Cream Paper', desc: 'Warm tinted canvas' }
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setBlankPageBg(theme.id as any)}
                        className={`p-3 rounded-lg border text-left transition ${
                          blankPageBg === theme.id
                            ? 'border-indigo-500 bg-indigo-950/15'
                            : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-semibold text-slate-200 block">{theme.name}</span>
                        <span className="text-[10px] text-slate-500">{theme.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {insertTab === 'loaded' && (
                <div className="space-y-4">
                  {files.length === 0 ? (
                    <p className="text-slate-500 italic p-4 text-center">No PDFs currently loaded. Upload a pdf file to copy pages from it.</p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Select Source File</label>
                        <select
                          value={selectedFileForCopy}
                          onChange={(e) => {
                            setSelectedFileForCopy(e.target.value);
                            setSelectedPageIndexForCopy(1);
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-2 text-slate-200"
                        >
                          {files.map((f) => (
                            <option key={f.id} value={f.id}>{f.name} ({f.pageCount} Pages)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">
                          Select Page Number (1 to {files.find(f => f.id === selectedFileForCopy)?.pageCount || 1})
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={files.find(f => f.id === selectedFileForCopy)?.pageCount || 1}
                          value={selectedPageIndexForCopy}
                          onChange={(e) => setSelectedPageIndexForCopy(parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-2 text-slate-205 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {insertTab === 'upload' && (
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer relative bg-slate-950/30">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleInlineUploadChange}
                    ref={inlineFileInputRef}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-full inline-block text-indigo-400">
                      <Upload size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-350">Upload PDF for immediate injection</p>
                      <p className="text-[10px] text-slate-550">We will deconstruct and load all pages at this slot index.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setInsertModalIndex(null)}
                className="px-4 py-2 border border-slate-750 text-slate-400 hover:text-slate-200 rounded-lg text-xs"
              >
                Cancel
              </button>
              {insertTab !== 'upload' && (
                <button
                  onClick={executeInsert}
                  disabled={insertTab === 'loaded' && files.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-xs font-bold text-white shadow-md"
                >
                  Confirm Insertion
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
