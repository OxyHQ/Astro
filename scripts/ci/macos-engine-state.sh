#!/usr/bin/env bash
# Carries ~/chromium-build (the patched tree, its out dir and the build's own state) from one CI job to the next.
# ~/chromium-build is an APFS volume in a sparse disk image (~/ci-engine.sparseimage), so packing it is one sequential
# read of that file into zstd parts a CI artifact can carry, not a walk over half a million files (which took 28
# minutes each way). Unpacking also copies this checkout's engine layers into the tree (engine/chromium/apply.sh,
# engine/astrocore/apply.sh: only what differs), so a tree packed from an earlier commit with the same patch series
# resumes with the current code.
#
#   scripts/ci/macos-engine-state.sh mount              make and mount an empty volume at ~/chromium-build
#   scripts/ci/macos-engine-state.sh pack <dir>         unmount it and pack the image into <dir>
#   GH_TOKEN=… scripts/ci/macos-engine-state.sh fetch <dir> <run id> <artifact name>
#   scripts/ci/macos-engine-state.sh unpack <dir>       mount the packed image (or a packed tar of the tree)
#
# fetch reads the parts straight out of the artifact's zip with ranged requests, 8 at a time, through the zip's central
# directory, and checks every part's SHA-256. Streaming unzippers (actions/download-artifact, ditto) can't find the end
# of a stored entry with a data descriptor: download-artifact@v4 reported success with 5 of 7 parts on disk.
set -euo pipefail

usage() { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit "${1:-0}"; }
[[ "${1:-}" == -h || "${1:-}" == --help ]] && usage
[[ ( $# == 1 && $1 == mount ) || $# == 2 || ( $# == 4 && $1 == fetch ) ]] || usage 64
mode=$1 dir=${2:-}
repo=$(cd "$(dirname "$0")/../.." && pwd)
cb="$HOME/chromium-build"
image="$HOME/ci-engine.sparseimage"

mounted() { mount | grep -qF " on $(cd "$cb" 2>/dev/null && pwd -P) ("; }
attach() {
  mkdir -p "$cb"
  hdiutil attach "$image" -nobrowse -noautoopen -owners on -mountpoint "$cb" >/dev/null
  sudo mdutil -i off "$cb" >/dev/null 2>&1 || true
  touch "$cb/.metadata_never_index"
}
new_volume() {
  rm -rf "$cb" "$image"
  hdiutil create -size 250g -type SPARSE -fs APFS -volname chromium-build "${image%.sparseimage}" >/dev/null
  attach
}

case $mode in
  mount)
    mounted || new_volume
    df -h "$cb" | tail -1
    ;;
  pack)
    mounted || { echo "~/chromium-build isn't the volume in $image" >&2; exit 1; }
    mkdir -p "$dir"
    rm -f "$dir"/state.*
    start=$(date +%s)
    sync
    for attempt in 1 2 3 4 5; do
      hdiutil detach "$cb" >/dev/null 2>&1 && break
      [[ $attempt == 5 ]] && hdiutil detach "$cb" -force
      sleep 10
    done
    zstd -T0 -3 -q <"$image" | split -b 1900m - "$dir/state.img.zst."
    (cd "$dir" && shasum -a 256 state.img.zst.* >state.sha256)
    echo "packed $(du -h "$image" | cut -f1) of image into $(du -sh "$dir" | cut -f1) in $(( $(date +%s) - start )) s"
    ;;
  fetch)
    run=$3 name=$4
    id=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run/artifacts?name=$name" --jq '.artifacts[0].id // empty')
    [[ -n "$id" ]] || { echo "no artifact $name in run $run" >&2; exit 1; }
    for attempt in 1 2 3; do
      start=$(date +%s)
      rm -rf "$dir" && mkdir -p "$dir"
      url=$(curl -fsS --retry 5 -o /dev/null -w '%{redirect_url}' -H "Authorization: Bearer $GH_TOKEN" \
        "https://api.github.com/repos/$GITHUB_REPOSITORY/actions/artifacts/$id/zip") || url=""
      if [[ -n "$url" ]] && python3 -I - "$url" "$dir" <<'PY' && (cd "$dir" && shasum -a 256 -c --quiet state.sha256); then
import concurrent.futures, io, os, sys, time, urllib.request, zipfile

url, out = sys.argv[1], sys.argv[2]
chunk = 64 << 20


def fetch(start, end):
    for attempt in range(8):
        try:
            request = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}'})
            data = urllib.request.urlopen(request, timeout=120).read()
            if len(data) == end - start + 1:
                return data
        except OSError as e:
            print(f'range {start}-{end}: {e}', file=sys.stderr)
        time.sleep(2 ** attempt)
    raise SystemExit(f'range {start}-{end} kept failing')


class Remote(io.RawIOBase):
    def __init__(self):
        self.pos = 0
        head = urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=0-0'}), timeout=60)
        self.size = int(head.headers['Content-Range'].rsplit('/', 1)[1])

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def readinto(self, buffer):
        end = min(self.size, self.pos + len(buffer)) - 1
        if end < self.pos:
            return 0
        data = fetch(self.pos, end)
        buffer[:len(data)] = data
        self.pos += len(data)
        return len(data)


remote = Remote()
archive = zipfile.ZipFile(io.BufferedReader(remote, 1 << 20))
jobs = []
for entry in archive.infolist():
    if entry.compress_type != zipfile.ZIP_STORED:
        raise SystemExit(f'{entry.filename} is compressed; expected stored parts')
    remote.seek(entry.header_offset + 26)
    name_len, extra_len = int.from_bytes(remote.read(2), 'little'), int.from_bytes(remote.read(2), 'little')
    data_start = entry.header_offset + 30 + name_len + extra_len
    path = os.path.join(out, os.path.basename(entry.filename))
    with open(path, 'wb') as f:
        f.truncate(entry.file_size)
    for offset in range(0, entry.file_size, chunk):
        jobs.append((path, offset, data_start + offset, min(entry.file_size, offset + chunk) - 1 + data_start))


def get(job):
    path, offset, start, end = job
    data = fetch(start, end)
    with open(path, 'r+b') as f:
        f.seek(offset)
        f.write(data)
    return len(data)


with concurrent.futures.ThreadPoolExecutor(8) as pool:
    total = sum(pool.map(get, jobs))
print(f'{len(archive.infolist())} files, {total >> 20} MB')
PY
        echo "fetched $(du -sh "$dir" | cut -f1) from run $run in $(( $(date +%s) - start )) s"
        exit 0
      fi
      echo "::warning::fetching $name (attempt $attempt) failed"
    done
    exit 1
    ;;
  unpack)
    start=$(date +%s)
    (cd "$dir" && shasum -a 256 -c --quiet state.sha256)
    if mounted; then hdiutil detach "$cb" -force >/dev/null; fi
    if compgen -G "$dir/state.img.zst.*" >/dev/null; then
      rm -rf "$cb" "$image"
      cat "$dir"/state.img.zst.* | zstd -d -q -o "$image"
      rm -rf "$dir"
      attach
    else
      new_volume
      cat "$dir"/state.tar.zst.* | zstd -d -q | tar -C "$HOME" -xf -
      rm -rf "$dir"
    fi
    echo "unpacked $(du -sh "$cb" 2>/dev/null | cut -f1) in $(( $(date +%s) - start )) s (from $(cat "$cb/ci-source-commit" 2>/dev/null || echo "an unknown commit"))"
    src="$cb/chromium_git/chromium/src"
    for layer in chromium astrocore; do
      "$repo/scripts/agent/locked" chromium --wait 60 -- env CHROMIUM_SRC="$src" "$repo/engine/$layer/apply.sh"
    done
    git -C "$repo" rev-parse HEAD >"$cb/ci-source-commit"
    df -h / | tail -1
    ;;
  *) usage 64 ;;
esac
