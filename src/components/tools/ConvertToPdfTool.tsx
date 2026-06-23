import React, { useState } from 'react';
import { 
  Upload, FileImage, Trash2, ArrowUp, ArrowDown, CheckCircle, Download, 
  RefreshCw, FileText, FileCode, Play, Sparkles, BookOpen, Grid
} from 'lucide-react';
import { convertImagesToPdf, formatBytes } from '../../utils/pdf';
import { 
  convertMarkdownToPdf, convertHtmlToPdf, convertDocxToPdf, 
  convertXlsxToPdf, convertPptxToPdf 
} from '../../utils/converters';
import { useToast } from '../Toast';


interface ConvertToPdfToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
  defaultSourceExt?: 'docx' | 'xlsx' | 'pptx' | 'image' | 'html' | 'md';
}

interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  bytes?: Uint8Array;
  dataUrl?: string;
}

export default function ConvertToPdfTool({ onSuccess, defaultSourceExt }: ConvertToPdfToolProps) {
  const toast = useToast();
  const [items, setItems] = useState<UploadedFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successFile, setSuccessFile] = useState<{ name: string; size: number; url: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const loadedFiles = Array.from(e.target.files) as File[];
    
    for (const file of loadedFiles) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const reader = new FileReader();
      
      const p = new Promise<void>((resolve) => {
        reader.onload = async () => {
          const id = Math.random().toString();
          
          if (file.type.startsWith('image/')) {
            setItems((prev) => [
              ...prev,
              {
                id,
                name: file.name,
                size: file.size,
                type: file.type,
                extension: ext,
                dataUrl: reader.result as string,
              }
            ]);
            resolve();
          } else {
            const arrayBuffer = reader.result as ArrayBuffer;
            setItems((prev) => [
              ...prev,
              {
                id,
                name: file.name,
                size: file.size,
                type: file.type,
                extension: ext,
                bytes: new Uint8Array(arrayBuffer)
              }
            ]);
            resolve();
          }
        };
      });

      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
      await p;
    }
    setSuccessFile(null);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setItems(updated);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const triggerConvert = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    try {
      let pdfBytes = new Uint8Array();
      const firstItem = items[0];
      const multipleImages = items.every(itm => itm.type.startsWith('image/'));

      if (multipleImages) {
        // High fidelity image compilation (JPG/PNG -> PDF)
        const imageItems = items.map(itm => ({
          id: itm.id,
          name: itm.name,
          size: itm.size,
          dataUrl: itm.dataUrl || ''
        }));
        pdfBytes = await convertImagesToPdf(imageItems);
      } else {
        // Individual file parsers based on extension
        const decoder = new TextDecoder('utf-8');
        switch (firstItem.extension) {
          case '.md':
          case '.markdown': {
            const rawMdText = firstItem.bytes ? decoder.decode(firstItem.bytes) : 'Markdown document outline.';
            pdfBytes = await convertMarkdownToPdf(rawMdText, firstItem.name);
            break;
          }
          case '.html': {
            const rawHtmlText = firstItem.bytes ? decoder.decode(firstItem.bytes) : '<h1>HTML document outline.</h1>';
            pdfBytes = await convertHtmlToPdf(rawHtmlText, firstItem.name);
            break;
          }
          case '.txt': {
            const rawTxtStr = firstItem.bytes ? decoder.decode(firstItem.bytes) : '';
            const sections = rawTxtStr.split('\n\n').map((para, idx) => ({
              heading: idx === 0 ? 'Document Content' : undefined,
              paragraph: para
            }));
            pdfBytes = await convertMarkdownToPdf(rawTxtStr, firstItem.name);
            break;
          }
          case '.docx':
          case '.doc': {
            if (firstItem.bytes) {
              pdfBytes = await convertDocxToPdf(firstItem.bytes, firstItem.name);
            }
            break;
          }
          case '.xlsx':
          case '.xls':
          case '.csv': {
            if (firstItem.bytes) {
              pdfBytes = await convertXlsxToPdf(firstItem.bytes, firstItem.name);
            }
            break;
          }
          case '.pptx':
          case '.ppt': {
            if (firstItem.bytes) {
              pdfBytes = await convertPptxToPdf(firstItem.bytes, firstItem.name);
            }
            break;
          }
          default:
            throw new Error(`Unsupported converter target file layout format: ${firstItem.extension}`);
        }
      }

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const outputName = `${firstItem.name.replace(/\.[^/.]+$/, "")}_converted_${Date.now()}.pdf`;

      setSuccessFile({
        name: outputName,
        size: pdfBytes.length,
        url,
      });

      onSuccess(outputName, pdfBytes.length, pdfBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Error compiling file to PDF layout: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getFileIcon = (ext: string) => {
    switch (ext) {
      case '.docx':
      case '.doc':
        return <FileText className="text-blue-400" size={18} />;
      case '.xlsx':
      case '.xls':
      case '.csv':
        return <Grid className="text-emerald-400" size={18} />;
      case '.pptx':
      case '.ppt':
        return <BookOpen className="text-orange-400" size={18} />;
      case '.html':
        return <FileCode className="text-cyan-400" size={18} />;
      case '.md':
      case '.markdown':
        return <Sparkles className="text-purple-400" size={18} />;
      default:
        return <FileImage className="text-pink-400" size={18} />;
    }
  };

  const resetAll = () => {
    setItems([]);
    setSuccessFile(null);
  };

  const config = defaultSourceExt ? {
    docx: { accept: ".docx,.doc", label: "Drag & drop Word files here, or ", formats: "Supports Word documents (.docx, .doc)" },
    xlsx: { accept: ".xlsx,.xls,.csv", label: "Drag & drop Excel or CSV files here, or ", formats: "Supports spreadsheets and data ledgers (.xlsx, .csv)" },
    pptx: { accept: ".pptx,.ppt", label: "Drag & drop PowerPoint slides here, or ", formats: "Supports presentation slide decks (.pptx, .ppt)" },
    image: { accept: "image/*", label: "Drag & drop graphics and screenshots here, or ", formats: "Supports PNG, JPG, and raw image layouts" },
    html: { accept: ".html,.htm", label: "Drag & drop HTML documents here, or ", formats: "Supports Webpages and HTML structures (.html)" },
    md: { accept: ".md,.markdown,.txt", label: "Drag & drop Markdown files here, or ", formats: "Supports Markdown (.md) and Plain Text layouts (.txt)" }
  }[defaultSourceExt] : {
    accept: "image/*,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.html,.md,.txt,.csv",
    label: "Drag & drop office/layout documents here, or ",
    formats: "Supports Word (.docx), Excel (.xlsx), PowerPoint (.pptx), Images, Webpages, Plain Text & Markdown."
  };

  return (
    <div className="space-y-6">
      {!successFile ? (
        <>
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
            <input
              id="doc-converter-uploader"
              type="file"
              multiple
              accept={config.accept}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
                <Upload size={32} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {config.label}<span className="text-indigo-400 hover:underline">browse files</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {config.formats}
                </p>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg animate-fade-in text-left">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                  Files queued for PDF Compilation ({items.length})
                </span>
                <span className="text-indigo-400 font-mono">
                  Combined Size: {formatBytes(items.reduce((acc, c) => acc + c.size, 0))}
                </span>
              </div>

              <div className="p-3.5 space-y-2 max-h-[35vh] overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-lg flex items-center justify-between text-xs transition">
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                        {getFileIcon(item.extension)}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-slate-200 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
                          Format: {item.extension.replace('.', '')} • {formatBytes(item.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveItem(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 hover:bg-slate-850 rounded text-slate-400 disabled:opacity-25"
                          title="Move Up"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => moveItem(idx, 'down')}
                          disabled={idx === items.length - 1}
                          className="p-1.5 hover:bg-slate-850 rounded text-slate-400 disabled:opacity-25"
                          title="Move Down"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1.5 text-red-500 hover:text-red-400 hover:bg-slate-850 rounded transition"
                        title="Remove file"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between gap-4 items-center">
                <button
                  onClick={resetAll}
                  className="px-4 py-2 border border-slate-850 text-slate-400 hover:text-slate-250 hover:bg-slate-850 rounded-lg text-xs font-semibold"
                >
                  Clear Queue
                </button>
                <button
                  onClick={triggerConvert}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="animate-spin" size={13} />
                      Compiling PDF Layout...
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      Compile Documents to PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* CONFIGURED SUCCESS */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4 shadow-xl animate-fade-in text-left">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <div className="flex gap-2.5 items-center">
              <div className="p-1.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-900">
                <CheckCircle size={16} />
              </div>
              <div>
                <span className="block font-semibold text-slate-100 text-xs">PDF Rendered Successfully!</span>
                <span className="text-[10px] text-slate-500">All graphics & segments compiled to standard vector margins.</span>
              </div>
            </div>

            <button
              onClick={resetAll}
              className="text-xs text-indigo-450 hover:underline font-semibold"
            >
              Compile other formats
            </button>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-slate-900 border border-slate-800 text-indigo-400 rounded-xl">
                <FileImage size={22} />
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-slate-200 truncate pr-4">{successFile.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Size: {formatBytes(successFile.size)}
                </p>
              </div>
            </div>
            <a
              href={successFile.url}
              download={successFile.name}
              className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Save Final PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
