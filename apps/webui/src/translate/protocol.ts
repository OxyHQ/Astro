// Copyright 2026 Oxy. Apache-2.0.

import type { ModelFileType } from "./bergamot";

export type WorkerModel = { source: string; target: string; modelName: string; files: Partial<Record<ModelFileType, ArrayBuffer>> };

export type WorkerRequest =
  | { type: "init"; glue: string; wasm: ArrayBuffer; models: WorkerModel[] }
  | { type: "translate"; id: number; texts: string[] }
  | { type: "blocks"; id: number; blocks: string[][] };

export type WorkerReply =
  | { type: "ready" }
  | { type: "failed"; message: string }
  | { type: "result"; id: number; texts: (string | null)[] }
  | { type: "blocks"; id: number; blocks: (string[] | null)[] }
  | { type: "error"; id: number; message: string };
