#!/usr/bin/env python3
"""Undo domain substitution for the files in domsub-keep-store.txt, using the
pre-substitution copies in domsubcache.tar.gz. Only files whose content still
matches what substitution produced are restored (anything edited since is
reported and left alone). Touches restored files so they rebuild."""
import fnmatch, os, pathlib, subprocess, sys, tarfile, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pathguard  # noqa: E402

CB = pathlib.Path(os.environ.get('AC_CHROMIUM_BUILD') or pathlib.Path.home() / 'chromium-build')

if {'-h', '--help'} & set(sys.argv[1:]):
    print(__doc__)
    sys.exit(0)
if '--apply' not in sys.argv[1:]:
    sys.exit('domsub-restore-store.py: it changes ~/chromium-build: pass --apply (--help for usage)')


def holds_lock_for(path):
    if pathguard.reaches(path):
        return pathguard.real_lock_held()
    return pathguard.chromium_lock_held()


def real_chromium_build():
    return pathguard.real_chromium_build()


if not holds_lock_for(CB):
    sys.exit('domsub-restore-store.py: hold the chromium lock (the real one for the real ~/chromium-build): '
             'scripts/agent/locked chromium --as <you> -- ... --apply')
SRC = CB / 'chromium_git/chromium/src'
patterns = [l.strip() for l in (CB / 'scripts/domsub-keep-store.txt').read_text().splitlines()
            if l.strip() and not l.startswith('#')]
with tarfile.open(CB / 'domsubcache.tar.gz') as tar:
    index = {}
    for line in tar.extractfile('cache_index.list').read().decode().splitlines():
        path, crc = line.rsplit('|', 1)
        index[path] = int(crc, 16)
    restored, changed = [], []
    for path, crc in index.items():
        if not any(fnmatch.fnmatch(path, p) for p in patterns):
            continue
        f = SRC / path
        cur = f.read_bytes()
        if zlib.crc32(cur) != crc:
            changed.append(path)
            continue
        pathguard.require_tree_writable(str(SRC), [path], 'domsub-restore-store.py')
        f.unlink()
        f.write_bytes(tar.extractfile('orig/' + path).read())
        restored.append(path)
print('restored:', *restored, sep='\n  ')
if changed:
    print('edited after substitution (left alone, check by hand):', *changed, sep='\n  ')
