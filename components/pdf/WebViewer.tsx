"use client";

import { useEffect, useRef, useState } from "react";
import WebViewer from "@pdftron/webviewer";
import { CustomToolbar } from "./CustomToolbar";

/* ------------------------------- Types ------------------------------- */
interface Annotation {
  id: string;
  document_id: string;
  user_id: string;
  page_number: number;
  annotation_type: "sticky_note" | "drawing" | "highlight" | "drawing";
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
  lastAssignedUserId?: string; // optional prop — if provided, no fetch needed
  onAnnotationSave?: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  existingAnnotations: Annotation[];
  registerHandlers?: (handlers: {
    highlightAnnotation: (id: string) => Promise<void>;
  }) => void;
  readOnly?: boolean;
}

type Toast = { id: string; message: string };

export default function WebViewerComponent({
  documentUrl,
  documentId,
  currentUserId,
  currentUserName,
  lastAssignedUserId: lastAssignedUserIdProp,
  onAnnotationSave,
  onAnnotationDelete,
  existingAnnotations,
  registerHandlers,
  readOnly = false,
}: WebViewerProps) {
  const viewer = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const annotationChangeHandlerRef = useRef<any>(null);
  const [selectedTool, setSelectedTool] = useState<string>("select");
  const [selectedColor, setSelectedColor] = useState<string>("#FFE066");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewerReady, setViewerReady] = useState(false);
  const [readOnlyApplied, setReadOnlyApplied] = useState(false);

  // NEW: local state for lastAssignedUserId (seeded from prop)
  const [lastAssignedUserIdState, setLastAssignedUserIdState] = useState<
    string | undefined
  >(lastAssignedUserIdProp);

  // compute assignment + effective read-only using the *state*
  const isAssignedUser =
    typeof lastAssignedUserIdState !== "undefined" &&
    String(currentUserId) === String(lastAssignedUserIdState);

  // viewer must be read-only when either prop readOnly is true OR current user is not assignee
  const effectiveReadOnly = Boolean(readOnly) || !isAssignedUser;

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, duration = 4000) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  };
  const removeToast = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));

  // date formatting helper
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

  // strip header text helpers
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

  // --- helper to inject/remove our readonly CSS (avoids "stuck" CSS) ---
  const injectReadOnlyCss = () => {
    const id = "wv-readonly-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.innerHTML = `
      /* hide common header/panels when readOnly so built-in toolbar doesn't appear */
      .HeaderItems, .ToolsHeader, .Header, .MenuOverlay, .LeftPanel, .NotesPanel {
        display: none !important;
      }
    `;
    document.head.appendChild(s);
  };
  const removeReadOnlyCss = () => {
    const id = "wv-readonly-css";
    const el = document.getElementById(id);
    if (el) el.remove();
    const els = document.querySelectorAll<HTMLElement>(
      ".Header, .LeftPanel, .NotesPanel"
    );
    els.forEach((e) => {
      e.style.display = "";
      e.style.visibility = "";
    });
  };

  // ---------- NEW: Clear leftover loading overlays --------------
  const clearLoadingOverlays = () => {
    try {
      // selectors that commonly represent modals/overlays/spinners in various builds
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

      // First try to remove overlays that are children of the viewer element (safe + scoped)
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

        // Some builds append the overlay to the viewer's parent container:
        const parent = root.parentElement;
        if (parent) {
          for (const sel of selectors) {
            const found = parent.querySelectorAll(sel);
            found.forEach((n) => {
              try {
                (n as HTMLElement).remove();
              } catch {}
            });
          }
        }
      }

      // If nothing found by scope, remove globally (useful during dev when elements are appended to body)
      for (const sel of selectors) {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach((n) => {
          // small safety: only remove nodes that are likely part of our viewer
          try {
            const shouldRemove =
              !viewer.current ||
              viewer.current.contains(n) ||
              (n.parentElement &&
                (n.parentElement.className || "")
                  .toString()
                  .toLowerCase()
                  .includes("webviewer")) ||
              (n.className &&
                n.className.toString().toLowerCase().includes("webviewer")) ||
              (n.id && n.id.toLowerCase().includes("webviewer")) ||
              (n.id && n.id.toLowerCase().includes("overlay"));
            if (shouldRemove) (n as HTMLElement).remove();
          } catch {}
        });
      }

      // Ensure viewer children are visible (in case inline style was left hidden)
      if (viewer.current) {
        const children = viewer.current.querySelectorAll<HTMLElement>("*");
        children.forEach((c) => {
          if (
            c.style &&
            (c.style.display === "none" || c.style.visibility === "hidden")
          ) {
            c.style.display = "";
            c.style.visibility = "";
          }
        });
      }
    } catch (e) {
      // non-fatal
      // console.warn("clearLoadingOverlays error:", e);
    }
  };

  // --------------------------
  // NEW: fetch document metadata if we don't have lastAssignedUserIdProp
  // --------------------------
  useEffect(() => {
    if (lastAssignedUserIdProp) {
      console.info(
        "Using lastAssignedUserId from prop:",
        lastAssignedUserIdProp
      );
      return;
    }
    const loadAssigned = async () => {
      if (!documentId) return;
      try {
        const res = await fetch(
          `/api/documents/${encodeURIComponent(documentId)}`
        );
        if (!res.ok) {
          console.warn("Document metadata fetch failed:", res.status);
          return;
        }
        const json = await res.json().catch(() => null);
        console.info("Document metadata fetch result:", json);

        const candidate =
          json?.lastAssignedUserId ||
          json?.last_assigned_user_id ||
          json?.lastAssignedToUserId ||
          json?.lastAssignedTo ||
          json?.assigned_to ||
          json?.lastAssignedUser ||
          json?.document?.lastAssignedUserId ||
          json?.document?.last_assigned_user_id ||
          json?.document?.assigned_to ||
          undefined;

        if (candidate) {
          setLastAssignedUserIdState(String(candidate));
          console.info("Discovered lastAssignedUserId:", candidate);
        } else {
          console.info(
            "No lastAssignedUserId discovered from document metadata."
          );
        }
      } catch (e) {
        console.warn("Failed to fetch document metadata:", e);
      }
    };

    loadAssigned();
  }, [documentId, lastAssignedUserIdProp]);

  // --- init WebViewer (use effectiveReadOnly to avoid flash/persistence) ---
  useEffect(() => {
    if (!viewer.current) return;

    console.info("WebViewer init - documentUrl:", documentUrl);

    // debug output — helps confirm props & flags
    console.info("WebViewer debug:", {
      currentUserId,
      lastAssignedUserIdProp,
      lastAssignedUserIdState,
      isAssignedUser,
      readOnlyProp: readOnly,
      effectiveReadOnly,
    });

    let instance: any = null;
    const disableList = [
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
    ];

    if (effectiveReadOnly) injectReadOnlyCss();

    WebViewer(
      {
        path: "/webviewer",
        initialDoc: documentUrl,
        licenseKey:
          "demo:1757509875851:604eca4e0300000000877d781419f71633c68ea80c20ad3325f5806b42",
        disabledElements: effectiveReadOnly ? disableList : [],
      },
      viewer.current
    )
      .then((webViewerInstance) => {
        instance = webViewerInstance;
        instanceRef.current = instance;
        const { UI, Core } = instance;

        try {
          if (effectiveReadOnly) {
            UI.disableElements?.(disableList);
            UI.setHeaderItems?.(() => {});
          } else {
            UI.enableElements?.([
              "header",
              "toolbarGroup-Annotate",
              "toolbarGroup-Edit",
              "toolbarGroup-Insert",
              "toolbarGroup-View",
              "toolbarGroup-Share",
            ]);
          }
        } catch (e) {
          console.warn("UI.post-init toggle failed (nonfatal):", e);
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

            console.info("WebViewer documentLoaded - debug:", {
              currentUserId,
              lastAssignedUserIdProp,
              lastAssignedUserIdState,
              isAssignedUser,
              effectiveReadOnly,
              UI_available: !!UI,
              annotationManager_available: !!annotationManager,
            });

            if (effectiveReadOnly && annotationManager) {
              try {
                if (
                  typeof annotationManager.enableReadOnlyMode === "function"
                ) {
                  annotationManager.enableReadOnlyMode(true);
                } else if (
                  typeof annotationManager.setReadOnly === "function"
                ) {
                  annotationManager.setReadOnly(true);
                } else if (UI && typeof UI.setReadOnlyMode === "function") {
                  UI.setReadOnlyMode(true);
                }
                setReadOnlyApplied(true);
                addToast("Document opened in read-only mode", 2200);
              } catch (e) {
                console.warn("Failed to apply readOnly on load:", e);
              }
            } else {
              try {
                UI.setToolbarGroup?.("toolbarGroup-Annotate");
                UI.enableElements?.([
                  "toolbarGroup-Annotate",
                  "toolbarGroup-Edit",
                  "toggleNotesButton",
                  "notesPanel",
                  "leftPanel",
                ]);
              } catch (e) {}
            }

            // If we are the assignee but something still hides the toolbar, force it
            if (isAssignedUser && UI) {
              try {
                removeReadOnlyCss();
                const dv2 = resolveDocumentViewer(Core);
                const am2 = resolveAnnotationManager(Core, dv2);
                if (am2 && typeof am2.enableReadOnlyMode === "function")
                  am2.enableReadOnlyMode(false);
                else if (am2 && typeof am2.setReadOnly === "function")
                  am2.setReadOnly(false);

                UI.setReadOnlyMode?.(false);
                UI.enableElements?.([
                  "header",
                  "toolbarGroup-Annotate",
                  "toolbarGroup-Edit",
                  "toggleNotesButton",
                  "notesPanel",
                  "leftPanel",
                ]);
                try {
                  UI.setToolbarGroup?.("toolbarGroup-Annotate");
                } catch {}
                addToast("Annotations enabled for assignee", 1200);
              } catch (e) {
                console.warn("force-enable toolbar for assignee failed:", e);
              }
            }

            // remove any leftover overlay elements (fixes "document under loader" issue)
            clearLoadingOverlays();

            // import XFDF
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
                    annotationManager.redrawAnnotations?.();
                  }
                }
              }
            } catch (e) {
              console.warn("Failed to fetch/import XFDF:", e);
            }

            // annotationChanged listener
            if (
              annotationManager &&
              typeof annotationManager.addEventListener === "function"
            ) {
              const handler = async (annotations: any[], action: string) => {
                if (effectiveReadOnly) return;
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

            // register highlight helper
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

            if (typeof registerHandlers === "function") {
              registerHandlers({ highlightAnnotation });
            }

            // finally load annotations
            await loadExistingAnnotations();

            setViewerReady(true);
            // After viewerReady, also clear overlays again to be safe
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
        console.error("WebViewer init failed:", err);
      });

    // cleanup
    return () => {
      try {
        if (instance) {
          const inst = instance;
          const { Core } = inst;
          const dv = resolveDocumentViewer(Core);
          const am = resolveAnnotationManager(Core, dv);
          if (
            am &&
            annotationChangeHandlerRef.current &&
            typeof am.removeEventListener === "function"
          ) {
            try {
              am.removeEventListener(
                "annotationChanged",
                annotationChangeHandlerRef.current
              );
            } catch {}
          }
          inst.UI?.closeDocument?.();
        }
      } catch (e) {
        console.warn("WebViewer cleanup failed:", e);
      } finally {
        instanceRef.current = null;
        annotationChangeHandlerRef.current = null;
        setViewerReady(false);
      }
    };
    // re-init when doc/url or effective read-only changes (prevents toolbar flash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentUrl, documentId, effectiveReadOnly, lastAssignedUserIdState]);

  // react to effectiveReadOnly toggles at runtime
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    const { UI, Core } = inst;

    const applyReadOnlyUI = async (enable: boolean) => {
      try {
        const dv = resolveDocumentViewer(Core);
        const am = resolveAnnotationManager(Core, dv);

        if (am) {
          if (typeof am.enableReadOnlyMode === "function") {
            am.enableReadOnlyMode(Boolean(enable));
          } else if (typeof am.setReadOnly === "function") {
            am.setReadOnly(Boolean(enable));
          }
        }

        if (enable) {
          UI.setReadOnlyMode?.(true);
          UI.disableElements?.([
            "toolbarGroup-Annotate",
            "toolbarGroup-Edit",
            "annotationPopup",
            "toggleNotesButton",
            "notesPanel",
            "leftPanel",
            "toolsHeader",
            "ribbons",
          ]);
          injectReadOnlyCss();
          addToast("Document switched to read-only", 2000);
        } else {
          UI.setReadOnlyMode?.(false);
          removeReadOnlyCss();

          UI.enableElements?.([
            "toolbarGroup-Annotate",
            "toolbarGroup-Edit",
            "toolbarGroup-Insert",
            "toolbarGroup-View",
            "annotationPopup",
            "toggleNotesButton",
            "notesPanel",
            "leftPanel",
            "toolsHeader",
            "ribbons",
            "header",
          ]);

          try {
            UI.setToolbarGroup?.("toolbarGroup-Annotate");
          } catch {}

          // ensure any leftover overlay is removed when switching to editable
          clearLoadingOverlays();

          addToast("Annotations enabled", 1400);
        }
        setReadOnlyApplied(enable);
      } catch (e) {
        console.warn("applyReadOnlyUI error:", e);
      }
    };

    applyReadOnlyUI(Boolean(effectiveReadOnly));
  }, [effectiveReadOnly]);

  // when parent-provided annotations change, reload them
  useEffect(() => {
    if (!viewerReady) return;
    loadExistingAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerReady, JSON.stringify(existingAnnotations || [])]);

  // auto-activate toolbar/tool when viewer ready AND effectiveReadOnly is false
  useEffect(() => {
    if (!viewerReady) return;
    if (effectiveReadOnly) return;
    const t = setTimeout(() => {
      try {
        handleToolSelect("select");
      } catch (e) {
        console.warn("auto-activate tool failed:", e);
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerReady, effectiveReadOnly]);

  // load / render annotations into viewer
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

  // ---------- Annotation lifecycle handlers ----------
  const handleAnnotationAdd = async (
    annotation: any,
    annotationManager: any
  ) => {
    if (effectiveReadOnly) {
      addToast("Document is read-only — annotations are disabled", 2500);
      return;
    }
    try {
      // optimistic UI – provisional id & header
      try {
        const provisionalId =
          annotation.Id ||
          `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        annotation.Id = provisionalId;
        annotation.Author = currentUserName;
        const userText =
          (annotation.getContents && annotation.getContents()) || "";
        const nowIso = new Date().toISOString();
        const provisionalHeader = `... Saving (optimistic) ...\n${currentUserName}\n${formatDateHuman(
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
    if (effectiveReadOnly) {
      addToast("Document is read-only — edits are disabled", 2500);
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
    if (effectiveReadOnly) {
      addToast("Document is read-only — delete disabled", 2500);
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

  // persist XFDF
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

  // detect type / serialize
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

  // toolbar handlers
  const handleToolSelect = (toolName: string) => {
    if (effectiveReadOnly) {
      addToast("Document is read-only — annotation tools disabled", 2500);
      return;
    }
    const inst = instanceRef.current;
    if (!inst || !inst.Core) return;
    const Core = inst.Core;
    const dv = resolveDocumentViewer(Core);
    if (!dv) return;

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
    if (effectiveReadOnly) {
      addToast("Document is read-only — color change disabled", 2000);
      return;
    }
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
      await persistXfdf(am);
    } catch (e) {
      console.error("handleExport error:", e);
      addToast("Failed to export document.", 6000);
    }
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r
      ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)]
      : [255, 224, 102];
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      {isAssignedUser && (
        <CustomToolbar
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          zoomLevel={zoomLevel}
          onToolSelect={handleToolSelect}
          onColorChange={handleColorChange}
          onZoom={handleZoom}
          onExport={handleExport}
          viewerReady={viewerReady}
          readOnly={effectiveReadOnly}
        />
      )}
      <div ref={viewer as any} className="flex-1 w-full" />
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
