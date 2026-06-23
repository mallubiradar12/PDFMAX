import React, { useState, useRef, useEffect } from 'react';
import { Upload, PenTool, CheckCircle, Download, RefreshCw, AlertTriangle, Trash2, Check, Type, FileText } from 'lucide-react';
import { getPdfPageCount, renderPdfPageToDataUrl, signPdfFile, formatBytes } from '../../utils/pdf';
import { useToast } from '../Toast';


interface SignToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

export default function SignTool({ onSuccess }: SignToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPage, setSelectedPage] = useState(0);
  const [pageThumbUrl, setPageThumbUrl] = useState<string | null>(null);
  
  const [signMode, setSignMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  
  // Draw State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  
  // Type State
  const [typedName, setTypedName] = useState('John Doe');
  const [typedFont, setTypedFont] = useState('font-signature-cursive');

  // Stamp position states
  const [stampPos, setStampPos] = useState({ x: 100, y: 150 });
  const [stampScale, setStampScale] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState(0);

  useEffect(() => {
    if (!file) return;
    getPdfPageCount(file.bytes).then((count) => {
      setTotalPages(count);
      setSelectedPage(0);
    });
  }, [file]);

  useEffect(() => {
    if (!file || totalPages === 0) return;
    setPageThumbUrl(null);
    renderPdfPageToDataUrl(file.bytes, selectedPage + 1, 1.0)
      .then((url) => setPageThumbUrl(url))
      .catch((err) => console.error(err));
  }, [file, selectedPage, totalPages]);

  // Canvas Drawing Pad functions
  useEffect(() => {
    if (signMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [signMode, brushColor]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    const pos = getCanvasPos(canvas, e);
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasPos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getCanvasPos = (canvas: HTMLCanvasElement, e: any) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureUrl(null);
    }
  };

  const confirmDrawSignature = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      setSignatureUrl(url);
    }
  };

  const generateTypeSignature = () => {
    // Generate simple transparent image with typed font overlay
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = brushColor;
      
      let fontStyle = 'italic 36px cursive';
      if (typedFont === 'font-signature-serif') fontStyle = '32px Georgia';
      else if (typedFont === 'font-signature-brush') fontStyle = 'bold italic 34px fantasy';

      ctx.font = fontStyle;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
      setSignatureUrl(canvas.toDataURL('image/png'));
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        setSignatureUrl(fileReader.result as string);
      };
      fileReader.readAsDataURL(e.target.files[0]);
    }
  };

  const triggerStamp = async () => {
    if (!file || !signatureUrl) return;
    setIsProcessing(true);
    try {
      // PDF dimensions translations - Map client-side CSS stamps coordinate ratios accurately
      // Assuming a standard A4 page is roughly [595, 842] points
      // Map 400px container width to 595 PDF points ratio
      const viewDomWidth = 400;
      const viewDomHeight = 565; // ~ aspect ratio A4
      
      const pdfWidth = 595;
      const pdfHeight = 842;

      const scaleRatioX = pdfWidth / viewDomWidth;
      const scaleRatioY = pdfHeight / viewDomHeight;

      // Base dimensions of PNG signature stamp is roughly 150px x 60px
      const stampWidth = 150 * stampScale * scaleRatioX;
      const stampHeight = 60 * stampScale * scaleRatioY;

      const stampPdfX = stampPos.x * scaleRatioX;
      // pdf-lib Y starts bottom left, translate top left HTML coordinate
      const stampPdfY = (viewDomHeight - stampPos.y - 60) * scaleRatioY;

      const finalBytes = await signPdfFile(
        file.bytes,
        signatureUrl,
        selectedPage,
        {
          x: Math.max(0, stampPdfX),
          y: Math.max(0, stampPdfY),
          width: stampWidth,
          height: stampHeight,
        }
      );

      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const outputName = file.name.replace(/\.pdf$/i, '') + `_signed.pdf`;

      setOutputUrl(url);
      setOutputSize(finalBytes.length);

      onSuccess(outputName, finalBytes.length, finalBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Error stamping signature: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const fileItem = e.target.files[0];
    const arrayBuffer = await fileItem.arrayBuffer();
    setFile({
      name: fileItem.name,
      size: fileItem.size,
      bytes: new Uint8Array(arrayBuffer),
    });
    setOutputUrl(null);
  };

  const resetAll = () => {
    setFile(null);
    setPageThumbUrl(null);
    setSignatureUrl(null);
    setOutputUrl(null);
    setStampScale(1.0);
    setStampPos({ x: 100, y: 150 });
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="sign-uploader"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <PenTool size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a PDF file to sign, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Sign contracts physically. Standard transparent layouts.</p>
            </div>
          </div>
        </div>
      ) : !outputUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* LEFT COLUMN: BUILD SIGNATURES */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg h-fit">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850">
              <button
                onClick={() => {
                  setSignMode('draw');
                  setSignatureUrl(null);
                }}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition ${
                  signMode === 'draw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Draw Signature
              </button>
              <button
                onClick={() => {
                  setSignMode('type');
                  setSignatureUrl(null);
                }}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition ${
                  signMode === 'type' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Type Initials
              </button>
              <button
                onClick={() => {
                  setSignMode('upload');
                  setSignatureUrl(null);
                }}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition ${
                  signMode === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload PNG
              </button>
            </div>

            {/* Sub-modes details rendering */}
            {signMode === 'draw' && (
              <div className="space-y-3">
                <div className="border border-slate-800 bg-white rounded-lg overflow-hidden relative">
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={160}
                    className="w-full h-40 edit-canvas cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5 bg-slate-900/80 p-1 rounded border border-slate-800">
                    <button
                      onClick={() => setBrushColor('#000000')}
                      className={`h-4 w-4 rounded-full bg-black border-2 ${
                        brushColor === '#000000' ? 'border-indigo-400' : 'border-transparent'
                      }`}
                    />
                    <button
                      onClick={() => setBrushColor('#0f172a')}
                      className={`h-4 w-4 rounded-full bg-slate-800 border-2 ${
                        brushColor === '#0f172a' ? 'border-indigo-400' : 'border-transparent'
                      }`}
                    />
                    <button
                      onClick={() => setBrushColor('#1d4ed8')}
                      className={`h-4 w-4 rounded-full bg-blue-700 border-2 ${
                        brushColor === '#1d4ed8' ? 'border-indigo-400' : 'border-transparent'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-between">
                  <button
                    onClick={clearCanvas}
                    className="px-3 py-1.5 hover:bg-slate-850 text-slate-400 text-xs rounded transition"
                  >
                    Clear pad
                  </button>
                  <button
                    onClick={confirmDrawSignature}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow-md transition"
                  >
                    Generate Seal
                  </button>
                </div>
              </div>
            )}

            {signMode === 'type' && (
              <div className="space-y-3">
                <input
                  type="text"
                  maxLength={18}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono text-center"
                  placeholder="Enter full name..."
                />
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setTypedFont('font-signature-cursive')}
                    style={{ fontFamily: 'cursive' }}
                    className={`py-1 text-center text-xs border rounded transition text-slate-200 ${
                      typedFont === 'font-signature-cursive' ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    Signature
                  </button>
                  <button
                    onClick={() => setTypedFont('font-signature-serif')}
                    style={{ fontFamily: 'Georgia' }}
                    className={`py-1 text-center text-xs border rounded transition text-slate-200 ${
                      typedFont === 'font-signature-serif' ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    Elegant
                  </button>
                  <button
                    onClick={() => setTypedFont('font-signature-brush')}
                    style={{ fontFamily: 'fantasy' }}
                    className={`py-1 text-center text-xs border rounded transition text-slate-200 ${
                      typedFont === 'font-signature-brush' ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    Bold Ink
                  </button>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={generateTypeSignature}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow-md transition"
                  >
                    Generate Seal
                  </button>
                </div>
              </div>
            )}

            {signMode === 'upload' && (
              <div className="space-y-4">
                <div className="border border-dashed border-slate-800 rounded-lg p-5 text-center relative hover:border-slate-705">
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleSignatureUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="mx-auto text-slate-500 mb-2" size={20} />
                  <span className="text-[11px] text-slate-400">Upload transparent PNG signature</span>
                </div>
              </div>
            )}

            {/* Render ACTIVE SIG preview signature stamp */}
            {signatureUrl && (
              <div className="border border-emerald-900 bg-emerald-950/10 p-3 rounded-lg text-center space-y-2 animate-fade-in">
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold block">Active Signature Stamp Ready</span>
                <img src={signatureUrl} alt="Active Signature" className="mx-auto max-h-12 bg-white rounded p-1 shadow border border-slate-200 select-none pointer-events-none" />
                
                {/* Stamp scaling tools */}
                <div className="pt-2 border-t border-slate-850 text-left space-y-2">
                  <label className="text-[10px] text-slate-500 flex justify-between">
                    <span>Stamp Scale:</span>
                    <span className="font-mono text-indigo-400 font-bold">{Math.round(stampScale * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={stampScale}
                    onChange={(e) => setStampScale(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 h-1 bg-slate-850 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: PREVIEW AND coordinate DRAG STAMPS */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-6 shadow-lg">
            <div className="space-y-4 flex-grow flex flex-col">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Document: <span className="text-slate-100 font-semibold">{file.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Target Page:</span>
                  <select
                    value={selectedPage}
                    onChange={(e) => {
                      setSelectedPage(parseInt(e.target.value));
                      setStampPos({ x: 100, y: 150 });
                    }}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none"
                  >
                    {Array.from(Array(totalPages).keys()).map((num) => (
                      <option key={num} value={num}>
                        Page {num + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rendering actual visual sheet container */}
              <div className="flex-grow flex justify-center bg-slate-950 border border-slate-850/60 rounded-xl p-4 min-h-[50vh] relative items-center">
                {pageThumbUrl ? (
                  <div
                    className="relative border border-slate-800 shadow-md bg-white select-none overflow-hidden max-w-[400px] aspect-[595/842]"
                    style={{ width: '400px', height: '565px' }}
                    onClick={(e) => {
                      // Retrieve click coordinates relative to client container
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left - 75; // center offset
                      const y = e.clientY - rect.top - 30;
                      setStampPos({
                        x: Math.min(250, Math.max(0, x)),
                        y: Math.min(505, Math.max(0, y)),
                      });
                    }}
                  >
                    <img src={pageThumbUrl} alt="Active page" className="w-full h-full object-contain pointer-events-none select-none" />
                    
                    {/* Visual signature overlay stamp */}
                    {signatureUrl && (
                      <div
                        className="absolute border-2 border-dashed border-indigo-600 bg-indigo-50/20 rounded shadow cursor-move p-0.5 animate-pulse"
                        style={{
                          left: `${stampPos.x}px`,
                          top: `${stampPos.y}px`,
                          width: `${150 * stampScale}px`,
                          height: `${60 * stampScale}px`,
                        }}
                      >
                        <img src={signatureUrl} className="w-full h-full object-contain pointer-events-none select-none" />
                        <span className="absolute -top-4 -left-1 bg-indigo-600 text-white font-mono text-[8px] px-1 rounded-sm shadow">
                          DRAGGED / STAMP HERE
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <RefreshCw className="animate-spin text-indigo-400" size={24} />
                    <span className="text-xs">Loading page coordinate mapping matrix...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 items-center justify-between border-t border-slate-850 pt-4 flex-wrap">
              <span className="text-[11px] text-slate-500 font-mono">
                Coordinate placement: X: {Math.round(stampPos.x)}, Y: {Math.round(stampPos.y)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-4 py-2 border border-slate-750 hover:bg-slate-855 text-slate-300 text-xs font-semibold rounded-lg transition"
                >
                  Change file
                </button>
                <button
                  onClick={triggerStamp}
                  disabled={!signatureUrl || isProcessing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-505 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} />
                      Stamping document streams...
                    </>
                  ) : (
                    <>Stamp PDF & Download</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* OUTPUT RESULTS SUCCESS */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4 shadow-xl animate-fade-in duration-150">
          <div className="flex justify-center">
            <div className="p-3 bg-emerald-950 text-emerald-400 border border-emerald-850 rounded-full">
              <CheckCircle size={32} />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base">Signature Stamped Successfully!</h3>
            <p className="text-xs text-slate-500 mt-1">Form filled and signed securely inside local secure storage sandbox.</p>
          </div>

          <div className="max-w-md mx-auto p-3.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <FileText className="text-indigo-400 flex-shrink-0" size={18} />
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-slate-200 truncate">{file.name.replace(/\.pdf$/i, '') + '_signed.pdf'}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(outputSize)}</p>
              </div>
            </div>
            <a
              href={outputUrl}
              download={file.name.replace(/\.pdf$/i, '') + '_signed.pdf'}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition flex items-center gap-1.5 flex-shrink-0"
            >
              <Download size={14} />
              Save Signed PDF
            </a>
          </div>

          <div className="pt-2">
            <button
              onClick={resetAll}
              className="text-xs text-indigo-400 hover:underline font-semibold transition"
            >
              Sign another contract
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
