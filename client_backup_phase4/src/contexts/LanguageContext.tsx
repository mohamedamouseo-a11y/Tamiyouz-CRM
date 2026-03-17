import React, { createContext, useContext, useEffect, useState } from "react";
import { Language, TranslationKey, translations } from "@/lib/i18n";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "ar",
  setLang: () => {},
  t: (key) => key,
  isRTL: true,
  dir: "rtl",
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("crm-lang");
    return (saved as Language) || "ar";
  });

  const isRTL = lang === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("crm-lang", newLang);
  };

  const t = (key: TranslationKey): string => {
    return (translations[lang] as any)[key] ?? (translations.en as any)[key] ?? key;
  };

  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang, dir]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
