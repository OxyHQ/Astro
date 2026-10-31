export type SensitiveKind = "finance" | "health" | "passwords" | "organization";

export type Sensitivity = { kind: SensitiveKind; host: string; blocked: boolean };

export type ContentPolicy = {
  blockedSites: string[];
  sensitiveSites: string[];
  redact: RegExp[];
  agent: boolean;
  builtInSensitiveSites: boolean;
};

export const DEFAULT_POLICY: ContentPolicy = { blockedSites: [], sensitiveSites: [], redact: [], agent: true, builtInSensitiveSites: true };

const FINANCE_HOSTS = [
  "chase.com",
  "wellsfargo.com",
  "bankofamerica.com",
  "citi.com",
  "citibank.com",
  "capitalone.com",
  "usbank.com",
  "pnc.com",
  "truist.com",
  "schwab.com",
  "fidelity.com",
  "vanguard.com",
  "etrade.com",
  "morganstanley.com",
  "americanexpress.com",
  "discover.com",
  "ally.com",
  "sofi.com",
  "chime.com",
  "paypal.com",
  "venmo.com",
  "wise.com",
  "revolut.com",
  "n26.com",
  "monzo.com",
  "starlingbank.com",
  "barclays.co.uk",
  "hsbc.com",
  "hsbc.co.uk",
  "lloydsbank.com",
  "natwest.com",
  "santander.com",
  "santander.co.uk",
  "bancosantander.es",
  "bbva.com",
  "bbva.es",
  "caixabank.es",
  "ing.com",
  "ing.es",
  "ing.de",
  "deutsche-bank.de",
  "commerzbank.de",
  "bnpparibas.net",
  "credit-agricole.fr",
  "societegenerale.fr",
  "unicredit.it",
  "intesasanpaolo.com",
  "robinhood.com",
  "coinbase.com",
  "kraken.com",
  "binance.com",
  "dashboard.stripe.com",
  "mercury.com",
  "brex.com",
  "irs.gov",
  "agenciatributaria.gob.es",
  "tax.service.gov.uk",
  "impots.gouv.fr",
  "elster.de",
];

const HEALTH_HOSTS = [
  "mychart.com",
  "kp.org",
  "healthcare.gov",
  "followmyhealth.com",
  "athenahealth.com",
  "labcorp.com",
  "questdiagnostics.com",
  "zocdoc.com",
  "onemedical.com",
  "teladoc.com",
  "betterhelp.com",
  "talkspace.com",
  "patient.info",
  "nhs.uk",
  "doctolib.fr",
  "doctolib.de",
];

const PASSWORD_HOSTS = [
  "1password.com",
  "bitwarden.com",
  "lastpass.com",
  "dashlane.com",
  "keepersecurity.com",
  "nordpass.com",
  "pass.proton.me",
  "passwords.google.com",
  "roboform.com",
  "enpass.io",
];

const FINANCE_WORDS = /(^|[.-])(bank|banking|banco|banca|banque|sparkasse|volksbank|creditunion|fcu|onlinebanking|netbanking|ebanking|brokerage)([.-]|$)|(^|\.)[a-z0-9]*bank(ing)?\.[a-z]{2,}(\.[a-z]{2})?$/;
const HEALTH_WORDS = /(^|[.-])(mychart|patientportal|patient|myhealth|healthportal|telehealth|hospital|clinic)([.-]|$)/;

export function hostOfUrl(url: string): string {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, "").toLowerCase() : "";
  } catch {
    return "";
  }
}

const within = (host: string, site: string) => host === site || host.endsWith(`.${site}`);

export function sitePatternMatches(pattern: string, url: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (/^https?:\/\//.test(p)) return url.toLowerCase().startsWith(p);
  const host = hostOfUrl(url);
  if (!host) return false;
  const site = p.replace(/^\*\./, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (p.startsWith("*.")) return host.endsWith(`.${site}`) || host === site;
  return within(host, site);
}

export function builtInKind(host: string): SensitiveKind | null {
  if (!host) return null;
  if (PASSWORD_HOSTS.some((site) => within(host, site))) return "passwords";
  if (FINANCE_HOSTS.some((site) => within(host, site)) || FINANCE_WORDS.test(host)) return "finance";
  if (HEALTH_HOSTS.some((site) => within(host, site)) || HEALTH_WORDS.test(host)) return "health";
  return null;
}

export function sensitivity(url: string, policy: ContentPolicy = DEFAULT_POLICY): Sensitivity | null {
  const host = hostOfUrl(url);
  if (!host) return null;
  if (policy.blockedSites.some((p) => sitePatternMatches(p, url))) return { kind: "organization", host, blocked: true };
  if (policy.sensitiveSites.some((p) => sitePatternMatches(p, url))) return { kind: "organization", host, blocked: false };
  const kind = policy.builtInSensitiveSites ? builtInKind(host) : null;
  return kind ? { kind, host, blocked: false } : null;
}

const KIND_NAMES: Record<SensitiveKind, string> = {
  finance: "a banking or finance site",
  health: "a health site",
  passwords: "a password manager",
  organization: "a site your organization marks as sensitive",
};

export const sensitiveKindName = (kind: SensitiveKind) => KIND_NAMES[kind];

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;

export function redact(text: string, policy: ContentPolicy = DEFAULT_POLICY): { text: string; count: number } {
  let count = 0;
  let out = text.replace(CARD, (match) => {
    const digits = match.replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhn(digits)) return match;
    count++;
    return "[card number removed]";
  });
  for (const pattern of policy.redact) {
    out = out.replace(pattern, () => {
      count++;
      return "[removed by your organization's policy]";
    });
  }
  return { text: out, count };
}

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 2048).slice(0, 2000) : [];

export function parsePolicy(raw: unknown): ContentPolicy {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return DEFAULT_POLICY;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_POLICY;
  const v = value as Record<string, unknown>;
  const redactions = asStrings(v.redact).flatMap((source) => {
    try {
      return [new RegExp(source, "g")];
    } catch {
      return [];
    }
  });
  return {
    blockedSites: asStrings(v.blockedSites),
    sensitiveSites: asStrings(v.sensitiveSites),
    redact: redactions.slice(0, 200),
    agent: v.agent !== false,
    builtInSensitiveSites: v.builtInSensitiveSites !== false,
  };
}
