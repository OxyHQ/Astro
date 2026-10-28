export type DictationErrorCode =
  | "mic-denied"
  | "mic-unavailable"
  | "not-signed-in"
  | "unavailable"
  | "limited"
  | "rejected"
  | "too-long"
  | "failed";

export const DICTATION_ERROR_MESSAGES: Record<DictationErrorCode, string> = {
  "mic-denied": "Astro can't use the microphone. Allow it in your system's privacy settings.",
  "mic-unavailable": "No microphone is available.",
  "not-signed-in": "Sign in with Oxy to dictate.",
  unavailable: "Dictation isn't available right now.",
  limited: "Dictation has reached its limit for now. Try again later.",
  rejected: "That recording couldn't be transcribed.",
  "too-long": "A dictation can be at most 5 minutes long.",
  failed: "Transcription failed. Try again.",
};

export class DictationFailure extends Error {
  readonly code: DictationErrorCode;
  readonly retryable: boolean;

  constructor(code: DictationErrorCode, retryable = false) {
    super(DICTATION_ERROR_MESSAGES[code]);
    this.name = "DictationFailure";
    this.code = code;
    this.retryable = retryable;
  }
}

export type DictationClip = { wav: Uint8Array<ArrayBuffer>; durationMs: number };

export type Transcriber = (clip: DictationClip, language: string, signal: AbortSignal) => Promise<string>;

const SERVER_CODES: Record<string, DictationErrorCode> = {
  TRANSCRIPTION_UNAVAILABLE: "unavailable",
  TRANSCRIPTION_LIMITED: "limited",
  TRANSCRIPTION_REJECTED: "rejected",
  INVALID_REQUEST: "rejected",
  CLIP_TOO_LONG: "too-long",
  TRANSCRIPTION_FAILED: "failed",
  NOT_AUTHENTICATED: "not-signed-in",
  CREDENTIAL_NOT_SUPPORTED: "not-signed-in",
};

const AUTH_CODES = new Set(["AUTH_REQUIRED", "AUTH_SESSION_CHANGED"]);

export function aliaTranscriber(apiUrl: string, send: typeof fetch, headers: () => Record<string, string> = () => ({})): Transcriber {
  return async (clip, language, signal) => {
    const form = new FormData();
    form.append("file", new Blob([clip.wav], { type: "audio/wav" }), "dictation.wav");
    form.append("language", language);
    form.append("durationMs", String(Math.max(0, Math.round(clip.durationMs))));
    let response: Response;
    try {
      response = await send(`${apiUrl}/v1/audio/transcriptions`, { method: "POST", headers: headers(), body: form, redirect: "error", credentials: "omit", signal });
    } catch (error) {
      if ((error as { name?: unknown } | null)?.name === "AbortError") throw error;
      if (AUTH_CODES.has(String((error as { code?: unknown } | null)?.code))) throw new DictationFailure("not-signed-in");
      throw new DictationFailure("failed", true);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const envelope = (body as { error?: { code?: unknown; retryable?: unknown } } | null)?.error;
      const named = typeof envelope?.code === "string" ? SERVER_CODES[envelope.code] : undefined;
      const code = named ?? (response.status === 401 ? "not-signed-in" : response.status === 413 ? "too-long" : response.status === 429 ? "limited" : "failed");
      throw new DictationFailure(code, envelope?.retryable === true);
    }
    const text = (body as { text?: unknown } | null)?.text;
    if (typeof text !== "string") throw new DictationFailure("failed");
    return text;
  };
}
