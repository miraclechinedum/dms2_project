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
}

interface WebViewerProps {
  documentUrl: string;
  documentId: string;
  currentUserId: string;
  currentUserName: string;
  onAnnotationSave: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
  existingAnnotations: Annotation[]; // passed from parent (may be empty)
}

export default function WebViewerComponent({
  documentUrl,
  documentId,
  currentUserId,
  currentUserName,
  onAnnotationSave,
  onAnnotationDelete,
  existingAnnotations,
}: WebViewerProps) {
  const viewer = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const [selectedTool, setSelectedTool] = useState<string>("select");
  const [selectedColor, setSelectedColor] = useState<string>("#FFE066");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewerReady, setViewerReady] = useState(false);

  // Small util: format ISO to "13th Sept, 2025 2:13pm"
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
      return iso;
    }
  };

  // Helpers for backwards compatibility with different WebViewer builds
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

  useEffect(() => {
    if (!viewer.current) return;

    // diagnostic log for the weird 500 GET: show documentUrl
    // Open console and check this value
    console.info("WebViewer init - documentUrl:", documentUrl);

    let instance: any = null;

    WebViewer(
      {
        path: "/webviewer",
        initialDoc: documentUrl,
        licenseKey:
          "demo:1757509875851:604eca4e0300000000877d781419f71633c68ea80c20ad3325f5806b42",
        // If you see the "GET /documents/.HeaderItems..." error, try commenting out the css line below.
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
        const { UI, Core, Annotations } = instance;

        // Attach documentLoaded in a robust way
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
            // hide UI (best-effort)
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

            // import any saved XFDF for this document (if your server stores it)
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
                        "annotationManager does not expose importAnnotations/importXfdf"
                      );
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Failed to fetch/import XFDF:", e);
            }

            // Attach annotationChanged listener
            if (
              annotationManager &&
              typeof annotationManager.addEventListener === "function"
            ) {
              annotationManager.addEventListener(
                "annotationChanged",
                async (annotations: any[], action: string) => {
                  if (!Array.isArray(annotations)) return;
                  if (action === "add") {
                    for (const ann of annotations) {
                      await handleAnnotationAdd(ann, annotationManager);
                    }
                  } else if (action === "delete") {
                    for (const ann of annotations) {
                      await handleAnnotationDelete(ann);
                    }
                  } else if (action === "modify") {
                    for (const ann of annotations) {
                      await handleAnnotationModify(ann, annotationManager);
                    }
                  }
                }
              );
            }

            // Finally, load per-annotation metadata from props if any
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

  // ---- Core actions: add/modify/delete handlers ----

  // Called when an annotation is created in the viewer
  const handleAnnotationAdd = async (
    annotation: any,
    annotationManager: any
  ) => {
    try {
      // Build minimal content payload for server
      const payload = {
        document_id: documentId,
        page_number: annotation.PageNumber,
        annotation_type: getAnnotationType(annotation),
        content: serializeAnnotationContent(annotation),
        position_x: annotation.X || 0,
        position_y: annotation.Y || 0,
        user_id: currentUserId,
        user_name: currentUserName,
      };

      // POST to server, server assigns sequence_number and created_at, returns saved annotation
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn("Server rejected annotation POST:", res.status);
        return;
      }

      const json = await res.json();
      const saved: Annotation = json?.annotation ?? null;
      if (!saved) {
        console.warn("No annotation returned from server");
        return;
      }

      // Update the runtime annotation instance so it has the server id and visible metadata
      try {
        // set Author
        annotation.Author = saved.user_name ?? currentUserName;
        // ensure Id matches server record
        annotation.Id = saved.id;
        // prepend metadata header to contents (so exported PDF shows it too)
        const originalText =
          (annotation.getContents && annotation.getContents()) ||
          (saved.content?.text ?? "");
        const metaHeader = `${saved.sequence_number}. ${
          saved.user_name ?? currentUserName
        }\n${formatDateHuman(saved.created_at)}\n\n`;
        if (annotation.setContents)
          annotation.setContents(metaHeader + originalText);
        // set Subject to sequence for readability
        if (annotation.Subject === undefined)
          annotation.Subject = `#${saved.sequence_number}`;
      } catch (e) {
        console.warn("Failed to modify runtime annotation object:", e);
      }

      // notify parent
      onAnnotationSave(saved);

      // Persist full XFDF to server so viewer import is possible on reload
      try {
        await persistXfdf(annotationManager);
      } catch (e) {
        console.warn("persistXfdf failed after add:", e);
      }
    } catch (e) {
      console.error("handleAnnotationAdd error:", e);
    }
  };

  // Called when an annotation is modified
  const handleAnnotationModify = async (
    annotation: any,
    annotationManager: any
  ) => {
    try {
      const id = annotation.Id;
      if (!id) {
        console.warn("modify: annotation has no Id (not saved on server yet)");
        return;
      }

      const payload = {
        content: serializeAnnotationContent(annotation),
        position_x: annotation.X || 0,
        position_y: annotation.Y || 0,
      };

      const res = await fetch(`/api/annotations/${id}`, {
        method: "PATCH", // use PATCH to avoid 405 if server doesn't accept PUT
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn("Failed to PATCH annotation:", res.status);
        return;
      }

      const { annotation: updated } = await res.json();
      if (updated) onAnnotationSave(updated);

      // persist XFDF after modification too
      try {
        await persistXfdf(annotationManager);
      } catch (e) {
        console.warn("persistXfdf failed after modify:", e);
      }
    } catch (e) {
      console.error("handleAnnotationModify error:", e);
    }
  };

  // Called when annotation(s) are deleted in the viewer
  const handleAnnotationDelete = async (annotation: any) => {
    try {
      const id = annotation.Id;
      if (!id) {
        // nothing to tell server
        return;
      }

      const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        console.warn("Failed to DELETE annotation:", res.status);
      } else {
        onAnnotationDelete(id);
      }

      // refresh XFDF (best-effort)
      try {
        const inst = instanceRef.current;
        const annotationManager = resolveAnnotationManager(
          inst?.Core,
          resolveDocumentViewer(inst?.Core)
        );
        await persistXfdf(annotationManager);
      } catch (e) {
        console.warn("persistXfdf failed after delete:", e);
      }
    } catch (e) {
      console.error("handleAnnotationDelete error:", e);
    }
  };

  // Persist current XFDF to server (so exported annotations survive refresh)
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

  // Load existing annotations passed in from parent (or fetched from server by parent)
  const loadExistingAnnotations = async () => {
    const inst = instanceRef.current;
    if (!inst) return;
    const { Core, Annotations } = inst;
    const docViewer = resolveDocumentViewer(Core);
    const annotationManager = resolveAnnotationManager(Core, docViewer);
    if (!annotationManager) return;

    // clear existing viewer annotations first (best-effort)
    try {
      const list = annotationManager.getAnnotationsList?.() || [];
      if (list.length) annotationManager.deleteAnnotations?.(list);
    } catch (e) {}

    // If parent did not give annotations, fetch from server ourselves (fallback)
    let annList =
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
        }
      } catch (e) {
        console.warn("Failed to fetch annotations fallback:", e);
      }
    }

    if (!annList || !annList.length) {
      try {
        annotationManager.redrawAnnotations?.();
      } catch {}
      return;
    }

    // Add them to the viewer
    for (const a of annList) {
      try {
        let pdfAnnotation: any = null;
        if (a.annotation_type === "sticky_note") {
          pdfAnnotation = new Annotations.StickyAnnotation({
            PageNumber: a.page_number,
            X: a.position_x,
            Y: a.position_y,
          });
          // Put metadata header so it's visible & exported
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

  // Helpers: getType & serialize (works for common annotation classes)
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
    // fallback by props
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
        return { text: annotation.getContents?.() || "" };
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

  // Tool handlers and UI control functions (same functionality but defensive)
  const handleToolSelect = (toolName: string) => {
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return;
    const Core = inst.Core;
    const documentViewer = resolveDocumentViewer(Core);
    if (!documentViewer) {
      console.warn("Document viewer not ready");
      return;
    }

    setSelectedTool(toolName);

    try {
      switch (toolName) {
        case "select":
          documentViewer.setToolMode?.(Core.Tools.ToolNames.EDIT);
          break;
        case "highlight":
          documentViewer.setToolMode?.(Core.Tools.ToolNames.TEXT_HIGHLIGHT);
          {
            const tool = documentViewer.getTool?.(
              Core.Tools.ToolNames.TEXT_HIGHLIGHT
            );
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
          documentViewer.setToolMode?.(Core.Tools.ToolNames.STICKY);
          break;
        case "drawing":
          documentViewer.setToolMode?.(Core.Tools.ToolNames.FREEHAND);
          {
            const tool = documentViewer.getTool?.(
              Core.Tools.ToolNames.FREEHAND
            );
            if (tool) {
              tool.setStyles?.({
                StrokeColor: new Core.Annotations.Color(
                  ...hexToRgb(selectedColor)
                ),
                StrokeThickness: 2,
              });
            }
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
    }
  };

  // Small util
  const hexToRgb = (hex: string): [number, number, number] => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r
      ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)]
      : [255, 224, 102];
  };

  // render
  return (
    <div className="w-full h-full flex flex-col">
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
    </div>
  );
}
