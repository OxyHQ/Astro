import type { Artifact, ChartData, Slide, Widget } from "./artifacts";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text: string): string {
  return escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

const tableRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

export function markdownHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i++]!);
      i++;
      out.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      out.push(`<h${heading[1]!.length}>${inline(heading[2]!)}</h${heading[1]!.length}>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1]!)) {
      const head = tableRow(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]!)) body.push(tableRow(lines[i++]!));
      out.push(
        `<table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, ""));
      out.push(`<${ordered ? "ol" : "ul"}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) quote.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|\s*([-*]|\d+\.)\s+|>|\s*\|)/.test(lines[i]!)) para.push(lines[i++]!);
    if (!para.length) para.push(lines[i++]!);
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

const PALETTE = ["#7C5CFC", "#2BB673", "#F5A524", "#E5484D", "#3E8EF7", "#A1A1AA"];

export function chartSvg(chart: ChartData, width = 640, height = 260): string {
  const max = Math.max(1, ...chart.datasets.flatMap((d) => d.values));
  if (chart.chartType === "pie") {
    const values = chart.datasets[0]?.values ?? [];
    const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    let angle = -Math.PI / 2;
    const r = Math.min(width, height) / 2 - 10;
    const cx = r + 10;
    const cy = height / 2;
    const slices = values.map((v, i) => {
      const a = (Math.max(0, v) / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += a;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      return `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${PALETTE[i % PALETTE.length]}"/>`;
    });
    const legend = chart.labels.map(
      (l, i) => `<rect x="${2 * r + 40}" y="${20 + i * 20}" width="10" height="10" fill="${PALETTE[i % PALETTE.length]}"/><text x="${2 * r + 56}" y="${29 + i * 20}" font-size="12">${escape(l)}</text>`,
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${slices.join("")}${legend.join("")}</svg>`;
  }
  const left = 36;
  const bottom = 24;
  const plotW = width - left - 8;
  const plotH = height - bottom - 8;
  const step = plotW / Math.max(1, chart.labels.length);
  const y = (v: number) => 8 + plotH - (Math.max(0, v) / max) * plotH;
  const axis = `<line x1="${left}" y1="${8 + plotH}" x2="${width - 8}" y2="${8 + plotH}" stroke="#999"/><text x="4" y="16" font-size="11" fill="#666">${max}</text>`;
  const labels = chart.labels.map((l, i) => `<text x="${(left + step * i + step / 2).toFixed(1)}" y="${height - 6}" font-size="11" text-anchor="middle" fill="#666">${escape(l.slice(0, 12))}</text>`);
  const marks = chart.datasets.map((d, s) => {
    const color = PALETTE[s % PALETTE.length];
    if (chart.chartType === "line")
      return `<polyline fill="none" stroke="${color}" stroke-width="2" points="${d.values.map((v, i) => `${(left + step * i + step / 2).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`;
    const bw = (step * 0.7) / chart.datasets.length;
    return d.values
      .map((v, i) => `<rect x="${(left + step * i + step * 0.15 + bw * s).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(8 + plotH - y(v)).toFixed(1)}" fill="${color}"/>`)
      .join("");
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${axis}${labels.join("")}${marks.join("")}</svg>`;
}

const tableHtml = (headers: string[], rows: string[][]) =>
  `<table>${headers.length ? `<thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escape(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

const slideHtml = (s: Slide, i: number) =>
  `<section class="slide"><div class="num">${i + 1}</div><h2>${escape(s.title)}</h2>${s.subtitle ? `<p class="sub">${escape(s.subtitle)}</p>` : ""}${s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>` : ""}${s.body ? markdownHtml(s.body) : ""}${s.notes ? `<aside>${escape(s.notes)}</aside>` : ""}</section>`;

function widgetHtml(w: Widget): string {
  switch (w.kind) {
    case "stat":
      return `<div class="stat"><div class="label">${escape(w.label)}</div><div class="value">${escape(w.value)}</div>${w.delta ? `<div class="delta">${escape(w.delta)}</div>` : ""}</div>`;
    case "chart":
      return `<div class="card wide">${w.title ? `<h3>${escape(w.title)}</h3>` : ""}${chartSvg(w)}</div>`;
    case "table":
      return `<div class="card wide">${w.title ? `<h3>${escape(w.title)}</h3>` : ""}${tableHtml(w.headers, w.rows)}</div>`;
    case "text":
      return `<div class="card wide">${w.title ? `<h3>${escape(w.title)}</h3>` : ""}${markdownHtml(w.content)}</div>`;
  }
}

const STYLE = `
body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;color:#1c1b1f;background:#fff;margin:0;padding:40px;max-width:860px;margin:auto}
h1{font-size:28px;margin:0 0 16px}h2{font-size:21px;margin:28px 0 10px}h3{font-size:16px;margin:0 0 8px}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #e3e1e6;padding:6px 10px;text-align:left}th{background:#f6f5f8}
pre{background:#f6f5f8;padding:12px;border-radius:8px;overflow:auto}code{font:13px ui-monospace,Menlo,Consolas,monospace}
blockquote{border-left:3px solid #d0cdd6;margin:12px 0;padding-left:12px;color:#55525c}
.slide{position:relative;aspect-ratio:16/9;border:1px solid #e3e1e6;border-radius:12px;padding:40px 48px;margin:0 0 24px;box-sizing:border-box;page-break-after:always;break-after:page;overflow:hidden}
.slide h2{font-size:30px;margin:0 0 12px}.slide .sub{font-size:18px;color:#55525c}.slide li{font-size:18px;margin:6px 0}.slide aside{display:none}.num{position:absolute;right:20px;bottom:14px;color:#999;font-size:12px}
.grid{display:flex;flex-wrap:wrap;gap:14px}.stat,.card{border:1px solid #e3e1e6;border-radius:12px;padding:14px 16px;box-sizing:border-box}.stat{flex:1 1 160px}.wide{flex:1 1 100%}
.stat .label{color:#55525c;font-size:13px}.stat .value{font-size:26px;font-weight:600}.stat .delta{color:#2bb673;font-size:13px}
@media print{body{padding:0}.slide{border:none;border-radius:0}}
`;

export function artifactBodyHtml(artifact: Artifact): string {
  const b = artifact.body;
  switch (b.kind) {
    case "report":
      return (b.markdown.trimStart().startsWith("# ") ? "" : `<h1>${escape(artifact.title)}</h1>`) + markdownHtml(b.markdown);
    case "deck":
      return b.slides.map(slideHtml).join("");
    case "dashboard":
      return `<h1>${escape(artifact.title)}</h1><div class="grid">${b.widgets.map(widgetHtml).join("")}</div>`;
    case "table":
      return `<h1>${escape(artifact.title)}</h1>${tableHtml(b.headers, b.rows)}`;
    case "code":
      return `<h1>${escape(artifact.title)}</h1><pre><code>${escape(b.code)}</code></pre>`;
  }
}

export function artifactHtml(artifact: Artifact): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="generator" content="Astro"><title>${escape(artifact.title)}</title><style>${STYLE}</style></head><body>${artifactBodyHtml(artifact)}</body></html>`;
}

export const ARTIFACT_STYLE = STYLE;
