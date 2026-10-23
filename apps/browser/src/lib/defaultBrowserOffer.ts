export const DEFAULT_BROWSER_OFFER = "default-browser-offer.json";

type Offer = { version: 1; askedAt: number | null };

type OfferOutcome = "none" | "testInstance" | "onboarding" | "alreadyDefault" | "asked";

type OfferDeps = {
  read(name: string): string | null;
  save(name: string, contents: string): Promise<void>;
  testInstance: boolean;
  onboarding: boolean;
  isDefault(): Promise<boolean>;
  setDefault(): Promise<boolean>;
};

export async function offerDefaultBrowserAgain(deps: OfferDeps): Promise<OfferOutcome> {
  let offer: Offer | null = null;
  try {
    offer = JSON.parse(deps.read(DEFAULT_BROWSER_OFFER) ?? "null") as Offer | null;
  } catch {}
  if (!offer || offer.askedAt) return "none";
  if (deps.testInstance) return "testInstance";
  const isDefault = deps.onboarding ? false : await deps.isDefault();
  await deps.save(DEFAULT_BROWSER_OFFER, JSON.stringify({ ...offer, askedAt: Date.now() } satisfies Offer));
  if (deps.onboarding) return "onboarding";
  if (isDefault) return "alreadyDefault";
  await deps.setDefault();
  return "asked";
}
