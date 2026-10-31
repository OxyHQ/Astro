export const SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle";

export type FeedChannel = "stable" | "nightly";

export type UpdateOffer = {
  version: string;
  build: string | null;
  channel: string | null;
  url: string;
  length: number;
  signature: string;
};

type Identifier = number | string;

const NUMERIC = /^\d+$/;

function parts(version: string): { core: number[]; prerelease: Identifier[] } {
  const bare = version.trim().replace(/^v/i, "").split("+")[0] ?? "";
  const dash = bare.indexOf("-");
  const core = (dash < 0 ? bare : bare.slice(0, dash)).split(".").map((part) => (NUMERIC.test(part) ? Number(part) : 0));
  const prerelease = dash < 0 ? [] : bare.slice(dash + 1).split(".").filter(Boolean).map((part) => (NUMERIC.test(part) ? Number(part) : part));
  return { core, prerelease };
}

function compareIdentifiers(a: Identifier, b: Identifier): number {
  if (typeof a === "number" && typeof b === "number") return Math.sign(a - b);
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareVersions(a: string, b: string): number {
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.core.length, right.core.length); i++) {
    const order = Math.sign((left.core[i] ?? 0) - (right.core[i] ?? 0));
    if (order) return order;
  }
  if (!left.prerelease.length || !right.prerelease.length) return Math.sign(right.prerelease.length - left.prerelease.length);
  for (let i = 0; i < Math.max(left.prerelease.length, right.prerelease.length); i++) {
    const x = left.prerelease[i];
    const y = right.prerelease[i];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const order = compareIdentifiers(x, y);
    if (order) return order;
  }
  return 0;
}

export function displayVersion(version: string): string {
  const nightly = /^(.*)-nightly\.(\d+)$/.exec(version);
  return nightly ? `${nightly[1]} Nightly ${nightly[2]}` : version;
}

export const channelOfVersion = (version: string): FeedChannel => (/-nightly\.\d+$/.test(version) ? "nightly" : "stable");

const sparkleAttribute = (element: Element, name: string) => element.getAttributeNS(SPARKLE_NS, name) || element.getAttribute(`sparkle:${name}`) || null;

function sparkleChild(item: Element, name: string): string | null {
  for (const child of Array.from(item.childNodes)) {
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    if (element.localName === name && element.namespaceURI === SPARKLE_NS) return element.textContent?.trim() || null;
  }
  return null;
}

function enclosureFor(item: Element, os: string): Element | null {
  for (const child of Array.from(item.childNodes)) {
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    if (element.localName === "enclosure" && !element.namespaceURI && sparkleAttribute(element, "os") === os) return element;
  }
  return null;
}

export function parseAppcast(feed: Document, os = "windows"): UpdateOffer[] {
  if (feed.getElementsByTagName("parsererror").length) throw new Error("the update feed isn't valid XML");
  const offers: UpdateOffer[] = [];
  for (const item of Array.from(feed.getElementsByTagName("item"))) {
    const enclosure = enclosureFor(item, os);
    if (!enclosure) continue;
    const version = sparkleChild(item, "shortVersionString") ?? sparkleAttribute(enclosure, "shortVersionString");
    const url = enclosure.getAttribute("url");
    const signature = sparkleAttribute(enclosure, "edSignature");
    const length = Number(enclosure.getAttribute("length") ?? 0);
    if (!version || !url || !signature || !Number.isFinite(length) || length < 0) continue;
    offers.push({
      version,
      build: sparkleChild(item, "version") ?? sparkleAttribute(enclosure, "version"),
      channel: sparkleChild(item, "channel"),
      url,
      length,
      signature,
    });
  }
  return offers;
}

export function newestOffer(offers: UpdateOffer[], channel: FeedChannel, current: string): UpdateOffer | null {
  const allowed = (offer: UpdateOffer) => offer.channel === null || (channel === "nightly" && offer.channel === "nightly");
  let newest: UpdateOffer | null = null;
  for (const offer of offers) {
    if (!allowed(offer) || compareVersions(offer.version, current) <= 0) continue;
    if (!newest || compareVersions(offer.version, newest.version) > 0) newest = offer;
  }
  return newest;
}
