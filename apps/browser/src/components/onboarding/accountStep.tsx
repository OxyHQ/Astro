import { Symbol } from "@astro-browser/shell";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { signInWithOxy, useOxySession, type OxyAccount } from "../../oxy/session";
import { AccountAvatar } from "../account/AccountAvatar";
import { StepLayout } from "./steps";
import { useOnboarding } from "./state";
import { PrimaryButton, Reveal, SecondaryButton, StepTitle, useOnboardingColors } from "./ui";

export function AccountStep() {
  const next = useOnboarding((s) => s.next);
  const colors = useOnboardingColors();
  const account = useOxySession((s) => s.account);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      await signInWithOxy();
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepLayout
      actions={
        account ? (
          <PrimaryButton title="Continue" onPress={next} />
        ) : (
          <>
            <PrimaryButton title={busy ? "Signing In…" : "Sign In with Oxy"} disabled={busy} onPress={() => void signIn()} />
            <SecondaryButton title="Not now" onPress={next} />
          </>
        )
      }
      preview={<AccountCard account={account} />}
    >
      <Reveal delay={60}>
        <StepTitle
          title={account ? `You’re signed in, ${account.name}` : "Sign in with Oxy"}
          subtitle={
            account
              ? "Astro uses your Oxy account in every window and profile. Your Nilo calendar shows up on a pinned calendar tab, with an alert before each meeting."
              : "One Oxy account for all of Astro, in every window and profile. With it, Astro shows your Nilo calendar: your day on a pinned calendar tab, and an alert with a Join button before each meeting."
          }
        />
      </Reveal>
      <Reveal delay={140}>
        <Text style={{ fontSize: 11.5, lineHeight: 16, color: colors.footnote }}>
          {account ? "Manage or sign out of your account in Settings › Oxy Account." : "Optional. You can sign in any time from Settings › Oxy Account or the ⋯ menu."}
        </Text>
      </Reveal>
    </StepLayout>
  );
}

function AccountCard({ account }: { account: OxyAccount | null }) {
  const colors = useOnboardingColors();
  return (
    <View
      style={{
        width: 260,
        borderRadius: 14,
        backgroundColor: colors.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.rowBorder,
        overflow: "hidden",
      }}
    >
      <View style={{ alignItems: "center", paddingTop: 22, paddingBottom: 16, gap: 6 }}>
        <AccountAvatar account={account} size={56} />
        <Text style={{ marginTop: 4, fontSize: 15, fontWeight: "600", color: colors.title }}>{account ? account.name : "Oxy Account"}</Text>
        <Text style={{ fontSize: 11.5, color: colors.subtitle }}>{account ? (account.handle ? `@${account.handle}` : "Signed in") : "Not signed in"}</Text>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.separator }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, opacity: account ? 1 : 0.55 }}>
        <Symbol name="calendar" size={14} color={colors.title} style={{ width: 18, height: 18 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "500", color: colors.title }}>Calendar</Text>
          <Text style={{ fontSize: 11, color: colors.subtitle }}>{account ? "From your Nilo calendar" : "Needs your Oxy account"}</Text>
        </View>
        {account ? <Symbol name="checkmark" size={11} weight="semibold" color="#2F9E5B" style={{ width: 14, height: 14 }} /> : null}
      </View>
    </View>
  );
}
