declare const __ASTRO_KAANA_URL__: string | undefined;

export const KAANA_URL = (typeof __ASTRO_KAANA_URL__ === "string" && __ASTRO_KAANA_URL__) || "https://kaana.ai";

export type KaanaMessage = { role: "system" | "user" | "assistant"; content: { type: "text"; text: string }[] };

export type KaanaResponsesRequest = {
  model: string;
  input: KaanaMessage[];
  maxOutputTokens: number;
  labels?: Record<string, string>;
};

export type KaanaAnswer = { text: string; requestId: string | null; model: string | null; latencyMs: number | null };

export class KaanaRefusal extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined;
  readonly requestId: string | null;
  readonly status: number;
  constructor(init: { code: string; message: string; retryable: boolean; retryAfterMs?: number; requestId: string | null; status: number }) {
    super(init.message);
    this.code = init.code;
    this.retryable = init.retryable;
    this.retryAfterMs = init.retryAfterMs;
    this.requestId = init.requestId;
    this.status = init.status;
  }
}

type Json = Record<string, unknown>;
const record = (value: unknown): Json | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null);
const string = (value: unknown) => (typeof value === "string" ? value : null);

function refusal(body: unknown, response: Response): KaanaRefusal {
  const top = record(body);
  const error = record(top?.error) ?? top;
  const retryAfter = Number(response.headers.get("Retry-After"));
  const retryAfterMs = typeof error?.retryAfterMs === "number" ? error.retryAfterMs : retryAfter > 0 ? retryAfter * 1000 : undefined;
  return new KaanaRefusal({
    code: string(error?.code) ?? `http_${response.status}`,
    message: string(error?.message) ?? `Kaana answered ${response.status}`,
    retryable: error?.retryable === true,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    requestId: string(error?.requestId) ?? response.headers.get("X-Kaana-Request-Id") ?? response.headers.get("X-Oxy-Request-Id"),
    status: response.status,
  });
}

export function answerText(body: unknown): string {
  const output = record(body)?.output;
  if (!Array.isArray(output)) return "";
  return output
    .map(record)
    .filter((m): m is Json => !!m && m.role === "assistant" && Array.isArray(m.content))
    .flatMap((m) => m.content as unknown[])
    .map((part) => {
      const p = record(part);
      return p?.type === "text" ? (string(p.text) ?? "") : "";
    })
    .join("")
    .trim();
}

export async function kaanaRespond(
  baseURL: string,
  bearer: string,
  request: KaanaResponsesRequest,
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<KaanaAnswer> {
  const response = await (options.fetch ?? fetch)(`${baseURL.replace(/\/$/, "")}/v1/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw refusal(body, response);
  const top = record(body);
  return {
    text: answerText(body),
    requestId: string(top?.requestId),
    model: string(top?.model),
    latencyMs: typeof top?.latencyMs === "number" ? top.latencyMs : null,
  };
}
