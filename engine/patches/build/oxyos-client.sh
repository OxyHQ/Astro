#!/usr/bin/env bash
# Stages OxyOS's display client into the Chromium tree's third_party/oxyos_client (untracked there), for the OxyOS
# Ozone platform (engine/oxyos): include/oxyos_client.h, the C ABI, and oxyos_client.o, OxyOS's oxyos-client-ffi
# built at the commit engine/oxyos/oxyos-pin names and linked into one relocatable object whose only global symbols
# are that ABI's (oxyos_client_* and oxyos_last_error), so its Rust runtime stays private and never meets Chromium's.
# Step 5 runs it on Linux. OXYOS_DIR is the OxyOS checkout (default ~/chromium-build/oxyos), at the pinned commit with
# no local changes; nothing is rebuilt when the staged copy already is that commit's.
set -euo pipefail
case "${1:-}" in
  -h | --help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
  --apply) ;;
  *) echo "oxyos-client.sh: pass --apply to stage the OxyOS client (--help for usage)" >&2; exit 64 ;;
esac
[[ -n "${CHROMIUM_SRC:-}" ]] || { echo "oxyos-client.sh: set CHROMIUM_SRC to the tree to write" >&2; exit 64; }
source "$(dirname "$0")/env.sh"
[[ $AC_PLATFORM == linux ]] || exit 0
tree="$(cd "$CHROMIUM_SRC" 2>/dev/null && pwd -P)" || { echo "oxyos-client.sh: no tree at $CHROMIUM_SRC" >&2; exit 64; }
out="$tree/third_party/oxyos_client"
if ! python3 "$(dirname "$0")/pathguard.py" classify "$CHROMIUM_SRC" "$out/oxyos_client.o" >/dev/null; then
  AC_CHROMIUM_BUILD="$(cd "$tree/../../.." && pwd -P)" source "$(dirname "$0")/step-guard.sh" --apply
fi
pin=$(tr -d '[:space:]' <"$AC_REPO/engine/oxyos/oxyos-pin")
oxyos="${OXYOS_DIR:-$CB/oxyos}"
[[ -f "$oxyos/crates/oxyos-client-ffi/Cargo.toml" ]] || { echo "oxyos-client.sh: no OxyOS checkout at $oxyos (OXYOS_DIR)" >&2; exit 1; }
head=$(git -C "$oxyos" rev-parse HEAD)
[[ "$head" == "$pin" ]] || { echo "oxyos-client.sh: $oxyos is at $head, not the pinned $pin" >&2; exit 1; }
[[ -z "$(git -C "$oxyos" status --porcelain --untracked-files=no -- crates Cargo.toml Cargo.lock rust-toolchain.toml)" ]] || { echo "oxyos-client.sh: $oxyos has local changes" >&2; exit 1; }
if [[ -f "$out/PIN" && "$(cat "$out/PIN")" == "$pin" && -f "$out/oxyos_client.o" ]] && cmp -s "$oxyos/crates/oxyos-client-ffi/include/oxyos_client.h" "$out/include/oxyos_client.h"; then
  exit 0
fi
llvm="$tree/third_party/llvm-build/Release+Asserts/bin"
(cd "$oxyos" && env -u CARGO_TARGET_DIR -u RUSTFLAGS cargo build --release --locked -p oxyos-client-ffi)
work=$(mktemp -d "$out.XXXXXX")
trap 'rm -rf "$work"' EXIT
"$llvm/ld.lld" -r --undefined-glob='oxyos_client_*' -u oxyos_last_error -o "$work/linked.o" "$oxyos/target/release/liboxyos_client_ffi.a"
"$llvm/llvm-objcopy" --wildcard --keep-global-symbol='oxyos_client_*' --keep-global-symbol=oxyos_last_error "$work/linked.o" "$work/oxyos_client.o"
leaked=$("$llvm/llvm-nm" -g --defined-only "$work/oxyos_client.o" | awk '{print $NF}' | grep -v -e '^oxyos_client_' -e '^oxyos_last_error$' || true)
[[ -z "$leaked" ]] || { echo "oxyos-client.sh: global symbols beyond the C ABI: $leaked" >&2; exit 1; }
mkdir -p "$out/include"
cp "$oxyos/crates/oxyos-client-ffi/include/oxyos_client.h" "$out/include/oxyos_client.h"
mv -f "$work/oxyos_client.o" "$out/oxyos_client.o"
printf '%s\n' "$pin" >"$out/PIN"
