#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

# Downloads the Windows SDK and MSVC CRT from Microsoft's servers using xwin,
# then sets up everything Chromium's build system needs for cross-compilation.
#
# No Google account or GCS access required - everything comes from Microsoft's
# public Visual Studio manifest (https://aka.ms/vs/manifest).
#
# Usage:
#   tools/setup-win-sdk.sh           # Download and set up Windows SDK
#   tools/setup-win-sdk.sh --clean   # Remove downloaded SDK
#
# After setup, build with:
#   tools/build.sh Release windows        # Windows x64
#   tools/build.sh Release windows-arm64  # Windows ARM64

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_SRC="$ASTRO_ROOT/chromium/src"
XWIN_VERSION="0.6.5"
XWIN_DIR="$ASTRO_ROOT/.xwin"
XWIN_BIN="$XWIN_DIR/xwin"
TOOLCHAIN_ROOT="$ASTRO_ROOT/win-sdk"

if [ "${1:-}" = "--clean" ]; then
    echo "Removing Windows SDK..."
    rm -rf "$TOOLCHAIN_ROOT" "$XWIN_DIR"
    rm -f "$CHROMIUM_SRC/build/win_toolchain.json"
    echo "Done."
    exit 0
fi

echo "=== Setting up Windows SDK for cross-compilation ==="

# --- Step 1: Download xwin ---
if [ ! -f "$XWIN_BIN" ]; then
    echo ""
    echo ">>> Downloading xwin $XWIN_VERSION..."
    mkdir -p "$XWIN_DIR"

    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  XWIN_ARCH="x86_64-unknown-linux-musl" ;;
        aarch64) XWIN_ARCH="aarch64-unknown-linux-musl" ;;
        *)       echo "ERROR: Unsupported host architecture: $ARCH"; exit 1 ;;
    esac

    XWIN_URL="https://github.com/Jake-Shadle/xwin/releases/download/$XWIN_VERSION/xwin-$XWIN_VERSION-$XWIN_ARCH.tar.gz"
    curl -L "$XWIN_URL" | tar xz -C "$XWIN_DIR" --strip-components=1
    chmod +x "$XWIN_BIN"
    echo "  xwin installed"
else
    echo ">>> xwin already installed"
fi

# --- Step 2: Download SDK and CRT from Microsoft ---
echo ""
echo ">>> Downloading Windows SDK and MSVC CRT from Microsoft..."

rm -rf "$TOOLCHAIN_ROOT"

# --use-winsysroot-style produces the exact layout Chromium expects:
#   VC/Tools/MSVC/<version>/  and  Windows Kits/10/
# --preserve-ms-arch-notation keeps x64/arm64 names (not x86_64/aarch64)
"$XWIN_BIN" \
    --accept-license \
    --cache-dir "$XWIN_DIR/cache" \
    --arch x86,x86_64,aarch64 \
    --include-atl \
    splat \
    --output "$TOOLCHAIN_ROOT" \
    --preserve-ms-arch-notation \
    --use-winsysroot-style \
    --include-debug-libs \
    || xwin_status=$?

# xwin exits non-zero on non-critical MSI packages while still producing a
# usable toolchain, so this failure is tolerated — but it is reported, and the
# version detection below is what actually decides whether the download worked.
if [ "${xwin_status:-0}" -ne 0 ]; then
    astro::warn "optional:xwin-partial" \
        "xwin exited $xwin_status; verifying the toolchain is usable below"
fi

echo "  Download complete"

# --- Step 3: Detect versions ---
astro::require_dir "$TOOLCHAIN_ROOT/VC/Tools/MSVC" "MSVC toolchain (xwin download failed)"
MSVC_VERSION="$(find "$TOOLCHAIN_ROOT/VC/Tools/MSVC" -mindepth 1 -maxdepth 1 -type d \
    -printf '%f\n' | sort | head -1)"
if [ -z "$MSVC_VERSION" ]; then
    echo "ERROR: MSVC not found. xwin download may have failed."
    exit 1
fi

astro::require_dir "$TOOLCHAIN_ROOT/Windows Kits/10/include" "Windows SDK (xwin download failed)"
SDK_VERSION="$(find "$TOOLCHAIN_ROOT/Windows Kits/10/include" -mindepth 1 -maxdepth 1 -type d \
    -printf '%f\n' | sort | head -1)"
if [ -z "$SDK_VERSION" ]; then
    echo "ERROR: Windows SDK not found. xwin download may have failed."
    exit 1
fi

echo "  MSVC version: $MSVC_VERSION"
echo "  SDK version: $SDK_VERSION"

# --- Step 4: Create additional directories Chromium expects ---
echo ""
echo ">>> Setting up Chromium-compatible layout..."

WIN_KITS="$TOOLCHAIN_ROOT/Windows Kits/10"
MSVC_DIR="$TOOLCHAIN_ROOT/VC/Tools/MSVC/$MSVC_VERSION"

# Runtime DLL directories (referenced in win_toolchain.json)
mkdir -p "$TOOLCHAIN_ROOT/sys64" "$TOOLCHAIN_ROOT/sys32" "$TOOLCHAIN_ROOT/sysarm64"

# MSVC runtime DLLs (stubs - actual DLLs ship with Windows, not needed for compilation)
RUNTIME_DLLS="msvcp140.dll msvcp140_atomic_wait.dll vccorlib140.dll vcruntime140.dll vcruntime140_1.dll"
for dll in $RUNTIME_DLLS; do
    touch "$TOOLCHAIN_ROOT/sys64/$dll"
    touch "$TOOLCHAIN_ROOT/sys32/$dll"
    touch "$TOOLCHAIN_ROOT/sysarm64/$dll"
done

# VC Redist directories (installer packaging expects these)
for arch in x86 x64 arm64; do
    mkdir -p "$TOOLCHAIN_ROOT/VC/Redist/MSVC/$MSVC_VERSION/$arch/Microsoft.VC143.CRT"
    mkdir -p "$TOOLCHAIN_ROOT/VC/Redist/MSVC/$MSVC_VERSION/debug_nonredist/$arch/Microsoft.VC143.DebugCRT"
    for dll in $RUNTIME_DLLS; do
        touch "$TOOLCHAIN_ROOT/VC/Redist/MSVC/$MSVC_VERSION/$arch/Microsoft.VC143.CRT/$dll"
        base="${dll%.dll}"
        touch "$TOOLCHAIN_ROOT/VC/Redist/MSVC/$MSVC_VERSION/debug_nonredist/$arch/Microsoft.VC143.DebugCRT/${base}d.dll"
    done
done

# MSVC tool stubs (Chromium uses clang-cl/lld-link, not cl.exe/link.exe,
# but setup_toolchain.py needs these files to exist for path resolution)
for target in x86 x64 arm64; do
    dir="$MSVC_DIR/bin/HostX64/$target"
    mkdir -p "$dir"
    touch "$dir/cl.exe" "$dir/link.exe" "$dir/lib.exe" "$dir/ml64.exe"
done

# SDK bin tools (rc.exe, midl.exe stubs)
mkdir -p "$WIN_KITS/bin/$SDK_VERSION/x64"
touch "$WIN_KITS/bin/$SDK_VERSION/x64/rc.exe"
touch "$WIN_KITS/bin/$SDK_VERSION/x64/midl.exe"

# Debugger DLLs (stubs for dbghelp, used in crash reporting)
for arch in x86 x64 arm64; do
    mkdir -p "$WIN_KITS/Debuggers/$arch"
    touch "$WIN_KITS/Debuggers/$arch/dbghelp.dll"
    touch "$WIN_KITS/Debuggers/$arch/dbgcore.dll"
    touch "$WIN_KITS/Debuggers/$arch/symsrv.dll"
done

# DIA SDK (Debug Interface Access - PDB handling)
mkdir -p "$TOOLCHAIN_ROOT/DIA SDK/bin/amd64"
mkdir -p "$TOOLCHAIN_ROOT/DIA SDK/bin/arm64"
mkdir -p "$TOOLCHAIN_ROOT/DIA SDK/lib/amd64"
mkdir -p "$TOOLCHAIN_ROOT/DIA SDK/lib/arm64"
touch "$TOOLCHAIN_ROOT/DIA SDK/bin/amd64/msdia140.dll"
touch "$TOOLCHAIN_ROOT/DIA SDK/bin/arm64/msdia140.dll"
touch "$TOOLCHAIN_ROOT/DIA SDK/lib/amd64/msdia140.lib"
touch "$TOOLCHAIN_ROOT/DIA SDK/lib/arm64/msdia140.lib"

# Direct3D compiler redistributable (used by ANGLE at runtime)
for arch in x86 x64 arm64; do
    mkdir -p "$WIN_KITS/Redist/D3D/$arch"
    touch "$WIN_KITS/Redist/D3D/$arch/d3dcompiler_47.dll"
done

# Metadata
echo "2022" > "$TOOLCHAIN_ROOT/VS_VERSION"
mkdir -p "$TOOLCHAIN_ROOT/wdk"

# --- Step 5: Generate SetEnv JSON files ---
echo ">>> Generating SetEnv configuration..."

for target_arch in x86 x64 arm64; do
    cat > "$WIN_KITS/bin/SetEnv.$target_arch.json" << SETENV_EOF
{
  "env": {
    "VSINSTALLDIR": [[".\\\\" ]],
    "VCINSTALLDIR": [["VC\\\\" ]],
    "VCToolsInstallDir": [["VC", "Tools", "MSVC", "$MSVC_VERSION", ""]],
    "INCLUDE": [
      ["Windows Kits", "10", "include", "$SDK_VERSION", "um"],
      ["Windows Kits", "10", "include", "$SDK_VERSION", "shared"],
      ["Windows Kits", "10", "include", "$SDK_VERSION", "winrt"],
      ["Windows Kits", "10", "include", "$SDK_VERSION", "ucrt"],
      ["VC", "Tools", "MSVC", "$MSVC_VERSION", "include"]
    ],
    "PATH": [
      ["Windows Kits", "10", "bin", "$SDK_VERSION", "x64"],
      ["VC", "Tools", "MSVC", "$MSVC_VERSION", "bin", "HostX64", "$target_arch"]
    ],
    "LIB": [
      ["VC", "Tools", "MSVC", "$MSVC_VERSION", "lib", "$target_arch"],
      ["Windows Kits", "10", "lib", "$SDK_VERSION", "um", "$target_arch"],
      ["Windows Kits", "10", "lib", "$SDK_VERSION", "ucrt", "$target_arch"]
    ]
  }
}
SETENV_EOF
done

# --- Step 6: Generate win_toolchain.json ---
echo ">>> Writing win_toolchain.json..."

cat > "$CHROMIUM_SRC/build/win_toolchain.json" << JSON_EOF
{
  "path": "$TOOLCHAIN_ROOT",
  "version": "2022",
  "win_sdk": "$WIN_KITS",
  "wdk": "$TOOLCHAIN_ROOT/wdk",
  "runtime_dirs": [
    "$TOOLCHAIN_ROOT/sys64",
    "$TOOLCHAIN_ROOT/sys32",
    "$TOOLCHAIN_ROOT/sysarm64"
  ]
}
JSON_EOF

# --- Step 7: Ensure ciopfs is available ---
CIOPFS="$CHROMIUM_SRC/build/ciopfs"
if [ ! -f "$CIOPFS" ]; then
    echo ">>> Downloading ciopfs..."
    astro::require_file "$CHROMIUM_SRC/build/ciopfs.sha1" "ciopfs hash file"
    CIOPFS_SHA="$(cat "$CHROMIUM_SRC/build/ciopfs.sha1")"
    if [ -n "$CIOPFS_SHA" ]; then
        curl -sL "https://storage.googleapis.com/chromium-browser-clang/ciopfs/$CIOPFS_SHA" -o "$CIOPFS"
        chmod +x "$CIOPFS"
    fi
fi

# --- Verify ---
echo ""
echo "=== Verification ==="

for dir in \
    "$MSVC_DIR/include" \
    "$MSVC_DIR/lib/x64" \
    "$MSVC_DIR/lib/arm64" \
    "$WIN_KITS/include/$SDK_VERSION/um" \
    "$WIN_KITS/include/$SDK_VERSION/ucrt" \
    "$WIN_KITS/lib/$SDK_VERSION/um/x64" \
    "$WIN_KITS/lib/$SDK_VERSION/ucrt/x64"; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -maxdepth 1 -type f | wc -l)
        short="${dir#"$TOOLCHAIN_ROOT"/}"
        echo "  OK  $short ($count files)"
    else
        echo "  MISSING  ${dir#"$TOOLCHAIN_ROOT"/}"
    fi
done

echo ""
echo "=== Windows SDK ready ==="
echo ""
echo "Build with:"
echo "  DEPOT_TOOLS_WIN_TOOLCHAIN=1 tools/build.sh Release windows"
echo "  DEPOT_TOOLS_WIN_TOOLCHAIN=1 tools/build.sh Release windows-arm64"
