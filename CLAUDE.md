@AGENTS.md

## Claude Code

- Releases: use the `release` skill (`.claude/skills/release/SKILL.md`) for any ship, nightly or release-notes request.
- Usage and telemetry questions: use the `stats` skill (`.claude/skills/stats/SKILL.md`).
- Voice, music and speech work: the vendored `elevenlabs` skill.
- The `PreToolUse` hook in `.claude/settings.json` runs `scripts/agent/guard-git`; if it blocks a command, follow its message
  instead of working around it.
- `.claude/launch.json` previews the website on port 4321.
