import { useCallback, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export interface SparkChartProps {
  data: number[];
  color?: string;
  height?: number;
  onScrub?: (index: number | null) => void;
  className?: string;
  label?: string;
}

const VW = 400;
const PAD_T = 6;
const PAD_B = 3;

function points(data: number[], h: number) {
  const n = data.length;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  return data.map((v, i) => ({
    x: n === 1 ? VW / 2 : (i / (n - 1)) * VW,
    y: PAD_T + (1 - (v - min) / range) * (h - PAD_T - PAD_B),
  }));
}

function buildPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const t = 0.4;
  const at = (i: number) => pts[Math.min(pts.length - 1, Math.max(0, i))]!;
  let d = `M ${at(0).x} ${at(0).y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1y = Math.min(Math.max(p1.y + ((p2.y - p0.y) * t) / 3, Math.min(p1.y, p2.y)), Math.max(p1.y, p2.y));
    const c2y = Math.min(Math.max(p2.y - ((p3.y - p1.y) * t) / 3, Math.min(p1.y, p2.y)), Math.max(p1.y, p2.y));
    d += ` C ${p1.x + ((p2.x - p0.x) * t) / 3} ${c1y}, ${p2.x - ((p3.x - p1.x) * t) / 3} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function SparkChart({ data, color = "var(--chart-1)", height = 44, onScrub, className, label }: SparkChartProps) {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const pts = useMemo(() => points(data, height), [data, height]);
  const pathD = useMemo(() => buildPath(pts), [pts]);
  const fillD = pathD ? `${pathD} L ${VW} ${height} L 0 ${height} Z` : "";

  const update = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || data.length < 2) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const index = Math.round(pct * (data.length - 1));
      setActive(index);
      onScrub?.(index);
    },
    [data.length, onScrub],
  );

  const leave = useCallback(() => {
    setActive(null);
    onScrub?.(null);
  }, [onScrub]);

  const point = active === null ? null : pts[active];
  const pct = point ? (point.x / VW) * 100 : 100;
  const gradId = `spark-${uid}`;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className={cn("relative select-none touch-pan-y", className)}
      style={{ height }}
      onPointerMove={(e: PointerEvent) => update(e.clientX)}
      onPointerDown={(e: PointerEvent) => update(e.clientX)}
      onPointerLeave={leave}
      onPointerCancel={leave}
    >
      <svg viewBox={`0 0 ${VW} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-muted-foreground">
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.28"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
          <path d={fillD} fill={`url(#${gradId})`} />
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            className="animate-[spark-draw_0.8s_cubic-bezier(0.22,1,0.36,1)]"
          />
        </g>
      </svg>
      {point ? (
        <>
          <div className="pointer-events-none absolute top-0 bottom-0 w-px -translate-x-1/2 bg-foreground/15" style={{ left: `${pct}%` }} />
          <div
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${pct}%`, top: `${(point.y / height) * 100}%`, backgroundColor: color, boxShadow: "0 0 0 2px var(--card)" }}
          />
        </>
      ) : null}
    </div>
  );
}
