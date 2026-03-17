import React, { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

interface ThemeTokens {
  primaryColor: string;
  accentColor: string;
  successColor: string;
  fontFamily: string;
  logoUrl: string;
  appName: string;
  appNameAr: string;
}

const defaultTokens: ThemeTokens = {
  primaryColor: "#1e3a5f",
  accentColor: "#f97316",
  successColor: "#22c55e",
  fontFamily: "Cairo",
  logoUrl: "",
  appName: "Tamiyouz CRM",
  appNameAr: "تميز CRM",
};

interface ThemeTokenContextType {
  tokens: ThemeTokens;
  setToken: (key: keyof ThemeTokens, value: string) => void;
}

const ThemeTokenContext = createContext<ThemeTokenContextType>({
  tokens: defaultTokens,
  setToken: () => {},
});

export function ThemeTokenProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<ThemeTokens>(defaultTokens);
  const { data: themeData } = trpc.theme.get.useQuery();

  useEffect(() => {
    if (themeData && themeData.length > 0) {
      const newTokens = { ...defaultTokens };
      for (const item of themeData) {
        if (item.key in newTokens) {
          (newTokens as any)[item.key] = item.value;
        }
      }
      setTokens(newTokens);
    }
  }, [themeData]);

  useEffect(() => {
    // Apply CSS variables
    const root = document.documentElement;
    root.style.setProperty("--crm-primary", tokens.primaryColor);
    root.style.setProperty("--crm-accent", tokens.accentColor);
    root.style.setProperty("--crm-success", tokens.successColor);
    root.style.setProperty("--crm-font", tokens.fontFamily);

    // Apply font
    const fontLink = document.getElementById("crm-font-link") as HTMLLinkElement;
    if (fontLink) {
      fontLink.href = `https://fonts.googleapis.com/css2?family=${tokens.fontFamily.replace(" ", "+")}:wght@300;400;500;600;700&display=swap`;
    }
  }, [tokens]);

  const setToken = (key: keyof ThemeTokens, value: string) => {
    setTokens((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ThemeTokenContext.Provider value={{ tokens, setToken }}>
      {children}
    </ThemeTokenContext.Provider>
  );
}

export function useThemeTokens() {
  return useContext(ThemeTokenContext);
}
