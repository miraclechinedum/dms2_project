"use client";

import { useEffect, useRef, useState } from "react";
import WebViewer from "@pdftron/webviewer";

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
  const [viewerReady, setViewerReady] = useState(false);
  const [initialized, setInitialized] = useState(false);

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

  // --- IMPROVED: helper to inject/remove our readonly CSS ---
  const injectReadOnlyCss = () => {
    const id = "wv-readonly-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.innerHTML = `
      /* hide ALL toolbar elements when readOnly */
      .Header, .ToolsHeader, .ribbons, .MenuOverlay, .LeftPanel, .NotesPanel {
        display: none;
      }
      /* Ensure the document area takes full height when toolbar is hidden */
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

    // CRITICAL FIX: Force show elements immediately
    const forceShow = () => {
      const selectors = [
        ".Header",
        ".ToolsHeader",
        ".ribbons",
        ".LeftPanel",
        ".NotesPanel",
      ];
      selectors.forEach((sel) => {
        const els = document.querySelectorAll<HTMLElement>(sel);
        els.forEach((e) => {
          e.style.removeProperty("display");
          e.style.display = "";
          e.style.visibility = "visible";
        });
      });

      // Specifically force ribbons to show (most important for annotation toolbar)
      const ribbons = document.querySelectorAll<HTMLElement>(".ribbons");
      ribbons.forEach((r) => {
        r.style.removeProperty("display");
        r.style.display = "flex"; // Use flex as WebViewer typically uses flexbox
        r.style.visibility = "visible";
        r.style.opacity = "1";
      });
    };

    // Run immediately
    forceShow();

    // Run again after short delay to catch any late-rendered elements
    setTimeout(forceShow, 100);
    setTimeout(forceShow, 300);
  };

  // ---------- IMPROVED: Clear leftover loading overlays --------------
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

      for (const sel of selectors) {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach((n) => {
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

  // --- IMPROVED: init WebViewer with better toolbar handling ---
  useEffect(() => {
    if (!viewer.current || initialized) return;

    console.info("WebViewer init - documentUrl:", documentUrl);

    console.info("WebViewer debug:", {
      currentUserId,
      lastAssignedUserIdProp,
      lastAssignedUserIdState,
      isAssignedUser,
      readOnlyProp: readOnly,
      effectiveReadOnly,
    });

    let instance: any = null;

    const readOnlyDisableList = [
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
    ];

    const editableDisableList: string[] = [];

    if (effectiveReadOnly) injectReadOnlyCss();

    WebViewer(
      {
        path: "/webviewer",
        initialDoc: documentUrl,
        licenseKey:
          "demo:1757509875851:604eca4e0300000000877d781419f71633c68ea80c20ad3325f5806b42",
        disabledElements: effectiveReadOnly
          ? readOnlyDisableList
          : editableDisableList,
        enableAnnotationTools: !effectiveReadOnly,
        enableFilePicker: false,
        enableMeasurement: !effectiveReadOnly,
        enableRedaction: !effectiveReadOnly,
      },
      viewer.current
    )
      .then((webViewerInstance) => {
        instance = webViewerInstance;
        instanceRef.current = instance;
        const { UI, Core } = instance;

        // IMPROVED: Better toolbar enablement for assigned users
        if (!effectiveReadOnly) {
          try {
            removeReadOnlyCss();

            const allElements = [
              "header",
              "toolsHeader",
              "ribbons",
              "toolbarGroup-Annotate",
              "toolbarGroup-Edit",
              "toolbarGroup-Insert",
              "toolbarGroup-View",
              "toolbarGroup-Share",
              "toolbarGroup-Forms",
              "toolbarGroup-FillAndSign",
              "toolbarGroup-Measure",
              "leftPanel",
              "notesPanel",
              "searchButton",
              "menuButton",
              "toggleNotesButton",
              "annotationPopup",
              "stylePopup",
            ];

            UI.enableElements(allElements);

            // CRITICAL FIX: Use openElements to force visibility
            if (typeof UI.openElements === "function") {
              UI.openElements(["ribbons", "toolsHeader"]);
            }

            UI.setToolbarGroup("toolbarGroup-Annotate");

            const dv = resolveDocumentViewer(Core);
            const am = resolveAnnotationManager(Core, dv);
            if (am) {
              if (typeof am.enableReadOnlyMode === "function") {
                am.enableReadOnlyMode(false);
              } else if (typeof am.setReadOnly === "function") {
                am.setReadOnly(false);
              }
            }

            UI.setReadOnlyMode(false);

            // CRITICAL FIX: Force ribbons to show with DOM manipulation
            setTimeout(() => {
              const ribbons =
                document.querySelectorAll<HTMLElement>(".ribbons");
              ribbons.forEach((r) => {
                r.style.display = "flex";
                r.style.visibility = "visible";
                r.style.opacity = "1";
              });
            }, 300);

            console.log("✅ Full annotation toolbar enabled for assigned user");
          } catch (e) {
            console.error("Failed to enable full toolbar:", e);
          }
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
                addToast("Document opened in read-only mode", 2200);
              } catch (e) {
                console.warn("Failed to apply readOnly on load:", e);
              }
            } else {
              try {
                if (!effectiveReadOnly) {
                  removeReadOnlyCss();
                  UI.setReadOnlyMode(false);

                  const allElements = [
                    "header",
                    "toolsHeader",
                    "ribbons",
                    "toolbarGroup-Annotate",
                    "toolbarGroup-Edit",
                    "toolbarGroup-Insert",
                    "toolbarGroup-View",
                    "toolbarGroup-Share",
                    "toggleNotesButton",
                    "notesPanel",
                    "leftPanel",
                    "annotationPopup",
                  ];

                  UI.enableElements(allElements);

                  // CRITICAL FIX: Use openElements API
                  if (typeof UI.openElements === "function") {
                    UI.openElements(["ribbons", "toolsHeader", "header"]);
                  }

                  UI.setToolbarGroup("toolbarGroup-Annotate");

                  // IMPROVED: Better tool mode setting
                  if (dv && dv.setToolMode && Core?.Tools?.ToolNames) {
                    setTimeout(() => {
                      try {
                        dv.setToolMode(Core.Tools.ToolNames.EDIT);
                      } catch (e) {
                        console.warn("Failed to set tool mode:", e);
                      }
                    }, 200);
                  }

                  // CRITICAL FIX: Multiple attempts to show ribbons
                  const forceShowRibbons = () => {
                    const ribbons =
                      document.querySelectorAll<HTMLElement>(".ribbons");
                    ribbons.forEach((r) => {
                      r.style.display = "flex";
                      r.style.visibility = "visible";
                      r.style.opacity = "1";
                    });

                    const toolsHeader =
                      document.querySelectorAll<HTMLElement>(".ToolsHeader");
                    toolsHeader.forEach((t) => {
                      t.style.display = "block";
                      t.style.visibility = "visible";
                    });
                  };

                  forceShowRibbons();
                  setTimeout(forceShowRibbons, 100);
                  setTimeout(forceShowRibbons, 300);
                  setTimeout(forceShowRibbons, 500);

                  addToast("Full annotation tools enabled", 1200);
                }
              } catch (e) {
                console.warn("Failed to enable annotation tools:", e);
              }
            }

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
        console.error("WebViewer init failed:", err);
      });

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
        setInitialized(false);
      }
    };
  }, [documentUrl, documentId]);

  // IMPROVED: react to effectiveReadOnly toggles at runtime
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst || !initialized) return;
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
            "toolsHeader",
            "ribbons",
            "toolbarGroup-Annotate",
            "toolbarGroup-Edit",
            "toolbarGroup-Insert",
            "toolbarGroup-View",
            "toolbarGroup-Share",
            "annotationPopup",
            "toggleNotesButton",
            "notesPanel",
            "leftPanel",
          ]);
          injectReadOnlyCss();
          addToast("Document switched to read-only", 2000);
        } else {
          UI.setReadOnlyMode?.(false);
          removeReadOnlyCss();

          const allElements = [
            "header",
            "toolsHeader",
            "ribbons",
            "toolbarGroup-Annotate",
            "toolbarGroup-Edit",
            "toolbarGroup-Insert",
            "toolbarGroup-View",
            "toolbarGroup-Share",
            "toolbarGroup-Forms",
            "toolbarGroup-FillAndSign",
            "toolbarGroup-Measure",
            "annotationPopup",
            "toggleNotesButton",
            "notesPanel",
            "leftPanel",
          ];

          UI.enableElements?.(allElements);

          // CRITICAL FIX: Use openElements API
          if (typeof UI.openElements === "function") {
            UI.openElements(["ribbons", "toolsHeader", "header"]);
          }

          try {
            UI.setToolbarGroup?.("toolbarGroup-Annotate");

            if (dv && dv.setToolMode && Core?.Tools?.ToolNames) {
              setTimeout(() => {
                try {
                  dv.setToolMode(Core.Tools.ToolNames.EDIT);
                } catch (e) {
                  console.warn("Failed to set tool mode:", e);
                }
              }, 200);
            }
          } catch {}

          // CRITICAL FIX: Force ribbons visible multiple times
          const forceShowRibbons = () => {
            const ribbons = document.querySelectorAll<HTMLElement>(".ribbons");
            ribbons.forEach((r) => {
              r.style.removeProperty("display");
              r.style.display = "flex";
              r.style.visibility = "visible";
              r.style.opacity = "1";
            });
          };

          forceShowRibbons();
          setTimeout(forceShowRibbons, 100);
          setTimeout(forceShowRibbons, 300);
          setTimeout(forceShowRibbons, 500);

          clearLoadingOverlays();

          addToast("Full annotation tools enabled", 1400);
        }
      } catch (e) {
        console.warn("applyReadOnlyUI error:", e);
      }
    };

    applyReadOnlyUI(Boolean(effectiveReadOnly));
  }, [effectiveReadOnly, initialized]);

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
    if (effectiveReadOnly) {
      addToast("Document is read-only — annotations are disabled", 2500);
      return;
    }
    try {
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
    <div className="w-full h-full flex flex-col relative">
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
