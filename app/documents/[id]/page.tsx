"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Document, Page, pdfjs } from "react-pdf";
import { fabric } from "fabric";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Palette,
  User,
  Building2,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "react-hot-toast";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

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
  user_name?: string;
}

interface Assignment {
  id: string;
  assigned_to_user?: string;
  assigned_to_department?: string;
  assigned_user_name?: string;
  assigned_department_name?: string;
}

interface DocumentData {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  status: string;
  created_at: string;
  uploader_name?: string;
  assignments?: Assignment[];
}

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedTool, setSelectedTool] = useState<"view" | "sticky" | "draw">("view");
  const [showStickyForm, setShowStickyForm] = useState(false);
  const [stickyContent, setStickyContent] = useState("");
  const [stickyPosition, setStickyPosition] = useState<{ x: number; y: number } | null>(null);
  const [stickyColor, setStickyColor] = useState("#fef08a"); // yellow-200
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [drawingColor, setDrawingColor] = useState("#3b82f6"); // blue-600
  const [nextSequenceNumber, setNextSequenceNumber] = useState(1);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (params.id) {
      fetchDocument();
    }
  }, [user, params.id, router]);

  useEffect(() => {
    if (document) {
      fetchAnnotations();
    }
  }, [document, currentPage]);

  useEffect(() => {
    if (selectedTool === "draw" && canvasRef.current && !canvas) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        isDrawingMode: true,
      });

      fabricCanvas.freeDrawingBrush.width = 3;
      fabricCanvas.freeDrawingBrush.color = drawingColor;

      setCanvas(fabricCanvas);

      return () => {
        fabricCanvas.dispose();
        setCanvas(null);
      };
    }
  }, [selectedTool, canvas, drawingColor]);

  useEffect(() => {
    if (canvas) {
      canvas.freeDrawingBrush.color = drawingColor;
    }
  }, [canvas, drawingColor]);

  const fetchDocument = async () => {
    console.log("Fetching document with ID:", params.id);
    try {
      const response = await fetch(`/api/documents/${params.id}`);
      console.log("Document fetch response status:", response.status);
      
      if (response.ok) {
        const { document } = await response.json();
        console.log("Document data received:", document);
        setDocument(document);
      } else {
        const errorText = await response.text();
        console.error("Document fetch error:", response.status, errorText);
        toast.error("Document not found");
        router.push("/documents");
      }
    } catch (error) {
      console.error("Failed to fetch document:", error);
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnotations = async () => {
    if (!document) return;

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

  const handlePageClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (selectedTool !== "sticky" || !pageRef.current) return;

      const rect = pageRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      setStickyPosition({ x, y });
      setShowStickyForm(true);
    },
    [selectedTool]
  );

  const saveStickyNote = async () => {
    if (!stickyContent.trim() || !stickyPosition || !user || !document) return;

    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          pageNumber: currentPage,
          annotationType: "sticky_note",
          content: { text: stickyContent.trim(), color: stickyColor },
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
    if (!canvas || !user || !document) return;

    const drawingData = canvas.toJSON();

    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          pageNumber: currentPage,
          annotationType: "drawing",
          content: { drawing: drawingData, color: drawingColor },
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

  const exportPDF = async () => {
    if (!document || !pageRef.current) return;

    try {
      const canvas = await html2canvas(pageRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${document.title}_annotated.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    console.log("✅ PDF loaded successfully with", numPages, "pages");
  };

  const onDocumentLoadError = (error: any) => {
    console.error("❌ PDF load error:", error);
    console.log("📄 Attempted to load:", document?.file_path);
    toast.error("Failed to load PDF. Please try refreshing the page.");
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading document...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Please sign in to view documents</p>
          </div>
        </main>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Document not found</p>
            <Button onClick={() => router.push("/documents")} className="mt-4">
              Back to Documents
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => router.push("/documents")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Documents
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {document.title}
              </h1>
              <p className="text-sm text-gray-600">
                Uploaded by {document.uploader_name} on{" "}
                {format(new Date(document.created_at), "MMM dd, yyyy")} •{" "}
                {formatFileSize(document.file_size)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Sticky Note Tool */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedTool === "sticky" ? "default" : "outline"}
                  size="sm"
                >
                  <StickyNote className="h-4 w-4 mr-1" />
                  Sticky Note
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <h4 className="font-medium">Sticky Note Settings</h4>
                  <div>
                    <label className="text-sm font-medium">Background Color</label>
                    <div className="mt-2">
                      <HexColorPicker color={stickyColor} onChange={setStickyColor} />
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      setSelectedTool(selectedTool === "sticky" ? "view" : "sticky")
                    }
                    className="w-full"
                  >
                    {selectedTool === "sticky" ? "Disable" : "Enable"} Sticky Notes
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Drawing Tool */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedTool === "draw" ? "default" : "outline"}
                  size="sm"
                >
                  <Pen className="h-4 w-4 mr-1" />
                  Draw
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <h4 className="font-medium">Drawing Settings</h4>
                  <div>
                    <label className="text-sm font-medium">Pen Color</label>
                    <div className="mt-2">
                      <HexColorPicker color={drawingColor} onChange={setDrawingColor} />
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      setSelectedTool(selectedTool === "draw" ? "view" : "draw")
                    }
                    className="w-full"
                  >
                    {selectedTool === "draw" ? "Disable" : "Enable"} Drawing
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {selectedTool === "draw" && canvas && (
              <Button size="sm" onClick={saveDrawing}>
                <Save className="h-4 w-4 mr-1" />
                Save Drawing
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Page Controls */}
        <div className="bg-gray-100 border-b p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
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
            <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.min(2.0, prev + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <div
              ref={pageRef}
              className="relative inline-block bg-white shadow-lg"
              onClick={handlePageClick}
              style={{
                cursor: selectedTool === "sticky" ? "crosshair" : "default",
              }}
            >
              {document.file_path ? (
                <Document
                  file={{
                    url: document.file_path,
                    httpHeaders: {
                      'Access-Control-Allow-Origin': '*',
                    },
                    withCredentials: false,
                  }}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  className="pdf-document"
                  options={{
                    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                    cMapPacked: true,
                    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
                  }}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Loading PDF...</p>
                      </div>
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center p-8 text-red-600">
                      <div className="text-center">
                        <p className="font-medium">Failed to load PDF</p>
                        <p className="text-sm mt-1">Please check the file path or try refreshing</p>
                        <p className="text-xs mt-2 text-gray-500">URL: {document.file_path}</p>
                      </div>
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    className="pdf-page"
                    loading={
                      <div className="flex items-center justify-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    }
                  />
                </Document>
              ) : (
                <div className="flex items-center justify-center p-8 text-red-600">
                  <p>No file path available for this document</p>
                </div>
              )}

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
                    className="absolute border border-gray-400 rounded p-2 shadow-md max-w-48"
                    style={{
                      left: `${annotation.position_x}%`,
                      top: `${annotation.position_y}%`,
                      backgroundColor: annotation.content.color || "#fef08a",
                      zIndex: 20,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        #{annotation.sequence_number}
                      </Badge>
                      <span className="text-xs text-gray-600">
                        {annotation.user_name}
                      </span>
                    </div>
                    <p className="text-sm">{annotation.content.text}</p>
                  </div>
                ))}

              {/* Sticky Note Form */}
              {showStickyForm && stickyPosition && (
                <div
                  className="absolute border border-gray-400 rounded p-3 shadow-lg z-30"
                  style={{
                    left: `${stickyPosition.x}%`,
                    top: `${stickyPosition.y}%`,
                    backgroundColor: stickyColor,
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
                    className="mb-2 min-h-20 bg-transparent border-gray-400"
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

        {/* Document Info & Annotations Sidebar */}
        <div className="w-80 bg-white border-l flex flex-col">
          {/* Document Info */}
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900 mb-3">Document Info</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Status:</span>
                <Badge className="ml-2 text-xs">{document.status}</Badge>
              </div>
              <div>
                <span className="font-medium">Created:</span>
                <span className="ml-2">
                  {format(new Date(document.created_at), "MMM dd, yyyy")}
                </span>
              </div>
            </div>

            {/* Assignments */}
            {document.assignments && document.assignments.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-sm mb-2">Assigned to:</h4>
                <div className="space-y-1">
                  {document.assignments.map((assignment, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {assignment.assigned_to_user ? (
                        <>
                          <User className="h-3 w-3" />
                          <span>{assignment.assigned_user_name}</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="h-3 w-3" />
                          <span>{assignment.assigned_department_name}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Annotations */}
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Annotations</h3>
            <p className="text-sm text-gray-600">Page {currentPage} annotations</p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {annotations.length === 0 ? (
                <div className="text-center py-8">
                  <StickyNote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No annotations on this page</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Use the tools above to add sticky notes or drawings
                  </p>
                </div>
              ) : (
                annotations.map((annotation) => (
                  <Card key={annotation.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        #{annotation.sequence_number}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {annotation.annotation_type === "sticky_note" ? "Note" : "Drawing"}
                      </Badge>
                    </div>
                    {annotation.annotation_type === "sticky_note" && (
                      <p className="text-sm mb-2">{annotation.content.text}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>by {annotation.user_name}</span>
                      <span>
                        {format(new Date(annotation.created_at), "MMM dd, HH:mm")}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}