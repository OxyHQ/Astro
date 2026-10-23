import type { RangeKey } from "../../lib/range";
import { githubPage } from "../github";
import { appBreakdowns, appPerf, appTrend } from "./app";
import { errorsExceptions, errorsLogs } from "./errors";
import { installsDaily, installsVersions } from "./installs";
import { overviewApp, overviewErrors, overviewInstalls, overviewSite } from "./overview";
import { siteBreakdowns, siteClicks, siteExperiment, siteTraffic, siteVitals } from "./site";

export const sections = {
  "overview.site": overviewSite,
  "overview.installs": overviewInstalls,
  "overview.app": overviewApp,
  "overview.errors": overviewErrors,
  "site.traffic": siteTraffic,
  "site.breakdowns": siteBreakdowns,
  "site.clicks": siteClicks,
  "site.experiment": siteExperiment,
  "site.vitals": siteVitals,
  "installs.daily": installsDaily,
  "installs.versions": installsVersions,
  "app.trend": appTrend,
  "app.breakdowns": appBreakdowns,
  "app.perf": appPerf,
  "errors.exceptions": errorsExceptions,
  "errors.logs": errorsLogs,
  github: (_range: RangeKey) => githubPage(),
} satisfies Record<string, (range: RangeKey, signal?: AbortSignal) => Promise<unknown>>;

export type Sections = typeof sections;
export type SectionName = keyof Sections;
export type SectionData<N extends SectionName> = Awaited<ReturnType<Sections[N]>>;
