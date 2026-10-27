import { Button } from "@oxy.so/bloom/button";
import { Card } from "@oxy.so/bloom/card";
import { Chip } from "@oxy.so/bloom/chip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@oxy.so/bloom/dropdown-menu";
import { EmptyState } from "@oxy.so/bloom/empty-state";
import { RiAddLine } from "@oxy.so/bloom/icons/RiAddLine";
import { RiArrowLeftSLine } from "@oxy.so/bloom/icons/RiArrowLeftSLine";
import { RiLinkM } from "@oxy.so/bloom/icons/RiLinkM";
import { RiMagicLine } from "@oxy.so/bloom/icons/RiMagicLine";
import { RiMoreFill } from "@oxy.so/bloom/icons/RiMoreFill";
import { RiSparklingLine } from "@oxy.so/bloom/icons/RiSparklingLine";
import { Loading } from "@oxy.so/bloom/loading";
import { SegmentedControl, SegmentedControlItem, SegmentedControlItemText } from "@oxy.so/bloom/segmented-control";
import { Switch } from "@oxy.so/bloom/switch";
import { TextField, TextFieldHint, TextFieldInput, TextFieldLabel } from "@oxy.so/bloom/text-field";
import { Textarea } from "@oxy.so/bloom/textarea";
import { useTheme } from "@oxy.so/bloom/theme";
import { Text } from "@oxy.so/bloom/typography";
import { copyText } from "@astro-browser/shell";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { aliaErrorMessage, useAliaReady } from "../../ai/alia/api";
import { openChatWithSkill } from "../../ai/pagePrompts";
import {
  createSkill,
  deleteSkill,
  draftSkill,
  installSkill,
  publishSkill,
  refreshSkills,
  searchCatalogue,
  setSkillInstall,
  skillDetail,
  skillName,
  skillProblem,
  skillShareUrl,
  uninstallSkill,
  updateSkill,
  useSkills,
  type InstalledSkill,
  type Skill,
} from "../../ai/skills/skills";
import { useOxySession } from "../../oxy/session";
import { useBrowser } from "../../store/browser";
import { AiPageHeader, Hint, PAGE_COLUMN, SignedOutState } from "./AiPageChrome";
import { PAGE_WIDTH } from "./PageLayout";
import { internalQuery, tabDestination } from "./urls";

type View_ = { kind: "yours" } | { kind: "gallery" } | { kind: "builder"; editing: Skill | null; prompt: string };

export function skillsRoute(url: string): View_ {
  const path = url.replace(/^astro:\/\/skills\/?/i, "").split(/[?#]/)[0]!.toLowerCase();
  if (path === "gallery") return { kind: "gallery" };
  if (path === "new") return { kind: "builder", editing: null, prompt: internalQuery(url) };
  return { kind: "yours" };
}

export function SkillsPage({ tabId }: { tabId: string }) {
  const url = useBrowser((s) => (s.tabs[tabId] ? tabDestination(s.tabs[tabId]!) : ""));
  const windowId = useBrowser((s) => s.tabs[tabId]?.windowId ?? "");
  const ready = useAliaReady();
  const available = useOxySession((s) => s.available);
  const [view, setView] = useState<View_>(() => skillsRoute(url));
  const [query, setQuery] = useState("");
  useEffect(() => setView(skillsRoute(url)), [url]);
  useEffect(() => {
    if (ready) void refreshSkills({ force: true });
  }, [ready]);

  if (!ready)
    return (
      <View style={{ flex: 1 }}>
        <AiPageHeader title="Skills" query="" onQuery={() => {}} placeholder="Search skills" />
        <SignedOutState
          icon={RiSparklingLine}
          available={available}
          title="Sign in with Oxy to use skills"
          unavailable="Skills aren't available on this Mac yet"
          description="Skills are saved prompts and step-by-step instructions you run with / in Chat or the command bar. They live in your Alia account."
        />
      </View>
    );

  if (view.kind === "builder")
    return <SkillBuilder editing={view.editing} prompt={view.prompt} onDone={() => setView({ kind: "yours" })} windowId={windowId} />;

  return (
    <View style={{ flex: 1 }}>
      <AiPageHeader
        title="Skills"
        query={query}
        onQuery={setQuery}
        placeholder={view.kind === "gallery" ? "Search the gallery" : "Search your skills"}
        actions={
          <Button appearance="solid" tone="accent" size="sm" leadingIcon={RiAddLine} onPress={() => setView({ kind: "builder", editing: null, prompt: "" })}>
            New Skill
          </Button>
        }
      />
      <View style={{ alignSelf: "center", marginBottom: 12 }}>
        <SegmentedControl label="Skills" type="tabs" value={view.kind} onValueChange={(v: string) => setView({ kind: v as "yours" | "gallery" })}>
          <SegmentedControlItem value="yours">
            <SegmentedControlItemText>Your Skills</SegmentedControlItemText>
          </SegmentedControlItem>
          <SegmentedControlItem value="gallery">
            <SegmentedControlItemText>Gallery</SegmentedControlItemText>
          </SegmentedControlItem>
        </SegmentedControl>
      </View>
      {view.kind === "yours" ? (
        <YourSkills query={query} windowId={windowId} onEdit={(skill) => setView({ kind: "builder", editing: skill, prompt: "" })} onGallery={() => setView({ kind: "gallery" })} />
      ) : (
        <Gallery query={query} windowId={windowId} />
      )}
    </View>
  );
}

const matchesSkill = (q: string, k: Skill) => !q || `${k.name} ${k.displayName} ${k.description} ${k.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase());

const emojiOf = (skill: Pick<Skill, "icon">) => (skill.icon && !/^[a-z0-9.]+$/i.test(skill.icon) ? skill.icon : null);

function SkillMark({ skill, size = 32 }: { skill: Pick<Skill, "icon">; size?: number }) {
  const { colors } = useTheme();
  const emoji = emojiOf(skill);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundTertiary }}>
      {emoji ? <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.7 }}>{emoji}</Text> : <RiSparklingLine width={size * 0.5} height={size * 0.5} fill={colors.icon} />}
    </View>
  );
}

function YourSkills({ query, windowId, onEdit, onGallery }: { query: string; windowId: string; onEdit: (skill: Skill) => void; onGallery: () => void }) {
  const installed = useSkills((s) => s.installed);
  const loading = useSkills((s) => s.loading && !s.loadedAt);
  const error = useSkills((s) => s.error);
  const me = useOxySession((s) => s.account?.id ?? null);
  const shown = installed.filter((k) => matchesSkill(query, k));
  if (loading) return <Loading variant="spinner" style={{ marginTop: 40 }} />;
  if (!shown.length)
    return (
      <View style={{ flex: 1, justifyContent: "center", paddingBottom: 80 }}>
        <EmptyState
          icon={RiSparklingLine}
          title={query ? "No skills match" : (error ?? "You haven't added any skills")}
          {...(query
            ? {}
            : {
                description: "Write your own with New Skill, or add one from the Gallery. Type / in Chat or the command bar to run one.",
                action: { label: "Browse the Gallery", onPress: onGallery },
              })}
        />
      </View>
    );
  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 4, paddingBottom: 40, gap: 8 }}>
      {shown.map((skill) => (
        <InstalledRow key={skill._id} skill={skill} mine={!!me && skill.ownerOxyUserId === me} windowId={windowId} onEdit={() => onEdit(skill)} />
      ))}
    </ScrollView>
  );
}

function InstalledRow({ skill, mine, windowId, onEdit }: { skill: InstalledSkill; mine: boolean; windowId: string; onEdit: () => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const act = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await work();
      if (done) setNote(done);
    } catch (error) {
      setNote(aliaErrorMessage(error, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const published = skill.visibility === "public";
  return (
    <Card border="hairline" style={[PAGE_COLUMN, { padding: 14 }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <SkillMark skill={skill} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="body-semibold">{skill.displayName || skill.name}</Text>
            <Text variant="body-2-regular" style={{ color: colors.textSecondary }}>
              /{skill.name}
            </Text>
            {published && mine && <Chip size="sm">Published</Chip>}
            {skill.source === "builtin" && <Chip size="sm">Alia</Chip>}
          </View>
          <Text variant="body-2-regular" numberOfLines={2} style={{ color: colors.textSecondary }}>
            {skill.description}
          </Text>
          {note ? (
            <Text variant="caption-1-medium" style={{ color: colors.primary, marginTop: 2 }}>
              {note}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Hint label="Alia may use this skill on her own when a request matches it">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text variant="caption-1-medium" style={{ color: colors.textSecondary }}>
                Automatic
              </Text>
              <Switch
                size="sm"
                accessibilityLabel="Automatic"
                checked={skill.autoInvoke}
                disabled={busy || !skill.enabled}
                onCheckedChange={(v) => void act(() => setSkillInstall(skill._id, { autoInvoke: v }))}
              />
            </View>
          </Hint>
          <Hint label="Off, the skill isn't offered anywhere">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text variant="caption-1-medium" style={{ color: colors.textSecondary }}>
                On
              </Text>
              <Switch size="sm" accessibilityLabel="On" checked={skill.enabled} disabled={busy} onCheckedChange={(v) => void act(() => setSkillInstall(skill._id, { enabled: v }))} />
            </View>
          </Hint>
          <DropdownMenu>
            <DropdownMenuTrigger asChild label="More" style={{ alignSelf: "center" }}>
              <Button appearance="plain" tone="neutral" size="sm" iconOnly leadingIcon={RiMoreFill} accessibilityLabel="More" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onPress={() => void openChatWithSkill(windowId, "", { name: skill.name, title: skill.displayName || skill.name })}>Try in Chat</DropdownMenuItem>
              {mine && skill.source === "authored" ? <DropdownMenuItem onPress={onEdit}>Edit…</DropdownMenuItem> : null}
              {mine ? (
                <DropdownMenuItem
                  onPress={() =>
                    void act(() => publishSkill(skill._id, !published), published ? "Unpublished." : "Published to the Gallery. Anyone with the link can add it.")
                  }
                >
                  {published ? "Unpublish from Gallery" : "Publish to Gallery"}
                </DropdownMenuItem>
              ) : null}
              {published ? (
                <DropdownMenuItem
                  onPress={() => {
                    void copyText(skillShareUrl(skill));
                    setNote("Link copied.");
                  }}
                >
                  Copy Link
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onPress={() => void act(() => uninstallSkill(skill._id))}>Remove from Your Skills</DropdownMenuItem>
              {mine ? (
                <DropdownMenuItem tone="danger" onPress={() => void act(() => deleteSkill(skill._id))}>
                  Delete Skill
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
      </View>
    </Card>
  );
}

function Gallery({ query, windowId }: { query: string; windowId: string }) {
  const installed = useSkills((s) => s.installed);
  const [list, setList] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        void searchCatalogue(query)
          .then((skills) => live && (setList(skills), setError(null)))
          .catch((e) => live && setError(aliaErrorMessage(e, "The gallery couldn't be loaded."))),
      query ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);
  const have = useMemo(() => new Set(installed.map((k) => k._id)), [installed]);
  if (error || (list && !list.length))
    return (
      <View style={{ flex: 1, justifyContent: "center", paddingBottom: 80 }}>
        <EmptyState icon={RiSparklingLine} title={error ?? "No skills match"} />
      </View>
    );
  if (!list) return <Loading variant="spinner" style={{ marginTop: 40 }} />;
  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 4, paddingBottom: 40 }}>
      <View style={[PAGE_COLUMN, { flexDirection: "row", flexWrap: "wrap", gap: 10 }]}>
        {list.map((skill) => (
          <GalleryCard key={skill._id} skill={skill} installed={have.has(skill._id)} windowId={windowId} />
        ))}
      </View>
    </ScrollView>
  );
}

function GalleryCard({ skill, installed, windowId }: { skill: Skill; installed: boolean; windowId: string }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await installSkill(skill._id);
    } catch (e) {
      setError(aliaErrorMessage(e, "It couldn't be added."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card border="hairline" style={{ width: (PAGE_WIDTH - 32 - 20) / 3, minHeight: 150, padding: 12 }} contentStyle={{ flex: 1, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <SkillMark skill={skill} size={28} />
        <View style={{ flex: 1 }}>
          <Text variant="body-semibold" numberOfLines={1}>
            {skill.displayName || skill.name}
          </Text>
          <Text variant="caption-1-regular" numberOfLines={1} style={{ color: colors.textSecondary }}>
            /{skill.name}
            {skill.publisher ? ` · ${skill.publisher}` : skill.source === "builtin" ? " · Alia" : ""}
          </Text>
        </View>
      </View>
      <Text variant="body-2-regular" numberOfLines={4} style={{ flex: 1, color: colors.textSecondary }}>
        {skill.description}
      </Text>
      {error ? (
        <Text variant="caption-1-medium" style={{ color: colors.error }}>
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {installed ? (
          <Button size="sm" appearance="subtle" tone="neutral" onPress={() => void openChatWithSkill(windowId, "", { name: skill.name, title: skill.displayName || skill.name })}>
            Try
          </Button>
        ) : (
          <Button size="sm" appearance="solid" tone="accent" loading={busy} disabled={busy} onPress={() => void add()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        )}
        <Text variant="caption-1-regular" style={{ flex: 1, textAlign: "right", color: colors.textTertiary }}>
          {skill.installCount ? `${skill.installCount} added` : ""}
        </Text>
        <Button size="sm" appearance="plain" tone="neutral" iconOnly leadingIcon={RiLinkM} accessibilityLabel="Copy Link" onPress={() => void copyText(skillShareUrl(skill))} />
      </View>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View>
      <TextFieldLabel>{label}</TextFieldLabel>
      {children}
      {hint ? <TextFieldHint>{hint}</TextFieldHint> : null}
    </View>
  );
}

export const SKILL_TEMPLATE = "1. \n2. \n3. ";

const MONO = "var(--bloom-font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function SkillBuilder({ editing, prompt, onDone, windowId }: { editing: Skill | null; prompt: string; onDone: () => void; windowId: string }) {
  const { colors } = useTheme();
  const [idea, setIdea] = useState(prompt);
  const [displayName, setDisplayName] = useState(editing?.displayName ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [nameTouched, setNameTouched] = useState(!!editing);
  const [icon, setIcon] = useState(editing ? (emojiOf(editing) ?? "") : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [body, setBody] = useState(prompt ? prompt : "");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let live = true;
    void skillDetail(editing._id)
      .then((d) => live && setBody(d.version?.body ?? ""))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [editing?._id]);

  const slug = nameTouched ? name : skillName(displayName);
  const problem = skillProblem({ name: slug, description, body });

  const draft = async () => {
    if (idea.trim().length < 10) return setError("Describe the skill in a sentence or two first.");
    setDrafting(true);
    setError(null);
    try {
      const d = await draftSkill(idea.trim());
      if (!editing) {
        setName(d.name);
        setNameTouched(true);
        if (!displayName) setDisplayName(d.name.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
      }
      setDescription(d.description);
      setBody(d.body);
    } catch (e) {
      setError(aliaErrorMessage(e, "Alia couldn't draft it. Write it yourself, or try again."));
    } finally {
      setDrafting(false);
    }
  };

  const save = async (andTry: boolean) => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    const input = { name: slug, displayName: displayName.trim() || slug, description: description.trim(), body, ...(icon.trim() ? { icon: icon.trim() } : {}) };
    try {
      if (editing) await updateSkill(editing._id, input);
      else await createSkill(input);
      if (andTry) openChatWithSkill(windowId, "", { name: slug, title: input.displayName });
      onDone();
    } catch (e) {
      setError(aliaErrorMessage(e, "The skill couldn't be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 20, paddingBottom: 60 }}>
      <View style={{ width: 640, maxWidth: "100%", paddingHorizontal: 16, gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Button appearance="plain" tone="neutral" size="sm" iconOnly leadingIcon={RiArrowLeftSLine} accessibilityLabel="Back" onPress={onDone} />
          <Text variant="title-2-semibold">{editing ? `Edit /${editing.name}` : "New Skill"}</Text>
        </View>
        {!editing && (
          <Card border="hairline" style={{ padding: 12 }} contentStyle={{ gap: 8 }}>
            <Textarea
              label="Describe it, and Alia writes it"
              value={idea}
              onValueChange={setIdea}
              placeholder="e.g. Turn a job posting into a tailored cover letter, asking me for my résumé first"
              rows={3}
            />
            <View style={{ flexDirection: "row" }}>
              <Button appearance="subtle" tone="neutral" size="sm" leadingIcon={RiMagicLine} loading={drafting} disabled={drafting} onPress={() => void draft()}>
                {drafting ? "Writing…" : "Write It for Me"}
              </Button>
            </View>
          </Card>
        )}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 70 }}>
            <Field label="Icon">
              <TextFieldInput label="Icon" placeholder="✨" value={icon} onValueChange={(v) => setIcon([...v].slice(-2).join(""))} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Name">
              <TextFieldInput label="Name" placeholder="Cover Letter" value={displayName} onValueChange={setDisplayName} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Command" {...(editing ? { hint: "A skill's command can't change." } : {})}>
              <TextField disabled={!!editing} leadingAddon={<Text style={{ color: colors.textSecondary, paddingLeft: 6 }}>/</Text>}>
                <TextFieldInput
                  label="Command"
                  placeholder="cover-letter"
                  value={editing ? editing.name : slug}
                  onValueChange={(v) => {
                    setNameTouched(true);
                    setName(skillName(v) + (v.endsWith("-") || v.endsWith(" ") ? "-" : ""));
                  }}
                />
              </TextField>
            </Field>
          </View>
        </View>
        <Textarea
          label="When to use it"
          hint="What it does and when. Alia matches requests against this, so use the words you'd say."
          value={description}
          onValueChange={setDescription}
          placeholder="Writes a cover letter for a job posting. Use when I ask for a cover letter or am on a job listing."
          rows={3}
        />
        <Textarea
          label="Instructions"
          hint="The steps Alia follows. A skill can take several steps: read the page, ask a question, search, then write."
          value={body}
          onValueChange={setBody}
          placeholder={SKILL_TEMPLATE}
          rows={14}
          inputStyle={{ fontFamily: MONO, fontSize: 13 }}
        />
        {error ? (
          <Text variant="body-2-medium" style={{ color: colors.error }}>
            {error}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          <Button appearance="outline" tone="neutral" size="sm" onPress={onDone}>
            Cancel
          </Button>
          <Button appearance="subtle" tone="neutral" size="sm" disabled={saving || !!problem} onPress={() => void save(true)}>
            Save and Try
          </Button>
          <Button appearance="solid" tone="accent" size="sm" loading={saving} disabled={saving || !!problem} onPress={() => void save(false)}>
            {saving ? "Saving…" : editing ? "Save" : "Create Skill"}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
