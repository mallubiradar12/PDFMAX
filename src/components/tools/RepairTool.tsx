import React, { useState } from 'react';
import { Upload, Wrench, CheckCircle, Download, RefreshCw, AlertCircle, ShieldCheck, Heart } from 'lucide-react';
import { formatBytes } from '../../utils/pdf';
import { useToast } from '../Toast';


interface RepairToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

interface RepairLog {
  checked: string;
  status: 'passed' | 'repaired';
  details: string;
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export default function RepairTool({ onSuccess }: RepairToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [linearize, setLinearize] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    repairedUrl: string;
    repairedSize: number;
    name: string;
    logs: RepairLog[];
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

  const triggerRepair = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const base64File = arrayBufferToBase64(file.bytes);

      const res = await fetch('/api/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: base64File,
          fileName: file.name,
          linearize: linearize,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed structurally repairing PDF document.');
      }

      const outputBytes = base64ToUint8Array(data.file);
      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setResult({
        repairedUrl: url,
        repairedSize: outputBytes.length,
        name: data.fileName || `${file.name.replace(/\.pdf$/i, '')}_repaired.pdf`,
        logs: data.logs || [],
      });

      onSuccess(data.fileName, outputBytes.length, outputBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Error during document structural repair: ' + err.message);
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
            id="repair-uploader"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <Wrench size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a corrupted/broken PDF to repair, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Rebuild broken XRef indexes, catalog streams, and linearize pages instantly.</p>
            </div>
          </div>
        </div>
      ) : !result ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* File summary */}
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-lg text-left">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Target File</div>
              <div className="p-3 bg-slate-950 rounded-lg flex items-center gap-2">
                <Wrench className="text-indigo-400 flex-shrink-0" size={18} />
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

          {/* Trigger screen */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg text-left">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Clean and Repair Structure</h3>
              <p className="text-xs text-slate-500">
                Corruptions occur due to interrupted download, incorrect email parsing, or unsealed writers. Our server repairs internal object table references using deep binary rebuilding.
              </p>
            </div>

            {/* Linearize configuration options */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-lg space-y-3">
                <div className="text-xs font-semibold text-slate-350 uppercase tracking-widest">Repair Options</div>
                <label className="flex items-start gap-3 cursor-pointer text-slate-350 hover:text-slate-200 text-xs py-1 select-none">
                  <input
                    type="checkbox"
                    checked={linearize}
                    onChange={(e) => setLinearize(e.target.checked)}
                    className="accent-indigo-650 rounded border-slate-800 h-4.5 w-4.5 mt-0.5 focus:ring-0"
                  />
                  <div>
                    <span className="block font-semibold text-slate-200">Linearize (Optimize PDF for Fast Web View)</span>
                    <span className="block text-[10px] text-slate-500 leading-normal mt-0.5">
                      Rearranges objects to allow progressive downloading. PDF pages load instantaneously inside users' web browsers before loading fully.
                    </span>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-lg space-y-2 text-xs text-slate-400">
                <div className="font-semibold text-indigo-400 flex items-center gap-2">
                  <ShieldCheck size={16} /> Secure Native Rebuilding
                </div>
                <p className="text-[11px] leading-relaxed">
                  Repairs broken xref catalogs, incorrect dictionaries and recovers maximum data layers natively. Files are temporary and automatically destroyed from active server buffers.
                </p>
              </div>
            </div>

            <button
              onClick={triggerRepair}
              disabled={isProcessing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-850 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Analyzing and reconstructing internal layers...
                </>
              ) : (
                <>Repair Corrupted Document</>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* OUTPUT RESULTS REPORT */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-left space-y-6 shadow-xl animate-fade-in max-w-4xl mx-auto">
          <div className="flex gap-3 items-center">
            <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-850">
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Document Structural Repair Complete!</h3>
              <p className="text-xs text-slate-500 mt-0.5">Integrity, indices, and page layouts have been fully restored.</p>
            </div>
          </div>

          {/* DIAGNOSTIC REPORT logs */}
          <div className="space-y-2 bg-slate-950 border border-slate-850 rounded-lg p-4 font-mono text-[11px] max-h-[30vh] overflow-y-auto">
            <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider mb-2 border-b border-slate-850 pb-1.5 flex justify-between">
              <span>SYSTEM DIAGNOSTIC REPORT</span>
              <span className="text-emerald-400 font-bold">STATUS: SEALED & OPTIMIZED</span>
            </div>
            {result.logs.map((log, idx) => (
              <div key={idx} className="flex justify-between items-start border-b border-slate-900 last:border-0 pb-1 pt-1.5">
                <div>
                  <span className="block font-semibold text-slate-300 font-sans">{log.checked}</span>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5 leading-relaxed">{log.details}</p>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase font-sans ${
                    log.status === 'repaired'
                      ? 'bg-yellow-950/45 text-yellow-500 border border-yellow-900/30'
                      : 'bg-emerald-950/45 text-emerald-400 border border-emerald-900/30'
                  }`}
                >
                  {log.status}
                </span>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2.5 min-w-0 pr-4">
              <Wrench className="text-emerald-400 flex-shrink-0" size={18} />
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">{result.name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatBytes(result.repairedSize)}</p>
              </div>
            </div>
            <a
              href={result.repairedUrl}
              download={result.name}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-1.5 flex-shrink-0"
            >
              <Download size={14} />
              Download Save
            </a>
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={resetAll}
              className="text-xs text-indigo-400 hover:underline font-semibold transition"
            >
              Repair another document catalog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
