import { DictationError, requestTranscription, type AudioRequestAuthentication, type DictationErrorCode as SdkDictationErrorCode } from "@alia.onl/sdk/dictation";

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

const SDK_CODES: Record<SdkDictationErrorCode, DictationErrorCode> = {
  TRANSCRIPTION_UNAVAILABLE: "unavailable",
  TRANSCRIPTION_LIMITED: "limited",
  TRANSCRIPTION_REJECTED: "rejected",
  INVALID_REQUEST: "rejected",
  CLIP_TOO_LONG: "too-long",
  TRANSCRIPTION_FAILED: "failed",
  NOT_AUTHENTICATED: "not-signed-in",
  CREDENTIAL_NOT_SUPPORTED: "not-signed-in",
};

const failureOf = (error: DictationError): DictationFailure => {
  const code = error.code !== null ? SDK_CODES[error.code] : error.status === 429 ? "limited" : "failed";
  return new DictationFailure(code, error.retryable);
};

export function aliaTranscriber(apiUrl: string, auth: AudioRequestAuthentication): Transcriber {
  return async (clip, language, signal) => {
    try {
      const result = await requestTranscription({
        ...auth,
        apiUrl,
        clip: { file: new Blob([clip.wav], { type: "audio/wav" }), mediaType: "audio/wav", durationMs: clip.durationMs },
        language,
        signal,
      });
      return result.text;
    } catch (error) {
      if (error instanceof DictationError) throw failureOf(error);
      throw error;
    }
  };
}
