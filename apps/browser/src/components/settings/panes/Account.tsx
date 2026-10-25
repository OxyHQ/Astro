import { Symbol } from "@astro-browser/shell";
import { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { manageOxyAccount, signInWithOxy, signOutOfOxy, useOxySession, type OxyAccount } from "../../../oxy/session";
import { AccountAvatar } from "../../account/AccountAvatar";
import { Button, Group, Row, SectionHeader } from "../controls";
import { useSettingsNav } from "../windows";

const AVATAR = 64;

export function AccountPane() {
  const theme = useTheme();
  const available = useOxySession((s) => s.available);
  const resolved = useOxySession((s) => s.resolved);
  const account = useOxySession((s) => s.account);
  const go = useSettingsNav((s) => s.go);
  const [busy, setBusy] = useState(false);

  if (!available) {
    return <Text style={{ marginTop: 20, fontSize: 12.5, color: theme.textSecondary }}>Sign in with Oxy isn’t available in this build yet.</Text>;
  }

  const signIn = async () => {
    setBusy(true);
    try {
      await signInWithOxy();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <AccountHeader account={account} pending={!resolved} />
      <Group>
        <Row anchor="account.account" description={accountDescription(account, resolved)}>
          {account ? (
            <>
              <Button title="Manage Account…" onPress={() => void manageOxyAccount()} />
              <Button title="Sign Out" onPress={() => void signOutOfOxy()} />
            </>
          ) : (
            <Button title={busy ? "Signing In…" : "Sign In with Oxy…"} kind="primary" disabled={busy || !resolved} onPress={() => void signIn()} />
          )}
        </Row>
      </Group>

      <SectionHeader title="Uses your Oxy account" />
      <Group>
        <Row
          anchor="account.calendar"
          icon={<Symbol name="calendar" size={14} color={theme.icon} style={{ width: 20, height: 20 }} />}
          description={account ? "Your Nilo calendar: the pinned calendar, meeting alerts and meeting tab groups." : "Sign in to see your Nilo calendar in the pinned calendar, with meeting alerts and meeting tab groups."}
          onPress={() => go("calendar")}
        />
      </Group>
      <Text style={{ marginTop: 12, fontSize: 11.5, lineHeight: 15, color: theme.textTertiary }}>
        Astro stays signed in on this device until you sign out. Signing in here doesn’t sign you in to websites in your tabs, and Sync doesn’t use your account.
      </Text>
    </View>
  );
}

function AccountHeader({ account, pending }: { account: OxyAccount | null; pending: boolean }) {
  const theme = useTheme();
  const detail = account ? [account.handle && account.handle !== account.name ? `@${account.handle}` : "", account.email ?? ""].filter(Boolean).join(" · ") : "";
  return (
    <View style={{ alignItems: "center", marginTop: 20, marginBottom: 18, gap: 4 }}>
      <AccountAvatar account={account} size={AVATAR} />
      <Text style={{ marginTop: 8, fontSize: 17, fontWeight: "600", color: theme.textPrimary }}>{account ? account.name : "Oxy Account"}</Text>
      <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>
        {account ? detail || "Signed in" : pending ? "Checking your Oxy account…" : "Not signed in"}
      </Text>
    </View>
  );
}

function accountDescription(account: OxyAccount | null, resolved: boolean): string {
  if (account) return "Signed in for all of Astro, in every window and profile.";
  if (!resolved) return "Checking your Oxy account…";
  return "Sign in once for all of Astro, in every window and profile.";
}
