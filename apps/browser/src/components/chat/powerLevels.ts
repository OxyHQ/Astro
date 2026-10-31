import { DEFAULT_POWER_LEVEL, isPowerLevel, POWER_LEVELS, type PowerLevel } from "@alia.onl/sdk/model";
import type { ComposerPanelPermissionOption } from "@oxy.so/bloom/composer-panel";
import { RiFireLine } from "@oxy.so/bloom/icons/RiFireLine";
import { RiFlashlightLine } from "@oxy.so/bloom/icons/RiFlashlightLine";
import { RiLightbulbLine } from "@oxy.so/bloom/icons/RiLightbulbLine";
import { RiRocket2Line } from "@oxy.so/bloom/icons/RiRocket2Line";
import { RiSparkling2Line } from "@oxy.so/bloom/icons/RiSparkling2Line";
import { RiSpeedUpLine } from "@oxy.so/bloom/icons/RiSpeedUpLine";
import { RiVipCrownLine } from "@oxy.so/bloom/icons/RiVipCrownLine";

const COPY: Record<PowerLevel, { label: string; description: string; icon: ComposerPanelPermissionOption["icon"] }> = {
  auto: { label: "Auto", description: "Picks the right level for each message", icon: RiSparkling2Line },
  instant: { label: "Instant", description: "Fastest and cheapest, for quick answers", icon: RiFlashlightLine },
  medium: { label: "Medium", description: "Quick and capable, for everyday tasks", icon: RiSpeedUpLine },
  high: { label: "High", description: "Thinks harder on tougher questions", icon: RiLightbulbLine },
  xhigh: { label: "XHigh", description: "Thinks even harder; a little slower", icon: RiFireLine },
  pro: { label: "Pro", description: "Frontier models; slower and costs more", icon: RiRocket2Line },
  ultra: { label: "Ultra", description: "Most capable; slowest and costs the most", icon: RiVipCrownLine },
};

export const POWER_LEVEL_OPTIONS: ComposerPanelPermissionOption[] = POWER_LEVELS.map((level) => ({ id: level, ...COPY[level] }));

export const powerLevelOf = (stored: string | null | undefined): PowerLevel => (isPowerLevel(stored) ? stored : DEFAULT_POWER_LEVEL);
