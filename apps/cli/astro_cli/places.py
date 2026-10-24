import errno
import os
import signal
import stat
import sys
from pathlib import Path

WINDOWS = os.name == "nt"
MACOS = sys.platform == "darwin"
CONTROL_FILE = "AstroControl.json"
REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
NONBLOCK = getattr(os, "O_NONBLOCK", 0)
BINARY = getattr(os, "O_BINARY", 0)


def installed_data_dir() -> Path:
    if MACOS:
        return Path.home() / "Library" / "Application Support" / "so.oxy.Astro"
    if WINDOWS:
        local = os.environ.get("LOCALAPPDATA")
        base = Path(local) if local and os.path.isabs(local) else Path.home() / "AppData" / "Local"
        return base / "Oxy" / "Astro" / "User Data"
    config = os.environ.get("XDG_CONFIG_HOME")
    base = Path(config) if config and os.path.isabs(config) else Path.home() / ".config"
    return base / "astro-browser"


def chromium_dir(root: Path) -> Path:
    return root / "Chromium" if MACOS else root


def control_file(root: Path) -> Path:
    return chromium_dir(root) / CONTROL_FILE


def session_file(root: Path) -> Path:
    return root / "session.json" if MACOS else root / "Default" / "Astro Documents" / "session.json"


def is_link(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(WINDOWS and getattr(info, "st_file_attributes", 0) & REPARSE_POINT)


def open_no_follow(path, flags: int = os.O_RDONLY, mode: int = 0o777, dir_fd: int | None = None) -> int:
    if not WINDOWS:
        return os.open(path, flags | os.O_NOFOLLOW, mode, dir_fd=dir_fd)
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        if not flags & os.O_CREAT:
            raise
    else:
        if is_link(info):
            raise OSError(errno.ELOOP, "is a symbolic link", str(path))
    return os.open(path, flags | BINARY, mode)


def owned_by_user(info: os.stat_result) -> bool:
    return WINDOWS or info.st_uid == os.getuid()


def private_mode(info: os.stat_result) -> bool:
    return WINDOWS or stat.S_IMODE(info.st_mode) == 0o600


def process_alive(pid: int) -> bool:
    if WINDOWS:
        return _windows_process_alive(pid)
    try:
        os.kill(pid, 0)
    except (ProcessLookupError, PermissionError):
        return False
    return True


def _windows_process_alive(pid: int) -> bool:
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel32.GetExitCodeProcess.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel32.OpenProcess(0x1000, False, pid)
    if not handle:
        return False
    try:
        code = wintypes.DWORD()
        return bool(kernel32.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259
    finally:
        kernel32.CloseHandle(handle)


def cancel_on_signals(loop, task) -> None:
    for name in ("SIGTERM", "SIGHUP"):
        signum = getattr(signal, name, None)
        if signum is None:
            continue
        try:
            loop.add_signal_handler(signum, task.cancel)
        except (NotImplementedError, RuntimeError):
            pass
