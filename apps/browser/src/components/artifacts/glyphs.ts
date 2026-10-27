import type { BloomIconComponent } from "@oxy.so/bloom/icons";
import { RiBarChartBoxLine } from "@oxy.so/bloom/icons/RiBarChartBoxLine";
import { RiCodeSSlashLine } from "@oxy.so/bloom/icons/RiCodeSSlashLine";
import { RiFileTextLine } from "@oxy.so/bloom/icons/RiFileTextLine";
import { RiSlideshow3Line } from "@oxy.so/bloom/icons/RiSlideshow3Line";
import { RiTableLine } from "@oxy.so/bloom/icons/RiTableLine";
import type { ArtifactKind } from "../../ai/artifacts/artifacts";

export const KIND_GLYPH: Record<ArtifactKind, BloomIconComponent> = {
  report: RiFileTextLine,
  deck: RiSlideshow3Line,
  dashboard: RiBarChartBoxLine,
  table: RiTableLine,
  code: RiCodeSSlashLine,
};
