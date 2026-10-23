#!/usr/bin/env python3
"""Move the live Chromium tree from ungoogled-chromium to Helium without a sync: plan in scratch, then swap in place.

  helium-swap-plan.py plan --out DIR [--series-repo CHECKOUT] [--extra LIST]… [--base-copy DIR] [--no-brand]
      Builds the target tree in DIR/target from the live tree's own git objects (read only): every file Helium,
      ungoogled-chromium, either domain substitution, name substitution, the resources or our series could touch,
      as pristine Chromium, then 03-helium.py, series.py capture-base (DIR/series-base), our series and layers
      (applied strictly here, never through series.py apply, which writes the live tree's offline game), the
      offline game, and series.py check (which must reproduce DIR/target). DIR/base is the tree before our series.
      A file outside git (a hook's download) is taken from the live tree, or from the domain substitution cache
      when substitution changed it and no patch did. Records DIR/baseline.tsv (every compared path as the live
      tree has it: type, sha256, mode), DIR/changes.tsv (write, create, delete, mode), DIR/revisions.json (every
      gclient repo's HEAD) and the live tree's device and inode. Only when every check passes does it publish
      DIR/plan.json and DIR/swap.sh (phase E's commands, in order). --out and --base-copy must be new, empty or one
      this tool made (its marker's random id, matching plan.json's), not a symlink, and may not overlap the live
      tree, ~/chromium-build or a checkout. Writes nothing else.
  helium-swap-plan.py verify --plan DIR --expect before|after
      Checks the live tree is exactly as the plan found it (before) or as the plan leaves it (after): the same
      directory (device, inode), every baseline path's type, bytes and mode, every repo's HEAD, and no modified file
      outside the plan.
  helium-swap-plan.py apply --plan DIR --backup TARBALL
      Refuses an unpublished plan, a plan for another tree, a changed engine/ or offline game, a --no-brand plan
      or (for the real tree) a caller that doesn't hold the chromium lock. Checks "before", writes TARBALL (each
      file it changes, as a regular file, plus the list of files it creates), then writes, creates, deletes and
      chmods as changes.tsv says through directory descriptors anchored at the live tree, every touched file with a
      new mtime so ninja rebuilds exactly those, and checks "after".
  helium-swap-plan.py rollback --plan DIR --backup TARBALL
      Under the same checks, validates the whole backup against the plan, then puts every file back (new mtimes),
      deletes the created files, puts back out/Release_GN_arm64/args.gn as apply found it (step 2 rewrites it; the
      next ninja run regenerates the build files from it) and checks "before".
  helium-swap-plan.py switch-metadata --stamp STAMP [--undo]
      Under the chromium lock: renames ~/chromium-build's domsubcache.tar.gz, series-base and scripts to
      *.ungoogled-STAMP and the staged *.helium-new to their places, undoing the renames already made if one fails;
      --undo puts the *.ungoogled-STAMP ones back (the Helium ones return to *.helium-new).
  helium-swap-plan.py lock-held
      Exits 0 when a lockf that is an ancestor of this process holds the chromium lock right now.
  helium-swap-plan.py fingerprint
      The hash of engine/ and the offline game (a plan records the one it was made from).

Environment: CHROMIUM_SRC (the live tree, default ~/chromium-build/chromium_git/chromium/src); AC_REPO (the
checkout with the offline game; default the one this file is in); AC_CHROMIUM_BUILD (stands in for
~/chromium-build in switch-metadata and swap.sh, for tests); HELIUM_DIR, HELIUM_MACOS_DIR, UNGOOGLED_DIR,
UNGOOGLED_MACOS_DIR (default ~/chromium-build/{helium,helium-macos,ungoogled,ungoogled-macos}).
"""
import argparse
import contextlib
import hashlib
import io
import json
import os
import pwd
import pathlib
import re
import secrets
import shlex
import shutil
import stat
import subprocess
import sys
import tarfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pathguard  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
REPO = pathlib.Path(os.environ.get('AC_REPO') or HERE.parent.parent.parent).resolve()
ENGINE_REPO = HERE.parent.parent.parent
REAL_CB = pathlib.Path(pwd.getpwuid(os.getuid()).pw_dir) / 'chromium-build'
CB = pathlib.Path(os.environ.get('AC_CHROMIUM_BUILD', REAL_CB))
REAL_LIVE = (REAL_CB / 'chromium_git/chromium/src').resolve()
LIVE = pathlib.Path(os.environ.get('CHROMIUM_SRC', REAL_LIVE)).resolve()
STRING_EXTS = ('.grd', '.grdp', '.xtb')
REPO_FINGERPRINT_PATHS = ['engine', 'apps/browser/assets/offline-game', 'apps/browser/assets/offline-game-pipeline']
OMITTED_DIRS = ['third_party/ublock', 'components/helium_onboarding',
                'third_party/search_engines_data/resources_internal']
GAME = 'components/neterror/resources/game/game.html'
GN_ARGS = 'out/Release_GN_arm64/args.gn'
MARKER = '.helium-swap-scratch'
BAD_PATH_CHARS = set('\x0b\x0c\x1c\x1d\x1e\x85  ')


def env_dir(name, default):
    return pathlib.Path(os.environ.get(name, CB / default)).resolve()


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def escapes(root, rel):
    current = str(root)
    for part in rel.split('/')[:-1]:
        current = os.path.join(current, part)
        try:
            st = os.lstat(current)
        except FileNotFoundError:
            return False
        if not stat.S_ISDIR(st.st_mode):
            return True
    return False


def describe(root, rel):
    if escapes(root, rel):
        return ('escape', '', '')
    path = os.path.join(str(root), rel)
    try:
        st = os.lstat(path)
    except FileNotFoundError:
        return ('absent', '', '')
    if stat.S_ISLNK(st.st_mode):
        return ('symlink', hashlib.sha256(os.readlink(path).encode()).hexdigest(), '')
    if not stat.S_ISREG(st.st_mode):
        return ('other', '', '')
    kind = 'file' if st.st_nlink == 1 else 'hardlink'
    return (kind, sha256(path), f'{st.st_mode & 0o777:o}')


def safe_rel(path):
    parts = path.split('/')
    if not path or any(part in ('', '.', '..') for part in parts) or \
            any(ord(c) < 32 or c in BAD_PATH_CHARS for c in path):
        raise SystemExit(f'refusing path {path!r}')
    return path


def patch_paths(path):
    out = set()
    for line in open(path, encoding='utf-8', errors='replace'):
        m = re.match(r'^(?:\+\+\+|---) (?:[ab]/)?(\S+)', line)
        if m and m.group(1) != '/dev/null':
            out.add(m.group(1))
    return out


def created_paths(path):
    out, new = set(), False
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('--- '):
            new = line.strip() == '--- /dev/null'
        m = re.match(r'^\+\+\+ (?:b/)?(\S+)', line)
        if m and new:
            out.add(m.group(1))
    return out


def series_lines(path):
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            yield line


def resource_dests(listing):
    if not listing.exists():
        return set()
    out = set()
    for line in listing.read_text().splitlines():
        parts = line.split()
        if len(parts) == 2 and not line.lstrip().startswith('#'):
            out.add(parts[1])
    return out


class Repos:
    def __init__(self, live):
        self.live = live
        self.cache = {}

    def root_of(self, path):
        parts = path.split('/')
        for i in range(len(parts) - 1, 0, -1):
            d = '/'.join(parts[:i])
            if d in self.cache:
                if self.cache[d] is not None:
                    return self.cache[d]
                continue
            self.cache[d] = d if (self.live / d / '.git').exists() else None
            if self.cache[d] is not None:
                return d
        return ''

    def all_roots(self):
        if not (self.live / '.git').exists():
            return []
        entries = self.live.parent / '.gclient_entries'
        roots = ['']
        if entries.exists():
            scope = {}
            exec(compile(entries.read_text(), str(entries), 'exec'), scope)
            for name in scope.get('entries', {}):
                if ':' in name or not name.startswith('src/'):
                    continue
                rel = name[4:]
                if (self.live / rel / '.git').exists():
                    roots.append(rel)
        return roots


def git_lines(cwd, *args):
    p = subprocess.run(['git', '--no-optional-locks', '-C', str(cwd), *args], capture_output=True)
    if p.returncode:
        raise SystemExit(f'git {" ".join(args)} in {cwd}: {p.stderr.decode()}')
    return [l for l in p.stdout.decode('utf-8', 'surrogateescape').split('\0') if l]


def revisions(live, repos):
    out = {}
    for root in repos.all_roots():
        p = subprocess.run(['git', '--no-optional-locks', '-C', str(live / root), 'rev-parse', 'HEAD'],
                           capture_output=True, text=True)
        if p.returncode:
            raise SystemExit(f'git rev-parse HEAD in {live / root}: {p.stderr}')
        out[root] = p.stdout.strip()
    return out


def live_modified(live, repos):
    out = set()
    for root in repos.all_roots():
        prefix = f'{root}/' if root else ''
        fields = git_lines(live / root, 'status', '--porcelain', '-z', '-uno')
        i = 0
        while i < len(fields):
            entry = fields[i]
            code, path = entry[:2], entry[3:]
            out.add(safe_rel(prefix + path))
            if 'R' in code or 'C' in code:
                i += 1
                out.add(safe_rel(prefix + fields[i]))
            i += 1
    return out


def candidate_paths(args, live, repos, hc, hm, ug, ugm):
    sets = {}
    sets['helium patches'] = set().union(*(patch_paths(r / 'patches' / n) for r in (hc, hm)
                                           for n in series_lines(r / 'patches/series')))
    ug_paths = set().union(*(patch_paths(ug / 'patches' / n) for n in series_lines(ug / 'patches/series')))
    ug_paths |= patch_paths(ugm / 'patches/ungoogled-chromium/macos/fix-disabling-safebrowsing.patch')
    sets['ungoogled patches'] = ug_paths
    created = [ug / 'patches' / n for n in series_lines(ug / 'patches/series')]
    created += [r / 'patches' / n for r in (hc, hm) for n in series_lines(r / 'patches/series')]
    for checkout in dict.fromkeys([args.series_repo, REPO]):
        ours_dir = checkout / 'engine/patches'
        created += [ours_dir / l.split()[1] for l in series_lines(ours_dir / 'series') if l.startswith('chromium ')]
    args.created = set().union(*(created_paths(p) for p in created))
    sets['domain substitution'] = set(series_lines(hc / 'domain_substitution.list')) | set(
        series_lines(ug / 'domain_substitution.list'))
    strings = set()
    for root in repos.all_roots():
        prefix = f'{root}/' if root else ''
        for rel in git_lines(live / root, 'ls-files', '-z', '--', *(f'*{e}' for e in STRING_EXTS)):
            strings.add(prefix + rel)
    sets['string files'] = strings
    sets['grit'] = {p for p in git_lines(live, 'ls-files', '-z', 'tools/grit')}
    sets['resources'] = (resource_dests(hc / 'resources/helium_resources.txt')
                         | resource_dests(hm / 'resources/platform_resources.txt')
                         | resource_dests(HERE / 'astro_resources.txt'))
    ours, layer_dirs = set(), []
    for checkout in dict.fromkeys([args.series_repo, REPO]):
        p = subprocess.run([sys.executable, str(checkout / 'engine/patches/series.py'), 'files'],
                           capture_output=True, text=True, check=True)
        for line in p.stdout.splitlines():
            if line.startswith('  '):
                path = line.strip()
                if path.endswith('/'):
                    layer_dirs.append(path.rstrip('/'))
                else:
                    ours.add(path)
    sets['our series'] = ours
    sets['fixed'] = {'OWNERS', 'chrome/VERSION', GAME}
    extra = set()
    for listing in args.extra:
        listing = pathlib.Path(listing)
        if listing.exists():
            extra |= set(series_lines(listing))
    sets['extra'] = extra
    for paths in sets.values():
        for p in paths:
            safe_rel(p)
    return sets, list(dict.fromkeys(layer_dirs))


def fill_outside_git(live, absent, created, touched_upstream, out):
    from_cache, from_live, missing = 0, 0, []
    pending = {p for p in absent if p not in created}
    unknown = sorted(pending & touched_upstream)
    pending -= touched_upstream
    cache = REAL_CB / 'domsubcache.tar.gz'
    if cache.exists() and pending:
        with tarfile.open(cache) as tar:
            for member in tar:
                rel = member.name[len('orig/'):] if member.name.startswith('orig/') else None
                if rel in pending and member.isfile():
                    dst = out / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    dst.write_bytes(tar.extractfile(member).read())
                    pending.discard(rel)
                    from_cache += 1
    for rel in sorted(pending):
        src = live / rel
        if not src.is_file() or src.is_symlink():
            missing.append(rel)
            continue
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        from_live += 1
    return from_cache, from_live, missing, unknown


def layer_names(series_repo):
    names = []
    for raw in (series_repo / 'engine/patches/series').read_text().splitlines():
        kind, _, name = raw.split('#', 1)[0].strip().partition(' ')
        if kind == 'layer':
            names.append(name.strip())
    return names


def files_under(root, rel):
    base = root / rel
    if not base.is_dir():
        return set()
    return {str(p.relative_to(root)) for p in base.rglob('*') if p.is_file() or p.is_symlink()}


def all_files(root):
    out = set()
    for top, _, files in os.walk(root):
        for f in files:
            out.add(os.path.relpath(os.path.join(top, f), root))
    return out


def materialize_pristine(live, repos, paths, out):
    by_repo = {}
    for path in paths:
        by_repo.setdefault(repos.root_of(path), []).append(path)
    written, absent = 0, []
    for root, rels in sorted(by_repo.items()):
        prefix = f'{root}/' if root else ''
        wanted = {p[len(prefix):]: p for p in rels}
        entries = {}
        for line in git_lines(live / root, 'ls-tree', '-r', '-z', '--full-tree', 'HEAD'):
            meta, _, rel = line.partition('\t')
            if rel in wanted:
                mode, _, sha = meta.split(' ')
                entries[rel] = (mode, sha)
        absent += [wanted[r] for r in wanted if r not in entries]
        if not entries:
            continue
        order = sorted(entries)
        proc = subprocess.Popen(['git', '--no-optional-locks', '-C', str(live / root), 'cat-file', '--batch'],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        data, _ = proc.communicate(''.join(entries[r][1] + '\n' for r in order).encode())
        stream = io.BytesIO(data)
        for rel in order:
            header = stream.readline().split()
            blob = stream.read(int(header[2]))
            stream.read(1)
            mode = entries[rel][0]
            dst = out / (prefix + rel)
            dst.parent.mkdir(parents=True, exist_ok=True)
            if mode == '120000':
                os.symlink(blob.decode(), dst)
            else:
                dst.write_bytes(blob)
                dst.chmod(0o755 if mode == '100755' else 0o644)
            written += 1
    return written, absent


def run_logged(cmd, log, env=None, cwd=None):
    with open(log, 'a') as f:
        f.write(f'$ {" ".join(map(str, cmd))}\n')
        f.flush()
        p = subprocess.run(list(map(str, cmd)), stdout=f, stderr=subprocess.STDOUT, env=env, cwd=cwd)
    return p.returncode


def repo_fingerprint(engine_repo=ENGINE_REPO):
    h = hashlib.sha256()
    for rel in REPO_FINGERPRINT_PATHS:
        root = engine_repo if rel == 'engine' else REPO
        for p in sorted((root / rel).rglob('*')):
            if p.is_file() and '/.' not in str(p.relative_to(root)):
                h.update(str(p.relative_to(root)).encode() + b'\0')
                h.update(sha256(p).encode())
    return h.hexdigest()


def apply_series(series_repo, scratch, report):
    patches = series_repo / 'engine/patches'
    lines, failed = [], 0
    for raw in (patches / 'series').read_text().splitlines():
        kind, _, name = raw.split('#', 1)[0].strip().partition(' ')
        name = name.strip()
        if kind == 'layer':
            p = subprocess.run([str(series_repo / name / 'apply.sh')], capture_output=True, text=True,
                               env=dict(os.environ, CHROMIUM_SRC=str(scratch)))
            ok = p.returncode == 0
            lines.append(f'{"LAYER" if ok else "LAYER FAIL"} {name}')
            if not ok:
                failed += 1
                lines += ['    ' + l for l in (p.stdout + p.stderr).splitlines() if not l.startswith('hooked')]
            continue
        if kind != 'chromium':
            continue
        patch = str(patches / name)
        if subprocess.run(['git', 'apply', '--check', patch], cwd=scratch, capture_output=True).returncode == 0:
            subprocess.run(['git', 'apply', patch], cwd=scratch, check=True, capture_output=True)
            lines.append(f'CLEAN {name}')
            continue
        failed += 1
        p = subprocess.run(['git', 'apply', '--reject', patch], cwd=scratch, capture_output=True, text=True)
        lines.append(f'CONFLICT {name}')
        lines += ['    ' + l for l in (p.stdout + p.stderr).splitlines() if l.startswith(('error', 'Rejected'))]
    game = scratch / GAME
    game.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.run([sys.executable, str(REPO / 'apps/browser/assets/offline-game-pipeline/inline.py'), str(game)],
                       capture_output=True, text=True)
    lines.append(f'{"GAME" if p.returncode == 0 else "GAME FAIL"} {GAME}')
    failed += p.returncode != 0
    report.write_text('\n'.join(lines) + '\n')
    return failed


def scratch_dir(path, what, protected, enclosing):
    raw = pathlib.Path(os.path.abspath(path))
    if os.path.islink(raw):
        sys.exit(f'{what} {raw} is a symlink: refusing')
    path = pathlib.Path(os.path.realpath(raw))
    hit = pathguard.reaches(path)
    if hit:
        sys.exit(f'{what} {path} reaches {hit} (the real ~/chromium-build): refusing')
    for other in protected:
        other = pathlib.Path(os.path.realpath(other))
        if path == other or path in other.parents or other in path.parents:
            sys.exit(f'{what} {path} overlaps {other}: refusing')
    for other in enclosing:
        other = pathlib.Path(os.path.realpath(other))
        if path == other or path in other.parents:
            sys.exit(f'{what} {path} would contain {other}: refusing')
    if os.path.lexists(path):
        if not path.is_dir():
            sys.exit(f'{what} {path} is not a directory')
        if os.listdir(path):
            marker = path / MARKER
            owned = marker.read_text().strip() if marker.is_file() and not marker.is_symlink() else ''
            if not re.fullmatch(r'helium-swap-plan [0-9a-f]{32}', owned):
                sys.exit(f'{what} {path} is not empty and has no helium-swap-plan marker: refusing to delete it')
            meta = path / 'plan.json'
            if meta.exists() and json.loads(meta.read_text()).get('scratch_id') != owned.split()[1]:
                sys.exit(f'{what} {path}: its plan.json and its marker disagree: refusing to delete it')
        shutil.rmtree(path)
    path.mkdir(parents=True)
    ident = secrets.token_hex(16)
    (path / MARKER).write_text(f'helium-swap-plan {ident}\n')
    return path, ident


def cmd_plan(args):
    live = LIVE
    args.series_repo = pathlib.Path(args.series_repo).resolve()
    series = args.series_repo / 'engine/patches/series.py'
    hc, hm = env_dir('HELIUM_DIR', 'helium'), env_dir('HELIUM_MACOS_DIR', 'helium-macos')
    ug, ugm = env_dir('UNGOOGLED_DIR', 'ungoogled'), env_dir('UNGOOGLED_MACOS_DIR', 'ungoogled-macos')
    protected = [LIVE, REAL_LIVE, CB, REAL_CB, REPO, ENGINE_REPO, args.series_repo, hc, hm, ug, ugm]
    enclosing = [pathlib.Path.home()]
    out, scratch_id = scratch_dir(args.out, '--out', protected, enclosing)
    base_copy, base_copy_id = (scratch_dir(args.base_copy, '--base-copy', protected + [out], enclosing)
                               if args.base_copy else (None, None))
    target, work = out / 'target', out / 'work'
    log = out / 'plan.log'
    started = time.time()
    repos = Repos(live)

    def fail(message):
        (out / 'FAILED').write_text(message + '\n')
        sys.exit(message)

    revs_before = revisions(live, repos)
    sets, layer_dirs = candidate_paths(args, live, repos, hc, hm, ug, ugm)
    candidates = set().union(*sets.values())
    for d in OMITTED_DIRS + layer_dirs:
        candidates |= files_under(live, d)
    print('candidates: ' + ', '.join(f'{k} {len(v)}' for k, v in sets.items()) + f'; {len(candidates)} paths')

    unexplained = sorted(live_modified(live, repos) - candidates)
    (out / 'unexplained.txt').write_text(''.join(p + '\n' for p in unexplained))
    candidates |= set(unexplained)

    written, absent = materialize_pristine(live, repos, candidates, target)
    created = args.created | {p for p in absent if any(p.startswith(d + '/') for d in layer_dirs)} | {GAME}
    from_cache, from_live, missing, unknown = fill_outside_git(live, absent, created, sets['ungoogled patches'],
                                                               target)
    print(f'pristine: {written} files from git, {from_cache} from the domain substitution cache, {from_live} '
          f'outside git as the live tree has them; {len(missing)} absent before the patches')
    if unknown:
        fail('outside git and patched by ungoogled-chromium, so their pristine content is unknown:\n  '
             + '\n  '.join(unknown))

    env = dict(os.environ, CHROMIUM_SRC=str(target), AC_SERIES_BASE=str(out / 'series-base'), AC_REPO=str(REPO))
    step = [sys.executable, HERE / '03-helium.py', '--tree', target, '--helium', hc, '--helium-macos', hm,
            '--domsub-cache', out / 'domsubcache.tar.gz', '--work', work, '--report', out / 'helium-patches.tsv']
    if args.no_brand:
        step.append('--no-brand')
    if run_logged(step, log, env=env, cwd=out):
        fail(f'03-helium.py failed: {log}')
    if base_copy:
        subprocess.run(['cp', '-cR', str(target) + '/', str(base_copy)], check=True)
        (base_copy / MARKER).write_text(f'helium-swap-plan {base_copy_id}\n')
    subprocess.run(['cp', '-cR', str(target), str(out / 'base')], check=True)
    if run_logged([sys.executable, series, 'capture-base'], log, env=env, cwd=out):
        fail(f'series.py capture-base failed: {log}')
    failed = apply_series(args.series_repo, target, out / 'series-apply.txt')
    if failed:
        fail(f'our series does not apply to the Helium tree ({failed} failures): {out / "series-apply.txt"}')
    if run_logged([sys.executable, series, 'check', '--keep', work / 'series-check'], out / 'series-check.log',
                  env=env, cwd=out):
        fail(f'series.py check failed: {out / "series-check.log"}')
    for layer in layer_names(args.series_repo):
        if run_logged([args.series_repo / layer / 'apply.sh', '--check'], log, env=env):
            fail(f'{layer}/apply.sh --check failed: {log}')

    target_files = all_files(target)
    for p in target_files:
        safe_rel(p)
    allowed = candidates | created | {p for p in target_files if any(p.startswith(d + '/') for d in layer_dirs)}
    unexpected = sorted(target_files - allowed)
    if unexpected:
        fail('the target has files no step accounts for:\n  ' + '\n  '.join(unexpected[:50]))
    compare = sorted(candidates | target_files)

    baseline, rows, problems = [], [], []
    links = ('symlink', 'other', 'hardlink', 'escape')
    for path in compare:
        kind, live_sha, live_mode = describe(live, path)
        tkind, target_sha, target_mode = describe(target, path)
        baseline.append((path, kind, live_sha, live_mode))
        if kind in links or tkind in links:
            if (kind, live_sha) != (tkind, target_sha):
                problems.append(f'{path}: live {kind}, target {tkind}: the swap only handles regular files')
            continue
        if kind == 'absent' and tkind == 'absent':
            continue
        if kind == 'file' and tkind == 'file':
            if live_sha != target_sha:
                rows.append(('write', path, live_sha, live_mode, target_sha, target_mode))
            elif live_mode != target_mode:
                rows.append(('mode', path, live_sha, live_mode, target_sha, target_mode))
        elif tkind == 'file':
            rows.append(('create', path, '', '', target_sha, target_mode))
        else:
            rows.append(('delete', path, live_sha, live_mode, '', ''))
    if problems:
        fail('\n'.join(problems))
    if revisions(live, repos) != revs_before:
        fail('a gclient repo moved while planning')

    (out / 'baseline.tsv').write_text('path\ttype\tsha256\tmode\n' + ''.join('\t'.join(r) + '\n' for r in baseline))
    (out / 'changes.tsv').write_text('op\tpath\tlive_sha256\tlive_mode\ttarget_sha256\ttarget_mode\n'
                                     + ''.join('\t'.join(r) + '\n' for r in rows))
    (out / 'revisions.json').write_text(json.dumps(revs_before, indent=1, sort_keys=True) + '\n')
    (out / 'backup.list').write_text(''.join(r[1] + '\n' for r in rows if r[0] != 'create'))
    counts = {op: sum(1 for r in rows if r[0] == op) for op in ('write', 'create', 'delete', 'mode')}
    plan = {
        'ok': True, 'scratch_id': scratch_id, 'base_copy_id': base_copy_id, 'made': time.strftime('%Y-%m-%d %H:%M:%S'), 'seconds': round(time.time() - started),
        'live': str(live), 'live_identity': list(root_identity(live)),
        'repo_head': subprocess.run(['git', '-C', str(REPO), 'rev-parse', 'HEAD'],
                                    capture_output=True, text=True).stdout.strip(),
        'repo_fingerprint': repo_fingerprint(args.series_repo), 'series_repo': str(args.series_repo),
        'counts': counts, 'compared': len(compare),
        'backup_bytes': sum((live / r[1]).stat().st_size for r in rows if r[0] != 'create'),
        'unexplained': len(unexplained), 'no_brand': args.no_brand, 'helium': str(hc), 'helium_macos': str(hm),
    }
    write_swap_script(out, plan)
    (out / 'plan.json').write_text(json.dumps(plan, indent=1) + '\n')
    print(json.dumps(plan, indent=1))


def write_swap_script(out, plan):
    q = shlex.quote
    tool = '"$repo/engine/patches/build/helium-swap-plan.py"'
    hc_commit, hm_commit = pins_value('helium-chromium', 'commit'), pins_value('helium-macos', 'commit')
    lines = [
        '#!/bin/bash',
        'set -euo pipefail',
        f'repo={q(str(REPO))}',
        f'plan={q(str(out))}',
        f'cb={q(str(CB))}',
        f'export CHROMIUM_SRC={q(plan["live"])}',
        'export AC_CHROMIUM_BUILD="$cb" AC_SERIES_BASE="$cb/series-base"',
        'stamp=$(date +%Y%m%d-%H%M%S)',
        'backup="$cb/helium-swap-backup-$stamp.tar.gz"',
        'step() { echo "== $*" >&2; }',
        'trap \'echo "swap.sh failed at line $LINENO. To undo, under the chromium lock: python3 $repo/engine/patches/'
        'build/helium-swap-plan.py switch-metadata --stamp $stamp --undo, then (if the backup exists) python3 $repo/'
        'engine/patches/build/helium-swap-plan.py rollback --plan $plan --backup $backup (it also puts back '
        'args.gn)" >&2\' ERR',
        f'python3 {tool} lock-held || {{ echo "run it under the lock: $repo/scripts/agent/locked chromium '
        '--as main -- $0" >&2; exit 64; }',
        'step "preflight"',
        'for f in "$cb/domsubcache.tar.gz" "$plan/domsubcache.tar.gz"; do [[ -f $f ]] || { echo "missing $f" >&2; '
        'exit 1; }; done',
        'for d in "$cb/series-base" "$cb/scripts" "$plan/series-base"; do [[ -d $d ]] || { echo "missing $d" >&2; '
        'exit 1; }; done',
        'for x in "$cb/domsubcache.helium-new.tar.gz" "$cb/series-base.helium-new" "$cb/scripts.helium-new" '
        '"$backup"; do [[ ! -e $x ]] || { echo "$x exists" >&2; exit 1; }; done',
        'step "the live tree, its repos and the checkout are as the plan found them"',
        f'python3 {tool} verify --plan "$plan" --expect before',
        'step "Helium checkouts"',
        f'[[ -d "$cb/helium" ]] || git clone -q {q(plan["helium"])} "$cb/helium"',
        f'[[ -d "$cb/helium-macos" ]] || git clone -q {q(plan["helium_macos"])} "$cb/helium-macos"',
        f'git -C "$cb/helium" remote set-url origin {q(pins_value("helium-chromium", "url"))}',
        f'git -C "$cb/helium-macos" remote set-url origin {q(pins_value("helium-macos", "url"))}',
        f'git -C "$cb/helium" -c advice.detachedHead=false checkout -q {q(hc_commit)}',
        f'git -C "$cb/helium-macos" -c advice.detachedHead=false checkout -q {q(hm_commit)}',
        f'[[ "$(git -C "$cb/helium" rev-parse HEAD)" == {q(hc_commit)} ]]',
        f'[[ "$(git -C "$cb/helium-macos" rev-parse HEAD)" == {q(hm_commit)} ]]',
        'step "stage the new domain substitution cache, series base and step scripts"',
        'cp "$plan/domsubcache.tar.gz" "$cb/domsubcache.helium-new.tar.gz"',
        'mkdir "$cb/series-base.helium-new"',
        'cp -Rp "$plan/series-base/." "$cb/series-base.helium-new/"',
        'mkdir "$cb/scripts.helium-new"',
        'cp -Rp "$cb/scripts/." "$cb/scripts.helium-new/"',
        'cp -Rp "$repo/engine/patches/build/." "$cb/scripts.helium-new/"',
        'rm -f "$cb/scripts.helium-new/03-ungoogled.py" "$cb/scripts.helium-new/04-domain-substitution.sh"',
        'step "back up and swap the files (backup: $backup)"',
        f'python3 {tool} apply --plan "$plan" --backup "$backup"',
        'step "switch the cache, series base and scripts (renames only; the old ones keep .ungoogled-$stamp)"',
        f'python3 {tool} switch-metadata --stamp "$stamp"',
        'step "the series and the layers reproduce the tree"',
        'python3 "$repo/engine/patches/series.py" check',
        '"$repo/engine/chromium/apply.sh" --check',
        '"$repo/engine/astrocore/apply.sh" --check',
        'step "gn gen"',
        '"$cb/scripts/02-gn-args.sh" --apply',
        'trap - ERR',
        'step "done. Next: scripts/agent/engine-build --as main (run_in_background, about 2-2.5 h), then python3 '
        '$repo/engine/patches/build/helium-check-build.py. To undo, under the chromium lock: helium-swap-plan.py '
        'switch-metadata --stamp $stamp --undo, then helium-swap-plan.py rollback --plan $plan --backup $backup"',
    ]
    path = out / 'swap.sh'
    path.write_text('\n'.join(lines) + '\n')
    path.chmod(0o755)


def pins_value(section, key):
    import configparser
    config = configparser.ConfigParser(interpolation=None)
    config.read(HERE / 'helium-pins.ini')
    return config[section][key]


ROOT_FD = None


def root_identity(path):
    st = os.stat(path, follow_symlinks=False)
    if not stat.S_ISDIR(st.st_mode):
        sys.exit(f'{path} is not a real directory')
    return (st.st_dev, st.st_ino)


def anchor_root(identity):
    global ROOT_FD
    try:
        fd = os.open(str(LIVE), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    except OSError as e:
        sys.exit(f'{LIVE}: {e.strerror}: is the live tree still a real directory?')
    st = os.fstat(fd)
    if [st.st_dev, st.st_ino] != list(identity):
        os.close(fd)
        sys.exit(f'{LIVE} is not the directory the plan was made for (device/inode changed)')
    if ROOT_FD is not None:
        os.close(ROOT_FD)
    ROOT_FD = fd


def check_root_still_anchored():
    st, now = os.fstat(ROOT_FD), os.stat(LIVE, follow_symlinks=False)
    if (st.st_dev, st.st_ino) != (now.st_dev, now.st_ino):
        sys.exit(f'{LIVE} was replaced while the swap ran: its writes went to the original directory; '
                 f'check both before going on')


def load_plan(path):
    plan_dir = pathlib.Path(path).resolve()
    meta = plan_dir / 'plan.json'
    if (plan_dir / 'FAILED').exists() or not meta.exists():
        sys.exit(f'{plan_dir} is not a published plan (its checks failed or it never finished)')
    plan = json.loads(meta.read_text())
    if not plan.get('ok'):
        sys.exit(f'{plan_dir}: plan.json is not marked ok')
    if pathlib.Path(plan['live']).resolve() != LIVE:
        sys.exit(f'the plan is for {plan["live"]}, not {LIVE}')
    baseline = []
    for line in (plan_dir / 'baseline.tsv').read_text().split('\n')[1:-1]:
        path, kind, sha, mode = line.split('\t')
        baseline.append((safe_rel(path), kind, sha, mode))
    rows = []
    for line in (plan_dir / 'changes.tsv').read_text().split('\n')[1:-1]:
        op, path, live_sha, live_mode, target_sha, target_mode = line.split('\t')
        rows.append((op, safe_rel(path), live_sha, live_mode, target_sha, target_mode))
    revs = json.loads((plan_dir / 'revisions.json').read_text())
    if 'live_identity' not in plan:
        sys.exit(f'{plan_dir}: the plan has no live_identity (made by an older planner): make a new plan')
    anchor_root(plan['live_identity'])
    return plan_dir, plan, baseline, rows, revs


def holds_lock_for(path):
    if pathguard.reaches(path):
        return pathguard.real_lock_held()
    return pathguard.chromium_lock_held()


def real_chromium_build():
    return pathguard.real_chromium_build()


def require_lock():
    if pathguard.reaches(LIVE) and not pathguard.real_lock_held():
        sys.exit('hold the real chromium lock: scripts/agent/locked chromium --as <you> -- <this command>')


def guard_mutation(plan):
    if not pathguard.reaches(LIVE):
        return
    require_lock()
    if plan['no_brand']:
        sys.exit('this plan was made with --no-brand; make one with the branding')
    if pathlib.Path(plan['series_repo']).resolve() != ENGINE_REPO.resolve():
        sys.exit(f'the plan used the series in {plan["series_repo"]}, not this checkout\'s')
    if repo_fingerprint() != plan['repo_fingerprint']:
        sys.exit('engine/ or the offline game changed since the plan: make a new plan')


def mismatches(baseline, rows, state):
    expected = {path: (kind, sha, mode) for path, kind, sha, mode in baseline}
    if state == 'after':
        for op, path, live_sha, live_mode, target_sha, target_mode in rows:
            expected[path] = ('absent', '', '') if op == 'delete' else ('file', target_sha, target_mode)
    return [path for path, want in expected.items() if describe(LIVE, path) != want]


def outside_checks(baseline, revs):
    problems = []
    repos = Repos(LIVE)
    if not repos.all_roots():
        return problems
    now = revisions(LIVE, repos)
    if now != revs:
        moved = sorted(set(now.items()) ^ set(revs.items()))
        problems.append(f'gclient repos moved since the plan: {moved[:10]}')
    known = {path for path, *_ in baseline}
    stray = sorted(live_modified(LIVE, repos) - known)
    if stray:
        problems.append('modified outside the plan: ' + ', '.join(stray[:20]))
    return problems


def check_state(plan, baseline, rows, revs, state):
    problems = outside_checks(baseline, revs)
    bad = mismatches(baseline, rows, state)
    if bad:
        problems.append(f'{len(bad)} paths differ from "{state}": ' + ', '.join(bad[:20]))
    if state == 'before' and LIVE == REAL_LIVE and repo_fingerprint() != plan['repo_fingerprint'] and \
            pathlib.Path(plan['series_repo']).resolve() == ENGINE_REPO.resolve():
        problems.append('engine/ or the offline game changed since the plan')
    return problems


def cmd_verify(args):
    plan_dir, plan, baseline, rows, revs = load_plan(args.plan)
    problems = check_state(plan, baseline, rows, revs, args.expect)
    if problems:
        print(f'{LIVE}: not "{args.expect}":\n  ' + '\n  '.join(problems))
        return 1
    print(f'{LIVE}: "{args.expect}" ({len(baseline)} paths, {len(rows)} planned changes, {len(revs)} repos)')
    return 0


class Confined:
    def __init__(self, rel, create=False):
        self.rel = safe_rel(rel)
        parts = rel.split('/')
        self.name = parts[-1]
        if ROOT_FD is None:
            raise SystemExit('internal: the live root is not anchored (load a plan first)')
        fd = os.dup(ROOT_FD)
        try:
            for part in parts[:-1]:
                try:
                    child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                except FileNotFoundError:
                    if not create:
                        raise
                    os.mkdir(part, 0o755, dir_fd=fd)
                    child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                except OSError as e:
                    raise SystemExit(f'{LIVE / rel}: {part} is not a real directory ({e.strerror}): refusing')
                os.close(fd)
                fd = child
        except BaseException:
            os.close(fd)
            raise
        self.dir_fd = fd

    def close(self):
        os.close(self.dir_fd)

    def is_regular(self):
        try:
            st = os.stat(self.name, dir_fd=self.dir_fd, follow_symlinks=False)
        except FileNotFoundError:
            return False
        if not stat.S_ISREG(st.st_mode):
            raise SystemExit(f'{LIVE / self.rel} is not a regular file: refusing')
        return True

    def read(self):
        fd = os.open(self.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=self.dir_fd)
        with os.fdopen(fd, 'rb') as f:
            if not stat.S_ISREG(os.fstat(f.fileno()).st_mode):
                raise SystemExit(f'{LIVE / self.rel} is not a regular file: refusing')
            return f.read()

    def write(self, data, mode, mtime):
        self.is_regular()
        tmp = f'.helium-swap-{secrets.token_hex(8)}'
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=self.dir_fd)
        try:
            with os.fdopen(fd, 'wb') as f:
                f.write(data)
                os.fchmod(f.fileno(), mode)
                f.flush()
                os.utime(f.fileno(), (mtime, mtime))
            os.replace(tmp, self.name, src_dir_fd=self.dir_fd, dst_dir_fd=self.dir_fd)
        except BaseException:
            try:
                os.unlink(tmp, dir_fd=self.dir_fd)
            except FileNotFoundError:
                pass
            raise

    def chmod_touch(self, mode, mtime):
        fd = os.open(self.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=self.dir_fd)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise SystemExit(f'{LIVE / self.rel} is not a regular file: refusing')
            os.fchmod(fd, mode)
            os.utime(fd, (mtime, mtime))
        finally:
            os.close(fd)

    def unlink(self):
        if self.is_regular():
            os.unlink(self.name, dir_fd=self.dir_fd)
            return True
        return False


def confined(rel, create=False):
    return contextlib.closing(Confined(rel, create))


def write_backup(backup, rows, created):
    with tarfile.open(backup, 'w:gz', compresslevel=3) as tar:
        for op, path, live_sha, live_mode, *_ in rows:
            if op == 'create':
                continue
            with confined(path) as c:
                data = c.read()
            if hashlib.sha256(data).hexdigest() != live_sha:
                raise SystemExit(f'{path} changed while backing up')
            info = tarfile.TarInfo('orig/' + path)
            info.size, info.mode, info.mtime = len(data), int(live_mode, 8), int(time.time())
            tar.addfile(info, io.BytesIO(data))
        gn_kind = describe(LIVE, GN_ARGS)[0]
        if gn_kind == 'file':
            with confined(GN_ARGS) as c:
                data = c.read()
            info = tarfile.TarInfo('gn/args.gn')
            info.size, info.mode, info.mtime = len(data), 0o644, int(time.time())
            tar.addfile(info, io.BytesIO(data))
        elif gn_kind != 'absent':
            raise SystemExit(f'{LIVE / GN_ARGS} is a {gn_kind}, not a regular file')
        listing = ''.join(p + '\n' for p in created).encode()
        info = tarfile.TarInfo('created.list')
        info.size = len(listing)
        tar.addfile(info, io.BytesIO(listing))


def cmd_apply(args):
    plan_dir, plan, baseline, rows, revs = load_plan(args.plan)
    guard_mutation(plan)
    problems = check_state(plan, baseline, rows, revs, 'before')
    if problems:
        sys.exit('the live tree is not as the plan found it:\n  ' + '\n  '.join(problems))
    backup = pathlib.Path(args.backup)
    if backup.exists():
        sys.exit(f'{backup} exists')
    created = [r[1] for r in rows if r[0] == 'create']
    try:
        write_backup(backup, rows, created)
    except BaseException:
        if backup.exists():
            backup.unlink()
        raise
    print(f'backup: {backup} ({backup.stat().st_size >> 20} MB)')
    target = plan_dir / 'target'
    now = time.time()
    for op, path, live_sha, live_mode, target_sha, target_mode in rows:
        if op == 'delete':
            with confined(path) as c:
                c.unlink()
            continue
        if op == 'mode':
            with confined(path) as c:
                c.chmod_touch(int(target_mode, 8), now)
            continue
        data = (target / path).read_bytes()
        if hashlib.sha256(data).hexdigest() != target_sha:
            sys.exit(f'{target / path} changed since the plan; roll back with the backup')
        with confined(path, create=True) as c:
            c.write(data, int(target_mode, 8), now)
    check_root_still_anchored()
    problems = check_state(plan, baseline, rows, revs, 'after')
    if problems:
        sys.exit('after the swap the tree is not as planned (roll back with the backup):\n  ' + '\n  '.join(problems))
    counts = {op: sum(1 for r in rows if r[0] == op) for op in ('write', 'create', 'delete', 'mode')}
    print('swapped: ' + ', '.join(f'{k} {v}' for k, v in counts.items()))
    return 0


def cmd_rollback(args):
    plan_dir, plan, baseline, rows, revs = load_plan(args.plan)
    require_lock()
    expected = {r[1]: (r[2], r[3]) for r in rows if r[0] != 'create'}
    created_rows = sorted(r[1] for r in rows if r[0] == 'create')
    restore, gn_args = {}, None
    with tarfile.open(args.backup) as tar:
        created = None
        for member in tar.getmembers():
            if member.name == 'created.list' and member.isfile() and created is None:
                created = sorted(tar.extractfile(member).read().decode().split('\n')[:-1])
                continue
            if member.name == 'gn/args.gn' and member.isfile() and gn_args is None:
                gn_args = tar.extractfile(member).read()
                continue
            if not member.name.startswith('orig/') or not member.isfile():
                sys.exit(f'refusing backup member {member.name} ({member.type!r}): only regular files')
            rel = safe_rel(member.name[len('orig/'):])
            if rel not in expected or rel in restore:
                sys.exit(f'refusing backup member {member.name}: not in the plan, or twice')
            data = tar.extractfile(member).read()
            sha, mode = expected[rel]
            if hashlib.sha256(data).hexdigest() != sha or f'{member.mode & 0o777:o}' != mode:
                sys.exit(f'backup member {member.name} is not the file the plan found: wrong backup?')
            restore[rel] = (data, int(mode, 8))
    missing = sorted(set(expected) - set(restore))
    if missing:
        sys.exit(f'the backup lacks {len(missing)} planned files: {missing[:10]}')
    if created != created_rows:
        sys.exit('the backup\'s created.list differs from the plan\'s creates: wrong backup?')
    now = time.time()
    for rel, (data, mode) in sorted(restore.items()):
        with confined(rel, create=True) as c:
            c.write(data, mode, now)
    removed = 0
    for rel in created_rows:
        try:
            with confined(rel) as c:
                removed += c.unlink()
        except FileNotFoundError:
            pass
    gn_note = ''
    if gn_args is not None and describe(LIVE, GN_ARGS)[1] != hashlib.sha256(gn_args).hexdigest():
        with confined(GN_ARGS, create=True) as c:
            c.write(gn_args, 0o644, now)
        gn_note = f', put back {GN_ARGS} (the next ninja run regenerates the build files from it)'
    check_root_still_anchored()
    print(f'restored {len(restore)} files, removed {removed} created files{gn_note}')
    problems = check_state(plan, baseline, rows, revs, 'before')
    if problems:
        sys.exit('not back to the "before" state:\n  ' + '\n  '.join(problems))
    print('the tree is back to the plan\'s "before" state')
    return 0


METADATA = [('domsubcache.tar.gz', 'domsubcache.ungoogled-{}.tar.gz', 'domsubcache.helium-new.tar.gz'),
            ('series-base', 'series-base.ungoogled-{}', 'series-base.helium-new'),
            ('scripts', 'scripts.ungoogled-{}', 'scripts.helium-new')]


def metadata_state(stamp):
    states = []
    for current, old, new in METADATA:
        cur, old, new = CB / current, CB / old.format(stamp), CB / new
        if new.exists() and not old.exists():
            states.append('staged')
        elif old.exists() and not new.exists():
            states.append('switched')
        else:
            states.append(f'unclear ({current}: {"old " if old.exists() else ""}{"new" if new.exists() else ""})')
        if not os.path.lexists(cur):
            states[-1] += ' (current missing)'
    return states


def cmd_switch_metadata(args):
    if any(pathguard.reaches(p) for p in [CB] + [CB / n for g in METADATA for n in (g[0], g[2])]) \
            and not pathguard.real_lock_held():
        sys.exit('hold the real chromium lock: scripts/agent/locked chromium --as <you> -- <this command>')
    if not re.fullmatch(r'[0-9]{8}-[0-9]{6}', args.stamp):
        sys.exit(f'bad stamp {args.stamp!r}')
    done = []
    try:
        for current, old, new in (reversed(METADATA) if args.undo else METADATA):
            cur, old, new = CB / current, CB / old.format(args.stamp), CB / new
            if args.undo:
                if not old.exists():
                    continue
                if os.path.lexists(cur):
                    if new.exists():
                        sys.exit(f'{new} exists: refusing to overwrite it')
                    os.rename(cur, new)
                    done.append((new, cur))
                os.rename(old, cur)
                done.append((cur, old))
            else:
                if not new.exists() or old.exists() or not os.path.lexists(cur):
                    sys.exit(f'{current}: expected {cur} and {new}, and no {old}: {metadata_state(args.stamp)}')
                os.rename(cur, old)
                done.append((old, cur))
                os.rename(new, cur)
                done.append((cur, new))
    except BaseException:
        for src, dst in reversed(done):
            os.rename(src, dst)
        raise
    print(f'{"restored" if args.undo else "switched"}: {metadata_state(args.stamp)}')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('plan')
    p.add_argument('--out', required=True)
    p.add_argument('--extra', action='append', default=[], metavar='LIST')
    p.add_argument('--base-copy', metavar='DIR')
    p.add_argument('--series-repo', default=str(ENGINE_REPO), metavar='CHECKOUT',
                   help='a checkout whose engine/ holds the series to plan with (default: this one)')
    p.add_argument('--no-brand', action='store_true')
    sub.add_parser('fingerprint')
    sub.add_parser('lock-held')
    p = sub.add_parser('switch-metadata')
    p.add_argument('--stamp', required=True)
    p.add_argument('--undo', action='store_true')
    p = sub.add_parser('verify')
    p.add_argument('--plan', required=True)
    p.add_argument('--expect', choices=['before', 'after'], required=True)
    p = sub.add_parser('apply')
    p.add_argument('--plan', required=True)
    p.add_argument('--backup', required=True)
    p = sub.add_parser('rollback')
    p.add_argument('--plan', required=True)
    p.add_argument('--backup', required=True)
    args = parser.parse_args()
    handler = {'fingerprint': lambda a: print(repo_fingerprint()),
               'lock-held': lambda a: 0 if holds_lock_for(CB) else 1, 'switch-metadata': cmd_switch_metadata,
               'plan': cmd_plan, 'verify': cmd_verify, 'apply': cmd_apply, 'rollback': cmd_rollback}[args.command]
    sys.exit(handler(args) or 0)


if __name__ == '__main__':
    main()
