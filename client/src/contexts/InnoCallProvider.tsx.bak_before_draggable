import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * InnoCallProvider - On-Demand Web Call Script Integration
 *
 * The InnoCall Web Call script is NOT loaded by default.
 * It only loads when the user clicks the call button (startCall).
 * The widget appears for the call, and can be dismissed by the user.
 * When navigating away, the widget is cleaned up automatically.
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

export function InnoCallProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scriptLoadedRef = useRef(false);
  const scriptElementRef = useRef<HTMLScriptElement | null>(null);
  const pendingNumberRef = useRef<string | null>(null);

  // Fetch config from DB via tRPC
  const { data: configData } = trpc.innocall.getConfig.useQuery(undefined, {
    retry: 2,
    staleTime: 60_000,
  });

  const isEnabled = configData?.enabled ?? false;

  // Helper to remove the script and any widget elements
  const removeWidget = useCallback(() => {
    // Remove any InnoCall widget elements that the script created
    const widgets = document.querySelectorAll(
      '.innocalls-web-call, .innocalls-webrtc, [class*="innocall"], [id*="innocall"]'
    );
    widgets.forEach((el) => el.remove());

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

  // Load the script on demand
  const loadScript = useCallback(
    (phoneNumber: string) => {
      if (!configData?.scriptUrl) {
        toast.error("InnoCall script URL not configured");
        return;
      }

      // If already loaded, just show the widget
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
        toast.success("InnoCall widget loaded - use it to make your call!");
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

  // startCall: loads the script on first click, shows widget
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

      // Copy number to clipboard for easy pasting into the widget
      navigator.clipboard.writeText(cleaned).catch(() => {});

      if (!scriptLoadedRef.current) {
        // First time - load the script
        toast.info(`Loading InnoCall... Number ${cleaned} copied to clipboard.`);
        loadScript(cleaned);
      } else {
        // Script already loaded - widget should be visible
        toast.info(`Number ${cleaned} copied to clipboard. Use the InnoCall widget to call.`);
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
