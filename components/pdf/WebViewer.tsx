"use client";

import { useEffect, useRef, useState } from "react";
import WebViewer from "@pdftron/webviewer";

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
  assignedToUserId?: string;
  onAnnotationSave?: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  existingAnnotations: Annotation[];
  registerHandlers?: (handlers: {
    highlightAnnotation: (id: string) => Promise<void>;
    exportDocument: () => Promise<void>;
  }) => void;
}

type Toast = { id: string; message: string };

export default function WebViewerComponent({
  documentUrl,
  documentId,
  currentUserId,
  currentUserName,
  assignedToUserId,
  onAnnotationSave,
  onAnnotationDelete,
  existingAnnotations,
  registerHandlers,
}: WebViewerProps) {
  const viewer = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const annotationChangeHandlerRef = useRef<any>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [instanceId] = useState(
    () => `webviewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  // Calculate if current user can annotate
  const canAnnotate =
    assignedToUserId && String(currentUserId) === String(assignedToUserId);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, duration = 4000) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  };
  const removeToast = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));

  // Date formatting helper
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

  // Helpers for different builds
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

  // Strip header text helpers
  const stripMetaFromText = (text: string | undefined) => {
    if (!text || typeof text !== "string") return text ?? "";
    const firstDoubleNewlineIndex = text.indexOf("\n\n");
    if (firstDoubleNewlineIndex === -1 || firstDoubleNewlineIndex > 200)
      return text;
    const header = text.slice(0, firstDoubleNewlineIndex).trim();
    if (
      /^\s*(\d+\.|\.\.\.)/.test(header) ||
      /\d{4}/.test(header) ||
      /^[A-Za-z0-9 ,]+$/.test(header.split("\n")[0])
    ) {
      return text.slice(firstDoubleNewlineIndex + 2);
    }
    return text;
  };

  // Read-only CSS injection
  const injectReadOnlyCss = () => {
    const id = "wv-readonly-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.innerHTML = `
      /* Hide toolbar elements when read-only */
      .Header, .ToolsHeader, .ribbons, .MenuOverlay, .LeftPanel, .NotesPanel {
        display: none !important;
      }
      /* Ensure the document area takes full height */
      .DocumentContainer {
        height: 100vh !important;
      }
    `;
    document.head.appendChild(s);
  };

  const removeReadOnlyCss = () => {
    const id = "wv-readonly-css";
    const el = document.getElementById(id);
    if (el) el.remove();

    // Also clean up any inline styles
    setTimeout(() => {
      ["toolsHeader", "ribbons", "header"].forEach((className) => {
        const element = document.querySelector(`.${className}`) as HTMLElement;
        if (element) {
          element.style.display = "";
          element.style.visibility = "";
          element.style.opacity = "";
        }
      });
    }, 500);
  };

  // Clear leftover loading overlays
  const clearLoadingOverlays = () => {
    try {
      const selectors = [
        ".Modal",
        ".modal",
        ".Overlay",
        ".overlay",
        ".modal-backdrop",
        ".ModalBackdrop",
        ".loadingIndicator",
        ".wv-loading",
        ".Loading",
        ".webviewer-modal",
        ".modal-overlay",
        ".modal-backdrop",
        "[data-wv-overlay]",
        "#overlay",
        ".overlay-screen",
      ];

      const root = viewer.current;
      if (root) {
        for (const sel of selectors) {
          const found = root.querySelectorAll(sel);
          found.forEach((n) => {
            try {
              (n as HTMLElement).remove();
            } catch {}
          });
        }
      }
    } catch (e) {
      // non-fatal
    }
  };

  // Cleanup function
  const cleanupWebViewer = () => {
    console.log("🧹 WebViewer cleanup for instance:", instanceId);

    try {
      const instance = instanceRef.current;
      if (instance) {
        const { Core, UI } = instance;

        // Remove event listeners
        const dv = resolveDocumentViewer(Core);
        const am = resolveAnnotationManager(Core, dv);

        if (am && annotationChangeHandlerRef.current) {
          try {
            am.removeEventListener(
              "annotationChanged",
              annotationChangeHandlerRef.current
            );
          } catch (e) {
            console.warn("Failed to remove annotation listener:", e);
          }
        }

        // Close document and destroy instance
        try {
          UI.closeDocument();
        } catch (e) {
          console.warn("Failed to close document:", e);
        }

        // Force cleanup of WebViewer DOM
        try {
          UI.dispose();
        } catch (e) {
          console.warn("Failed to dispose UI:", e);
        }
      }
    } catch (e) {
      console.warn("WebViewer cleanup error:", e);
    } finally {
      instanceRef.current = null;
      annotationChangeHandlerRef.current = null;
      setViewerReady(false);
      setInitialized(false);

      // Clear the container
      if (viewer.current) {
        viewer.current.innerHTML = "";
      }

      removeReadOnlyCss();
      clearLoadingOverlays();
    }
  };

  // Export document function
  const exportDocument = async () => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) {
      addToast("Viewer not ready for export", 3000);
      throw new Error("Viewer not ready");
    }

    try {
      const Core = inst.Core;
      const dv = resolveDocumentViewer(Core);
      const am = resolveAnnotationManager(Core, dv);

      if (!dv || !am) {
        addToast("Viewer/export not ready", 3000);
        throw new Error("Viewer components not available");
      }

      const doc = dv.getDocument?.();
      if (!doc) {
        addToast("Document not loaded", 3000);
        throw new Error("Document not loaded");
      }

      addToast("Preparing document for export...", 2000);

      // Export annotations as XFDF
      const xfdfString = await am.exportAnnotations();

      // Get PDF data with annotations flattened
      const data = await doc.getFileData({
        xfdfString,
        flatten: true,
      });

      // Create blob and download
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `annotated-document-${documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Persist XFDF to server
      await persistXfdf(am);

      addToast("Document exported successfully!", 3000);
    } catch (e) {
      console.error("Export error", e);
      addToast("Failed to export document", 4000);
      throw e;
    }
  };

  // Initialize WebViewer with proper cleanup
  useEffect(() => {
    if (!viewer.current) {
      console.log("❌ WebViewer container not found");
      return;
    }

    if (initialized) {
      console.log("🔄 WebViewer already initialized, skipping");
      return;
    }

    console.log("🚀 WebViewer init starting for instance:", instanceId);
    console.info("WebViewer init - documentUrl:", documentUrl);
    console.info(
      "Permission check - canAnnotate:",
      canAnnotate,
      "assignedToUserId:",
      assignedToUserId,
      "currentUserId:",
      currentUserId
    );

    let mountSuccessful = false;

    // Clean up any existing content first
    if (viewer.current) {
      viewer.current.innerHTML = "";
    }

    // Define disabled elements based on permissions
    const disabledElements = !canAnnotate
      ? [
          "leftPanel",
          "notesPanel",
          "searchButton",
          "menuButton",
          "toggleNotesButton",
          "toolsHeader",
          "header",
          "ribbons",
          "toolbarGroup-Annotate",
          "toolbarGroup-Edit",
          "toolbarGroup-Insert",
          "toolbarGroup-View",
          "toolbarGroup-Share",
          "annotationPopup",
          "stylePopup",
          "richTextPopup",
        ]
      : []; // Empty array for users who can annotate

    if (!canAnnotate) injectReadOnlyCss();

    WebViewer(
      {
        path: "/webviewer",
        initialDoc: documentUrl,
        licenseKey:
          "demo:1757509875851:604eca4e0300000000877d781419f71633c68ea80c20ad3325f5806b42",
        disabledElements: disabledElements,
        enableAnnotationTools: canAnnotate,
        enableFilePicker: false,
        enableMeasurement: canAnnotate,
        enableRedaction: canAnnotate,
        fullAPI: true,
        css: canAnnotate
          ? ""
          : ".ToolsHeader, .ribbons { display: none !important; }",
      },
      viewer.current
    )
      .then((webViewerInstance) => {
        instanceRef.current = webViewerInstance;
        mountSuccessful = true;

        const { UI, Core } = webViewerInstance;

        console.log("✅ WebViewer mounted successfully");

        // SIMPLIFIED: Let WebViewer handle toolbar based on disabledElements
        if (canAnnotate) {
          removeReadOnlyCss();
          console.log("✅ Annotation tools enabled for assigned user");
        }

        const documentViewer = resolveDocumentViewer(Core);
        const attachLoaded = (dv: any) => {
          if (!dv) return;
          if (typeof dv.addEventListener === "function")
            dv.addEventListener("documentLoaded", onDocumentLoaded);
          else if (dv.addEvent) dv.addEvent("documentLoaded", onDocumentLoaded);
        };

        async function onDocumentLoaded() {
          try {
            const dv = resolveDocumentViewer(Core);
            const annotationManager = resolveAnnotationManager(Core, dv);

            // Final permission setup after document loads
            if (!canAnnotate && annotationManager) {
              try {
                if (
                  typeof annotationManager.enableReadOnlyMode === "function"
                ) {
                  annotationManager.enableReadOnlyMode(true);
                } else if (
                  typeof annotationManager.setReadOnly === "function"
                ) {
                  annotationManager.setReadOnly(true);
                }
                // Don't call UI.setReadOnlyMode - let disabledElements handle it
              } catch (e) {
                console.warn("Failed to apply readOnly on load:", e);
              }
            } else if (canAnnotate) {
              // Ensure annotation tools are fully enabled for assigned users
              try {
                // Use minimal, safe approach
                if (typeof UI.setToolbarGroup === "function") {
                  UI.setToolbarGroup("toolbarGroup-Annotate");
                }

                // Force show tools header and ribbons with CSS
                setTimeout(() => {
                  const toolsHeader = document.querySelector(
                    ".ToolsHeader"
                  ) as HTMLElement;
                  const ribbons = document.querySelector(
                    ".ribbons"
                  ) as HTMLElement;
                  if (toolsHeader) {
                    toolsHeader.style.display = "flex";
                    toolsHeader.style.visibility = "visible";
                    toolsHeader.style.opacity = "1";
                  }
                  if (ribbons) {
                    ribbons.style.display = "flex";
                    ribbons.style.visibility = "visible";
                    ribbons.style.opacity = "1";
                  }
                }, 1000);
              } catch (e) {
                console.warn("Toolbar finalization error:", e);
              }
            }

            clearLoadingOverlays();

            // Import XFDF
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
                    }
                    annotationManager.redrawAnnotations?.();
                  }
                }
              }
            } catch (e) {
              console.warn("Failed to fetch/import XFDF:", e);
            }

            // Annotation changed listener
            if (
              annotationManager &&
              typeof annotationManager.addEventListener === "function"
            ) {
              const handler = async (annotations: any[], action: string) => {
                if (!canAnnotate) {
                  addToast(
                    "You are not the assigned reviewer - annotations disabled",
                    2500
                  );
                  return;
                }
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
              };
              annotationChangeHandlerRef.current = handler;
              annotationManager.addEventListener("annotationChanged", handler);
            }

            // Register highlight helper
            const highlightAnnotation = async (annotationId: string) => {
              try {
                const inst = instanceRef.current;
                if (!inst) return;
                const dv2 = resolveDocumentViewer(inst.Core);
                const am2 = resolveAnnotationManager(inst.Core, dv2);
                if (!am2 || !dv2) {
                  addToast("Viewer not ready to highlight.", 3000);
                  return;
                }

                const list = am2.getAnnotationsList?.() || [];
                let target = list.find(
                  (a: any) =>
                    String(a.Id) === String(annotationId) ||
                    String(a.id) === String(annotationId)
                );
                if (!target) {
                  await loadExistingAnnotations();
                  const list2 = am2.getAnnotationsList?.() || [];
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
                  am2.deselectAllAnnotations?.();
                  if (typeof am2.jumpToAnnotation === "function") {
                    await am2.jumpToAnnotation(target);
                  } else if (dv2.setCurrentPage) {
                    dv2.setCurrentPage?.(
                      target.PageNumber || target.page_number
                    );
                  }
                  if (typeof am2.selectAnnotation === "function")
                    am2.selectAnnotation(target);
                  window.setTimeout(() => {
                    try {
                      am2.deselectAllAnnotations?.();
                    } catch {}
                  }, 3000);
                } catch (err) {
                  console.warn("highlightAnnotation select/jump failed:", err);
                }
              } catch (err) {
                console.error("highlightAnnotation error:", err);
                addToast("Could not highlight annotation.", 3500);
              }
            };

            // Register handlers for parent component
            if (typeof registerHandlers === "function") {
              registerHandlers({
                highlightAnnotation,
                exportDocument,
              });
            }

            await loadExistingAnnotations();

            setViewerReady(true);
            setInitialized(true);
            window.setTimeout(() => clearLoadingOverlays(), 250);
            console.log("✅ WebViewer documentLoaded");
          } catch (err) {
            console.error("onDocumentLoaded error:", err);
          }
        }

        attachLoaded(
          resolveDocumentViewer(Core) ?? Core?.documentViewer ?? Core
        );
      })
      .catch((err) => {
        console.error("❌ WebViewer init failed:", err);
        mountSuccessful = false;
      });

    return () => {
      cleanupWebViewer();
    };
  }, [
    documentUrl,
    documentId,
    canAnnotate,
    currentUserId,
    assignedToUserId,
    instanceId,
  ]);

  // Load annotations when ready
  useEffect(() => {
    if (!viewerReady) return;
    loadExistingAnnotations();
  }, [viewerReady, JSON.stringify(existingAnnotations || [])]);

  const loadExistingAnnotations = async () => {
    const inst = instanceRef.current;
    if (!inst) return;
    const { Core, Annotations } = inst;
    const dv = resolveDocumentViewer(Core);
    const am = resolveAnnotationManager(Core, dv);
    if (!am) return;

    try {
      const currentList = am.getAnnotationsList?.() || [];
      if (currentList && currentList.length) {
        try {
          am.deleteAnnotations?.(currentList);
        } catch {}
      }
    } catch {}

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
        am.redrawAnnotations?.();
      } catch {}
      return;
    }

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
          am.addAnnotation?.(pdfAnnotation);
        }
      } catch (e) {
        console.warn("Failed to add saved annotation to viewer:", e);
      }
    }

    try {
      am.redrawAnnotations?.();
    } catch {}
  };

  const handleAnnotationAdd = async (
    annotation: any,
    annotationManager: any
  ) => {
    if (!canAnnotate) {
      addToast(
        "You are not the assigned reviewer - cannot add annotations",
        2500
      );
      return;
    }
    try {
      // Apply provisional header for optimistic UI
      try {
        const provisionalId =
          annotation.Id ||
          `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        annotation.Id = provisionalId;
        annotation.Author = currentUserName;
        const userText =
          (annotation.getContents && annotation.getContents()) || "";
        const nowIso = new Date().toISOString();
        const provisionalHeader = `... Saving ...\n${currentUserName}\n${formatDateHuman(
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

      const payload = {
        document_id: documentId,
        page_number: annotation.PageNumber,
        annotation_type: getAnnotationType(annotation),
        content: serializeAnnotationContent(annotation),
        position_x: annotation.X || 0,
        position_y: annotation.Y || 0,
      };

      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Failed to save annotation — reverting...", 6000);
        try {
          if (annotationManager.deleteAnnotation)
            annotationManager.deleteAnnotation(annotation);
          else if (annotationManager.deleteAnnotations)
            annotationManager.deleteAnnotations([annotation]);
          else {
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

      try {
        annotation.Author = saved.user_name ?? currentUserName;
        annotation.Id = saved.id;
        const originalText =
          (annotation.getContents && annotation.getContents()) ||
          (saved.content?.text ?? "");
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

      if (typeof onAnnotationSave === "function") onAnnotationSave(saved);

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

  const handleAnnotationModify = async (
    annotation: any,
    annotationManager: any
  ) => {
    if (!canAnnotate) {
      addToast(
        "You are not the assigned reviewer - cannot modify annotations",
        2500
      );
      return;
    }
    try {
      const id = annotation.Id;
      if (!id) {
        addToast("Cannot modify unsaved annotation.", 4000);
        return;
      }
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
      if (!res.ok) {
        addToast("Failed to save annotation edit — changes reverted.", 6000);
        try {
          if (typeof prevContents !== "undefined" && annotation.setContents)
            annotation.setContents(prevContents);
          if (typeof prevX !== "undefined") annotation.X = prevX;
          if (typeof prevY !== "undefined") annotation.Y = prevY;
          annotationManager.redrawAnnotations?.();
        } catch (re) {
          console.warn("Failed to revert annotation after failed PATCH:", re);
        }
        return;
      }

      const updated = json?.annotation ?? null;
      if (updated && typeof onAnnotationSave === "function")
        onAnnotationSave(updated);

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

  const handleAnnotationDelete = async (
    annotation: any,
    annotationManager: any
  ) => {
    if (!canAnnotate) {
      addToast(
        "You are not the assigned reviewer - cannot delete annotations",
        2500
      );
      return;
    }
    try {
      const id = annotation.Id;
      const cloned = { ...annotation };
      if (!id) return;

      const res = await fetch(`/api/annotations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (typeof onAnnotationDelete === "function") onAnnotationDelete(id);
      } else {
        addToast(
          "Failed to delete annotation on server. Re-adding locally.",
          6000
        );
        try {
          const inst = instanceRef.current;
          const { Annotations } = inst;
          let pdfAnnotation: any = null;
          if (cloned.Path || cloned.AnnotationType === "drawing") {
            pdfAnnotation = new Annotations.FreeHandAnnotation({
              PageNumber: cloned.PageNumber || cloned.page_number,
              Path: cloned.Path || cloned.content?.path,
              StrokeColor: cloned.StrokeColor || cloned.content?.strokeColor,
            });
          } else if (
            cloned.Subject?.toString().toLowerCase().includes("highlight") ||
            cloned.AnnotationType === "highlight"
          ) {
            pdfAnnotation = new Annotations.TextHighlightAnnotation({
              PageNumber: cloned.PageNumber || cloned.page_number,
              Quads: cloned.Quads || cloned.content?.quads,
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

  const serializeAnnotationContent = (annotation: any) => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return {};
    const Core = inst.Core;
    try {
      if (annotation instanceof Core.Annotations.StickyAnnotation) {
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
        return {
          path: annotation.getPath?.(),
          strokeColor: annotation.getStrokeColor?.(),
        };
      }
    } catch {}
    return {};
  };

  return (
    <div className="w-full h-full flex flex-col relative webviewer-container">
      <div
        ref={viewer}
        className="flex-1 w-full"
        key={`webviewer-container-${instanceId}`}
      />
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
