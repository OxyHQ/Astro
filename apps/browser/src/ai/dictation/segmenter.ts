import { FRAME_MS, FRAME_SAMPLES, concatSamples, levelOf, rmsOf } from "./audio";

export type SegmenterOptions = {
  pauseMs: number;
  minSpeechMs: number;
  maxSegmentMs: number;
  leadMs: number;
  tailMs: number;
  minVoicedMs: number;
  dropAfterMs: number;
};

export const SEGMENTER_DEFAULTS: SegmenterOptions = {
  pauseMs: 600,
  minSpeechMs: 1200,
  maxSegmentMs: 15_000,
  leadMs: 300,
  tailMs: 240,
  minVoicedMs: 240,
  dropAfterMs: 1500,
};

export type SpeechSegment = { samples: Float32Array; durationMs: number; voicedMs: number; forced: boolean };

type Frame = { samples: Float32Array; rms: number; voiced: boolean };

const VOICE_FLOOR = 0.008;
const NOISE_MIN = 0.0003;
const NOISE_MAX = 0.03;
const VOICE_OVER_NOISE = 3;
const FORCED_SEARCH_MS = 1500;

export class SpeechSegmenter {
  private frames: Frame[] = [];
  private partial = new Float32Array(FRAME_SAMPLES);
  private filled = 0;
  private voicedFrames = 0;
  private trailingSilent = 0;
  private noise = 0.002;
  private readonly options: SegmenterOptions;

  constructor(options: Partial<SegmenterOptions> = {}) {
    this.options = { ...SEGMENTER_DEFAULTS, ...options };
  }

  get heardSpeech(): boolean {
    return this.voicedFrames > 0;
  }

  push(chunk: Float32Array, mayCut: () => boolean = () => true): { segments: SpeechSegment[]; levels: number[] } {
    const segments: SpeechSegment[] = [];
    const levels: number[] = [];
    let at = 0;
    while (at < chunk.length) {
      const take = Math.min(FRAME_SAMPLES - this.filled, chunk.length - at);
      this.partial.set(chunk.subarray(at, at + take), this.filled);
      this.filled += take;
      at += take;
      if (this.filled < FRAME_SAMPLES) break;
      const frame = this.frameOf(this.partial);
      this.partial = new Float32Array(FRAME_SAMPLES);
      this.filled = 0;
      levels.push(levelOf(frame.rms));
      const segment = this.add(frame, mayCut);
      if (segment) segments.push(segment);
    }
    return { segments, levels };
  }

  flush(): SpeechSegment | null {
    if (this.filled > 0) {
      this.add(this.frameOf(this.partial.slice(0, this.filled)), () => false);
      this.filled = 0;
    }
    const enough = this.voicedFrames * FRAME_MS >= this.options.minVoicedMs;
    const segment = enough ? this.cut(this.frames.length - this.excessTail(), false) : null;
    this.frames = [];
    this.voicedFrames = 0;
    this.trailingSilent = 0;
    return segment;
  }

  private frameOf(samples: Float32Array): Frame {
    const rms = rmsOf(samples);
    const voiced = rms > Math.max(this.noise * VOICE_OVER_NOISE, VOICE_FLOOR);
    this.noise = voiced ? this.noise * 0.998 + Math.min(rms, this.noise * 2) * 0.002 : this.noise * 0.95 + rms * 0.05;
    this.noise = Math.min(NOISE_MAX, Math.max(NOISE_MIN, this.noise));
    return { samples, rms, voiced };
  }

  private excessTail(): number {
    return Math.max(0, this.trailingSilent - Math.round(this.options.tailMs / FRAME_MS));
  }

  private add(frame: Frame, mayCut: () => boolean): SpeechSegment | null {
    this.frames.push(frame);
    if (frame.voiced) {
      this.voicedFrames++;
      this.trailingSilent = 0;
    } else {
      this.trailingSilent++;
    }
    if (!this.voicedFrames) {
      this.trimToLead();
      return null;
    }
    const { pauseMs, minSpeechMs, maxSegmentMs, minVoicedMs, dropAfterMs } = this.options;
    const silenceMs = this.trailingSilent * FRAME_MS;
    if (this.voicedFrames * FRAME_MS < minVoicedMs) {
      if (silenceMs >= dropAfterMs) {
        this.voicedFrames = 0;
        this.trimToLead();
      }
      return null;
    }
    const speechMs = (this.frames.length - this.trailingSilent) * FRAME_MS;
    if (silenceMs >= pauseMs && speechMs >= minSpeechMs && mayCut()) return this.cut(this.frames.length - this.excessTail(), false);
    if (this.frames.length * FRAME_MS >= maxSegmentMs) return this.cut(this.quietestSplit(), true);
    return null;
  }

  private quietestSplit(): number {
    const from = Math.max(1, this.frames.length - Math.round(FORCED_SEARCH_MS / FRAME_MS));
    let quietest = this.frames.length - 1;
    for (let i = from; i < this.frames.length; i++) if (this.frames[i]!.rms < this.frames[quietest]!.rms) quietest = i;
    return quietest + 1;
  }

  private trimToLead() {
    const keep = Math.round(this.options.leadMs / FRAME_MS);
    if (this.frames.length > keep) this.frames = this.frames.slice(this.frames.length - keep);
  }

  private cut(end: number, forced: boolean): SpeechSegment {
    const taken = this.frames.slice(0, end);
    this.frames = this.frames.slice(end);
    this.voicedFrames = this.frames.filter((f) => f.voiced).length;
    let trailing = 0;
    for (let i = this.frames.length - 1; i >= 0 && !this.frames[i]!.voiced; i--) trailing++;
    this.trailingSilent = trailing;
    if (!this.voicedFrames) this.trimToLead();
    return {
      samples: concatSamples(taken.map((f) => f.samples)),
      durationMs: taken.length * FRAME_MS,
      voicedMs: taken.filter((f) => f.voiced).length * FRAME_MS,
      forced,
    };
  }
}
