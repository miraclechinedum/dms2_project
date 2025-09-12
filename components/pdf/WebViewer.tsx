// components/pdf/WebViewer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
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
  existingAnnotations: Annotation[];
}

export default function WebViewerComponent({
  documentUrl,
  documentId,
  currentUserId,
  currentUserName,
  onAnnotationSave,
  onAnnotationDelete,
  existingAnnotations = [],
}: WebViewerProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const autoImportIntervalRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("select");
  const [selectedColor, setSelectedColor] = useState<string>("#FFE066");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [savingNow, setSavingNow] = useState(false);

  // Safe helpers
  function safeTry<T>(fn: () => T): T | null {
    try {
      return fn();
    } catch {
      return null;
    }
  }
  function wait(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  useEffect(() => {
    if (!viewerRef.current) return;
    setInitError(null);
    setIsReady(false);

    let cancelled = false;

    WebViewer(
      {
        path: "/webviewer",
        initialDoc: documentUrl,
        licenseKey:
          "demo:1757509875851:604eca4e0300000000877d781419f71633c68ea80c20ad3325f5806b42",
        ui: "legacy",
        disabledElements: [
          "ribbons",
          "toggleNotesButton",
          "searchButton",
          "menuButton",
          "rubberStampToolGroupButton",
          "stampToolGroupButton",
          "fileAttachmentToolGroupButton",
          "calloutToolGroupButton",
          "undo",
          "redo",
          "eraserToolButton",
        ],
        enableFilePicker: false,
      },
      viewerRef.current
    )
      .then((instance) => {
        if (cancelled) {
          try {
            instance.UI?.dispose?.();
          } catch {}
          return;
        }

        instanceRef.current = instance;
        console.info(
          "WebViewer promise resolved. Will wait for documentLoaded and start AUTO-IMPORT loop."
        );

        // expose for quick manual testing
        // @ts-ignore
        window.__PDFTRON_INSTANCE__ = instance;

        // documentLoaded handler (primary import path)
        instance.UI.addEventListener("documentLoaded", async () => {
          try {
            console.info(
              "documentLoaded event fired (handler). Running setupAfterLoad."
            );
            await setupAfterLoad(instance);
            setIsReady(true);
          } catch (err) {
            console.error("Error during setup after documentLoaded:", err);
            setInitError(String(err ?? "unknown error"));
          }
        });

        // Start an AUTO-IMPORT loop as a fallback (handles missed/early documentLoaded)
        startAutoImportLoop();
      })
      .catch((err) => {
        console.error("WebViewer failed to initialize:", err);
        setInitError(String(err ?? "WebViewer init failed"));
      });

    return () => {
      cancelled = true;
      try {
        if (saveTimeoutRef.current) {
          window.clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        if (autoImportIntervalRef.current) {
          window.clearInterval(autoImportIntervalRef.current);
          autoImportIntervalRef.current = null;
        }
        instanceRef.current?.UI?.dispose?.();
      } catch (e) {}
      instanceRef.current = null;
      // @ts-ignore
      if (window.__PDFTRON_INSTANCE__) delete window.__PDFTRON_INSTANCE__;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentUrl]);

  // -------------------------
  // AUTO-IMPORT loop: tries periodically until success (fallback)
  // -------------------------
  function startAutoImportLoop() {
    if (autoImportIntervalRef.current) return;

    let tries = 0;
    const maxTries = 20; // ~8 seconds with 400ms interval
    const intervalMs = 400;

    console.info(
      "AUTO-IMPORT: Starting fallback loop (interval:",
      intervalMs,
      "ms)"
    );
    // @ts-ignore
    autoImportIntervalRef.current = window.setInterval(async () => {
      tries++;
      const inst = instanceRef.current;
      if (!inst) {
        console.debug("AUTO-IMPORT: no instance yet");
        if (tries >= maxTries) {
          stopAutoImportLoop();
        }
        return;
      }

      const Core = inst.Core;
      const documentViewer = Core?.getDocumentViewer?.() ?? Core.documentViewer;
      // wait for at least one page to be available (viewer wiring)
      const pageCount =
        safeTry(
          () =>
            documentViewer.getPageCount?.() ?? documentViewer.getPageCount?.()
        ) ?? 0;
      const annotationManager =
        Core.getAnnotationManager?.() ?? Core.annotationManager;

      console.debug("AUTO-IMPORT: try", tries, {
        pageCount,
        annotationManagerExists: !!annotationManager,
      });

      if (annotationManager && pageCount && pageCount > 0) {
        // attempt load & import now
        try {
          stopAutoImportLoop();
          console.info(
            "AUTO-IMPORT: preconditions met (annotationManager + pages). Calling setupAfterLoad fallback import."
          );
          await setupAfterLoad(inst);
          setIsReady(true);
        } catch (e) {
          console.warn("AUTO-IMPORT: setupAfterLoad fallback failed:", e);
        }
      } else if (tries >= maxTries) {
        console.warn("AUTO-IMPORT: maxTries reached; stopping fallback loop.");
        stopAutoImportLoop();
      }
    }, intervalMs);
  }

  function stopAutoImportLoop() {
    if (autoImportIntervalRef.current) {
      window.clearInterval(autoImportIntervalRef.current);
      autoImportIntervalRef.current = null;
    }
  }

  // -------------------------
  // setupAfterLoad: attach listeners + fetch/import XFDF
  // -------------------------
  const setupAfterLoad = async (instance: any) => {
    if (!instance)
      throw new Error("WebViewer instance missing in setupAfterLoad");
    const { Core } = instance;

    // init zoom
    try {
      const { documentViewer } = Core;
      setTimeout(() => {
        try {
          const zoom = Math.round(documentViewer.getZoom() * 100);
          setZoomLevel(Number.isFinite(zoom) ? zoom : 100);
        } catch {}
      }, 50);
    } catch (e) {
      console.warn("Could not hook documentViewer events (non-fatal)", e);
    }

    // attach annotationChanged handler
    try {
      const annotationManager =
        Core.getAnnotationManager?.() ?? Core.annotationManager;
      if (!annotationManager) {
        console.warn("setupAfterLoad: annotation manager not available");
      } else {
        // add listener once (guarded)
        try {
          annotationManager.addEventListener(
            "annotationChanged",
            (annotations: any[], action: string) => {
              try {
                console.info("annotationChanged:", {
                  action,
                  count: Array.isArray(annotations) ? annotations.length : 0,
                });

                // schedule per-annotation ops
                setTimeout(() => {
                  for (const ann of annotations ?? []) {
                    try {
                      if (action === "add") void saveAnnotationToDatabase(ann);
                      else if (action === "delete")
                        void deleteAnnotationFromDatabase(ann.Id);
                      else if (action === "modify")
                        void updateAnnotationInDatabase(ann);
                    } catch (e) {
                      console.error("per-annotation inner error:", e);
                    }
                  }
                }, 0);

                // export full XFDF and debounce save
                try {
                  const maybeXfdf = annotationManager.exportAnnotations?.();
                  Promise.resolve(maybeXfdf)
                    .then((xfdfString: string) => {
                      if (!xfdfString) return;
                      if (saveTimeoutRef.current)
                        window.clearTimeout(saveTimeoutRef.current);
                      saveTimeoutRef.current = window.setTimeout(() => {
                        void debugSaveXfdfNow();
                        saveTimeoutRef.current = null;
                      }, 700);
                    })
                    .catch((err: any) => {
                      console.warn("exportAnnotations promise rejected:", err);
                    });
                } catch (e) {
                  console.warn(
                    "Failed to export XFDF in annotationChanged:",
                    e
                  );
                }
              } catch (err) {
                console.error("annotationChanged handler error:", err);
              }
            }
          );
        } catch (e) {
          console.warn(
            "Could not attach annotationChanged listener (non-fatal)",
            e
          );
        }
      }
    } catch (e) {
      console.warn(
        "Failed to attach annotationChanged listener (non-fatal)",
        e
      );
    }

    // import existingAnnotations (legacy)
    try {
      if (existingAnnotations && existingAnnotations.length) {
        try {
          importAndApplyAnnotations(instance, existingAnnotations);
        } catch (e) {
          console.error("importAndApplyAnnotations failed:", e);
        }
      }
    } catch (e) {
      console.warn("Loading existingAnnotations failed (non-fatal)", e);
    }

    // MAIN: fetch XFDF from server and import robustly
    try {
      const annotationManager =
        Core.getAnnotationManager?.() ?? Core.annotationManager;
      if (!annotationManager) {
        console.warn("setupAfterLoad: no annotationManager for import step");
        instanceRef.current = instance;
        return;
      }

      const xfdf = await loadXfdfFromServer(documentId);
      console.info("Loaded XFDF from server, length:", xfdf?.length ?? 0);

      if (xfdf && xfdf.length > 5) {
        console.group("XFDF DEBUG");
        console.log("head:", xfdf.slice(0, 300));
        console.log("tail:", xfdf.slice(Math.max(0, xfdf.length - 300)));
        console.groupEnd();

        const ok = await importXfdfWithRetries(annotationManager, xfdf, 6, 300);
        if (!ok) {
          console.warn(
            "XFDF import retries failed — XFDF may be malformed or missing <annots>"
          );
        } else {
          console.info("XFDF import succeeded during setupAfterLoad.");
        }
      } else {
        console.info("No XFDF returned from server.");
      }
    } catch (e) {
      console.error("Failed to fetch/import XFDF from server (non-fatal)", e);
    }

    instanceRef.current = instance;
  };

  // -------------------------
  // import helper with transforms + retries
  // -------------------------
  async function importXfdfWithRetries(
    annotationManager: any,
    rawXfdf: string,
    attempts = 6,
    delayMs = 300
  ) {
    if (!annotationManager || !rawXfdf) return false;

    const transforms: { name: string; fn: (s: string) => string }[] = [
      { name: "raw", fn: (s) => s },
      {
        name: "htmlUnescape",
        fn: (s) =>
          s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"),
      },
      {
        name: "stripBackslashes",
        fn: (s) =>
          s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'"),
      },
      {
        name: "decodedURIComponent",
        fn: (s) => {
          try {
            return decodeURIComponent(s);
          } catch {
            return s;
          }
        },
      },
    ];

    for (let round = 0; round < attempts; round++) {
      for (const t of transforms) {
        const payload = t.fn(rawXfdf);
        try {
          console.info(
            `[XFDF IMPORT] round=${round} transform=${t.name} payloadLen=${
              payload?.length ?? 0
            }`
          );
          annotationManager.importAnnotations?.(payload);
          annotationManager.redrawAnnotations?.();
          await wait(Math.max(120, delayMs));
          const list = safeTry(
            () => annotationManager.getAnnotationsList?.() ?? []
          );
          const count = Array.isArray(list)
            ? list.length
            : typeof list === "number"
            ? list
            : 0;
          console.info(
            `[XFDF IMPORT] transform=${t.name} annotationCount=${count}`
          );
          if (count > 0) {
            console.info("[XFDF IMPORT] success with transform:", t.name);
            return true;
          }
        } catch (e) {
          console.warn("[XFDF IMPORT] transform failed:", t.name, e);
        }
      }
      await wait(delayMs);
    }
    console.warn("[XFDF IMPORT] all attempts exhausted, import not successful");
    return false;
  }

  // -------------------------
  // XFDF server helpers (credentials included)
  // -------------------------
  async function saveXfdfToServer(
    documentIdLocal: string,
    xfdfString: string | null
  ) {
    if (!documentIdLocal || !xfdfString) {
      console.warn("saveXfdfToServer called with empty payload", {
        documentIdLocal,
        xfdfLength: xfdfString?.length ?? 0,
      });
      return false;
    }
    try {
      setSavingNow(true);
      console.info("Saving XFDF to server (length):", xfdfString.length);
      const res = await fetch("/api/annotations/xfdf", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: documentIdLocal, xfdf: xfdfString }),
      });
      const text = await res.text();
      console.info("saveXfdfToServer response:", res.status, text);
      setSavingNow(false);
      return res.ok;
    } catch (err) {
      setSavingNow(false);
      console.error("saveXfdfToServer error:", err);
      return false;
    }
  }

  async function loadXfdfFromServer(
    documentIdLocal: string
  ): Promise<string | null> {
    if (!documentIdLocal) return null;
    try {
      const res = await fetch(
        `/api/annotations/xfdf?documentId=${encodeURIComponent(
          documentIdLocal
        )}`,
        {
          method: "GET",
          credentials: "same-origin",
        }
      );
      if (!res.ok) {
        console.warn("loadXfdfFromServer non-ok status:", res.status);
        return null;
      }
      const body = await res.json().catch(() => null);
      return body?.xfdf ?? null;
    } catch (err) {
      console.error("loadXfdfFromServer error:", err);
      return null;
    }
  }

  // Debug manual save
  async function debugSaveXfdfNow() {
    const inst = instanceRef.current;
    if (!inst) {
      console.warn("debugSaveXfdfNow: no instance");
      return;
    }
    const annotationManager =
      inst.Core.getAnnotationManager?.() ?? inst.Core.annotationManager;
    if (!annotationManager) {
      console.warn("debugSaveXfdfNow: no annotationManager");
      return;
    }

    try {
      const maybe = annotationManager.exportAnnotations?.();
      const xfdf = await Promise.resolve(maybe);
      console.info("debugSaveXfdfNow - xfdf length:", xfdf?.length ?? 0);
      await saveXfdfToServer(documentId, xfdf);
    } catch (e) {
      console.error("debugSaveXfdfNow error:", e);
    }
  }

  // -------------------------
  // per-annotation CRUD (kept)
  // -------------------------
  const saveAnnotationToDatabase = async (annotation: any) => {
    try {
      const payload = {
        id: annotation.Id,
        document_id: documentId,
        user_id: currentUserId,
        page_number: annotation.PageNumber,
        annotation_type: getAnnotationType(annotation),
        content: serializeAnnotationContent(annotation),
        position_x: annotation.X ?? 0,
        position_y: annotation.Y ?? 0,
        sequence_number: Date.now(),
      };

      const res = await fetch("/api/annotations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const { annotation: saved } = await res.json();
        onAnnotationSave?.(saved);
      } else {
        console.warn(
          "saveAnnotationToDatabase server returned non-OK:",
          res.status
        );
      }
    } catch (e) {
      console.error("saveAnnotationToDatabase failed:", e);
    }
  };

  const deleteAnnotationFromDatabase = async (annotationId: string) => {
    try {
      const res = await fetch(`/api/annotations/${annotationId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        onAnnotationDelete?.(annotationId);
      } else {
        console.warn("deleteAnnotationFromDatabase non-OK:", res.status);
      }
    } catch (e) {
      console.error("deleteAnnotationFromDatabase failed:", e);
    }
  };

  const updateAnnotationInDatabase = async (annotation: any) => {
    try {
      const payload = {
        content: serializeAnnotationContent(annotation),
        position_x: annotation.X ?? 0,
        position_y: annotation.Y ?? 0,
      };
      const res = await fetch(`/api/annotations/${annotation.Id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { annotation: updated } = await res.json();
        onAnnotationSave?.(updated);
      } else {
        console.warn("updateAnnotationInDatabase non-OK:", res.status);
      }
    } catch (e) {
      console.error("updateAnnotationInDatabase failed:", e);
    }
  };

  // -------------------------
  // import existingAnnotations helper (kept)
  // -------------------------
  const importAndApplyAnnotations = (
    instance: any,
    annotations: Annotation[]
  ) => {
    if (!instance) return;
    const { Core, Annotations } = instance;
    const annotationManager =
      Core.getAnnotationManager?.() ?? Core.annotationManager;
    if (!annotationManager) return;

    for (const a of annotations) {
      try {
        let pdfAnnotation: any = null;

        if (a.annotation_type === "sticky_note") {
          pdfAnnotation = new Annotations.StickyAnnotation({
            PageNumber: a.page_number,
            X: a.position_x,
            Y: a.position_y,
          });
          pdfAnnotation.setContents?.(a.content?.text ?? "");
        } else if (a.annotation_type === "highlight") {
          pdfAnnotation = new Annotations.TextHighlightAnnotation({
            PageNumber: a.page_number,
            Quads: a.content?.quads ?? [],
          });
          if (a.content?.color) {
            pdfAnnotation.setColor?.(
              new Annotations.Color(
                a.content.color.r || 255,
                a.content.color.g || 224,
                a.content.color.b || 102
              )
            );
          }
        } else if (a.annotation_type === "drawing") {
          pdfAnnotation = new Annotations.FreeHandAnnotation({
            PageNumber: a.page_number,
            Path: a.content?.path ?? [],
            StrokeColor: a.content?.strokeColor ?? null,
          });
        }

        if (pdfAnnotation) {
          pdfAnnotation.Author = a.user_name ?? "Unknown";
          pdfAnnotation.Id = a.id;
          annotationManager.addAnnotation(pdfAnnotation);
        }
      } catch (e) {
        console.warn("Failed to convert/import an annotation (skipping):", e);
      }
    }

    try {
      annotationManager.redrawAnnotations?.();
    } catch (e) {}
  };

  // -------------------------
  // UI handlers for tool/color/zoom/export (kept)
  // -------------------------
  const handleToolSelect = (tool: string) => {
    try {
      const inst = instanceRef.current;
      if (!inst) return;

      const Core = inst.Core;
      const UI = inst.UI;
      const Tools = Core?.Tools;
      const TN = Tools?.ToolNames ?? null;

      const FALLBACK = {
        select: "AnnotationEdit",
        highlight: "TextHighlightTool",
        sticky_note: "AnnotationCreateSticky",
        drawing: "AnnotationCreateFreeHand",
      } as const;

      let toolName: string;
      if (TN) {
        switch (tool) {
          case "select":
            toolName = TN.EDIT ?? FALLBACK.select;
            break;
          case "highlight":
            toolName = TN.TEXT_HIGHLIGHT ?? FALLBACK.highlight;
            break;
          case "sticky_note":
            toolName = TN.STICKY ?? FALLBACK.sticky_note;
            break;
          case "drawing":
            toolName = TN.FREEHAND ?? FALLBACK.drawing;
            break;
          default:
            toolName = TN.EDIT ?? FALLBACK.select;
        }
      } else {
        toolName = FALLBACK[tool as keyof typeof FALLBACK] ?? FALLBACK.select;
      }

      if (UI && typeof UI.setToolMode === "function") {
        UI.setToolMode(toolName);
      } else {
        const docViewer = Core.getDocumentViewer?.() ?? Core.documentViewer;
        docViewer.setToolMode(toolName);
      }

      setSelectedTool(tool);
    } catch (err) {
      console.error("handleToolSelect error:", err);
    }
  };

  const handleColorChange = (hex: string) => {
    setSelectedColor(hex);
    if (!instanceRef.current) return;

    try {
      const Core = instanceRef.current.Core;
      const docViewer = Core.getDocumentViewer?.() ?? Core.documentViewer;
      const Tools = Core?.Tools;
      const TN = Tools?.ToolNames ?? null;

      const cur = docViewer.getToolMode?.() ?? null;
      const TEXT_HIGHLIGHT_NAME = TN?.TEXT_HIGHLIGHT ?? "TextHighlightTool";
      const FREEHAND_NAME = TN?.FREEHAND ?? "AnnotationCreateFreeHand";

      if (cur === TEXT_HIGHLIGHT_NAME) {
        const highlightTool = docViewer.getTool?.(TEXT_HIGHLIGHT_NAME);
        highlightTool?.setStyles?.({
          StrokeColor: new instanceRef.current.Core.Annotations.Color(
            ...hexToRgb(hex)
          ),
          FillColor: new instanceRef.current.Core.Annotations.Color(
            ...hexToRgb(hex)
          ),
        });
      } else if (cur === FREEHAND_NAME) {
        const drawingTool = docViewer.getTool?.(FREEHAND_NAME);
        drawingTool?.setStyles?.({
          StrokeColor: new instanceRef.current.Core.Annotations.Color(
            ...hexToRgb(hex)
          ),
        });
      }
    } catch (e) {
      console.warn("handleColorChange non-fatal error:", e);
    }
  };

  const handleZoom = (direction: "in" | "out" | "fit") => {
    if (!instanceRef.current) return;
    try {
      const docViewer =
        instanceRef.current.Core.getDocumentViewer?.() ??
        instanceRef.current.Core.documentViewer;
      if (direction === "in") docViewer.zoomIn?.();
      else if (direction === "out") docViewer.zoomOut?.();
      else if (direction === "fit") docViewer.fitToPage?.();

      setTimeout(() => {
        try {
          const z = Math.round(docViewer.getZoom() * 100);
          setZoomLevel(Number.isFinite(z) ? z : zoomLevel);
        } catch (e) {}
      }, 120);
    } catch (e) {
      console.error("handleZoom error:", e);
    }
  };

  const handleExport = async () => {
    if (!instanceRef.current) return;
    try {
      const { Core } = instanceRef.current;
      const documentViewer = Core.getDocumentViewer?.() ?? Core.documentViewer;
      const annotationManager =
        Core.getAnnotationManager?.() ?? Core.annotationManager;
      const doc = documentViewer.getDocument();
      const maybeXfdf = annotationManager.exportAnnotations?.();
      const xfdfString = await Promise.resolve(maybeXfdf);
      const data = await doc.getFileData?.({ xfdfString, flatten: true });
      const blob = new Blob([data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `annotated-${documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  // helpers (getAnnotationType, serializeAnnotationContent, hexToRgb)
  const getAnnotationType = (annotation: any) => {
    try {
      const Anns = instanceRef.current?.Core?.Annotations;
      if (!Anns) return "sticky_note";
      if (annotation instanceof Anns.StickyAnnotation) return "sticky_note";
      if (annotation instanceof Anns.TextHighlightAnnotation)
        return "highlight";
      if (annotation instanceof Anns.FreeHandAnnotation) return "drawing";
    } catch (e) {}
    return "sticky_note";
  };

  const serializeAnnotationContent = (annotation: any) => {
    try {
      const Anns = instanceRef.current?.Core?.Annotations;
      if (!Anns) return {};
      if (annotation instanceof Anns.StickyAnnotation) {
        return { text: annotation.getContents?.() ?? "" };
      }
      if (annotation instanceof Anns.TextHighlightAnnotation) {
        const color = annotation.getColor?.();
        return {
          quads: annotation.getQuads?.() ?? [],
          color: color ? { r: color.r, g: color.g, b: color.b } : null,
        };
      }
      if (annotation instanceof Anns.FreeHandAnnotation) {
        return {
          path: annotation.getPath?.() ?? [],
          strokeColor: annotation.getStrokeColor?.() ?? null,
        };
      }
    } catch (e) {}
    return {};
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : [255, 224, 102];
  };

  // UI
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
      />

      {/* Debug save button */}
      <div style={{ position: "absolute", right: 12, top: 68, zIndex: 60 }}>
        <button
          onClick={() => void debugSaveXfdfNow()}
          className="px-2 py-1 rounded bg-primary text-white text-xs shadow"
          disabled={savingNow}
        >
          {savingNow ? "Saving..." : "Save annotations now"}
        </button>
      </div>

      {/* viewer container */}
      <div
        ref={viewerRef}
        className="flex-1 w-full"
        style={{ minHeight: 300 }}
      />

      {/* overlay if not ready */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white bg-opacity-60 p-4 rounded shadow">
            {initError ? (
              <div>
                <p className="text-sm text-red-700 font-medium">
                  Viewer initialization error
                </p>
                <pre className="text-xs text-gray-700 mt-2">{initError}</pre>
              </div>
            ) : (
              <p className="text-sm text-gray-700">Setting up PDF viewer...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
