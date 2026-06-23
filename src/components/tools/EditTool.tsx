import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, CheckCircle, Download, RefreshCw, Undo2, Redo2, Type, 
  Trash2, FileText, Sparkles, Move, Settings, Check, HelpCircle, 
  ChevronLeft, ChevronRight, Redo, Layout, Heading, Tag, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify
} from 'lucide-react';
import { getPdfPageCount, loadPdfJs, formatBytes } from '../../utils/pdf';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as fabric from 'fabric';
import { useToast } from '../Toast';


// Import Google Fonts registered styles under @fontsource
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/700.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/playfair-display/700.css";

interface EditToolProps {
  onSuccess: (name: string, size: number, bytes: Uint8Array) => void;
}

interface ExistingTextItem {
  id: string;
  originalText: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  isEdited: boolean;
  color: string;
}

const SUPPORTED_FONTS = [
  { label: 'Inter', value: 'Inter, sans-serif', standard: 'Helvetica' },
  { label: 'Roboto', value: 'Roboto, sans-serif', standard: 'Helvetica' },
  { label: 'Merriweather', value: 'Merriweather, serif', standard: 'Times-Roman' },
  { label: 'Playfair Display', value: 'Playfair Display, serif', standard: 'Times-Roman' },
  { label: 'Monospace', value: 'monospace', standard: 'Courier' }
];

export default function EditTool({ onSuccess }: EditToolProps) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [selectedPage, setSelectedPage] = useState<number>(0);
  const [pageBackgroundUrl, setPageBackgroundUrl] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 550, height: 780 });
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);

  // Tools: 
  // 'existing' - Edit Existing Text Layer 
  // 'add' - Add New Text Boxes via Click
  // 'redact' - Delete Text regions (draw Redact cover rectangle)
  const [activeTool, setActiveTool] = useState<'existing' | 'add' | 'redact'>('existing');

  // Text Style States (for Added or Selected text)
  const [activeFont, setActiveFont] = useState<string>('Inter, sans-serif');
  const [activeFontSize, setActiveFontSize] = useState<number>(16);
  const [activeColor, setActiveColor] = useState<string>('#000000');
  const [activeAlign, setActiveAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [activeLineHeight, setActiveLineHeight] = useState<number>(1.2);
  const [activeLetterSpacing, setActiveLetterSpacing] = useState<number>(0);

  // Selected object properties for Fabric active element synchronization
  const [fabricSelection, setFabricSelection] = useState<{
    type: 'text' | 'redact' | null;
    fontSize: number;
    color: string;
    fontFamily: string;
    textAlign: string;
    lineHeight: number;
    charSpacing: number;
  } | null>(null);

  // Persistent States per Page
  const [existingTextEdits, setExistingTextEdits] = useState<Record<number, ExistingTextItem[]>>({});
  // Raw Fabric Canvas states (JSON representations per page to preserve edits when swapping pages)
  const [fabricPageStates, setFabricPageStates] = useState<Record<number, any>>({});

  // Headers and Footers Settings
  const [headerLeft, setHeaderLeft] = useState<string>('');
  const [headerCenter, setHeaderCenter] = useState<string>('');
  const [headerRight, setHeaderRight] = useState<string>('');
  const [footerLeft, setFooterLeft] = useState<string>('');
  const [footerCenter, setFooterCenter] = useState<string>('');
  const [footerRight, setFooterRight] = useState<string>('');
  const [includePageNumbers, setIncludePageNumbers] = useState<boolean>(false);
  const [pageNumberPosition, setPageNumberPosition] = useState<'header' | 'footer'>('footer');
  const [pageNumberAlign, setPageNumberAlign] = useState<'left' | 'center' | 'right'>('center');
  const [includeDate, setIncludeDate] = useState<boolean>(false);
  const [datePosition, setDatePosition] = useState<'header' | 'footer'>('footer');
  const [dateAlign, setDateAlign] = useState<'left' | 'center' | 'right'>('right');

  // Watermarks Configurations
  const [watermarkType, setWatermarkType] = useState<'none' | 'text' | 'image'>('none');
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkColor, setWatermarkColor] = useState<string>('#ef4444');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(48);
  const [watermarkLayout, setWatermarkLayout] = useState<'diagonal' | 'center'>('diagonal');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkImageSrc, setWatermarkImageSrc] = useState<string | null>(null);
  const [watermarkImageBytes, setWatermarkImageBytes] = useState<Uint8Array | null>(null);
  const [watermarkImageScale, setWatermarkImageScale] = useState<number>(0.5);

  // References
  const fabricRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasInst = useRef<fabric.Canvas | null>(null);
  const watermarkImgInputRef = useRef<HTMLInputElement | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  // 1. Initial Page Count Trigger
  useEffect(() => {
    if (!file) return;
    getPdfPageCount(file.bytes).then((count) => {
      setTotalPages(count);
      setSelectedPage(0);
      setExistingTextEdits({});
      setFabricPageStates({});
      setOutputUrl(null);
    });
  }, [file]);

  // 2. Clear output link on change
  useEffect(() => {
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }
  }, [selectedPage, activeTool]);

  // 3. Render page and fetch TEXT layers using PDF.js
  useEffect(() => {
    if (!file || totalPages === 0) return;
    loadPageData(selectedPage);
  }, [file, selectedPage, totalPages]);

  const loadPageData = async (pageNum: number) => {
    setIsLoadingPage(true);
    try {
      const pdfjs = await loadPdfJs();
      const loadingTask = pdfjs.getDocument({ data: file.bytes.slice() });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum + 1);

      // Determine clean interactive scale matching ~550 viewport constraint width
      const baseViewport = page.getViewport({ scale: 1.0 });
      const targetWidth = 550;
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      setPageDimensions({ width: viewport.width, height: viewport.height });

      // Render crisp image background
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        setPageBackgroundUrl(canvas.toDataURL('image/png'));
      }

      // Fetch underlying Text Content structure
      const textContent = await page.getTextContent();
      const textLayerItems: ExistingTextItem[] = textContent.items.map((item: any) => {
        const [left, top] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const fontHeight = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
        const size = fontHeight * scale;

        return {
          id: 'exist-' + Math.random().toString(36).substring(2, 9),
          originalText: item.str,
          text: item.str,
          left: left,
          top: top - size, // Align top-left bounding box
          width: item.width * scale,
          height: fontHeight * scale,
          fontSize: size,
          fontFamily: item.fontName || 'sans-serif',
          isEdited: false,
          color: '#000000',
        };
      });

      // Avoid overwriting returning edits if user already touched this page
      setExistingTextEdits(prev => {
        if (prev[pageNum]) return prev;
        return { ...prev, [pageNum]: textLayerItems };
      });

      // Cleanup
      pdf.destroy();
    } catch (err) {
      console.error('Failure rendering PDF page text layers:', err);
    } finally {
      setIsLoadingPage(false);
    }
  };

  // 4. Instantiate and Manage Fabric Canvas Overlay
  useEffect(() => {
    if (!pageBackgroundUrl || isLoadingPage) return;

    // Dispose prior instance
    if (fabricCanvasInst.current) {
      fabricCanvasInst.current.dispose();
    }

    const canvas = new fabric.Canvas(fabricRef.current, {
      width: pageDimensions.width,
      height: pageDimensions.height,
      backgroundColor: 'transparent',
      selectionColor: 'rgba(99, 102, 241, 0.15)',
      selectionBorderColor: 'rgb(99, 102, 241)',
      selectionLineWidth: 1.5,
    });

    fabricCanvasInst.current = canvas;

    // Reload preserved state details if existing
    const savedState = fabricPageStates[selectedPage];
    if (savedState) {
      canvas.loadFromJSON(savedState, () => {
        canvas.renderAll();
      });
    }

    // Set listeners for selection changes
    canvas.on('selection:created', handleFabricSelection);
    canvas.on('selection:updated', handleFabricSelection);
    canvas.on('selection:cleared', () => setFabricSelection(null));

    // Dynamic drag-draw listener for redactions
    let isMouseDown = false;
    let startX = 0;
    let startY = 0;
    let activeRect: fabric.Rect | null = null;

    canvas.on('mouse:down', (options: any) => {
      if (activeTool !== 'redact') {
        // In text-add mode: click to add text
        if (activeTool === 'add' && !canvas.getActiveObject() && options.absolutePointer) {
          const { x, y } = options.absolutePointer;

          const textbox = new fabric.Textbox('Double click to edit text', {
            left: x,
            top: y,
            width: 180,
            fontSize: activeFontSize,
            fill: activeColor,
            fontFamily: activeFont,
            textAlign: activeAlign,
            lineHeight: activeLineHeight,
            charSpacing: activeLetterSpacing,
            hasControls: true,
            hasBorders: true,
            borderColor: 'rgb(99, 102, 241)',
            cornerColor: 'rgb(99, 102, 241)',
          });

          canvas.add(textbox);
          canvas.setActiveObject(textbox);
          canvas.renderAll();
          saveActiveFabricState();
        }
        return;
      }

      // Inside redactions mode: draw rect boundary
      if (options.absolutePointer) {
        isMouseDown = true;
        startX = options.absolutePointer.x;
        startY = options.absolutePointer.y;

        activeRect = new fabric.Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: '#ffffff',
          stroke: '#ef4444',
          strokeWidth: 1.5,
          strokeDashArray: [4, 4],
          opacity: 0.9,
          selectable: true,
          hasControls: true,
        });

        // Store indicator attribute so save understands it's redaction
        (activeRect as any).isRedact = true;
        canvas.add(activeRect);
        canvas.setActiveObject(activeRect);
      }
    });

    canvas.on('mouse:move', (options: any) => {
      if (!isMouseDown || !activeRect || !options.absolutePointer) return;
      const curX = options.absolutePointer.x;
      const curY = options.absolutePointer.y;

      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);
      const left = Math.min(curX, startX);
      const top = Math.min(curY, startY);

      activeRect.set({ left, top, width: w, height: h });
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      if (isMouseDown) {
        isMouseDown = false;
        activeRect = null;
        saveActiveFabricState();
      }
    });

    // Handle modification save hookups
    canvas.on('object:modified', () => saveActiveFabricState());
    canvas.on('object:removed', () => saveActiveFabricState());

    return () => {
      if (fabricCanvasInst.current) {
        fabricCanvasInst.current.dispose();
      }
    };
  }, [pageBackgroundUrl, selectedPage, activeTool, isLoadingPage]);

  // Synchronize controls with active objects
  const handleFabricSelection = (e: any) => {
    const selected = e.selected?.[0];
    if (!selected) {
      setFabricSelection(null);
      return;
    }

    if (selected instanceof fabric.Textbox) {
      setFabricSelection({
        type: 'text',
        fontSize: selected.fontSize || 16,
        color: selected.fill as string || '#000000',
        fontFamily: selected.fontFamily || 'Inter',
        textAlign: selected.textAlign || 'left',
        lineHeight: selected.lineHeight || 1.2,
        charSpacing: selected.charSpacing || 0,
      });
      // Match toolbar states
      setActiveFont(selected.fontFamily || 'Inter, sans-serif');
      setActiveFontSize(selected.fontSize || 16);
      setActiveColor(selected.fill as string || '#000000');
    } else if (selected.get('type') === 'rect' && (selected as any).isRedact) {
      setFabricSelection({
        type: 'redact',
        fontSize: 16,
        color: '#ffffff',
        fontFamily: 'Inter',
        textAlign: 'left',
        lineHeight: 1.2,
        charSpacing: 0,
      });
    }
  };

  // Convert current Canvas layers to state structure
  const saveActiveFabricState = () => {
    const canvas = fabricCanvasInst.current;
    if (!canvas) return;
    const json = canvas.toJSON();
    // Inject the isRedact property inside serialized JSON objects contextually
    const objects = canvas.getObjects();
    json.objects = json.objects.map((o: any, idx: number) => {
      const liveObj = objects[idx];
      if (liveObj && (liveObj as any).isRedact) {
        o.isRedact = true;
      }
      return o;
    });

    setFabricPageStates(prev => ({ ...prev, [selectedPage]: json }));
  };

  // Modify active text values
  const handleStyleChange = (prop: string, val: any) => {
    const canvas = fabricCanvasInst.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();

    if (activeObj && activeObj instanceof fabric.Textbox) {
      activeObj.set(prop as any, val);
      canvas.renderAll();
      saveActiveFabricState();
      
      // Update selected state sync
      setFabricSelection(prev => prev ? { ...prev, [prop]: val } : null);
    }

    // Always update global editor tool selections
    if (prop === 'fontFamily') setActiveFont(val);
    if (prop === 'fontSize') setActiveFontSize(val);
    if (prop === 'fill') setActiveColor(val);
    if (prop === 'textAlign') setActiveAlign(val);
    if (prop === 'lineHeight') setActiveLineHeight(val);
    if (prop === 'charSpacing') setActiveLetterSpacing(val);
  };

  // Delete matching canvas item
  const handleDeleteSelected = () => {
    const canvas = fabricCanvasInst.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      canvas.remove(activeObj);
      canvas.discardActiveObject();
      canvas.renderAll();
      saveActiveFabricState();
      setFabricSelection(null);
    }
  };

  // File picker handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const item = e.target.files[0];
    const dataBuf = await item.arrayBuffer();
    setFile({
      name: item.name,
      size: item.size,
      bytes: new Uint8Array(dataBuf),
    });
  };

  // Existing PDF items contenteditable change
  const handleExistingTextEdit = (itemId: string, updatedStr: string) => {
    setExistingTextEdits(prev => {
      const items = prev[selectedPage] || [];
      return {
        ...prev,
        [selectedPage]: items.map(item => 
          item.id === itemId 
            ? { ...item, text: updatedStr, isEdited: true, color: activeColor } 
            : item
        )
      };
    });
  };

  // Watermark uploads helper
  const handleWatermarkImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    const reader = new FileReader();
    reader.onload = () => {
      setWatermarkImageSrc(reader.result as string);
      // Save raw bytes
      const b64 = (reader.result as string).split(',')[1];
      const binaryString = window.atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      setWatermarkImageBytes(bytes);
    };
    reader.readAsDataURL(uploaded);
  };

  // Convert hex color code to pdfRgb
  const hexToPdfRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  };

  // Core Compile Document and stamps using pdf-lib
  const compileAndSaveFullDocument = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const pdfDoc = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const pagesCount = pdfDoc.getPageCount();

      // Retrieve standard fonts
      const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

      // Save local page changes to avoid missing edits on the active page
      saveActiveFabricState();

      // Go page by page
      for (let pIdx = 0; pIdx < pagesCount; pIdx++) {
        const page = pdfDoc.getPage(pIdx);
        const { width: pdfWidth, height: pdfHeight } = page.getSize();

        // Check if there are edits on this page
        const existingEdits = existingTextEdits[pIdx] || [];
        const scaleX = pdfWidth / pageDimensions.width;
        const scaleY = pdfHeight / pageDimensions.height;

        // 1. Process Handled Existing Text Layer replacements
        for (const item of existingEdits) {
          if (item.isEdited) {
            // Draw secure background white block to cover old text
            page.drawRectangle({
              x: item.left * scaleX - 1,
              y: (pageDimensions.height - item.top - item.height) * scaleY - 1,
              width: item.width * scaleX + 2,
              height: item.height * scaleY + 2,
              color: rgb(1, 1, 1), // Block cover
            });

            // Map styled edit back to standard PDF font
            const matchingFont = item.fontFamily.toLowerCase().includes('serif') ? fontTimes : fontHelvetica;

            // Draw replacement text safely
            page.drawText(item.text, {
              x: item.left * scaleX,
              y: (pageDimensions.height - item.top - item.height + 2) * scaleY,
              size: item.fontSize * scaleY * 0.9,
              font: matchingFont,
              color: hexToPdfRgb(item.color || '#000000'),
            });
          }
        }

        // 2. Process Fabric context items
        const rawJsonState = fabricPageStates[pIdx];
        if (rawJsonState && rawJsonState.objects) {
          for (const obj of rawJsonState.objects) {
            // Check if object is a Whiteout block redaction
            if (obj.isRedact) {
              const rx = obj.left * scaleX;
              const ry = (pageDimensions.height - obj.top - (obj.height * obj.scaleY)) * scaleY;
              const rw = obj.width * obj.scaleX * scaleX;
              const rh = obj.height * obj.scaleY * scaleY;

              page.drawRectangle({
                x: rx,
                y: ry,
                width: rw,
                height: rh,
                color: rgb(1, 1, 1), // cover perfectly
              });
            }

            // Check if object is a newly Added Textbox
            if (obj.type === 'textbox') {
              const tx = obj.left * scaleX;
              const ty = (pageDimensions.height - obj.top - (obj.height * obj.scaleY)) * scaleY;
              const fSize = obj.fontSize * obj.scaleY * scaleY;

              // Find closest standard embedded font
              let textFont = fontHelvetica;
              if (obj.fontFamily?.toLowerCase().includes('serif')) {
                textFont = fontTimes;
              } else if (obj.fontFamily?.toLowerCase().includes('mono')) {
                textFont = fontCourier;
              }

              // Multi-line support
              const itemLines = (obj.text || '').split('\n');
              const textHeight = fSize;
              const heightOffset = (obj.lineHeight || 1.16) * textHeight;

              itemLines.forEach((line: string, lineIdx: number) => {
                const lineY = ty + ((itemLines.length - 1 - lineIdx) * heightOffset);
                page.drawText(line, {
                  x: tx,
                  y: lineY,
                  size: fSize * 0.95,
                  color: hexToPdfRgb(obj.fill || '#000000'),
                  font: textFont,
                });
              });
            }
          }
        }

        // 3. Process dynamic Watermarks
        if (watermarkType === 'text' && watermarkText) {
          const wFont = fontHelveticaBold;
          const color = hexToPdfRgb(watermarkColor);
          const width = wFont.widthOfTextAtSize(watermarkText, watermarkFontSize);
          const rad = watermarkLayout === 'diagonal' ? degrees(45) : degrees(0);

          let wx = pdfWidth / 2 - width / 2;
          let wy = pdfHeight / 2 - watermarkFontSize / 2;

          if (watermarkLayout === 'diagonal') {
            // Push center left diagonally
            wx = pdfWidth / 2 - (width / 2) * Math.cos(Math.PI / 4);
            wy = pdfHeight / 2 - (width / 2) * Math.sin(Math.PI / 4) + 10;
          }

          page.drawText(watermarkText, {
            x: wx,
            y: wy,
            size: watermarkFontSize,
            font: wFont,
            color: color,
            opacity: watermarkOpacity,
            rotate: rad,
          });
        } else if (watermarkType === 'image' && watermarkImageBytes) {
          let embeddedImg;
          try {
            if (watermarkImageSrc?.includes('image/png')) {
              embeddedImg = await pdfDoc.embedPng(watermarkImageBytes);
            } else {
              embeddedImg = await pdfDoc.embedJpg(watermarkImageBytes);
            }

            const dims = embeddedImg.scale(watermarkImageScale);
            page.drawImage(embeddedImg, {
              x: pdfWidth / 2 - dims.width / 2,
              y: pdfHeight / 2 - dims.height / 2,
              width: dims.width,
              height: dims.height,
              opacity: watermarkOpacity,
            });
          } catch (imgErr) {
            console.error('Image Watermark compilation issue:', imgErr);
          }
        }

        // 4. Process Headers and Footers stampings
        const labelMargin = 30;
        const headerY = pdfHeight - 25;
        const footerY = 25;
        const infoDateStr = new Date().toLocaleDateString();

        // Render generic header labels
        if (headerLeft) {
          page.drawText(headerLeft, { x: labelMargin, y: headerY, size: 8.5, font: fontHelvetica, color: rgb(0.35, 0.35, 0.35) });
        }
        if (headerCenter) {
          const fontW = fontHelvetica.widthOfTextAtSize(headerCenter, 8.5);
          page.drawText(headerCenter, { x: pdfWidth / 2 - fontW / 2, y: headerY, size: 8.5, font: fontHelvetica, color: rgb(0.35, 0.35, 0.35) });
        }
        if (headerRight) {
          const fontW = fontHelvetica.widthOfTextAtSize(headerRight, 8.5);
          page.drawText(headerRight, { x: pdfWidth - labelMargin - fontW, y: headerY, size: 8.5, font: fontHelvetica, color: rgb(0.35, 0.35, 0.35) });
        }

        // Render generic footer labels
        if (footerLeft) {
          page.drawText(footerLeft, { x: labelMargin, y: footerY, size: 8.5, font: fontHelvetica, color: rgb(0.35, 0.35, 0.35) });
        }
        if (footerCenter) {
          const fontW = fontHelvetica.widthOfTextAtSize(footerCenter, 8.5);
          page.drawText(footerCenter, { x: pdfWidth / 2 - fontW / 2, y: footerY, size: 8.5, font: fontHelvetica, color: rgb(0.35, 0.35, 0.35) });
        }
        if (footerRight) {
          const fontW = fontHelvetica.widthOfTextAtSize(footerRight, 8.5);
          page.drawText(footerRight, { x: pdfWidth - labelMargin - fontW, y: footerY, size: 8.5, font: fontHelvetica, color: rgb(0.35, 0.35, 0.35) });
        }

        // Dynamic page stamp math
        if (includePageNumbers) {
          const numberText = `Page ${pIdx + 1} of ${pagesCount}`;
          const targetY = pageNumberPosition === 'header' ? headerY : footerY;
          const w = fontHelvetica.widthOfTextAtSize(numberText, 8.5);

          let px = pdfWidth / 2 - w / 2;
          if (pageNumberAlign === 'left') px = labelMargin;
          else if (pageNumberAlign === 'right') px = pdfWidth - labelMargin - w;

          page.drawText(numberText, { x: px, y: targetY, size: 8.5, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3) });
        }

        // Dynamic date stamp math
        if (includeDate) {
          const targetY = datePosition === 'header' ? headerY : footerY;
          const w = fontHelvetica.widthOfTextAtSize(infoDateStr, 8.5);

          let dx = pdfWidth / 2 - w / 2;
          if (dateAlign === 'left') dx = labelMargin;
          else if (dateAlign === 'right') dx = pdfWidth - labelMargin - w;

          page.drawText(infoDateStr, { x: dx, y: targetY, size: 8.5, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3) });
        }
      }

      // Output compiling
      const outBytes = await pdfDoc.save();
      const outputBlob = new Blob([outBytes], { type: 'application/pdf' });
      const outBlobUrl = URL.createObjectURL(outputBlob);
      const name = `${file.name.replace(/\.pdf$/i, '')}_edited_v2.pdf`;

      setOutputUrl(outBlobUrl);
      setOutputSize(outBytes.length);
      setOutputName(name);

      onSuccess(name, outBytes.length, outBytes);
    } catch (err: any) {
      console.error(err);
      toast.error('Error rendering text modifications layer into PDF: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentEditsList = existingTextEdits[selectedPage] || [];

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-900/40 transition group cursor-pointer relative">
          <input
            id="editor-uploader-input"
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-slate-850 rounded-full text-indigo-400 group-hover:bg-slate-800 group-hover:text-indigo-300 transition">
              <Type size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Upload a document to start editing, or <span className="text-indigo-400 hover:underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Edit existing text, place formatting tags, draw redactions, headers, footers and diagonal watermarks.
              </p>
            </div>
          </div>
        </div>
      ) : !outputUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left items-start">
          
          {/* Controls Panel (Left, 4 Columns) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6 shadow-xl max-h-[85vh] overflow-y-auto">
            
            {/* Core Tool Selection Tabs */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Editor Tool Strategy
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                <button
                  type="button"
                  onClick={() => { setActiveTool('existing'); if(fabricCanvasInst.current) fabricCanvasInst.current.discardActiveObject().renderAll(); }}
                  className={`py-1.5 text-[11px] font-semibold rounded-md transition ${
                    activeTool === 'existing'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Edit Existing
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('add')}
                  className={`py-1.5 text-[11px] font-semibold rounded-md transition ${
                    activeTool === 'add'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Add Text
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('redact')}
                  className={`py-1.5 text-[11px] font-semibold rounded-md transition ${
                    activeTool === 'redact'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Redact (Del)
                </button>
              </div>
            </div>

            {/* Config controls contextually based on Active Tool */}
            {activeTool === 'existing' && (
              <div className="space-y-4 p-3 bg-slate-950/80 border border-slate-850 rounded-lg">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs font-mono">
                  <Heading size={14} />
                  <span>Existing Text Detector</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Hover over any original text block on the document page, double click to input replacements, or modify its color accent!
                </p>
                <div className="space-y-2 pt-2 border-t border-slate-900">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                    <span>Accent Replacement Color</span>
                    <span className="text-slate-200">{activeColor}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['#000000', '#ef4444', '#2563eb', '#16a34a', '#d97706', '#7c3aed'].map((c) => (
                      <button
                        key={c}
                        onClick={() => handleStyleChange('fill', c)}
                        style={{ backgroundColor: c }}
                        className={`h-4 w-4 rounded-full border-2 border-slate-900 transition ${
                          activeColor === c ? 'ring-1 ring-indigo-500 scale-110' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTool === 'add' && (
              <div className="space-y-4 bg-slate-950/60 p-4 border border-slate-850 rounded-lg">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <span className="text-[11px] font-bold text-indigo-400 font-mono">TEXT PROPERTIES</span>
                  {fabricSelection?.type === 'text' && (
                    <button
                      onClick={handleDeleteSelected}
                      className="text-red-400 hover:text-red-300 text-[10px] uppercase font-bold flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Delete Block
                    </button>
                  )}
                </div>

                {/* Font selector */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-550 font-semibold font-mono">Font Family</label>
                  <select
                    value={activeFont}
                    onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
                  >
                    {SUPPORTED_FONTS.map((fIdx) => (
                      <option key={fIdx.value} value={fIdx.value}>{fIdx.label}</option>
                    ))}
                  </select>
                </div>

                {/* Font color and size */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-550 font-semibold font-mono">Font Size ({activeFontSize}px)</label>
                    <input
                      type="range"
                      min="8"
                      max="48"
                      value={activeFontSize}
                      onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                      className="w-full cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-550 font-semibold font-mono">Fill Color</label>
                    <input
                      type="color"
                      value={activeColor}
                      onChange={(e) => handleStyleChange('fill', e.target.value)}
                      className="w-full h-8 bg-transparent rounded border border-slate-800 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Paragraph Alignments and Spacings */}
                <div className="space-y-3 pt-3 border-t border-slate-900">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-550 font-semibold font-mono">Alignment</label>
                    <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-900 rounded-md">
                      <button
                        onClick={() => handleStyleChange('textAlign', 'left')}
                        className={`p-1 flex justify-center rounded ${activeAlign === 'left' ? 'bg-indigo-650 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        onClick={() => handleStyleChange('textAlign', 'center')}
                        className={`p-1 flex justify-center rounded ${activeAlign === 'center' ? 'bg-indigo-650 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        onClick={() => handleStyleChange('textAlign', 'right')}
                        className={`p-1 flex justify-center rounded ${activeAlign === 'right' ? 'bg-indigo-650 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        <AlignRight size={13} />
                      </button>
                      <button
                        onClick={() => handleStyleChange('textAlign', 'justify')}
                        className={`p-1 flex justify-center rounded ${activeAlign === 'justify' ? 'bg-indigo-650 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        <AlignJustify size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-550 font-semibold font-mono">
                      <span>Line Height</span>
                      <span>{activeLineHeight}</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="2.5"
                      step="0.1"
                      value={activeLineHeight}
                      onChange={(e) => handleStyleChange('lineHeight', parseFloat(e.target.value))}
                      className="w-full cursor-pointer accent-indigo-505"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-550 font-semibold font-mono">
                      <span>Letter Spacing</span>
                      <span>{activeLetterSpacing}px</span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="20"
                      value={activeLetterSpacing}
                      onChange={(e) => handleStyleChange('charSpacing', parseInt(e.target.value))}
                      className="w-full cursor-pointer accent-indigo-505"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTool === 'redact' && (
              <div className="space-y-3 p-3.5 bg-red-950/15 border border-red-900/30 rounded-lg">
                <span className="text-[11px] font-bold text-red-400 font-mono flex items-center gap-1">
                  <Trash2 size={13} /> Text Redactor Deletion
                </span>
                <p className="text-[11.5px] text-slate-400 leading-relaxed">
                  Click and drag white boxes over any layout regions! On compilation, standard background streams will be covered securely.
                </p>
                {fabricSelection?.type === 'redact' && (
                  <button
                    onClick={handleDeleteSelected}
                    className="w-full py-1.5 bg-red-900/35 hover:bg-red-900 text-red-200 text-xs font-bold rounded-md transition flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} /> Remove Redact Box
                  </button>
                )}
              </div>
            )}

            {/* Headers and Footers Section */}
            <div className="border-t border-slate-800 pt-5 space-y-4">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-2">
                <Layout size={13} /> Headers & Footers
              </span>

              <div className="space-y-3 bg-slate-950/40 p-3 border border-slate-850 rounded-lg">
                <div>
                  <label className="text-[10px] font-bold text-slate-550 font-mono block mb-1">Header Custom Texts (Left / Center / Right)</label>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="text"
                      value={headerLeft}
                      onChange={(e) => setHeaderLeft(e.target.value)}
                      placeholder="Left"
                      className="bg-slate-900 border border-slate-805 text-slate-300 text-[10px] rounded px-1.5 py-1"
                    />
                    <input
                      type="text"
                      value={headerCenter}
                      onChange={(e) => setHeaderCenter(e.target.value)}
                      placeholder="Center"
                      className="bg-slate-900 border border-slate-805 text-slate-300 text-[10px] rounded px-1.5 py-1"
                    />
                    <input
                      type="text"
                      value={headerRight}
                      onChange={(e) => setHeaderRight(e.target.value)}
                      placeholder="Right"
                      className="bg-slate-900 border border-slate-805 text-slate-300 text-[10px] rounded px-1.5 py-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-550 font-mono block mb-1">Footer Custom Texts (Left / Center / Right)</label>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="text"
                      value={footerLeft}
                      onChange={(e) => setFooterLeft(e.target.value)}
                      placeholder="Left"
                      className="bg-slate-900 border border-slate-805 text-slate-300 text-[10px] rounded px-1.5 py-1"
                    />
                    <input
                      type="text"
                      value={footerCenter}
                      onChange={(e) => setFooterCenter(e.target.value)}
                      placeholder="Center"
                      className="bg-slate-900 border border-slate-805 text-slate-300 text-[10px] rounded px-1.5 py-1"
                    />
                    <input
                      type="text"
                      value={footerRight}
                      onChange={(e) => setFooterRight(e.target.value)}
                      placeholder="Right"
                      className="bg-slate-900 border border-slate-805 text-slate-300 text-[10px] rounded px-1.5 py-1"
                    />
                  </div>
                </div>

                {/* Page Number Settings */}
                <div className="pt-2 border-t border-slate-900">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs py-1 select-none font-semibold">
                    <input
                      type="checkbox"
                      checked={includePageNumbers}
                      onChange={(e) => setIncludePageNumbers(e.target.checked)}
                      className="accent-indigo-600 rounded border-slate-800"
                    />
                    Include Page Numbers
                  </label>
                  {includePageNumbers && (
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <select
                        value={pageNumberPosition}
                        onChange={(e: any) => setPageNumberPosition(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded text-[9.5px] px-1 py-1 text-slate-350"
                      >
                        <option value="footer">Footer (Bottom)</option>
                        <option value="header">Header (Top)</option>
                      </select>
                      <select
                        value={pageNumberAlign}
                        onChange={(e: any) => setPageNumberAlign(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded text-[9.5px] px-1 py-1 text-slate-350"
                      >
                        <option value="left">Left Aligned</option>
                        <option value="center">Centered</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Current date stamping */}
                <div className="pt-2 border-t border-slate-900">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs py-1 select-none font-semibold">
                    <input
                      type="checkbox"
                      checked={includeDate}
                      onChange={(e) => setIncludeDate(e.target.checked)}
                      className="accent-indigo-600 rounded border-slate-800"
                    />
                    Include Processed Date
                  </label>
                  {includeDate && (
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <select
                        value={datePosition}
                        onChange={(e: any) => setDatePosition(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded text-[9.5px] px-1 py-1 text-slate-350"
                      >
                        <option value="footer">Footer (Bottom)</option>
                        <option value="header">Header (Top)</option>
                      </select>
                      <select
                        value={dateAlign}
                        onChange={(e: any) => setDateAlign(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded text-[9.5px] px-1 py-1 text-slate-350"
                      >
                        <option value="left">Left Aligned</option>
                        <option value="center">Centered</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Watermarks Configurations */}
            <div className="border-t border-slate-800 pt-5 space-y-4">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-2">
                <Tag size={13} /> Save Watermarks
              </span>

              <div className="space-y-3 bg-slate-950/40 p-3 border border-slate-850 rounded-lg">
                <div className="grid grid-cols-3 gap-1 bg-slate-900 p-0.5 rounded-md text-[10px] font-mono">
                  <button
                    onClick={() => setWatermarkType('none')}
                    className={`py-1 rounded ${watermarkType === 'none' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    None
                  </button>
                  <button
                    onClick={() => setWatermarkType('text')}
                    className={`py-1 rounded ${watermarkType === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Text
                  </button>
                  <button
                    onClick={() => setWatermarkType('image')}
                    className={`py-1 rounded ${watermarkType === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Image
                  </button>
                </div>

                {watermarkType === 'text' && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Watermark Text</label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs px-2 py-1 rounded"
                        placeholder="e.g. CONFIDENTIAL"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Color</label>
                        <input
                          type="color"
                          value={watermarkColor}
                          onChange={(e) => setWatermarkColor(e.target.value)}
                          className="w-full h-7 bg-transparent rounded border border-slate-800 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Size</label>
                        <select
                          value={watermarkFontSize}
                          onChange={(e) => setWatermarkFontSize(parseInt(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs"
                        >
                          {[24, 32, 40, 48, 56, 64, 72].map(s => (
                            <option key={s} value={s}>{s} px</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Rotation</label>
                        <select
                          value={watermarkLayout}
                          onChange={(e: any) => setWatermarkLayout(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs"
                        >
                          <option value="diagonal">Diagonal (45°)</option>
                          <option value="center">Centered (0°)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Opacity</label>
                        <input
                          type="range"
                          min="0.05"
                          max="0.8"
                          step="0.05"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full cursor-pointer accent-indigo-505"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {watermarkType === 'image' && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Watermark Image</label>
                      <button
                        onClick={() => watermarkImgInputRef.current?.click()}
                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 transition rounded text-[10.5px] font-semibold text-slate-300 flex items-center justify-center gap-1.5"
                      >
                        <ImageIcon size={12} />
                        {watermarkImageSrc ? 'Update Image Logo' : 'Select Image Watermark'}
                      </button>
                      <input
                        type="file"
                        ref={watermarkImgInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleWatermarkImageUpload}
                      />
                    </div>
                    {watermarkImageSrc && (
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-900 pt-2">
                        <div>
                          <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Image Scale</label>
                          <input
                            type="range"
                            min="0.1"
                            max="1.5"
                            step="0.1"
                            value={watermarkImageScale}
                            onChange={(e) => setWatermarkImageScale(parseFloat(e.target.value))}
                            className="w-full cursor-pointer accent-indigo-505"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-slate-550 font-semibold block mb-0.5">Opacity</label>
                          <input
                            type="range"
                            min="0.05"
                            max="0.9"
                            step="0.05"
                            value={watermarkOpacity}
                            onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                            className="w-full cursor-pointer accent-indigo-505"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Save trigger download block */}
            <button
              onClick={compileAndSaveFullDocument}
              disabled={isProcessing}
              className="w-full mt-4 py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-850 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Compiling layouts & watermarks...
                </>
              ) : (
                <>Apply Modifications & Download</>
              )}
            </button>
          </div>

          {/* Render Area (Right, 8 Columns) */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xl min-h-[75vh] select-none relative">
            
            {/* Nav and state triggers */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-850 gap-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-950 rounded-lg text-indigo-400 border border-slate-850">
                  <FileText size={14} />
                </div>
                <div className="text-xs">
                  <span className="text-slate-500">Document:</span> <strong className="text-slate-300 font-bold max-w-xs truncate inline-block align-bottom">{file.name}</strong>
                </div>
              </div>

              {/* Page pager selection */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 rounded-lg px-2 py-1">
                <button
                  disabled={selectedPage === 0}
                  onClick={() => setSelectedPage(p => Math.max(0, p - 1))}
                  className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-25 transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-slate-350 font-bold font-mono">
                  {selectedPage + 1} / {totalPages}
                </span>
                <button
                  disabled={selectedPage === totalPages - 1}
                  onClick={() => setSelectedPage(p => Math.min(totalPages - 1, p + 1))}
                  className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-25 transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Interactive Layout Stage */}
            <div className="flex-grow flex justify-center py-4 relative min-h-[55vh] items-center">
              {isLoadingPage ? (
                <div className="flex flex-col items-center space-y-2 text-indigo-400">
                  <RefreshCw className="animate-spin text-indigo-400" size={28} />
                  <span className="text-xs font-mono">Parsing page layers...</span>
                </div>
              ) : pageBackgroundUrl ? (
                <div 
                  className="relative shadow-2xl border border-slate-700/50 rounded overflow-hidden"
                  style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
                >
                  {/* Background Rendered PDF Img representation */}
                  <img
                    src={pageBackgroundUrl}
                    alt="Active rendered page layer"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                  />

                  {/* Existing Text layer for standard selective contenteditables */}
                  {activeTool === 'existing' && (
                    <div className="absolute inset-0 z-10 pointer-events-auto">
                      {currentEditsList.map((item) => (
                        <div
                          key={item.id}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => handleExistingTextEdit(item.id, e.currentTarget.textContent || '')}
                          style={{
                            position: 'absolute',
                            left: `${item.left}px`,
                            top: `${item.top}px`,
                            minWidth: `${Math.max(20, item.width)}px`,
                            height: `${item.height}px`,
                            fontSize: `${item.fontSize}px`,
                            fontFamily: item.fontFamily,
                            color: item.isEdited ? item.color : 'transparent', // Make original text transparent so only user replacements show!
                            backgroundColor: item.isEdited ? 'rgba(99, 102, 241, 0.1)' : 'rgba(37, 99, 235, 0.04)',
                            outline: 'none',
                          }}
                          className={`hover:bg-indigo-300/[0.15] focus:bg-indigo-100/[0.2] transition selection:bg-indigo-500/35 border border-transparent hover:border-indigo-400/50 rounded cursor-text truncate px-0.5 text-left leading-none`}
                          title="Double click to replace original words"
                        >
                          {item.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fabric Interactive Workspace */}
                  <div 
                    className="absolute inset-0 pointer-events-auto"
                    style={{ zIndex: activeTool === 'existing' ? 5 : 20 }}
                  >
                    <canvas ref={fabricRef} />
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs font-mono">No active visual view found.</div>
              )}
            </div>

            <div className="flex justify-between items-center border-t border-slate-850 pt-3 text-[10.5px] text-slate-500">
              <span className="flex items-center gap-1">
                <HelpCircle size={12} className="text-slate-550" />
                {activeTool === 'existing' && 'Drag to highlight original text. Click to edit/overwrite words.'}
                {activeTool === 'add' && 'Double-click anywhere to input new customized text tags.'}
                {activeTool === 'redact' && 'Drag rectangles over any document elements to whiteout redact.'}
              </span>
              <button
                onClick={() => { setFile(null); }}
                className="text-indigo-400 font-semibold hover:underline"
              >
                Upload another file
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* OUTPUT VIEW SCREEN */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl max-w-2xl mx-auto space-y-6 text-center animate-fade-in">
          <div className="flex justify-center">
            <div className="p-3 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-850 shadow-inner">
              <CheckCircle size={36} />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-205">PDF Stamps & Modifications Sealed!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Existing text overwrites, header labels, footer parameters, and Confidential watermarks applied successfully.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 pr-2 text-left">
              <FileText className="text-emerald-400 flex-shrink-0" size={24} />
              <div className="truncate">
                <p className="text-xs font-bold text-slate-201 truncate">{outputName}</p>
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

          <button
            onClick={() => { setOutputUrl(null); }}
            className="text-xs text-indigo-400 hover:underline font-semibold"
          >
            Return to PDF Editor
          </button>
        </div>
      )}
    </div>
  );
}
