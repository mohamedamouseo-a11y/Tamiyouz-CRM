export interface SeoPayload {
  title: string;
  description: string;
  keywords?: string[];
  canonicalPath?: string;
  robots?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  lang?: string;
}

function upsertMeta(selector: string, attrs: Record<string, string>, content: string) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
}

function removeJsonLdScripts() {
  document.head.querySelectorAll('script[data-seo="json-ld"]').forEach((node) => node.remove());
}

export function applyDocumentSeo(payload: SeoPayload) {
  if (typeof document === "undefined") return;

  document.title = payload.title;

  const canonicalUrl = payload.canonicalPath
    ? new URL(payload.canonicalPath, window.location.origin).toString()
    : window.location.href;

  if (payload.lang) {
    document.documentElement.lang = payload.lang;
  }

  upsertMeta('meta[name="description"]', { name: "description" }, payload.description);
  upsertMeta('meta[name="keywords"]', { name: "keywords" }, (payload.keywords ?? []).join(", "));
  upsertMeta('meta[name="robots"]', { name: "robots" }, payload.robots ?? "index, follow");
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, payload.title);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, payload.description);
  upsertMeta('meta[property="og:type"]', { property: "og:type" }, payload.ogType ?? "website");
  upsertMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, payload.title);
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, payload.description);
  upsertLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });

  removeJsonLdScripts();
  if (payload.jsonLd) {
    const blocks = Array.isArray(payload.jsonLd) ? payload.jsonLd : [payload.jsonLd];
    blocks.forEach((block) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seo = "json-ld";
      script.text = JSON.stringify(block);
      document.head.appendChild(script);
    });
  }
}

export function clearDocumentSeo() {
  if (typeof document === "undefined") return;
  removeJsonLdScripts();
}
