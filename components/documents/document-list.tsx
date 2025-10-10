"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { DocumentUploadDrawer } from "@/components/documents/document-upload-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Search, Eye, Upload, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  roles?: string | null;
  status?: string | null;
}

interface Document {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  uploaded_by: string | null;
  assigned_to_user?: string | null;
  assigned_user_name?: string | null;
  created_at: string;
  updated_at: string | null;
  uploader_name?: string | null;
  assignments?: Assignment[];
}

type SortKey =
  | "title"
  | "uploader_name"
  | "assigned"
  | "file_size"
  | "created_at";

interface DocumentListProps {
  onDocumentSelect?: (document: Document) => void; // Make it optional
}

export function DocumentList({ onDocumentSelect }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  // Pagination & sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Smaller for dashboard
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    filterDocuments();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, searchTerm]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const { documents } = await response.json();
        setDocuments(documents ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
    setLoading(false);
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(q) ||
          (doc.uploader_name ?? "").toLowerCase().includes(q) ||
          (doc.assigned_user_name ?? "").toLowerCase().includes(q) ||
          // Also search in assignment names
          (doc.assignments ?? []).some((a) =>
            (a.assigned_to_name ?? "").toLowerCase().includes(q)
          )
      );
    }

    setFilteredDocuments(filtered);
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (!bytes && bytes !== 0) return "0 Bytes";
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const getAssignedLabel = (doc: Document) => {
    // First check direct assignment on document
    if (doc.assigned_user_name) {
      return doc.assigned_user_name;
    }

    // Then check assignments history
    if (!doc.assignments || doc.assignments.length === 0) return null;

    // Get the most recent assignment
    const mostRecent = doc.assignments[doc.assignments.length - 1];
    return mostRecent.assigned_to_name ?? null;
  };

  // Handle view button click
  const handleViewDocument = (document: Document) => {
    if (onDocumentSelect) {
      // If onDocumentSelect prop is provided, use it
      onDocumentSelect(document);
    } else {
      // Otherwise, navigate to the document page
      router.push(`/documents/${document.id}`);
    }
  };

  // Sorting logic
  const sortedDocuments = useMemo(() => {
    const arr = [...filteredDocuments];
    if (!sortConfig) return arr;

    const { key, direction } = sortConfig;
    arr.sort((a, b) => {
      let va: any;
      let vb: any;

      switch (key) {
        case "title":
          va = a.title ?? "";
          vb = b.title ?? "";
          return (
            (va < vb ? -1 : va > vb ? 1 : 0) * (direction === "asc" ? 1 : -1)
          );

        case "uploader_name":
          va = (a.uploader_name ?? "").toLowerCase();
          vb = (b.uploader_name ?? "").toLowerCase();
          return (
            (va < vb ? -1 : va > vb ? 1 : 0) * (direction === "asc" ? 1 : -1)
          );

        case "assigned":
          va = (getAssignedLabel(a) ?? "").toLowerCase();
          vb = (getAssignedLabel(b) ?? "").toLowerCase();
          return (
            (va < vb ? -1 : va > vb ? 1 : 0) * (direction === "asc" ? 1 : -1)
          );

        case "file_size":
          va = Number(a.file_size ?? 0);
          vb = Number(b.file_size ?? 0);
          return (va - vb) * (direction === "asc" ? 1 : -1);

        case "created_at":
          va = new Date(a.created_at).getTime();
          vb = new Date(b.created_at).getTime();
          return (va - vb) * (direction === "asc" ? 1 : -1);

        default:
          return 0;
      }
    });

    return arr;
  }, [filteredDocuments, sortConfig]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(sortedDocuments.length / itemsPerPage)
  );
  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedDocuments.slice(start, start + itemsPerPage);
  }, [sortedDocuments, currentPage]);

  // helper to toggle sort
  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.key === key)
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      return prev;
    });
  };

  // Small page number rendering (show up to 5)
  const getPageNumbers = () => {
    const maxButtons = 5;
    const pages: number[] = [];
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // Reset to page 1 when documents change significantly
  useEffect(() => {
    setCurrentPage(1);
  }, [documents.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <p className="text-gray-600">Manage and view your PDF documents</p>
        </div>
        <Button
          onClick={() => setUploadDrawerOpen(true)}
          className="bg-primary hover:bg-primary/90"
          size="sm"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Search */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
          <CardDescription>
            List of documents assigned to you or uploaded by you
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No documents found</p>
              <p className="text-sm text-gray-500 mb-4">
                {searchTerm
                  ? "Try a different search term or "
                  : "Upload your first document to get started"}
              </p>
              <Button
                onClick={() => setUploadDrawerOpen(true)}
                className="bg-primary hover:bg-primary/90"
                size="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>

                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("title")}
                    >
                      Title <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>

                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("uploader_name")}
                    >
                      Uploaded By{" "}
                      <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>

                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("assigned")}
                    >
                      Assigned To{" "}
                      <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>

                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("file_size")}
                    >
                      Size <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>

                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("created_at")}
                    >
                      Date Uploaded{" "}
                      <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>

                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedDocuments.map((document, index) => (
                    <TableRow
                      key={document.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium">{document.title}</span>
                        </div>
                      </TableCell>

                      <TableCell>{document.uploader_name ?? "-"}</TableCell>

                      <TableCell>
                        {getAssignedLabel(document) ?? (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {formatFileSize(document.file_size)}
                      </TableCell>

                      <TableCell>
                        {format(new Date(document.created_at), "MMM dd, yyyy")}
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleViewDocument(document)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination controls */}
              <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} -{" "}
                  {Math.min(currentPage * itemsPerPage, sortedDocuments.length)}{" "}
                  of {sortedDocuments.length}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>

                  {getPageNumbers().map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === currentPage ? undefined : "outline"}
                      className={
                        p === currentPage ? "bg-primary text-white" : ""
                      }
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentUploadDrawer
        open={uploadDrawerOpen}
        onOpenChange={setUploadDrawerOpen}
        onUploadSuccess={fetchDocuments}
      />
    </div>
  );
}
