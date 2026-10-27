import type { ComponentType } from "react";
import { create } from "zustand";

type PageComponent = ComponentType<{ tabId: string }>;

export const useRegisteredPages = create<{ pages: Record<string, PageComponent> }>()(() => ({ pages: {} }));

export function registerInternalPage(id: string, page: PageComponent) {
  useRegisteredPages.setState((s) => ({ pages: { ...s.pages, [id]: page } }));
}
