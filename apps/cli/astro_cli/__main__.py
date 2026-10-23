import os
import sys


def take_lease() -> str | None:
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(sys.executable))))
    leases = os.path.join(root, ".leases")
    if not os.path.isdir(leases):
        return None
    path = os.path.join(leases, str(os.getpid()))
    try:
        os.close(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644))
    except OSError:
        return None
    return path


lease = take_lease()
try:
    from astro_cli.cli import main

    status = main()
finally:
    if lease:
        try:
            os.unlink(lease)
        except OSError:
            pass
sys.exit(status)
