import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * InnoCallProvider - On-Demand Web Call Script Integration
 *
 * The InnoCall Web Call script is NOT loaded by default.
 * It only loads when the user clicks the call button (startCall).
 * The widget appears for the call, and can be dismissed by the user.
 * When navigating away, the widget is cleaned up automatically.
 * The widget is made DRAGGABLE so the user can move it anywhere on the page.
 *
 * FEATURE: Hide/Show toggle - clicking the call button again toggles
 * the widget visibility. The widget can be hidden and brought back.
 *
 * FIX: The getConfig query is now only enabled when the user is authenticated,
 * preventing UNAUTHORIZED errors on the login page that caused infinite reloads.
 */

interface InnoCallContextType {
  isReady: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  isWidgetVisible: boolean;
  callStatus: string;
  currentCallId: string | null;
  startCall: (number: string) => void;
  hangup: () => void;
  toggleDialpad: () => void;
  showDialpad: () => void;
  hideDialpad: () => void;
  dismissWidget: () => void;
  toggleWidget: () => void;
}

const InnoCallContext = createContext<InnoCallContextType>({
  isReady: false,
  isEnabled: false,
  isLoading: false,
  isWidgetVisible: false,
  callStatus: "idle",
  currentCallId: null,
  startCall: () => {},
  hangup: () => {},
  toggleDialpad: () => {},
  showDialpad: () => {},
  hideDialpad: () => {},
  dismissWidget: () => {},
  toggleWidget: () => {},
});

const WIDGET_SELECTORS = '.innocalls-web-call, .innocalls-webrtc, [class*="innocall"], [id*="innocall"], [class*="InnoCall"], [id*="InnoCall"]';

/**
 * Makes an InnoCall widget element draggable via mouse/touch.
 */
function makeDraggable(el: HTMLElement) {
  if (el.dataset.draggable === "true") return;
  el.dataset.draggable = "true";

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  const computed = window.getComputedStyle(el);
  if (computed.position === "static") {
    el.style.position = "fixed";
  }

  const rect = el.getBoundingClientRect();
  el.style.left = rect.left + "px";
  el.style.top = rect.top + "px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.cursor = "move";
  el.style.zIndex = "999999";
  el.style.userSelect = "none";

  const onMouseDown = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    const currentRect = el.getBoundingClientRect();
    origLeft = currentRect.left;
    origTop = currentRect.top;
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    let newLeft = origLeft + dx;
    let newTop = origTop + dy;

    const elRect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - elRect.width;
    const maxTop = window.innerHeight - elRect.height;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    el.style.left = newLeft + "px";
    el.style.top = newTop + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  el.addEventListener("mousedown", onMouseDown);
  el.addEventListener("touchstart", onMouseDown, { passive: false });
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("touchmove", onMouseMove, { passive: false });
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("touchend", onMouseUp);

  (el as any).__dragCleanup = () => {
    el.removeEventListener("mousedown", onMouseDown);
    el.removeEventListener("touchstart", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("touchmove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchend", onMouseUp);
  };
}

/**
 * Observe the DOM for InnoCall widget elements and make them draggable.
 */
function observeAndMakeDraggable(): MutationObserver {
  const selectors = [
    '.innocalls-web-call',
    '.innocalls-webrtc',
    '[class*="innocall"]',
    '[id*="innocall"]',
    '[class*="InnoCall"]',
    '[id*="InnoCall"]',
  ];

  const checkExisting = () => {
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el instanceof HTMLElement) {
          makeDraggable(el);
        }
      });
    });
  };

  checkExisting();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            selectors.forEach((sel) => {
              if (node.matches?.(sel)) {
                makeDraggable(node);
              }
              node.querySelectorAll?.(sel)?.forEach((child) => {
                if (child instanceof HTMLElement) {
                  makeDraggable(child);
                }
              });
            });
          }
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

/** Hide all InnoCall widget elements */
function hideWidgetElements() {
  document.querySelectorAll<HTMLElement>(WIDGET_SELECTORS).forEach((el) => {
    el.style.display = "none";
  });
  console.log("[InnoCall] Widget hidden");
}

/** Show all InnoCall widget elements */
function showWidgetElements() {
  document.querySelectorAll<HTMLElement>(WIDGET_SELECTORS).forEach((el) => {
    el.style.display = "";
  });
  console.log("[InnoCall] Widget shown");
}

export function InnoCallProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);
  const scriptLoadedRef = useRef(false);
  const scriptElementRef = useRef<HTMLScriptElement | null>(null);
  const pendingNumberRef = useRef<string | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  const { data: configData } = trpc.innocall.getConfig.useQuery(undefined, {
    retry: 2,
    staleTime: 60_000,
    enabled: isAuthenticated,
  });

  const isEnabled = configData?.enabled ?? false;

  /** Toggle widget visibility (hide/show) */
  const toggleWidget = useCallback(() => {
    if (isWidgetVisible) {
      hideWidgetElements();
      setIsWidgetVisible(false);
    } else {
      showWidgetElements();
      setIsWidgetVisible(true);
    }
  }, [isWidgetVisible]);

  /** Completely remove the widget and script */
  const removeWidget = useCallback(() => {
    const widgets = document.querySelectorAll(WIDGET_SELECTORS);
    widgets.forEach((el) => {
      if ((el as any).__dragCleanup) {
        (el as any).__dragCleanup();
      }
      el.remove();
    });

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (scriptElementRef.current) {
      scriptElementRef.current.remove();
      scriptElementRef.current = null;
      scriptLoadedRef.current = false;
    }

    setIsReady(false);
    setIsLoading(false);
    setIsWidgetVisible(false);
    pendingNumberRef.current = null;
    console.log("[InnoCall] Widget dismissed and script removed");
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const loadScript = useCallback(
    (phoneNumber: string) => {
      if (!configData?.scriptUrl) {
        toast.error("InnoCall script URL not configured");
        return;
      }

      if (scriptLoadedRef.current) {
        setIsReady(true);
        // Widget already loaded - show it
        showWidgetElements();
        setIsWidgetVisible(true);
        return;
      }

      setIsLoading(true);
      pendingNumberRef.current = phoneNumber;

      const script = document.createElement("script");
      script.type = "module";
      script.src = configData.scriptUrl;
      script.async = true;

      script.onload = () => {
        console.log("[InnoCall] Web Call script loaded on demand");
        setIsReady(true);
        setIsLoading(false);
        setIsWidgetVisible(true);
        scriptLoadedRef.current = true;

        if (!observerRef.current) {
          observerRef.current = observeAndMakeDraggable();
        }

        toast.success("InnoCall widget loaded - you can drag it anywhere on the page!");
      };

      script.onerror = (err) => {
        console.error("[InnoCall] Failed to load Web Call script:", err);
        toast.error("Failed to load InnoCall calling widget.");
        setIsReady(false);
        setIsLoading(false);
        setIsWidgetVisible(false);
        pendingNumberRef.current = null;
      };

      document.body.appendChild(script);
      scriptElementRef.current = script;
    },
    [configData]
  );

  /**
   * startCall: 
   * - First click: loads the script and shows the widget
   * - Subsequent clicks: toggles widget visibility (hide/show)
   * - Always copies the phone number to clipboard
   */
  const startCall = useCallback(
    (number: string) => {
      if (!isEnabled) {
        toast.error("InnoCall is not enabled");
        return;
      }

      const cleaned = number.replace(/[^\d+]/g, "");
      if (!cleaned) {
        toast.error("Invalid phone number");
        return;
      }

      // Always copy number to clipboard
      navigator.clipboard.writeText(cleaned).catch(() => {});

      if (!scriptLoadedRef.current) {
        // First time - load the script
        toast.info(`Loading InnoCall... Number ${cleaned} copied to clipboard.`);
        loadScript(cleaned);
      } else if (!isWidgetVisible) {
        // Widget is hidden - show it
        showWidgetElements();
        setIsWidgetVisible(true);
        toast.info(`Number ${cleaned} copied to clipboard. Widget is now visible.`);
        if (!observerRef.current) {
          observerRef.current = observeAndMakeDraggable();
        }
      } else {
        // Widget is visible - hide it
        hideWidgetElements();
        setIsWidgetVisible(false);
        toast.info(`Widget hidden. Number ${cleaned} copied to clipboard. Click call again to show.`);
      }
    },
    [isEnabled, isWidgetVisible, loadScript]
  );

  const hangup = useCallback(() => {}, []);
  const toggleDialpad = useCallback(() => {}, []);
  const showDialpad = useCallback(() => {}, []);
  const hideDialpad = useCallback(() => {}, []);

  return (
    <InnoCallContext.Provider
      value={{
        isReady,
        isEnabled,
        isLoading,
        isWidgetVisible,
        callStatus: "idle",
        currentCallId: null,
        startCall,
        hangup,
        toggleDialpad,
        showDialpad,
        hideDialpad,
        dismissWidget: removeWidget,
        toggleWidget,
      }}
    >
      {children}
    </InnoCallContext.Provider>
  );
}

export function useInnoCall() {
  return useContext(InnoCallContext);
}
