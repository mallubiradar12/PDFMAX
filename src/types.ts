export type ToolId =
  | 'merge'
  | 'split'
  | 'compress'
  | 'edit'
  | 'ocr'
  | 'sign'
  | 'convert-to'
  | 'convert-from'
  | 'organize'
  | 'protect'
  | 'repair'
  | 'pdf-docx'
  | 'pdf-xlsx'
  | 'pdf-pptx'
  | 'pdf-image'
  | 'pdf-html'
  | 'pdf-txt'
  | 'pdf-epub'
  | 'pdf-csv'
  | 'docx-pdf'
  | 'xlsx-pdf'
  | 'pptx-pdf'
  | 'image-pdf'
  | 'html-pdf'
  | 'md-pdf';

export type ToolCategory =
  | 'all'
  | 'organize'
  | 'security'
  | 'convert'
  | 'edit'
  | 'utility';

export interface PDFTool {
  id: ToolId;
  name: string;
  description: string;
  category: ToolCategory;
  longDescription: string;
  iconName: string; // we'll map this to lucide icons
  isBrowserSide: boolean;
  priority: number;
}

export interface RecentFile {
  id: string;
  name: string;
  size: number;
  toolUsed: ToolId;
  timestamp: number;
  downloadUrl?: string; // object URL or data URL
}

export interface PDFPageInfo {
  index: number;
  angle: number;
  isSelected: boolean;
  thumbnailUrl?: string;
  originalIndex: number;
}
