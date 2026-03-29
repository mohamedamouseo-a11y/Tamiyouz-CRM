import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * InnoCallProvider - Web Call Script Integration
 *
 * This provider dynamically loads the InnoCall Web Call script from the URL
 * stored in the database settings. The Web Call script handles everything
 * (dialpad UI, calling, etc.) automatically once loaded.
 *
 * No complex WebRTC setup needed - the script does it all.
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

export function InnoCallProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const scriptLoadedRef = useRef(false);
  const scriptElementRef = useRef<HTMLScriptElement | null>(null);

  // Fetch config from DB via tRPC
  const { data: configData } = trpc.innocall.getConfig.useQuery(undefined, {
    retry: 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    // Don't load if config not loaded or not enabled or no script URL
    if (!configData || !configData.enabled || !configData.scriptUrl) {
      setIsEnabled(false);
      setIsReady(false);

      // Remove existing script if it was loaded before and now disabled
      if (scriptElementRef.current) {
        scriptElementRef.current.remove();
        scriptElementRef.current = null;
        scriptLoadedRef.current = false;
        console.log("[InnoCall] Script removed (disabled or no URL)");
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
      scriptElementRef.current.remove();
      scriptElementRef.current = null;
      scriptLoadedRef.current = false;
    }

    // Dynamically load the Web Call script
    const script = document.createElement("script");
    script.type = "module";
    script.src = configData.scriptUrl;
    script.async = true;

    script.onload = () => {
      console.log("[InnoCall] Web Call script loaded successfully from:", configData.scriptUrl);
      setIsReady(true);
      scriptLoadedRef.current = true;
    };

    script.onerror = (err) => {
      console.error("[InnoCall] Failed to load Web Call script:", err);
      toast.error("Failed to load InnoCall calling widget. Please check the Script URL in settings.");
      setIsReady(false);
    };

    document.body.appendChild(script);
    scriptElementRef.current = script;

    console.log("[InnoCall] Loading Web Call script from:", configData.scriptUrl);

    // Cleanup on unmount
    return () => {
      if (scriptElementRef.current) {
        scriptElementRef.current.remove();
        scriptElementRef.current = null;
        scriptLoadedRef.current = false;
      }
    };
  }, [configData]);

  // Backward-compatible startCall - the Web Call script provides its own UI
  // but we can try to interact with it if the widget exposes an API
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

      // Try to find the Web Call widget input and fill the number
      // The Web Call script creates its own UI elements
      try {
        // Look for the InnoCall widget's phone input
        const widget = document.querySelector('.innocalls-web-call, .innocalls-webrtc, [class*="innocall"]') as HTMLElement;
        if (widget) {
          // Try to find and click the widget to open it
          widget.style.display = 'block';
          const input = widget.querySelector('input[type="tel"], input[type="text"], input') as HTMLInputElement;
          if (input) {
            input.value = cleaned;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          // Try to find and click the call button
          const callBtn = widget.querySelector('button[class*="call"], .call-button, button') as HTMLButtonElement;
          if (callBtn) {
            setTimeout(() => callBtn.click(), 300);
          }
        } else {
          // Widget not found - just copy number to clipboard for easy pasting
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

  const hangup = useCallback(() => {
    console.log("[InnoCall] Hangup requested");
  }, []);

  const toggleDialpad = useCallback(() => {
    console.log("[InnoCall] Toggle dialpad");
  }, []);

  const showDialpad = useCallback(() => {
    console.log("[InnoCall] Show dialpad");
  }, []);

  const hideDialpad = useCallback(() => {
    console.log("[InnoCall] Hide dialpad");
  }, []);

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
