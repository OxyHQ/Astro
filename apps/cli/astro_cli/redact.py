import io
import logging
import re

MASK = "***"
_TOKEN_QUERY = re.compile(r"(token=)[^&\s'\"<>]+")
_secrets: set[str] = set()
_installed = False


def add_secret(secret: str | None) -> None:
    if secret:
        from urllib.parse import quote

        _secrets.add(secret)
        _secrets.add(quote(secret, safe=""))


def redact(text: str) -> str:
    for secret in sorted(_secrets, key=len, reverse=True):
        text = text.replace(secret, MASK)
    return _TOKEN_QUERY.sub(r"\1" + MASK, text)


def _unsafe_tail(text: str) -> int:
    keep = 0
    for secret in _secrets:
        for size in range(min(len(secret) - 1, len(text)), keep, -1):
            if text.endswith(secret[:size]):
                keep = size
                break
    return keep


class RedactingStream(io.TextIOBase):
    def __init__(self, stream):
        self._stream = stream
        self._pending = ""

    def write(self, text):
        cleaned = redact(self._pending + text)
        keep = _unsafe_tail(cleaned)
        ready, self._pending = (cleaned[:-keep], cleaned[-keep:]) if keep else (cleaned, "")
        if ready:
            self._stream.write(ready)
        return len(text)

    def drain(self):
        if self._pending:
            pending, self._pending = self._pending, ""
            self._stream.write(redact(pending))
        self._stream.flush()

    def flush(self):
        self.drain()

    def isatty(self):
        return self._stream.isatty()

    def fileno(self):
        return self._stream.fileno()

    @property
    def encoding(self):
        return self._stream.encoding

    @property
    def errors(self):
        return self._stream.errors

    @property
    def buffer(self):
        return self._stream.buffer


def install_log_redaction() -> None:
    global _installed
    if _installed:
        return
    _installed = True
    make_record = logging.getLogRecordFactory()

    def redacting_record(*args, **kwargs):
        record = make_record(*args, **kwargs)
        try:
            message = record.getMessage()
        except Exception:
            return record
        cleaned = redact(message)
        if cleaned != message:
            record.msg = cleaned
            record.args = ()
        return record

    handler_format = logging.Handler.format

    def redacting_format(self, record):
        return redact(handler_format(self, record))

    logging.setLogRecordFactory(redacting_record)
    logging.Handler.format = redacting_format
    logging.getLogger("pydoll").setLevel(logging.ERROR)
    logging.getLogger("websockets").setLevel(logging.WARNING)
