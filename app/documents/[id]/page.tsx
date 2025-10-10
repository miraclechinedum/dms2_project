"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import WebViewer from "@/components/pdf/WebViewer";
import {
  ArrowLeft,
  User,
  FileText,
  StickyNote,
  Search,
  Check,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";

/* ------------------------------- Types ------------------------------- */
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

interface Assignment {
  assignment_id?: string;
  document_id?: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  roles?: string | null;
  status?: string | null;
  notified_at?: string | null;
  assigned_at?: string | null;
  updated_at?: string | null;
}

interface DocumentData {
  id: string;
  title: string;
  file_path: string;
  file_url?: string;
  file_size: number;
  uploaded_by: string;
  status?: string;
  created_at?: string;
  uploader_name?: string;
  assigned_to_user?: string | null;
  assigned_user_name?: string | null;
  assignments?: Assignment[];
}

interface User {
  id: string;
  name: string;
  email?: string;
}

/* --------------------------- Helpers / Utils ------------------------- */

const formatDateTimeCustom = (dateString?: string | null) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = date.getDate();

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

    const monthShort = date
      .toLocaleDateString("en-US", { month: "short" })
      .toLowerCase();
    const year = date.getFullYear();

    let hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, "0");
    const ampm = hour >= 12 ? "pm" : "am";
    hour = hour % 12 || 12;

    return `${day}${getOrdinalSuffix(
      day
    )} ${monthShort}, ${year} ${hour}:${minute}${ampm}`;
  } catch {
    return dateString;
  }
};

const formatFileSize = (bytes: number) => {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (!bytes) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignOpen, setAssignOpen] = useState(false);
  const assignBtnRef = useRef<HTMLButtonElement | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState("");
  const perPage = 5;

  // Permission: Only assigned user can annotate
  const isAssignedUser =
    currentUser &&
    document?.assigned_to_user &&
    String(currentUser.id) === String(document.assigned_to_user);

  // Debug logging
  useEffect(() => {
    if (document && currentUser) {
      console.log("🔍 [DEBUG] Assignment Check:");
      console.log("Current user ID:", currentUser.id, typeof currentUser.id);
      console.log(
        "Document assigned to:",
        document.assigned_to_user,
        typeof document.assigned_to_user
      );
      console.log("isAssignedUser result:", isAssignedUser);
    }
  }, [document, currentUser, isAssignedUser]);

  // Fetch document metadata
  useEffect(() => {
    if (!currentUser) {
      router.push("/");
      return;
    }
    if (params.id) {
      fetchDocument();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, params.id]);

  // Fetch annotations and assignment history when document changes
  useEffect(() => {
    if (document) {
      fetchAnnotations();
      fetchAssignmentHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered.slice(0, 5)); // Show only 5 results
    } else {
      setFilteredUsers(users.slice(0, 5)); // Show only 5 latest users by default
    }
  }, [searchQuery, users]);

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

  const fetchAssignmentHistory = async () => {
    if (!document) return;
    try {
      console.log(
        "📋 [FRONTEND] Fetching assignment history for document:",
        document.id
      );

      const res = await fetch(
        `/api/document_assignments?documentId=${encodeURIComponent(
          document.id
        )}`
      );

      console.log(
        "📋 [FRONTEND] Assignment history response status:",
        res.status
      );

      if (!res.ok) {
        console.error("Failed to fetch assignment history:", res.status);
        const errorText = await res.text();
        console.error("Error response:", errorText);
        return;
      }

      const data = await res.json();
      console.log("📋 [FRONTEND] Assignment history RAW data received:", data);

      const assignments = Array.isArray(data.assignments)
        ? data.assignments
        : [];
      console.log("📋 [FRONTEND] Processed assignments:", assignments);

      setAssignmentHistory(assignments);
      setCurrentPage(1);
    } catch (err) {
      console.error("fetchAssignmentHistory error", err);
    }
  };

  const fetchAnnotations = async () => {
    if (!document) return;
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

  // Load users for assignment dropdown
  useEffect(() => {
    if (!assignOpen) return;
    setLoadingUsers(true);
    setSearchQuery("");
    setSelectedUser(null);

    fetch("/api/users?limit=100")
      .then((r) => r.json())
      .then((j) => {
        const list = j?.users || j?.data || [];
        // Filter out current user to prevent self-assignment
        const otherUsers = list.filter(
          (u: User) => String(u.id) !== String(currentUser?.id)
        );
        setUsers(otherUsers);
        setFilteredUsers(otherUsers.slice(0, 5)); // Show only 5 latest by default
      })
      .catch((e) => {
        console.warn("Failed to load users for assign dropdown", e);
        toast.error("Failed to load users");
      })
      .finally(() => setLoadingUsers(false));
  }, [assignOpen, currentUser]);

  const handleNotify = async () => {
    if (!document) return;
    if (!selectedUser) return toast.error("Select a user to notify");

    console.log("🚀 [FRONTEND] Starting assignment process:");
    console.log("Document ID:", document.id);
    console.log("Document current assignee:", document.assigned_to_user);
    console.log("Current user ID:", currentUser?.id);
    console.log("Selected user ID:", selectedUser);
    console.log("isAssignedUser:", isAssignedUser);

    setAssignSubmitting(true);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(document.id)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to: selectedUser,
            notify: true,
          }),
        }
      );

      const responseText = await res.text();
      console.log("📨 Backend response status:", res.status);
      console.log("📨 Backend response body:", responseText);

      let json;
      try {
        json = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        json = {};
      }

      if (!res.ok) {
        console.error("❌ Assign failed:", res.status, json);
        toast.error(json?.error || `Assign failed with status ${res.status}`);
      } else {
        console.log("✅ Assign successful:", json);
        toast.success("User notified and document assigned");
        setAssignOpen(false);
        setSelectedUser(null);
        setSearchQuery("");
        fetchDocument();
        fetchAssignmentHistory();
        fetchAnnotations();
      }
    } catch (err) {
      console.error("❌ Assign failed", err);
      toast.error("Failed to assign, check console");
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Pagination
  const total = assignmentHistory.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, currentPage]);

  const pageStart = (currentPage - 1) * perPage;
  const pageItems = assignmentHistory.slice(pageStart, pageStart + perPage);

  const handleJumpToPage = () => {
    const n = parseInt(jumpPageInput, 10);
    if (Number.isNaN(n)) return;
    const to = Math.max(1, Math.min(totalPages, n));
    setCurrentPage(to);
    setJumpPageInput("");
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

  if (!currentUser) {
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
                  Uploaded by {document.uploader_name ?? "Unknown"} •{" "}
                  {formatFileSize(document.file_size)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 relative">
              {/* Notify / Assign button - Only shown to assigned user */}
              {isAssignedUser && (
                <>
                  <Button
                    ref={assignBtnRef}
                    className="px-3 py-1.5 text-white text-sm rounded bg-red-600 hover:bg-red-700"
                    size="sm"
                    onClick={() => setAssignOpen((s) => !s)}
                    title="Notify next reviewer and transfer assignment"
                  >
                    Notify / Assign
                  </Button>

                  {/* Inline dropdown panel */}
                  {assignOpen && (
                    <div className="absolute right-0 mt-12 z-50 w-[400px] bg-white border rounded-lg shadow-xl p-4">
                      <h4 className="font-semibold mb-3 text-lg">
                        Assign Document
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Select a user to assign this document to. You cannot
                        assign to yourself.
                      </p>

                      {/* Search Input */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search users by name or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      {/* User List */}
                      <div className="mb-4 max-h-60 overflow-y-auto">
                        {loadingUsers ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                              Loading users...
                            </p>
                          </div>
                        ) : filteredUsers.length > 0 ? (
                          <div className="space-y-2">
                            {filteredUsers.map((user) => (
                              <div
                                key={user.id}
                                className={cn(
                                  "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all",
                                  selectedUser === user.id
                                    ? "border-primary bg-primary/5"
                                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                )}
                                onClick={() => setSelectedUser(user.id)}
                              >
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                    selectedUser === user.id
                                      ? "bg-primary border-primary"
                                      : "border-gray-300"
                                  )}
                                >
                                  {selectedUser === user.id && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {user.name}
                                  </p>
                                  {user.email && (
                                    <p className="text-xs text-gray-600 truncate">
                                      {user.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <User className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                              No users found
                            </p>
                            {searchQuery && (
                              <p className="text-xs text-gray-400 mt-1">
                                Try a different search term
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selected User Display */}
                      {selectedUser && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-medium text-green-800">
                            Selected:{" "}
                            {users.find((u) => u.id === selectedUser)?.name}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAssignOpen(false);
                            setSelectedUser(null);
                            setSearchQuery("");
                          }}
                          disabled={assignSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleNotify}
                          disabled={assignSubmitting || !selectedUser}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {assignSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                              Assigning...
                            </>
                          ) : (
                            "Assign & Notify"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Status badge for non-assigned users */}
              {!isAssignedUser && document.assigned_user_name && (
                <Badge
                  variant="secondary"
                  className="bg-yellow-100 text-yellow-800"
                >
                  Assigned to: {document.assigned_user_name}
                </Badge>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex overflow-auto">
            {/* PDF Viewer with permission control */}
            <div className="flex-1 bg-gray-100">
              {document.file_url && (
                <WebViewer
                  documentUrl={document.file_url}
                  documentId={document.id}
                  currentUserId={currentUser.id}
                  currentUserName={currentUser.name || currentUser.email}
                  assignedToUserId={document.assigned_to_user}
                  onAnnotationSave={
                    isAssignedUser ? handleAnnotationSave : undefined
                  }
                  onAnnotationDelete={
                    isAssignedUser ? handleAnnotationDelete : undefined
                  }
                  existingAnnotations={annotations}
                />
              )}
            </div>

            {/* Right Sidebar */}
            <div className="w-80 bg-white border-l flex flex-col shadow-lg">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Document Info
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Assignment Status:</span>
                    <span className="ml-2 text-xs text-gray-600">
                      {document.assigned_user_name
                        ? `Assigned to ${document.assigned_user_name}`
                        : "Not assigned"}
                    </span>
                  </div>
                  {!isAssignedUser && document.assigned_user_name && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800">
                        ⚠️ Only {document.assigned_user_name} can annotate this
                        document
                      </p>
                    </div>
                  )}
                  {isAssignedUser && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-800">
                        ✅ You are the assigned reviewer
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Routing / Assignment History */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-primary" />
                    Routing / Assignment History
                  </h3>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {console.log("📋 [RENDER] Current pageItems:", pageItems)}
                  {pageItems.length > 0 ? (
                    pageItems.map((a: Assignment) => {
                      console.log("📋 [RENDER] Rendering assignment:", a);
                      return (
                        <Card
                          key={
                            a.assignment_id ??
                            `${a.assigned_at}-${a.assigned_to}`
                          }
                          className="p-3 hover:shadow-md transition-shadow border-l-4 border-l-primary"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs border-primary/20 text-primary"
                              >
                                {a.roles ?? "Editor"}
                              </Badge>
                              <div className="text-sm font-medium">
                                {a.assigned_to_name ?? "Unspecified"}
                              </div>
                            </div>
                          </div>

                          <div className="mb-2 text-xs text-gray-600">
                            <div>
                              Assigned by:{" "}
                              <span className="font-medium">
                                {a.assigned_by_name ??
                                  a.assigned_by ??
                                  "System"}
                              </span>
                            </div>
                            <div>Status: {a.status ?? "—"}</div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              {formatDateTimeCustom(
                                a.notified_at ??
                                  a.assigned_at ??
                                  a.updated_at ??
                                  ""
                              )}
                            </span>
                            <span>{a.notified_at ? "Notified" : ""}</span>
                          </div>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <StickyNote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        No routing history available for this document.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        When assignments occur, they'll appear here.
                      </p>
                      <Button
                        onClick={fetchAssignmentHistory}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        Refresh History
                      </Button>
                    </div>
                  )}

                  {/* Pagination controls */}
                  {total > perPage && (
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-gray-600">
                        Showing {pageStart + 1} -{" "}
                        {Math.min(pageStart + perPage, total)} of {total}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="px-2 py-1 border rounded disabled:opacity-50"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          Prev
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from(
                            { length: totalPages },
                            (_, i) => i + 1
                          ).map((p) => (
                            <button
                              key={p}
                              onClick={() => setCurrentPage(p)}
                              className={`px-3 py-1 rounded text-sm border ${
                                currentPage === p
                                  ? "bg-green-500 text-white border-green-600"
                                  : "bg-white text-gray-700"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>

                        <button
                          className="px-2 py-1 border rounded disabled:opacity-50"
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </button>

                        <div className="flex items-center gap-2 ml-2">
                          <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={jumpPageInput}
                            onChange={(e) => setJumpPageInput(e.target.value)}
                            className="w-16 border rounded p-1 text-sm"
                            placeholder="#"
                          />
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={handleJumpToPage}
                          >
                            Go
                          </button>
                        </div>
                      </div>
                    </div>
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
