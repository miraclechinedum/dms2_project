"use client";

import { useEffect, useRef, useState } from "react";
import WebViewer from "@pdftron/webviewer";
import { CustomToolbar } from "./CustomToolbar";

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
  updated_at?: string;
}

interface WebViewerProps {
  documentUrl: string;
  documentId: string;
  currentUserId: string;
  currentUserName: string;
  onAnnotationSave: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
  existingAnnotations: Annotation[]; // passed from parent (may be empty)
  /**
   * Optional: registerHandlers is a callback that receives an object with helper functions
   * so parent (sidebar) can call viewer actions, e.g.
   * registerHandlers?.({ highlightAnnotation: (id) => {} })
   */
  registerHandlers?: (handlers: {
    highlightAnnotation: (id: string) => Promise<void>;
  }) => void;
}

type Toast = { id: string; message: string };

export default function WebViewerComponent({
  documentUrl,
  documentId,
  currentUserId,
  currentUserName,
  onAnnotationSave,
  onAnnotationDelete,
  existingAnnotations,
  registerHandlers,
}: WebViewerProps) {
  const viewer = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const [selectedTool, setSelectedTool] = useState<string>("select");
  const [selectedColor, setSelectedColor] = useState<string>("#FFE066");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewerReady, setViewerReady] = useState(false);

  // Toasts state & helper
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, duration = 5000) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  };
  const removeToast = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));

  // Format ISO -> "13th Sept, 2025 2:13pm"
  const formatDateHuman = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const day = d.getDate();
      const month = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;
      const minuteStr = String(minutes).padStart(2, "0");
      const ordinal = (n: number) => {
        if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
        if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
        if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
        return `${n}th`;
      };
      return `${ordinal(day)} ${month}, ${year} ${hours}:${minuteStr}${ampm}`;
    } catch {
      return iso || "";
    }
  };

  // Helpers to deal with different WebViewer builds/APIs
  const resolveDocumentViewer = (Core: any) => {
    if (!Core) return null;
    if (typeof Core.getDocumentViewer === "function")
      return Core.getDocumentViewer();
    if (Core.documentViewer) return Core.documentViewer;
    return null;
  };

  const resolveAnnotationManager = (Core: any, documentViewer: any) => {
    if (!Core && !documentViewer) return null;
    if (
      Core?.getAnnotationManager &&
      typeof Core.getAnnotationManager === "function"
    ) {
      try {
        const am = Core.getAnnotationManager();
        if (am) return am;
      } catch {}
    }
    if (
      documentViewer?.getAnnotationManager &&
      typeof documentViewer.getAnnotationManager === "function"
    ) {
      try {
        const am = documentViewer.getAnnotationManager();
        if (am) return am;
      } catch {}
    }
    if (Core?.annotationManager) return Core.annotationManager;
    return null;
  };

  // --- Utilities: strip meta header from a sticky/free-text contents before sending to server ---
  // The viewer shows a meta header like:
  // "1. Alice\n13th Sept, 2025 2:13pm\n\nUser text..."
  // This function removes that header (and also removes our provisional "… Saving" header).
  const stripMetaFromText = (text: string | undefined) => {
    if (!text || typeof text !== "string") return text ?? "";
    // Look for first occurrence of double newline that separates meta header from user content
    const firstDoubleNewlineIndex = text.indexOf("\n\n");
    if (firstDoubleNewlineIndex === -1 || firstDoubleNewlineIndex > 200) {
      // no clear meta header found (or it's suspiciously long) -> just return text
      return text;
    }
    const header = text.slice(0, firstDoubleNewlineIndex).trim();
    // Heuristics: header usually starts with sequence number (e.g. "1.") or provisional "..."
    if (
      /^\s*(\d+\.|\.\.\.)/.test(header) ||
      /\d{4}/.test(header) ||
      /^[A-Za-z0-9 ,]+$/.test(header.split("\n")[0])
    ) {
      // strip header and the two newlines; return remainder
      return text.slice(firstDoubleNewlineIndex + 2);
    }
    return text;
  };

  // Initialize WebViewer
  useEffect(() => {
    if (!viewer.current) return;

    console.info("WebViewer init - documentUrl:", documentUrl);

    let instance: any = null;

    WebViewer(
      {
        path: "/webviewer",
        initialDoc: documentUrl,
        licenseKey:
          "demo:1757509875851:604eca4e0300000000877d781419f71633c68ea80c20ad3325f5806b42",
        css: `
          .HeaderItems, .ToolsHeader, .Header, .MenuOverlay, .LeftPanel, .NotesPanel {
            display: none !important;
          }
        `,
      },
      viewer.current
    )
      .then((webViewerInstance) => {
        instance = webViewerInstance;
        instanceRef.current = instance;
        const { UI, Core } = instance;

        const docViewer = resolveDocumentViewer(Core);
        const attachLoaded = (dv: any) => {
          if (!dv) return;
          if (typeof dv.addEventListener === "function")
            dv.addEventListener("documentLoaded", onDocumentLoaded);
          else if (dv.addEvent) dv.addEvent("documentLoaded", onDocumentLoaded);
        };

        async function onDocumentLoaded() {
          try {
            const documentViewer = resolveDocumentViewer(Core);

            // attempt to hide default UI (best-effort)
            try {
              UI.setHeaderItems?.(() => {});
              UI.disableElements?.([
                "ribbons",
                "toggleNotesButton",
                "searchButton",
                "menuButton",
                "toolsHeader",
                "header",
                "leftPanel",
                "notesPanel",
              ]);
            } catch (e) {
              console.warn("UI.disableElements failed:", e);
            }

            const annotationManager = resolveAnnotationManager(
              Core,
              documentViewer
            );

            // Import XFDF if server stored it
            try {
              if (annotationManager && documentId) {
                const xfdfRes = await fetch(
                  `/api/annotations/xfdf?documentId=${encodeURIComponent(
                    documentId
                  )}`
                );
                if (xfdfRes.ok) {
                  const xfdfJson = await xfdfRes.json();
                  const xfdf = xfdfJson?.xfdf;
                  if (xfdf) {
                    if (
                      typeof annotationManager.importAnnotations === "function"
                    ) {
                      await annotationManager.importAnnotations(xfdf);
                    } else if (
                      typeof annotationManager.importXfdf === "function"
                    ) {
                      await annotationManager.importXfdf(xfdf);
                    } else {
                      console.warn(
                        "annotationManager missing importAnnotations/importXfdf"
                      );
                    }
                    try {
                      annotationManager.redrawAnnotations?.();
                    } catch {}
                  }
                }
              }
            } catch (e) {
              console.warn("Failed to fetch/import XFDF:", e);
            }

            // Listeners: annotationChanged (add / modify / delete)
            if (
              annotationManager &&
              typeof annotationManager.addEventListener === "function"
            ) {
              annotationManager.addEventListener(
                "annotationChanged",
                async (annotations: any[], action: string) => {
                  if (!Array.isArray(annotations)) return;
                  if (action === "add") {
                    for (const ann of annotations)
                      await handleAnnotationAdd(ann, annotationManager);
                  } else if (action === "modify") {
                    for (const ann of annotations)
                      await handleAnnotationModify(ann, annotationManager);
                  } else if (action === "delete") {
                    for (const ann of annotations)
                      await handleAnnotationDelete(ann, annotationManager);
                  }
                }
              );
            }

            // Expose highlight helper to parent (if requested)
            const highlightAnnotation = async (annotationId: string) => {
              try {
                const inst = instanceRef.current;
                if (!inst) return;
                const dv = resolveDocumentViewer(inst.Core);
                const am = resolveAnnotationManager(inst.Core, dv);
                if (!am || !dv) {
                  addToast("Viewer not ready to highlight.", 3000);
                  return;
                }

                // try find the annotation in current annotation list
                const list = am.getAnnotationsList?.() || [];
                let target = list.find(
                  (a: any) =>
                    String(a.Id) === String(annotationId) ||
                    String(a.id) === String(annotationId)
                );
                if (!target) {
                  // attempt reload from server->viewer then search again
                  await loadExistingAnnotations();
                  const list2 = am.getAnnotationsList?.() || [];
                  target = list2.find(
                    (a: any) =>
                      String(a.Id) === String(annotationId) ||
                      String(a.id) === String(annotationId)
                  );
                }
                if (!target) {
                  addToast("Annotation not found in document.", 3500);
                  return;
                }

                try {
                  am.deselectAllAnnotations?.();
                  // jumpToAnnotation and selectAnnotation are widely-supported in WebViewer
                  if (typeof am.jumpToAnnotation === "function") {
                    await am.jumpToAnnotation(target);
                  } else if (dv.setCurrentPage) {
                    dv.setCurrentPage?.(
                      target.PageNumber || target.page_number
                    );
                  }
                  if (typeof am.selectAnnotation === "function")
                    am.selectAnnotation(target);
                  // de-select after a short while so highlight is temporary (but the popup remains if user clicks)
                  window.setTimeout(() => {
                    try {
                      am.deselectAllAnnotations?.();
                    } catch {}
                  }, 3_000);
                } catch (err) {
                  console.warn("highlightAnnotation select/jump failed:", err);
                }
              } catch (err) {
                console.error("highlightAnnotation error:", err);
                addToast("Could not highlight annotation.", 3500);
              }
            };

            // register handler for parent if requested
            if (typeof registerHandlers === "function") {
              registerHandlers({ highlightAnnotation });
            }

            // Authoritative load from DB / props to ensure viewer displays server metadata
            await loadExistingAnnotations();

            setViewerReady(true);
            console.log("✅ WebViewer documentLoaded");
          } catch (err) {
            console.error("onDocumentLoaded error:", err);
          }
        }

        attachLoaded(docViewer ?? Core?.documentViewer ?? Core);
      })
      .catch((err) => {
        console.error("WebViewer init failed:", err);
      });

    return () => {
      if (instance) {
        try {
          instance.UI?.closeDocument?.();
        } catch (e) {
          console.warn("closeDocument failed:", e);
        }
        instanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentUrl, documentId]);

  // When parent-provided annotations change (after fetch), reload them into viewer
  useEffect(() => {
    if (!viewerReady) return;
    loadExistingAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerReady, JSON.stringify(existingAnnotations || [])]);

  // --- load existing annotations into the viewer (from props or server) ---
  const loadExistingAnnotations = async () => {
    const inst = instanceRef.current;
    if (!inst) return;
    const { Core, Annotations } = inst;
    const dv = resolveDocumentViewer(Core);
    const annotationManager = resolveAnnotationManager(Core, dv);
    if (!annotationManager) return;

    // Clear viewer annotations first to avoid duplicates
    try {
      const list = annotationManager.getAnnotationsList?.() || [];
      if (list && list.length) annotationManager.deleteAnnotations?.(list);
    } catch {}

    // Use parent-provided list if present, otherwise fetch
    let annList: Annotation[] | null =
      existingAnnotations && existingAnnotations.length
        ? existingAnnotations
        : null;

    if ((!annList || annList.length === 0) && documentId) {
      try {
        const res = await fetch(
          `/api/annotations?documentId=${encodeURIComponent(documentId)}`
        );
        if (res.ok) {
          const json = await res.json();
          annList = json?.annotations || [];
        } else {
          console.warn("Failed to fetch annotations:", res.status);
        }
      } catch (e) {
        console.warn("fetch annotations failed:", e);
      }
    }

    if (!annList || annList.length === 0) {
      try {
        annotationManager.redrawAnnotations?.();
      } catch {}
      return;
    }

    // Add annotations to viewer with metadata header + set Id/Author/Subject
    for (const a of annList) {
      try {
        let pdfAnnotation: any = null;
        if (a.annotation_type === "sticky_note") {
          pdfAnnotation = new Annotations.StickyAnnotation({
            PageNumber: a.page_number,
            X: a.position_x,
            Y: a.position_y,
          });
          const meta = `${a.sequence_number}. ${
            a.user_name || "Unknown"
          }\n${formatDateHuman(a.created_at)}\n\n`;
          // Note: meta is display-only and NOT stored in server.content
          pdfAnnotation.setContents(meta + (a.content?.text ?? ""));
        } else if (a.annotation_type === "highlight") {
          pdfAnnotation = new Annotations.TextHighlightAnnotation({
            PageNumber: a.page_number,
            Quads: a.content?.quads,
          });
          const col = a.content?.color || { r: 255, g: 224, b: 102 };
          pdfAnnotation.setColor(new Annotations.Color(col.r, col.g, col.b));
          pdfAnnotation.setContents(
            `${a.sequence_number}. ${
              a.user_name || "Unknown"
            }\n${formatDateHuman(a.created_at)}`
          );
        } else if (a.annotation_type === "drawing") {
          // For freehand/drawing we also show the meta header as part of the contents (display-only)
          pdfAnnotation = new Annotations.FreeHandAnnotation({
            PageNumber: a.page_number,
            Path: a.content?.path,
            StrokeColor: a.content?.strokeColor,
          });
          pdfAnnotation.setContents(
            `${a.sequence_number}. ${
              a.user_name || "Unknown"
            }\n${formatDateHuman(a.created_at)}`
          );
        }

        if (pdfAnnotation) {
          pdfAnnotation.Author = a.user_name || "Unknown";
          pdfAnnotation.Id = a.id;
          pdfAnnotation.Subject = `#${a.sequence_number}`;
          annotationManager.addAnnotation?.(pdfAnnotation);
        }
      } catch (e) {
        console.warn("Failed to add saved annotation to viewer:", e);
      }
    }

    try {
      annotationManager.redrawAnnotations?.();
    } catch {}
  };

  // --- Annotation lifecycle handlers ---

  // Add (user created) -> optimistic UI -> POST to server -> persist or rollback
  const handleAnnotationAdd = async (
    annotation: any,
    annotationManager: any
  ) => {
    try {
      // -------------------------
      // Optimistic UI: show provisional header for display-only
      // -------------------------
      try {
        const provisionalId =
          annotation.Id ||
          `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        annotation.Id = provisionalId;
        annotation.Author = currentUserName;
        const userText =
          (annotation.getContents && annotation.getContents()) || "";
        const nowIso = new Date().toISOString();
        const provisionalHeader = `... Saving (offline/optimistic) ...\n${currentUserName}\n${formatDateHuman(
          nowIso
        )}\n\n`;
        if (annotation.setContents)
          annotation.setContents(
            provisionalHeader + stripMetaFromText(userText)
          );
        if (annotation.Subject === undefined) annotation.Subject = `#...`;
      } catch (e) {
        console.warn("Failed to apply provisional header:", e);
      }

      // Build payload for server (server will resolve user from token; do NOT send user_name or created_at)
      const payload = {
        document_id: documentId,
        page_number: annotation.PageNumber,
        annotation_type: getAnnotationType(annotation),
        // IMPORTANT: serializeAnnotationContent strips the viewer meta header (so server gets only user content)
        content: serializeAnnotationContent(annotation),
        position_x: annotation.X || 0,
        position_y: annotation.Y || 0,
      };

      // Send to server
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      console.log("POST /api/annotations response:", res.status, json);

      if (!res.ok) {
        // rollback: remove the annotation from viewer
        addToast(
          "Failed to save annotation — offline or server error. Reverting...",
          6000
        );
        try {
          if (annotationManager.deleteAnnotation) {
            annotationManager.deleteAnnotation(annotation);
          } else if (annotationManager.deleteAnnotations) {
            annotationManager.deleteAnnotations([annotation]);
          } else {
            const list = annotationManager.getAnnotationsList?.() || [];
            const toDelete = list.filter((x: any) => x.Id === annotation.Id);
            if (toDelete.length)
              annotationManager.deleteAnnotations?.(toDelete);
          }
          annotationManager.redrawAnnotations?.();
        } catch (e) {
          console.warn(
            "Failed to delete provisional annotation after failed POST:",
            e
          );
        }
        return;
      }

      const saved: Annotation = json?.annotation ?? null;
      if (!saved) {
        addToast(
          "Server did not return saved annotation data — please retry.",
          6000
        );
        return;
      }

      // Update runtime annotation so exported PDF shows server metadata (display-only)
      try {
        annotation.Author = saved.user_name ?? currentUserName;
        annotation.Id = saved.id;
        const originalText =
          (annotation.getContents && annotation.getContents()) ||
          (saved.content?.text ?? "");
        // Remove provisional/meta header if still present then prepend server meta header
        const userOnly = stripMetaFromText(originalText);
        const metaHeader = `${saved.sequence_number}. ${
          saved.user_name ?? currentUserName
        }\n${formatDateHuman(saved.created_at)}\n\n`;
        if (annotation.setContents)
          annotation.setContents(metaHeader + userOnly);
        if (annotation.Subject === undefined)
          annotation.Subject = `#${saved.sequence_number}`;
      } catch (e) {
        console.warn(
          "Failed to modify runtime annotation object after server save:",
          e
        );
      }

      // notify parent (sidebar)
      onAnnotationSave(saved);

      // persist XFDF so reloads/imports reflect latest state
      try {
        await persistXfdf(annotationManager);
      } catch (e) {
        console.warn("persistXfdf failed after add:", e);
      }
    } catch (e) {
      console.error("handleAnnotationAdd error:", e);
      addToast("Unexpected error saving annotation.", 6000);
    }
  };

  // Modify -> optimistic attempt, revert on failure
  const handleAnnotationModify = async (
    annotation: any,
    annotationManager: any
  ) => {
    try {
      const id = annotation.Id;
      if (!id) {
        console.warn("modify: annotation has no Id (not saved on server yet)");
        addToast("Cannot modify unsaved annotation.", 4000);
        return;
      }

      // Snapshot previous state for rollback
      let prevContents: string | undefined = undefined;
      let prevX: number | undefined = undefined;
      let prevY: number | undefined = undefined;
      try {
        prevContents = annotation.getContents && annotation.getContents();
      } catch {}
      try {
        prevX = annotation.X;
        prevY = annotation.Y;
      } catch {}

      // Build payload; serializeAnnotationContent strips viewer meta header before sending
      const payload = {
        content: serializeAnnotationContent(annotation),
        position_x: annotation.X || 0,
        position_y: annotation.Y || 0,
      };

      const res = await fetch(`/api/annotations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      console.log("PATCH /api/annotations/:id response:", res.status, json);

      if (!res.ok) {
        addToast("Failed to save annotation edit — changes reverted.", 6000);
        // revert
        try {
          if (typeof prevContents !== "undefined" && annotation.setContents) {
            annotation.setContents(prevContents);
          }
          if (typeof prevX !== "undefined") annotation.X = prevX;
          if (typeof prevY !== "undefined") annotation.Y = prevY;
          annotationManager.redrawAnnotations?.();
        } catch (re) {
          console.warn("Failed to revert annotation after failed PATCH:", re);
        }
        return;
      }

      const updated = json?.annotation ?? null;
      if (updated) onAnnotationSave(updated);

      try {
        await persistXfdf(annotationManager);
      } catch (e) {
        console.warn("persistXfdf failed after modify:", e);
      }
    } catch (e) {
      console.error("handleAnnotationModify error:", e);
      addToast("Unexpected error updating annotation.", 6000);
    }
  };

  // Delete -> optimistic (viewer already removed it), if server fails re-add and notify
  const handleAnnotationDelete = async (
    annotation: any,
    annotationManager: any
  ) => {
    try {
      const id = annotation.Id;
      const cloned = { ...annotation };

      if (!id) {
        // nothing to tell server; just notify parent if you want
        return;
      }

      const res = await fetch(`/api/annotations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      console.log("DELETE /api/annotations/:id response:", res.status, json);

      if (res.ok) {
        onAnnotationDelete(id);
      } else {
        addToast(
          "Failed to delete annotation on server. Re-adding locally.",
          6000
        );
        try {
          const inst = instanceRef.current;
          const { Annotations } = inst;
          let pdfAnnotation: any = null;
          if (
            cloned.Subject?.toString().toLowerCase().includes("highlight") ||
            cloned.AnnotationType === "highlight"
          ) {
            pdfAnnotation = new Annotations.TextHighlightAnnotation({
              PageNumber: cloned.PageNumber || cloned.page_number,
              Quads: cloned.Quads || cloned.content?.quads,
            });
          } else if (cloned.Path || cloned.AnnotationType === "drawing") {
            pdfAnnotation = new Annotations.FreeHandAnnotation({
              PageNumber: cloned.PageNumber || cloned.page_number,
              Path: cloned.Path || cloned.content?.path,
              StrokeColor: cloned.StrokeColor || cloned.content?.strokeColor,
            });
          } else {
            pdfAnnotation = new Annotations.StickyAnnotation({
              PageNumber: cloned.PageNumber || cloned.page_number,
              X: cloned.X || cloned.position_x,
              Y: cloned.Y || cloned.position_y,
            });
            const meta = `${cloned.Subject ?? ""}\n${formatDateHuman(
              cloned.created_at
            )}\n\n`;
            const contents =
              cloned.getContents?.() ||
              cloned.Contents ||
              cloned.content?.text ||
              "";
            pdfAnnotation.setContents(meta + contents);
          }
          if (pdfAnnotation) {
            pdfAnnotation.Author =
              cloned.Author || cloned.user_name || currentUserName;
            pdfAnnotation.Id = cloned.Id || cloned.id;
            pdfAnnotation.Subject =
              cloned.Subject || `#${cloned.sequence_number || "?"}`;
            annotationManager.addAnnotation?.(pdfAnnotation);
            annotationManager.redrawAnnotations?.();
          }
        } catch (re) {
          console.warn("Failed to re-add annotation after failed DELETE:", re);
        }
      }

      // persist XFDF after deletion (best-effort)
      try {
        const inst = instanceRef.current;
        const am = resolveAnnotationManager(
          inst?.Core,
          resolveDocumentViewer(inst?.Core)
        );
        await persistXfdf(am);
      } catch (e) {
        console.warn("persistXfdf failed after delete:", e);
      }
    } catch (e) {
      console.error("handleAnnotationDelete error:", e);
      addToast("Unexpected error deleting annotation.", 6000);
    }
  };

  // Export current XFDF to server (so reloads/imports retain runtime state)
  const persistXfdf = async (annotationManager: any) => {
    if (!annotationManager || !documentId) return;
    try {
      if (typeof annotationManager.exportAnnotations !== "function") return;
      const xfdf = await annotationManager.exportAnnotations();
      await fetch("/api/annotations/xfdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, xfdf }),
      });
    } catch (e) {
      console.warn("persistXfdf error:", e);
    }
  };

  // Helpers to detect annotation type and serialize content
  const getAnnotationType = (annotation: any) => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return "sticky_note";
    const Core = inst.Core;
    try {
      if (annotation instanceof Core.Annotations.StickyAnnotation)
        return "sticky_note";
      if (annotation instanceof Core.Annotations.TextHighlightAnnotation)
        return "highlight";
      if (annotation instanceof Core.Annotations.FreeHandAnnotation)
        return "drawing";
    } catch {}
    if (annotation?.Subject?.toLowerCase().includes("highlight"))
      return "highlight";
    return "sticky_note";
  };

  // IMPORTANT: for sticky notes (text) we strip the viewer-only meta header before sending to server.
  // For highlights/drawings we keep the actual shape (quads/path) as content.
  const serializeAnnotationContent = (annotation: any) => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return {};
    const Core = inst.Core;
    try {
      if (annotation instanceof Core.Annotations.StickyAnnotation) {
        // strip meta header from contents before persist
        const contents = annotation.getContents?.() || "";
        return { text: stripMetaFromText(contents) };
      }
      if (annotation instanceof Core.Annotations.TextHighlightAnnotation) {
        const color = annotation.getColor?.() || { r: 255, g: 224, b: 102 };
        return {
          quads: annotation.getQuads?.(),
          color: { r: color.r, g: color.g, b: color.b },
        };
      }
      if (annotation instanceof Core.Annotations.FreeHandAnnotation) {
        // For freehand we persist the path + strokeColor (meta is only display)
        return {
          path: annotation.getPath?.(),
          strokeColor: annotation.getStrokeColor?.(),
        };
      }
    } catch {}
    return {};
  };

  // Toolbar handlers (unchanged)
  const handleToolSelect = (toolName: string) => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return;
    const Core = inst.Core;
    const dv = resolveDocumentViewer(Core);
    if (!dv) {
      console.warn("Document viewer not ready");
      return;
    }

    setSelectedTool(toolName);

    try {
      switch (toolName) {
        case "select":
          dv.setToolMode?.(Core.Tools.ToolNames.EDIT);
          break;
        case "highlight":
          dv.setToolMode?.(Core.Tools.ToolNames.TEXT_HIGHLIGHT);
          {
            const tool = dv.getTool?.(Core.Tools.ToolNames.TEXT_HIGHLIGHT);
            if (tool) {
              tool.setStyles?.({
                StrokeColor: new Core.Annotations.Color(
                  ...hexToRgb(selectedColor)
                ),
                FillColor: new Core.Annotations.Color(
                  ...hexToRgb(selectedColor)
                ),
              });
            }
          }
          break;
        case "sticky_note":
          dv.setToolMode?.(Core.Tools.ToolNames.STICKY);
          break;
        case "drawing":
          dv.setToolMode?.(Core.Tools.ToolNames.FREEHAND);
          {
            const tool = dv.getTool?.(Core.Tools.ToolNames.FREEHAND);
            if (tool)
              tool.setStyles?.({
                StrokeColor: new Core.Annotations.Color(
                  ...hexToRgb(selectedColor)
                ),
                StrokeThickness: 2,
              });
          }
          break;
      }
    } catch (e) {
      console.warn("handleToolSelect error", e);
    }
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return;
    const Core = inst.Core;
    const dv = resolveDocumentViewer(Core);
    if (!dv) return;
    const currentTool = dv.getToolMode?.();
    if (currentTool === Core.Tools.ToolNames.TEXT_HIGHLIGHT) {
      const t = dv.getTool?.(Core.Tools.ToolNames.TEXT_HIGHLIGHT);
      t?.setStyles?.({
        StrokeColor: new Core.Annotations.Color(...hexToRgb(color)),
        FillColor: new Core.Annotations.Color(...hexToRgb(color)),
      });
    } else if (currentTool === Core.Tools.ToolNames.FREEHAND) {
      const t = dv.getTool?.(Core.Tools.ToolNames.FREEHAND);
      t?.setStyles?.({
        StrokeColor: new Core.Annotations.Color(...hexToRgb(color)),
      });
    }
  };

  const handleZoom = (direction: "in" | "out" | "fit") => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return;
    const Core = inst.Core;
    const dv = resolveDocumentViewer(Core);
    if (!dv) return;
    if (direction === "in") dv.zoomIn?.();
    else if (direction === "out") dv.zoomOut?.();
    else if (direction === "fit") dv.fitToPage?.();
    setTimeout(() => {
      try {
        setZoomLevel(Math.round((dv.getZoom?.() || 1) * 100));
      } catch {}
    }, 120);
  };

  const handleExport = async () => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return;
    try {
      const Core = inst.Core;
      const dv = resolveDocumentViewer(Core);
      const am = resolveAnnotationManager(Core, dv);
      if (!dv || !am) return console.error("viewer/export not ready");
      const doc = dv.getDocument?.();
      const xfdfString = await am.exportAnnotations();
      const data = await doc.getFileData({ xfdfString, flatten: true });
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `annotated-document-${documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Persist XFDF to server after export so the flattened PDF & the server store match
      await persistXfdf(am);
    } catch (e) {
      console.error("handleExport error", e);
      addToast("Failed to export document.", 6000);
    }
  };

  // small util: hex -> rgb tuple
  const hexToRgb = (hex: string): [number, number, number] => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r
      ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)]
      : [255, 224, 102];
  };

  // Render
  return (
    <div className="w-full h-full flex flex-col relative">
      <CustomToolbar
        selectedTool={selectedTool}
        selectedColor={selectedColor}
        zoomLevel={zoomLevel}
        onToolSelect={handleToolSelect}
        onColorChange={handleColorChange}
        onZoom={handleZoom}
        onExport={handleExport}
        viewerReady={viewerReady}
      />
      <div ref={viewer as any} className="flex-1 w-full" />
      {/* Toast container (simple, small) */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: "rgba(0,0,0,0.8)",
              color: "white",
              padding: "8px 12px",
              marginBottom: 8,
              borderRadius: 6,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              maxWidth: 320,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13 }}>{t.message}</div>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ddd",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
