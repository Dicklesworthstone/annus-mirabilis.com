/**
 * Ledger presence is a typed state. Absence is never completeness
 * (am-edn-alignment-tooling-do1). Papers 1, 3, 4, and 5 have no reviewed
 * ledger until cloud OCR lands; a green "complete" over that empty set is
 * the failure this module exists to prevent.
 */

import { existsSync, readFileSync } from "node:fs";
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
 * Papers with no ledger at all. Their translations do not exist and completeness is not
 * defined for them.
 *
 * `mass-energy` left this list on 2026-09-20. It was the first paper in the project to get
 * a ledger, and it did not arrive the way this constant's name predicts: under the owner's
 * am-1hv0 decision-1 ruling it was drafted from the OCR text layer already embedded in the
 * pinned scan and corrected against the page images, so it never waited on
 * `am-src-ocr-dispatch-interface-m1ur` at all. That route remains the right one for the
 * three long papers, which is why the name still fits them.
 *
 * `brownian-motion` JOINED this list on the same day, and it was never a relaxation
 * either - it was a hole. It had no ledger and was not listed, so the property below was
 * never asserted for it at all. The pawl in ledgerAbsence.test.ts found that on its first
 * run by checking membership against the disk in both directions.
 *
 * REMOVING A PAPER FROM THIS LIST IS NOT A RELAXATION AND MUST NEVER BE USED AS ONE. The
 * property it guards - that an absent ledger is never completeness - is unchanged and is
 * still asserted over every remaining member. A paper leaves only when a ledger exists on
 * disk and the validator reports it clean. Having a ledger is also not having a REVIEWED
 * ledger: mass-energy's is a machine draft with hand correction, its receipt says so, and
 * `open-german-source-mass-energy` is still unfilled in docs/OWNERS.md.
 *
 * `brownian-motion` LEFT on 2026-09-21, for the reason the paragraph above allows and no other:
 * public/papers/transcripts/ap-17-549-reviewed.txt exists on disk. The pawl in
 * ledgerAbsence.test.ts is what reported it, firing in the opposite direction from the one it was
 * written for - it was added to catch a paper MISSING from this list, and it caught a paper that
 * should no longer be in it. Membership checked against the disk in both directions is why the same
 * assertion covered both cases.
 *
 * Leaving this list is still not a claim of review. ap-17-549 is a machine draft with hand
 * correction, its receipt records ledgerStatus in-progress, and no reviewer is assigned.
 */
export const PAPERS_WAITING_ON_CLOUD_OCR = [
  "light-quanta",
  "special-relativity",
  "molecular-dimensions",
] as const satisfies readonly RouteSlug[];

/**
 * What a ledger is to a paper. THREE states, and "present" is deliberately not one of them.
 *
 * This was `"present" | "absent"` until 2026-09-21, computed by `existsSync` alone. A file
 * existing and a ledger COVERING a paper are two different facts and the code had one word
 * for both, so the moment a paper acquired a skeleton - which the ledger bead mandates as
 * step one, before a single word is transcribed - it flipped to "present" and every
 * "an absent ledger is never completeness" assertion stopped running for it. The guard
 * switched itself off at the exact moment a paper started having content, and reported
 * green about the papers furthest along. ap-17-132 triggered it with one page of seventeen.
 *
 * `"present"` IS REMOVED RATHER THAN WIDENED, and that is the point of the change. Adding
 * `"skeleton"` beside `"present"` would have left every existing `=== "present"` comparison
 * compiling and wrong. Deleting the word turns all eight consumers into compile errors, so
 * the compiler enumerates them instead of a grep, and each one is revisited deliberately.
 *
 * - `absent`   no file at the path
 * - `partial`  a file, but at least one page carries no content beyond its markers
 * - `complete` a file, and every page carries content
 *
 * `partial` rather than `skeleton` because it covers both the all-markers case and the
 * half-transcribed one: nine skeleton pages of twelve is neither absent nor complete, and
 * the guard has to hold for it.
 */
export type LedgerPresence = "absent" | "partial" | "complete";

/**
 * A page is covered when it carries anything beyond its page marker and printed-page anchor.
 *
 * This mirrors validateLedger's own rule (no body lines and no footnotes => skeleton page)
 * without importing it: that module parses receipts and is far too heavy for a helper called
 * in loops. The duplication is a drift risk and is answered by a test that asserts the two
 * agree on every real ledger, so the copy cannot quietly diverge from the original.
 */
export function classifyLedgerCoverage(text: string): "partial" | "complete" {
  const pages = text.split(/^--- REVIEWED TRANSCRIPTION PAGE \d+ OF \d+ ---$/m).slice(1);
  if (pages.length === 0) return "partial";
  for (const page of pages) {
    const covered = page
      .split("\n")
      .map((line) => line.trim())
      .some((line) => line.length > 0 && !line.startsWith("[[ANNALEN-PAGE"));
    if (!covered) return "partial";
  }
  return "complete";
}

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
  const presence: LedgerPresence = existsSync(absolute)
    ? classifyLedgerCoverage(readFileSync(absolute, "utf8"))
    : "absent";
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
export type TranslationCompleteness =
  | "complete"
  | "incomplete"
  | "not-applicable-no-ledger"
  | "not-applicable-partial-ledger";

export function translationCompleteness(input: {
  ledger: LedgerPresence;
  translationUnitCount: number;
  germanAlignableCount: number;
}): TranslationCompleteness {
  if (input.ledger === "absent") return "not-applicable-no-ledger";
  // A ledger that does not yet cover its paper licenses no completeness verdict either.
  // Reported under its own name: calling a partial ledger "no ledger" would replace one
  // false statement with another.
  if (input.ledger === "partial") return "not-applicable-partial-ledger";
  if (input.germanAlignableCount === 0) return "not-applicable-no-ledger";
  if (input.translationUnitCount >= input.germanAlignableCount && input.translationUnitCount > 0) {
    return "complete";
  }
  return "incomplete";
}

export function refusesCompleteWhenAbsent(completeness: TranslationCompleteness): boolean {
  return completeness !== "complete";
}
