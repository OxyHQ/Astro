import { chatItemId, type ChatContextItem } from "../../ai/chat/state";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  md: "text/markdown",
  txt: "text/plain",
  json: "application/json",
};

export function mimeOf(name: string, type: string): string {
  if (type && type !== "application/octet-stream") return type;
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return (extension && MIME_BY_EXTENSION[extension]) || type || "application/octet-stream";
}

export async function fileItems(files: readonly File[]): Promise<ChatContextItem[]> {
  const usable = files.filter((file) => file.size <= MAX_ATTACHMENT_BYTES).slice(0, 10);
  return Promise.all(
    usable.map(async (file) => ({
      id: chatItemId("file"),
      kind: "file" as const,
      name: file.name || "Pasted image",
      mime: mimeOf(file.name, file.type),
      uri: await readFileAsDataUrl(file),
      size: file.size,
    })),
  );
}

export function pickChatFiles(): Promise<ChatContextItem[]> {
  if (typeof document === "undefined") return Promise.resolve([]);
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      void fileItems(files).then(resolve, () => resolve([]));
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });
    document.body.appendChild(input);
    input.click();
  });
}

const SINGLE_URL = /^https?:\/\/[^\s<>"']+$/i;

export function pastedLink(text: string): string | null {
  const trimmed = text.trim();
  if (!SINGLE_URL.test(trimmed)) return null;
  try {
    return new URL(trimmed).href;
  } catch {
    return null;
  }
}
