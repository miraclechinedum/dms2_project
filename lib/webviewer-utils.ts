// Utility functions for WebViewer integration

export interface WebViewerAnnotation {
  id: string;
  pageNumber: number;
  type: 'sticky' | 'freehand' | 'highlight' | 'text';
  content: any;
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  style: {
    color?: string;
    strokeColor?: string;
    fillColor?: string;
    thickness?: number;
  };
  author: string;
  createdAt: string;
  modifiedAt: string;
}

// Convert API annotation to WebViewer format
export function convertApiToWebViewer(apiAnnotation: any): WebViewerAnnotation {
  return {
    id: apiAnnotation.id,
    pageNumber: apiAnnotation.page_number,
    type: apiAnnotation.annotation_type === 'sticky_note' ? 'sticky' : 'freehand',
    content: apiAnnotation.content,
    position: {
      x: apiAnnotation.position_x,
      y: apiAnnotation.position_y,
    },
    style: {
      color: apiAnnotation.content.color || '#fef08a',
      thickness: apiAnnotation.content.thickness || 3,
    },
    author: apiAnnotation.user_name || 'Unknown',
    createdAt: apiAnnotation.created_at,
    modifiedAt: apiAnnotation.created_at,
  };
}

// Convert WebViewer annotation to API format
export function convertWebViewerToApi(annotation: any, documentId: string, userId: string) {
  const rect = annotation.getRect();
  const pageInfo = annotation.getPageNumber();
  
  let annotationType: 'sticky_note' | 'drawing' = 'sticky_note';
  let content: any = {};

  if (annotation.elementName === 'stickyNote') {
    annotationType = 'sticky_note';
    content = {
      text: annotation.getContents() || 'New note',
      color: annotation.getColor()?.toHexString?.() || '#fef08a'
    };
  } else if (annotation.elementName === 'freeHand') {
    annotationType = 'drawing';
    content = {
      path: annotation.getPath(),
      color: annotation.getStrokeColor()?.toHexString?.() || '#22c55e',
      thickness: annotation.getStrokeThickness() || 3
    };
  }

  return {
    documentId,
    pageNumber: pageInfo,
    annotationType,
    content,
    positionX: rect.x1,
    positionY: rect.y1,
  };
}

// Color utilities
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

export function rgbToHex(r: number, g: number, b: number) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Validation utilities
export function validatePdfUrl(url: string): boolean {
  if (!url) return false;
  
  // Check if it's a valid URL or path
  try {
    new URL(url);
    return true;
  } catch {
    // Check if it's a valid path
    return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
  }
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isPdfFile(filename: string): boolean {
  return getFileExtension(filename) === 'pdf';
}