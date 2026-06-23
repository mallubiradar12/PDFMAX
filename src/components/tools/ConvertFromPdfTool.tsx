import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle, Download, RefreshCw, AlertCircle, 
  FileEdit, Grid, Presentation, Settings, Globe, FileCode, Check, BookOpen
} from 'lucide-react';
import { getPdfPageCount, renderPdfPageToDataUrl, formatBytes } from '../../utils/pdf';
import { 
  convertPdfToTxt, convertPdfToCsv, convertPdfToHtml, 
  convertPdfToDocx, convertPdfToXlsx, convertPdfToPptx, convertPdfToEpub 
} from '../../utils/converters';
import { useToast } from '../Toast';


interface ConvertFromPdfToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
  defaultFormat?: ExtractedFormat;
}

type ExtractedFormat = 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg' | 'html' | 'txt' | 'epub' | 'csv';

interface FormatOption {
  id: ExtractedFormat;
  name: string;
  extension: string;
  description: string;
  icon: React.ReactNode;
  category: 'document' | 'spreadsheet' | 'presentation' | 'image' | 'code';
}

export default function ConvertFromPdfTool({ onSuccess, defaultFormat }: ConvertFromPdfToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [targetFormat, setTargetFormat] = useState<ExtractedFormat>(defaultFormat || 'docx');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState<{ name: string; size: number; url: string; ext: string } | null>(null);
  const [extractedPages, setExtractedPages] = useState<{ pageNumber: number; dataUrl: string }[]>([]);

  // Update format if prop changes
  useEffect(() => {
    if (defaultFormat) {
      setTargetFormat(defaultFormat);
    }
  }, [defaultFormat]);

  const formats: FormatOption[] = [
    { 
      id: 'docx', 
      name: 'Word Document', 
      extension: '.docx', 
      description: 'Convert layout sentences & tables into Microsoft Word paragraphs.', 
      icon: <FileEdit className="text-blue-400" size={18} />,
      category: 'document'
    },
    { 
      id: 'xlsx', 
      name: 'Excel Spreadsheet', 
      extension: '.xlsx', 
      description: 'Extract multi-column cells directly to formatted Excel tables.', 
      icon: <Grid className="text-emerald-400" size={18} />,
      category: 'spreadsheet'
    },
    { 
      id: 'pptx', 
      name: 'PowerPoint Presentation', 
      extension: '.pptx', 
      description: 'Structure text chapters into 16:9 widescreen presentation slides.', 
      icon: <Presentation className="text-orange-400" size={18} />,
      category: 'presentation'
    },
    { 
      id: 'png', 
      name: 'PNG Images (Lossless)', 
      extension: '.png', 
      description: 'Convert document sheets to high resolution lossless PNG screenshots.', 
      icon: <Globe className="text-pink-400" size={18} />,
      category: 'image'
    },
    { 
      id: 'jpg', 
      name: 'JPEG Images (Compact)', 
      extension: '.jpg', 
      description: 'Compile compressed high-contrast photo sheets optimized for sharing.', 
      icon: <Globe className="text-purple-400" size={18} />,
      category: 'image'
    },
    { 
      id: 'html', 
      name: 'HTML Webpage', 
      extension: '.html', 
      description: 'Generate responsive, self-contained HTML structures styled with CSS.', 
      icon: <FileCode className="text-cyan-400" size={18} />,
      category: 'code'
    },
    { 
      id: 'txt', 
      name: 'Plain Text Outline', 
      extension: '.txt', 
      description: 'Rapidly parse raw searchable unicode texts without margins.', 
      icon: <FileText className="text-slate-400" size={18} />,
      category: 'document'
    },
    { 
      id: 'epub', 
      name: 'EPUB Ebook Reader', 
      extension: '.epub', 
      description: 'Pack document articles into standard digital publication standard format.', 
      icon: <BookOpen className="text-violet-400" size={18} />,
      category: 'document'
    },
    { 
      id: 'csv', 
      name: 'Tabular CSV Records', 
      extension: '.csv', 
      description: 'Extract lines of numeric or financial list logs delimited with commas.', 
      icon: <Grid className="text-teal-400" size={18} />,
      category: 'spreadsheet'
    }
  ];

  useEffect(() => {
    if (!file) return;
    getPdfPageCount(file.bytes).then((count) => {
      setTotalPages(count);
    });
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
    setSuccessResult(null);
    setExtractedPages([]);
  };

  const executeConversion = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const baseName = file.name.replace(/\.pdf$/i, '');
      let outputBytes = new Uint8Array();
      let outputName = `${baseName}_converted.${targetFormat}`;
      let contentType = 'application/octet-stream';

      switch (targetFormat) {
        case 'txt':
          outputBytes = await convertPdfToTxt(file.bytes);
          outputName = `${baseName}_extracted.txt`;
          contentType = 'text/plain;charset=utf-8';
          break;
        case 'csv':
          outputBytes = await convertPdfToCsv(file.bytes);
          outputName = `${baseName}_data.csv`;
          contentType = 'text/csv;charset=utf-8';
          break;
        case 'html':
          outputBytes = await convertPdfToHtml(file.bytes, file.name);
          outputName = `${baseName}_layout.html`;
          contentType = 'text/html;charset=utf-8';
          break;
        case 'docx':
          outputBytes = await convertPdfToDocx(file.bytes, file.name);
          outputName = `${baseName}_formatted.docx`;
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
        case 'xlsx':
          outputBytes = await convertPdfToXlsx(file.bytes, file.name);
          outputName = `${baseName}_ledger.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pptx':
          outputBytes = await convertPdfToPptx(file.bytes, file.name);
          outputName = `${baseName}_slides.pptx`;
          contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          break;
        case 'epub':
          outputBytes = await convertPdfToEpub(file.bytes, file.name);
          outputName = `${baseName}_ebook.epub`;
          contentType = 'application/epub+zip';
          break;
        case 'png':
        case 'jpg': {
          // Render the pages as graphics
          const countToRender = Math.min(8, totalPages);
          const rendered: { pageNumber: number; dataUrl: string }[] = [];
          
          for (let i = 0; i < countToRender; i++) {
            const pageNum = i + 1;
            const dataUrl = await renderPdfPageToDataUrl(file.bytes, pageNum, 1.2);
            rendered.push({ pageNumber: pageNum, dataUrl });
          }
          setExtractedPages(rendered);

          // Return the first sheet for immediate save
          if (rendered[0]?.dataUrl) {
            const res = await fetch(rendered[0].dataUrl);
            const blob = await res.blob();
            outputBytes = new Uint8Array(await blob.arrayBuffer());
            outputName = `${baseName}_page_1.${targetFormat}`;
            contentType = targetFormat === 'png' ? 'image/png' : 'image/jpeg';
          }
          break;
        }
      }

      const blob = new Blob([outputBytes], { type: contentType });
      const dlUrl = URL.createObjectURL(blob);

      setSuccessResult({
        name: outputName,
        size: outputBytes.length || file.size,
        url: dlUrl,
        ext: targetFormat
      });

      onSuccess(outputName, outputBytes.length || file.size, outputBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Conversion Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setTotalPages(0);
    setSuccessResult(null);
    setExtractedPages([]);
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="pdf-extractor-uploader"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <RefreshCw size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a PDF to extract pages & convert layouts, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Converts vector sheets back to Word, Excel, Slide Decks, Images, HTML, TXT, EPUB, or CSV.
              </p>
            </div>
          </div>
        </div>
      ) : !successResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Summary Panel */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-lg text-left">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Selected Document</div>
                <div className="p-3 bg-slate-950 rounded-lg flex items-center gap-2 border border-slate-850">
                  <FileText className="text-indigo-400 flex-shrink-0" size={18} />
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg space-y-1.5 text-xs text-slate-400">
                <span className="font-semibold text-indigo-400 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
                  <Settings size={13} /> Active Package Contents
                </span>
                <p>
                  Found <strong className="text-slate-200 font-mono">{totalPages} pages</strong> ready to convert. Select a target layout on the right.
                </p>
              </div>
            </div>

            <button
              onClick={resetAll}
              className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg transition"
            >
              Cancel and upload another
            </button>
          </div>

          {/* Target Layout Select Options */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg text-left">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Choose Target Output Format</h3>
              <p className="text-xs text-slate-500">Offline-first high consistency formatting conversions.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[35vh] overflow-y-auto pr-1">
              {formats.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setTargetFormat(fmt.id)}
                  className={`p-3 rounded-lg border text-left flex items-start gap-3 transition ${
                    targetFormat === fmt.id
                      ? 'border-indigo-500 bg-indigo-950/10'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
                  }`}
                >
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex-shrink-0">
                    {fmt.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-slate-200 block normal-case">
                      {fmt.name} <span className="text-[10px] font-mono text-slate-500">{fmt.extension}</span>
                    </span>
                    <span className="text-[10.5px] text-slate-500 block mt-0.5 leading-snug">
                      {fmt.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={executeConversion}
              disabled={isProcessing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Running Layout Convert Engine...
                </>
              ) : (
                <>Convert PDF File to {formats.find(f => f.id === targetFormat)?.name}</>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* CONVERT SUCCESS SCREEN */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-5 shadow-xl animate-fade-in text-left">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <div className="flex gap-2.5 items-center">
              <div className="p-1.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-900">
                <CheckCircle size={16} />
              </div>
              <div>
                <span className="block font-semibold text-slate-100 text-xs">PDF Document Converted!</span>
                <span className="text-[10px] text-slate-500">File is ready for download in selected format.</span>
              </div>
            </div>

            <button
              onClick={resetAll}
              className="text-xs text-indigo-400 hover:underline font-semibold"
            >
              Convert another file
            </button>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400">
                <FileText size={20} />
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-slate-200 truncate pr-4">{successResult.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Extracted Byte Stream Size: {formatBytes(successResult.size)}
                </p>
              </div>
            </div>

            <a
              href={successResult.url}
              download={successResult.name}
              className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Download Result
            </a>
          </div>

          /* Show visual pages if image layouts were exported */
          {extractedPages.length > 0 && (
            <div className="space-y-2 mt-4">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Rendered Images Layout Output
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-3 bg-slate-950 border border-slate-850 rounded-xl max-h-[30vh] overflow-y-auto">
                {extractedPages.map((p, idx) => (
                  <div key={idx} className="aspect-[3/4] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between p-1 hover:border-slate-700 transition">
                    <div className="flex-grow flex items-center justify-center relative bg-white rounded overflow-hidden aspect-square">
                      <img src={p.dataUrl} alt={`page-${idx+1}`} className="max-w-full max-h-full object-contain pointer-events-none select-none" />
                    </div>

                    <div className="p-1 flex justify-between items-center text-[10px] mt-1.5">
                      <span className="font-mono text-slate-500">Page {p.pageNumber}</span>
                      <a
                        href={p.dataUrl}
                        download={`page_${p.pageNumber}.${successResult.ext}`}
                        className="p-1 bg-slate-850 text-indigo-400 hover:text-indigo-300 rounded"
                        title="Download page photo"
                      >
                        <Download size={11} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
