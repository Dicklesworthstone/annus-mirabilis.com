/**
 * Ledger presence is a typed state. Absence is never completeness
 * (am-edn-alignment-tooling-do1). Papers 1, 3, 4, and 5 have no reviewed
 * ledger until cloud OCR lands; a green "complete" over that empty set is
 * the failure this module exists to prevent.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_SLUGS, type RouteSlug } from "../ids.ts";
import { parsePageMarker } from "../ledger/ledgerTokenizer.ts";

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
 * public/papers/transcripts/ap-17-549-machine-draft.txt exists on disk (named -reviewed.txt until am-wisq). The pawl in
 * ledgerAbsence.test.ts is what reported it, firing in the opposite direction from the one it was
 * written for - it was added to catch a paper MISSING from this list, and it caught a paper that
 * should no longer be in it. Membership checked against the disk in both directions is why the same
 * assertion covered both cases.
 *
 * Leaving this list is still not a claim of review. ap-17-549 is a machine draft with hand
 * correction, its receipt records ledgerStatus in-progress, and no reviewer is assigned.
 *
 * `light-quanta` LEFT on 2026-09-21, and the reason is COVERAGE rather than existence.
 * ap-17-132-machine-draft.txt has seventeen pages and the validator reports zero skeleton pages,
 * so classifyLedgerCoverage returns "complete". That is the property ab2b5e65 installed after a
 * skeleton ledger flipped a paper's presence with nothing written behind it: a file on disk is not
 * a ledger that covers its paper. Until this hour light-quanta had the file and five bare pages,
 * and it stayed on this list exactly as it should have.
 *
 * The pawl in ledgerAbsence.test.ts reported the change rather than a human noticing it, for the
 * third time now, and that remains the reason this list is a declaration checked against disk
 * rather than a hand-maintained fact. It is still not a claim of review: ap-17-132 is a machine
 * draft, its receipt records ledgerStatus in-progress, and open-german-source-light-quanta is
 * unfilled in docs/OWNERS.md.
 *
 * `special-relativity` LEFT on 2026-09-25, for COVERAGE, like light-quanta. ap-17-891-machine-draft
 * had held 22 of its 31 pages since 2026-09-24. Pages 913 to 921 were then transcribed by eye from
 * the plates, one commit per page (dispatch 193), and the validator now reports zero skeleton
 * pages: structural mode exits 0 with 0 errors and 0 unacknowledged warnings. The pawl reported
 * the change, for the fourth time. Completeness mode (--require-complete) still reports one
 * error, the receipt's missing transcription.ledgerSha256. That is left unpinned while pages are
 * still being corrected against their plates. It is a question about the receipt, not about
 * coverage, which is the only property this list tracks. It is not a claim of review either: the
 * receipt's ledgerStatus is still not-started, which is also what keeps the draft off the German
 * face, and open-german-source-special-relativity is unfilled in docs/OWNERS.md.
 */
export const PAPERS_WAITING_ON_CLOUD_OCR = [
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
 *
 * THE PAGE SPLIT NO LONGER CARRIES ITS OWN COPY OF THE MARKER GRAMMAR. It used to split on the
 * literal `--- REVIEWED TRANSCRIPTION PAGE n OF N ---`, which was the fifth place that string was
 * written down. When am-wisq changed drafts to open MACHINE DRAFT, this split silently found zero
 * pages and every real ledger degraded from complete to partial - a coverage verdict quietly
 * wrong, with no error anywhere. It now asks ledgerTokenizer, which owns the grammar and is
 * dependency-free, so the next status word cannot break it.
 */
export function classifyLedgerCoverage(text: string): "partial" | "complete" {
  const pages = ledgerPageCoverage(text);
  if (pages.length === 0) return "partial";
  return pages.every((page) => page.covered) ? "complete" : "partial";
}

/**
 * Each page of a ledger in order: the printed page its [[ANNALEN-PAGE n]] anchor names, when it
 * has one, and whether anything beyond the marker and the anchor was written on it. The rule is
 * the one classifyLedgerCoverage has always applied; that function is now this one's summary, so
 * the reader can be told WHICH pages are bare (am-paper-pages-hide-missing-sections-vl4k), not only
 * that some are.
 */
export function ledgerPageCoverage(
  text: string,
): readonly Readonly<{ printedPage?: number; covered: boolean }>[] {
  const pages: string[] = [];
  for (const line of text.split("\n")) {
    if (parsePageMarker(line) !== null) {
      pages.push("");
      continue;
    }
    if (pages.length > 0) pages[pages.length - 1] += `${line}\n`;
  }
  return pages.map((page) => {
    const lines = page.split("\n").map((line) => line.trim());
    const anchor = lines.map((line) => /^\[\[ANNALEN-PAGE (\d+)\]\]$/.exec(line)).find(Boolean);
    const covered = lines.some((line) => line.length > 0 && !line.startsWith("[[ANNALEN-PAGE"));
    return anchor ? { printedPage: Number(anchor[1]), covered } : { covered };
  });
}

export type LedgerPresenceRecord = Readonly<{
  slug: RouteSlug;
  bibliographicKey: string;
  path: string;
  presence: LedgerPresence;
}>;

/**
 * Where a ledger of each review status lives.
 *
 * The owner ruled on am-wisq (2026-09-21, verbatim "Header states real status") that the filename
 * follows the status, so there are two names and only one of them may exist for a paper. A draft is
 * `-machine-draft.txt`; `-reviewed.txt` is earned, and validateLedger refuses the REVIEWED header
 * unless the receipt records a named human reviewer.
 */
export function ledgerCandidatePaths(slug: RouteSlug): readonly string[] {
  const key = PAPER_BIB_KEYS[slug];
  return Object.freeze([
    `public/papers/transcripts/${key}-machine-draft.txt`,
    `public/papers/transcripts/${key}-reviewed.txt`,
  ]);
}

/**
 * The ledger this paper actually has, or the draft name when it has none.
 *
 * Returning the draft name for an absent ledger is deliberate: the fallback should be the state a
 * paper is actually in before anyone has reviewed it, so a caller that reports the path of a
 * missing ledger names something a human could go and create rather than a file that would be a
 * false claim the moment it existed.
 */
export function ledgerRelativePath(slug: RouteSlug, root: string = process.cwd()): string {
  const candidates = ledgerCandidatePaths(slug);
  return candidates.find((candidate) => existsSync(join(root, candidate))) ?? candidates[0] ?? "";
}

export function inspectLedgerPresence(
  slug: RouteSlug,
  root: string = process.cwd(),
): LedgerPresenceRecord {
  const relative = ledgerRelativePath(slug, root);
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
  | "not-applicable-partial-ledger"
  /**
   * A ledger covers the paper, but no German alignable units have been counted, so there is
   * nothing for a translation to be complete AGAINST.
   *
   * This used to answer "not-applicable-no-ledger", which made a production export state a
   * falsehood: allPaperCoverage() calls coverageReport without germanUnitCount, so the count
   * defaults to 0 and light-quanta, brownian-motion and mass-energy each reported ledger=complete
   * beside translation=not-applicable-no-ledger. That is exactly the error the comment below
   * forbids for the partial case - replacing one false statement with another - so it gets its own
   * name for the same reason.
   */
  | "not-applicable-no-german-units";

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
  if (input.germanAlignableCount === 0) return "not-applicable-no-german-units";
  if (input.translationUnitCount >= input.germanAlignableCount && input.translationUnitCount > 0) {
    return "complete";
  }
  return "incomplete";
}

export function refusesCompleteWhenAbsent(completeness: TranslationCompleteness): boolean {
  return completeness !== "complete";
}
