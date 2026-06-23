import React, { useState } from 'react';
import { Upload, Minimize2, CheckCircle, Download, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { compressPdfFile, formatBytes } from '../../utils/pdf';
import { useToast } from '../Toast';


interface CompressToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

export default function CompressTool({ onSuccess }: CompressToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [quality, setQuality] = useState<'screen' | 'ebook' | 'printer' | 'prepress'>('ebook');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    originalSize: number;
    compressedSize: number;
    percentSaved: number;
    url: string;
    name: string;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const fileItem = e.target.files[0];
    const arrayBuffer = await fileItem.arrayBuffer();
    setFile({
      name: fileItem.name,
      size: fileItem.size,
      bytes: new Uint8Array(arrayBuffer),
    });
    setResult(null);
  };

  const triggerCompression = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const { bytes, savingsPercent } = await compressPdfFile(file.bytes, quality);
      
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const compressedName = file.name.replace(/\.pdf$/i, '') + `_compressed.pdf`;

      setResult({
        originalSize: file.size,
        compressedSize: bytes.length,
        percentSaved: savingsPercent,
        url,
        name: compressedName,
      });

      onSuccess(compressedName, bytes.length, bytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Compression error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="compress-uploader"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <Minimize2 size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a PDF file to compress, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Strips redundant metadata streams and compresses graphics locally.</p>
            </div>
          </div>
        </div>
      ) : !result ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in animate-duration-200">
          {/* File details */}
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-lg">
            <div className="space-y-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Loaded Document</div>
              <div className="p-3 bg-slate-950 rounded-lg flex items-center gap-2">
                <Minimize2 className="text-indigo-400 flex-shrink-0" size={18} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(file.size)}</p>
                </div>
              </div>
            </div>
            <button
              onClick={resetAll}
              className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg transition"
            >
              Upload another file
            </button>
          </div>

          {/* Compress presets */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Select Compression Mode</h3>
              <p className="text-xs text-slate-500">Pick a preset balancing byte size savings and graphic resolutions.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Presets List */}
              <button
                onClick={() => setQuality('screen')}
                className={`text-left p-3.5 rounded-xl border transition ${
                  quality === 'screen'
                    ? 'bg-indigo-600/10 border-indigo-500 text-slate-200'
                    : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold">Extreme Compression</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">72 DPI</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Maximum size shrinkage. Low image contrast/resolution. Best for fast email messaging.
                </p>
              </button>

              <button
                onClick={() => setQuality('ebook')}
                className={`text-left p-3.5 rounded-xl border transition ${
                  quality === 'ebook'
                    ? 'bg-indigo-600/10 border-indigo-500 text-slate-200'
                    : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold font-medium text-slate-200">Recommended Size</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">150 DPI</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Great compression with crisp text layouts. Perfect balanced mode.
                </p>
              </button>

              <button
                onClick={() => setQuality('printer')}
                className={`text-left p-3.5 rounded-xl border transition ${
                  quality === 'printer'
                    ? 'bg-indigo-600/10 border-indigo-500 text-slate-200'
                    : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold">High Quality</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">300 DPI</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Excellent print rendering. Restricts pixel drops on digital text grids.
                </p>
              </button>

              <button
                onClick={() => setQuality('prepress')}
                className={`text-left p-3.5 rounded-xl border transition ${
                  quality === 'prepress'
                    ? 'bg-indigo-600/10 border-indigo-500 text-slate-200'
                    : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold">Lossless Compression</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">Original DPI</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Rebuild file indices and remove excess background structures without impacting graphic resolution.
                </p>
              </button>
            </div>

            <button
              onClick={triggerCompression}
              disabled={isProcessing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Compressing document layers...
                </>
              ) : (
                <>Compress PDF Document</>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* COMPARATIVE SUCCESS RESULTS */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-6 shadow-xl animate-fade-in">
          <div className="flex justify-center">
            <div className="p-3 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-850">
              <CheckCircle size={30} />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base">Doc Optimized Successfully</h3>
            <p className="text-xs text-slate-500 mt-0.5">Filesize trimmed in secure storage sandbox.</p>
          </div>

          <div className="max-w-md mx-auto grid grid-cols-3 gap-2 py-4 px-3 bg-slate-950 rounded-xl border border-slate-850 items-center">
            <div className="text-center">
              <span className="block text-[10px] uppercase font-semibold text-slate-500">Original</span>
              <span className="block text-xs font-bold text-slate-300 font-mono mt-0.5">{formatBytes(result.originalSize)}</span>
            </div>
            <div className="text-center flex flex-col justify-center items-center border-x border-slate-850 p-1">
              <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                <Sparkles size={11} /> Saved
              </span>
              <span className="block text-base font-extrabold text-emerald-400 font-mono mt-0.5">{result.percentSaved}%</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] uppercase font-semibold text-slate-500">Compressed</span>
              <span className="block text-xs font-bold text-slate-200 font-mono mt-0.5">{formatBytes(result.compressedSize)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
            <a
              href={result.url}
              download={result.name}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Download size={14} />
              Save Optimized File
            </a>
            <button
              onClick={resetAll}
              className="w-full py-2.5 bg-slate-850 text-slate-300 hover:bg-slate-800 rounded-lg text-xs font-medium transition"
            >
              Optimize another PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
