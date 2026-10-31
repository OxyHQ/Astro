import { type IntroCues, synthesize } from "./synth";

self.onmessage = ({ data }: MessageEvent<Partial<IntroCues>>) => {
  const audio = synthesize(data);
  (self as unknown as Worker).postMessage(audio, [audio.left.buffer, audio.right.buffer]);
};
