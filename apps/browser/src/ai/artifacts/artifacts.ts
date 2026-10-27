import { create } from "zustand";

export type Slide = { title: string; subtitle?: string; bullets?: string[]; body?: string; notes?: string; image?: string };

export type ChartData = { chartType: "bar" | "line" | "pie"; labels: string[]; datasets: { label: string; values: number[] }[] };

export type Widget =
  | { kind: "stat"; label: string; value: string; delta?: string }
  | ({ kind: "chart"; title?: string } & ChartData)
  | { kind: "table"; title?: string; headers: string[]; rows: string[][] }
  | { kind: "text"; title?: string; content: string };

export type ArtifactBody =
  | { kind: "report"; markdown: string }
  | { kind: "deck"; slides: Slide[] }
  | { kind: "dashboard"; widgets: Widget[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "code"; language: string; code: string };

export type ArtifactKind = ArtifactBody["kind"];

export type Artifact = { id: string; title: string; body: ArtifactBody };

export type StoredArtifact = Artifact & { conversationId: string; order: number };

type ToolLike = { toolCallId: string; toolName: string; state?: string; args?: unknown; result?: unknown };

const MAX_ROWS = 500;
const MAX_SLIDES = 60;
const MAX_WIDGETS = 40;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "");

const cell = (value: unknown): string => (value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : text(value));

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(cell) : []);

function rowsOf(value: unknown, width: number): string[][] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ROWS).map((row) => {
    const cells = Array.isArray(row) ? row.map(cell) : record(row) ? Object.values(row as Record<string, unknown>).map(cell) : [cell(row)];
    while (cells.length < width) cells.push("");
    return cells.slice(0, Math.max(width, 1));
  });
}

function tableOf(data: Record<string, unknown>): { headers: string[]; rows: string[][] } | null {
  let headers = strings(data.headers ?? data.columns);
  const raw = data.rows ?? data.data;
  if (!headers.length && Array.isArray(raw) && record(raw[0])) headers = Object.keys(raw[0] as Record<string, unknown>);
  const rows = rowsOf(raw, headers.length);
  if (!headers.length && !rows.length) return null;
  return { headers, rows };
}

const finite = (value: unknown) => {
  const n = typeof value === "string" ? Number(value.replace(/[^0-9.+-eE]/g, "")) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

function chartOf(data: Record<string, unknown>): ChartData | null {
  const type = text(data.chartType ?? data.type);
  const chartType = type === "line" || type === "pie" ? type : "bar";
  const labels = strings(data.labels).slice(0, 200);
  if (!labels.length || !Array.isArray(data.datasets)) return null;
  const datasets = data.datasets.slice(0, 12).flatMap((d) => {
    const set = record(d);
    if (!set || !Array.isArray(set.values ?? set.data)) return [];
    const values = (set.values ?? set.data) as unknown[];
    return [{ label: text(set.label), values: labels.map((_, i) => finite(values[i])) }];
  });
  return datasets.length ? { chartType, labels, datasets } : null;
}

function slidesOf(value: unknown): Slide[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SLIDES).flatMap((s): Slide[] => {
    const slide = record(s);
    if (!slide) return typeof s === "string" ? [{ title: s }] : [];
    const out: Slide = { title: text(slide.title) || text(slide.heading) };
    if (text(slide.subtitle)) out.subtitle = text(slide.subtitle);
    const bullets = strings(slide.bullets ?? slide.points).filter(Boolean);
    if (bullets.length) out.bullets = bullets;
    if (text(slide.body ?? slide.content)) out.body = text(slide.body ?? slide.content);
    if (text(slide.notes)) out.notes = text(slide.notes);
    if (/^https:\/\//.test(text(slide.image))) out.image = text(slide.image);
    return out.title || out.body || out.bullets ? [out] : [];
  });
}

export function slidesFromMarkdown(markdown: string): Slide[] {
  return markdown
    .split(/\n-{3,}\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const heading = lines.findIndex((l) => /^#{1,3}\s/.test(l));
      const title = heading >= 0 ? lines[heading]!.replace(/^#{1,3}\s+/, "") : "";
      const rest = lines.filter((_, i) => i !== heading);
      const bullets = rest.filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, ""));
      const body = rest.filter((l) => !/^\s*[-*]\s+/.test(l)).join("\n").trim();
      return { title, ...(bullets.length ? { bullets } : {}), ...(body ? { body } : {}) };
    })
    .slice(0, MAX_SLIDES);
}

function widgetsOf(value: unknown): Widget[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_WIDGETS).flatMap((w): Widget[] => {
    const widget = record(w);
    if (!widget) return [];
    const title = text(widget.title);
    switch (text(widget.kind ?? widget.type)) {
      case "stat":
      case "metric":
      case "kpi": {
        const delta = text(widget.delta ?? widget.change);
        return [{ kind: "stat", label: text(widget.label) || title, value: text(widget.value), ...(delta ? { delta } : {}) }];
      }
      case "chart": {
        const chart = chartOf(record(widget.data) ?? widget);
        return chart ? [{ kind: "chart", ...(title ? { title } : {}), ...chart }] : [];
      }
      case "table": {
        const table = tableOf(record(widget.data) ?? widget);
        return table ? [{ kind: "table", ...(title ? { title } : {}), ...table }] : [];
      }
      case "text":
      case "markdown":
        return [{ kind: "text", ...(title ? { title } : {}), content: text(widget.content ?? widget.text ?? widget.body) }];
      default:
        return [];
    }
  });
}

export function bodyOfCanvas(type: string, data: unknown): ArtifactBody | null {
  const d = record(data) ?? (typeof data === "string" ? { content: data } : null);
  if (!d) return null;
  switch (type) {
    case "markdown":
    case "report":
    case "document": {
      const markdown = text(d.content ?? d.markdown ?? d.text);
      return markdown.trim() ? { kind: "report", markdown } : null;
    }
    case "artifact": {
      const content = text(d.content);
      const language = text(d.language).toLowerCase();
      if (!content.trim()) return null;
      if (!language || language === "markdown" || language === "md") return { kind: "report", markdown: content };
      return { kind: "code", language, code: content };
    }
    case "code": {
      const code = text(d.code ?? d.content);
      return code.trim() ? { kind: "code", language: text(d.language).toLowerCase(), code } : null;
    }
    case "table": {
      const table = tableOf(d);
      return table ? { kind: "table", ...table } : null;
    }
    case "deck":
    case "slides": {
      const slides = Array.isArray(d.slides) ? slidesOf(d.slides) : slidesFromMarkdown(text(d.content ?? d.markdown));
      return slides.length ? { kind: "deck", slides } : null;
    }
    case "dashboard": {
      const widgets = widgetsOf(d.widgets);
      return widgets.length ? { kind: "dashboard", widgets } : null;
    }
    default:
      return null;
  }
}

export function artifactOfTool(tool: ToolLike): Artifact | null {
  if (tool.state === "partial-call" || tool.state === "call") return null;
  if (tool.toolName === "canvas") {
    const block = record(tool.result) ?? record(tool.args);
    if (!block) return null;
    const body = bodyOfCanvas(text(block.type), block.data);
    if (!body) return null;
    return { id: tool.toolCallId, title: text(block.title) || defaultTitle(body.kind), body };
  }
  if (tool.toolName === "generateFile") {
    const file = record(tool.result);
    if (!file) return null;
    const content = text(file.content);
    if (!content.trim()) return null;
    const language = text(file.language).toLowerCase();
    const title = text(file.filename) || text(file.title) || "Generated file";
    const body: ArtifactBody = !language || language === "markdown" || language === "md" ? { kind: "report", markdown: content } : { kind: "code", language, code: content };
    return { id: tool.toolCallId, title, body };
  }
  return null;
}

export const artifactsOfTools = (tools: readonly ToolLike[]): Artifact[] => tools.flatMap((t) => artifactOfTool(t) ?? []);

export function defaultTitle(kind: ArtifactKind): string {
  return { report: "Report", deck: "Deck", dashboard: "Dashboard", table: "Table", code: "Code" }[kind];
}

export const KIND_LABEL: Record<ArtifactKind, string> = { report: "Report", deck: "Deck", dashboard: "Dashboard", table: "Table", code: "Code" };

export const KIND_ICON: Record<ArtifactKind, string> = {
  report: "doc.text",
  deck: "rectangle.stack",
  dashboard: "chart.bar",
  table: "list.bullet",
  code: "chevron.left.forwardslash.chevron.right",
};

type MessageLike = { id: string; role: string; toolInvocations?: readonly ToolLike[] };

type ArtifactsState = { byId: Record<string, StoredArtifact>; loading: Record<string, true> };

export const useArtifacts = create<ArtifactsState>()(() => ({ byId: {}, loading: {} }));

export const artifactKey = (conversationId: string, id: string) => `${conversationId}:${id}`;

export function rememberArtifacts(conversationId: string, messages: readonly MessageLike[]) {
  let order = 0;
  const found: StoredArtifact[] = [];
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    for (const a of artifactsOfTools(m.toolInvocations ?? [])) found.push({ ...a, conversationId, order: order++ });
  }
  if (!found.length) return;
  useArtifacts.setState((s) => {
    let changed = false;
    const byId = { ...s.byId };
    for (const a of found) {
      const key = artifactKey(conversationId, a.id);
      const was = byId[key];
      if (was && was.order === a.order && was.title === a.title && JSON.stringify(was.body) === JSON.stringify(a.body)) continue;
      byId[key] = a;
      changed = true;
    }
    return changed ? { byId } : s;
  });
}

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function versionsOf(all: Record<string, StoredArtifact>, conversationId: string, id: string): StoredArtifact[] {
  const me = all[artifactKey(conversationId, id)];
  if (!me) return [];
  return Object.values(all)
    .filter((a) => a.conversationId === conversationId && a.body.kind === me.body.kind && sameTitle(a.title, me.title))
    .sort((a, b) => a.order - b.order);
}

export function conversationArtifacts(all: Record<string, StoredArtifact>, conversationId: string): StoredArtifact[] {
  const latest = new Map<string, StoredArtifact>();
  for (const a of Object.values(all)) {
    if (a.conversationId !== conversationId) continue;
    const key = `${a.body.kind}:${a.title.trim().toLowerCase()}`;
    const was = latest.get(key);
    if (!was || was.order < a.order) latest.set(key, a);
  }
  return [...latest.values()].sort((a, b) => a.order - b.order);
}

const SCHEME = "astro://artifact";

export const artifactUrl = (conversationId: string, id: string) => `${SCHEME}?c=${encodeURIComponent(conversationId)}&id=${encodeURIComponent(id)}`;

export function parseArtifactUrl(url: string): { conversationId: string; id: string } | null {
  if (!url.toLowerCase().startsWith(SCHEME)) return null;
  const q = url.slice(url.indexOf("?") + 1);
  const params = new URLSearchParams(url.includes("?") ? q : "");
  const conversationId = params.get("c");
  const id = params.get("id");
  return conversationId && id ? { conversationId, id } : null;
}

export type ArtifactComment = { id: string; quote: string; text: string };

export function revisionRequest(artifact: Artifact, comments: ArtifactComment[]): { prompt: string; context: string[] } {
  const numbered = comments.map((c, i) => `${i + 1}. ${c.quote ? `On “${c.quote.replace(/\s+/g, " ").slice(0, 300)}”: ` : ""}${c.text.trim()}`);
  return {
    prompt: [`Revise the ${KIND_LABEL[artifact.body.kind].toLowerCase()} “${artifact.title}” with my ${comments.length === 1 ? "comment" : `${comments.length} comments`}:`, ...numbered].join("\n"),
    context: [
      `## The ${KIND_LABEL[artifact.body.kind].toLowerCase()} to revise`,
      `Make the new version with the canvas tool, type "${canvasTypeOf(artifact.body.kind)}" and the same title “${artifact.title}”, so it replaces this one in Astro. Apply every comment, keep everything else as it is, and say in one or two sentences what changed.`,
      "The current version, as the canvas tool's data:",
      `<<<\n${JSON.stringify(canvasDataOf(artifact.body)).slice(0, 40_000)}\n>>>`,
    ],
  };
}

export function canvasTypeOf(kind: ArtifactKind): string {
  return kind === "report" ? "markdown" : kind;
}

export function canvasDataOf(body: ArtifactBody): unknown {
  switch (body.kind) {
    case "report":
      return { content: body.markdown };
    case "deck":
      return { slides: body.slides };
    case "dashboard":
      return { widgets: body.widgets };
    case "table":
      return { headers: body.headers, rows: body.rows };
    case "code":
      return { language: body.language, code: body.code };
  }
}

export function artifactMarkdown(artifact: Artifact): string {
  const b = artifact.body;
  const table = (headers: string[], rows: string[][]) =>
    [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`)].join("\n");
  switch (b.kind) {
    case "report":
      return b.markdown.trimStart().startsWith("#") ? b.markdown : `# ${artifact.title}\n\n${b.markdown}`;
    case "deck":
      return b.slides
        .map((s) => [`## ${s.title}`, s.subtitle ? `_${s.subtitle}_` : "", ...(s.bullets ?? []).map((x) => `- ${x}`), s.body ?? "", s.notes ? `> Notes: ${s.notes}` : ""].filter(Boolean).join("\n\n"))
        .join("\n\n---\n\n");
    case "dashboard":
      return [
        `# ${artifact.title}`,
        ...b.widgets.map((w) => {
          switch (w.kind) {
            case "stat":
              return `**${w.label}:** ${w.value}${w.delta ? ` (${w.delta})` : ""}`;
            case "chart":
              return `### ${w.title || "Chart"}\n\n${table(["", ...w.datasets.map((d) => d.label)], w.labels.map((l, i) => [l, ...w.datasets.map((d) => String(d.values[i] ?? ""))]))}`;
            case "table":
              return `${w.title ? `### ${w.title}\n\n` : ""}${table(w.headers, w.rows)}`;
            case "text":
              return `${w.title ? `### ${w.title}\n\n` : ""}${w.content}`;
          }
        }),
      ].join("\n\n");
    case "table":
      return `# ${artifact.title}\n\n${table(b.headers, b.rows)}`;
    case "code":
      return `\`\`\`${b.language}\n${b.code}\n\`\`\``;
  }
}

export function rememberLiveArtifact(conversationId: string, artifact: Artifact): StoredArtifact {
  const all = useArtifacts.getState().byId;
  const key = artifactKey(conversationId, artifact.id);
  const known = all[key];
  if (known) return known;
  const order = Math.max(-1, ...Object.values(all).filter((a) => a.conversationId === conversationId).map((a) => a.order)) + 1;
  const stored = { ...artifact, conversationId, order };
  useArtifacts.setState((s) => ({ byId: { ...s.byId, [key]: stored } }));
  return stored;
}
