"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Document, Page, pdfjs } from "react-pdf";
import fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  StickyNote,
  Pen,
  Save,
  Download,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

// Configure PDF.js worker (works with pdfjs-dist@3)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();

interface Annotation {
  id: string;
  document_id: string;
  user_id: string;
  page_number: number;
  annotation_type: "sticky_note" | "drawing";
  content: any;
  sequence_number: number;
  position_x: number;
  position_y: number;
  created_at: string;
  user?: { full_name: string };
}

interface Document {
  id: string;
  title: string;
  file_url: string;
}

interface PdfViewerProps {
  document: Document;
  onClose: () => void;
}

export function PdfViewer({ document, onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedTool, setSelectedTool] = useState<"view" | "sticky" | "draw">(
    "view"
  );
  const [showStickyForm, setShowStickyForm] = useState(false);
  const [stickyContent, setStickyContent] = useState("");
  const [stickyPosition, setStickyPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [nextSequenceNumber, setNextSequenceNumber] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  useEffect(() => {
    fetchAnnotations();
  }, [document.id, currentPage]);

  useEffect(() => {
    if (selectedTool === "draw" && canvasRef.current && !canvas) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        isDrawingMode: true,
      });

      fabricCanvas.freeDrawingBrush.width = 2;
      fabricCanvas.freeDrawingBrush.color = "#3B82F6";

      setCanvas(fabricCanvas);

      return () => {
        fabricCanvas.dispose();
        setCanvas(null);
      };
    }
  }, [selectedTool, canvas]);

  const fetchAnnotations = async () => {
    try {
      const response = await fetch(
        `/api/annotations?documentId=${document.id}&pageNumber=${currentPage}`
      );
      if (response.ok) {
        const { annotations } = await response.json();
        setAnnotations(annotations);
        const maxSeq = Math.max(
          0,
          ...annotations.map((a: Annotation) => a.sequence_number)
        );
        setNextSequenceNumber(maxSeq + 1);
      }
    } catch (error) {
      console.error("Failed to fetch annotations:", error);
    }
  };

  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== "sticky" || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setStickyPosition({ x, y });
    setShowStickyForm(true);
  };

  const saveStickyNote = async () => {
    if (!stickyContent.trim() || !stickyPosition || !profile) return;

    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          pageNumber: currentPage,
          annotationType: "sticky_note",
          content: { text: stickyContent.trim() },
          sequenceNumber: nextSequenceNumber,
          positionX: stickyPosition.x,
          positionY: stickyPosition.y,
        }),
      });

      if (response.ok) {
        toast.success("Sticky note added successfully");
        setStickyContent("");
        setShowStickyForm(false);
        setStickyPosition(null);
        setSelectedTool("view");
        fetchAnnotations();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save annotation");
      }
    } catch (error) {
      console.error("Save annotation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save annotation"
      );
    }
  };

  const saveDrawing = async () => {
    if (!canvas || !profile) return;

    const drawingData = canvas.toJSON();

    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          pageNumber: currentPage,
          annotationType: "drawing",
          content: drawingData,
          sequenceNumber: nextSequenceNumber,
          positionX: 0,
          positionY: 0,
        }),
      });

      if (response.ok) {
        toast.success("Drawing saved successfully");
        canvas.clear();
        setSelectedTool("view");
        fetchAnnotations();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save drawing");
      }
    } catch (error) {
      console.error("Save drawing error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save drawing"
      );
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="flex h-screen">
      {/* PDF Viewer */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <h3 className="text-lg font-semibold">{document.title}</h3>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant={selectedTool === "sticky" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setSelectedTool(selectedTool === "sticky" ? "view" : "sticky")
              }
            >
              <StickyNote className="h-4 w-4 mr-1" />
              Sticky Note
            </Button>
            <Button
              variant={selectedTool === "draw" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setSelectedTool(selectedTool === "draw" ? "view" : "draw")
              }
            >
              <Pen className="h-4 w-4 mr-1" />
              Draw
            </Button>
            {selectedTool === "draw" && canvas && (
              <Button size="sm" onClick={saveDrawing}>
                <Save className="h-4 w-4 mr-1" />
                Save Drawing
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Page Controls */}
        <div className="bg-gray-50 border-b p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(numPages, prev + 1))
              }
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.min(2.0, prev + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <div
              ref={pageRef}
              className="relative inline-block bg-white shadow-lg"
              onClick={handlePageClick}
              style={{
                cursor: selectedTool === "sticky" ? "crosshair" : "default",
              }}
            >
              <Document
                file={document.file_url}
                onLoadSuccess={onDocumentLoadSuccess}
                className="pdf-document"
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  className="pdf-page"
                />
              </Document>

              {/* Drawing Canvas Overlay */}
              {selectedTool === "draw" && (
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 pointer-events-auto"
                  style={{
                    width: "100%",
                    height: "100%",
                    zIndex: 10,
                  }}
                />
              )}

              {/* Sticky Note Annotations */}
              {annotations
                .filter((a) => a.annotation_type === "sticky_note")
                .map((annotation) => (
                  <div
                    key={annotation.id}
                    className="absolute bg-yellow-200 border border-yellow-400 rounded p-2 shadow-md max-w-48"
                    style={{
                      left: `${annotation.position_x}%`,
                      top: `${annotation.position_y}%`,
                      zIndex: 20,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        #{annotation.sequence_number}
                      </Badge>
                      <span className="text-xs text-gray-600">
                        {annotation.user?.full_name}
                      </span>
                    </div>
                    <p className="text-sm">{annotation.content.text}</p>
                  </div>
                ))}

              {/* Sticky Note Form */}
              {showStickyForm && stickyPosition && (
                <div
                  className="absolute bg-yellow-100 border border-yellow-400 rounded p-3 shadow-lg z-30"
                  style={{
                    left: `${stickyPosition.x}%`,
                    top: `${stickyPosition.y}%`,
                    minWidth: "200px",
                  }}
                >
                  <div className="mb-2">
                    <Badge variant="outline" className="text-xs">
                      #{nextSequenceNumber}
                    </Badge>
                  </div>
                  <Textarea
                    placeholder="Add your note..."
                    value={stickyContent}
                    onChange={(e) => setStickyContent(e.target.value)}
                    className="mb-2 min-h-20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveStickyNote}>
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowStickyForm(false);
                        setStickyPosition(null);
                        setStickyContent("");
                        setSelectedTool("view");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Annotations Sidebar */}
      <div className="w-80 bg-white border-l">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Annotations</h3>
          <p className="text-sm text-gray-600">
            Page {currentPage} annotations
          </p>
        </div>

        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {annotations.length === 0 ? (
              <div className="text-center py-8">
                <StickyNote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  No annotations on this page
                </p>
              </div>
            ) : (
              annotations.map((annotation) => (
                <Card key={annotation.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      #{annotation.sequence_number}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {annotation.annotation_type === "sticky_note"
                        ? "Note"
                        : "Drawing"}
                    </span>
                  </div>
                  {annotation.annotation_type === "sticky_note" && (
                    <p className="text-sm mb-2">{annotation.content.text}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    by {annotation.user_name}
                  </p>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
