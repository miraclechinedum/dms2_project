"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DocumentUploadDrawer } from "@/components/documents/document-upload-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Search, Eye, Upload, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Toaster } from "react-hot-toast";

interface Assignment {
  id: string;
  assigned_to_user?: string;
  assigned_to_department?: string;
  assigned_user_name?: string;
  assigned_department_name?: string;
}

interface Document {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  status: string;
  created_at: string;
  updated_at: string;
  uploader_name?: string;
  assignments?: Assignment[];
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchDocuments();
  }, [user, router]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, statusFilter]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const { documents } = await response.json();
        setDocuments(documents);
      } else {
        toast.error("Failed to fetch documents");
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      toast.error("Failed to fetch documents");
    }
    setLoading(false);
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (searchTerm) {
      filtered = filtered.filter((doc) =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((doc) => doc.status === statusFilter);
    }

    setFilteredDocuments(filtered);
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading documents...</p>
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
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 overflow-auto p-6 page-transition">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Documents</h2>
                  <p className="text-gray-600">Manage and view your PDF documents</p>
                </div>
                <Button onClick={() => setUploadDrawerOpen(true)} className="bg-primary hover:bg-primary/90">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>

              {/* Search and Filter */}
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
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Documents Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
                  <CardDescription>
                    List of all uploaded documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No documents found</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Upload your first document to get started
                      </p>
                      <Button onClick={() => setUploadDrawerOpen(true)} className="bg-primary hover:bg-primary/90">
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
                            <TableHead>Title</TableHead>
                            <TableHead>Uploaded By</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDocuments.map((document, index) => (
                            <TableRow key={document.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-primary" />
                                  <span className="font-medium">{document.title}</span>
                                </div>
                              </TableCell>
                              <TableCell>{document.uploader_name}</TableCell>
                              <TableCell>{formatFileSize(document.file_size)}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(document.status)}>
                                  {document.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(document.created_at), "MMM dd, yyyy")}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => router.push(`/documents/${document.id}`)}
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      <DocumentUploadDrawer
        open={uploadDrawerOpen}
        onOpenChange={setUploadDrawerOpen}
        onUploadSuccess={fetchDocuments}
      />
      <Toaster position="top-right" />
    </div>
  );
}