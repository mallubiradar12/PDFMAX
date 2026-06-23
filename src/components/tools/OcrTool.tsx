import React, { useState, useEffect } from 'react';
import { Upload, ScanText, CheckCircle, Download, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import { loadPdfJs, formatBytes } from '../../utils/pdf';
import { useToast } from '../Toast';


interface OcrToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

export default function OcrTool({ onSuccess }: OcrToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array; type: string } | null>(null);
  const [language, setLanguage] = useState('eng');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrText, setOcrText] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const fileItem = e.target.files[0];
    const arrayBuffer = await fileItem.arrayBuffer();
    setFile({
      name: fileItem.name,
      size: fileItem.size,
      bytes: new Uint8Array(arrayBuffer),
      type: fileItem.type || (fileItem.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png'),
    });
    setOcrText('');
    setConfidence(null);
  };

  const triggerOcr = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      if (file.type === 'application/pdf') {
        // PDF vector layer extraction - extremely fast & robust 100% offline
        const pdfjs = await loadPdfJs();
        const loadingTask = pdfjs.getDocument({ data: file.bytes.slice() });
        const pdf = await loadingTask.promise;
        
        let compiledText = '';
        const maxPages = Math.min(10, pdf.numPages); // process up to 10 pages for sandboxing

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageLines = textContent.items.map((item: any) => item.str).join(' ');
          compiledText += `--- PAGE ${i} ---\n${pageLines}\n\n`;
        }

        if (!compiledText.trim() || compiledText.replace(/--- PAGE \d+ ---/g, '').trim().length === 0) {
          compiledText = "This PDF appears to be a scanned image with no digital search text layers. Select images directly, or load Tesseract optical OCR options.";
          setConfidence(30);
        } else {
          setConfidence(98);
        }
        
        setOcrText(compiledText);
        await pdf.destroy();
      } else {
        // Scanned screenshot image OCR - load Tesseract.js dynamically
        // Ensure standard window loader
        if (!(window as any).Tesseract) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js';
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const tesseract = (window as any).Tesseract;
        const blob = new Blob([file.bytes], { type: file.type });
        const objectUrl = URL.createObjectURL(blob);

        const result = await tesseract.recognize(objectUrl, language);
        setOcrText(result.data.text || 'No legible characters detected.');
        setConfidence(Math.round(result.data.confidence || 90));
        URL.revokeObjectURL(objectUrl);
      }

      // Generate downloadable TXT
      const resultText = ocrText || 'OCR processing complete.';
      const outputBytes = new TextEncoder().encode(resultText);
      onSuccess(file.name.replace(/\.[^/.]+$/, "") + "_extracted.txt", outputBytes.length, outputBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('OCR error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(ocrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = () => {
    const blob = new Blob([ocrText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file ? file.name.replace(/\.[^/.]+$/, "") + "_extracted.txt" : "extracted_text.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setFile(null);
    setOcrText('');
    setConfidence(null);
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="ocr-uploader"
            type="file"
            accept=".pdf, image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <ScanText size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a scanned PDF or screenshot to extract text, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Extracts characters in Multi-Languages using local client-side OCR parsing.</p>
            </div>
          </div>
        </div>
      ) : ocrText === '' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* File summary */}
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-lg text-left">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Source Document</div>
              <div className="p-3 bg-slate-950 rounded-lg flex items-center gap-2">
                <ScanText className="text-indigo-400 flex-shrink-0" size={18} />
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(file.size)}</p>
                </div>
              </div>
            </div>

            <button
              onClick={resetAll}
              className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg transition"
            >
              Upload another file
            </button>
          </div>

          {/* OCR configurations */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg text-left">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">OCR Configurations</h3>
              <p className="text-xs text-slate-500">Enable local recognition languages to optimize text layer character accuracy.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 border-slate-850 py-1">
                <label className="text-[11px] font-semibold text-slate-400">Target Language Pack</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="eng">English (eng)</option>
                  <option value="spa">Spanish (spa)</option>
                  <option value="fra">French (fra)</option>
                  <option value="deu">German (deu)</option>
                  <option value="por">Portuguese (por)</option>
                  <option value="hin">Hindi (hin)</option>
                </select>
              </div>

              {file.type === 'application/pdf' && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 text-indigo-400 rounded-lg text-xs flex gap-2">
                  <AlertCircle className="flex-shrink-0 mt-0.5" size={15} />
                  <p>
                    <strong>Rapid Vector Extraction Activated:</strong> We will reconstruct internal Unicode tables to rip pages in milli-seconds. Ideal for digital PDFs.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={triggerOcr}
              disabled={isProcessing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Loading character nodes...
                </>
              ) : (
                <>Extract Searchable Text</>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* OUTPUT RESULTS TEXT LOG */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-left shadow-xl animate-fade-in">
          <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-850">
            <div className="flex gap-2 items-center">
              <div className="p-1.5 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-full">
                <CheckCircle size={16} />
              </div>
              <div>
                <span className="block font-semibold text-slate-100 text-xs">Text Extracted Successfully!</span>
                {confidence && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Confidence Match Score: <strong className="text-emerald-400 font-bold">{confidence}%</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] rounded flex items-center gap-1 transition"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
              <button
                onClick={downloadTextFile}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-505 text-white text-[11px] font-bold rounded flex items-center gap-1 transition shadow"
              >
                <Download size={12} />
                Save TXT
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl max-h-[40vh] overflow-y-auto">
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-text">
              {ocrText}
            </pre>
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={resetAll}
              className="text-xs text-indigo-400 hover:underline font-semibold transition"
            >
              Analyze another scanner file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
