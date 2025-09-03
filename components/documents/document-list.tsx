"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Filter, Eye } from "lucide-react";
import { format } from "date-fns";

interface Document {
  id: string;
  title: string;
  file_url: string;
  file_size: number;
  uploaded_by: string;
  assigned_to_user: string | null;
  assigned_to_department: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  uploader_name?: string; // Add this
  assigned_user_name?: string; // Add this
  assigned_department_name?: string; // Add this
}

interface DocumentListProps {
  onDocumentSelect: (document: Document) => void;
}

export function DocumentList({ onDocumentSelect }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const { profile } = useAuth();

  useEffect(() => {
    fetchDocuments();
  }, [profile]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, statusFilter]);

  const fetchDocuments = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const { documents } = await response.json();
        setDocuments(documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <p className="text-gray-600">Manage and view your PDF documents</p>
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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

      {/* Documents Grid */}
      <ScrollArea className="h-[600px]">
        <div className="grid gap-4">
          {filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No documents found</p>
                <p className="text-sm text-gray-500">
                  Upload your first document to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((document) => (
              <Card
                key={document.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">
                          {document.title}
                        </h3>
                        <Badge className={getStatusColor(document.status)}>
                          {document.status}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Uploaded by: {document.uploader_name}</p>
                        {document.assigned_user && (
                          <p>Assigned to: {document.assigned_user_name}</p>
                        )}
                        {document.assigned_department && (
                          <p>
                            Assigned to: {document.assigned_department_name}{" "}
                            Department
                          </p>
                        )}
                        <p>Size: {formatFileSize(document.file_size)}</p>
                        <p>
                          Created:{" "}
                          {format(
                            new Date(document.created_at),
                            "MMM dd, yyyy"
                          )}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => onDocumentSelect(document)}
                      size="sm"
                      className="ml-4"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
