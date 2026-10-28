import { openDictationStream, type DictationServerEvent, type DictationStreamErrorCode } from "@alia.onl/sdk/dictation";
import type { DictationErrorCode } from "./alia";
import { joinTranscript } from "./transcript";

export type StreamEvent = DictationServerEvent;
export type DictationStreamHandle = { append(pcm16: Uint8Array): void; end(): Promise<unknown>; close(): void };
export type Streamer = (options: { language: string; onEvent: (event: StreamEvent) => void; signal: AbortSignal }) => DictationStreamHandle;
export type TokenSource = (target: string, options?: { signal?: AbortSignal }) => string | null | Promise<string | null>;

const STREAM_CODES: Record<DictationStreamErrorCode, DictationErrorCode> = {
  TRANSCRIPTION_UNAVAILABLE: "unavailable",
  TRANSCRIPTION_LIMITED: "limited",
  TRANSCRIPTION_REJECTED: "rejected",
  INVALID_REQUEST: "rejected",
  CLIP_TOO_LONG: "too-long",
  TRANSCRIPTION_FAILED: "failed",
  NOT_AUTHENTICATED: "not-signed-in",
  CREDENTIAL_NOT_SUPPORTED: "not-signed-in",
};

export const streamFailureCode = (code: DictationStreamErrorCode): DictationErrorCode => STREAM_CODES[code] ?? "failed";

export function aliaStreamer(apiUrl: string, getToken: TokenSource): Streamer {
  return ({ language, onEvent, signal }) => openDictationStream({ apiUrl, getToken, language, onEvent, signal });
}

type Segment = { locked: string; interim: string | null; final: string | null };

export class StreamTranscript {
  private readonly segments = new Map<number, Segment>();

  apply(event: StreamEvent): boolean {
    if (event.type !== "transcript.interim" && event.type !== "transcript.delta" && event.type !== "transcript.final") return false;
    const segment = this.segments.get(event.segment) ?? { locked: "", interim: null, final: null };
    if (segment.final !== null) return false;
    if (event.type === "transcript.interim") segment.interim = event.text;
    else if (event.type === "transcript.delta") {
      segment.locked += event.text;
      segment.interim = null;
    } else {
      segment.final = event.text;
      segment.interim = null;
    }
    this.segments.set(event.segment, segment);
    return true;
  }

  get text(): string {
    const order = [...this.segments.keys()].sort((a, b) => a - b);
    return joinTranscript(order.map((key) => {
      const segment = this.segments.get(key)!;
      return segment.final ?? segment.interim ?? segment.locked;
    }));
  }

  get finalText(): string {
    const order = [...this.segments.keys()].sort((a, b) => a - b);
    return joinTranscript(order.map((key) => this.segments.get(key)!.final ?? ""));
  }
}
