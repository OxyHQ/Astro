import type { LinkRoute } from "@astro-browser/astrocore";
import { useBrowser } from "../store/browser";
import { engineProfile } from "../store/model";
import { lastActiveProfile } from "../store/small";

export type RoutedLinks = { profileId: string | null; adoptIds: (string | undefined)[] };

export function routedLinks(route: LinkRoute, count: number): RoutedLinks {
  const s = useBrowser.getState();
  const marks = route.adoptIds ?? [];
  const last = lastActiveProfile(s);
  const profileId =
    route.profile === undefined ? null : engineProfile(last) === route.profile ? last : (s.profileOrder.find((id) => engineProfile(id) === route.profile) ?? null);
  return {
    profileId,
    adoptIds: Array.from({ length: count }, (_, i) => (profileId !== null && typeof marks[i] === "string" ? marks[i]! : undefined)),
  };
}
