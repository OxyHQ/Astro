import ipaddress
import json
import re
from urllib.parse import urlsplit

SENTINEL = -1
HEX_DIGITS = frozenset(b"0123456789abcdefABCDEF")
STAR, QUESTION, BACKSLASH = 42, 63, 92
SCRIPT_SCHEMES = ("http", "https", "file", "ftp")
WILDCARD_SCHEMES = ("http", "https")
DEFAULT_PORTS = {"http": 80, "https": 443, "ftp": 21}
UNESCAPED_ASCII = frozenset(b'"-<>_~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
BANNED_RANGES = (
    (0x0085, 0x0085), (0x00A0, 0x00A0), (0x00AD, 0x00AD), (0x034F, 0x034F), (0x0600, 0x0605), (0x061C, 0x061C),
    (0x06DD, 0x06DD), (0x070F, 0x070F), (0x08E2, 0x08E2), (0x115F, 0x1160), (0x1680, 0x1680), (0x17B4, 0x17B5),
    (0x180B, 0x180E), (0x2000, 0x200F), (0x2028, 0x202F), (0x205F, 0x206F), (0x2800, 0x2800), (0x3000, 0x3000),
    (0x3164, 0x3164), (0xFE00, 0xFE0F), (0xFEFF, 0xFEFF), (0xFFA0, 0xFFA0), (0xFFF0, 0xFFFB), (0x110BD, 0x110BD),
    (0x110CD, 0x110CD), (0x13430, 0x13438), (0x1BCA0, 0x1BCA3), (0x1D173, 0x1D17A), (0x1F50F, 0x1F510),
    (0x1F512, 0x1F513), (0xE0000, 0xE0FFF),
)
IDNA_DEVIATIONS = frozenset("\u00df\u03c2\u200c\u200d")
_LABEL = re.compile(r"^[a-z0-9_-]+$")


class PatternError(ValueError):
    pass


def _lead_length(byte: int) -> int:
    if 0xC2 <= byte <= 0xDF:
        return 2
    if 0xE0 <= byte <= 0xEF:
        return 3
    if 0xF0 <= byte <= 0xF4:
        return 4
    return 0


def _first_char(data: bytes) -> tuple[int, int] | None:
    if not data:
        return None
    if data[0] < 0x80:
        return data[0], 1
    size = _lead_length(data[0])
    if not size or len(data) < size:
        return None
    try:
        text = data[:size].decode("utf-8")
    except UnicodeDecodeError:
        return None
    return ord(text), size


def decode(data: bytes) -> list[int]:
    points = []
    index = 0
    while index < len(data):
        found = _first_char(data[index : index + 4])
        if found is None:
            points.append(SENTINEL)
            index += 1
        else:
            points.append(found[0])
            index += found[1]
    return points


def _escaped_byte(data: bytes, index: int) -> int | None:
    if index + 2 >= len(data) or data[index] != 0x25:
        return None
    digits = data[index + 1 : index + 3]
    if not all(c in HEX_DIGITS for c in digits):
        return None
    return int(digits.decode("ascii"), 16)


def _should_unescape(point: int) -> bool:
    if point < 0x80:
        return point in UNESCAPED_ASCII
    return not any(low <= point <= high for low, high in BANNED_RANGES)


def unescape(data: bytes) -> bytes:
    out = bytearray()
    index = 0
    while index < len(data):
        first = _escaped_byte(data, index)
        found = None
        if first is not None:
            collected = bytearray([first])
            if 0xC2 <= first <= 0xF4:
                while len(collected) < 4:
                    trail = _escaped_byte(data, index + len(collected) * 3)
                    if trail is None or not 0x80 <= trail <= 0xBF:
                        break
                    collected.append(trail)
            found = _first_char(bytes(collected))
        if found is None:
            if first is not None:
                out.append(first)
                index += 3
            else:
                out.append(data[index])
                index += 1
            continue
        point, size = found
        if not _should_unescape(point):
            out += data[index : index + 3 * size]
        else:
            out += chr(point).encode("utf-8")
        index += 3 * size
    return bytes(out)


def _search(pattern, p, string, s, distance):
    p_start, s_start = p, s
    escape = False
    while True:
        if p == len(pattern):
            if s == len(string):
                return True, p, s
        else:
            char = pattern[p]
            if not escape and char in (STAR, QUESTION):
                return True, p, s
            if not escape and char == BACKSLASH:
                escape = True
                p += 1
                continue
            escape = False
            if s == len(string):
                return False, p, s
            if char == string[s] and char != SENTINEL:
                p += 1
                s += 1
                continue
        if distance == 0:
            return False, p, s
        distance -= 1
        p = p_start
        s_start += 1
        s = s_start


def match_pattern(string: list[int], pattern: list[int]) -> bool:
    p = s = 0
    while True:
        stars = False
        questions = 0
        while p < len(pattern) and pattern[p] in (STAR, QUESTION):
            stars = stars or pattern[p] == STAR
            questions += pattern[p] == QUESTION
            p += 1
        distance = -1 if stars else questions
        ok, p, s = _search(pattern, p, string, s, distance)
        if not ok:
            return False
        if p == len(pattern):
            return True


def _ipv4_part(text: str) -> int | None:
    if text[:2] in ("0x", "0X"):
        digits, base = text[2:], 16
    elif len(text) > 1 and text.startswith("0"):
        digits, base = text[1:], 8
    else:
        digits, base = text, 10
    if digits == "":
        return 0 if base != 10 else None
    try:
        return int(digits, base) if digits.isascii() and digits.isalnum() else None
    except ValueError:
        return None


def ipv4(host: str) -> str | None:
    parts = host.split(".")
    if parts and parts[-1] == "" and len(parts) > 1:
        parts = parts[:-1]
    last = parts[-1]
    if not (last.isascii() and (last.isdigit() or (last[:2] in ("0x", "0X") and all(c in "0123456789abcdefABCDEF" for c in last[2:])))):
        return None
    if len(parts) > 4:
        raise PatternError("not a valid IPv4 address")
    numbers = [_ipv4_part(part) for part in parts]
    if any(number is None for number in numbers) or any(number > 255 for number in numbers[:-1]):
        raise PatternError("not a valid IPv4 address")
    if numbers[-1] >= 256 ** (5 - len(numbers)):
        raise PatternError("not a valid IPv4 address")
    value = numbers[-1]
    for index, number in enumerate(numbers[:-1]):
        value += number * 256 ** (3 - index)
    return str(ipaddress.IPv4Address(value))


def idna(host: str) -> str:
    labels = []
    for label in host.split("."):
        if label.isascii():
            lowered = label.lower()
            if lowered.startswith("xn--"):
                try:
                    lowered[4:].encode("ascii").decode("punycode")
                except (UnicodeError, ValueError):
                    raise PatternError(f"{label} isn't valid punycode") from None
            labels.append(lowered)
            continue
        if IDNA_DEVIATIONS & set(label):
            raise PatternError("the host has ß, ς or a joiner, which browsers convert differently; write it in punycode")
        try:
            labels.append(label.encode("idna").decode("ascii"))
        except UnicodeError:
            raise PatternError("the host isn't a valid internationalized name") from None
    return ".".join(labels)


def canonical_host(host: str) -> str:
    if "%" in host:
        raise PatternError("hosts can't have % (no IPv6 scope ids or escapes)")
    if host.startswith("["):
        if not host.endswith("]") or host.count("[") != 1 or host.count("]") != 1:
            raise PatternError("invalid IPv6 host")
        try:
            return f"[{ipaddress.IPv6Address(host[1:-1]).compressed}]"
        except ValueError:
            raise PatternError("invalid IPv6 address") from None
    address = ipv4(host)
    if address is not None:
        return address
    lowered = idna(host)
    labels = lowered.rstrip(".").split(".")
    if not labels or any(not _LABEL.match(label) for label in labels):
        raise PatternError("the host has characters a hostname can't have")
    return lowered


def _path_bytes(path: str) -> bytes:
    return path.encode("utf-8")


def parse(pattern: str) -> dict:
    if pattern == "<all_urls>":
        return {"all": True, "schemes": list(SCRIPT_SCHEMES), "host": "", "sub": True, "port": "*", "file": False, **_path_fields("/*")}
    if "\0" in pattern:
        raise PatternError("contains a null character")
    scheme, sep, rest = pattern.partition("://")
    if not sep:
        raise PatternError("a match pattern is <all_urls> or scheme://host/path")
    if scheme != "*" and scheme not in SCRIPT_SCHEMES:
        raise PatternError(f"content scripts only match {', '.join(('*',) + SCRIPT_SCHEMES)} URLs")
    schemes = list(WILDCARD_SCHEMES) if scheme == "*" else [scheme]
    if not rest:
        raise PatternError("the host is empty")
    if scheme == "file":
        host, slash, path = rest.partition("/")
        if not slash:
            raise PatternError("add a path, like file:///*")
        if host and host != "localhost":
            raise PatternError("file patterns have no host (file:///path)")
        return {"all": False, "schemes": schemes, "host": "", "sub": False, "port": "*", "file": True, **_path_fields("/" + path)}
    end = rest.find("/")
    if end == 0:
        raise PatternError("the host is empty")
    if end < 0:
        raise PatternError("add a path, like /*")
    host_and_port, path = rest[:end], rest[end:]
    port = "*"
    if host_and_port.startswith("["):
        close = host_and_port.find("]")
        if close < 0:
            raise PatternError("invalid IPv6 host")
        if close == 1:
            raise PatternError("the host is empty")
        host = host_and_port[: close + 1]
        tail = host_and_port[close + 1 :]
        if tail:
            if not tail.startswith(":"):
                raise PatternError("invalid IPv6 host")
            port = tail[1:]
            _check_port(scheme, port)
    else:
        host, colon, port_text = host_and_port.partition(":")
        if colon:
            _check_port(scheme, port_text)
            port = port_text
    if not host:
        raise PatternError("the host is empty")
    sub = False
    if host == "*":
        sub, host = True, ""
    elif host.startswith("*."):
        if len(host) == 2:
            raise PatternError("the host is empty")
        sub, host = True, host[2:]
    if "*" in host:
        raise PatternError("* only works as the whole host or a *. prefix")
    if host:
        host = canonical_host(host)
    return {"all": False, "schemes": schemes, "host": host, "sub": sub, "port": port, "file": False, **_path_fields(path)}


def _check_port(scheme: str, port: str) -> None:
    if port == "*":
        return
    if scheme == "*":
        raise PatternError("a pattern with scheme * can't name a port")
    if not port.isdigit() or not port.isascii():
        raise PatternError("the port is a number or *")
    if len(port) > 1 and port.startswith("0"):
        raise PatternError("write the port without leading zeros")
    if int(port) > 65535:
        raise PatternError("the port must be 0 to 65535")


def _path_fields(path: str) -> dict:
    raw = path.replace("\\", "\\\\").replace("?", "\\?")
    raw_bytes = _path_bytes(raw)
    utf8 = unescape(raw_bytes)
    return {"raw": decode(raw_bytes), "utf8": decode(utf8), "utf8Bytes": list(utf8)}


def glob_points(glob: str) -> list[int]:
    return decode(glob.encode("utf-8"))


def _matches_path(spec: dict, test: str) -> bool:
    test_bytes = test.encode("utf-8")
    unescaped = unescape(test_bytes)
    if bytes(spec["utf8Bytes"]) == unescaped + b"/*":
        return True
    return match_pattern(decode(unescaped), spec["utf8"]) or match_pattern(decode(test_bytes), spec["raw"])


def _is_ip(host: str) -> bool:
    return host.startswith("[") or re.fullmatch(r"\d+\.\d+\.\d+\.\d+", host) is not None


def _matches_host(spec: dict, host: str) -> bool:
    test = host.rstrip(".")
    pattern = spec["host"].rstrip(".")
    if test == pattern:
        return True
    if spec["sub"] and not pattern:
        return True
    if not spec["sub"] or _is_ip(test):
        return False
    return len(test) > len(pattern) + 1 and test.endswith(pattern) and test[-len(pattern) - 1] == "."


def split(url: str) -> dict | None:
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return None
    scheme = parts.scheme.lower()
    host = parts.hostname or ""
    if host:
        try:
            host = canonical_host(f"[{host}]" if ":" in host else host)
        except PatternError:
            return None
    before_fragment = url.split("#", 1)[0]
    path = parts.path or "/"
    if "?" in before_fragment:
        path += "?" + before_fragment.split("?", 1)[1]
    effective = port if port is not None else DEFAULT_PORTS.get(scheme, -1)
    return {"scheme": scheme, "host": host, "port": str(effective), "path": path}


def matches(spec: dict, url: dict | None) -> bool:
    if url is None or url["scheme"] not in spec["schemes"]:
        return False
    if spec["all"]:
        return True
    if not spec["file"] and not _matches_host(spec, url["host"]):
        return False
    if spec["port"] != "*" and spec["port"] != url["port"]:
        return False
    return _matches_path(spec, url["path"])


def glob_matches(points: list[int], url: str) -> bool:
    return match_pattern(decode(url.encode("utf-8")), points)


JS = r"""(rules, href) => {
const SENTINEL = -1;
const defaultPorts = { "http:": "80", "https:": "443", "ftp:": "21" };
const unescapedAscii = new Set(Array.from('"-<>_~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (c) => c.charCodeAt(0)));
const banned = __BANNED__;
const leadLength = (b) => (b >= 0xC2 && b <= 0xDF ? 2 : b >= 0xE0 && b <= 0xEF ? 3 : b >= 0xF0 && b <= 0xF4 ? 4 : 0);
const firstChar = (bytes, start, end) => {
  if (start >= end) return null;
  const b0 = bytes[start];
  if (b0 < 0x80) return [b0, 1];
  const size = leadLength(b0);
  if (!size || end - start < size) return null;
  let point = b0 & (size === 2 ? 0x1F : size === 3 ? 0x0F : 0x07);
  for (let i = 1; i < size; i++) {
    const b = bytes[start + i];
    if (b < 0x80 || b > 0xBF) return null;
    point = (point << 6) | (b & 0x3F);
  }
  const min = size === 2 ? 0x80 : size === 3 ? 0x800 : 0x10000;
  if (point < min || point > 0x10FFFF || (point >= 0xD800 && point <= 0xDFFF)) return null;
  return [point, size];
};
const decode = (bytes) => {
  const points = [];
  for (let i = 0; i < bytes.length; ) {
    const found = firstChar(bytes, i, Math.min(bytes.length, i + 4));
    if (!found) { points.push(SENTINEL); i += 1; } else { points.push(found[0]); i += found[1]; }
  }
  return points;
};
const hex = (b) => (b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102);
const escapedByte = (bytes, i) => (i + 2 >= bytes.length || bytes[i] !== 37 || !hex(bytes[i + 1]) || !hex(bytes[i + 2]) ? null : parseInt(String.fromCharCode(bytes[i + 1], bytes[i + 2]), 16));
const shouldUnescape = (p) => (p < 0x80 ? unescapedAscii.has(p) : !banned.some(([low, high]) => p >= low && p <= high));
const encoder = new TextEncoder();
const unescape = (bytes) => {
  const out = [];
  for (let i = 0; i < bytes.length; ) {
    const first = escapedByte(bytes, i);
    let found = null;
    if (first !== null) {
      const collected = [first];
      if (first >= 0xC2 && first <= 0xF4) {
        while (collected.length < 4) {
          const trail = escapedByte(bytes, i + collected.length * 3);
          if (trail === null || trail < 0x80 || trail > 0xBF) break;
          collected.push(trail);
        }
      }
      found = firstChar(collected, 0, collected.length);
    }
    if (!found) {
      if (first !== null) { out.push(first); i += 3; } else { out.push(bytes[i]); i += 1; }
      continue;
    }
    const [point, size] = found;
    if (!shouldUnescape(point)) for (let j = 0; j < 3 * size; j++) out.push(bytes[i + j]);
    else for (const b of encoder.encode(String.fromCodePoint(point))) out.push(b);
    i += 3 * size;
  }
  return out;
};
const search = (pattern, p, string, s, distance) => {
  let pStart = p, sStart = s, escape = false;
  while (true) {
    let mismatch = false;
    if (p === pattern.length) {
      if (s === string.length) return [true, p, s];
      mismatch = true;
    } else {
      const c = pattern[p];
      if (!escape && (c === 42 || c === 63)) return [true, p, s];
      if (!escape && c === 92) { escape = true; p += 1; continue; }
      escape = false;
      if (s === string.length) return [false, p, s];
      if (c === string[s] && c !== SENTINEL) { p += 1; s += 1; continue; }
      mismatch = true;
    }
    if (distance === 0) return [false, p, s];
    distance -= 1;
    p = pStart;
    sStart += 1;
    s = sStart;
  }
};
const matchPattern = (string, pattern) => {
  let p = 0, s = 0;
  while (true) {
    let stars = false, questions = 0;
    while (p < pattern.length && (pattern[p] === 42 || pattern[p] === 63)) { stars = stars || pattern[p] === 42; questions += pattern[p] === 63 ? 1 : 0; p += 1; }
    const [ok, np, ns] = search(pattern, p, string, s, stars ? -1 : questions);
    if (!ok) return false;
    p = np; s = ns;
    if (p === pattern.length) return true;
  }
};
let url = null;
try { url = new URL(href); } catch {}
const scheme = url ? url.protocol.slice(0, -1) : "";
const beforeFragment = href.split("#")[0];
const testPath = url ? (url.pathname || "/") + (beforeFragment.includes("?") ? "?" + beforeFragment.slice(beforeFragment.indexOf("?") + 1) : "") : "";
const testHost = url ? url.hostname.toLowerCase().replace(/\.+$/, "") : "";
const testPort = url ? url.port || defaultPorts[url.protocol] || "-1" : "";
const isIp = testHost.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(testHost);
const pathBytes = Array.from(encoder.encode(testPath));
const unescapedPath = unescape(pathBytes);
const hostMatches = (p) => {
  const pattern = p.host.replace(/\.+$/, "");
  if (testHost === pattern) return true;
  if (p.sub && !pattern) return true;
  if (!p.sub || isIp) return false;
  return testHost.length > pattern.length + 1 && testHost.endsWith(pattern) && testHost[testHost.length - pattern.length - 1] === ".";
};
const pathMatches = (p) => {
  const wanted = p.utf8Bytes;
  if (wanted.length === unescapedPath.length + 2 && wanted[wanted.length - 2] === 47 && wanted[wanted.length - 1] === 42 && unescapedPath.every((b, i) => b === wanted[i])) return true;
  return matchPattern(decode(unescapedPath), p.utf8) || matchPattern(decode(pathBytes), p.raw);
};
const matches = (p) => {
  if (!url || !p.schemes.includes(scheme)) return false;
  if (p.all) return true;
  if (!p.file && !hostMatches(p)) return false;
  if (p.port !== "*" && p.port !== testPort) return false;
  return pathMatches(p);
};
const hrefPoints = decode(Array.from(encoder.encode(href)));
const globbed = (list) => list.some((points) => matchPattern(hrefPoints, points));
const included = rules.match.some(matches) || ((scheme === "http" || scheme === "https") && globbed(rules.include));
if (!included) return "no rule matches";
return rules.excludeMatch.some(matches) || globbed(rules.exclude) ? "excluded" : "run";
}""".replace("__BANNED__", json.dumps([list(pair) for pair in BANNED_RANGES]))
