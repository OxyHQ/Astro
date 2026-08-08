#!/usr/bin/env bash
# fetch-chromium.sh — DEPRECATED. Use tools/sync-sources.sh.
#
# This script used to decide, on its own, which Chromium got compiled: it read
# CHROMIUM_VERSION from its own default, ran an unconstrained `git pull` in
# depot_tools, string-built .gclient per invocation, and checked Chromium out
# onto a BRANCH (`git checkout tags/$VERSION -B astro-$VERSION`) that could
# drift afterwards with nothing noticing.
#
# tools/sync-sources.sh replaces all of it: browser.lock.json declares the
# exact commit of every source, depot_tools is pinned before anything invokes
# gclient, .gclient is rendered from a committed template, and the checkout is
# detached at the locked commit and verified afterwards.
#
# This wrapper exists so that a documented command, a stale runbook or an old
# CI job cannot silently reintroduce the previous behaviour. It delegates.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

astro::warn "deprecated:fetch-chromium" \
    "tools/fetch-chromium.sh is deprecated; delegating to tools/sync-sources.sh"

if [ -n "${CHROMIUM_VERSION:-}" ]; then
    LOCKED_VERSION="$(python3 "$ASTRO_ROOT/tools/lib/lock.py" --get chromium.version)"
    if [ "$CHROMIUM_VERSION" != "$LOCKED_VERSION" ]; then
        astro::die_with_hint \
            "CHROMIUM_VERSION=$CHROMIUM_VERSION conflicts with the lock ($LOCKED_VERSION)." \
            "" \
            "An environment variable no longer selects what gets compiled — that is" \
            "the whole point of browser.lock.json. To change version:" \
            "" \
            "  tools/update-chromium.sh $CHROMIUM_VERSION" \
            "" \
            "which resolves it to an exact commit, updates the lock and writes a" \
            "change report for review."
    fi
fi

TARGETS=""
for arg in "$@"; do
    case "$arg" in
        --targets=*) TARGETS="${arg#*=}" ;;
        *) astro::die "Unknown argument: $arg (tools/sync-sources.sh --help lists the current options)" ;;
    esac
done

if [ -n "$TARGETS" ]; then
    exec "$ASTRO_ROOT/tools/sync-sources.sh" --targets "$TARGETS"
fi
exec "$ASTRO_ROOT/tools/sync-sources.sh"
