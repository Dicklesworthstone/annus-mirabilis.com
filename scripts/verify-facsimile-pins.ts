#!/usr/bin/env bun
/**
 * Pinned Facsimile Verification Gate (am-cf6m).
 *
 * The page-count proxy that shipped with the extractor cannot tell a right page window
 * from a wrong one: every pinned extract has the declared number of pages, because the
 * extractor faithfully pulled the declared count from whatever offset it was given.
 * Three defect classes were measured on this tree and each needs its own check:
 *
 *   (a) WRONG CONFIG      - ap-17-549 declares parentPageIndices [132..143] while its own
 *                           verified anchor says parent 173 is printed 549. The extract
 *                           faithfully reproduces the wrong window, so content identity
 *                           passes it. Only anchor arithmetic catches this one.
 *   (b) STALE EXTRACT     - ap-19-289 and ap-34-591 carry configs whose indices were later
 *                           corrected (97 -> 83, 195 -> 219) without re-extracting. Anchor
 *                           arithmetic is internally consistent for a corrected config, so
 *                           only comparing the pinned bytes against the parent catches these.
 *   (c) WRONG PARENT      - a pin whose declared printed pages are not inside the parent's
 *                           printed span at all. Neither (a) nor (b) can see this, because
 *                           both are consistent with any parent that happens to have pages
 *                           at those indices.
 *
 * The three checks:
 *   1. ANCHOR            - validateFacsimileAnchor: a recorded, human-verified anchor must
 *                          exist and articlePages must map onto parentPageIndices through
 *                          its offset. A missing anchor is a hard failure; an unverifiable
 *                          pin is not a verified pin. Anchor fields written at the wrong
 *                          nesting level are reported as malformed rather than ignored.
 *   2. CONTENT IDENTITY  - render the pinned extract's first and last page and the parent's
 *                          pages at parentPageIndices[0] and [-1] with identical pdftoppm
 *                          settings and require byte-identical images. This is rendering and
 *                          hashing, not text recognition: no OCR process is started, locally
 *                          or otherwise (AGENTS.md, "Cloud OCR Only").
 *   3. FOLIO COVERAGE    - derive the parent's own printed-page offset from the text layer
 *                          the scan already carries (reading an existing layer is parsing,
 *                          not running OCR), by majority vote over folio numerals across
 *                          every page, then require the declared offset to agree with it and
 *                          the declared printed range to lie inside the parent's printed span.
 *
 * Nothing here is allowed to pass by omission. A missing tool, a missing PDF, an unreadable
 * page or an inconclusive folio vote is a typed failure, never a skip.
 *
 * Usage:
 *   bun scripts/verify-facsimile-pins.ts [--key <key>] [--config-dir <dir>] [--repo-root <dir>] [--json]
 *
 * Exit codes: 0 every pin verified; 3 at least one pin refused.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { TestLogger } from "../src/testing/log/logger.ts";
import {
  type FacsimileSourceConfig,
  validateFacsimileAnchor,
} from "./sources/facsimileSourceSchema.ts";

export type PinCheck =
  | "artifact"
  | "anchor"
  | "content-identity"
  | "folio-coverage"
  | "extract-folio";

export type PinRefusalCode =
  // artifact availability and identity
  | "render-tool-unavailable"
  | "render-tool-spawn-failed"
  | "pinned-pdf-unavailable"
  | "parent-pdf-unavailable"
  | "parent-record-missing"
  | "pinned-digest-conflict"
  | "parent-digest-conflict"
  | "pinned-page-count-mismatch"
  | "page-render-failed"
  // anchor arithmetic
  | "missing-verified-anchor"
  | "malformed-verified-anchor"
  | "facsimile-page-offset-mismatch"
  | "non-contiguous-parent-pages"
  | "invalid-config"
  // content identity
  | "stale-pinned-extract"
  // folio coverage
  | "folio-consensus-unavailable"
  | "parent-folio-offset-mismatch"
  | "printed-range-outside-parent"
  // extract folio: what the PINNED BYTES say about themselves
  | "extract-folio-consensus-unavailable"
  | "extract-folio-mismatch"
  | "extract-page-count-mismatch";

export interface PinFinding {
  readonly check: PinCheck;
  readonly code: PinRefusalCode;
  readonly message: string;
}

/**
 * The per-config numbers the failure report is required to name: the declared first index,
 * the index each independent method implies for the same printed page, and the printed range.
 */
export interface PinFacts {
  readonly key: string;
  readonly printedFirst: number | null;
  readonly printedLast: number | null;
  readonly declaredFirstIndex: number | null;
  readonly declaredLastIndex: number | null;
  readonly anchorImpliedFirstIndex: number | null;
  readonly folioImpliedFirstIndex: number | null;
  readonly extractImpliedFirstIndex: number | null;
  readonly consensusOffset: number | null;
  readonly contentIdentityFirst: boolean | null;
  readonly contentIdentityLast: boolean | null;
}

export interface PinResult {
  readonly key: string;
  readonly verified: boolean;
  readonly facts: PinFacts;
  readonly findings: readonly PinFinding[];
}

export interface FacsimilePinReport {
  readonly valid: boolean;
  readonly checkedCount: number;
  readonly verifiedCount: number;
  readonly refusedCount: number;
  readonly results: readonly PinResult[];
}

/** Render settings are fixed so that two renders of the same page are byte-identical. */
export const RENDER_DPI = 40;

/** A folio vote below this count, or without this much margin over the runner-up, is not a consensus. */
export const MIN_CONSENSUS_VOTES = 20;
export const MIN_CONSENSUS_DOMINANCE = 4;

export function getDefaultConfigDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "sources", "facsimile-sources");
}

export function getDefaultRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

// ---------------------------------------------------------------------------
// Pure evaluators. Every one takes measurements as data so a test can plant the
// exact historical defect without needing the 30 MB parent scans on disk.
// ---------------------------------------------------------------------------

const ANCHOR_FIELD_NAMES = ["parentPageIndex", "printedPage", "verifiedBy"] as const;

/**
 * ap-19-289 carried `verifiedAnchor:` with an empty value and the anchor's fields as its
 * siblings under articlePages. The anchor validator correctly reported the anchor missing,
 * but a reader of the file sees anchor data and believes the pin was verified. Name it.
 */
export function detectMalformedAnchor(config: unknown): PinFinding | null {
  if (!config || typeof config !== "object") {
    return null;
  }
  const root = config as Record<string, unknown>;
  const key = typeof root.key === "string" ? root.key : "unknown";
  const articlePages =
    root.articlePages && typeof root.articlePages === "object"
      ? (root.articlePages as Record<string, unknown>)
      : null;

  const hasRealAnchor =
    (root.verifiedAnchor && typeof root.verifiedAnchor === "object") ||
    (articlePages?.verifiedAnchor && typeof articlePages.verifiedAnchor === "object");
  if (hasRealAnchor) {
    return null;
  }

  for (const [scopeName, scope] of [
    ["root", root],
    ["articlePages", articlePages],
  ] as const) {
    if (!scope) {
      continue;
    }
    const stray = ANCHOR_FIELD_NAMES.filter((field) => scope[field] !== undefined);
    if (stray.length > 0) {
      return {
        check: "anchor",
        code: "malformed-verified-anchor",
        message:
          `Config '${key}' writes anchor fields (${stray.join(", ")}) directly under ${scopeName} ` +
          `instead of inside a verifiedAnchor object, so they are not read as an anchor. ` +
          `Anchor data at the wrong nesting level looks like verification and is not verification.`,
      };
    }
  }
  return null;
}

export function evaluateDeclaredAnchor(config: unknown): {
  readonly findings: readonly PinFinding[];
  readonly anchorImpliedFirstIndex: number | null;
} {
  const findings: PinFinding[] = [];
  const malformed = detectMalformedAnchor(config);
  if (malformed) {
    findings.push(malformed);
  }

  const res = validateFacsimileAnchor(config);
  const cfg = (config ?? {}) as Partial<FacsimileSourceConfig>;
  const printedFirst = cfg.articlePages?.printedFirst;
  const anchorImpliedFirstIndex =
    res.anchor && typeof printedFirst === "number"
      ? printedFirst + (res.anchor.parentPageIndex - res.anchor.printedPage)
      : null;

  if (!res.valid) {
    findings.push({
      check: "anchor",
      code: (res.refusalCode ?? "invalid-config") as PinRefusalCode,
      message: res.errors.join("; "),
    });
  }

  return { findings, anchorImpliedFirstIndex };
}

export interface ContentIdentityInput {
  readonly key: string;
  readonly declaredFirstIndex: number;
  readonly declaredLastIndex: number;
  readonly extractFirstHash: string;
  readonly extractLastHash: string;
  readonly parentFirstHash: string;
  readonly parentLastHash: string;
  /** Parent index the extract's own first page implies, when the folio consensus could locate it. */
  readonly extractImpliedFirstIndex?: number | null | undefined;
  /** The printed page the config says this pin starts at, for stating the defect in a reader's terms. */
  readonly printedFirst?: number | null | undefined;
  /** parentPageIndex - printedPage for this parent, from the folio consensus. */
  readonly folioOffset?: number | null | undefined;
}

/**
 * The pinned bytes must be the pages the current config names. This is what catches a config
 * that was corrected after the extract was cut: the arithmetic stays self-consistent, the
 * page count stays right, and the pinned pages are still the old ones.
 */
export function evaluateContentIdentity(input: ContentIdentityInput): readonly PinFinding[] {
  const findings: PinFinding[] = [];
  // am-cf6m. A hash pair and two parent indices are a true statement that no reader can act on.
  // The defect that prompted this gate was a pin whose first page is printed 508 by L. Hermann
  // where printed 549 by Einstein was expected, and "extract a1b2... != parent c3d4..." never
  // said so. Where the folio consensus can place the pinned bytes, say which printed page the
  // reader is actually served and which one they should have been - that is the sentence that
  // ends the ambiguity, and it is in the same units the config and the citation use.
  const located =
    typeof input.extractImpliedFirstIndex === "number"
      ? ` The pinned extract's first page carries the folio of parent page ${input.extractImpliedFirstIndex}, which is where these bytes were cut from.`
      : "";
  const servedPrinted =
    typeof input.extractImpliedFirstIndex === "number" && typeof input.folioOffset === "number"
      ? input.extractImpliedFirstIndex - input.folioOffset
      : null;
  const inReadersTerms =
    servedPrinted !== null && typeof input.printedFirst === "number"
      ? ` A reader opening this facsimile is served printed page ${servedPrinted}, not printed page ${input.printedFirst}.`
      : "";

  if (input.extractFirstHash !== input.parentFirstHash) {
    findings.push({
      check: "content-identity",
      code: "stale-pinned-extract",
      message:
        `Config '${input.key}': the pinned extract's first page does not render identically to ` +
        `parent page ${input.declaredFirstIndex}, the first index the config declares ` +
        `(extract ${input.extractFirstHash.slice(0, 16)}, parent ${input.parentFirstHash.slice(0, 16)}). ` +
        `The pinned PDF was not produced from the config as it now stands.${inReadersTerms}${located}`,
    });
  }

  if (input.extractLastHash !== input.parentLastHash) {
    findings.push({
      check: "content-identity",
      code: "stale-pinned-extract",
      message:
        `Config '${input.key}': the pinned extract's last page does not render identically to ` +
        `parent page ${input.declaredLastIndex}, the last index the config declares ` +
        `(extract ${input.extractLastHash.slice(0, 16)}, parent ${input.parentLastHash.slice(0, 16)}).`,
    });
  }

  return findings;
}

export interface FolioObservation {
  readonly pageIndex: number;
  readonly folio: number;
}

export interface FolioConsensus {
  readonly offset: number;
  readonly votes: number;
  readonly runnerUpVotes: number;
}

/**
 * Microfilm text layers mangle individual numerals, so no single page is trusted. Every
 * numeral that could be a folio votes for an offset (pageIndex - folio) and the winner has
 * to carry the document: in the six parents measured here the winning offset took 102 to 146
 * votes against a runner-up of 4 to 25.
 */
export interface ConsensusThresholds {
  readonly minVotes: number;
  readonly minDominance: number;
}

export function consensusOffsetFrom(
  observations: readonly FolioObservation[],
  // Defaulted to the parent-scan calibration this function was written for, so every
  // existing caller keeps exactly the thresholds it had. Extracts pass their own.
  thresholds: ConsensusThresholds = {
    minVotes: MIN_CONSENSUS_VOTES,
    minDominance: MIN_CONSENSUS_DOMINANCE,
  },
): FolioConsensus | null {
  const tally = new Map<number, number>();
  for (const observation of observations) {
    const offset = observation.pageIndex - observation.folio;
    tally.set(offset, (tally.get(offset) ?? 0) + 1);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const winner = ranked[0];
  if (!winner) {
    return null;
  }
  const runnerUpVotes = ranked[1]?.[1] ?? 0;
  if (winner[1] < thresholds.minVotes || winner[1] < runnerUpVotes * thresholds.minDominance) {
    return null;
  }
  return { offset: winner[0], votes: winner[1], runnerUpVotes };
}

export interface FolioCoverageInput {
  readonly key: string;
  readonly printedFirst: number;
  readonly printedLast: number;
  readonly declaredFirstIndex: number;
  readonly declaredLastIndex: number;
  readonly parentPageCount: number;
  readonly observations: readonly FolioObservation[];
}

export interface FolioCoverageResult {
  readonly findings: readonly PinFinding[];
  readonly consensus: FolioConsensus | null;
  readonly folioImpliedFirstIndex: number | null;
}

export function evaluateFolioCoverage(input: FolioCoverageInput): FolioCoverageResult {
  const findings: PinFinding[] = [];
  const consensus = consensusOffsetFrom(input.observations);

  if (!consensus) {
    findings.push({
      check: "folio-coverage",
      code: "folio-consensus-unavailable",
      message:
        `Config '${input.key}': the parent scan's text layer did not yield a dominant folio offset ` +
        `(needs at least ${MIN_CONSENSUS_VOTES} votes and ${MIN_CONSENSUS_DOMINANCE}x the runner-up). ` +
        `The declared page window cannot be corroborated against the parent's own printed numbering, ` +
        `and an uncorroborated window is not a verified window.`,
    });
    return { findings, consensus: null, folioImpliedFirstIndex: null };
  }

  const folioImpliedFirstIndex = input.printedFirst + consensus.offset;
  const folioImpliedLastIndex = input.printedLast + consensus.offset;

  if (input.declaredFirstIndex !== folioImpliedFirstIndex) {
    findings.push({
      check: "folio-coverage",
      code: "parent-folio-offset-mismatch",
      message:
        `Config '${input.key}': declared first parent index ${input.declaredFirstIndex} for printed page ` +
        `${input.printedFirst}, but the parent's own text layer puts printed ${input.printedFirst} at ` +
        `parent page ${folioImpliedFirstIndex} (offset ${consensus.offset} on ${consensus.votes} votes ` +
        `against ${consensus.runnerUpVotes}; the config's implied offset is ` +
        `${input.declaredFirstIndex - input.printedFirst}).`,
    });
  }

  if (input.declaredLastIndex !== folioImpliedLastIndex) {
    findings.push({
      check: "folio-coverage",
      code: "parent-folio-offset-mismatch",
      message:
        `Config '${input.key}': declared last parent index ${input.declaredLastIndex} for printed page ` +
        `${input.printedLast}, but the parent's own text layer puts printed ${input.printedLast} at ` +
        `parent page ${folioImpliedLastIndex}.`,
    });
  }

  const parentPrintedFirst = 1 - consensus.offset;
  const parentPrintedLast = input.parentPageCount - consensus.offset;
  if (input.printedFirst < parentPrintedFirst || input.printedLast > parentPrintedLast) {
    findings.push({
      check: "folio-coverage",
      code: "printed-range-outside-parent",
      message:
        `Config '${input.key}': printed pages ${input.printedFirst}-${input.printedLast} are not inside ` +
        `the printed span this parent covers, ${parentPrintedFirst}-${parentPrintedLast} ` +
        `(${input.parentPageCount} pages at offset ${consensus.offset}). The pin names a parent that ` +
        `does not contain the article.`,
    });
  }

  return { findings, consensus, folioImpliedFirstIndex };
}

/**
 * What the pinned bytes say about THEMSELVES.
 *
 * Every check above this one compares the extract with a parent scan, so none of them can
 * run where the parent is not on disk - which is CI, because /sources is git-ignored. That
 * is how ap-17-549 shipped for a night with page 1 showing L. Hermann on Leyden jars: the
 * digest was right, the parent comparison was the only thing that would have caught it, and
 * the parent was not there to compare against.
 *
 * This check needs no parent. A pinned extract of Annalen 17 pages 549 to 560 carries those
 * folio numbers in its own text layer, and if it does not, the pin is wrong no matter whose
 * bytes they are. It is a pure function over page texts so that the decision is testable
 * without a PDF, a tool, or a network; the caller supplies the observations.
 *
 * WHAT IT CANNOT DO, so that a green is not overread. A scan with no text layer yields no
 * observations and the result is `extract-folio-consensus-unavailable`, which is
 * not-measured and NOT a pass - every facsimile here is a photograph of a page, and whether
 * a usable text layer exists is a property of the scanning institution, not of the pin. It
 * also cannot tell a correct extract of the right pages from the WRONG VOLUME printed with
 * the same page numbers: Annalen 17 and Annalen 18 both have a page 549. Only the parent
 * comparison binds a record to a volume.
 */
/**
 * The vote floor an EXTRACT's text layer has to clear, which is not the parent's.
 *
 * MIN_CONSENSUS_VOTES = 20 is calibrated for parent scans of several hundred pages, where
 * the winning offset took 102 to 146 votes. An extract of twelve pages cannot produce
 * twenty folio reads however good its text layer is, so the parent's floor rejects every
 * extract in this corpus by arithmetic rather than by evidence. Measured on all six pinned
 * extracts, 2026-09-21, with the numbers as they came out:
 *
 *   key         pages  winner (votes)  runner-up  expected  verdict under this floor
 *   ap-17-132     17   -131 (9)            2       -131     measured, correct
 *   ap-17-549     12   -548 (6)            1       -548     measured, correct
 *   ap-17-891     31   -890 (16)           1       -890     measured, correct
 *   ap-19-289     18   -288 (9)            2       -288     measured, correct
 *   ap-18-639      3   -1902 (2)           1       -638     UNMEASURED, and must be
 *   ap-34-591      2   -590 (2)            1       -590     unmeasured, correct but thin
 *
 * ap-18-639 is why a floor exists at all rather than none: its three-page text layer's most
 * popular offset is WRONG, off by more than a thousand, and a gate that acted on it would
 * accuse a correct pin of holding pages 1903-1905.
 *
 * WHAT MEASUREMENT ACTUALLY SHOWED, against my first account of it. The floor and
 * MIN_CONSENSUS_DOMINANCE reject ap-18-639 INDEPENDENTLY - with the floor at 1 dominance
 * still rejects it (2 votes against 1 is under 4x), and with dominance at 1 the floor still
 * does (2 votes is under 3). Setting either alone to its weakest value changes no verdict on
 * any of the six. I wrote this comment first claiming the floor was decisive there; it is not.
 *
 * The floor's own, non-redundant job is the case dominance cannot see: a thin text layer
 * whose noise is ONE-SIDED. With a single wrong offset read twice and no competing read at
 * all, runner-up is zero, `winner < runnerUp * dominance` is `2 < 0`, and dominance admits
 * it. Only a vote floor refuses. That case is constructible from a two-page extract, which
 * is ap-34-591's shape, so it is not hypothetical for this corpus.
 *
 * The parent's thresholds are NOT changed. This is a separate floor for a separate
 * population, chosen from the measurement above.
 */
export function extractVoteFloor(extractPageCount: number): number {
  return Math.max(3, Math.ceil(extractPageCount / 4));
}

export interface ExtractFolioInput {
  readonly key: string;
  readonly printedFirst: number;
  readonly printedLast: number;
  readonly extractPageCount: number;
  /** pageIndex is 1-based WITHIN THE EXTRACT, not within the parent. */
  readonly observations: readonly FolioObservation[];
}

export interface ExtractFolioResult {
  readonly findings: readonly PinFinding[];
  readonly consensus: FolioConsensus | null;
  /** The printed range the extract's own text layer says it holds, when it says anything. */
  readonly observedPrintedRange: { readonly first: number; readonly last: number } | null;
}

export function evaluateExtractFolios(input: ExtractFolioInput): ExtractFolioResult {
  const findings: PinFinding[] = [];

  // Page count first, and reported even when the text layer is unreadable: it needs no text
  // at all, so an extract with no text layer still gets one real check rather than none.
  const declaredPageSpan = input.printedLast - input.printedFirst + 1;
  if (input.extractPageCount !== declaredPageSpan) {
    findings.push({
      check: "extract-folio",
      code: "extract-page-count-mismatch",
      message:
        `Config '${input.key}': the config declares printed pages ${input.printedFirst}-` +
        `${input.printedLast}, which is ${declaredPageSpan} page(s), but the pinned extract ` +
        `holds ${input.extractPageCount}. The bytes cannot be the article the record names.`,
    });
  }

  const floor = extractVoteFloor(input.extractPageCount);
  const consensus = consensusOffsetFrom(input.observations, {
    minVotes: floor,
    minDominance: MIN_CONSENSUS_DOMINANCE,
  });
  if (!consensus) {
    findings.push({
      check: "extract-folio",
      code: "extract-folio-consensus-unavailable",
      message:
        `Config '${input.key}': the pinned extract's own text layer did not yield a dominant ` +
        `folio offset (needs at least ${floor} vote(s) for ${input.extractPageCount} page(s) ` +
        `and ${MIN_CONSENSUS_DOMINANCE}x the runner-up). This is NOT-MEASURED, not a pass: many ` +
        `of these scans are photographs with a thin or absent text layer, and an extract that ` +
        `cannot state its own page numbers has not corroborated anything.`,
    });
    return { findings, consensus: null, observedPrintedRange: null };
  }

  // In an extract, page 1 IS printedFirst, so the only admissible offset is 1 - printedFirst.
  const expectedOffset = 1 - input.printedFirst;
  const observedFirst = 1 - consensus.offset;
  const observedLast = input.extractPageCount - consensus.offset;

  if (consensus.offset !== expectedOffset) {
    findings.push({
      check: "extract-folio",
      code: "extract-folio-mismatch",
      message:
        `Config '${input.key}': the record says this extract is printed pages ` +
        `${input.printedFirst}-${input.printedLast}, but the extract's own text layer reads ` +
        `${observedFirst}-${observedLast} (offset ${consensus.offset} on ${consensus.votes} ` +
        `votes against ${consensus.runnerUpVotes}; the record implies ${expectedOffset}). ` +
        `The pinned bytes are a different part of the volume from the one the record names.`,
    });
  }

  return {
    findings,
    consensus,
    observedPrintedRange: { first: observedFirst, last: observedLast },
  };
}

// ---------------------------------------------------------------------------
// Measurement layer (poppler). Rendering and reading an existing text layer only.
// ---------------------------------------------------------------------------

export class PinMeasurementError extends Error {
  readonly code: PinRefusalCode;
  constructor(code: PinRefusalCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PinMeasurementError";
  }
}

/**
 * Refuses when `tool` cannot be run, and says WHICH failure it saw.
 *
 * This used to turn every spawnSync error into "'pdftoppm' is not available on
 * PATH" (am-yf6h). On this host the real error is EBADF from posix_spawn
 * '/opt/homebrew/bin/pdftoppm' - an absolute path, so PATH resolution had
 * already SUCCEEDED and the sentence was checkably false. It sent an
 * investigation after a missing binary that was installed all along, and it let
 * "0 of 6 pins verified" be read as a verdict about the pins when it was a
 * verdict about the runner. A refusal may not assert a cause it did not
 * establish: ENOENT is absence, anything else is a failure to start.
 */
/** One sentence for a tool that was found and would not start, used by every spawn site. */
function spawnFailureMessage(tool: string, error: unknown): string {
  const e = error as NodeJS.ErrnoException;
  return (
    `'${tool}' was found but could not be started: ${e.code ?? "unknown error"} from ` +
    `${e.syscall ?? "spawnSync"} (${e.message}). Nothing was measured here, so this is a ` +
    `failure of the runner and not a finding about the pins.`
  );
}

/**
 * Codes that mean the gate could not MEASURE, as opposed to measuring and refusing.
 *
 * The distinction is the whole of am-yf6h: a missing parent scan, a missing pinned
 * file or a tool that would not start says nothing whatever about a pin, and
 * "0 verified, 6 refused" printed under those conditions is a verdict about the
 * environment wearing the clothes of a verdict about the pins. /sources is
 * git-ignored, so in CI every pin lands here and the summary has been saying it
 * that way on every run.
 */
export const UNMEASURABLE_CODES: ReadonlySet<PinRefusalCode> = new Set<PinRefusalCode>([
  "parent-pdf-unavailable",
  "pinned-pdf-unavailable",
  "parent-record-missing",
  "render-tool-unavailable",
  "render-tool-spawn-failed",
]);

/** True when a pin produced findings and every one of them is an environment precondition. */
export function isUnmeasurable(findings: readonly PinFinding[]): boolean {
  return findings.length > 0 && findings.every((f) => UNMEASURABLE_CODES.has(f.code));
}

export function requireTool(tool: string): void {
  const probe = spawnSync(tool, ["-v"], { encoding: "utf8" });
  const error = probe.error as NodeJS.ErrnoException | undefined;
  if (error === undefined) {
    return;
  }
  const where = error.syscall ?? "spawnSync";
  if (error.code === "ENOENT") {
    throw new PinMeasurementError(
      "render-tool-unavailable",
      `'${tool}' is not available on PATH (ENOENT from ${where}). The pinned facsimiles ` +
        `cannot be compared against their parents without it, and an unverifiable pin is ` +
        `not a verified pin.`,
    );
  }
  throw new PinMeasurementError(
    "render-tool-spawn-failed",
    `'${tool}' was found but could not be started: ${error.code ?? "unknown error"} from ` +
      `${where} (${error.message}). This is a failure of this process to launch the tool, ` +
      `NOT evidence that the tool is missing and NOT a finding about the pins. Nothing was ` +
      `measured, so no pin is verified or refused on this run. Run the gate directly ` +
      `(bun scripts/verify-facsimile-pins.ts) or in the node lane.`,
  );
}

export function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function pdfPageCount(pdfPath: string): number {
  const out = spawnSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  if (out.status !== 0) {
    throw new PinMeasurementError(
      "page-render-failed",
      `pdfinfo failed on '${pdfPath}': ${(out.stderr ?? "").trim() || `exit ${String(out.status)}`}`,
    );
  }
  const match = /^Pages:\s+(\d+)$/m.exec(out.stdout);
  if (!match?.[1]) {
    throw new PinMeasurementError(
      "page-render-failed",
      `pdfinfo did not report a page count for '${pdfPath}'`,
    );
  }
  return Number.parseInt(match[1], 10);
}

/** Byte hash of one page rendered at fixed settings. Two identical pages give one hash. */
export function renderPageHash(pdfPath: string, page: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "am-pin-render-"));
  try {
    const root = path.join(dir, "page");
    const out = spawnSync(
      "pdftoppm",
      [
        "-gray",
        "-r",
        String(RENDER_DPI),
        "-f",
        String(page),
        "-l",
        String(page),
        "-singlefile",
        "-png",
        pdfPath,
        root,
      ],
      { encoding: "utf8" },
    );
    const rendered = `${root}.png`;
    if (out.error) {
      throw new PinMeasurementError(
        "render-tool-spawn-failed",
        spawnFailureMessage("pdftoppm", out.error),
      );
    }
    if (out.status !== 0 || !fs.existsSync(rendered)) {
      throw new PinMeasurementError(
        "page-render-failed",
        `pdftoppm could not render page ${page} of '${pdfPath}': ` +
          `${(out.stderr ?? "").trim() || `exit ${String(out.status)}`}`,
      );
    }
    return createHash("sha256").update(fs.readFileSync(rendered)).digest("hex");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Pages of the text layer the scan already carries. No recognition process is started here:
 * pdftotext reads characters that are already in the file (the configs record
 * embeddedTextLayer: present). Running OCR locally is forbidden and nothing here does it.
 */
export function pdfPageTexts(pdfPath: string): string[] {
  const out = spawnSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (out.error) {
    throw new PinMeasurementError(
      "render-tool-spawn-failed",
      spawnFailureMessage("pdftotext", out.error),
    );
  }
  if (out.status !== 0) {
    throw new PinMeasurementError(
      "page-render-failed",
      `pdftotext failed on '${pdfPath}': ${(out.stderr ?? "").trim() || `exit ${String(out.status)}`}`,
    );
  }
  const pages = out.stdout.split("\f");
  if (pages.length > 0 && pages[pages.length - 1]?.trim() === "") {
    pages.pop();
  }
  return pages;
}

const FOLIO_PATTERN = /(?<!\d)(\d{2,4})(?!\d)/g;

/** Folio candidates from the head and foot of each page, where running heads and page numbers sit. */
export function folioObservations(
  pageTexts: readonly string[],
  startIndex = 1,
): FolioObservation[] {
  const observations: FolioObservation[] = [];
  for (let i = 0; i < pageTexts.length; i++) {
    const lines = (pageTexts[i] ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const edges = [...lines.slice(0, 2), ...lines.slice(-2)];
    for (const line of edges) {
      for (const match of line.matchAll(FOLIO_PATTERN)) {
        const folio = Number.parseInt(match[1] as string, 10);
        observations.push({ pageIndex: startIndex + i, folio });
      }
    }
  }
  return observations;
}

/** Folio candidates carried by one page's own text layer, most plausible first. */
export function folioCandidatesOfPage(pageText: string): number[] {
  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const edges = [...lines.slice(0, 2), ...lines.slice(-2)];
  const candidates: number[] = [];
  for (const line of edges) {
    for (const match of line.matchAll(FOLIO_PATTERN)) {
      const folio = Number.parseInt(match[1] as string, 10);
      if (!candidates.includes(folio)) {
        candidates.push(folio);
      }
    }
  }
  return candidates;
}

/**
 * Where a stale extract was actually cut from. The extract's own folio plus the parent's
 * consensus offset proposes an index, and the proposal is only reported once the parent page
 * at that index renders identically to the extract's first page. A guess is not a finding.
 */
export function locateExtractInParent(input: {
  readonly parentPath: string;
  readonly parentPageCount: number;
  readonly extractFirstHash: string;
  readonly extractFirstPageText: string;
  readonly consensusOffset: number | null;
  readonly renderHash?: ((pdfPath: string, page: number) => string) | undefined;
}): number | null {
  if (input.consensusOffset === null) {
    return null;
  }
  const render = input.renderHash ?? renderPageHash;
  for (const folio of folioCandidatesOfPage(input.extractFirstPageText).slice(0, 3)) {
    const index = folio + input.consensusOffset;
    if (index < 1 || index > input.parentPageCount) {
      continue;
    }
    if (render(input.parentPath, index) === input.extractFirstHash) {
      return index;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-config verification
// ---------------------------------------------------------------------------

function emptyFacts(key: string): PinFacts {
  return {
    key,
    printedFirst: null,
    printedLast: null,
    declaredFirstIndex: null,
    declaredLastIndex: null,
    anchorImpliedFirstIndex: null,
    folioImpliedFirstIndex: null,
    extractImpliedFirstIndex: null,
    consensusOffset: null,
    contentIdentityFirst: null,
    contentIdentityLast: null,
  };
}

export function verifyPin(config: unknown, repoRoot: string): PinResult {
  const cfg = (config ?? {}) as Partial<FacsimileSourceConfig>;
  const key = typeof cfg.key === "string" ? cfg.key : "unknown";
  const findings: PinFinding[] = [];

  const anchorOutcome = evaluateDeclaredAnchor(config);
  findings.push(...anchorOutcome.findings);

  const printedFirst = cfg.articlePages?.printedFirst ?? null;
  const printedLast = cfg.articlePages?.printedLast ?? null;
  const indices = cfg.articlePages?.parentPageIndices ?? [];
  const declaredFirstIndex = indices.length > 0 ? (indices[0] as number) : null;
  const declaredLastIndex = indices.length > 0 ? (indices[indices.length - 1] as number) : null;

  let facts: PinFacts = {
    ...emptyFacts(key),
    printedFirst,
    printedLast,
    declaredFirstIndex,
    declaredLastIndex,
    anchorImpliedFirstIndex: anchorOutcome.anchorImpliedFirstIndex,
  };

  const pinned = cfg.pinned;
  if (!pinned) {
    findings.push({
      check: "artifact",
      code: "pinned-pdf-unavailable",
      message: `Config '${key}' records no pinned artifact, so there is nothing to verify.`,
    });
    return { key, verified: false, facts, findings };
  }
  if (!pinned.parent) {
    findings.push({
      check: "artifact",
      code: "parent-record-missing",
      message:
        `Config '${key}' records a pinned extract but no parent record, so the pinned pages ` +
        `cannot be compared with the pages they claim to come from.`,
    });
    return { key, verified: false, facts, findings };
  }
  if (
    printedFirst === null ||
    printedLast === null ||
    declaredFirstIndex === null ||
    declaredLastIndex === null
  ) {
    findings.push({
      check: "artifact",
      code: "invalid-config",
      message: `Config '${key}' does not declare a printed range and parent page indices to verify.`,
    });
    return { key, verified: false, facts, findings };
  }

  const extractPath = path.resolve(repoRoot, pinned.path);
  const parentPath = path.resolve(repoRoot, pinned.parent.path);

  const extractMissing = !fs.existsSync(extractPath);
  const parentMissing = !fs.existsSync(parentPath);
  if (extractMissing) {
    findings.push({
      check: "artifact",
      code: "pinned-pdf-unavailable",
      message: `Config '${key}': pinned PDF '${pinned.path}' is not on disk.`,
    });
  }
  if (parentMissing) {
    findings.push({
      check: "artifact",
      code: "parent-pdf-unavailable",
      message:
        `Config '${key}': parent scan '${pinned.parent.path}' is not on disk. The parent scans are ` +
        `not committed (/sources is ignored), so this gate runs where they were downloaded. ` +
        `A pin that cannot be compared with its parent is unverified, not verified.`,
    });
  }

  // THE PINNED FILE IS TRACKED; THE PARENT IS NOT. So the checks that read only the extract are
  // measurable wherever this runs, including CI, and they used to be unreachable there for two
  // reasons that had nothing to do with them: this function returned on ANY artifact finding, so
  // a missing parent ended it before the extract was ever hashed, and the tool probe below
  // demands pdftotext, which the OCR denylist forbids
  // (D-2026-09-21-facsimile-text-layer-stays-forbidden). Neither is a property of the digest or
  // the page count. They need pdfinfo, which is on no denylist, and the file that ships.
  //
  // Sequencing only. No check is added, removed or relaxed, and every parent-side refusal below
  // still refuses exactly what it refused before (am-xoxn).
  let extractPages: number | null = null;
  if (!extractMissing) {
    try {
      requireTool("pdfinfo");
      const extractDigest = sha256File(extractPath);
      if (extractDigest !== pinned.sha256) {
        findings.push({
          check: "artifact",
          code: "pinned-digest-conflict",
          message:
            `Config '${key}': pinned PDF digest on disk (${extractDigest}) does not match the recorded ` +
            `sha256 (${pinned.sha256}).`,
        });
      }
      extractPages = pdfPageCount(extractPath);
      if (extractPages !== pinned.pageCount) {
        findings.push({
          check: "artifact",
          code: "pinned-page-count-mismatch",
          message: `Config '${key}': pinned PDF holds ${extractPages} pages but the record says ${pinned.pageCount}.`,
        });
      }
    } catch (err: unknown) {
      // The same breadth as the outer catch below, deliberately. A reason the gate has no code
      // for - an unreadable file, say - is still a measurement failure and must be REPORTED as
      // one rather than thrown out of verifyPin, which would end the whole run on one pin. The
      // first version of this block rethrew, and verify-facsimile-pins.ts:1144 caught it.
      if (err instanceof PinMeasurementError) {
        findings.push({ check: "artifact", code: err.code, message: err.message });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        findings.push({
          check: "artifact",
          code: "page-render-failed",
          message: `Config '${key}': measurement failed: ${message}`,
        });
      }
    }
  }

  // Unavailability, not "any artifact finding". The old condition was equivalent while the only
  // artifact findings reachable here were the two above; now that a real refusal can be recorded
  // before this line, returning on it would throw away the parent comparison that is the whole
  // point of this gate.
  if (extractMissing || parentMissing) {
    return { key, verified: false, facts, findings };
  }

  try {
    requireTool("pdftoppm");
    requireTool("pdftotext");
    requireTool("pdfinfo");
    const parentDigest = sha256File(parentPath);
    if (parentDigest !== pinned.parent.sha256) {
      findings.push({
        check: "artifact",
        code: "parent-digest-conflict",
        message:
          `Config '${key}': parent scan digest on disk (${parentDigest}) does not match the recorded ` +
          `sha256 (${pinned.parent.sha256}), so nothing compared against it would mean anything.`,
      });
      return { key, verified: false, facts, findings };
    }

    // Measured above, before the parent gate, because it needs only the tracked file.
    const measuredExtractPages = extractPages ?? pdfPageCount(extractPath);
    const parentPages = pdfPageCount(parentPath);

    // Check 3 first: its offset is what lets check 2 say where a stale extract was cut from.
    const parentTexts = pdfPageTexts(parentPath);
    const coverage = evaluateFolioCoverage({
      key,
      printedFirst,
      printedLast,
      declaredFirstIndex,
      declaredLastIndex,
      parentPageCount: parentPages,
      observations: folioObservations(parentTexts),
    });
    findings.push(...coverage.findings);

    // Check 2: the pinned bytes against the parent pages the config names.
    const extractFirstHash = renderPageHash(extractPath, 1);
    const extractLastHash = renderPageHash(extractPath, measuredExtractPages);
    const parentFirstHash = renderPageHash(parentPath, declaredFirstIndex);
    const parentLastHash = renderPageHash(parentPath, declaredLastIndex);

    // Only worth locating when the pinned bytes are not the declared pages.
    const extractImpliedFirstIndex =
      extractFirstHash === parentFirstHash
        ? null
        : locateExtractInParent({
            parentPath,
            parentPageCount: parentPages,
            extractFirstHash,
            extractFirstPageText: pdfPageTexts(extractPath)[0] ?? "",
            consensusOffset: coverage.consensus?.offset ?? null,
          });

    const identity = evaluateContentIdentity({
      key,
      declaredFirstIndex,
      declaredLastIndex,
      extractFirstHash,
      extractLastHash,
      parentFirstHash,
      parentLastHash,
      extractImpliedFirstIndex,
      printedFirst,
      folioOffset: coverage.consensus?.offset ?? null,
    });
    findings.push(...identity);

    facts = {
      ...facts,
      folioImpliedFirstIndex: coverage.folioImpliedFirstIndex,
      consensusOffset: coverage.consensus?.offset ?? null,
      extractImpliedFirstIndex,
      contentIdentityFirst: extractFirstHash === parentFirstHash,
      contentIdentityLast: extractLastHash === parentLastHash,
    };
  } catch (err: unknown) {
    if (err instanceof PinMeasurementError) {
      findings.push({ check: "artifact", code: err.code, message: err.message });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      findings.push({
        check: "artifact",
        code: "page-render-failed",
        message: `Config '${key}': measurement failed: ${message}`,
      });
    }
  }

  return { key, verified: findings.length === 0, facts, findings };
}

export function verifyFacsimilePins(options?: {
  configDir?: string | undefined;
  repoRoot?: string | undefined;
  key?: string | undefined;
}): FacsimilePinReport {
  const dir = options?.configDir ?? getDefaultConfigDir();
  const repoRoot = options?.repoRoot ?? getDefaultRepoRoot();

  if (!fs.existsSync(dir)) {
    return {
      valid: false,
      checkedCount: 0,
      verifiedCount: 0,
      refusedCount: 1,
      results: [
        {
          key: dir,
          verified: false,
          facts: emptyFacts(dir),
          findings: [
            {
              check: "artifact",
              code: "invalid-config",
              message: `Config directory '${dir}' does not exist`,
            },
          ],
        },
      ],
    };
  }

  let files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  if (options?.key) {
    files = files.filter((f) => f === `${options.key}.yaml` || f === `${options.key}.yml`);
  }

  const results: PinResult[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    let parsed: unknown;
    try {
      parsed = yaml.load(fs.readFileSync(filePath, "utf8"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        key: file,
        verified: false,
        facts: emptyFacts(file),
        findings: [
          {
            check: "artifact",
            code: "invalid-config",
            message: `Failed to read or parse '${file}': ${message}`,
          },
        ],
      });
      continue;
    }
    results.push(verifyPin(parsed, repoRoot));
  }

  const verifiedCount = results.filter((r) => r.verified).length;
  const refusedCount = results.length - verifiedCount;
  return {
    valid: refusedCount === 0 && verifiedCount > 0,
    checkedCount: results.length,
    verifiedCount,
    refusedCount,
    results,
  };
}

function num(value: number | null): string {
  return value === null ? "?" : String(value);
}

export function formatPinReport(report: FacsimilePinReport): string {
  const lines: string[] = ["=== Pinned Facsimile Verification Gate (am-cf6m) ==="];
  lines.push("");
  lines.push("key         printed      declared  anchor  folio   extract-is  content");
  for (const result of report.results) {
    const f = result.facts;
    lines.push(
      [
        result.key.padEnd(11),
        `${num(f.printedFirst)}-${num(f.printedLast)}`.padEnd(12),
        num(f.declaredFirstIndex).padEnd(9),
        num(f.anchorImpliedFirstIndex).padEnd(7),
        num(f.folioImpliedFirstIndex).padEnd(7),
        num(f.extractImpliedFirstIndex).padEnd(11),
        result.facts.contentIdentityFirst === null
          ? "?"
          : result.facts.contentIdentityFirst && result.facts.contentIdentityLast
            ? "match"
            : "STALE",
      ].join(" "),
    );
  }
  lines.push("");
  lines.push(
    "declared = articlePages.parentPageIndices[0]; anchor = index implied by the recorded verified anchor;",
  );
  lines.push(
    "folio = index implied by the parent scan's own text layer; extract-is = parent page the pinned bytes came from.",
  );
  lines.push("");

  for (const result of report.results) {
    if (result.verified) {
      lines.push(`OK  ${result.key}: anchor, content identity and folio coverage all agree.`);
      continue;
    }
    for (const finding of result.findings) {
      lines.push(`REFUSED ${result.key} [${finding.check}/${finding.code}]`);
      lines.push(`        ${finding.message}`);
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${report.checkedCount} pins checked, ${report.verifiedCount} verified, ${report.refusedCount} refused.`,
  );
  const unmeasurable = report.results.filter((r) => isUnmeasurable(r.findings)).length;
  if (unmeasurable > 0) {
    lines.push(
      `Of those, ${unmeasurable} could not be MEASURED here at all: the parent scan, the pinned ` +
        `file or the render tool was unavailable, so no comparison ran. Those refusals are a ` +
        `statement about this environment and not about the pins. /sources is git-ignored, so ` +
        `this is the normal state in CI; the pin gate runs where the parents were downloaded.`,
    );
  }
  return lines.join("\n");
}

export async function runCli(): Promise<number> {
  const args = process.argv.slice(2);
  let key: string | undefined;
  let configDir: string | undefined;
  let repoRoot: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--key" && i + 1 < args.length) {
      key = args[++i];
    } else if (arg === "--config-dir" && i + 1 < args.length) {
      configDir = args[++i];
    } else if (arg === "--repo-root" && i + 1 < args.length) {
      repoRoot = args[++i];
    } else if (arg === "--json") {
      jsonOutput = true;
    }
  }

  const report = verifyFacsimilePins({ key, configDir, repoRoot });
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatPinReport(report));
  }

  // Structured log (am-uxh9). This gate printed its whole verdict to stdout and wrote
  // nothing, so a run left no artifact: which pin was refused, and on which of the three
  // checks, was unrecoverable once the terminal scrolled. I wrote this gate on am-cf6m and
  // missed it in my own sweep of am-uxh9, which classified it healthy on the strength of
  // its stdout report.
  const logger = new TestLogger("facsimile-pins");
  for (const result of report.results) {
    if (result.verified) {
      logger.log({
        testId: result.key,
        outcome: "passed",
        message: "Anchor, content identity and folio coverage all agree.",
      });
      continue;
    }
    for (const finding of result.findings) {
      logger.log({
        testId: result.key,
        outcome: "failed",
        message: `[${finding.check}/${finding.code}] ${finding.message}`,
      });
    }
  }
  logger.log({
    testId: "facsimile-pins-summary",
    outcome: report.valid ? "passed" : "failed",
    message: `${report.checkedCount} pins checked, ${report.verifiedCount} verified, ${report.refusedCount} refused.`,
  });
  await logger.flush();
  console.log(`Structured log: ${logger.filePath}`);

  return report.valid ? 0 : 3;
}

const isMainModule =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith("verify-facsimile-pins.ts"));

if (isMainModule) {
  runCli().then((code) => {
    process.exit(code);
  });
}
