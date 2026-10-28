import { layout } from "../../lib/theme";

export type Rect = { x: number; y: number; width: number; height: number };

export type ToolbarGeometry = {
  sidebarButton: number | null;
  back: number;
  forward: number;
  reload: number;
  urlLeft: number;
};

const geometries = new Map<string, ToolbarGeometry>();

export function toolbarGeometry(o: { sidebarButton: boolean }): ToolbarGeometry {
  const key = `${o.sidebarButton}`;
  let g = geometries.get(key);
  if (!g) geometries.set(key, (g = computeToolbarGeometry(o)));
  return g;
}

function computeToolbarGeometry(o: { sidebarButton: boolean }): ToolbarGeometry {
  const [c0, c1, c2, c3] = layout.toolbarIconCenters;
  if (o.sidebarButton) return { sidebarButton: c0, back: c1, forward: c2, reload: c3, urlLeft: layout.breadcrumbX - 8 };
  const shift = c1 - c0;
  return { sidebarButton: null, back: c1 - shift, forward: c2 - shift, reload: c3 - shift, urlLeft: layout.breadcrumbX - 8 - shift };
}

export const NO_TOOLBAR: ToolbarGeometry = { sidebarButton: null, back: 21, forward: 21, reload: 21, urlLeft: 8 };
