import { useChatAvailable } from "../../../ai/chatEntry";
import { useOneShotStatus } from "../../../ai/inference";
import { useOxySession } from "../../../oxy/session";
import { useBrowser } from "../../../store/browser";
import type { Settings } from "../../../store/settings";
import { Button, Group, Row, SectionHeader, Toggle } from "../controls";
import { loadContentPolicy, useContentPolicy } from "../../../ai/safety/policy";
import { useEffect } from "react";

type AiSetting = "aiGroupNames" | "aiPinnedTitles" | "aiTidyDownloads" | "aiCommandBarChat" | "aiVideoSummaries";

const STOPPED: Record<string, string> = {
  authentication_failed: "Oxy didn’t accept this session for AI. Sign out and in again.",
  permission_denied: "Oxy hasn’t enabled AI for Astro on this account yet.",
  policy_violation: "Oxy hasn’t enabled AI for Astro on this account yet.",
  insufficient_balance: "Your Oxy account has no AI allowance left.",
  spending_limit_exceeded: "Your Oxy account reached its AI spending limit.",
};

function SiteList({ anchor, sites, empty, onRemove }: { anchor: string; sites: string[]; empty: string; onRemove: (host: string) => void }) {
  return (
    <Group>
      <Row anchor={anchor} />
      {sites.length ? (
        sites.map((host) => (
          <Row key={host} title={host}>
            <Button title="Remove" kind="plain" onPress={() => onRemove(host)} />
          </Row>
        ))
      ) : (
        <Row description={empty} />
      )}
    </Group>
  );
}

export function AiFeaturesSection() {
  const settings = useBrowser((s) => s.settings);
  const update = useBrowser((s) => s.updateSettings);
  const signedIn = useOxySession((s) => !!s.account);
  const chat = useChatAvailable();
  const stopped = useOneShotStatus((s) => s.stoppedFor);
  const managed = useContentPolicy((s) => s.managed);
  useEffect(() => void loadContentPolicy(), []);
  const toggle = (key: AiSetting) => <Toggle value={settings[key] !== false} disabled={!signedIn} onChange={(v) => update({ [key]: v } as Partial<Settings>)} />;
  const note = !signedIn ? "Sign in to use them. Signed out, Astro names groups from their tabs and leaves titles and files as they are." : stopped ? (STOPPED[stopped] ?? `AI is paused: ${stopped}.`) : undefined;
  return (
    <>
      <SectionHeader title="Astro AI" description={note} />
      <Group>
        <Row anchor="account.aiGroupNames">{toggle("aiGroupNames")}</Row>
        <Row anchor="account.aiPinnedTitles">{toggle("aiPinnedTitles")}</Row>
        <Row anchor="account.aiTidyDownloads">{toggle("aiTidyDownloads")}</Row>
        {chat ? <Row anchor="account.aiCommandBarChat">{toggle("aiCommandBarChat")}</Row> : null}
        {chat ? <Row anchor="account.aiVideoSummaries">{toggle("aiVideoSummaries")}</Row> : null}
      </Group>
      {chat ? <SiteList anchor="account.agentSites" sites={settings.agentSites ?? []} empty="None yet: Alia asks the first time it acts on a site." onRemove={(host) => update({ agentSites: (settings.agentSites ?? []).filter((h) => h !== host) })} /> : null}
      {chat ? <SiteList anchor="account.aiSharedSites" sites={settings.aiSharedSites ?? []} empty="None." onRemove={(host) => update({ aiSharedSites: (settings.aiSharedSites ?? []).filter((h) => h !== host) })} /> : null}
      {chat && managed ? (
        <Group>
          <Row anchor="account.aiManaged" />
        </Group>
      ) : null}
    </>
  );
}
