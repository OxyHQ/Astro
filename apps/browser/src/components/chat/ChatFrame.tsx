import { Surface } from "@oxy.so/bloom/surface";
import type { ReactNode } from "react";
import { layout, useTheme } from "../../lib/theme";
import { useWindowChat } from "../../ai/chat/state";

export const FLOATING_RADIUS = 14;

export function ChatFrame({ windowId, inTab, children }: { windowId: string; inTab: boolean; children: ReactNode }) {
  const theme = useTheme();
  const floating = useWindowChat(windowId, (c) => c.placement === "floating");
  return (
    <Surface
      radius={inTab ? 0 : floating ? FLOATING_RADIUS : layout.cardRadius}
      {...(inTab ? { fill: theme.card } : {})}
      style={{
        flex: 1,
        ...(floating && !inTab ? { boxShadow: theme.dark ? "0 18px 48px rgba(0,0,0,0.55)" : "0 18px 48px rgba(0,0,0,0.18)" } : {}),
      }}
    >
      {children}
    </Surface>
  );
}
