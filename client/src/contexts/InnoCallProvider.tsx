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
 * FIX: The getConfig query is now only enabled when the user is authenticated,
 * preventing UNAUTHORIZED errors on the login page that caused infinite reloads.
 */

interface InnoCallContextType {
  isReady: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  callStatus: string;
  currentCallId: string | null;
  startCall: (number: string) => void;
  hangup: () => void;
  toggleDialpad: () => void;
  showDialpad: () => void;
  hideDialpad: () => void;
  dismissWidget: () => void;
}

const InnoCallContext = createContext<InnoCallContextType>({
  isReady: false,
  isEnabled: false,
  isLoading: false,
  callStatus: "idle",
  currentCallId: null,
  startCall: () => {},
  hangup: () => {},
  toggleDialpad: () => {},
  showDialpad: () => {},
  hideDialpad: () => {},
  dismissWidget: () => {},
});

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

export function InnoCallProvider({ children }: { children: ReactNode }) {
  // FIX: Get auth state so we only query config when authenticated
  const { isAuthenticated } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scriptLoadedRef = useRef(false);
  const scriptElementRef = useRef<HTMLScriptElement | null>(null);
  const pendingNumberRef = useRef<string | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // FIX: Only fetch config when the user is authenticated.
  // This prevents UNAUTHORIZED errors on the login page that caused infinite reloads.
  const { data: configData } = trpc.innocall.getConfig.useQuery(undefined, {
    retry: 2,
    staleTime: 60_000,
    enabled: isAuthenticated,
  });

  const isEnabled = configData?.enabled ?? false;

  const removeWidget = useCallback(() => {
    const widgets = document.querySelectorAll(
      '.innocalls-web-call, .innocalls-webrtc, [class*="innocall"], [id*="innocall"]'
    );
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
        pendingNumberRef.current = null;
      };

      document.body.appendChild(script);
      scriptElementRef.current = script;
    },
    [configData]
  );

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

      navigator.clipboard.writeText(cleaned).catch(() => {});

      if (!scriptLoadedRef.current) {
        toast.info(`Loading InnoCall... Number ${cleaned} copied to clipboard.`);
        loadScript(cleaned);
      } else {
        toast.info(`Number ${cleaned} copied to clipboard. Use the InnoCall widget to call.`);
        if (!observerRef.current) {
          observerRef.current = observeAndMakeDraggable();
        }
      }
    },
    [isEnabled, loadScript]
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
        callStatus: "idle",
        currentCallId: null,
        startCall,
        hangup,
        toggleDialpad,
        showDialpad,
        hideDialpad,
        dismissWidget: removeWidget,
      }}
    >
      {children}
    </InnoCallContext.Provider>
  );
}

export function useInnoCall() {
  return useContext(InnoCallContext);
}
