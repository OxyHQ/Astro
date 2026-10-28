import { AliaApiError } from "@alia.onl/sdk/runtime";
import type { AliaRest, AliaResult } from "./api";

type LinkedClient = {
  client: {
    requestAuthenticatedResponse(config: { method: "PUT"; url: string; body?: string; headers?: Record<string, string> }): Promise<Response>;
  };
  dispose(): void;
};

export type LinkableOxy = { createLinkedClient(config: { baseURL: string }): LinkedClient };

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function aliaPut(oxy: LinkableOxy, apiUrl: string): AliaRest["put"] {
  return async <T,>(path: string, body?: unknown): Promise<AliaResult<T>> => {
    const linked = oxy.createLinkedClient({ baseURL: apiUrl });
    try {
      const response = await linked.client.requestAuthenticatedResponse({
        method: "PUT",
        url: path,
        body: JSON.stringify(body ?? {}),
        headers: { "Content-Type": "application/json" },
      });
      const data = await readBody(response);
      if (!response.ok) throw new AliaApiError(response.status, data);
      return { status: response.status, data: data as T };
    } finally {
      linked.dispose();
    }
  };
}
