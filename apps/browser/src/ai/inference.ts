import { create } from "zustand";
import { useOxySession } from "../oxy/session";
import { KAANA_URL, KaanaRefusal, kaanaRespond, kaanaSessionBearer, type KaanaResponsesRequest } from "./kaana";

export type OneShotFeature = "groupName" | "pinnedTitle" | "downloadName" | "videoSummary";

export const ONE_SHOT_POWER_LEVEL = "instant";

export type OneShotCall = {
  feature: OneShotFeature;
  at: number;
  ms: number;
  ok: boolean;
  code?: string;
  requestId?: string;
  model?: string;
  edgeMs?: number;
};

type OneShotStatus = {
  endpoint: string;
  stoppedFor: string | null;
  pausedUntil: number;
  calls: OneShotCall[];
};

export const useOneShotStatus = create<OneShotStatus>()(() => ({ endpoint: KAANA_URL, stoppedFor: null, pausedUntil: 0, calls: [] }));

const STOPPING_CODES = new Set([
  "authentication_failed",
  "permission_denied",
  "insufficient_scope",
  "policy_violation",
  "commercial_permission_denied",
  "model_not_found",
  "insufficient_balance",
  "spending_limit_exceeded",
]);
const PAUSE_MS = 15 * 60_000;
const MAX_IN_FLIGHT = 2;
const KEPT_CALLS = 50;

let lastAccount: string | null = null;
useOxySession.subscribe((s) => {
  const id = s.account?.id ?? null;
  if (id === lastAccount) return;
  lastAccount = id;
  useOneShotStatus.setState({ stoppedFor: null, pausedUntil: 0 });
});

type TestEndpoint = { url: string; bearer: string };
let testEndpoint: TestEndpoint | null = null;

export function setTestEndpoint(url: string | null, testBearer = ""): boolean {
  if (url === null) {
    testEndpoint = null;
    useOneShotStatus.setState({ endpoint: KAANA_URL, stoppedFor: null, pausedUntil: 0 });
    return true;
  }
  const origin = new URL(url);
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(origin.hostname) || !testBearer) return false;
  testEndpoint = { url, bearer: testBearer };
  useOneShotStatus.setState({ endpoint: url, stoppedFor: null, pausedUntil: 0 });
  return true;
}

const endpoint = () => testEndpoint?.url ?? KAANA_URL;

const bearer = (): string | null => {
  if (testEndpoint) return testEndpoint.bearer;
  const s = useOxySession.getState();
  const token = s.account && s.clientId ? (s.sessionBearer?.() ?? null) : null;
  return token && s.clientId ? kaanaSessionBearer(s.clientId, token) : null;
};

async function respondOnce(request: KaanaResponsesRequest, signal: AbortSignal | undefined) {
  const sent = bearer();
  if (!sent) return null;
  const options = signal ? { signal } : {};
  try {
    return await kaanaRespond(endpoint(), sent, request, options);
  } catch (error) {
    const fresh = bearer();
    if (!(error instanceof KaanaRefusal) || error.code !== "authentication_failed" || !fresh || fresh === sent) throw error;
    return kaanaRespond(endpoint(), fresh, request, options);
  }
}

export const oneShotSignedIn = () => !!useOxySession.getState().account;

export function oneShotReady(): boolean {
  const status = useOneShotStatus.getState();
  return !!bearer() && !status.stoppedFor && Date.now() >= status.pausedUntil;
}

export const useOneShotReady = () => {
  const signedIn = useOxySession((s) => (!!s.account && !!s.sessionBearer && !!s.clientId) || !!testEndpoint);
  const stopped = useOneShotStatus((s) => !!s.stoppedFor);
  return signedIn && !stopped;
};

export const useSignInOffered = () => useOxySession((s) => s.resolved && !s.account);

let inFlight = 0;
const waiting: (() => void)[] = [];

async function slot(signal?: AbortSignal): Promise<() => void> {
  if (inFlight >= MAX_IN_FLIGHT) {
    await new Promise<void>((resolve, reject) => {
      const go = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const abort = () => {
        const i = waiting.indexOf(go);
        if (i >= 0) waiting.splice(i, 1);
        reject(new DOMException("Aborted", "AbortError"));
      };
      waiting.push(go);
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  inFlight++;
  return () => {
    inFlight--;
    waiting.shift()?.();
  };
}

function record(call: OneShotCall) {
  useOneShotStatus.setState((s) => ({ calls: [...s.calls.slice(-(KEPT_CALLS - 1)), call] }));
}

type OneShotRequest = {
  instructions: string;
  input: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
};

type InferenceFailure = { code?: unknown; retryable?: unknown; retryAfterMs?: unknown; requestId?: unknown };

function noteFailure(error: unknown): string {
  const failure = (error && typeof error === "object" ? error : {}) as InferenceFailure;
  const code = typeof failure.code === "string" ? failure.code : error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "network";
  if (STOPPING_CODES.has(code)) useOneShotStatus.setState({ stoppedFor: code });
  else if (code === "quota_exceeded" || failure.retryable === true) {
    const after = typeof failure.retryAfterMs === "number" && failure.retryAfterMs > 0 ? failure.retryAfterMs : PAUSE_MS;
    useOneShotStatus.setState({ pausedUntil: Date.now() + after });
  }
  return code;
}

export async function oneShot(feature: OneShotFeature, request: OneShotRequest): Promise<string | null> {
  if (!oneShotReady()) return null;
  const release = await slot(request.signal).catch(() => null);
  if (!release) return null;
  const started = Date.now();
  try {
    const answer = await respondOnce(
      {
        model: ONE_SHOT_POWER_LEVEL,
        input: [
          { role: "system", content: [{ type: "text", text: request.instructions }] },
          { role: "user", content: [{ type: "text", text: request.input }] },
        ],
        maxOutputTokens: request.maxOutputTokens,
        labels: { app: "astro", feature },
      },
      request.signal,
    );
    if (!answer) return null;
    record({
      feature,
      at: started,
      ms: Date.now() - started,
      ok: true,
      ...(answer.requestId ? { requestId: answer.requestId } : {}),
      ...(answer.model ? { model: answer.model } : {}),
      ...(answer.latencyMs !== null ? { edgeMs: answer.latencyMs } : {}),
    });
    return answer.text || null;
  } catch (error) {
    const code = noteFailure(error);
    const requestId = (error as InferenceFailure)?.requestId;
    record({ feature, at: started, ms: Date.now() - started, ok: false, code, ...(typeof requestId === "string" ? { requestId } : {}) });
    return null;
  } finally {
    release();
  }
}
