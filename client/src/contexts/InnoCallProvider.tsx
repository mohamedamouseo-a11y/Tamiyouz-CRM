import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * InnoCallProvider - Web Call Script Integration
 *
 * This provider dynamically loads the InnoCall Web Call script from the URL
 * stored in the database settings. The script is ONLY loaded on lead/client
 * profile pages (/leads/:id and /clients/:id) to avoid covering the
 * Rakan AI assistant widget on other pages.
 */

interface InnoCallContextType {
  isReady: boolean;
  isEnabled: boolean;
  callStatus: string;
  currentCallId: string | null;
  startCall: (number: string) => void;
  hangup: () => void;
  toggleDialpad: () => void;
  showDialpad: () => void;
  hideDialpad: () => void;
}

const InnoCallContext = createContext<InnoCallContextType>({
  isReady: false,
  isEnabled: false,
  callStatus: "idle",
  currentCallId: null,
  startCall: () => {},
  hangup: () => {},
  toggleDialpad: () => {},
  showDialpad: () => {},
  hideDialpad: () => {},
});

/** Check if the current URL is a lead or client profile page */
function isProfilePage(): boolean {
  const path = window.location.pathname;
  // Match /leads/:id or /clients/:id (where :id is a number)
  return /^\/(leads|clients)\/\d+/.test(path);
}

export function InnoCallProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const scriptLoadedRef = useRef(false);
  const scriptElementRef = useRef<HTMLScriptElement | null>(null);

  // Fetch config from DB via tRPC
  const { data: configData } = trpc.innocall.getConfig.useQuery(undefined, {
    retry: 2,
    staleTime: 60_000,
  });

  // Listen for route changes
  useEffect(() => {
    const checkPath = () => {
      const newPath = window.location.pathname;
      if (newPath !== currentPath) {
        setCurrentPath(newPath);
      }
    };

    // Check on popstate (back/forward navigation)
    window.addEventListener("popstate", checkPath);

    // Also poll for route changes (wouter doesn't always fire popstate)
    const interval = setInterval(checkPath, 500);

    return () => {
      window.removeEventListener("popstate", checkPath);
      clearInterval(interval);
    };
  }, [currentPath]);

  // Helper to remove the script and any widget elements
  const removeScript = useCallback(() => {
    if (scriptElementRef.current) {
      scriptElementRef.current.remove();
      scriptElementRef.current = null;
      scriptLoadedRef.current = false;
      console.log("[InnoCall] Script removed");
    }
    // Also remove any InnoCall widget elements that the script created
    const widgets = document.querySelectorAll(
      '.innocalls-web-call, .innocalls-webrtc, [class*="innocall"], [id*="innocall"]'
    );
    widgets.forEach((el) => el.remove());
    setIsReady(false);
  }, []);

  useEffect(() => {
    const onProfilePage = isProfilePage();

    // If not on a profile page, remove the script if loaded
    if (!onProfilePage) {
      if (scriptLoadedRef.current) {
        removeScript();
      }
      setIsEnabled(configData?.enabled ?? false);
      return;
    }

    // On a profile page - check if we should load the script
    if (!configData || !configData.enabled || !configData.scriptUrl) {
      setIsEnabled(false);
      setIsReady(false);
      if (scriptLoadedRef.current) {
        removeScript();
      }
      return;
    }

    setIsEnabled(true);

    // Don't reload if already loaded with the same URL
    if (scriptLoadedRef.current && scriptElementRef.current) {
      const currentSrc = scriptElementRef.current.getAttribute("src");
      if (currentSrc === configData.scriptUrl) {
        return;
      }
      // URL changed - remove old script
      removeScript();
    }

    // Dynamically load the Web Call script
    const script = document.createElement("script");
    script.type = "module";
    script.src = configData.scriptUrl;
    script.async = true;

    script.onload = () => {
      console.log("[InnoCall] Web Call script loaded on profile page:", currentPath);
      setIsReady(true);
      scriptLoadedRef.current = true;
    };

    script.onerror = (err) => {
      console.error("[InnoCall] Failed to load Web Call script:", err);
      toast.error("Failed to load InnoCall calling widget.");
      setIsReady(false);
    };

    document.body.appendChild(script);
    scriptElementRef.current = script;

    console.log("[InnoCall] Loading Web Call script for profile page:", currentPath);
  }, [configData, currentPath, removeScript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeScript();
    };
  }, [removeScript]);

  // Backward-compatible startCall
  const startCall = useCallback(
    (number: string) => {
      if (!isReady) {
        toast.error("InnoCall not ready yet");
        return;
      }
      const cleaned = number.replace(/[^\d+]/g, "");
      if (!cleaned) {
        toast.error("Invalid phone number");
        return;
      }
      console.log("[InnoCall] Call requested to:", cleaned);

      try {
        const widget = document.querySelector('.innocalls-web-call, .innocalls-webrtc, [class*="innocall"]') as HTMLElement;
        if (widget) {
          widget.style.display = "block";
          const input = widget.querySelector('input[type="tel"], input[type="text"], input') as HTMLInputElement;
          if (input) {
            input.value = cleaned;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
          const callBtn = widget.querySelector('button[class*="call"], .call-button, button') as HTMLButtonElement;
          if (callBtn) {
            setTimeout(() => callBtn.click(), 300);
          }
        } else {
          navigator.clipboard.writeText(cleaned).then(() => {
            toast.info(`Phone number ${cleaned} copied. Use the InnoCall widget to make the call.`);
          }).catch(() => {
            toast.info(`Use the InnoCall widget to call: ${cleaned}`);
          });
        }
      } catch (err) {
        console.warn("[InnoCall] Could not auto-dial:", err);
        toast.info(`Use the InnoCall widget to call: ${number}`);
      }
    },
    [isReady]
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
        callStatus: "idle",
        currentCallId: null,
        startCall,
        hangup,
        toggleDialpad,
        showDialpad,
        hideDialpad,
      }}
    >
      {children}
    </InnoCallContext.Provider>
  );
}

export function useInnoCall() {
  return useContext(InnoCallContext);
}
