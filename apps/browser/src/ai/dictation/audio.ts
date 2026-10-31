export const DICTATION_SAMPLE_RATE = 16_000;
export const FRAME_MS = 20;
export const FRAME_SAMPLES = (DICTATION_SAMPLE_RATE * FRAME_MS) / 1000;

const QUIET_DB = -60;
const LOUD_DB = -12;

export function rmsOf(samples: Float32Array, start = 0, end = samples.length): number {
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / (end - start));
}

export function levelOf(rms: number): number {
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - QUIET_DB) / (LOUD_DB - QUIET_DB)));
}

export function concatSamples(chunks: readonly Float32Array[]): Float32Array {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const out = new Float32Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate = DICTATION_SAMPLE_RATE): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return bytes;
}

export const STREAM_SAMPLE_RATE = 24_000;

export class Upsampler {
  private carry: number | null = null;
  private produced = 0;
  private consumed = 0;

  push(samples: Float32Array): Uint8Array<ArrayBuffer> {
    const out: number[] = [];
    const sampleAt = (index: number) => (index < this.consumed ? (this.carry ?? samples[0]!) : samples[index - this.consumed]!);
    for (;;) {
      const scaled = this.produced * DICTATION_SAMPLE_RATE;
      const index = Math.floor(scaled / STREAM_SAMPLE_RATE);
      if (index + 1 > this.consumed + samples.length - 1) break;
      const fraction = (scaled % STREAM_SAMPLE_RATE) / STREAM_SAMPLE_RATE;
      const before = sampleAt(index);
      out.push(before + (sampleAt(index + 1) - before) * fraction);
      this.produced++;
    }
    if (samples.length > 0) {
      this.consumed += samples.length;
      this.carry = samples[samples.length - 1]!;
    }
    const bytes = new Uint8Array(out.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < out.length; i++) {
      const clamped = Math.max(-1, Math.min(1, out[i]!));
      view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    }
    return bytes;
  }
}
