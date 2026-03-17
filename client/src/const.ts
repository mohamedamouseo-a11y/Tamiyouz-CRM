export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Standalone login URL — no Manus OAuth dependency
export const getLoginUrl = (returnPath?: string) => {
  const base = "/login";
  if (returnPath && returnPath !== "/login") {
    return `${base}?redirect=${encodeURIComponent(returnPath)}`;
  }
  return base;
};
