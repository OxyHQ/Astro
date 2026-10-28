import { create } from "zustand";

export type PaneLayout = { visible: string[]; behind: string[] };

export const usePaneLayout = create<Record<string, PaneLayout>>()(() => ({}));

export function publishPaneLayout(windowId: string, layout: PaneLayout) {
  const was = usePaneLayout.getState()[windowId];
  if (was && was.visible.join() === layout.visible.join() && was.behind.join() === layout.behind.join()) return;
  usePaneLayout.setState({ [windowId]: layout });
}
