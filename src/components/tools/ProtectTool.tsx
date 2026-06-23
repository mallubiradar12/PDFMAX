import React, { useState } from 'react';
import { Upload, Lock, Shield, CheckCircle, Download, RefreshCw, Eye, EyeOff, Key, Unlock, FileLock2 } from 'lucide-react';
import { formatBytes } from '../../utils/pdf';
import { useToast } from '../Toast';


interface ProtectToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

type ProtectActionType = 'encrypt' | 'decrypt';

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

export default function ProtectTool({ onSuccess }: ProtectToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  
  // Tabs: Encrypt vs Decrypt
  const [activeTab, setActiveTab] = useState<ProtectActionType>('encrypt');

  // Encryption Settings
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [encryptionStrength, setEncryptionStrength] = useState<'AES-128' | 'AES-256'>('AES-256');
  
  // Permissions State
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [allowModify, setAllowModify] = useState(false);
  const [allowFormFill, setAllowFormFill] = useState(false);
  const [allowComment, setAllowComment] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState('');
  const [outputSize, setOutputSize] = useState(0);

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

  const triggerProtect = async () => {
    if (!file) return;
    
    if (activeTab === 'encrypt' && !password && !ownerPassword) {
      toast.warn('Please specify either an Open Password, an Owner/Permissions Password, or both.');
      return;
    }
    
    if (activeTab === 'decrypt' && !password) {
      toast.warn('Please enter the current password to unlock the PDF.');
      return;
    }

    setIsProcessing(true);
    try {
      const base64File = arrayBufferToBase64(file.bytes);
      
      const payload = {
        file: base64File,
        fileName: file.name,
        password: password,
        ownerPassword: activeTab === 'encrypt' ? ownerPassword : undefined,
        keyLength: encryptionStrength === 'AES-256' ? 256 : 128,
        allowPrinting: allowPrint,
        allowCopying: allowCopy,
        allowModifying: allowModify,
        allowCommenting: allowComment,
        allowFormFilling: allowFormFill,
        action: activeTab,
      };

      const res = await fetch('/api/protect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete security operation');
      }

      const outputBytes = base64ToUint8Array(data.file);
      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setOutputUrl(url);
      setOutputName(data.fileName || `${file.name.replace(/\.pdf$/i, '')}_secured.pdf`);
      setOutputSize(outputBytes.length);

      onSuccess(data.fileName, outputBytes.length, outputBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Security Operation Failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPassword('');
    setOwnerPassword('');
    setOutputUrl(null);
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="protect-uploader"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <Lock size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a PDF to protect with lock, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Encrypt PDF streams or remove passwords instantly using solid standards.</p>
            </div>
          </div>
        </div>
      ) : !outputUrl ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in duration-200">
          {/* File summary */}
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-lg text-left">
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider mb-2">Target Document</div>
              <div className="p-3 bg-slate-950 rounded-lg flex items-center gap-2">
                <FileLock2 className="text-indigo-400 flex-shrink-0" size={18} />
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

          {/* Setup controls */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg text-left">
            {/* TABS FOR ENCRYPT vs DECRYPT */}
            <div className="flex border-b border-slate-800 p-0.5 bg-slate-950 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('encrypt');
                  setPassword('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'encrypt'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Lock size={13} />
                Add Password / Restrictions
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('decrypt');
                  setPassword('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'decrypt'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Unlock size={13} />
                Remove Password Lock
              </button>
            </div>

            {activeTab === 'encrypt' ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Protection Settings</h3>
                  <p className="text-xs text-slate-500">Secure layouts, restrict modifications, and protect document copies.</p>
                </div>

                <div className="space-y-4">
                  {/* Encryption Standards & Key Length */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">Encryption Level Strategy</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-850">
                      <button
                        type="button"
                        onClick={() => setEncryptionStrength('AES-256')}
                        className={`py-1.5 text-xs rounded font-medium transition ${
                          encryptionStrength === 'AES-256'
                            ? 'bg-slate-850 border border-slate-800 text-indigo-400 font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        AES-256 (Highly Secure)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEncryptionStrength('AES-128')}
                        className={`py-1.5 text-xs rounded font-medium transition ${
                          encryptionStrength === 'AES-128'
                            ? 'bg-slate-850 border border-slate-800 text-indigo-400 font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        AES-128 (Legacy Compatible)
                      </button>
                    </div>
                  </div>

                  {/* Lock Passwords */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Key size={12} className="text-indigo-400" /> Open Password (User Password)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-slate-100 font-mono pr-9"
                          placeholder="Optional if permissions preset is set..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2 hover:text-slate-300 text-slate-500"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Shield size={12} className="text-indigo-400" /> Owner/Permissions Password (Optional)
                      </label>
                      <div className="relative">
                        <input
                          type={showOwnerPassword ? 'text' : 'password'}
                          value={ownerPassword}
                          onChange={(e) => setOwnerPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-slate-100 font-mono pr-9"
                          placeholder="For modifying restrictions..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                          className="absolute right-2.5 top-2 hover:text-slate-300 text-slate-500"
                        >
                          {showOwnerPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Permission restricts */}
                  <div className="border-t border-slate-850 pt-4 space-y-3">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Permitted Document Operations:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-center gap-2.5 cursor-pointer text-slate-350 hover:text-slate-200 text-xs py-1">
                        <input
                          type="checkbox"
                          checked={allowPrint}
                          onChange={(e) => setAllowPrint(e.target.checked)}
                          className="accent-indigo-600 rounded border-slate-800 h-4 w-4 focus:ring-0"
                        />
                        Allow Printing
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer text-slate-350 hover:text-slate-200 text-xs py-1">
                        <input
                          type="checkbox"
                          checked={allowCopy}
                          onChange={(e) => setAllowCopy(e.target.checked)}
                          className="accent-indigo-600 rounded border-slate-800 h-4 w-4 focus:ring-0"
                        />
                        Allow text/images extraction/copying
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer text-slate-350 hover:text-slate-200 text-xs py-1">
                        <input
                          type="checkbox"
                          checked={allowModify}
                          onChange={(e) => setAllowModify(e.target.checked)}
                          className="accent-indigo-600 rounded border-slate-800 h-4 w-4 focus:ring-0"
                        />
                        Allow Editing & PDF modifications
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer text-slate-350 hover:text-slate-200 text-xs py-1">
                        <input
                          type="checkbox"
                          checked={allowFormFill}
                          onChange={(e) => setAllowFormFill(e.target.checked)}
                          className="accent-indigo-600 rounded border-slate-800 h-4 w-4 focus:ring-0"
                        />
                        Allow form-filling actions
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer text-slate-350 hover:text-slate-200 text-xs py-1">
                        <input
                          type="checkbox"
                          checked={allowComment}
                          onChange={(e) => setAllowComment(e.target.checked)}
                          className="accent-indigo-600 rounded border-slate-800 h-4 w-4 focus:ring-0"
                        />
                        Allow commenting & standard sticky notes
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Remove PDF Security Lock</h3>
                  <p className="text-xs text-slate-500">Provide the document's lock credentials to extract an unencrypted version.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Key size={12} className="text-indigo-400" /> Current Password / Open Code
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-slate-100 font-mono pr-9"
                        placeholder="Type current open password..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 hover:text-slate-300 text-slate-500"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-950/20 border border-yellow-900/30 text-yellow-500 rounded-lg text-xs">
                    Please note: In order to decrypt a file, you must legally possess the credentials. PDFMAX decrypted outcomes standardizes streams without passwords.
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={triggerProtect}
              disabled={isProcessing || (activeTab === 'encrypt' ? (!password && !ownerPassword) : !password)}
              className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-850 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  {activeTab === 'encrypt' ? 'Encrypting layout streams...' : 'Unlocking pdf structures...'}
                </>
              ) : (
                <>
                  {activeTab === 'encrypt' ? 'Add Security Password' : 'Remove PDF Password Lock'}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* OUTPUT RESULTS PATHS */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4 shadow-xl animate-fade-in text-left max-w-2xl mx-auto">
          <div className="flex justify-center">
            <div className="p-3 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-850">
              <CheckCircle size={30} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-slate-100 text-base">
              {activeTab === 'encrypt' ? 'Document Security Rules Applied!' : 'Document Decrypted Successfully!'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'encrypt' 
                ? `Protected with high-performance ${encryptionStrength} encryption and granular constraints.` 
                : 'All open passwords and editing restrictions have been fully stripped.'}
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2.5 min-w-0 pr-4">
              <Lock className="text-emerald-400 flex-shrink-0" size={18} />
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-slate-200 truncate">{outputName}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(outputSize)}</p>
              </div>
            </div>
            <a
              href={outputUrl}
              download={outputName}
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
              Protect / Decrypt more files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
