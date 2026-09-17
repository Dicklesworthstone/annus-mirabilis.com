/**
 * Ledger presence is a typed state. Absence is never completeness
 * (am-edn-alignment-tooling-do1). Papers 1, 3, 4, and 5 have no reviewed
 * ledger until cloud OCR lands; a green "complete" over that empty set is
 * the failure this module exists to prevent.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_SLUGS, type RouteSlug } from "../ids.ts";

export const PAPER_BIB_KEYS: Readonly<Record<RouteSlug, string>> = Object.freeze({
  "light-quanta": "ap-17-132",
  "brownian-motion": "ap-17-549",
  "special-relativity": "ap-17-891",
  "mass-energy": "ap-18-639",
  "molecular-dimensions": "ap-19-289",
});

/**
 * Papers 1, 3, 4, and 5 have no reviewed ledger until cloud OCR lands
 * (`am-src-ocr-dispatch-interface-m1ur`). Their translations do not exist.
 * Completeness is not defined for this set.
 */
export const PAPERS_WAITING_ON_CLOUD_OCR = [
  "light-quanta",
  "special-relativity",
  "mass-energy",
  "molecular-dimensions",
] as const satisfies readonly RouteSlug[];

export type LedgerPresence = "present" | "absent";

export type LedgerPresenceRecord = Readonly<{
  slug: RouteSlug;
  bibliographicKey: string;
  path: string;
  presence: LedgerPresence;
}>;

export function ledgerRelativePath(slug: RouteSlug): string {
  return `public/papers/transcripts/${PAPER_BIB_KEYS[slug]}-reviewed.txt`;
}

export function inspectLedgerPresence(
  slug: RouteSlug,
  root: string = process.cwd(),
): LedgerPresenceRecord {
  const relative = ledgerRelativePath(slug);
  const absolute = join(root, relative);
  const presence: LedgerPresence = existsSync(absolute) ? "present" : "absent";
  return Object.freeze({
    slug,
    bibliographicKey: PAPER_BIB_KEYS[slug],
    path: relative,
    presence,
  });
}

export function inspectAllLedgers(root: string = process.cwd()): readonly LedgerPresenceRecord[] {
  return Object.freeze(ROUTE_SLUGS.map((slug) => inspectLedgerPresence(slug, root)));
}

/**
 * Completeness of a translation is only defined when a ledger is present.
 * This function never returns "complete" for an absent ledger.
 */
export type TranslationCompleteness = "complete" | "incomplete" | "not-applicable-no-ledger";

export function translationCompleteness(input: {
  ledger: LedgerPresence;
  translationUnitCount: number;
  germanAlignableCount: number;
}): TranslationCompleteness {
  if (input.ledger === "absent") return "not-applicable-no-ledger";
  if (input.germanAlignableCount === 0) return "not-applicable-no-ledger";
  if (input.translationUnitCount >= input.germanAlignableCount && input.translationUnitCount > 0) {
    return "complete";
  }
  return "incomplete";
}

export function refusesCompleteWhenAbsent(completeness: TranslationCompleteness): boolean {
  return completeness !== "complete";
}
