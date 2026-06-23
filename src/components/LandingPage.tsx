import React, { useEffect, useState } from 'react';
import { 
  GitMerge, Scissors, Layers, Minimize2, 
  Edit3, PenTool, FileText, FileImage, 
  Lock, Wrench, ScanText, ArrowRight,
  Shield, Zap, Check, CloudOff, ArrowUpRight
} from 'lucide-react';
import { ToolId } from '../types';
import DemoVisualizer from './DemoVisualizer';

interface LandingPageProps {
  onLaunchApp: () => void;
  onSelectTool: (id: ToolId) => void;
  onDropFile: (file: File) => void;
}

export default function LandingPage({ onLaunchApp, onSelectTool, onDropFile }: LandingPageProps) {
  const [progressWidth1, setProgressWidth1] = useState(0);
  const [progressWidth2, setProgressWidth2] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgressWidth1(100);
      setProgressWidth2(3);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      onDropFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onDropFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-[#F7F7F5] min-h-screen font-sans text-[#0D0D0C] overflow-x-hidden antialiased selection:bg-[#FDF0EB] selection:text-[#D93F0B]">
      
      {/* 1. DYNAMIC HEADER / NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F7F7F5]/85 backdrop-blur-md border-b border-[#E0E0DC]/60 h-14 flex items-center px-4 md:px-10">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            <span className="font-extrabold text-sm tracking-wider uppercase text-[#0D0D0C]">
              PDF<span className="text-[#D93F0B]">MAX</span>
            </span>
          </div>
          
          <div className="flex items-center gap-5 md:gap-7">
            <a href="#tools" className="text-xs font-semibold text-[#6B6B67] hover:text-[#0D0D0C] transition-colors">
              Tools
            </a>
            <a href="#features" className="text-xs font-semibold text-[#6B6B67] hover:text-[#0D0D0C] transition-colors">
              Features
            </a>
            <a href="#compare" className="text-xs font-semibold text-[#6B6B67] hover:text-[#0D0D0C] transition-colors">
              Compare
            </a>
            <button 
              onClick={onLaunchApp}
              className="text-xs font-bold bg-[#0D0D0C] text-white px-4 py-2 rounded-md hover:bg-neutral-850 transition shadow-sm hover:translate-y-[-0.5px]"
            >
              Open App →
            </button>
          </div>
        </div>
      </nav>

      {/* 2. PREMIUM HERO SECTION */}
      <section className="pt-24 md:pt-36 pb-16 px-4 md:px-10 max-w-6xl mx-auto min-h-[92vh] flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center w-full">
          {/* Hero details left column */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left space-y-6 md:space-y-8">
            <div className="flex items-center gap-2">
              <span className="w-5 h-[0.5px] bg-[#D93F0B]" />
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#D93F0B]">
                Everything PDF
              </span>
            </div>

            <h1 className="font-serif font-light text-5xl md:text-7xl tracking-tight leading-[0.98] text-[#0D0D0C] select-none">
              The last <br />
              PDF tool <br />
              you'll <span className="font-bold italic text-[#D93F0B]">ever need.</span>
            </h1>

            <p className="text-[#6B6B67] text-sm md:text-base max-w-lg leading-relaxed font-sans">
              80+ powerful tools. No AI fluff, no ads, no limits. Your vector files never leave your device — processed 100% locally inside sandboxed browser memory. Free, fast, private.
            </p>

            <div className="flex items-center gap-3.5 flex-wrap">
              <button
                onClick={onLaunchApp}
                className="bg-[#0D0D0C] hover:bg-[#222] text-white text-xs font-bold px-6 py-3.5 rounded-md transition-all shadow-md active:scale-98"
              >
                Launch Free App
              </button>
              
              <a 
                href="#tools" 
                className="text-xs font-bold text-[#6B6B67] hover:text-[#0D0D0C] transition-colors flex items-center gap-1 group"
              >
                <span>Browse all tools</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
            </div>

            {/* Quality / Trust Badges */}
            <div className="pt-6 border-t border-[#E0E0DC]/60 flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-[#A8A8A4] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D93F0B]" />
                <span>No registration required</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#A8A8A4] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D93F0B]" />
                <span>No upload size caps</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#A8A8A4] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D93F0B]" />
                <span>100% Client-side privacy</span>
              </div>
            </div>
          </div>

          {/* Hero right interactive visualizer column */}
          <div className="lg:col-span-5 w-full">
            <DemoVisualizer />
          </div>
        </div>
      </section>

      {/* 3. FOUR VALUE PROPOSITIONS STRIP */}
      <div className="bg-[#0D0D0C] text-white py-12 md:py-16 px-4 md:px-14">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {[
            { metric: '80+', label: 'Local utility tools' },
            { metric: '∞', label: 'File size thresholds' },
            { metric: '0', label: 'License fee forever' },
            { metric: '12', label: 'Local OCR languages' }
          ].map((item, i) => (
            <div key={i} className="text-center pt-6 md:pt-0">
              <div className="font-serif font-bold italic text-4xl md:text-5xl text-white/95 leading-none">
                {item.metric}
              </div>
              <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mt-2">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. CHOOSE LAUNCH UTILITY TOOLS */}
      <section id="tools" className="py-20 md:py-28 px-4 md:px-10 max-w-6xl mx-auto">
        <div className="text-left space-y-4 mb-12">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#D93F0B]">
            Launch Services
          </span>
          <h2 className="font-serif font-light text-3xl md:text-5xl tracking-tight text-[#0D0D0C]">
            Ready when you are. <span className="font-bold italic text-[#D93F0B]">Everything works.</span>
          </h2>
          <p className="text-xs md:text-sm text-[#6B6B67] max-w-xl leading-relaxed">
            Ten core tools built directly into the client engine. Processes files locally in milliseconds. Underwritten by modern WebAssembly.
          </p>
        </div>

        {/* Dynamic Tool Service Launch Interface Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-[#E0E0DC] border border-[#E0E0DC] rounded-xl overflow-hidden shadow-sm">
          {[
            {
              id: 'merge',
              name: 'Merge PDF',
              desc: 'Combine multiple PDFs in sequence',
              icon: <GitMerge size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />,
              featured: true
            },
            {
              id: 'split',
              name: 'Split PDF',
              desc: 'Extract ranges or divide every page',
              icon: <Scissors size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'compress',
              name: 'Compress PDF',
              desc: 'Optimize file size with smart Wasm compression',
              icon: <Minimize2 size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'edit',
              name: 'Edit PDF Pages',
              desc: 'Place transparent notes, graphics, or drawings',
              icon: <Edit3 size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'ocr',
              name: 'OCR Reader',
              desc: 'Recognize scanned document text segments',
              icon: <ScanText size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'sign',
              name: 'Sign PDF',
              desc: 'Place hand drawings or typed font signatures',
              icon: <PenTool size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'organize',
              name: 'Organize Pages',
              desc: 'Rotate, duplicate, delete & reorder pages',
              icon: <Layers size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'pdf-docx',
              name: 'PDF ↔ Word',
              desc: 'High-quality layout-preserved conversion',
              icon: <FileText size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'protect',
              name: 'Protect PDF',
              desc: 'Layer passwords & enterprise permissions keys',
              icon: <Lock size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            },
            {
              id: 'repair',
              name: 'Repair PDF',
              desc: 'Recover corrupted page indices locally',
              icon: <Wrench size={16} className="text-[#6B6B67] group-hover:text-[#D93F0B]" />
            }
          ].map((tool) => (
            <button
              onClick={() => onSelectTool(tool.id as ToolId)}
              key={tool.id}
              className={`text-left p-6 flex flex-col justify-between h-[185px] transition-colors relative group select-none ${
                tool.featured 
                  ? 'bg-[#000] text-white hover:bg-[#111110]' 
                  : 'bg-white hover:bg-[#F7F7F5] text-[#0D0D0C]'
              }`}
            >
              {tool.id !== 'merge' && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 translate-x-[2px] translate-y-[-2px] group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-200">
                  <ArrowUpRight size={13} className="text-[#A8A8A4]" />
                </div>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                tool.featured 
                  ? 'bg-white/10 border-white/15' 
                  : 'bg-[#F7F7F5] border-[#E0E0DC] group-hover:bg-[#FDF0EB] group-hover:border-[#D93F0B]/20'
              }`}>
                {tool.icon}
              </div>
              <div className="mt-4">
                <h3 className={`text-xs font-bold leading-normal transition-colors group-hover:text-[#D93F0B] ${
                  tool.featured ? 'text-white' : 'text-[#0D0D0C]'
                }`}>
                  {tool.name}
                </h3>
                <p className={`text-[11px] leading-relaxed mt-1 line-clamp-2 ${
                  tool.featured ? 'text-white/50' : 'text-[#6B6B67]'
                }`}>
                  {tool.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-center mt-6 text-[11px] text-[#A8A8A4] font-medium leading-relaxed">
          Need secondary conversions? Tap doc-to-pdf pipelines or PDF conversions directly in our comprehensive applet.
        </p>
      </section>

      {/* 5. GORGEOUS FEATURES BENTO */}
      <section id="features" className="bg-white py-20 md:py-28 border-y border-[#E0E0DC]/60">
        <div className="max-w-6xl mx-auto px-4 md:px-10">
          <div className="text-left space-y-4 mb-16">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#D93F0B]">
              Why PDFMAX
            </span>
            <h2 className="font-serif font-light text-3xl md:text-5xl tracking-tight text-[#0D0D0C]">
              Built different. <br />
              <span className="font-bold italic text-[#D93F0B]">By clean design.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E0E0DC]/80 border border-[#E0E0DC] rounded-xl overflow-hidden shadow-sm">
            {/* Bento block 1: Privacy (Wide) */}
            <div className="md:col-span-2 bg-[#0D0D0C] p-8 md:p-10 text-white flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-[10px] font-bold tracking-widest uppercase text-white/35">
                  Privacy First
                </span>
                <h3 className="font-serif text-2xl md:text-3xl font-light text-white italic">
                  Your raw documents <span className="font-bold not-italic text-[#D93F0B]">never visit remote servers.</span>
                </h3>
                <p className="text-sm text-white/50 leading-relaxed max-w-2xl font-light">
                  Other tools upload files to execute manipulations. PDFMAX loads standard open-source libraries (like PDF-Lib and PDF.js) straight into WebAssembly in your browser context. Documents never take a network flight. Total enterprise insulation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5 mt-8">
                {['Local WebAssembly', 'Pre-installed sandboxes', 'Uncompressed browser memory', 'No background trackers'].map((tag) => (
                  <span key={tag} className="text-[10px] font-semibold px-3 py-1 bg-white/[0.06] border border-white/10 rounded-full text-white/60">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Bento block 2: Performance */}
            <div className="bg-white p-8 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#D93F0B]">
                  Performance
                </span>
                <h3 className="text-base font-bold text-[#0D0D0C]">
                  Handling heavy outputs with zero lag.
                </h3>
                <p className="text-[12px] text-[#6B6B67] leading-relaxed">
                  Chunked multi-thread reads support large files. Highly optimized virtualization canvas allows buttery smooth drag-and-drop page organization.
                </p>
              </div>

              {/* Graphical illustration for comparison sizes */}
              <div className="space-y-4 mt-8">
                <div>
                  <div className="flex justify-between items-center text-[10px] font-semibold text-[#6B6B67] mb-1">
                    <span>PDFMAX size threshold</span>
                    <span className="font-bold text-[#0D0D0C]">500 MB+ (Uncapped)</span>
                  </div>
                  <div className="h-1 bg-[#F7F7F5] rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${progressWidth1}%` }} 
                      className="h-full bg-[#D93F0B] rounded-full transition-all duration-[1.5s] ease-out" 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] font-semibold text-[#A8A8A4] mb-1">
                    <span>Competitor free limits</span>
                    <span>15 MB cap</span>
                  </div>
                  <div className="h-1 bg-[#F7F7F5] rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${progressWidth2}%` }} 
                      className="h-full bg-[#C8C8C4] rounded-full transition-all duration-[1.5s] ease-out" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bento block 3: Multi-Language OCR */}
            <div className="bg-white p-8 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#D93F0B]">
                  Multi-Language OCR
                </span>
                <h3 className="text-base font-bold text-[#0D0D0C]">
                  Convert image scans to text in seconds.
                </h3>
                <p className="text-[12px] text-[#6B6B67] leading-relaxed">
                  Integrated OCR engines analyze text structures with remarkable accuracy directly client-side. Make scanned invoices or contracts readable.
                </p>
              </div>

              {/* Language Chips */}
              <div className="flex flex-wrap gap-1.5 mt-8">
                {['English', 'Hindi', 'Arabic', 'Français', 'Español', 'Deutsch', '日本語', 'Português', 'Italiano', 'Русский'].map((lang) => (
                  <span key={lang} className="text-[10px] px-2.5 py-1 bg-[#F7F7F5] border border-[#E0E0DC]/80 rounded text-[#6B6B67] font-medium">
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            {/* Bento block 4: Offline PWA */}
            <div className="bg-white p-8 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#D93F0B]">
                  Offline Operations
                </span>
                <h3 className="text-base font-bold text-[#0D0D0C]">
                  No connectivity? No sweat. Core systems run fully offline.
                </h3>
                <p className="text-[12px] text-[#6B6B67] leading-relaxed">
                  PDFMAX relies on client packages that load immediately in your browser cache. Save it to your dock or home screen via PWA protocols to utilize standard utilities securely in offline airplanes, trains, or fields.
                </p>
              </div>

              <div className="bg-[#F7F7F5] border border-[#E0E0DC] rounded-xl p-4 flex items-center gap-3.5 flex-shrink-0 md:w-[280px]">
                <div className="w-9 h-9 bg-[#FDF0EB] rounded-lg border border-[#D93F0B]/15 flex items-center justify-center text-[#D93F0B] flex-shrink-0">
                  <CloudOff size={18} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#0D0D0C]">PWA Verified</div>
                  <div className="text-[10px] text-[#6B6B67] leading-normal mt-0.5">Launches and works offline</div>
                </div>
                <div className="ml-auto text-[9px] bg-[#FDF0EB] border border-[#D93F0B]/20 rounded px-1.5 py-0.5 text-[#D93F0B] font-bold">PWA</div>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* 6. COMPARISON TABLE */}
      <section id="compare" className="py-20 md:py-28 px-4 md:px-10 max-w-6xl mx-auto">
        <div className="text-left space-y-4 mb-12">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#D93F0B]">
            Transparent Pricing
          </span>
          <h2 className="font-serif font-light text-3xl md:text-5xl tracking-tight text-[#0D0D0C]">
            Free means free. <br />
            <span className="font-bold italic text-[#D93F0B]">Not "free with dynamic asterisks."</span>
          </h2>
          <p className="text-xs md:text-sm text-[#6B6B67] max-w-xl leading-relaxed">
            Other tools trap files behind custom paywall layers, cap vector dimensions, inject hidden watermarks, on-file ads, or limit tasks hourly. We choose simple transparency.
          </p>
        </div>

        {/* Comparison table element */}
        <div className="border border-[#E0E0DC] rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E0E0DC] bg-[#F7F7F5] select-none">
                  <th className="p-4 font-semibold text-[#A8A8A4] text-[10px] tracking-wider uppercase">Feature</th>
                  <th className="p-4 font-bold text-[#D93F0B] text-[11px] tracking-wider uppercase bg-[#FDF0EB]/30">PDFMAX</th>
                  <th className="p-4 font-semibold text-[#6B6B67] text-[10px] tracking-wider uppercase">iLovePDF</th>
                  <th className="p-4 font-semibold text-[#6B6B67] text-[10px] tracking-wider uppercase">Smallpdf</th>
                  <th className="p-4 font-semibold text-[#6B6B67] text-[10px] tracking-wider uppercase">Adobe Free</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0DC]">
                {[
                  { feat: 'File limit sizing', our: 'Unlimited (Browser memory)', competitor1: '15 MB cap', competitor2: '5 MB cap', competitor3: '1.5 MB cap' },
                  { feat: 'Daily tasks caps', our: 'None', competitor1: '2 files / 2 hours', competitor2: '2 files / day', competitor3: 'Extremely restricted' },
                  { feat: 'Watermark on output', our: 'Never', competitor1: 'For advanced layers', competitor2: 'Yes (free level)', competitor3: 'Yes (free level)' },
                  { feat: 'Requires sign-up accounts', our: 'No', competitor1: 'Yes, for most tools', competitor2: 'Mandatory', competitor3: 'Mandatory' },
                  { feat: 'Client-side WASM', our: 'Yes (Document safety)', competitor1: 'No (SaaS upload)', competitor2: 'No (SaaS upload)', competitor3: 'No (SaaS upload)' },
                  { feat: 'Offline service support', our: 'Yes (IndexedDB cache)', competitor1: 'No', competitor2: 'No', competitor3: 'No' },
                  { feat: 'No Ads or cookies trackers', our: 'Yes (100% clean)', competitor1: 'No', competitor2: 'No', competitor3: 'No' }
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#F7F7F5]/50 transition-colors">
                    <td className="p-4 font-medium text-[#6B6B67]">{row.feat}</td>
                    <td className="p-4 font-semibold text-[#0D0D0C] bg-[#FDF0EB]/10 border-x border-[#D93F0B]/10">
                      <div className="flex items-center gap-1.5 text-[#D93F0B]">
                        <Check size={14} strokeWidth={3} />
                        <span>{row.our}</span>
                      </div>
                    </td>
                    <td className="p-4 text-[#6B6B67] font-light">{row.competitor1}</td>
                    <td className="p-4 text-[#6B6B67] font-light">{row.competitor2}</td>
                    <td className="p-4 text-[#6B6B67] font-light">{row.competitor3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. CTA / DRAG DROP SECTION */}
      <section className="bg-[#0D0D0C] py-24 md:py-32 text-center text-white relative">
        <div className="max-w-xl mx-auto px-4 space-y-8 select-none">
          <h2 className="font-serif font-light text-4xl md:text-5xl text-white italic tracking-tight leading-none">
            Drop a PDF document. <br />
            <span className="font-bold not-italic text-[#D93F0B]">See what free looks like.</span>
          </h2>
          <p className="text-white/45 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
            No register barriers. No watermarks. Simply drop your target file onto standard launch zones to organize or convert instantly.
          </p>

          {/* Large drop zone box */}
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border border-white/15 border-dashed rounded-xl bg-white/[0.02] hover:bg-white/[0.04] p-10 cursor-pointer transition flex flex-col items-center justify-center relative group"
          >
            <input 
              type="file" 
              accept=".pdf" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              onChange={handleFileInputChange}
            />
            <div className="w-11 h-11 rounded-full bg-white/[0.04] flex items-center justify-center text-[#D93F0B] group-hover:after:duration-200 group-hover:scale-105 transition flex-shrink-0 border border-white/5 shadow-inner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <span className="text-xs font-bold text-white/95 mt-4">Drop files anywhere over page limits</span>
            <span className="text-[11px] text-white/40 mt-1">Or browse from desktop disk storage</span>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="bg-[#F7F7F5] border-t border-[#E0E0DC] py-10 px-4 md:px-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-[#A8A8A4] font-medium text-center md:text-left leading-relaxed">
            <span className="font-bold text-[#0D0D0C]">PDFMAX</span> — Everything PDF. Private & Offline. Powered by high-speed client WebAssembly routines.
          </div>
          <div className="flex gap-6 items-center">
            <a href="#" onClick={(e) => { e.preventDefault(); onLaunchApp(); }} className="text-xs font-bold text-[#6B6B67] hover:text-[#0.D0D0C] transition-colors">Launch Workstation</a>
            <a href="#tools" className="text-xs font-bold text-[#6B6B67] hover:text-[#0D0D0C] transition-colors">Tools</a>
            <a href="#features" className="text-xs font-bold text-[#6B6B67] hover:text-[#0D0D0C] transition-colors">Privacy Principles</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
