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
import {
  type FacsimileSourceConfig,
  validateFacsimileAnchor,
} from "./sources/facsimileSourceSchema.ts";

export type PinCheck = "artifact" | "anchor" | "content-identity" | "folio-coverage";

export type PinRefusalCode =
  // artifact availability and identity
  | "RENDER_TOOL_UNAVAILABLE"
  | "PINNED_PDF_UNAVAILABLE"
  | "PARENT_PDF_UNAVAILABLE"
  | "PARENT_RECORD_MISSING"
  | "PINNED_DIGEST_CONFLICT"
  | "PARENT_DIGEST_CONFLICT"
  | "PINNED_PAGE_COUNT_MISMATCH"
  | "PAGE_RENDER_FAILED"
  // anchor arithmetic
  | "MISSING_VERIFIED_ANCHOR"
  | "MALFORMED_VERIFIED_ANCHOR"
  | "FACSIMILE_PAGE_OFFSET_MISMATCH"
  | "NON_CONTIGUOUS_PARENT_PAGES"
  | "INVALID_CONFIG"
  // content identity
  | "STALE_PINNED_EXTRACT"
  // folio coverage
  | "FOLIO_CONSENSUS_UNAVAILABLE"
  | "PARENT_FOLIO_OFFSET_MISMATCH"
  | "PRINTED_RANGE_OUTSIDE_PARENT";

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
        code: "MALFORMED_VERIFIED_ANCHOR",
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
      code: (res.refusalCode ?? "INVALID_CONFIG") as PinRefusalCode,
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
}

/**
 * The pinned bytes must be the pages the current config names. This is what catches a config
 * that was corrected after the extract was cut: the arithmetic stays self-consistent, the
 * page count stays right, and the pinned pages are still the old ones.
 */
export function evaluateContentIdentity(input: ContentIdentityInput): readonly PinFinding[] {
  const findings: PinFinding[] = [];
  const located =
    typeof input.extractImpliedFirstIndex === "number"
      ? ` The pinned extract's first page carries the folio of parent page ${input.extractImpliedFirstIndex}, which is where these bytes were cut from.`
      : "";

  if (input.extractFirstHash !== input.parentFirstHash) {
    findings.push({
      check: "content-identity",
      code: "STALE_PINNED_EXTRACT",
      message:
        `Config '${input.key}': the pinned extract's first page does not render identically to ` +
        `parent page ${input.declaredFirstIndex}, the first index the config declares ` +
        `(extract ${input.extractFirstHash.slice(0, 16)}, parent ${input.parentFirstHash.slice(0, 16)}). ` +
        `The pinned PDF was not produced from the config as it now stands.${located}`,
    });
  }

  if (input.extractLastHash !== input.parentLastHash) {
    findings.push({
      check: "content-identity",
      code: "STALE_PINNED_EXTRACT",
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
export function consensusOffsetFrom(
  observations: readonly FolioObservation[],
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
  if (winner[1] < MIN_CONSENSUS_VOTES || winner[1] < runnerUpVotes * MIN_CONSENSUS_DOMINANCE) {
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
      code: "FOLIO_CONSENSUS_UNAVAILABLE",
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
      code: "PARENT_FOLIO_OFFSET_MISMATCH",
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
      code: "PARENT_FOLIO_OFFSET_MISMATCH",
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
      code: "PRINTED_RANGE_OUTSIDE_PARENT",
      message:
        `Config '${input.key}': printed pages ${input.printedFirst}-${input.printedLast} are not inside ` +
        `the printed span this parent covers, ${parentPrintedFirst}-${parentPrintedLast} ` +
        `(${input.parentPageCount} pages at offset ${consensus.offset}). The pin names a parent that ` +
        `does not contain the article.`,
    });
  }

  return { findings, consensus, folioImpliedFirstIndex };
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

export function requireTool(tool: string): void {
  const probe = spawnSync(tool, ["-v"], { encoding: "utf8" });
  if (probe.error) {
    throw new PinMeasurementError(
      "RENDER_TOOL_UNAVAILABLE",
      `'${tool}' is not available on PATH. The pinned facsimiles cannot be compared against ` +
        `their parents without it, and an unverifiable pin is not a verified pin.`,
    );
  }
}

export function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function pdfPageCount(pdfPath: string): number {
  const out = spawnSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  if (out.status !== 0) {
    throw new PinMeasurementError(
      "PAGE_RENDER_FAILED",
      `pdfinfo failed on '${pdfPath}': ${(out.stderr ?? "").trim() || `exit ${String(out.status)}`}`,
    );
  }
  const match = /^Pages:\s+(\d+)$/m.exec(out.stdout);
  if (!match?.[1]) {
    throw new PinMeasurementError(
      "PAGE_RENDER_FAILED",
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
    if (out.status !== 0 || !fs.existsSync(rendered)) {
      throw new PinMeasurementError(
        "PAGE_RENDER_FAILED",
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
  if (out.status !== 0) {
    throw new PinMeasurementError(
      "PAGE_RENDER_FAILED",
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
      code: "PINNED_PDF_UNAVAILABLE",
      message: `Config '${key}' records no pinned artifact, so there is nothing to verify.`,
    });
    return { key, verified: false, facts, findings };
  }
  if (!pinned.parent) {
    findings.push({
      check: "artifact",
      code: "PARENT_RECORD_MISSING",
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
      code: "INVALID_CONFIG",
      message: `Config '${key}' does not declare a printed range and parent page indices to verify.`,
    });
    return { key, verified: false, facts, findings };
  }

  const extractPath = path.resolve(repoRoot, pinned.path);
  const parentPath = path.resolve(repoRoot, pinned.parent.path);

  if (!fs.existsSync(extractPath)) {
    findings.push({
      check: "artifact",
      code: "PINNED_PDF_UNAVAILABLE",
      message: `Config '${key}': pinned PDF '${pinned.path}' is not on disk.`,
    });
  }
  if (!fs.existsSync(parentPath)) {
    findings.push({
      check: "artifact",
      code: "PARENT_PDF_UNAVAILABLE",
      message:
        `Config '${key}': parent scan '${pinned.parent.path}' is not on disk. The parent scans are ` +
        `not committed (/sources is ignored), so this gate runs where they were downloaded. ` +
        `A pin that cannot be compared with its parent is unverified, not verified.`,
    });
  }
  if (findings.some((f) => f.check === "artifact")) {
    return { key, verified: false, facts, findings };
  }

  try {
    requireTool("pdftoppm");
    requireTool("pdftotext");
    requireTool("pdfinfo");

    const extractDigest = sha256File(extractPath);
    if (extractDigest !== pinned.sha256) {
      findings.push({
        check: "artifact",
        code: "PINNED_DIGEST_CONFLICT",
        message:
          `Config '${key}': pinned PDF digest on disk (${extractDigest}) does not match the recorded ` +
          `sha256 (${pinned.sha256}).`,
      });
    }
    const parentDigest = sha256File(parentPath);
    if (parentDigest !== pinned.parent.sha256) {
      findings.push({
        check: "artifact",
        code: "PARENT_DIGEST_CONFLICT",
        message:
          `Config '${key}': parent scan digest on disk (${parentDigest}) does not match the recorded ` +
          `sha256 (${pinned.parent.sha256}), so nothing compared against it would mean anything.`,
      });
      return { key, verified: false, facts, findings };
    }

    const extractPages = pdfPageCount(extractPath);
    if (extractPages !== pinned.pageCount) {
      findings.push({
        check: "artifact",
        code: "PINNED_PAGE_COUNT_MISMATCH",
        message: `Config '${key}': pinned PDF holds ${extractPages} pages but the record says ${pinned.pageCount}.`,
      });
    }
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
    const extractLastHash = renderPageHash(extractPath, extractPages);
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
        code: "PAGE_RENDER_FAILED",
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
              code: "INVALID_CONFIG",
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
            code: "INVALID_CONFIG",
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
