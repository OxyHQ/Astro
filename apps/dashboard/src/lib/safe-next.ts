export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value) return "/";
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
