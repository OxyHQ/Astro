import { create } from "zustand";
import { useOxySession } from "../../oxy/session";

export type AliaResult<T> = { status: number; data: T };

export type AliaRest = {
  get<T>(path: string, request?: { params?: Record<string, string | number | undefined> }): Promise<AliaResult<T>>;
  post<T>(path: string, body?: unknown): Promise<AliaResult<T>>;
  patch<T>(path: string, body?: unknown): Promise<AliaResult<T>>;
  delete<T>(path: string): Promise<AliaResult<T>>;
};

type AliaApiState = { api: AliaRest | null };

export const useAliaRest = create<AliaApiState>()(() => ({ api: null }));

const registered: { api: AliaRest }[] = [];

export function registerAliaApi(api: AliaRest): () => void {
  const entry = { api };
  registered.push(entry);
  useAliaRest.setState({ api });
  return () => {
    const index = registered.indexOf(entry);
    if (index < 0) return;
    registered.splice(index, 1);
    useAliaRest.setState({ api: registered.at(-1)?.api ?? null });
  };
}

export const aliaReady = () => !!useAliaRest.getState().api && !!useOxySession.getState().account;

export const useAliaReady = () => {
  const api = useAliaRest((s) => !!s.api);
  const account = useOxySession((s) => s.account?.id ?? null);
  return api && !!account ? account : null;
};

export class AliaUnavailable extends Error {
  constructor() {
    super("Sign in with Oxy to use Alia.");
    this.name = "AliaUnavailable";
  }
}

export function alia(): AliaRest {
  const api = useAliaRest.getState().api;
  if (!api || !useOxySession.getState().account) throw new AliaUnavailable();
  return api;
}

export function aliaErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AliaUnavailable) return error.message;
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (data && typeof data === "object") {
    const e = (data as { error?: unknown; message?: unknown }).error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") return (e as { message: string }).message;
    if (typeof (data as { message?: unknown }).message === "string") return (data as { message: string }).message;
  }
  return fallback;
}
