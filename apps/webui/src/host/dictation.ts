import { DICTATION_SAMPLE_RATE } from "../../../browser/src/ai/dictation/audio";
import {
  DictationCaptureError,
  dictationAvailable,
  dictationFieldAt,
  pressDictation,
  registerDictationCapture,
  releaseDictation,
  type DictationCapture,
} from "../../../browser/src/ai/dictation/dictation";

const WORKLET = "dictation-worklet.js";
const TAP = "astro-dictation-tap";

const microphone: DictationCapture = {
  async open(onAudio) {
    if (!navigator.mediaDevices?.getUserMedia) throw new DictationCaptureError("mic-unavailable");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      throw new DictationCaptureError(name === "NotAllowedError" || name === "SecurityError" ? "mic-denied" : "mic-unavailable");
    }
    const context = new AudioContext({ sampleRate: DICTATION_SAMPLE_RATE, latencyHint: "interactive" });
    const stop = () => {
      for (const track of stream.getTracks()) track.stop();
      void context.close().catch(() => {});
    };
    try {
      await context.audioWorklet.addModule(new URL(WORKLET, document.baseURI).href);
      const source = context.createMediaStreamSource(stream);
      const tap = new AudioWorkletNode(context, TAP, { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: "explicit" });
      tap.port.onmessage = (event: MessageEvent<Float32Array>) => onAudio(event.data);
      source.connect(tap);
      if (context.state !== "running") await context.resume();
      return {
        close: () => {
          tap.port.onmessage = null;
          source.disconnect();
          stop();
        },
      };
    } catch {
      stop();
      throw new DictationCaptureError("mic-unavailable");
    }
  },
};

const holdsDictation = (event: KeyboardEvent) => event.code === "Space" && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;

export function startDictationCapture() {
  registerDictationCapture(microphone);
  let held: string | null = null;
  const release = () => {
    const key = held;
    held = null;
    if (key) releaseDictation(key);
  };
  window.addEventListener(
    "keydown",
    (event) => {
      if (!holdsDictation(event)) return;
      const field = dictationFieldAt(document.activeElement);
      if (!field || !dictationAvailable()) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat || held) return;
      held = field.key;
      pressDictation(field.key, field.begin);
    },
    true,
  );
  window.addEventListener(
    "keyup",
    (event) => {
      if (held && (event.code === "Space" || event.key === "Control" || event.key === "Shift")) release();
    },
    true,
  );
  window.addEventListener("blur", release);
}
