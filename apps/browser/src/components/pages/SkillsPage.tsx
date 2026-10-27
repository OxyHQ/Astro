import { copyText, Symbol } from "@astro-browser/shell";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { useTheme } from "../../lib/theme";
import { signInWithOxy, useOxySession } from "../../oxy/session";
import { useBrowser } from "../../store/browser";
import { Button, Toggle, useFormColors } from "../settings/controls";
import { EmptyState, PAGE_WIDTH, PageHeader } from "./PageLayout";
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
        <PageHeader title="Skills" query="" onQuery={() => {}} placeholder="Search skills" />
        <SignedOut available={available} />
      </View>
    );

  if (view.kind === "builder")
    return <SkillBuilder editing={view.editing} prompt={view.prompt} onDone={() => setView({ kind: "yours" })} windowId={windowId} />;

  return (
    <View style={{ flex: 1 }}>
      <PageHeader
        title="Skills"
        query={query}
        onQuery={setQuery}
        placeholder={view.kind === "gallery" ? "Search the gallery" : "Search your skills"}
        actions={<Button title="New Skill" kind="primary" icon="plus" onPress={() => setView({ kind: "builder", editing: null, prompt: "" })} />}
      />
      <View style={{ alignItems: "center" }}>
        <Segments
          value={view.kind}
          options={[
            { value: "yours", title: "Your Skills" },
            { value: "gallery", title: "Gallery" },
          ]}
          onChange={(v) => setView({ kind: v as "yours" | "gallery" })}
        />
      </View>
      {view.kind === "yours" ? (
        <YourSkills query={query} windowId={windowId} onEdit={(skill) => setView({ kind: "builder", editing: skill, prompt: "" })} onGallery={() => setView({ kind: "gallery" })} />
      ) : (
        <Gallery query={query} windowId={windowId} />
      )}
    </View>
  );
}

function SignedOut({ available }: { available: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 80 }}>
      <Symbol name="sparkles" size={28} color={theme.textTertiary} style={{ width: 40, height: 40 }} />
      <Text style={{ fontSize: 15, fontWeight: "500", color: theme.textSecondary }}>{available ? "Sign in with Oxy to use skills" : "Skills aren't available on this Mac yet"}</Text>
      <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", maxWidth: 380 }}>
        Skills are saved prompts and step-by-step instructions you run with / in Chat or the command bar. They live in your Alia account.
      </Text>
      {available && <Button title="Sign In with Oxy…" kind="primary" onPress={() => void signInWithOxy()} />}
    </View>
  );
}

function Segments({ value, options, onChange }: { value: string; options: { value: string; title: string }[]; onChange: (value: string) => void }) {
  const theme = useTheme();
  const colors = useFormColors();
  return (
    <View style={{ flexDirection: "row", padding: 2, borderRadius: 8, backgroundColor: colors.control, gap: 2, marginBottom: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{ paddingHorizontal: 14, height: 24, borderRadius: 6, justifyContent: "center", backgroundColor: on ? (theme.dark ? "rgba(255,255,255,0.14)" : "#FFFFFF") : undefined }}
          >
            <Text style={{ fontSize: 13, fontWeight: on ? "600" : "400", color: on ? theme.textPrimary : theme.textSecondary }}>{o.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const matchesSkill = (q: string, k: Skill) => !q || `${k.name} ${k.displayName} ${k.description} ${k.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase());

function Glyph({ skill, size = 32 }: { skill: Pick<Skill, "icon" | "color">; size?: number }) {
  const theme = useTheme();
  const emoji = skill.icon && !/^[a-z0-9.]+$/i.test(skill.icon) ? skill.icon : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      }}
    >
      {emoji ? <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text> : <Symbol name="sparkles" size={size * 0.4} color={theme.icon} style={{ width: size * 0.5, height: size * 0.5 }} />}
    </View>
  );
}

function YourSkills({ query, windowId, onEdit, onGallery }: { query: string; windowId: string; onEdit: (skill: Skill) => void; onGallery: () => void }) {
  const theme = useTheme();
  const installed = useSkills((s) => s.installed);
  const loading = useSkills((s) => s.loading && !s.loadedAt);
  const error = useSkills((s) => s.error);
  const me = useOxySession((s) => s.account?.id ?? null);
  const shown = installed.filter((k) => matchesSkill(query, k));
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!shown.length)
    return (
      <View style={{ flex: 1 }}>
        <EmptyState
          icon={<Symbol name="sparkles" size={28} color={theme.textTertiary} style={{ width: 40, height: 40 }} />}
          title={query ? "No skills match" : (error ?? "You haven't added any skills")}
          subtitle={query ? undefined : "Write your own with New Skill, or add one from the Gallery. Type / in Chat or the command bar to run one."}
        />
        {!query && (
          <View style={{ alignItems: "center", marginTop: -60 }}>
            <Button title="Browse the Gallery" onPress={onGallery} />
          </View>
        )}
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

function Card({ children }: { children: React.ReactNode }) {
  const colors = useFormColors();
  return (
    <View
      style={{
        width: PAGE_WIDTH - 32,
        maxWidth: "100%",
        borderRadius: 12,
        padding: 14,
        backgroundColor: colors.group,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.groupBorder,
      }}
    >
      {children}
    </View>
  );
}

function InstalledRow({ skill, mine, windowId, onEdit }: { skill: InstalledSkill; mine: boolean; windowId: string; onEdit: () => void }) {
  const theme = useTheme();
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
  const menu = async () => {
    const { showMenu } = await import("@astro-browser/shell");
    const choice = await showMenu([
      { id: "try", title: "Try in Chat" },
      ...(mine && skill.source === "authored" ? [{ id: "edit", title: "Edit…" }] : []),
      ...(mine ? [{ id: "publish", title: skill.visibility === "public" ? "Unpublish from Gallery" : "Publish to Gallery" }] : []),
      ...(skill.visibility === "public" ? [{ id: "link", title: "Copy Link" }] : []),
      { separator: true as const },
      { id: "remove", title: "Remove from Your Skills" },
      ...(mine ? [{ id: "delete", title: "Delete Skill" }] : []),
    ]);
    switch (choice) {
      case "try":
        return void openChatWithSkill(windowId, "", { name: skill.name, title: skill.displayName || skill.name });
      case "edit":
        return onEdit();
      case "publish":
        return void act(() => publishSkill(skill._id, skill.visibility !== "public"), skill.visibility === "public" ? "Unpublished." : "Published to the Gallery. Anyone with the link can add it.");
      case "link":
        void copyText(skillShareUrl(skill));
        return setNote("Link copied.");
      case "remove":
        return void act(() => uninstallSkill(skill._id));
      case "delete":
        return void act(() => deleteSkill(skill._id));
    }
  };
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <Glyph skill={skill} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textPrimary }}>{skill.displayName || skill.name}</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>/{skill.name}</Text>
            {skill.visibility === "public" && mine && <Badge text="Published" />}
            {skill.source === "builtin" && <Badge text="Alia" />}
          </View>
          <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 17, color: theme.textSecondary }}>
            {skill.description}
          </Text>
          {note ? <Text style={{ fontSize: 12, color: theme.accent, marginTop: 2 }}>{note}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View tooltip="Alia may use this skill on her own when a request matches it" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>Automatic</Text>
              <Toggle value={skill.autoInvoke} disabled={busy || !skill.enabled} onChange={(v) => void act(() => setSkillInstall(skill._id, { autoInvoke: v }))} />
            </View>
            <View tooltip="Off, the skill isn't offered anywhere" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>On</Text>
              <Toggle value={skill.enabled} disabled={busy} onChange={(v) => void act(() => setSkillInstall(skill._id, { enabled: v }))} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => void menu()} style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
              <Symbol name="ellipsis" size={13} color={theme.icon} style={{ width: 16, height: 16 }} />
            </Pressable>
          </View>
        </View>
      </View>
    </Card>
  );
}

function Badge({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: 6, height: 17, borderRadius: 5, justifyContent: "center", backgroundColor: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
      <Text style={{ fontSize: 10.5, fontWeight: "600", color: theme.textSecondary }}>{text}</Text>
    </View>
  );
}

function Gallery({ query, windowId }: { query: string; windowId: string }) {
  const theme = useTheme();
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
  if (error) return <EmptyState title={error} />;
  if (!list) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!list.length) return <EmptyState icon={<Symbol name="sparkles" size={28} color={theme.textTertiary} style={{ width: 40, height: 40 }} />} title="No skills match" />;
  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 4, paddingBottom: 40 }}>
      <View style={{ width: PAGE_WIDTH - 32, maxWidth: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {list.map((skill) => (
          <GalleryCard key={skill._id} skill={skill} installed={have.has(skill._id)} windowId={windowId} />
        ))}
      </View>
    </ScrollView>
  );
}

function GalleryCard({ skill, installed, windowId }: { skill: Skill; installed: boolean; windowId: string }) {
  const theme = useTheme();
  const colors = useFormColors();
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
    <View
      style={{
        width: (PAGE_WIDTH - 32 - 20) / 3,
        minHeight: 150,
        borderRadius: 12,
        padding: 12,
        gap: 6,
        backgroundColor: colors.group,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.groupBorder,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Glyph skill={skill} size={28} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: theme.textPrimary }}>
            {skill.displayName || skill.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: theme.textSecondary }}>
            /{skill.name}
            {skill.publisher ? ` · ${skill.publisher}` : skill.source === "builtin" ? " · Alia" : ""}
          </Text>
        </View>
      </View>
      <Text numberOfLines={4} style={{ flex: 1, fontSize: 12, lineHeight: 16, color: theme.textSecondary }}>
        {skill.description}
      </Text>
      {error ? <Text style={{ fontSize: 11.5, color: colors.destructive }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {installed ? (
          <Button title="Try" onPress={() => void openChatWithSkill(windowId, "", { name: skill.name, title: skill.displayName || skill.name })} />
        ) : (
          <Button title={busy ? "Adding…" : "Add"} kind="primary" disabled={busy} onPress={() => void add()} />
        )}
        <Text style={{ flex: 1, textAlign: "right", fontSize: 11, color: theme.textTertiary }}>{skill.installCount ? `${skill.installCount} added` : ""}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy Link"
          onPress={() => void copyText(skillShareUrl(skill))}
          style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
        >
          <Symbol name="link" size={11} color={theme.icon} style={{ width: 14, height: 14 }} />
        </Pressable>
      </View>
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.textPrimary }}>{label}</Text>
      {children}
      {hint ? <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>{hint}</Text> : null}
    </View>
  );
}

function Input({ value, onChange, placeholder, lines = 1, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; lines?: number; mono?: boolean }) {
  const theme = useTheme();
  const colors = useFormColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.textTertiary}
      selectionColor={theme.selection}
      multiline={lines > 1}
      numberOfLines={lines}
      enableFocusRing={false}
      style={{
        minHeight: lines > 1 ? lines * 18 + 14 : 28,
        paddingHorizontal: 9,
        paddingVertical: lines > 1 ? 7 : 0,
        borderRadius: 7,
        fontSize: 13,
        lineHeight: lines > 1 ? 18 : undefined,
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : undefined,
        color: theme.textPrimary,
        backgroundColor: colors.field,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.fieldBorder,
        textAlignVertical: lines > 1 ? "top" : "center",
      }}
    />
  );
}

export const SKILL_TEMPLATE = "1. \n2. \n3. ";

function SkillBuilder({ editing, prompt, onDone, windowId }: { editing: Skill | null; prompt: string; onDone: () => void; windowId: string }) {
  const theme = useTheme();
  const colors = useFormColors();
  const [idea, setIdea] = useState(prompt);
  const [displayName, setDisplayName] = useState(editing?.displayName ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [nameTouched, setNameTouched] = useState(!!editing);
  const [icon, setIcon] = useState(editing?.icon && !/^[a-z0-9.]+$/i.test(editing.icon) ? editing.icon : "");
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
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onDone} style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
            <Symbol name="chevron.left" size={13} color={theme.icon} style={{ width: 16, height: 16 }} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: "600", color: theme.textPrimary }}>{editing ? `Edit /${editing.name}` : "New Skill"}</Text>
        </View>
        {!editing && (
          <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.group, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.groupBorder }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>Describe it, and Alia writes it</Text>
            <Input value={idea} onChange={setIdea} placeholder="e.g. Turn a job posting into a tailored cover letter, asking me for my résumé first" lines={3} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Button title={drafting ? "Writing…" : "Write It for Me"} icon="wand.and.stars" disabled={drafting} onPress={() => void draft()} />
              {drafting && <ActivityIndicator size="small" />}
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 70 }}>
            <Field label="Icon">
              <Input value={icon} onChange={(v) => setIcon([...v].slice(-2).join(""))} placeholder="✨" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Name">
              <Input value={displayName} onChange={setDisplayName} placeholder="Cover Letter" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Command" hint={editing ? "A skill's command can't change." : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginRight: 3 }}>/</Text>
                <View style={{ flex: 1 }}>
                  {editing ? (
                    <Text style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 28 }}>{editing.name}</Text>
                  ) : (
                    <Input
                      value={slug}
                      onChange={(v) => {
                        setNameTouched(true);
                        setName(skillName(v) + (v.endsWith("-") || v.endsWith(" ") ? "-" : ""));
                      }}
                      placeholder="cover-letter"
                    />
                  )}
                </View>
              </View>
            </Field>
          </View>
        </View>
        <Field label="When to use it" hint="What it does and when. Alia matches requests against this, so use the words you'd say.">
          <Input value={description} onChange={setDescription} placeholder="Writes a cover letter for a job posting. Use when I ask for a cover letter or am on a job listing." lines={3} />
        </Field>
        <Field label="Instructions" hint="The steps Alia follows. A skill can take several steps: read the page, ask a question, search, then write.">
          <Input value={body} onChange={setBody} placeholder={SKILL_TEMPLATE} lines={14} mono />
        </Field>
        {error ? <Text style={{ fontSize: 12.5, color: colors.destructive }}>{error}</Text> : null}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          <Button title="Cancel" onPress={onDone} />
          <Button title="Save and Try" disabled={saving || !!problem} onPress={() => void save(true)} />
          <Button title={saving ? "Saving…" : editing ? "Save" : "Create Skill"} kind="primary" disabled={saving || !!problem} onPress={() => void save(false)} />
        </View>
      </View>
    </ScrollView>
  );
}
