import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface VisualPage {
  w: number;
  h: number;
  lines: number[];
  active?: boolean;
  merged?: boolean;
  source?: boolean;
  big?: boolean;
  small?: boolean;
  signed?: boolean;
  scan?: boolean;
  ocr?: boolean;
}

interface DemoItem {
  name: string;
  pages: VisualPage[];
  status: string;
}

const demos: DemoItem[] = [
  {
    name: 'Merge PDF',
    pages: [
      { w: 75, h: 105, lines: [4, 3, 2], active: true },
      { w: 65, h: 95, lines: [3, 2, 1], active: true },
      { w: 85, h: 115, lines: [5, 3, 2], active: true },
      { w: 110, h: 140, lines: [8, 6, 4, 2], active: false, merged: true }
    ],
    status: '3 files merged → 1 PDF compiled'
  },
  {
    name: 'Split PDF',
    pages: [
      { w: 120, h: 150, lines: [9, 7, 5, 3], active: false, source: true },
      { w: 65, h: 90, lines: [3, 2], active: true },
      { w: 65, h: 90, lines: [3, 2], active: true },
      { w: 65, h: 90, lines: [3, 2], active: true }
    ],
    status: 'Split into 3 separate document files'
  },
  {
    name: 'Compress PDF',
    pages: [
      { w: 105, h: 135, lines: [7, 5, 4, 2], active: false, big: true },
      { w: 70, h: 92, lines: [7, 5, 4, 2], active: true, small: true }
    ],
    status: '12.4 MB → 2.1 MB (83% size reduction)'
  },
  {
    name: 'Sign PDF',
    pages: [
      { w: 120, h: 160, lines: [8, 6, 4, 2], active: true, signed: true }
    ],
    status: 'Signature placed securely on index header'
  },
  {
    name: 'OCR',
    pages: [
      { w: 120, h: 160, lines: [8, 6, 5, 4, 3], active: false, scan: true },
      { w: 120, h: 160, lines: [8, 6, 5, 4, 3], active: true, ocr: true }
    ],
    status: 'Vector text layers created — 98.4% accurate extraction'
  }
];

export default function DemoVisualizer() {
  const [currentDemo, setCurrentDemo] = useState(0);
  const [statusText, setStatusText] = useState('Processing in browser...');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const d = demos[currentDemo];

  const resetInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentDemo((prev) => (prev + 1) % demos.length);
    }, 3800);
  };

  useEffect(() => {
    resetInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    setStatusText('Processing document locally...');
    const t = setTimeout(() => {
      setStatusText(d.status);
    }, 750);
    return () => clearTimeout(t);
  }, [currentDemo, d.status]);

  return (
    <div className="bg-white border border-[#E0E0DC] rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.04)] h-[430px] flex flex-col justify-between">
      {/* Chrome window header style */}
      <div className="bg-[#F7F7F5] border-b border-[#E0E0DC] px-4 py-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        </div>
        <div className="text-[10px] bg-white border border-[#E0E0DC] px-3 py-0.5 rounded-md text-[#6B6B67] font-medium font-mono select-none">
          {d.name}
        </div>
        <div className="w-10" />
      </div>

      {/* Main rendering canvas area */}
      <div className="p-5 flex-1 flex flex-col justify-between bg-white">
        {/* Navigation selection pills */}
        <div className="flex gap-1.5 flex-wrap justify-center mb-2">
          {demos.map((demo, idx) => (
            <button
              key={demo.name}
              onClick={() => {
                setCurrentDemo(idx);
                resetInterval();
              }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                idx === currentDemo
                  ? 'bg-amber-50 border-[#D93F0B]/20 text-[#D93F0B]'
                  : 'bg-white border-[#E0E0DC] hover:bg-[#F7F7F5] text-[#6B6B67]'
              }`}
            >
              {demo.name.replace(' PDF', '')}
            </button>
          ))}
        </div>

        {/* CSS simulated page list */}
        <div className="flex-1 flex gap-3 items-end justify-center h-[240px] pt-4 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {d.pages.map((pg, i) => {
              // Calculate randomized line layout representation
              let lineIndex = 0;
              return (
                <motion.div
                  key={`${currentDemo}-${i}`}
                  initial={{ opacity: 0, scale: 0.85, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10, transition: { duration: 0.18 } }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.05 }}
                  style={{ width: pg.w, height: pg.h }}
                  className="bg-white border border-[#C8C8C4] rounded-md shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between overflow-hidden relative select-none"
                >
                  {/* Page internal decorative layout blocks */}
                  <div className="p-2.5 flex-1 flex flex-col gap-1">
                    {pg.lines.map((lineCount, blockIdx) => {
                      const linesList = [];
                      for (let j = 0; j < lineCount; j++) {
                        const isFirstLine = lineIndex === 0;
                        const isRedLine = pg.signed && blockIdx === pg.lines.length - 1 && j === 0;
                        linesList.push(
                          <div
                            key={j}
                            style={{ width: `${55 + Math.random() * 40}%` }}
                            className={`h-[3px] rounded-full ${
                              isRedLine
                                ? 'bg-[#D93F0B] opacity-50'
                                : isFirstLine
                                ? 'bg-[#D0D0CC]'
                                : 'bg-[#E0E0DC]'
                            }`}
                          />
                        );
                        lineIndex++;
                      }
                      return (
                        <div key={blockIdx} className="space-y-1">
                          {linesList}
                          {blockIdx < pg.lines.length - 1 && <div className="h-[2px]" />}
                        </div>
                      );
                    })}

                    {/* Overlay dynamic alerts/elements inside mock page */}
                    {pg.signed && (
                      <div className="absolute bottom-6 left-1.5 right-1.5 bg-[#FDF0EB] border border-[#D93F0B]/20 rounded-md p-1 border-dashed text-[8px] text-[#D93F0B] font-serif font-bold italic text-center text-ellipsis overflow-hidden">
                        ✦ Signed
                      </div>
                    )}

                    {pg.ocr && (
                      <div className="absolute inset-x-2 bottom-5 bg-[#FDF0EB] rounded border border-[#D93F0B]/20 p-1 text-[7px] text-[#D93F0B] font-mono tracking-tight text-center leading-none">
                        [ searchable text ]
                      </div>
                    )}

                    {pg.scan && (
                      <div className="absolute inset-2 bg-[#F7F7F5] rounded border border-[#E0E0DC] flex items-center justify-center p-1 text-[7px] text-[#A8A8A4] font-medium text-center">
                        scanned image file
                      </div>
                    )}
                  </div>

                  {/* Footnote or sequence identifier */}
                  <div className="text-[8px] text-[#A8A8A4] font-mono text-center py-1 border-t border-[#E0E0DC] bg-[#F7F7F5]">
                    {pg.merged
                      ? 'merged'
                      : pg.small
                      ? '2.1 MB'
                      : pg.big
                      ? '12.4 MB'
                      : pg.source
                      ? 'source'
                      : `Page ${i + 1}`}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Dynamic status line descriptor */}
        <div className="text-center pt-3 border-t border-[#F0F0EC] text-[11px] font-medium text-[#6B6B67]">
          {statusText}
        </div>
      </div>
    </div>
  );
}
