#!/usr/bin/env bash
# tools/build.sh must verify the Chromium checkout against browser.lock.json
# BEFORE it validates anything else and before it generates anything.
#
# This is the property that makes a stale self-hosted runner unable to ship a
# binary built from a commit nobody declared. Without it the tree compiles
# silently and the resulting binary claims to be something it is not — and
# nothing in the artifact says otherwise, because provenance is generated from
# the same drifted tree.
#
# build.sh's required INPUT checks — GN args, the two build gates, the build
# tools, WebUI bundles, ad blocker filter lists, the overlay sync — are the
# layer below and live in build-fails-closed-on-missing-inputs.sh. They are a
# separate case because none of the machinery here exists there: no lock, no
# script to enforce it, no schema to validate it against.
#
# Everything runs against synthetic fixtures under the harness temporary
# directory. The real chromium/ checkout is never read and never written.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

# A commit that exists in no fixture, so the lock can name a revision the
# checkout demonstrably is not on.
ABSENT_COMMIT="0000000000000000000000000000000000000001"

fake_root="$tmp/astro-root"
chromium="$tmp/chromium-src"
harness::make_locked_build_root "$fake_root" "$chromium"

# One real sync renders .gclient from the committed template, which the
# verify-only gate then checks. Without it the gate would fail on
# configuration rather than on the revision this case is about — a refusal for
# the wrong reason, which reads exactly like a refusal for the right one.
harness::setup_run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/sync-sources.sh" \
    --no-deps --lock "$fake_root/browser.lock.json" \
    --chromium-src "$chromium" \
    --depot-tools "$fake_root/depot_tools" \
    --ungoogled "$fake_root/.ungoogled-chromium"

before="$(harness::manifest "$chromium")"

CHROMIUM_HEAD="$(git -C "$chromium" rev-parse HEAD)"

# --- The gate runs, and passes, against the checkout the lock describes ------
#
# The control. Every refusal below is satisfied by a build.sh that refuses
# unconditionally, and only a run that gets THROUGH the gate tells the two
# apart.

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_status 0 "dry run against the checkout the lock names"
harness::assert_output_contains "Verifying source revisions" "the lock gate runs"
harness::assert_output_contains "gn gen" "a satisfied gate lets the build proceed"
harness::assert_output_lacks "gn was executed during a dry run" "dry run must not invoke gn"
harness::assert_tree_unchanged "$chromium" "$before"

# The gate must run BEFORE the input checks, not merely at some point: a build
# that validated inputs first would spend its time on a tree it was going to
# reject anyway, and — worse — would report an input problem as the reason a
# drifted checkout failed.
gate_line="$(grep -nF 'Verifying source revisions' "$RUN_STDOUT" "$RUN_STDERR" | head -1 | cut -d: -f2)"
bundles_line="$(grep -nF 'Checking required WebUI bundles' "$RUN_STDOUT" "$RUN_STDERR" | head -1 | cut -d: -f2)"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
for line_number in "$gate_line" "$bundles_line"; do
    case "$line_number" in
        ''|*[!0-9]*)
            harness::fail "could not locate both ordering lines (gate: '$gate_line', bundles: '$bundles_line')"
            ;;
    esac
done
if [ "$gate_line" -ge "$bundles_line" ]; then
    harness::fail "the lock gate (line $gate_line) does not run before the input checks (line $bundles_line)"
fi

# --- A checkout off the locked revision stops the build ---------------------

harness::write_build_lock "$fake_root" "$chromium" "$ABSENT_COMMIT"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "build against a checkout off the locked revision"
harness::assert_output_contains "wrong commit" "refusal reason"
harness::assert_output_contains "$ABSENT_COMMIT" "the refusal names the commit the lock demanded"
harness::assert_output_contains "$CHROMIUM_HEAD" "the refusal names the commit on disk"
harness::assert_output_lacks "gn gen" "must fail before build generation"
harness::assert_tree_unchanged "$chromium" "$before"

# --- The override exists for bisecting upstream, and announces itself --------
#
# Being deliberately off-lock is the entire point of a bisect, so the override
# is not a hole to be closed. What it must not be is silent: it prints a
# structured warning, and the same drift lands in the provenance file.

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_status 0 "explicit lock-verification override"
harness::assert_output_contains "override:skip-lock-verify" "structured override warning"
harness::assert_output_lacks "Verifying source revisions" "the override really skipped the gate"
harness::assert_tree_unchanged "$chromium" "$before"

harness::pass
