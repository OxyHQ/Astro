import { copyText } from "@astro-browser/shell";
import { alia } from "../../ai/alia/api";
import { artifactMarkdown, type Artifact } from "../../ai/artifacts/artifacts";
import { ARTIFACT_STYLE, artifactBodyHtml, artifactHtml } from "../../ai/artifacts/html";
import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";

const hasDom = () => typeof document !== "undefined" && typeof Image !== "undefined";

export const exportsAvailable = hasDom;

const fileName = (title: string, ext: string) => `${title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Artifact"}.${ext}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const IMAGE_WIDTH = 900;

function xhtmlOf(artifact: Artifact): { markup: string; height: number } {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${IMAGE_WIDTH}px;opacity:0;pointer-events:none;`;
  const root = host.attachShadow({ mode: "open" });
  const style = ARTIFACT_STYLE.replace(/body\{/g, ".page{");
  root.innerHTML = `<style>${style}</style><div class="page" style="margin:0;max-width:none;background:#fff">${artifactBodyHtml(artifact)}</div>`;
  document.body.appendChild(host);
  const page = root.querySelector(".page") as HTMLElement;
  const height = Math.ceil(page.getBoundingClientRect().height);
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.innerHTML = root.innerHTML;
  const markup = new XMLSerializer().serializeToString(wrapper);
  host.remove();
  return { markup, height: Math.max(200, height) };
}

export async function artifactPng(artifact: Artifact, scale = 2): Promise<Blob> {
  const { markup, height } = xhtmlOf(artifact);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`;
  const image = new Image();
  image.decoding = "sync";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The image couldn't be drawn."));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The image couldn't be made."))), "image/png"));
}

export async function saveArtifactImage(artifact: Artifact) {
  download(await artifactPng(artifact), fileName(artifact.title, "png"));
}

export async function copyArtifactImage(artifact: Artifact) {
  const blob = await artifactPng(artifact);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function saveArtifactHtml(artifact: Artifact) {
  download(new Blob([artifactHtml(artifact)], { type: "text/html" }), fileName(artifact.title, "html"));
}

export function saveArtifactMarkdown(artifact: Artifact) {
  download(new Blob([artifactMarkdown(artifact)], { type: "text/markdown" }), fileName(artifact.title, "md"));
}

export const copyArtifactMarkdown = (artifact: Artifact) => copyText(artifactMarkdown(artifact));

const PRINT_WAIT_MS = 15_000;

export async function printArtifact(windowId: string, artifact: Artifact): Promise<boolean> {
  const url = `data:text/html;charset=utf-8,${encodeURIComponent(artifactHtml(artifact))}`;
  const s = useBrowser.getState();
  const tabId = s.newTab(windowId, { url });
  if (!tabId) return false;
  const deadline = Date.now() + PRINT_WAIT_MS;
  while (Date.now() < deadline) {
    const web = webviews.get(tabId);
    const live = useBrowser.getState().live?.[tabId];
    if (web && live && !live.isLoading) {
      await web.print();
      return true;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

export async function shareConversationLink(conversationId: string): Promise<string> {
  const r = await alia().post<{ token?: string; url?: string }>(`/v1/conversations/${encodeURIComponent(conversationId)}/share`, { ttlHours: 168 });
  const url = r.data.url ?? (r.data.token ? `https://alia.onl/shared/${r.data.token}` : "");
  if (!url) throw new Error("No link came back.");
  await copyText(url);
  return url;
}
