/**
 * A paper from an instrument id (bm-01) or a teaching equation id (eq-model-bm-rms). Kept apart
 * from quantityColourView.ts, which imports the colour map: a client component that only needs
 * to know its paper must not pull the map into the first-route bundle.
 */
const PAPER_BY_PREFIX: Readonly<Record<string, string>> = {
  bm: "brownian-motion",
  me: "mass-energy",
  lq: "light-quanta",
  sr: "special-relativity",
};
export function paperOfId(id: string | undefined): string | undefined {
  const prefix = id?.replace(/^eq-model-/, "").split("-")[0];
  return prefix ? PAPER_BY_PREFIX[prefix] : undefined;
}
