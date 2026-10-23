#!/usr/bin/env bash
set -euo pipefail

vendor="$(cd "$(dirname "$0")/.." && pwd)/vendor"

UBO_VERSION="1.75.0"
UBO_SHA256="393cf95709d1074d4022970e9014e434395c53a822387f1e25f43be97cf4b582"
UBO_KEY="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv1MPdIgJjIsN4Y0N/20GDNPfN4J//aknk5dsH8Y1LBxSnz3Jp/BT187Gub5cv6lee5CUVDmVBa3Yiqow8GMna5KwX+ZP+yc1pt/ewzyNxm2BzoQPgWz+1DgZaahz56/szi1EEtWVYxd3wNxFN4wPDqwV6aqlnV4R3RnxlF1ocw1kDgJ+8BxR1EY+MB+H8bymdef+xB3TNifBZIVmZt81cC3UMOG6KWRTU1wtIXsW+ZqSv5zaeFHLkjG4MPB7EfcMGrvO80ElJBZZLdrTmYOL4uUPsz2Wy6GiPWzpDmzzI9RfsZm11sLiJo63blcPF0Cz3sM0wQfxJPPcQuqkZDReswIDAQAB"
UBO_PATCH="20"
ubo="$vendor/ubo"
stamp="$UBO_VERSION-$UBO_PATCH"
installed() { [ -f "$ubo/.version" ] && [ "$(cat "$ubo/.version")" = "$stamp" ]; }
if ! installed && [ -z "${UBO_LOCKED:-}" ]; then
  mkdir -p "$ubo"
  UBO_LOCKED=1 exec lockf -k -t 600 "$ubo/.lock" "$0"
fi
if ! installed; then
  zip="$ubo/uBlock0_$UBO_VERSION.chromium.zip"
  if [ ! -f "$zip" ]; then
    url="https://github.com/gorhill/uBlock/releases/download/$UBO_VERSION/uBlock0_$UBO_VERSION.chromium.zip"
    echo "Downloading $url"
    curl -fL --retry 3 -o "$zip.part" "$url"
    mv "$zip.part" "$zip"
  fi
  echo "$UBO_SHA256  $zip" | shasum -a 256 -c -
  rm -rf "$ubo/unzip" "$ubo/ext.new" "$ubo/ext.old"
  unzip -q "$zip" -d "$ubo/unzip"
  mv "$ubo/unzip/uBlock0.chromium" "$ubo/ext.new"
  rm -rf "$ubo/unzip"
  python3 -I - "$ubo/ext.new" "$UBO_KEY" "$UBO_PATCH" <<'PY'
import json, os, sys
ext, key, level = sys.argv[1], sys.argv[2], sys.argv[3]
path = os.path.join(ext, "manifest.json")
manifest = json.load(open(path))
manifest["key"] = key
manifest["version_name"] = manifest["version"]
manifest["version"] = f"{manifest['version']}.{level}"
manifest["incognito"] = "spanning"
web = ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
if manifest["permissions"].count("<all_urls>") != 1:
    sys.exit("ubo.sh: manifest.json no longer asks for <all_urls>")
manifest["permissions"] = [p for p in manifest["permissions"] if p != "<all_urls>"] + web
scripts = manifest["content_scripts"]
kept = [entry for entry in scripts if entry["js"] not in (["/js/scriptlets/subscriber.js"], ["/js/scriptlets/updater.js"])]
if len(kept) != len(scripts) - 2:
    sys.exit("ubo.sh: manifest.json no longer has the subscriber and updater content scripts")
manifest["content_scripts"] = kept
json.dump(manifest, open(path, "w"), indent=2)
ASTRO_MIRROR_HELPERS = r"""const astroMirrorRoot = 'https://services.helium.imput.net/ubo/';
const astroMirrorURLs = new Map(Object.entries(ASTRO_MIRROR_MAP));
const astroBundledSizes = new Map(Object.entries(ASTRO_MIRROR_BUNDLED_SIZES));
const astroMinimumFilterLines = ASTRO_MIRROR_MIN_LINES;
const astroUpstreamAtLeastEvery = 4 * 86400000;
const astroIsMirrorURL = url => typeof url === 'string' && url.startsWith(astroMirrorRoot);
const astroIsMirrored = assetKey => astroMirrorURLs.has(assetKey);
const astroTrustPrefixesChanged = ( ) =>
    µb.hiddenSettings.trustedListPrefixes !== µb.hiddenSettingsDefault.trustedListPrefixes;
let astroCopies;
let astroCopiesReadable = false;
const astroCopiesLoaded = vAPI.storage.get('astroMirrorCopies').then(bin => {
    const value = bin instanceof Object ? bin.astroMirrorCopies : undefined;
    astroCopiesReadable = value === undefined ||
        (value instanceof Object && Array.isArray(value) === false);
    astroCopies = astroCopiesReadable && value instanceof Object ? value : {};
}).catch(( ) => {
    astroCopies = {};
    astroCopiesReadable = false;
});
const astroSaveCopies = ( ) => {
    if ( astroCopies === undefined ) { return; }
    astroCopiesReadable = true;
    vAPI.storage.set({ astroMirrorCopies: astroCopies });
};
const astroNoteUpstreamTry = assetKey => {
    if ( astroIsMirrored(assetKey) === false || astroCopies === undefined ) { return; }
    astroCopies[assetKey] = { ...(astroCopies[assetKey] || {}), upstreamTriedAt: Date.now() };
    astroSaveCopies();
};
const astroNoteCopy = (assetKey, url) => {
    if ( astroIsMirrored(assetKey) === false || astroCopies === undefined ) { return; }
    astroCopies[assetKey] = { ...(astroCopies[assetKey] || {}), mirror: astroIsMirrorURL(url) };
    astroSaveCopies();
};
const astroMayHoldMirrorCopy = assetKey => {
    if ( astroIsMirrored(assetKey) === false ) { return false; }
    if ( astroCopies === undefined || astroCopiesReadable === false ) { return true; }
    const entry = astroCopies[assetKey];
    return entry instanceof Object === false || entry.mirror !== false;
};
const astroMirrorURL = assetKey => {
    const url = astroMirrorURLs.get(assetKey);
    if ( astroIsMirrorURL(url) === false ) { return; }
    if ( astroCopies === undefined || astroCopiesReadable === false ) { return; }
    if ( astroTrustPrefixesChanged() || µb.isTrustedList(assetKey) ) { return; }
    const entry = astroCopies[assetKey];
    const triedAt = entry instanceof Object && typeof entry.upstreamTriedAt === 'number' ? entry.upstreamTriedAt : 0;
    if ( Date.now() - triedAt > astroUpstreamAtLeastEvery ) { return; }
    return url;
};
const astroStripMetadata = text => text.replace(
    /^(?:! *|# +)(?:diff(?: +|-)path|diff(?: +|-)name|diff(?: +|-)expires|expires|last(?: +|-)modified|timeupdated|checksum) *:.*$/gim,
    ''
);
const astroIsFilterLine = line => {
    const s = line.trim();
    if ( s === '' || s.startsWith('!') || /^#(?:\s|$)/.test(s) ) { return false; }
    return /^\[adblock/i.test(s) === false;
};
const astroLooksLikeFilterList = text => {
    const start = text.trimStart();
    if ( start.startsWith('{') || start.startsWith('<') ) { return false; }
    return start.startsWith('[') === false || /^\[adblock/i.test(start);
};
const astroTrustedNow = assetKey => astroTrustPrefixesChanged() || µb.isTrustedList(assetKey);
async function astroMirrorCopyUnusable(assetKey, text) {
    if ( astroTrustedNow(assetKey) ) { return 'the list is trusted now'; }
    if ( astroLooksLikeFilterList(text) === false ) { return 'the mirror copy is not a filter list'; }
    const cached = await assetCacheRead(assetKey);
    if ( astroTrustedNow(assetKey) ) { return 'the list is trusted now'; }
    const floor = stringIsNotEmpty(cached.content)
        ? cached.content.length
        : astroBundledSizes.get(assetKey) || 0;
    if ( floor !== 0 ) {
        return text.length * 2 < floor ? 'the mirror copy is much smaller than the last good one' : undefined;
    }
    let lines = 0;
    for ( const line of text.split('\n') ) {
        if ( astroIsFilterLine(line) === false ) { continue; }
        lines += 1;
        if ( lines >= astroMinimumFilterLines ) { return; }
    }
    return 'the mirror copy has too few filters';
}
const astroSameOrigin = (requested, received) => {
    if ( typeof received !== 'string' || received === '' ) { return false; }
    try {
        return new URL(requested).origin === new URL(received).origin;
    } catch {
        return false;
    }
};
const astroCachedURL = (assetKey, url) => {
    if ( astroIsMirrorURL(url) === false ) { return url; }
    const entry = assetSourceRegistry[assetKey];
    const own = entry instanceof Object
        ? (Array.isArray(entry.contentURL) ? entry.contentURL : [ entry.contentURL ])
        : [];
    return own.find(u => typeof u === 'string' && reIsExternalPath.test(u)) || assetKey;
};
const astroContentURLs = (assetKey, entry, options) => {
    const own = typeof entry.contentURL === 'string'
        ? [ entry.contentURL ]
        : Array.isArray(entry.contentURL) ? entry.contentURL : [];
    const upstream = own.filter(url => reIsExternalPath.test(url));
    const local = own.filter(url => reIsExternalPath.test(url) === false);
    const cdn = Array.isArray(entry.cdnURLs)
        ? entry.cdnURLs.filter(url => upstream.includes(url) === false)
        : [];
    for ( let i = cdn.length - 1; i > 0; i-- ) {
        const j = Math.floor(Math.random() * (i + 1));
        [ cdn[i], cdn[j] ] = [ cdn[j], cdn[i] ];
    }
    const mirrorURL = options.favorOrigin === true ? undefined : astroMirrorURL(assetKey);
    const network = mirrorURL === undefined ? [ ...upstream, ...cdn ] : [ mirrorURL, ...upstream, ...cdn ];
    return options.favorLocal ? [ ...local, ...network ] : [ ...network, ...local ];
};

const getContentURLs = (assetKey, options = {}) => {
"""
ASTRO_MIRROR_ON = False
def astro_mirror_map(ext):
    if not ASTRO_MIRROR_ON:
        return {}, {}, 0
    import hashlib, posixpath, re, struct
    from urllib.parse import urlparse
    registry = json.load(open(os.path.join(ext, "assets", "assets.json")))
    def urls(value):
        return [value] if isinstance(value, str) else value if isinstance(value, list) else []
    mirrored = {}
    for key, entry in registry.items():
        if entry.get("content") != "filters" or key.startswith("ublock-") or key == "user-filters":
            continue
        sources = [u for u in urls(entry.get("contentURL")) + urls(entry.get("cdnURLs"))
                   if isinstance(u, str) and urlparse(u).scheme in ("http", "https")]
        if not sources:
            continue
        name = posixpath.basename(urlparse(sources[0]).path)
        if not (name.endswith(".txt") or name.endswith(".dat")):
            name = "filters.txt"
        first, second = struct.unpack("<II", hashlib.sha256(sources[0].encode()).digest()[:8])
        mirrored[key] = f"https://services.helium.imput.net/ubo/{key}/{first:x}/{second:x}/{name}"
    if len(mirrored) < 40:
        sys.exit(f"ubo.sh: only {len(mirrored)} lists for the mirror; assets.json changed shape")
    bundled = {}
    for key in mirrored:
        for url in urls(registry[key].get("contentURL")):
            if isinstance(url, str) and urlparse(url).scheme == "" and os.path.isfile(os.path.join(ext, url)):
                bundled[key] = os.path.getsize(os.path.join(ext, url))
                break
    def filter_lines(path):
        count = 0
        for line in open(path, encoding="utf-8", errors="replace"):
            text = line.strip()
            if not text or text.startswith("!") or re.match(r"^#(?:\s|$)", text) or re.match(r"^\[adblock", text, re.I):
                continue
            count += 1
        return count
    defaults = [key for key in bundled if registry[key].get("off") is not True]
    if not defaults:
        sys.exit("ubo.sh: no default list for the mirror has a bundled copy")
    fewest = min(filter_lines(os.path.join(ext, next(u for u in urls(registry[key].get("contentURL"))
                                                         if isinstance(u, str) and urlparse(u).scheme == ""
                                                         and os.path.isfile(os.path.join(ext, u)))))
                 for key in defaults)
    scale = 10 ** (len(str(fewest)) - 1)
    return mirrored, bundled, fewest // scale * scale
def patch(rel, old, new):
    path = os.path.join(ext, rel)
    source = open(path).read()
    if source.count(old) != 1:
        sys.exit(f"ubo.sh: {rel} no longer has exactly one {old.strip().splitlines()[0]!r}")
    open(path, "w").write(source.replace(old, new))
patch("js/background.js", "prefetchingDisabled: true,", "prefetchingDisabled: false,")
patch("js/background.js", "    noDashboard: false,", "    noDashboard: true,")
patch("js/background.js", "    autoUpdateDelayAfterLaunch: 37,", "    autoUpdateDelayAfterLaunch: 600,")
patch("js/background.js", "    showIconBadge: true,", "    showIconBadge: false,")
patch("js/background.js", "    contextMenuEnabled: true,", "    contextMenuEnabled: false,")
patch("js/contextmenu.js", "    newBits |= SUBSCRIBE_TO_LIST_BIT;\n", "")
patch("js/vapi-background.js",
      "        let version = manifest.version_name || manifest.version;\n",
      "        let version = manifest.version;\n")
patch("js/start.js",
      "    redirectEngine.invalidateResourcesSelfie(io);\n};\n",
      "    redirectEngine.invalidateResourcesSelfie(io);\n"
      "    µb.compiledFormatChanged = true;\n"
      "    µb.selfieManager.destroy();\n"
      "};\n")
patch("js/vapi-background.js",
      "    if ( webext.storage.managed instanceof Object === false ) {\n        return {",
      "    if ( true ) {\n        return {")
ASTRO_MIRROR = astro_mirror_map(ext)
patch("js/assets.js", "const getContentURLs = (assetKey, options = {}) => {\n",
      ASTRO_MIRROR_HELPERS.replace("ASTRO_MIRROR_MAP", json.dumps(ASTRO_MIRROR[0], sort_keys=True))
      .replace("ASTRO_MIRROR_BUNDLED_SIZES", json.dumps(ASTRO_MIRROR[1], sort_keys=True))
      .replace("ASTRO_MIRROR_MIN_LINES", str(ASTRO_MIRROR[2])))
patch("js/assets.js",
      "            contentURLs.unshift(...cdnURLs);\n"
      "        }\n"
      "    }\n"
      "    return contentURLs;\n"
      "};\n",
      "            contentURLs.unshift(...cdnURLs);\n"
      "        }\n"
      "    }\n"
      "    return contentURLs;\n"
      "};\n")
patch("js/assets.js",
      "            statusText: this.statusText || ''\n"
      "        };\n",
      "            statusText: this.statusText || '',\n"
      "            responseURL: this.responseURL || '',\n"
      "        };\n")
patch("js/assets.js",
      "        timeoutTimer.off();\n"
      "    };\n",
      "        timeoutTimer.off();\n"
      "        clearTimeout(deadlineTimer);\n"
      "    };\n")
patch("js/assets.js",
      "    const timeoutTimer = vAPI.defer.create(onTimeout);\n",
      "    const timeoutTimer = vAPI.defer.create(onTimeout);\n"
      "    const deadlineTimer = astroIsMirrorURL(url) ? setTimeout(onTimeout, timeoutAfter * 1000) : undefined;\n")
patch("js/assets.js",
      "        details = await assets.fetch(actualUrl);\n",
      "        details = await assets.fetch(actualUrl);\n"
      "        if ( astroIsMirrorURL(url) && astroSameOrigin(actualUrl, details.responseURL) === false ) {\n"
      "            details.content = '';\n"
      "            details.error = 'assets.fetchText(): redirected to another origin';\n"
      "        }\n")
patch("js/assets.js",
      "                url: contentURL,\n"
      "                silent: options.silent === true,\n",
      "                url: astroCachedURL(assetKey, contentURL),\n"
      "                silent: options.silent === true,\n")
patch("js/assets.js",
      "            url: contentURL,\n"
      "            resourceTime: result.resourceTime || 0,\n",
      "            url: astroCachedURL(assetKey, contentURL),\n"
      "            resourceTime: result.resourceTime || 0,\n")
patch("js/assets.js",
      "            continue;\n"
      "        }\n"
      "\n"
      "        error = undefined;\n"
      "\n"
      "        // If fetched resource is older than cached one, ignore\n",
      "            continue;\n"
      "        }\n"
      "\n"
      "        if ( astroIsMirrorURL(contentURL) ) {\n"
      "            const unusable = await astroMirrorCopyUnusable(assetKey, result.content);\n"
      "            if ( unusable !== undefined ) {\n"
      "                error = unusable;\n"
      "                continue;\n"
      "            }\n"
      "            result.content = astroStripMetadata(result.content);\n"
      "            result.resourceTime = 0;\n"
      "        }\n"
      "\n"
      "        error = undefined;\n"
      "\n"
      "        // If fetched resource is older than cached one, ignore\n")
patch("js/assets.js",
      "        if ( details.content === '' ) { continue; }\n"
      "        if ( reIsExternalPath.test(contentURL) && options.dontCache !== true ) {\n",
      "        if ( details.content === '' ) { continue; }\n"
      "        if ( astroIsMirrorURL(contentURL) ) {\n"
      "            const unusable = await astroMirrorCopyUnusable(assetKey, details.content);\n"
      "            if ( unusable !== undefined ) {\n"
      "                error = unusable;\n"
      "                continue;\n"
      "            }\n"
      "            details.content = astroStripMetadata(details.content);\n"
      "        }\n"
      "        if ( reIsExternalPath.test(contentURL) && options.dontCache !== true ) {\n")
patch("js/assets.js",
      "    const entry = assetSourceRegistry[assetKey];\n"
      "    if ( entry instanceof Object === false ) { return contentURLs; }\n",
      "    const entry = assetSourceRegistry[assetKey];\n"
      "    if ( entry instanceof Object === false ) { return contentURLs; }\n"
      "    if ( astroIsMirrored(assetKey) ) { return astroContentURLs(assetKey, entry, options); }\n")
patch("js/assets.js",
      "    for ( const contentURL of getContentURLs(assetKey, options) ) {\n"
      "        if ( reIsExternalPath.test(contentURL) === false ) { continue; }\n",
      "    for ( const contentURL of getContentURLs(assetKey, options) ) {\n"
      "        if ( reIsExternalPath.test(contentURL) === false ) { continue; }\n"
      "        if ( astroIsMirrorURL(contentURL) === false ) { astroNoteUpstreamTry(assetKey); }\n")
patch("js/assets.js",
      "    for ( const contentURL of contentURLs ) {\n"
      "        ubolog(`Fetching ${contentURL} from remote server `);\n",
      "    for ( const contentURL of contentURLs ) {\n"
      "        ubolog(`Fetching ${contentURL} from remote server `);\n"
      "        if ( reIsExternalPath.test(contentURL) && astroIsMirrorURL(contentURL) === false ) { astroNoteUpstreamTry(assetKey); }\n")
patch("js/assets.js",
      "        // Success\n"
      "        assetCacheWrite(assetKey, result.content, {\n",
      "        // Success\n"
      "        astroNoteCopy(assetKey, contentURL);\n"
      "        assetCacheWrite(assetKey, result.content, {\n")
patch("js/assets.js",
      "        if ( reIsExternalPath.test(contentURL) && options.dontCache !== true ) {\n"
      "            assetCacheWrite(assetKey, details.content, {\n",
      "        if ( reIsExternalPath.test(contentURL) && options.dontCache !== true ) {\n"
      "            astroNoteCopy(assetKey, contentURL);\n"
      "            assetCacheWrite(assetKey, details.content, {\n")
patch("js/assets.js",
      "const getAssetDiffDetails = assetKey => {\n",
      "const getAssetDiffDetails = assetKey => {\n"
      "    if ( astroIsMirrored(assetKey) ) { return; }\n")
patch("js/assets.js",
      "assets.purge = assetCacheMarkAsDirty;\n",
      "assets.purge = assetCacheMarkAsDirty;\n"
      "\n"
      "assets.astroRefuseTrustedMirrorCopy = async function(assetKey) {\n"
      "    if ( astroIsMirrored(assetKey) === false || µb.isTrustedList(assetKey) === false ) { return false; }\n"
      "    await astroCopiesLoaded;\n"
      "    if ( astroMayHoldMirrorCopy(assetKey) === false ) { return false; }\n"
      "    await assetCacheRemove(assetKey);\n"
      "    return true;\n"
      "};\n"
      "\n"
      "assets.astroIsTrustedMirrorCopy = assetKey =>\n"
      "    astroIsMirrored(assetKey) && µb.isTrustedList(assetKey) && astroMayHoldMirrorCopy(assetKey);\n")
patch("js/storage.js",
      "    const rawDetails = await io.get(assetKey, {\n"
      "        favorLocal: this.readyToFilter !== true,\n",
      "    await io.astroRefuseTrustedMirrorCopy(assetKey);\n"
      "    const rawDetails = await io.get(assetKey, {\n"
      "        favorLocal: this.readyToFilter !== true,\n")
patch("js/storage.js",
      "            if ( cached ) {\n"
      "                if ( this.selectedFilterLists.indexOf(details.assetKey) !== -1 ) {\n",
      "            if ( cached && io.astroIsTrustedMirrorCopy(details.assetKey) ) {\n"
      "                io.remove(details.assetKey);\n"
      "                this.removeCompiledFilterList(details.assetKey);\n"
      "            } else if ( cached ) {\n"
      "                if ( this.selectedFilterLists.indexOf(details.assetKey) !== -1 ) {\n")
patch("js/diff-updater.js",
      "const resolveURL = (path, url) => {\n",
      "const astroPatchAllowed = (patchPath, base, patchURL) => {\n"
      "    if ( typeof patchPath !== 'string' || /^(?:[a-z][a-z0-9+.-]*:|[\\\\/])/i.test(patchPath) ) { return false; }\n"
      "    let baseURL;\n"
      "    try { baseURL = new URL(base); } catch { return false; }\n"
      "    if ( patchURL.origin !== baseURL.origin ) { return false; }\n"
      "    const directory = baseURL.pathname.slice(0, baseURL.pathname.lastIndexOf('/') + 1);\n"
      "    const parent = directory.slice(0, directory.slice(0, -1).lastIndexOf('/') + 1) || '/';\n"
      "    return patchURL.pathname.startsWith(parent);\n"
      "};\n"
      "\n"
      "const astroPatchCacheKey = assetDetails =>\n"
      "    [ assetDetails.assetKey, assetDetails.patchPath, ...(assetDetails.patchURLs || assetDetails.cdnURLs || []) ].join('\\n');\n"
      "\n"
      "const resolveURL = (path, url) => {\n")
patch("js/diff-updater.js",
      "    const patchFile = basename(patchPath);\n"
      "    return patchFile !== '' && patches.has(patchFile);\n",
      "    const patchFile = basename(patchPath);\n"
      "    return patchFile !== '' && patches.has(astroPatchCacheKey(assetDetails));\n")
patch("js/diff-updater.js",
      "    if ( patches.has(patchFile) ) {\n"
      "        return patches.get(patchFile);\n"
      "    }\n"
      "    const patchDetailsPromise = fetchPatchDetailsFromCDNs(assetDetails);\n"
      "    patches.set(patchFile, patchDetailsPromise);\n",
      "    const patchCacheKey = astroPatchCacheKey(assetDetails);\n"
      "    if ( patches.has(patchCacheKey) ) {\n"
      "        return patches.get(patchCacheKey);\n"
      "    }\n"
      "    const patchDetailsPromise = fetchPatchDetailsFromCDNs(assetDetails);\n"
      "    patches.set(patchCacheKey, patchDetailsPromise);\n")
patch("js/diff-updater.js",
      "        const patchURL = resolveURL(patchPath, cdnURL);\n"
      "        if ( patchURL === undefined ) { continue; }\n",
      "        const patchURL = resolveURL(patchPath, cdnURL);\n"
      "        if ( patchURL === undefined ) { continue; }\n"
      "        if ( astroPatchAllowed(patchPath, cdnURL, patchURL) === false ) { continue; }\n")
patch("js/diff-updater.js",
      "        const response = await fetch(patchURL).catch(reason => {\n"
      "            console.error(reason, patchURL);\n"
      "        });\n"
      "        if ( response === undefined ) { continue; }\n"
      "        if ( response.status === 404 ) { break; }\n"
      "        if ( response.ok !== true ) { continue; }\n"
      "        const patchText = await response.text();\n",
      "        const controller = new AbortController();\n"
      "        const deadline = setTimeout(( ) => { controller.abort(); }, 30000);\n"
      "        const stop = ( ) => { clearTimeout(deadline); controller.abort(); };\n"
      "        const response = await fetch(patchURL, { signal: controller.signal }).catch(reason => {\n"
      "            console.error(reason, patchURL);\n"
      "        });\n"
      "        const sameOrigin = response !== undefined && typeof response.url === 'string' &&\n"
      "            response.url.startsWith(patchURL.origin + '/');\n"
      "        if ( response === undefined || sameOrigin === false ) { stop(); continue; }\n"
      "        if ( response.status === 404 ) { stop(); break; }\n"
      "        if ( response.ok !== true ) { stop(); continue; }\n"
      "        const patchText = await response.text().catch(( ) => undefined);\n"
      "        clearTimeout(deadline);\n"
      "        if ( patchText === undefined ) { continue; }\n")
patch("js/storage.js",
      "            const match = /^[a-z]+/.exec(i18n.getUILanguage());\n"
      "            if ( match !== null ) {\n"
      "                re = new RegExp('\\\\b' + match[0] + '\\\\b');",
      "            const langs = new Set([ i18n.getUILanguage(), ...(self.navigator.languages || []) ]\n"
      "                .map(lang => (/^[a-z]+/.exec(lang) || [])[0]).filter(Boolean));\n"
      "            if ( langs.size !== 0 ) {\n"
      "                re = new RegExp('\\\\b(?:' + Array.from(langs).join('|') + ')\\\\b');")
PY
  [ -d "$ubo/ext" ] && mv "$ubo/ext" "$ubo/ext.old"
  mv "$ubo/ext.new" "$ubo/ext"
  rm -rf "$ubo/ext.old"
  echo "$stamp" > "$ubo/.version"
fi
