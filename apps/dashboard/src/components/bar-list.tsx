import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatExact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BarItem = { key: string; label: string; value: number; secondary?: number };

export function BarList({
  items,
  dimension = "",
  valueLabel = "Visitors",
  secondaryLabel,
  limit = 8,
  color = "var(--chart-1)",
  empty = "Nothing in this range",
  shareOf,
}: {
  items: BarItem[];
  dimension?: string;
  valueLabel?: string;
  secondaryLabel?: string;
  limit?: number;
  color?: string;
  empty?: string;
  shareOf?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = shareOf ?? items.reduce((s, i) => s + i.value, 0);
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex items-center justify-between pb-1 label-mono text-muted-foreground">
        <span>{dimension}</span>
        <span className="flex gap-4">
          {secondaryLabel ? <span className="w-12 text-right">{secondaryLabel}</span> : null}
          <span className="w-12 text-right">{valueLabel}</span>
        </span>
      </div>
      <ul className="grid min-w-0 gap-1">
        {shown.map((item) => (
          <li key={item.key} className="min-w-0">
            <Tooltip delayDuration={80}>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  className="group relative flex h-8 items-center justify-between gap-3 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span
                    className="absolute inset-y-0.5 left-0 rounded-[5px] opacity-[0.16] transition-opacity group-hover:opacity-[0.26]"
                    style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%`, backgroundColor: color }}
                  />
                  <span className="relative min-w-0 truncate">{item.label}</span>
                  <span className="relative flex shrink-0 gap-4 tnum">
                    {secondaryLabel ? <span className="w-12 text-right text-muted-foreground">{formatExact(item.secondary ?? 0)}</span> : null}
                    <span className="w-12 text-right font-medium">{formatExact(item.value)}</span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="text-xs">
                <span className="font-semibold tnum">{formatExact(item.value)}</span> {valueLabel.toLowerCase()} ·{" "}
                <span className="tnum">{formatPercent(total ? item.value / total : null)}</span> of {formatExact(total)}
                {secondaryLabel ? (
                  <>
                    {" "}
                    · <span className="tnum">{formatExact(item.secondary ?? 0)}</span> {secondaryLabel.toLowerCase()}
                  </>
                ) : null}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
      {items.length > limit ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn("mt-1 self-start rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground")}
        >
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </div>
  );
}
