"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import WebViewer from "@/components/pdf/WebViewer";
import {
  ArrowLeft,
  User,
  Building2,
  FileText,
  StickyNote,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import toast, { Toaster } from "react-hot-toast";

interface Annotation {
  id: string;
  document_id: string;
  user_id: string;
  page_number: number;
  annotation_type: "sticky_note" | "drawing" | "highlight";
  content: any;
  sequence_number: number;
  position_x: number;
  position_y: number;
  created_at: string;
  user_name?: string;
}

interface DocumentData {
  id: string;
  title: string;
  file_path: string;
  file_url?: string;
  file_size: number;
  uploaded_by: string;
  status: string;
  created_at: string;
  uploader_name?: string;
  assigned_to_user?: string;
  assigned_to_department?: string;
  assigned_user_name?: string;
  assigned_department_name?: string;
}

// Helper function to format datetime in a more readable format
const formatDateTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Add ordinal suffix to day
    const getOrdinalSuffix = (d: number) => {
      if (d > 3 && d < 21) return "th";
      switch (d % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };

    return `${day}${getOrdinalSuffix(day)} ${month}, ${year} ${time}`;
  } catch (e) {
    // fallback to original string
    return dateString;
  }
};

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);

  // Fetch document metadata
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (params.id) {
      fetchDocument();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id]);

  // Fetch annotations when document changes
  useEffect(() => {
    if (document) {
      fetchAnnotations();
    }
  }, [document]);

  const fetchDocument = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${params.id}`);
      if (!res.ok) {
        const txt = await res.text();
        console.error("Document fetch failed", res.status, txt);
        toast.error("Document not found");
        router.push("/documents");
        return;
      }
      const { document } = await res.json();

      // Ensure proper file URL
      let fileUrl = document.file_url;
      if (!fileUrl && document.file_path) {
        fileUrl = document.file_path.startsWith("/")
          ? document.file_path
          : `/uploads/documents/${document.file_path}`;
      }
      if (fileUrl && !fileUrl.startsWith("http") && !fileUrl.startsWith("/")) {
        fileUrl = `/uploads/documents/${fileUrl}`;
      }

      setDocument({ ...document, file_url: fileUrl });
    } catch (err) {
      console.error("fetchDocument error", err);
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnotations = async () => {
    if (!document) return;

    setAnnotationsLoading(true);
    try {
      const res = await fetch(`/api/annotations?documentId=${document.id}`);
      if (!res.ok) {
        console.error("Failed to fetch annotations:", res.status);
        return;
      }

      const { annotations } = await res.json();
      setAnnotations(annotations || []);
    } catch (err) {
      console.error("fetchAnnotations error", err);
    } finally {
      setAnnotationsLoading(false);
    }
  };

  const handleAnnotationSave = (annotation: Annotation) => {
    setAnnotations((prev) => {
      const existing = prev.find((a) => a.id === annotation.id);
      if (existing) {
        return prev.map((a) => (a.id === annotation.id ? annotation : a));
      } else {
        return [...prev, annotation];
      }
    });
  };

  const handleAnnotationDelete = (annotationId: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (!bytes) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const getAnnotationTypeLabel = (type: string) => {
    switch (type) {
      case "sticky_note":
        return "Note";
      case "highlight":
        return "Highlight";
      case "drawing":
        return "Drawing";
      default:
        return "Note";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          <div className="flex-1 flex flex-col">
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-gray-600">Loading document...</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          <div className="flex-1 flex flex-col">
            <main className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Please sign in to view documents</p>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          <div className="flex-1 flex flex-col">
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-600">Document not found</p>
                <Button
                  onClick={() => router.push("/documents")}
                  className="mt-4 bg-primary hover:bg-primary/90"
                >
                  Back to Documents
                </Button>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col">
          {/* Document Header */}
          <div className="bg-white border-b p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => router.push("/documents")}
                className="hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{document.title}</h1>
                <p className="text-sm text-gray-600">
                  Uploaded by {document.uploader_name} on{" "}
                  {format(new Date(document.created_at), "MMM dd, yyyy")} •{" "}
                  {formatFileSize(document.file_size)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnnotations}
                disabled={annotationsLoading}
              >
                {annotationsLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh Annotations
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex overflow-auto">
            {/* PDF Viewer */}
            <div className="flex-1 bg-gray-100">
              {document.file_url && (
                <WebViewer
                  documentUrl={document.file_url}
                  documentId={document.id}
                  currentUserId={user.id}
                  currentUserName={user.name || user.email}
                  onAnnotationSave={handleAnnotationSave}
                  onAnnotationDelete={handleAnnotationDelete}
                  existingAnnotations={annotations}
                />
              )}
            </div>

            {/* Annotations Sidebar */}
            <div className="w-80 bg-white border-l flex flex-col shadow-lg">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Document Info
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <Badge className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">
                      {document.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>
                    <span className="ml-2">
                      {format(new Date(document.created_at), "MMM dd, yyyy")}
                    </span>
                  </div>
                </div>

                {(document.assigned_to_user ||
                  document.assigned_to_department) && (
                  <div className="mt-4">
                    <h4 className="font-medium text-sm mb-2">Assigned to:</h4>
                    <div className="space-y-1">
                      {document.assigned_to_user && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3 w-3 text-primary" />
                          <span>{document.assigned_user_name}</span>
                        </div>
                      )}
                      {document.assigned_to_department && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-3 w-3 text-primary" />
                          <span>{document.assigned_department_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-primary" />
                  All Annotations
                </h3>
                <p className="text-sm text-gray-600">
                  {annotations.length} total annotations
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {annotationsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        Loading annotations...
                      </p>
                    </div>
                  ) : annotations.length === 0 ? (
                    <div className="text-center py-8">
                      <StickyNote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        No annotations yet
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Use the custom toolbar to add highlights, notes, or
                        drawings
                      </p>
                    </div>
                  ) : (
                    annotations.map((annotation) => (
                      <Card
                        key={annotation.id}
                        className="p-3 hover:shadow-md transition-shadow border-l-4 border-l-primary"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs border-primary/20 text-primary"
                            >
                              Page {annotation.page_number}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              #{annotation.sequence_number}
                            </Badge>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-primary/10 text-primary"
                          >
                            {getAnnotationTypeLabel(annotation.annotation_type)}
                          </Badge>
                        </div>

                        {annotation.annotation_type === "sticky_note" &&
                          annotation.content?.text && (
                            <p className="text-sm mb-2">
                              {annotation.content.text}
                            </p>
                          )}

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>by {annotation.user_name}</span>
                          <span>{formatDateTime(annotation.created_at)}</span>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
