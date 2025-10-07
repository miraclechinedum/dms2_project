"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import WebViewer from "@/components/pdf/WebViewer";
import { ArrowLeft, User, Building2, FileText, StickyNote } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

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
  department_id?: string | null;
  department_name?: string | null;
  roles?: string | null;
  status?: string | null;
  notified_at?: string | null;
  assigned_at?: string | null; // created_at from DB
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
  assigned_to_department?: string | null;
  assigned_user_name?: string | null;
  assigned_department_name?: string | null;
  locked_by?: string | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
  // assignment history (optional; filled by API if available)
  assignments?: Assignment[];
}

/* --------------------------- Helpers / Utils ------------------------- */

// Customized date format like: 12th sept, 2025 3:07pm
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
      .toLowerCase(); // "sep"
    const year = date.getFullYear();

    // 12-hour time
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

/* ------------------------------- Component ---------------------------- */

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Notify/Assign dropdown state
  const [assignOpen, setAssignOpen] = useState(false);
  const assignBtnRef = useRef<HTMLButtonElement | null>(null);

  // Users for dropdown
  const [users, setUsers] = useState<
    { id: string; name: string; email?: string }[]
  >([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Datatable controls for assignment history
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState("");
  const perPage = 5;

  // Derived permission: who is last assigned user (most recent assignment with assigned_to)
  const lastAssigned =
    assignmentHistory.length > 0 ? assignmentHistory[0] : null; // we will fetch ordered by created_at DESC
  const currentUserHoldsLock = Boolean(
    document?.locked_by &&
      user &&
      String(document.locked_by) === String(user?.id)
  );
  const currentUserIsLastAssignee = Boolean(
    user && lastAssigned && String(user.id) === String(lastAssigned.assigned_to)
  );
  const canAnnotate = currentUserIsLastAssignee || currentUserHoldsLock;

  // Fetch document metadata (and assignments if API includes them)
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

  // Fetch annotations automatically when document changes (keeps WebViewer in sync)
  useEffect(() => {
    if (document) {
      fetchAnnotations();
      fetchAssignmentHistory(); // fetch history whenever document loads/refreshes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);

  // fetch document
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

  // fetch assignment history for this document
  const fetchAssignmentHistory = async () => {
    if (!document) return;
    try {
      const res = await fetch(
        `/api/document_assignments?documentId=${encodeURIComponent(
          document.id
        )}`
      );
      if (!res.ok) {
        console.error("Failed to fetch assignment history:", res.status);
        return;
      }
      const { assignments } = await res.json();
      // Expecting assignments ordered by created_at DESC (most recent first)
      setAssignmentHistory(Array.isArray(assignments) ? assignments : []);
      setCurrentPage(1); // reset pagination when new data arrives
    } catch (err) {
      console.error("fetchAssignmentHistory error", err);
    }
  };

  // fetch annotations automatically (no manual refresh button)
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

  // handlers for WebViewer callbacks (keeps UI state in sync)
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

  // Assign dropdown: load users when opened
  useEffect(() => {
    if (!assignOpen) return;
    setLoadingUsers(true);
    fetch("/api/users?limit=200")
      .then((r) => r.json())
      .then((j) => {
        const list = j?.users || j?.data || [];
        setUsers(list);
      })
      .catch((e) => {
        console.warn("Failed to load users for assign dropdown", e);
        toast.error("Failed to load users");
      })
      .finally(() => setLoadingUsers(false));
  }, [assignOpen]);

  const handleNotify = async () => {
    if (!document) return;
    if (!selectedUser) return toast.error("Select a user to notify");
    setAssignSubmitting(true);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(document.id)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to: selectedUser,
            giveLock: true,
            notify: true,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("assign failed:", res.status, json);
        toast.error(json?.error || "Assign failed");
      } else {
        toast.success("User notified and lock transferred");
        setAssignOpen(false);
        setSelectedUser(null);
        // update UI using returned document or re-fetch
        // server returns updated document in assign route — refresh both
        fetchDocument();
        fetchAssignmentHistory();
        fetchAnnotations();
      }
    } catch (err) {
      console.error("assign failed", err);
      toast.error("Failed to assign, check console");
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Pagination helpers for assignment history (no search)
  const total = assignmentHistory.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // ensure currentPage in bounds
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

  // Safety UI while loading / auth checks
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

  // determine a best-effort lastAssignedUserId to pass into WebViewer:
  const bestLastAssignedUserId =
    lastAssigned?.assigned_to ?? document.assigned_to_user ?? undefined;

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
              {/* Notify / Assign button */}
              <Button
                ref={assignBtnRef}
                // red background; respects disabled state visually
                className={`px-3 py-1.5 text-white text-sm rounded ${
                  currentUserIsLastAssignee
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-red-600 opacity-60 cursor-not-allowed"
                }`}
                size="sm"
                onClick={() => setAssignOpen((s) => !s)}
                title={
                  currentUserIsLastAssignee
                    ? "Notify next reviewer and (optionally) transfer lock"
                    : "Only the user the document was last assigned to can notify/assign"
                }
                disabled={!currentUserIsLastAssignee}
              >
                Notify / Assign
              </Button>

              {/* Inline dropdown panel */}
              {assignOpen && (
                <div className="absolute right-0 mt-12 z-50 w-[320px] bg-white border rounded shadow-lg p-3">
                  <h4 className="font-semibold mb-2">
                    Notify / Assign next reviewer
                  </h4>
                  <p className="text-xs text-gray-600 mb-3">
                    Choose a user to notify and optionally transfer the lock.
                  </p>

                  <div className="mb-3">
                    {loadingUsers ? (
                      <div className="text-sm text-gray-500">
                        Loading users...
                      </div>
                    ) : (
                      <select
                        className="w-full border p-2 rounded"
                        value={selectedUser ?? ""}
                        onChange={(e) =>
                          setSelectedUser(e.target.value || null)
                        }
                      >
                        <option value="">-- select user --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} {u.email ? `(${u.email})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      className="px-3 py-2 rounded border"
                      onClick={() => {
                        setAssignOpen(false);
                        setSelectedUser(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-60"
                      onClick={handleNotify}
                      disabled={assignSubmitting || !selectedUser}
                    >
                      {assignSubmitting ? "Sending..." : "Notify"}
                    </button>
                  </div>
                </div>
              )}
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
                  onAnnotationSave={
                    canAnnotate ? handleAnnotationSave : undefined
                  }
                  onAnnotationDelete={
                    canAnnotate ? handleAnnotationDelete : undefined
                  }
                  existingAnnotations={annotations}
                  readOnly={!canAnnotate}
                  lastAssignedUserId={bestLastAssignedUserId} // <-- PASS lastAssignedUserId so WebViewer knows who should see the toolbar
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
                    <span className="font-medium">Lock:</span>
                    <span className="ml-2 text-xs text-gray-600">
                      {document.locked_by
                        ? `Locked by ${
                            document.locked_by_name ?? document.locked_by
                          } ${
                            document.locked_at
                              ? `since ${formatDateTimeCustom(
                                  document.locked_at
                                )}`
                              : ""
                          }`
                        : "Not locked"}
                    </span>
                  </div>

                  {(document.assigned_to_user ||
                    document.assigned_to_department) && (
                    <div className="mt-3">
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
              </div>

              {/* Routing / Assignment History (datatable-like) */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-primary" />
                    Routing / Assignment History
                  </h3>
                </div>

                {/* removed search box per request */}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {pageItems.length > 0 ? (
                    pageItems.map((a: Assignment) => (
                      <Card
                        key={
                          a.assignment_id ?? `${a.assigned_at}-${a.assigned_to}`
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
                              {a.assigned_to_name ??
                                a.department_name ??
                                "Unspecified"}
                            </div>
                          </div>

                          {/* removed top-right status badge per request */}
                        </div>

                        <div className="mb-2 text-xs text-gray-600">
                          <div>
                            Notified by:{" "}
                            <span className="font-medium">
                              {a.assigned_by_name ?? a.assigned_by ?? "System"}
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
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <StickyNote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        No routing history available for this document.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        When assignments occur, they'll appear here.
                      </p>
                    </div>
                  )}

                  {/* Pagination controls - numbered */}
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

                        {/* page number buttons */}
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

                        {/* Jump to page input */}
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
