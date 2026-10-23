import { useBrowser } from "../store/browser";
import type { ProfileColor, ProfileTheme } from "../store/types";
import { adoptProfileTheme } from "../sync/engine";

export function setProfileTheme(profileId: string, theme: ProfileTheme | null, adopt = adoptProfileTheme) {
  adopt(profileId);
  useBrowser.getState().updateProfile(profileId, { theme });
}

export function choosePresetColor(profileId: string, color: ProfileColor, adopt = adoptProfileTheme) {
  adopt(profileId);
  useBrowser.getState().updateProfile(profileId, { color, theme: null });
}
