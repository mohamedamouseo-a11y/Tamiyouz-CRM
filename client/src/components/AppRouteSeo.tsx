import { useEffect } from "react";
import { useLocation } from "wouter";
import { applyDocumentSeo } from "@/lib/seo";

export default function AppRouteSeo() {
  const [location] = useLocation();

  useEffect(() => {
    const isPublicHelp = (
      location.startsWith("/help-center") ||
      location.startsWith("/ar/help-center") ||
      location.startsWith("/en/help-center")
    );
    if (isPublicHelp) return;

    applyDocumentSeo({
      title: "Tamiyouz CRM",
      description: "Tamiyouz CRM internal workspace for sales, account management, marketing, and operations.",
      keywords: ["Tamiyouz CRM"],
      canonicalPath: location,
      robots: "noindex, nofollow",
      ogType: "website",
      lang: "en",
    });
  }, [location]);

  return null;
}
