import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Source = "site" | "replay" | "feed" | "app" | "github";

const LOOK: Record<Source, { label: string; title: string; detail: string }> = {
  site: {
    label: "Always on",
    title: "Always collected, anonymous",
    detail: "Every astro.oxy.so visitor. The site sends this for everyone, with no consent step, and doesn't read Do Not Track or GPC.",
  },
  replay: {
    label: "Always on",
    title: "Always collected, anonymous",
    detail: "Every astro.oxy.so session longer than about 4 s is recorded, with inputs and private text masked in the browser. Kept 30 days.",
  },
  feed: {
    label: "Always on",
    title: "Always collected, anonymous",
    detail: "Every installed copy's Sparkle update checks to astro.oxy.so/appcast.xml, counted by nginx with no IP or id. Copies with automatic checks turned off only count when someone checks by hand; 0.2.13 and older aren't counted.",
  },
  app: {
    label: "Opt-in",
    title: "Opt-in only",
    detail: "Only from Mac app users who turned on usage sharing (Settings › Privacy, onboarding, or the new-tab ask). It's off by default, so this undercounts.",
  },
  github: {
    label: "Public",
    title: "Public",
    detail: "GitHub's public API: stars, forks, issues and release download counts.",
  },
};

export function SourceBadge({ source, className }: { source: Source; className?: string }) {
  const look = LOOK[source];
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex h-[18px] shrink-0 cursor-default items-center rounded-[5px] border border-border bg-muted/50 px-1.5 font-mono text-[9.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className,
          )}
        >
          {look.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 text-xs">
        <span className="font-semibold">{look.title}.</span> {look.detail}
      </TooltipContent>
    </Tooltip>
  );
}

export const SOURCE_SENTENCE: Record<Source, string> = {
  site: "Always-on, anonymous site analytics",
  replay: "Always-on, anonymous session recordings",
  feed: "Always-on, anonymous update checks",
  app: "Opt-in app telemetry",
  github: "Public GitHub data",
};

export function SourceBadges({ source }: { source?: Source | Source[] }) {
  if (!source) return null;
  const list = [...new Set(Array.isArray(source) ? source : [source])];
  return (
    <>
      {list.map((s) => (
        <SourceBadge key={s} source={s} />
      ))}
    </>
  );
}
