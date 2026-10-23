import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { installCliInBackground, useCli } from "../../lib/cliControl";
import { useBrowser } from "../../store/browser";
import { StepLayout } from "./steps";
import { useOnboarding } from "./state";
import { CheckRow, PrimaryButton, Reveal, SecondaryButton, StepTitle, useOnboardingColors } from "./ui";

const MONO = "Menlo";

export function CliStep() {
  const next = useOnboarding((s) => s.next);
  const colors = useOnboardingColors();
  const [control, setControl] = useState(false);
  const [started, setStarted] = useState(false);
  const installing = useCli((s) => !!s.installing);
  const failed = useCli((s) => !s.installing && !!s.error);
  const installed = useCli((s) => !s.installing && !s.error && !!s.installedVersion);

  const install = () => {
    useBrowser.getState().updateSettings({ cliControl: control });
    setStarted(true);
    void installCliInBackground("onboarding");
  };

  const status = !started
    ? null
    : installing
      ? "Installing in the background. You can keep going."
      : failed
        ? "Couldn't download the astro command. Try again from Settings › Advanced."
        : installed
          ? "Installed. Open a new Terminal window and run astro --help."
          : null;

  return (
    <StepLayout
      actions={
        started ? (
          <PrimaryButton title="Continue" onPress={next} />
        ) : (
          <>
            <PrimaryButton title="Install" onPress={install} />
            <SecondaryButton title="Not now" onPress={next} />
          </>
        )
      }
      preview={<Terminal />}
    >
      <Reveal delay={60}>
        <StepTitle
          title="Drive Astro from the terminal"
          subtitle="The astro command lets scripts and coding agents open tabs, click, type and read pages in Astro."
        />
      </Reveal>
      <Reveal delay={140} style={{ gap: 12 }}>
        <CheckRow
          icon="terminal"
          title="Let the astro command control Astro"
          subtitle="Stays on after you quit. Turn it off in Settings."
          value={control}
          disabled={started}
          onChange={setControl}
        />
        <Text style={{ fontSize: 11.5, lineHeight: 16, color: colors.footnote }}>
          {"While it's on, the command can open, read and act in every page you're signed in to. astro exec runs any Python you give it."}
        </Text>
        {status ? <Text style={{ fontSize: 12.5, lineHeight: 17, color: colors.subtitle }}>{status}</Text> : null}
      </Reveal>
    </StepLayout>
  );
}

function Terminal() {
  const colors = useOnboardingColors();
  const line = (text: string, color: string) => (
    <Text style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 17, color }}>{text}</Text>
  );
  return (
    <View
      style={{
        width: 360,
        borderRadius: 10,
        backgroundColor: colors.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.rowBorder,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 26,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          borderBottomWidth: StyleSheet.hairlineWidth * 2,
          borderBottomColor: colors.separator,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <View key={c} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: c }} />
        ))}
        <Text style={{ flex: 1, textAlign: "center", marginRight: 39, fontSize: 11, color: colors.steps }}>zsh</Text>
      </View>
      <View style={{ paddingHorizontal: 12, paddingVertical: 12, gap: 2 }}>
        {line(`$ astro exec 'await tab.go_to("https://astro.oxy.so")'`, colors.title)}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          {line("$", colors.title)}
          <View style={{ width: 7, height: 13, marginLeft: 4, backgroundColor: colors.title, opacity: 0.6 }} />
        </View>
      </View>
    </View>
  );
}
