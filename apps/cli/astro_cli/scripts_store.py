import ctypes
import errno
import json
import os
import secrets
import shutil
import stat
import time
from pathlib import Path

from astro_cli import places
from astro_cli.places import WINDOWS, is_link
from astro_cli.userscript import Build, Meta, ScriptError, check_glob, check_match, manifest_entries

if WINDOWS:
    import msvcrt
else:
    import fcntl

LOCK_TIMEOUT = 30
STATUS_TIMEOUT = 10
STATUS_POLL = 0.1
RENAME_SWAP = 0x2
MAX_FILE = 64 * 1024 * 1024
MAX_MANIFEST = 256 * 1024
MAX_ENTRIES = 256
MAX_FILES_PER_ENTRY = 256
MAX_FILES = 512
EXTENSION_NAME = "Astro Scripts"
EXTENSION_DESCRIPTION = "Userscripts installed with the astro command."
EXTENSION = "extension"
GENERATION = "generation"
STATUS = "status.json"
SOURCE_SUFFIXES = (".ts", ".mts", ".js", ".mjs")
MANIFEST_KEYS = {"manifest_version", "name", "version", "description", "content_scripts"}
ENTRY_KEYS = {"matches", "exclude_matches", "include_globs", "exclude_globs", "js", "run_at", "all_frames", "world"}
RUN_AT = {"document_start", "document_end", "document_idle"}
WORLDS = {"MAIN", "ISOLATED"}


class StoreError(Exception):
    pass


Folder = int | str


def _path(folder: Folder, name: str) -> str:
    return os.path.join(folder, name)


def lstat_in(folder: Folder, name: str) -> os.stat_result:
    if WINDOWS:
        return os.lstat(_path(folder, name))
    return os.stat(name, dir_fd=folder, follow_symlinks=False)


def rename_in(folder: Folder, source: str, target: str) -> None:
    if WINDOWS:
        os.replace(_path(folder, source), _path(folder, target))
    else:
        os.rename(source, target, src_dir_fd=folder, dst_dir_fd=folder)


def unlink_in(folder: Folder, name: str) -> None:
    if WINDOWS:
        os.unlink(_path(folder, name))
    else:
        os.unlink(name, dir_fd=folder)


def make_dir(folder: Folder, name: str, mode: int) -> None:
    if WINDOWS:
        os.mkdir(_path(folder, name), mode)
    else:
        os.mkdir(name, mode, dir_fd=folder)


def list_dir(folder: Folder) -> list[str]:
    return os.listdir(folder)


def close_dir(folder: Folder | None) -> None:
    if folder is not None and not WINDOWS:
        os.close(folder)


def open_root(path: Path) -> Folder:
    if WINDOWS:
        if not path.is_dir():
            raise FileNotFoundError(errno.ENOENT, "no such folder", str(path))
        return str(path)
    return os.open(path, os.O_RDONLY | os.O_DIRECTORY)


def open_dir(parent_fd: Folder | None, name: str, create: bool) -> Folder:
    if WINDOWS:
        return _open_dir_by_path(name if parent_fd is None else _path(parent_fd, name), name, create)
    if create:
        try:
            os.mkdir(name, 0o700, dir_fd=parent_fd)
        except FileExistsError:
            pass
    try:
        fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
    except OSError as error:
        if error.errno in (errno.ELOOP, errno.ENOTDIR):
            raise StoreError(f"{name} is a symbolic link or not a folder; the astro command only uses real folders") from None
        raise
    info = os.fstat(fd)
    if info.st_uid != os.getuid():
        os.close(fd)
        raise StoreError(f"{name} belongs to another user")
    return fd


def _open_dir_by_path(path: str, name: str, create: bool) -> str:
    if create:
        try:
            os.mkdir(path, 0o700)
        except FileExistsError:
            pass
    info = os.lstat(path)
    if is_link(info) or not stat.S_ISDIR(info.st_mode):
        raise StoreError(f"{name} is a symbolic link or not a folder; the astro command only uses real folders")
    return path


def read_file(dir_fd: Folder, name: str) -> bytes | None:
    try:
        if WINDOWS:
            fd = places.open_no_follow(_path(dir_fd, name), os.O_RDONLY)
        else:
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=dir_fd)
    except FileNotFoundError:
        return None
    except OSError as error:
        if error.errno == errno.ELOOP:
            raise StoreError(f"{name} is a symbolic link") from None
        raise
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise StoreError(f"{name} isn't a regular file")
        chunks = []
        size = 0
        while chunk := os.read(fd, 1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE:
                raise StoreError(f"{name} is too big")
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(fd)


def write_file(dir_fd: Folder, name: str, data: bytes, mode: int = 0o644) -> None:
    if WINDOWS:
        fd = os.open(_path(dir_fd, name), os.O_WRONLY | os.O_CREAT | os.O_EXCL | places.BINARY, mode)
    else:
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode, dir_fd=dir_fd)
    try:
        view = memoryview(data)
        while view:
            view = view[os.write(fd, view) :]
        os.fsync(fd)
    finally:
        os.close(fd)


def write_atomic(dir_fd: Folder, name: str, data: bytes) -> None:
    temp = f".{name}-{secrets.token_hex(6)}"
    try:
        write_file(dir_fd, temp, data)
        rename_in(dir_fd, temp, name)
    except BaseException:
        try:
            unlink_in(dir_fd, temp)
        except OSError:
            pass
        raise


def exists(dir_fd: Folder, name: str) -> bool:
    try:
        lstat_in(dir_fd, name)
    except FileNotFoundError:
        return False
    return True


def remove_tree(dir_fd: Folder, name: str) -> None:
    try:
        info = lstat_in(dir_fd, name)
    except FileNotFoundError:
        return
    if WINDOWS:
        path = _path(dir_fd, name)
        if stat.S_ISDIR(info.st_mode) and not is_link(info):
            shutil.rmtree(path, ignore_errors=True)
            return
        try:
            os.rmdir(path) if stat.S_ISDIR(info.st_mode) else os.unlink(path)
        except OSError:
            pass
        return
    if stat.S_ISDIR(info.st_mode):
        shutil.rmtree(name, dir_fd=dir_fd, ignore_errors=True)
    else:
        try:
            os.unlink(name, dir_fd=dir_fd)
        except OSError:
            pass


_libc = None


def _exchange(dir_fd: int, first: str, second: str) -> bool:
    global _libc
    if _libc is None:
        _libc = ctypes.CDLL(None, use_errno=True)
    call = getattr(_libc, "renameatx_np" if places.MACOS else "renameat2", None)
    if call is None:
        return False
    call.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    call.restype = ctypes.c_int
    if call(dir_fd, os.fsencode(first), dir_fd, os.fsencode(second), RENAME_SWAP) == 0:
        return True
    code = ctypes.get_errno()
    if not places.MACOS and code in (errno.EINVAL, errno.ENOSYS, errno.EOPNOTSUPP):
        return False
    raise OSError(code, os.strerror(code), second)


def swap(dir_fd: Folder, first: str, second: str) -> None:
    if not WINDOWS and _exchange(dir_fd, first, second):
        return
    parked = f".swap-{secrets.token_hex(6)}"
    rename_in(dir_fd, second, parked)
    try:
        rename_in(dir_fd, first, second)
    except BaseException:
        rename_in(dir_fd, parked, second)
        raise
    rename_in(dir_fd, parked, first)


def staging_dir(parent_fd: Folder, prefix: str) -> tuple[str, Folder]:
    name = f".{prefix}-{secrets.token_hex(6)}"
    make_dir(parent_fd, name, 0o755)
    return name, open_dir(parent_fd, name, False)


def take_lock(fd: int) -> None:
    if not WINDOWS:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return
    try:
        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
    except OSError as error:
        raise BlockingIOError(error.errno, error.strerror) from None


def release_lock(fd: int) -> None:
    if not WINDOWS:
        return
    try:
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
    except OSError:
        pass


def read_int(dir_fd: Folder | None, name: str) -> int:
    if dir_fd is None:
        return 0
    try:
        data = read_file(dir_fd, name)
    except (OSError, StoreError):
        return 0
    text = (data or b"").decode("utf-8", "replace").strip()
    return int(text) if text.isdigit() else 0


class Store:
    def __init__(self, data_root: Path):
        self.data_root = data_root
        self.path = data_root / "Scripts"
        self.root_fd: Folder | None = None
        self.records_fd: Folder | None = None
        self.lock_fd: int | None = None

    def open(self, create: bool) -> bool:
        try:
            base = open_root(self.data_root)
        except FileNotFoundError:
            if not create:
                return False
            raise StoreError(f"{self.data_root} doesn't exist") from None
        except OSError as error:
            raise StoreError(f"can't open {self.data_root} ({error.strerror})") from None
        try:
            if not create and not exists(base, "Scripts"):
                return False
            self.root_fd = open_dir(base, "Scripts", create)
        finally:
            close_dir(base)
        if create or exists(self.root_fd, "scripts"):
            self.records_fd = open_dir(self.root_fd, "scripts", create)
        return True

    def __enter__(self):
        self.open(True)
        self.lock()
        return self

    def lock(self):
        if WINDOWS:
            fd = places.open_no_follow(_path(self.root_fd, ".lock"), os.O_RDWR | os.O_CREAT, 0o600)
        else:
            fd = os.open(".lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600, dir_fd=self.root_fd)
        deadline = time.monotonic() + LOCK_TIMEOUT
        while True:
            try:
                take_lock(fd)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    os.close(fd)
                    raise StoreError(f"another astro scripts command or Astro has held {self.path / '.lock'} for {LOCK_TIMEOUT}s") from None
                time.sleep(0.05)
        self.lock_fd = fd

    def __exit__(self, *_exc):
        self.unlock()

    def unlock(self):
        if self.lock_fd is not None:
            release_lock(self.lock_fd)
            os.close(self.lock_fd)
            self.lock_fd = None

    def close(self):
        self.unlock()
        for name in ("records_fd", "root_fd"):
            fd = getattr(self, name)
            if fd is not None:
                close_dir(fd)
                setattr(self, name, None)

    def read_record(self, name: str) -> dict | None:
        fd = open_dir(self.records_fd, name, False)
        try:
            meta = json.loads(read_file(fd, "meta.json") or b"null")
        except ValueError:
            return None
        finally:
            close_dir(fd)
        return meta if isinstance(meta, dict) and meta.get("id") == name else None

    def installed(self) -> list[dict]:
        if self.records_fd is None:
            return []
        found = []
        for name in sorted(list_dir(self.records_fd)):
            if name.startswith("."):
                continue
            info = lstat_in(self.records_fd, name)
            if is_link(info):
                raise StoreError(f"{self.path / 'scripts' / name} is a symbolic link; remove it")
            if not stat.S_ISDIR(info.st_mode):
                continue
            meta = self.read_record(name)
            if meta:
                found.append(meta)
        return sorted(found, key=lambda meta: (meta.get("installed_at", 0), meta["id"]))

    def find(self, name: str) -> dict | None:
        scripts = self.installed()
        return next((m for m in scripts if m.get("name") == name), None) or next((m for m in scripts if m["id"] == name), None)

    def status(self) -> dict | None:
        if self.root_fd is None:
            return None
        try:
            data = json.loads(read_file(self.root_fd, STATUS) or b"null")
        except (OSError, ValueError, StoreError):
            return None
        return data if isinstance(data, dict) else None

    def generation(self) -> int:
        return read_int(self.root_fd, GENERATION)

    def extension_generation(self) -> int:
        if self.root_fd is None or not exists(self.root_fd, EXTENSION):
            return 0
        try:
            fd = open_dir(self.root_fd, EXTENSION, False)
        except (OSError, StoreError):
            return 0
        try:
            return read_int(fd, GENERATION)
        finally:
            close_dir(fd)

    def extension_present(self) -> bool:
        return self.root_fd is not None and exists(self.root_fd, EXTENSION)

    def next_generation(self) -> int:
        reported = (self.status() or {}).get("generation")
        reported = reported if isinstance(reported, int) and not isinstance(reported, bool) else 0
        return max(self.generation(), self.extension_generation(), reported) + 1

    def stage_record(self, build: Build) -> tuple[str, dict]:
        meta = build.meta
        previous = None
        if exists(self.records_fd, meta.id):
            previous = self.read_record(meta.id)
        now = time.time()
        record = meta.to_dict()
        record["source_file"] = str(build.path.resolve())
        suffix = next((s for s in SOURCE_SUFFIXES if build.path.name.endswith(s)), ".js")
        record["source"] = "source" + suffix
        record["installed_at"] = previous.get("installed_at", now) if previous else now
        record["updated_at"] = now
        record["updated"] = previous is not None
        name, fd = staging_dir(self.records_fd, f"stage-{meta.id}")
        try:
            write_file(fd, record["source"], build.source.encode("utf-8"))
            write_file(fd, "script.js", build.js.encode("utf-8"))
            write_file(fd, "meta.json", (json.dumps(record, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
        except BaseException:
            close_dir(fd)
            remove_tree(self.records_fd, name)
            raise
        close_dir(fd)
        return name, record

    def build_extension(self, records: list[tuple[dict, str]], generation: int) -> str:
        name, fd = staging_dir(self.root_fd, "extension")
        try:
            make_dir(fd, "js", 0o755)
            js_fd = open_dir(fd, "js", False)
            entries = []
            try:
                for meta, folder in records:
                    record_fd = open_dir(self.records_fd, folder, False)
                    try:
                        script = read_file(record_fd, "script.js")
                    finally:
                        close_dir(record_fd)
                    if script is None:
                        raise StoreError(f"{meta['id']} has no script.js; reinstall it")
                    write_file(js_fd, f"{meta['id']}.js", script)
                    entries.extend(manifest_entries(meta_from_record(meta), f"js/{meta['id']}.js"))
            finally:
                close_dir(js_fd)
            manifest = {
                "manifest_version": 3,
                "name": EXTENSION_NAME,
                "version": manifest_version(generation),
                "description": EXTENSION_DESCRIPTION,
                "content_scripts": entries,
            }
            validate_manifest(manifest, {f"js/{meta['id']}.js" for meta, _ in records})
            text = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
            if len(text) > MAX_MANIFEST:
                raise StoreError(f"the generated manifest would be {len(text)} bytes, over the {MAX_MANIFEST} limit; uninstall some scripts")
            write_file(fd, "manifest.json", text)
            write_file(fd, GENERATION, f"{generation}\n".encode())
        except BaseException:
            close_dir(fd)
            remove_tree(self.root_fd, name)
            raise
        close_dir(fd)
        return name

    def publish_extension(self, staged: str | None) -> str | None:
        present = exists(self.root_fd, EXTENSION)
        if present:
            info = lstat_in(self.root_fd, EXTENSION)
            if is_link(info) or not stat.S_ISDIR(info.st_mode):
                raise StoreError(f"{self.path / EXTENSION} isn't a folder the astro command made; move it away first")
        if staged is None:
            if not present:
                return None
            old = f".extension-old-{secrets.token_hex(6)}"
            rename_in(self.root_fd, EXTENSION, old)
            return old
        if present:
            swap(self.root_fd, staged, EXTENSION)
            return staged
        rename_in(self.root_fd, staged, EXTENSION)
        return None

    def restore_extension(self, staged: str | None, old: str | None) -> None:
        if old is not None and staged is not None and old == staged:
            swap(self.root_fd, staged, EXTENSION)
        elif old is not None:
            rename_in(self.root_fd, old, EXTENSION)
        elif staged is not None and exists(self.root_fd, EXTENSION):
            remove_tree(self.root_fd, EXTENSION)

    def apply(self, add: Build | None = None, remove: str | None = None) -> tuple[dict, int]:
        current = self.installed()
        generation = self.next_generation()
        staged_record = None
        record = None
        if add is not None:
            staged_record, record = self.stage_record(add)
            kept = [(m, m["id"]) for m in current if m["id"] != record["id"]]
            plan = sorted(kept + [(record, staged_record)], key=lambda item: (item[0].get("installed_at", 0), item[0]["id"]))
        elif remove is not None:
            record = next(m for m in current if m["id"] == remove)
            plan = [(m, m["id"]) for m in current if m["id"] != remove]
        else:
            record = None
            plan = [(m, m["id"]) for m in current]
        staged_extension = None
        old_extension = None
        published = False
        try:
            staged_extension = self.build_extension(plan, generation) if plan else None
            if not plan and self.extension_present():
                write_atomic(self.root_fd, GENERATION, f"{generation}\n".encode())
            old_extension = self.publish_extension(staged_extension)
            published = True
            if record is not None:
                self.commit_record(staged_record, record["id"], removing=add is None)
        except BaseException:
            if published:
                try:
                    self.restore_extension(staged_extension, old_extension)
                except OSError:
                    pass
            if staged_record:
                remove_tree(self.records_fd, staged_record)
            if staged_extension:
                remove_tree(self.root_fd, staged_extension)
            raise
        for leftover in (old_extension, staged_extension):
            if leftover and exists(self.root_fd, leftover):
                remove_tree(self.root_fd, leftover)
        write_atomic(self.root_fd, GENERATION, f"{generation}\n".encode())
        return record, generation

    def commit_record(self, staged: str | None, record_id: str, removing: bool) -> None:
        if removing:
            trash = f".old-{record_id}-{secrets.token_hex(6)}"
            rename_in(self.records_fd, record_id, trash)
            remove_tree(self.records_fd, trash)
            return
        if exists(self.records_fd, record_id):
            info = lstat_in(self.records_fd, record_id)
            if is_link(info) or not stat.S_ISDIR(info.st_mode):
                raise StoreError(f"{self.path / 'scripts' / record_id} isn't a folder the astro command made")
            swap(self.records_fd, staged, record_id)
            remove_tree(self.records_fd, staged)
        else:
            rename_in(self.records_fd, staged, record_id)

    def expected_manifest(self, records: list[dict], generation: int) -> list:
        entries = []
        for meta in records:
            entries.extend(manifest_entries(meta_from_record(meta), f"js/{meta['id']}.js"))
        return entries

    def consistent(self, records: list[dict]) -> bool:
        if not records:
            return not self.extension_present()
        if not self.extension_present():
            return False
        fd = open_dir(self.root_fd, EXTENSION, False)
        try:
            manifest = json.loads(read_file(fd, "manifest.json") or b"null")
            if not isinstance(manifest, dict) or manifest.get("content_scripts") != self.expected_manifest(records, 0):
                return False
            js_fd = open_dir(fd, "js", False)
            try:
                if sorted(list_dir(js_fd)) != sorted(f"{meta['id']}.js" for meta in records):
                    return False
                for meta in records:
                    record_fd = open_dir(self.records_fd, meta["id"], False)
                    try:
                        if read_file(record_fd, "script.js") != read_file(js_fd, f"{meta['id']}.js"):
                            return False
                    finally:
                        close_dir(record_fd)
            finally:
                close_dir(js_fd)
        except (ValueError, OSError, StoreError):
            return False
        finally:
            close_dir(fd)
        return True

    def repair(self) -> str | None:
        records = self.installed()
        if not self.consistent(records):
            _, generation = self.apply()
            return f"the installed scripts and the extension disagreed; rebuilt it as generation {generation}"
        current = self.generation()
        if self.extension_present():
            published = self.extension_generation()
            if published > current:
                write_atomic(self.root_fd, GENERATION, f"{published}\n".encode())
                return f"a run stopped before publishing generation {published}; published it"
            if published < current:
                _, generation = self.apply()
                return f"the extension was older than generation {current}; rebuilt it as generation {generation}"
            return None
        status = self.status() or {}
        reported = status.get("generation")
        profiles = status.get("profiles") if isinstance(status.get("profiles"), dict) else {}
        still_loaded = any(isinstance(result, dict) and result.get("ok") for result in profiles.values())
        if isinstance(reported, int) and not isinstance(reported, bool) and reported >= current and still_loaded:
            _, generation = self.apply()
            return f"the last uninstall stopped before telling Astro; published generation {generation}"
        return None

    def wait_status(self, generation: int, alive) -> tuple[str, dict | None]:
        deadline = time.monotonic() + STATUS_TIMEOUT
        while True:
            status = self.status()
            reported = status.get("generation") if status else None
            if isinstance(reported, int) and not isinstance(reported, bool) and reported >= generation:
                return ("superseded" if reported > generation else "reported"), status
            if not alive():
                return "quit", None
            if time.monotonic() >= deadline:
                return "timeout", None
            time.sleep(STATUS_POLL)


def meta_from_record(record: dict) -> Meta:
    fields = {key: record[key] for key in Meta.__dataclass_fields__ if key in record}
    return Meta(**fields)


def manifest_version(generation: int) -> str:
    return f"1.{generation // 65536 % 65536}.{generation % 65536}"


def validate_manifest(manifest: dict, js_files: set[str]) -> None:
    def fail(message: str):
        raise StoreError(f"the generated manifest is invalid ({message}); nothing was changed")

    if set(manifest) != MANIFEST_KEYS or manifest["manifest_version"] != 3:
        fail("unexpected keys")
    if not all(isinstance(manifest[key], str) and manifest[key] for key in ("name", "version", "description")):
        fail("name, version and description must be text")
    entries = manifest["content_scripts"]
    if not isinstance(entries, list) or not entries:
        fail("no content scripts")
    if len(entries) > MAX_ENTRIES:
        fail(f"{len(entries)} content script entries, over Astro's limit of {MAX_ENTRIES}; uninstall some scripts")
    files = {js for entry in entries if isinstance(entry, dict) and isinstance(entry.get("js"), list) for js in entry["js"]}
    if len(files) > MAX_FILES:
        fail(f"{len(files)} script files, over Astro's limit of {MAX_FILES}; uninstall some scripts")
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != ENTRY_KEYS:
            fail("a content script has unexpected keys")
        try:
            if not entry["matches"]:
                fail("a content script has no matches")
            for key in ("matches", "exclude_matches"):
                if not isinstance(entry[key], list):
                    fail(f"{key} isn't a list")
                for pattern in entry[key]:
                    check_match(pattern, key)
            for key in ("include_globs", "exclude_globs"):
                if not isinstance(entry[key], list):
                    fail(f"{key} isn't a list")
                for glob in entry[key]:
                    check_glob(glob, key)
        except ScriptError as error:
            fail(str(error))
        if not isinstance(entry["js"], list) or not entry["js"] or len(entry["js"]) > MAX_FILES_PER_ENTRY or any(js not in js_files for js in entry["js"]):
            fail("a content script names a file that isn't there")
        if entry["run_at"] not in RUN_AT or entry["world"] not in WORLDS or not isinstance(entry["all_frames"], bool):
            fail("bad run_at, world or all_frames")


def repair_if_present(data_root: Path) -> str | None:
    store = Store(data_root)
    try:
        if not store.open(False) or store.records_fd is None and not store.extension_present() and not store.generation():
            return None
        store.lock()
        if store.records_fd is None:
            store.records_fd = open_dir(store.root_fd, "scripts", True)
        return store.repair()
    finally:
        store.close()
