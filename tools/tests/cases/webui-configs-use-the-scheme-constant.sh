#!/usr/bin/env bash
# A WebUIConfig constructed with a hard-coded scheme string must be refused
# before the compiler runs.
#
# Astro composes the internal scheme from //astro/build/product.gni, so
# `content::kChromeUIScheme` reads "astro" in an Astro build. A config that
# spells the scheme as a literal `"chrome"` registers under a scheme that is no
# longer in the trusted set, and WebUIConfigMap::AddWebUIConfig CHECK-fails at
# startup. Failing closed is correct, but the diagnosis costs a full ThinLTO
# link and a gdb session, and the crash names neither the file nor the host:
#
#     Thread 1 "chrome" received signal SIGTRAP
#     #0  content::WebUIConfigMap::AddWebUIConfig(...)
#     #1  RegisterChromeWebUIConfigs()
#
# That is not hypothetical. patches/ungoogled/extra/ungoogled-chromium/
# first-run-page.patch introduced exactly one such config, passing "chrome"
# where the other 188 constructions in the tree pass the constant.
#
# The case runs against FIXTURES rather than chromium/src, because this suite
# must work with no Chromium checkout. A green run therefore says the CHECKER
# is sound; build.sh runs the same script against the real tree.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
policy="$ASTRO_ROOT/tools/policy/webui_scheme_literals.py"

harness::assert_file_exists "$policy" "the scheme-literal policy script ships"

# A fixture tree the scanner will accept: it needs more constructions than the
# script's vacuity floor, or every verdict below would be the floor firing
# rather than the rule.
fixture="$tmp/src"
mkdir -p "$fixture/chrome/browser/ui/webui" "$fixture/content/browser"

bulk="$fixture/chrome/browser/ui/webui/bulk.cc"
{
    printf '// Enough well-formed constructions to clear the vacuity floor.\n'
    for index in $(seq 1 60); do
        printf 'class C%s : public content::DefaultWebUIConfig<T%s> {\n' "$index" "$index"
        printf '  C%s() : DefaultWebUIConfig(content::kChromeUIScheme, "host-%s") {}\n' "$index" "$index"
        printf '};\n'
    done
} > "$bulk"

# The forms that must be ACCEPTED. Each is a real shape from the tree: the
# qualified constant, the unqualified one, the untrusted constant, and a
# forwarding parameter. Banning any of these would make the rule unusable and
# the next person would delete it.
cat >> "$bulk" <<'EOF'
class Unqualified : public content::DefaultWebUIConfig<T> {
  Unqualified() : DefaultWebUIConfig(kChromeUIScheme, "unqualified") {}
};
class Untrusted : public content::DefaultWebUIConfig<T> {
  Untrusted() : DefaultWebUIConfig(content::kChromeUIUntrustedScheme, "untrusted") {}
};
class Forwarded : public content::DefaultWebUIConfig<T> {
  explicit Forwarded(std::string_view scheme)
      : DefaultWebUIConfig(scheme, "forwarded") {}
};
class AstroOwned : public content::DefaultWebUIConfig<T> {
  AstroOwned() : DefaultWebUIConfig(kAstroUIScheme, "astro-owned") {}
};
EOF

# --- The control. Without it, every refusal below is satisfied by a script
# --- that refuses unconditionally, and the case would prove nothing.

harness::run python3 "$policy" --root "$fixture" --no-check-exceptions

harness::assert_status 0 "a tree whose scheme arguments are all named constants"
harness::assert_output_contains "every scheme argument is a named constant" "states what it verified"

# --- A literal scheme is refused, and NAMED --------------------------------
#
# Naming the file and line is the point. The runtime CHECK already fails
# closed; what it cannot do is say where to look.

offender="$fixture/chrome/browser/ui/webui/offender.h"
cat > "$offender" <<'EOF'
class FirstRunUIConfig : public content::DefaultWebUIConfig<FirstRun> {
 public:
  FirstRunUIConfig() : DefaultWebUIConfig("chrome", "first-run") {}
};
EOF

harness::run python3 "$policy" --root "$fixture" --no-check-exceptions

harness::assert_nonzero_status "a WebUIConfig constructed with a literal scheme"
harness::assert_output_contains "chrome/browser/ui/webui/offender.h:3" "names the file and line"
harness::assert_output_contains "kChromeUIScheme" "names the constant to use instead"
harness::assert_output_contains "AddWebUIConfig CHECK-fails" "explains the consequence"

# An untrusted literal is equally refused. Spelling `chrome-untrusted` by hand
# is the same defect and has a worse failure mode, since a scheme that lands in
# neither trust set is a security boundary decided by a typo.
rm -f "$offender"
cat > "$fixture/content/browser/untrusted_offender.cc" <<'EOF'
class Config : public content::DefaultWebUIConfig<T> {
  Config() : DefaultWebUIConfig("chrome-untrusted", "host") {}
};
EOF

harness::run python3 "$policy" --root "$fixture" --no-check-exceptions

harness::assert_nonzero_status "an untrusted literal scheme"
harness::assert_output_contains "content/browser/untrusted_offender.cc" "names the untrusted offender"

rm -f "$fixture/content/browser/untrusted_offender.cc"

# --- The vacuity floor must fire ---------------------------------------------
#
# A scanner that stopped matching reports zero violations, which is byte-identical
# to success. This is the assertion that tells those two apart, and it is the
# reason the bulk fixture above exists at all.

empty="$tmp/empty-src"
mkdir -p "$empty/chrome/browser/ui/webui"
printf '// no configs here\n' > "$empty/chrome/browser/ui/webui/nothing.cc"

harness::run python3 "$policy" --root "$empty" --no-check-exceptions

harness::assert_nonzero_status "a tree with too few constructions to be meaningful"
harness::assert_output_contains "Nothing meaningful was scanned" "says nothing was measured"
harness::assert_output_lacks "every scheme argument is a named constant" "must not report success"

# --- A stale declared exception must fire ------------------------------------
#
# An exception whose file no longer exists silently covers whatever takes that
# path next, which is the failure mode of every allowlist that is never
# re-checked.

harness::run python3 "$policy" --root "$fixture"
harness::assert_nonzero_status "declared exception whose file is absent from the fixture"
harness::assert_output_contains "declared exception no longer exists" "names the stale entry"

# --- The real tree, when there is one ----------------------------------------
#
# Skipped rather than failed when no Chromium checkout is present: this suite is
# specified to run without one. Skipping is announced, so a silent skip cannot
# be mistaken for a pass.

if [ -d "$ASTRO_ROOT/chromium/src/chrome" ]; then
    harness::run python3 "$policy" --root "$ASTRO_ROOT/chromium/src"
    harness::assert_status 0 "the real Chromium tree carries no literal scheme"
else
    printf '      no chromium/src checkout; the real-tree row did not run.\n'
fi

harness::pass
