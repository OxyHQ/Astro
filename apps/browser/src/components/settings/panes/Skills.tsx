import { Symbol } from "@astro-browser/shell";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { aliaErrorMessage, useAliaReady } from "../../../ai/alia/api";
import { ASTRO_COMMANDS, refreshSkills, setSkillInstall, useSkills, type InstalledSkill } from "../../../ai/skills/skills";
import { useTheme } from "../../../lib/theme";
import { openSkillsPage } from "../../pages/urls";
import { Button, Checkbox, Group, Row, SectionHeader, Toggle } from "../controls";
import { browserWindow, SignedOutRow } from "./Apps";

export function SkillsPane() {
  const ready = useAliaReady();
  const installed = useSkills((s) => s.installed);
  const loading = useSkills((s) => s.loading && s.loadedAt === null);
  const failed = useSkills((s) => s.error);
  useEffect(() => {
    if (ready) void refreshSkills({ force: true });
  }, [ready]);
  const open = (route: "yours" | "gallery" | "new") => openSkillsPage(browserWindow(), route);

  return (
    <View>
      <SectionHeader
        anchor="skills.list"
        description="A skill is a set of instructions Chat follows: type / and its name in Chat or the command bar. Automatic skills also run when a request matches what they're for. They live in your Alia account, so they work everywhere you use Alia."
        action={ready ? <Button title="Manage Skills…" onPress={() => open("yours")} /> : undefined}
      />
      {ready ? (
        <Group>
          {loading || failed || !installed.length ? <Row title={loading ? "Loading your skills…" : (failed ?? "You haven't added any skills yet.")} /> : null}
          {installed.map((skill) => (
            <SkillRow key={skill._id} skill={skill} />
          ))}
        </Group>
      ) : (
        <SignedOutRow description="Sign in with your Oxy account to use and make skills." />
      )}

      <SectionHeader title="Add skills" />
      <Group>
        <Row anchor="skills.gallery">
          <Button title="Open Gallery…" disabled={!ready} onPress={() => open("gallery")} />
        </Row>
        <Row anchor="skills.builder">
          <Button title="New Skill…" disabled={!ready} onPress={() => open("new")} />
        </Row>
      </Group>

      <SectionHeader anchor="skills.commands" />
      <Group>
        {ASTRO_COMMANDS.map((c) => (
          <CommandRow key={c.command} name={c.name} title={c.title} description={c.description} icon={c.icon} />
        ))}
      </Group>
    </View>
  );
}

function SkillRow({ skill }: { skill: InstalledSkill }) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const change = (patch: { enabled?: boolean; autoInvoke?: boolean }) => {
    setError(null);
    setSkillInstall(skill._id, patch).catch((e) => setError(aliaErrorMessage(e, "That change couldn't be saved.")));
  };
  return (
    <Row
      icon={
        skill.icon && !/^[a-z.]+$/.test(skill.icon) ? (
          <Text style={{ width: 20, textAlign: "center", fontSize: 14 }}>{skill.icon}</Text>
        ) : (
          <Symbol name="sparkles" size={13} color={theme.icon} style={{ width: 20, height: 20 }} />
        )
      }
      title={skill.displayName || skill.name}
      description={
        <Text numberOfLines={2} style={{ fontSize: 11.5, marginTop: 2, color: error ? "#FF453A" : theme.textSecondary, lineHeight: 15 }}>
          {error ?? `/${skill.name} — ${skill.description}`}
        </Text>
      }
    >
      <Checkbox label="Automatic" value={skill.autoInvoke} disabled={!skill.enabled} onChange={(autoInvoke) => change({ autoInvoke })} />
      <Toggle value={skill.enabled} onChange={(enabled) => change({ enabled })} />
    </Row>
  );
}

function CommandRow({ name, title, description, icon }: { name: string; title: string; description: string; icon: string }) {
  const theme = useTheme();
  return (
    <Row
      icon={<Symbol name={icon} size={13} color={theme.icon} style={{ width: 20, height: 20 }} />}
      title={`/${name}`}
      description={`${title}: ${description}`}
    />
  );
}
