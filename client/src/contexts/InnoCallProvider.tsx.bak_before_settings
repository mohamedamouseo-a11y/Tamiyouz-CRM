import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { Phone as PhoneIcon } from "lucide-react";
import { toast } from "sonner";

// Declare InnocallsRTC on window
declare global {
  interface Window {
    InnocallsRTC: any;
  }
  class InnocallsRTC {
    constructor(config: any);
    mount(selector: string): void;
    startCall(number: string): void;
    hangup(): void;
    fillNumber(number: string): void;
    showWebrtc(): void;
    hideWebrtc(): void;
    toggleWebrtc(): void;
    on(event: string, callback: (...args: any[]) => void): void;
  }
}

type CallStatus = "idle" | "ringing" | "active" | "ended" | "missed" | "rejected";

interface InnoCallContextType {
  isReady: boolean;
  callStatus: CallStatus;
  currentCallId: string | null;
  startCall: (number: string) => void;
  hangup: () => void;
  toggleDialpad: () => void;
  showDialpad: () => void;
  hideDialpad: () => void;
}

const InnoCallContext = createContext<InnoCallContextType>({
  isReady: false,
  callStatus: "idle",
  currentCallId: null,
  startCall: () => {},
  hangup: () => {},
  toggleDialpad: () => {},
  showDialpad: () => {},
  hideDialpad: () => {},
});

const INNOCALL_CONFIG = {
  apiKey: "ibpb9hrsf7j357g1mnt98vo6se7g7r18",
  extension: "101",
  webrtcSecret: "0.1773083939.nzwDDSRJMaGkXwEgyHK5F2if04EaQKIYGHKQcfD4ZMf9dOVFc3",
  config: {
    baseColor: "#6366f1",
  },
  terminateOnRefresh: true,
};

export function InnoCallProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const rtcRef = useRef<any>(null);
  const mountedRef = useRef(false);
  const stylesheetLoadedRef = useRef(false);

  // Load InnoCall stylesheet scoped to the dialpad container only
  useEffect(() => {
    if (stylesheetLoadedRef.current) return;
    stylesheetLoadedRef.current = true;

    // Add a scoped style that limits InnoCall CSS to only affect .innocalls-webrtc elements
    const scopeStyle = document.createElement("style");
    scopeStyle.textContent = `
      /* Load InnoCall styles only inside the dialpad container */
      #innocall-dialpad .innocalls-webrtc {
        all: initial;
      }
    `;
    // Don't add the global stylesheet - let the SDK handle its own styles
    // The SDK's webrtc.js already includes necessary inline styles
  }, []);

  // Fix the InnoCall widget positioning to not overlap with the messenger
  const fixWebrtcPosition = useCallback(() => {
    const webrtcEl = document.querySelector('.innocalls-webrtc') as HTMLElement;
    if (webrtcEl) {
      webrtcEl.style.position = 'fixed';
      webrtcEl.style.bottom = '3.5rem';
      webrtcEl.style.left = '0.5rem';
      webrtcEl.style.right = 'auto';
      webrtcEl.style.insetInlineEnd = 'auto';
      webrtcEl.style.insetInlineStart = '0.5rem';
      webrtcEl.style.zIndex = '9998';
      webrtcEl.style.transform = 'scale(0.75)';
      webrtcEl.style.transformOrigin = 'bottom left';
      webrtcEl.style.borderRadius = '16px';
      webrtcEl.style.overflow = 'hidden';
      webrtcEl.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
    }
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const initRTC = () => {
      try {
        if (typeof InnocallsRTC === "undefined") {
          console.warn("[InnoCall] SDK not loaded yet, retrying...");
          setTimeout(initRTC, 1000);
          return;
        }

        const innocallsRTC = new InnocallsRTC(INNOCALL_CONFIG);

        // Register event listeners
        innocallsRTC.on("callRinging", () => {
          console.log("[InnoCall] Call ringing");
          setCallStatus("ringing");
          fixWebrtcPosition();
        });

        innocallsRTC.on("callStarted", (callId: string) => {
          console.log("[InnoCall] Call started:", callId);
          setCallStatus("active");
          setCurrentCallId(callId);
        });

        innocallsRTC.on("callMissed", () => {
          console.log("[InnoCall] Call missed");
          setCallStatus("missed");
          setTimeout(() => setCallStatus("idle"), 3000);
        });

        innocallsRTC.on("callRejected", () => {
          console.log("[InnoCall] Call rejected");
          setCallStatus("rejected");
          setTimeout(() => setCallStatus("idle"), 3000);
        });

        innocallsRTC.on("callEnded", () => {
          console.log("[InnoCall] Call ended");
          setCallStatus("ended");
          setCurrentCallId(null);
          setTimeout(() => setCallStatus("idle"), 2000);
        });

        innocallsRTC.on("held", () => {
          console.log("[InnoCall] Call held");
        });

        innocallsRTC.on("released", () => {
          console.log("[InnoCall] Call released");
        });

        innocallsRTC.on("muted", () => {
          console.log("[InnoCall] Call muted");
        });

        innocallsRTC.on("unmuted", () => {
          console.log("[InnoCall] Call unmuted");
        });

        // Mount to the dialpad container
        innocallsRTC.mount("#innocall-dialpad");

        rtcRef.current = innocallsRTC;
        setIsReady(true);
        console.log("[InnoCall] SDK initialized successfully");

        // Fix position after mount
        setTimeout(fixWebrtcPosition, 300);
        setTimeout(fixWebrtcPosition, 1000);
        setTimeout(fixWebrtcPosition, 3000);
      } catch (err) {
        console.error("[InnoCall] Failed to initialize:", err);
        setTimeout(initRTC, 2000);
      }
    };

    // Wait a bit for the CDN script to load
    setTimeout(initRTC, 500);
  }, [fixWebrtcPosition]);

  const startCall = useCallback(
    (number: string) => {
      if (!rtcRef.current) {
        toast.error("InnoCall not ready yet");
        return;
      }
      const cleaned = number.replace(/[^\d+]/g, "");
      if (!cleaned) {
        toast.error("Invalid phone number");
        return;
      }
      console.log("[InnoCall] Starting call to:", cleaned);
      rtcRef.current.showWebrtc();
      rtcRef.current.startCall(cleaned);
      setCallStatus("ringing");
      // Fix position after showing
      setTimeout(fixWebrtcPosition, 100);
      setTimeout(fixWebrtcPosition, 500);
    },
    [fixWebrtcPosition]
  );

  const hangup = useCallback(() => {
    if (!rtcRef.current) return;
    rtcRef.current.hangup();
  }, []);

  const toggleDialpad = useCallback(() => {
    if (!rtcRef.current) return;
    rtcRef.current.toggleWebrtc();
    setTimeout(fixWebrtcPosition, 100);
  }, [fixWebrtcPosition]);

  const showDialpad = useCallback(() => {
    if (!rtcRef.current) return;
    rtcRef.current.showWebrtc();
    setTimeout(fixWebrtcPosition, 100);
  }, [fixWebrtcPosition]);

  const hideDialpad = useCallback(() => {
    if (!rtcRef.current) return;
    rtcRef.current.hideWebrtc();
  }, []);

  return (
    <InnoCallContext.Provider
      value={{
        isReady,
        callStatus,
        currentCallId,
        startCall,
        hangup,
        toggleDialpad,
        showDialpad,
        hideDialpad,
      }}
    >
      {children}
      {/* Container for InnoCall dialpad - compact floating above the button */}
      <div
        id="innocall-dialpad"
        style={{
          position: "fixed",
          bottom: "3.5rem",
          left: "0.5rem",
          right: "auto",
          zIndex: 9998,
          transform: "scale(0.7)",
          transformOrigin: "bottom left",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      />

    </InnoCallContext.Provider>
  );
}

export function useInnoCall() {
  return useContext(InnoCallContext);
}
