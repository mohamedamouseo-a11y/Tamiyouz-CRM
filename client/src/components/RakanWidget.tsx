import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bot,
  Send,
  X,
  Trash2,
  Volume2,
  VolumeX,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioBase64?: string | null;
  mode?: "smart" | "normal";
  timestamp: Date;
}

// ─── Markdown-like renderer ────────────────────────────────────────────────────
function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return <p key={i} className="flex gap-1"><span>•</span><span>{line.slice(2)}</span></p>;
    }
    if (line.trim() === "") return <br key={i} />;
    // Bold inline **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

// ─── Speech Recognition Hook ──────────────────────────────────────────────────
function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "ar-SA"; // Default Arabic, will also pick up English
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t;
          } else {
            interimTranscript += t;
          }
        }
        setTranscript(finalTranscript || interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("[Speech] Error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, transcript, isSupported, startListening, stopListening };
}

// ─── Main Widget ───────────────────────────────────────────────────────────────
export default function RakanWidget() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isRTL = lang === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    try { return localStorage.getItem("rakan-dismissed") === "true"; } catch { return false; }
  });
  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    setIsDismissed(true);
    try { localStorage.setItem("rakan-dismissed", "true"); } catch {}
  }, []);
  const handleShow = useCallback(() => {
    setIsDismissed(false);
    try { localStorage.removeItem("rakan-dismissed"); } catch {}
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsVoice, setTtsVoice] = useState<"ar_formal" | "ar_egyptian" | "ar_gulf" | "en" | "none">("ar_formal");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Speech Recognition ────────────────────────────────────────────────────
  const { isListening, transcript, isSupported, startListening, stopListening } = useSpeechRecognition();

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Auto-send when speech recognition ends with a transcript
  useEffect(() => {
    if (!isListening && transcript && transcript.trim().length > 0) {
      // Small delay to ensure the input is set
      setTimeout(() => {
        const text = transcript.trim();
        if (text && !isSending) {
          const userMsg: ChatMessage = {
            id: `u-${Date.now()}`,
            role: "user",
            content: text,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, userMsg]);
          setInput("");
          setIsSending(true);

          chatMutation.mutate({
            message: text,
            ttsVoice: ttsEnabled ? ttsVoice : "none",
          });

          setTimeout(scrollToBottom, 50);
        }
      }, 300);
    }
  }, [isListening]);

  // ── Load history on open ───────────────────────────────────────────────────
  const { data: historyData, refetch: refetchHistory } = trpc.rakan.getHistory.useQuery(
    { limit: 30 },
    { enabled: isOpen, refetchOnWindowFocus: false }
  );

  // ── Load user preferences ──────────────────────────────────────────────────
  const { data: prefs } = trpc.rakan.getMyPreferences.useQuery(undefined, {
    enabled: isOpen,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (prefs) {
      setTtsEnabled(prefs.ttsEnabled === "true");
      setTtsVoice(prefs.ttsVoicePreference as any || "ar_formal");
    }
  }, [prefs]);

  useEffect(() => {
    if (historyData && messages.length === 0) {
      const loaded: ChatMessage[] = historyData.map((h: any) => ({
        id: String(h.id),
        role: h.role,
        content: h.content,
        audioBase64: h.audioUrl,
        timestamp: new Date(h.createdAt),
      }));
      setMessages(loaded);
    }
  }, [historyData]);

  // ── Auto scroll ────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen, messages.length]);

  // ── Chat mutation ──────────────────────────────────────────────────────────
  const chatMutation = trpc.rakan.chat.useMutation({
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        audioBase64: data.audioBase64,
        mode: (data as any).mode,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsSending(false);

      // Auto-play audio if enabled
      if (ttsEnabled) {
        if (data.audioBase64) {
          playAudio(assistantMsg.id, data.audioBase64);
        } else {
          // Fallback to browser TTS when no audio from server
          speakWithBrowser(data.reply, assistantMsg.id);
        }
      }

      setTimeout(scrollToBottom, 100);
    },
    onError: (err) => {
      setIsSending(false);
      toast.error(err.message || "حدث خطأ في التواصل مع راكان");
    },
  });

  // ── Clear history mutation ─────────────────────────────────────────────────
  const clearMutation = trpc.rakan.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([]);
      toast.success(isRTL ? "تم مسح المحادثة" : "Chat cleared");
    },
  });

  // ── Update user preference mutation ───────────────────────────────────────
  const updatePrefMutation = trpc.rakan.updateUserSetting.useMutation();

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    chatMutation.mutate({
      message: text,
      ttsVoice: ttsEnabled ? ttsVoice : "none",
    });

    setTimeout(scrollToBottom, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  //  // ── Browser TTS (Web Speech API) fallback ──────────────────────────────
  const speakWithBrowser = useCallback((text: string, id: string) => {
    if (!('speechSynthesis' in window)) return;
    // Stop any current speech
    window.speechSynthesis.cancel();
    // Clean text - remove markdown, emojis, special chars
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/[•\-📊👥📢⚡🔥☀️👎✨🚀🎤💡📈📉💰🏆⚠️]/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    // Set voice based on ttsVoice preference
    const voiceLangMap: Record<string, string> = {
      ar_formal: 'ar-SA',
      ar_egyptian: 'ar-EG', 
      ar_gulf: 'ar-SA',
      en: 'en-US',
    };
    utterance.lang = voiceLangMap[ttsVoice] || 'ar-SA';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Try to find a matching voice
    const voices = window.speechSynthesis.getVoices();
    const targetLang = utterance.lang;
    const matchingVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
    if (matchingVoice) utterance.voice = matchingVoice;

    setPlayingId(id);
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
  }, [ttsVoice]);

  // ── Audio playback ─────────────────────────────────────────────────────
  const playAudio = (id: string, base64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(base64);
    audioRef.current = audio;
    setPlayingId(id);
    audio.play().catch(() => {
      // If audio play fails, fallback to browser TTS
      const msg = messages.find(m => m.id === id);
      if (msg) speakWithBrowser(msg.content, id);
    });
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      // Fallback to browser TTS on error
      const msg = messages.find(m => m.id === id);
      if (msg) speakWithBrowser(msg.content, id);
      else setPlayingId(null);
    };
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Also stop browser TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingId(null);
  };

  // ── Toggle TTS ─────────────────────────────────────────────────────────────
  const toggleTts = () => {
    const newVal = !ttsEnabled;
    setTtsEnabled(newVal);
    updatePrefMutation.mutate({ key: "tts_enabled", value: String(newVal) });
    if (!newVal) stopAudio();
  };

  // ── Voice selector ─────────────────────────────────────────────────────────
  const handleVoiceChange = (v: typeof ttsVoice) => {
    setTtsVoice(v);
    updatePrefMutation.mutate({ key: "tts_voice_preference", value: v });
  };

  if (!user) return null;

  const rakanName = "راكان";

  if (isDismissed) {
    return (
      <div className={cn("fixed z-50", isRTL ? "left-6" : "right-6")} style={{ bottom: "24px" }}>
        <button
          onClick={handleShow}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all hover:scale-110"
          title={isRTL ? "إظهار المساعد" : "Show Assistant"}
        >
          <Bot size={18} />
        </button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("fixed z-50", isRTL ? "left-6" : "right-6")} style={{ bottom: "96px" }}>
        {/* ── Chat Window ──────────────────────────────────────────────────── */}
        {isOpen && (
          <div
            className={cn(
              "fixed w-[380px] max-w-[calc(100vw-2rem)]",
              "bg-background border border-border rounded-2xl shadow-2xl",
              "flex flex-col overflow-hidden",
              "animate-in slide-in-from-bottom-4 fade-in duration-200",
              isRTL ? "left-6" : "right-6"
            )}
            style={{
              bottom: "156px",
              height: "min(520px, calc(100vh - 180px))",
              maxHeight: "calc(100vh - 180px)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-border"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, #7c3aed) 100%)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{rakanName}</p>
                  <p className="text-white/70 text-xs">
                    {isRTL ? "مساعدك الذكي" : "Your AI Assistant"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Voice toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                      onClick={toggleTts}
                    >
                      {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {ttsEnabled ? (isRTL ? "إيقاف الصوت" : "Mute") : (isRTL ? "تفعيل الصوت" : "Unmute")}
                  </TooltipContent>
                </Tooltip>

                {/* Clear history */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                      onClick={() => clearMutation.mutate()}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isRTL ? "مسح المحادثة" : "Clear chat"}</TooltipContent>
                </Tooltip>

                {/* Close */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            {/* Voice selector bar */}
            {ttsEnabled && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/40 border-b border-border text-xs overflow-x-auto">
                <span className="text-muted-foreground shrink-0">{isRTL ? "الصوت:" : "Voice:"}</span>
                {(["ar_formal", "ar_egyptian", "ar_gulf", "en"] as const).map((v) => {
                  const labels: Record<string, string> = {
                    ar_formal: isRTL ? "فصيح" : "Formal AR",
                    ar_egyptian: isRTL ? "مصري" : "Egyptian",
                    ar_gulf: isRTL ? "خليجي" : "Gulf",
                    en: "EN",
                  };
                  return (
                    <button
                      key={v}
                      onClick={() => handleVoiceChange(v)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs transition-colors shrink-0",
                        ttsVoice === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {labels[v]}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles size={24} className="text-primary" />
                  </div>
                  <p className="font-semibold text-sm">
                    {isRTL ? `مرحباً! أنا ${rakanName}` : `Hi! I'm ${rakanName}`}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {isRTL
                      ? "اسألني عن أي شيء في النظام - الليدز، الصفقات، الأداء، العملاء... أو اضغط على المايك وتكلم 🎤"
                      : "Ask me anything about the system - leads, deals, performance, clients... or press the mic and talk 🎤"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                    {(isRTL
                      ? ["كم ليد عندي اليوم؟", "من أفضل سيلز؟", "كم صفقة اتكسبت؟"]
                      : ["How many leads today?", "Show my performance", "Any SLA breaches?"]
                    ).map((q) => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); inputRef.current?.focus(); }}
                        className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar */}
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={13} className="text-primary" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    )}
                  >
                    <div className="space-y-0.5">
                      {renderContent(msg.content)}
                    </div>

                    {/* Mode indicator for assistant messages */}
                    {msg.role === "assistant" && msg.mode && (
                      <div className={cn(
                        "mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
                        msg.mode === "smart"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {msg.mode === "smart" ? (
                          <><Sparkles size={8} /> {isRTL ? "ذكي" : "Smart"}</>
                        ) : (
                          <>{isRTL ? "⚡ عادي" : "⚡ Normal"}</>
                        )}
                      </div>
                    )}

                    {/* Audio button for assistant messages */}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() =>
                          playingId === msg.id
                            ? stopAudio()
                            : msg.audioBase64
                              ? playAudio(msg.id, msg.audioBase64)
                              : speakWithBrowser(msg.content, msg.id)
                        }
                        className={cn(
                          "mt-1.5 flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity",
                          playingId === msg.id && "opacity-100 text-primary"
                        )}
                      >
                        {playingId === msg.id ? (
                          <><VolumeX size={11} /> {isRTL ? "إيقاف" : "Stop"}</>
                        ) : (
                          <><Volume2 size={11} /> {isRTL ? "استمع" : "Listen"}</>
                        )}
                      </button>
                    )}

                    <p className="text-[10px] opacity-40 mt-1">
                      {msg.timestamp.toLocaleTimeString(isRTL ? "ar-EG" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isSending && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles size={13} className="text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Listening indicator */}
            {isListening && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {isRTL ? "بسمعك... اتكلم" : "Listening... speak now"}
                </span>
                {transcript && (
                  <span className="text-xs text-muted-foreground truncate flex-1">{transcript}</span>
                )}
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-border bg-background">
              <div className="flex gap-2 items-end">
                {/* Mic button */}
                {isSupported && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant={isListening ? "destructive" : "outline"}
                        className={cn(
                          "h-10 w-10 rounded-xl shrink-0 transition-all",
                          isListening && "animate-pulse"
                        )}
                        onClick={isListening ? stopListening : startListening}
                        disabled={isSending}
                      >
                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isListening
                        ? (isRTL ? "إيقاف التسجيل" : "Stop recording")
                        : (isRTL ? "تكلم مع راكان" : "Talk to Rakan")}
                    </TooltipContent>
                  </Tooltip>
                )}

                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRTL ? "اسأل راكان... أو اضغط 🎤" : "Ask Rakan... or press 🎤"}
                  className={cn(
                    "resize-none text-sm min-h-[40px] max-h-[120px] rounded-xl border-border",
                    "focus-visible:ring-1 focus-visible:ring-primary",
                    isRTL && "text-right"
                  )}
                  rows={1}
                  dir={isRTL ? "rtl" : "ltr"}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0"
                  onClick={sendMessage}
                  disabled={!input.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} className={isRTL ? "rotate-180" : ""} />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                {isRTL ? "Enter للإرسال • Shift+Enter لسطر جديد • 🎤 للتحدث" : "Enter to send • Shift+Enter for new line • 🎤 to talk"}
              </p>
            </div>
          </div>
        )}

        {/* ── FAB Button ──────────────────────────────────────────────────── */}

        {/* ── Dismiss Button ── */}
        {!isOpen && (
          <button
            onClick={handleDismiss}
            className="absolute -top-1 z-20 w-5 h-5 rounded-full bg-gray-400 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-sm"
            style={{
              [isRTL ? "left" : "right"]: "2px",
            }}
            title={isRTL ? "إخفاء المساعد" : "Hide Assistant"}
          >
            <X size={12} />
          </button>
        )}
        {/* ── Speech Bubble ── */}
        {!isOpen && (
          <div style={{
            position: "absolute",
            bottom: "82px",
            right: isRTL ? "auto" : "4px",
            left: isRTL ? "4px" : "auto",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(12px)",
            color: "#6d28d9",
            borderRadius: isRTL ? "14px 14px 14px 3px" : "14px 14px 3px 14px",
            padding: "7px 14px",
            fontSize: "11.5px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(109,40,217,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid rgba(139,92,246,0.25)",
            animation: "rakanBubble 3.5s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 10,
            letterSpacing: "0.01em",
          }}>
            {isHovered
              ? (isRTL ? "يلا نشتغل! 🚀" : "Let's go! 🚀")
              : (isRTL ? "عايز مساعدة؟ ✨" : "Need help? ✨")}
          </div>
        )}

        {/* ── Robot Button ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(!isOpen)}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="relative focus:outline-none"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                width: "72px",
                height: "72px",
                animation: isOpen ? "none" : (isHovered ? "rakanExcited 0.5s ease-in-out infinite" : "rakanFloat 4s ease-in-out infinite"),
                transition: "transform 0.2s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              {isOpen ? (
                /* Close state - sleek circle */
                <div style={{
                  width: 60, height: 60,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #6366f1 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
                  margin: "6px",
                }}>
                  <ChevronDown size={22} color="white" strokeWidth={2.5} />
                </div>
              ) : (
                /* Modern AI Robot SVG */
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    {/* Main body gradient - deep purple to indigo */}
                    <linearGradient id="rk-body" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#6d28d9" />
                      <stop offset="100%" stopColor="#4338ca" />
                    </linearGradient>
                    {/* Head gradient - lighter purple */}
                    <linearGradient id="rk-head" x1="0" y1="0" x2="0.5" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#5b21b6" />
                    </linearGradient>
                    {/* Visor gradient - cyan glow */}
                    <linearGradient id="rk-visor" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                      <stop offset="50%" stopColor="#818cf8" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.9" />
                    </linearGradient>
                    {/* Glow filter */}
                    <filter id="rk-glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    {/* Outer ring gradient */}
                    <linearGradient id="rk-ring" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
                    </linearGradient>
                    {/* Happy glow - brighter when hovered */}
                    <filter id="rk-happy-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>

                  {/* ─ Outer glow ring ─ */}
                  <circle cx="36" cy="38" r={isHovered ? 35 : 33} fill="none" stroke="url(#rk-ring)" strokeWidth={isHovered ? 2 : 1}>
                    <animate attributeName="opacity" values={isHovered ? "1;0.5;1" : "0.6;0.2;0.6"} dur={isHovered ? "1s" : "3s"} repeatCount="indefinite" />
                    {!isHovered && <animate attributeName="r" values="33;35;33" dur="3s" repeatCount="indefinite" />}
                  </circle>

                  {/* ─ Happy sparkles when hovered ─ */}
                  {isHovered && (
                    <>
                      <circle cx="12" cy="14" r="2" fill="#fbbf24" filter="url(#rk-happy-glow)">
                        <animate attributeName="opacity" values="0;1;0" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="r" values="1;3;1" dur="0.8s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="60" cy="10" r="2" fill="#34d399" filter="url(#rk-happy-glow)">
                        <animate attributeName="opacity" values="0;1;0" dur="0.6s" repeatCount="indefinite" />
                        <animate attributeName="r" values="1;2.5;1" dur="0.6s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="8" cy="42" r="1.5" fill="#f472b6" filter="url(#rk-happy-glow)">
                        <animate attributeName="opacity" values="0;1;0" dur="0.7s" repeatCount="indefinite" />
                        <animate attributeName="r" values="1;2;1" dur="0.7s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="64" cy="48" r="1.5" fill="#60a5fa" filter="url(#rk-happy-glow)">
                        <animate attributeName="opacity" values="0;1;0" dur="0.9s" repeatCount="indefinite" />
                        <animate attributeName="r" values="1;2.5;1" dur="0.9s" repeatCount="indefinite" />
                      </circle>
                    </>
                  )}

                  {/* ─ Base platform shadow ─ */}
                  <ellipse cx="36" cy="69" rx="16" ry="2.5" fill="rgba(79,70,229,0.25)" />

                  {/* ─ BODY ─ */}
                  <rect x="20" y="36" width="32" height="26" rx="9" fill="url(#rk-body)" />
                  {/* Body top edge highlight */}
                  <rect x="20" y="36" width="32" height="3" rx="3" fill="rgba(255,255,255,0.12)" />
                  {/* Body left edge */}
                  <rect x="20" y="36" width="3" height="26" rx="3" fill="rgba(255,255,255,0.08)" />

                  {/* ─ Chest panel - glassmorphism ─ */}
                  <rect x="26" y="43" width="20" height="13" rx="5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                  {/* Chest scan line */}
                  <rect x="28" y="47" width="16" height="1.5" rx="1" fill={isHovered ? "rgba(52,211,153,0.8)" : "rgba(56,189,248,0.6)"}>
                    <animate attributeName="y" values="46;54;46" dur={isHovered ? "0.8s" : "2s"} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.2;0.8" dur={isHovered ? "0.8s" : "2s"} repeatCount="indefinite" />
                  </rect>
                  {/* Chest dots - faster when hovered */}
                  <circle cx="30" cy="50" r="2" fill={isHovered ? "#fbbf24" : "#a78bfa"}>
                    <animate attributeName="opacity" values="1;0.3;1" dur={isHovered ? "0.4s" : "1.1s"} repeatCount="indefinite" />
                  </circle>
                  <circle cx="36" cy="50" r="2" fill={isHovered ? "#34d399" : "#38bdf8"}>
                    <animate attributeName="opacity" values="0.3;1;0.3" dur={isHovered ? "0.4s" : "1.1s"} repeatCount="indefinite" />
                  </circle>
                  <circle cx="42" cy="50" r="2" fill={isHovered ? "#f472b6" : "#c4b5fd"}>
                    <animate attributeName="opacity" values="0.6;1;0.6" dur={isHovered ? "0.3s" : "0.8s"} repeatCount="indefinite" />
                  </circle>

                  {/* ─ NECK ─ */}
                  <rect x="31" y="32" width="10" height="6" rx="3" fill="#5b21b6" />
                  <rect x="32" y="33" width="8" height="2" rx="1" fill="rgba(255,255,255,0.15)" />

                  {/* ─ HEAD ─ */}
                  <rect x="18" y="12" width="36" height="22" rx="11" fill="url(#rk-head)" />
                  {/* Head top highlight */}
                  <rect x="22" y="13" width="20" height="5" rx="3" fill="rgba(255,255,255,0.18)" />
                  {/* Head side detail */}
                  <rect x="18" y="18" width="3" height="8" rx="1.5" fill="rgba(255,255,255,0.1)" />
                  <rect x="51" y="18" width="3" height="8" rx="1.5" fill="rgba(255,255,255,0.1)" />

                  {/* ─ VISOR (eye area) ─ */}
                  <rect x="22" y="18" width="28" height="12" rx="6" fill="url(#rk-visor)" opacity="0.9" />
                  {/* Visor glass shine */}
                  <rect x="23" y="19" width="12" height="3" rx="1.5" fill="rgba(255,255,255,0.35)" />
                  {/* Visor bottom edge */}
                  <rect x="22" y="28" width="28" height="1.5" rx="1" fill="rgba(255,255,255,0.15)" />

                  {/* ─ EYES inside visor ─ */}
                  {isHovered ? (
                    /* ── HAPPY EYES (^_^) when hovered ── */
                    <>
                      {/* Left happy eye - arc shape */}
                      <path d="M25 25 Q29 19 33 25" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                      <circle cx="29" cy="22" r="1" fill="#fbbf24">
                        <animate attributeName="opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite" />
                      </circle>
                      {/* Right happy eye - arc shape */}
                      <path d="M39 25 Q43 19 47 25" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                      <circle cx="43" cy="22" r="1" fill="#fbbf24">
                        <animate attributeName="opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite" />
                      </circle>
                      {/* Happy blush */}
                      <ellipse cx="25" cy="27" rx="3" ry="1.5" fill="rgba(244,114,182,0.35)" />
                      <ellipse cx="47" cy="27" rx="3" ry="1.5" fill="rgba(244,114,182,0.35)" />
                    </>
                  ) : (
                    /* ── NORMAL EYES ── */
                    <>
                      {/* Left eye */}
                      <ellipse cx="29" cy="24" rx="4" ry="3.5" fill="rgba(15,23,42,0.7)" />
                      <circle cx="29" cy="24" r="2.5" fill="#e0e7ff">
                        <animate attributeName="r" values="2.5;2.8;2.5" dur="3s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="29" cy="24" r="1.5" fill="#4f46e5" />
                      <circle cx="29" cy="24" r="0.7" fill="#818cf8">
                        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="30.5" cy="22.5" r="0.8" fill="white" opacity="0.9" />
                      {/* Right eye */}
                      <ellipse cx="43" cy="24" rx="4" ry="3.5" fill="rgba(15,23,42,0.7)" />
                      <circle cx="43" cy="24" r="2.5" fill="#e0e7ff">
                        <animate attributeName="r" values="2.5;2.8;2.5" dur="3s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="43" cy="24" r="1.5" fill="#4f46e5" />
                      <circle cx="43" cy="24" r="0.7" fill="#818cf8">
                        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="44.5" cy="22.5" r="0.8" fill="white" opacity="0.9" />
                    </>
                  )}

                  {/* ─ MOUTH ─ */}
                  {isHovered ? (
                    /* Happy smile when hovered */
                    <path d="M31 29 Q36 34 41 29" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  ) : null}

                  {/* ─ ANTENNA ─ */}
                  <rect x="34" y="5" width="4" height="8" rx="2" fill="#7c3aed" />
                  {/* Antenna glow orb */}
                  <circle cx="36" cy="4" r={isHovered ? 6 : 4.5} fill={isHovered ? "#fbbf24" : "#a78bfa"} filter="url(#rk-glow)">
                    <animate attributeName="r" values={isHovered ? "5;7;5" : "4.5;6;4.5"} dur={isHovered ? "0.6s" : "1.6s"} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.5;0.9" dur={isHovered ? "0.6s" : "1.6s"} repeatCount="indefinite" />
                  </circle>
                  <circle cx="36" cy="4" r="2.5" fill="white" opacity="0.85" />
                  <circle cx="36" cy="4" r="1" fill={isHovered ? "#f59e0b" : "#38bdf8"}>
                    <animate attributeName="opacity" values="1;0.3;1" dur={isHovered ? "0.3s" : "0.8s"} repeatCount="indefinite" />
                  </circle>

                  {/* ─ LEFT ARM ─ */}
                  {isHovered ? (
                    /* Waving arm when hovered */
                    <>
                      <path d="M20 42 Q9 35 12 22 Q14 14 18 12" stroke="url(#rk-body)" strokeWidth="7" strokeLinecap="round" fill="none">
                        <animate attributeName="d" values="M20 42 Q9 35 12 22 Q14 14 18 12;M20 42 Q9 35 10 20 Q12 10 20 8;M20 42 Q9 35 12 22 Q14 14 18 12" dur="0.6s" repeatCount="indefinite" />
                      </path>
                      <path d="M20 42 Q9 35 12 22 Q14 14 18 12" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeLinecap="round" fill="none">
                        <animate attributeName="d" values="M20 42 Q9 35 12 22 Q14 14 18 12;M20 42 Q9 35 10 20 Q12 10 20 8;M20 42 Q9 35 12 22 Q14 14 18 12" dur="0.6s" repeatCount="indefinite" />
                      </path>
                      <rect x="14" y="8" width="10" height="10" rx="5" fill="url(#rk-head)">
                        <animate attributeName="y" values="8;4;8" dur="0.6s" repeatCount="indefinite" />
                      </rect>
                    </>
                  ) : (
                    /* Normal arm */
                    <>
                      <path d="M20 42 Q9 38 8 28 Q8 20 15 19" stroke="url(#rk-body)" strokeWidth="7" strokeLinecap="round" fill="none" />
                      <path d="M20 42 Q9 38 8 28 Q8 20 15 19" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeLinecap="round" fill="none" />
                      <rect x="11" y="15" width="10" height="10" rx="5" fill="url(#rk-head)" />
                      <rect x="12" y="16" width="5" height="3" rx="1.5" fill="rgba(255,255,255,0.2)" />
                      <rect x="12" y="24" width="2.5" height="3" rx="1.2" fill="#6d28d9" />
                      <rect x="15.5" y="24" width="2.5" height="3" rx="1.2" fill="#6d28d9" />
                      <rect x="19" y="24" width="2.5" height="3" rx="1.2" fill="#6d28d9" />
                    </>
                  )}

                  {/* ─ RIGHT ARM ─ */}
                  <path d="M52 42 Q63 40 64 52" stroke="url(#rk-body)" strokeWidth="7" strokeLinecap="round" fill="none" />
                  <path d="M52 42 Q63 40 64 52" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <rect x="60" y="50" width="9" height="9" rx="4.5" fill="url(#rk-head)" />
                  <rect x="61" y="51" width="4" height="2.5" rx="1.2" fill="rgba(255,255,255,0.2)" />

                  {/* ─ LEGS ─ */}
                  <rect x="23" y="60" width="11" height="10" rx="5.5" fill="url(#rk-body)" />
                  <rect x="38" y="60" width="11" height="10" rx="5.5" fill="url(#rk-body)" />
                  <rect x="24" y="61" width="5" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
                  <rect x="39" y="61" width="5" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
                  <ellipse cx="28.5" cy="70" rx="7" ry="2.5" fill="#3730a3" />
                  <ellipse cx="43.5" cy="70" rx="7" ry="2.5" fill="#3730a3" />
                </svg>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side={isRTL ? "right" : "left"}>
            {isOpen ? (isRTL ? "إغلاق" : "Close") : (isRTL ? "راكان - مساعدك الذكي" : "Rakan - AI Assistant")}
          </TooltipContent>
        </Tooltip>
        {/* Keyframes */}
        <style>{`
          @keyframes rakanFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes rakanBubble {
            0%, 100% { opacity: 1; transform: translateY(0px) scale(1); }
            50% { opacity: 0.88; transform: translateY(-3px) scale(1.02); }
          }
          @keyframes rakanExcited {
            0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
            25% { transform: translateY(-6px) scale(1.08) rotate(-3deg); }
            50% { transform: translateY(-3px) scale(1.05) rotate(0deg); }
            75% { transform: translateY(-6px) scale(1.08) rotate(3deg); }
          }
        `}</style>

        {/* Unread badge */}
        {!isOpen && messages.length > 0 && (
          <span className={cn(
            "absolute -top-1 w-5 h-5 bg-destructive text-destructive-foreground",
            "text-[10px] rounded-full flex items-center justify-center font-bold",
            isRTL ? "-right-1" : "-right-1"
          )}>
            {messages.length > 9 ? "9+" : messages.length}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
