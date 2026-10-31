// Copyright 2026 Oxy. Apache-2.0.

import { type LanguageModel, type LoadBergamot, type ModelFiles, startBergamot, Translator } from "./bergamot";
import type { WorkerModel, WorkerReply, WorkerRequest } from "./protocol";

declare function importScripts(...urls: string[]): void;

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerReply): void;
  loadBergamot?: LoadBergamot;
};

const scope = self as unknown as WorkerScope;
let translator: Promise<Translator> | null = null;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "the translator failed");

const languageModel = ({ source, target, modelName, files }: WorkerModel): LanguageModel => ({
  source,
  target,
  modelName,
  files: files as ModelFiles,
});

async function start(glue: string, wasm: ArrayBuffer, models: WorkerModel[]): Promise<Translator> {
  importScripts(glue);
  const load = scope.loadBergamot;
  if (!load) throw new Error("the translator didn't load");
  return new Translator(await startBergamot(load, wasm), models.map(languageModel));
}

scope.onmessage = ({ data }) => {
  if (data.type === "init") {
    translator = start(data.glue, data.wasm, data.models);
    translator.then(
      () => scope.postMessage({ type: "ready" }),
      (error: unknown) => scope.postMessage({ type: "failed", message: messageOf(error) }),
    );
    return;
  }
  const pending = translator;
  if (!pending) return scope.postMessage({ type: "error", id: data.id, message: "the translator isn't ready" });
  void pending
    .then((ready) => {
      if (data.type === "translate") scope.postMessage({ type: "result", id: data.id, texts: ready.translate(data.texts) });
      else scope.postMessage({ type: "blocks", id: data.id, blocks: ready.translateBlocks(data.blocks) });
    })
    .catch((error: unknown) => scope.postMessage({ type: "error", id: data.id, message: messageOf(error) }));
};
