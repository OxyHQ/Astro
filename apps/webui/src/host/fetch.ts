import { isAccountOrigin } from "./oxyEndpoints";

type Cr = { sendWithPromise<T>(method: string, ...args: unknown[]): Promise<T> };
type Fetched = { status: number; headers: [string, string][]; body: string | null } | { error: string };

const CR = "chrome://resources/js/cr.js";
let cr: Promise<Cr> | null = null;
const loadCr = () => (cr ??= import(/* @vite-ignore */ CR) as Promise<Cr>);

const external = (url: URL) => url.protocol === "https:" || url.protocol === "http:";

export function installEngineFetch() {
  const pageFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!external(url)) return pageFetch(input, init);
    if (request.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const headers = Object.fromEntries(request.headers.entries());
    const account = isAccountOrigin(url);
    const sendsBody = account ? request.method !== "GET" && request.method !== "HEAD" : request.method === "POST";
    const body = sendsBody ? await request.text() : null;
    const fetched = (await loadCr()).sendWithPromise<Fetched>(account ? "astroAccountFetch" : "astroFetch", url.href, request.method, headers, body);
    const aborted = new Promise<never>((_, reject) =>
      request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }),
    );
    const result = await Promise.race([fetched, aborted]);
    if ("error" in result) throw new TypeError(`Failed to fetch ${url.href}: ${result.error}`);
    const nullBody = request.method === "HEAD" || result.status === 204 || result.status === 304;
    const bytes = result.body === null ? null : Uint8Array.from(atob(result.body), (c) => c.charCodeAt(0));
    return new Response(nullBody ? null : bytes, { status: result.status, headers: result.headers });
  };
}
