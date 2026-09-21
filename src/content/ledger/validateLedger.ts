/**
 * Does the receipt record a NAMED HUMAN REVIEWER?
 *
 * This is the gate that makes REVIEWED a claim rather than a second spelling of the same header.
 * An entry counts only if it carries a non-empty name that is not an `agent:` identity - the
 * project's convention for relayed agent attribution - because an agent signing off the draft it
 * produced is precisely the state am-wisq exists to refuse. Measured 2026-09-21: all three
 * existing ledgers have `editors: []`, so all three are machine drafts under this test and none
 * can carry the REVIEWED token.
 */
export function hasNamedHumanReviewer(frontMatter: unknown): boolean {
  const transcription = (frontMatter as { transcription?: unknown } | null)?.transcription;
  const editors = (transcription as { editors?: unknown } | null | undefined)?.editors;
  if (!Array.isArray(editors)) return false;
  return editors.some((editor) => {
    const name = (editor as { name?: unknown } | null)?.name;
    return typeof name === "string" && name.trim().length > 0 && !name.trim().startsWith("agent:");
  });
}

/**
 * Reviewed Diplomatic German Ledger Validator.
 * Governed by bead am-edn-ledger-validator-edv and docs/editorial/LEDGER_FORMAT.md.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import type { LedgerStatus } from "../provenance/receiptSchema.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { parseLedgerMath } from "./ledgerMathSettings.ts";
import {
  DEFAULT_MODERN_SPELLINGS,
  DEFAULT_RUNNING_HEAD_PATTERNS,
  DRAFT_REPAIRS,
  extractAllBracketedTags,
  FORBIDDEN_SUBSTRINGS,
  findHtmlOutsideMath,
  KNOWN_TAG_NAMES,
  type LedgerReviewStatus,
  pageMarkerLine,
  parseAnnalenPage,
  parsePageMarker,
} from "./ledgerTokenizer.ts";

export type FindingSeverity = "error" | "warning" | "info";

export interface Finding {
  code: string;
  severity: FindingSeverity;
  ledgerLine: number;
  ledgerPage: number;
  pdfPageIndex: number | null;
  printedPage: number | null;
  message: string;
  repair?: string | undefined;
  excerpt: string;
  acknowledged?: boolean | undefined;
  allowlistEntry?: AllowlistEntry | undefined;
}

export interface AllowlistEntry {
  ledgerKey: string;
  code: string;
  ledgerPage: number;
  lineFingerprint: string;
  reason: string;
  editor: string;
  date: string;
}

export interface StaleAllowlistEntry extends AllowlistEntry {
  staleReason: string;
}

export interface PageStat {
  ledgerPage: number;
  printedPage: number | null;
  paragraphsStarting: number;
  displayEquations: number;
  footnotes: number;
  inlineMathRegions: number;
}

export interface LedgerStats {
  pages: number;
  skeletonPages: number;
  headings: number;
  paragraphs: number;
  displayEquations: number;
  inlineMathRegions: number;
  footnotes: number;
  closings: number;
  emphasisSpans: number;
  perPage: PageStat[];
  repeatedEquationLabels: string[];
}

export interface ValidateLedgerResult {
  valid: boolean;
  clean: boolean;
  mode: "structural" | "completeness";
  ledgerStatus: LedgerStatus;
  ledgerKey: string;
  ledgerSha256: string;
  sourceAssetSha256: string;
  configSection: string;
  errors: Finding[];
  warnings: Finding[];
  info: Finding[];
  staleAllowlistEntries: StaleAllowlistEntry[];
  stats: LedgerStats;
}

export interface ValidateLedgerOptions {
  content?: string | undefined;
  paper?: string | undefined;
  requireComplete?: boolean | undefined;
  allowWarnings?: boolean | undefined;
  ledgerKey?: string | undefined;
  receiptPath?: string | undefined;
  receiptContent?: string | undefined;
  configPath?: string | undefined;
  allowlistPath?: string | undefined;
}

export const KNOWN_KEY_TO_SLUG: Readonly<Record<string, string>> = Object.freeze({
  "ap-17-132": "light-quanta",
  "ap-17-549": "brownian-motion",
  "ap-17-891": "special-relativity",
  "ap-18-639": "mass-energy",
  "ap-19-289": "molecular-dimensions",
  "ap-34-591": "molecular-dimensions",
});

export function computeLineFingerprint(line: string): string {
  const normalized = line.normalize("NFC").trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function truncateExcerpt(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

type ResolvedConfig = {
  runningHeadPatterns: string[];
  expectedClosings: string[];
  printingAnomalies: { label: string; section: string; typographicalErrorId: string }[];
  modernSpellingList: { modern: string; period: string; citation: string }[];
  configSection: string;
};

export function validateLedger(
  ledgerPath: string,
  options: ValidateLedgerOptions = {},
): ValidateLedgerResult {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const info: Finding[] = [];

  // 1. Read ledger content and bytes
  let rawBytes: Buffer;
  let text: string;

  if (options.content !== undefined) {
    rawBytes = Buffer.from(options.content, "utf8");
    text = options.content;
  } else {
    if (!existsSync(ledgerPath)) {
      throw new Error(`Ledger file not found at: ${ledgerPath}`);
    }
    rawBytes = readFileSync(ledgerPath);
    text = rawBytes.toString("utf8");
  }

  const computedLedgerSha256 = createHash("sha256").update(rawBytes).digest("hex");

  // Determine ledger key
  let ledgerKey = options.ledgerKey;
  if (!ledgerKey) {
    const filename = path.basename(ledgerPath);
    // Both status suffixes, since am-wisq made the filename follow the review status. Matching
    // only -reviewed.txt meant every renamed ledger fell through to the hard-coded default below
    // and was validated against ANOTHER paper's receipt: after the rename all three reported 12
    // pages, which is Brownian's page count, and mass-energy gained nine imaginary skeleton pages.
    const keyMatch = filename.match(/^([a-z0-9-]+?)-(?:reviewed|machine-draft)\.txt$/);
    if (keyMatch?.[1]) {
      ledgerKey = keyMatch[1];
    } else if (options.receiptPath) {
      ledgerKey = path.basename(options.receiptPath, ".md");
    } else {
      // A SILENT FALLBACK TO ANOTHER PAPER'S RECEIPT. Left as it was because changing it is a
      // refusal-behaviour change nobody has ruled on, but recorded because the rename above
      // demonstrated exactly what it does: an unrecognised ledger filename is validated against
      // ap-17-549's page map and reports that paper's page count as its own. AGENTS.md's rule for
      // unknown ids is that they fail explicitly rather than fall back to another paper's model.
      ledgerKey = "ap-17-549"; // Default reference key
    }
  }

  // 2. Resolve provenance receipt
  let receiptFile = options.receiptPath;
  if (!receiptFile) {
    const candidatePaths = [
      path.join(process.cwd(), "docs/provenance", `${ledgerKey}.md`),
      path.join(process.cwd(), "src/testing/fixtures/ledgers", `${ledgerKey}.md`),
      path.join(process.cwd(), "src/testing/fixtures/ledgers", `${ledgerKey}.receipt.md`),
      `${ledgerPath}.receipt.md`,
    ];
    receiptFile = candidatePaths.find((p) => existsSync(p)) ?? candidatePaths[0] ?? "";
  }

  let receiptRaw: string;
  if (options.receiptContent !== undefined) {
    receiptRaw = options.receiptContent;
  } else {
    if (!existsSync(receiptFile)) {
      throw new Error(`Provenance receipt not found for key "${ledgerKey}" at: ${receiptFile}`);
    }
    receiptRaw = readFileSync(receiptFile, "utf8");
  }
  const parsedReceipt = parseReceipt(receiptRaw, receiptFile);
  const frontMatter = parsedReceipt.frontMatter;

  if (!frontMatter) {
    throw new Error(`Failed to parse front matter from receipt at ${receiptFile}`);
  }

  const sourceAssetSha256 = frontMatter.scan?.sha256 ?? "";
  const ledgerSourcePdfSha256 = frontMatter.transcription?.ledgerSourcePdfSha256;
  const declaredLedgerSha256 = frontMatter.transcription?.ledgerSha256;
  const ledgerStatus: LedgerStatus = frontMatter.transcription?.ledgerStatus ?? "in-progress";

  // Check source PDF digest binding
  if (
    ledgerSourcePdfSha256 !== undefined &&
    sourceAssetSha256 !== "" &&
    ledgerSourcePdfSha256 !== sourceAssetSha256
  ) {
    errors.push({
      code: "receipt-source-digest-mismatch",
      severity: "error",
      ledgerLine: 1,
      ledgerPage: 1,
      pdfPageIndex: 1,
      printedPage: null,
      message: `Receipt transcription.ledgerSourcePdfSha256 (${ledgerSourcePdfSha256}) does not match scan.sha256 (${sourceAssetSha256}).`,
      repair: "Update receipt ledgerSourcePdfSha256 to match scan.sha256.",
      excerpt: "",
    });
  }

  // 3. Determine Validation Mode
  const isCompletenessStatus =
    ledgerStatus === "corrected" ||
    ledgerStatus === "corrected-second-read" ||
    ledgerStatus === "reviewed";
  const mode: "structural" | "completeness" =
    options.requireComplete || isCompletenessStatus ? "completeness" : "structural";

  // Check ledger SHA-256 against receipt
  if (!declaredLedgerSha256 || declaredLedgerSha256 !== computedLedgerSha256) {
    if (mode === "completeness") {
      errors.push({
        code: "receipt-ledger-digest-mismatch",
        severity: "error",
        ledgerLine: 1,
        ledgerPage: 1,
        pdfPageIndex: 1,
        printedPage: null,
        message: `Receipt transcription.ledgerSha256 (${declaredLedgerSha256 || "missing"}) does not match computed ledger SHA-256 (${computedLedgerSha256}).`,
        repair: "Update receipt transcription.ledgerSha256 with current ledger hash.",
        excerpt: "",
      });
    } else {
      info.push({
        code: "receipt-ledger-digest-stale",
        severity: "info",
        ledgerLine: 1,
        ledgerPage: 1,
        pdfPageIndex: 1,
        printedPage: null,
        message: `Receipt transcription.ledgerSha256 is stale during in-progress transcription.`,
        excerpt: "",
      });
    }
  }

  // 4. Resolve Paper Slug & Configuration
  const slug =
    options.paper ??
    KNOWN_KEY_TO_SLUG[ledgerKey] ??
    (frontMatter.slug as string | undefined) ??
    "brownian-motion";

  let configPath = options.configPath;
  if (!configPath) {
    const candidateConfigPaths = [
      path.join(process.cwd(), "content/source-blocks", slug, "ledger-config.yaml"),
      path.join(process.cwd(), "src/testing/fixtures/ledgers", slug, "ledger-config.yaml"),
    ];
    configPath = candidateConfigPaths.find((p) => existsSync(p)) ?? candidateConfigPaths[0] ?? "";
  }

  const resolvedConfig: ResolvedConfig = {
    runningHeadPatterns: [...DEFAULT_RUNNING_HEAD_PATTERNS],
    expectedClosings: ["dateline", "received"],
    printingAnomalies: [],
    modernSpellingList: [...DEFAULT_MODERN_SPELLINGS],
    configSection: "defaults",
  };

  if (existsSync(configPath)) {
    const rawYaml = readFileSync(configPath, "utf8");
    const parsedConfig = parseYaml(rawYaml) as {
      defaults?: Record<string, unknown>;
      ledgers?: Record<string, Record<string, unknown>>;
    };

    if (parsedConfig) {
      // Validate ledgers keys
      if (parsedConfig.ledgers && typeof parsedConfig.ledgers === "object") {
        for (const k of Object.keys(parsedConfig.ledgers)) {
          const kReceipt = path.join(process.cwd(), "docs/provenance", `${k}.md`);
          const kFixtureReceipt = path.join(
            process.cwd(),
            "src/testing/fixtures/ledgers",
            `${k}.md`,
          );
          const kFixtureReceipt2 = path.join(
            process.cwd(),
            "src/testing/fixtures/ledgers",
            `${k}.receipt.md`,
          );
          if (
            !existsSync(kReceipt) &&
            !existsSync(kFixtureReceipt) &&
            !existsSync(kFixtureReceipt2)
          ) {
            errors.push({
              code: "config-key-unknown",
              severity: "error",
              ledgerLine: 1,
              ledgerPage: 1,
              pdfPageIndex: null,
              printedPage: null,
              message: `Configuration under 'ledgers:' references unknown key "${k}" with no provenance receipt.`,
              repair: `Create docs/provenance/${k}.md or remove the section from ledger-config.yaml.`,
              excerpt: k,
            });
          }
        }
      }

      // Check config-key-missing for multi-key slugs
      const knownKeysForSlug = Object.entries(KNOWN_KEY_TO_SLUG)
        .filter(([_, s]) => s === slug)
        .map(([k]) => k);
      if (knownKeysForSlug.length > 1) {
        const hasSection = parsedConfig.ledgers?.[ledgerKey];
        const defaultsComplete =
          parsedConfig.defaults &&
          Array.isArray(parsedConfig.defaults.expectedClosings) &&
          parsedConfig.defaults.expectedClosings.length > 0;
        if (!hasSection && !defaultsComplete) {
          errors.push({
            code: "config-key-missing",
            severity: "error",
            ledgerLine: 1,
            ledgerPage: 1,
            pdfPageIndex: null,
            printedPage: null,
            message: `Multi-ledger slug "${slug}" has neither a 'ledgers.${ledgerKey}' section nor complete 'defaults' covering expectedClosings.`,
            repair: `Add a 'ledgers.${ledgerKey}' section or define complete defaults in ${configPath}.`,
            excerpt: ledgerKey,
          });
        }
      }

      // Merge defaults
      const d = parsedConfig.defaults;
      if (d) {
        if (Array.isArray(d.runningHeadPatterns)) {
          resolvedConfig.runningHeadPatterns = d.runningHeadPatterns.map(String);
        }
        if (Array.isArray(d.expectedClosings)) {
          resolvedConfig.expectedClosings = d.expectedClosings.map(String);
        }
        if (Array.isArray(d.printingAnomalies)) {
          resolvedConfig.printingAnomalies =
            d.printingAnomalies as ResolvedConfig["printingAnomalies"];
        }
        if (Array.isArray(d.modernSpellingList)) {
          for (const item of d.modernSpellingList as unknown[]) {
            if (typeof item === "string") {
              resolvedConfig.modernSpellingList.push({
                modern: item,
                period: item,
                citation: "configured in ledger-config",
              });
            } else if (item && typeof item === "object") {
              resolvedConfig.modernSpellingList.push(
                item as (typeof resolvedConfig.modernSpellingList)[number],
              );
            }
          }
        }
      }

      // Key-specific overrides
      const kSec = parsedConfig.ledgers?.[ledgerKey];
      if (kSec) {
        resolvedConfig.configSection = `ledgers.${ledgerKey}`;
        if (Array.isArray(kSec.runningHeadPatterns)) {
          resolvedConfig.runningHeadPatterns = kSec.runningHeadPatterns.map(String);
        }
        if (Array.isArray(kSec.expectedClosings)) {
          resolvedConfig.expectedClosings = kSec.expectedClosings.map(String);
        }
        if (Array.isArray(kSec.printingAnomalies)) {
          resolvedConfig.printingAnomalies =
            kSec.printingAnomalies as ResolvedConfig["printingAnomalies"];
        }
        if (Array.isArray(kSec.modernSpellingList)) {
          for (const item of kSec.modernSpellingList as unknown[]) {
            if (typeof item === "string") {
              resolvedConfig.modernSpellingList.push({
                modern: item,
                period: item,
                citation: "configured in ledger-config",
              });
            } else if (item && typeof item === "object") {
              resolvedConfig.modernSpellingList.push(
                item as (typeof resolvedConfig.modernSpellingList)[number],
              );
            }
          }
        }
      }
    }
  }

  // 5. Read & Validate Allowlist
  let allowlistPath = options.allowlistPath;
  if (!allowlistPath) {
    const candidateAllowlistPaths = [
      path.join(process.cwd(), "content/source-blocks", slug, "ledger-allowlist.yaml"),
      path.join(process.cwd(), "src/testing/fixtures/ledgers", slug, "ledger-allowlist.yaml"),
    ];
    allowlistPath =
      candidateAllowlistPaths.find((p) => existsSync(p)) ?? candidateAllowlistPaths[0] ?? "";
  }

  const activeAllowlistEntries: AllowlistEntry[] = [];
  const otherKeyAllowlistEntries: AllowlistEntry[] = [];

  if (existsSync(allowlistPath)) {
    const rawYaml = readFileSync(allowlistPath, "utf8");
    const parsedEntries = parseYaml(rawYaml) as unknown[];

    if (Array.isArray(parsedEntries)) {
      for (let idx = 0; idx < parsedEntries.length; idx++) {
        const item = parsedEntries[idx] as Partial<AllowlistEntry>;
        if (
          !item ||
          typeof item !== "object" ||
          !item.reason ||
          !item.editor ||
          !item.date ||
          !item.code ||
          typeof item.ledgerPage !== "number" ||
          !item.lineFingerprint
        ) {
          errors.push({
            code: "allowlist-entry-invalid",
            severity: "error",
            ledgerLine: 1,
            ledgerPage: 1,
            pdfPageIndex: null,
            printedPage: null,
            message: `Allowlist entry at index ${idx} is missing required fields (reason, editor, date, code, ledgerPage, lineFingerprint).`,
            repair: "Complete all required fields on each allowlist entry.",
            excerpt: JSON.stringify(item),
          });
          continue;
        }

        const entry = item as AllowlistEntry;
        if (entry.ledgerKey === ledgerKey) {
          activeAllowlistEntries.push(entry);
        } else {
          otherKeyAllowlistEntries.push(entry);
        }
      }
    }
  }

  // 6. Check Encoding Invariants
  if (
    rawBytes.length >= 3 &&
    rawBytes[0] === 0xef &&
    rawBytes[1] === 0xbb &&
    rawBytes[2] === 0xbf
  ) {
    errors.push({
      code: "content-before-marker",
      severity: "error",
      ledgerLine: 1,
      ledgerPage: 1,
      pdfPageIndex: 1,
      printedPage: null,
      message: "Byte Order Mark (BOM) found before first page marker.",
      repair: "Remove BOM and ensure file begins immediately with page marker.",
      excerpt: "\\uFEFF",
    });
  }

  if (text.includes("\r")) {
    errors.push({
      code: "encoding",
      severity: "error",
      ledgerLine: 1,
      ledgerPage: 1,
      pdfPageIndex: null,
      printedPage: null,
      message: "CRLF / CR line endings detected. Ledger must use Unix LF (\\n) line endings only.",
      repair: "Convert all line endings to LF.",
      excerpt: "\\r",
    });
  }

  if (text !== text.normalize("NFC")) {
    errors.push({
      code: "encoding",
      severity: "error",
      ledgerLine: 1,
      ledgerPage: 1,
      pdfPageIndex: null,
      printedPage: null,
      message: "Ledger content is not normalized to Unicode Normalization Form C (NFC).",
      repair: "Normalize the file to Unicode NFC.",
      excerpt: "",
    });
  }

  if (text.includes("\t")) {
    errors.push({
      code: "encoding",
      severity: "error",
      ledgerLine: 1,
      ledgerPage: 1,
      pdfPageIndex: null,
      printedPage: null,
      message: "Tab characters are forbidden in ledger files.",
      repair: "Replace tabs with single spaces or remove them.",
      excerpt: "\\t",
    });
  }

  // 7. Page Scope & Mapping from Receipt
  const pageMap = frontMatter.pageMap ?? [];
  const ledgerScopePages = frontMatter.transcription?.ledgerScopePages;
  const expectedTotalPages =
    Array.isArray(ledgerScopePages) && ledgerScopePages.length > 0
      ? ledgerScopePages.length
      : pageMap.length;

  function getPageMapping(lPage: number): {
    pdfPageIndex: number | null;
    printedPage: number | null;
  } {
    if (Array.isArray(ledgerScopePages) && ledgerScopePages.length > 0) {
      const pdfIdx = ledgerScopePages[lPage - 1];
      if (pdfIdx === undefined) return { pdfPageIndex: null, printedPage: null };
      const entry = pageMap[pdfIdx - 1];
      return {
        pdfPageIndex: pdfIdx,
        printedPage: entry?.printedPage ?? null,
      };
    }
    const entry = pageMap[lPage - 1];
    return {
      pdfPageIndex: entry ? entry.pdfPageIndex : null,
      printedPage: entry ? (entry.printedPage ?? null) : null,
    };
  }

  // 8. Line Parsing & Tokenization State Machine
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop(); // Remove final empty line after LF
  }

  // Check first line, and read the status the transcript declares about itself.
  //
  // am-wisq: until 2026-09-21 this accepted exactly one token, so every machine draft opened with
  // the word REVIEWED because the validator refused anything else. The owner ruled that a draft
  // opens MACHINE DRAFT and that REVIEWED is earned. Both tokens are now valid HERE; what makes
  // REVIEWED a claim rather than a synonym is the receipt gate below.
  // NOT trimmed, deliberately. The first line must BEGIN with the marker: a leading space is page
  // furniture corruption and the original check caught it. Trimming here made a stray space parse
  // cleanly, which one of this file's own tests caught within the minute.
  const firstMarker = lines.length > 0 ? parsePageMarker(lines[0] ?? "") : null;
  const declaredStatus: LedgerReviewStatus = firstMarker?.status ?? "machine-draft";
  // Two sites, not one, and deliberately so: "line 1 looks like a marker but is malformed" and
  // "line 1 is not a marker at all" are different faults with different repairs, and this file has
  // a test for each. Merging them into one push with a conditional message compiled and passed
  // both tests while quietly halving the refusal surface - nothing would then fail if a later edit
  // dropped one branch.
  if (firstMarker?.pageNumber !== 1) {
    const repair = `Replace first line with "${pageMarkerLine("machine-draft", 1, expectedTotalPages)}", or the REVIEWED form once a named human reviewer is recorded in the receipt.`;
    if ((lines[0] ?? "").includes("TRANSCRIPTION PAGE")) {
      errors.push({
        code: "first-marker",
        severity: "error",
        ledgerLine: 1,
        ledgerPage: 1,
        pdfPageIndex: 1,
        printedPage: null,
        message: `First line must be "${pageMarkerLine("machine-draft", 1, expectedTotalPages)}" or its REVIEWED form.`,
        repair,
        excerpt: lines[0] ?? "",
      });
    } else {
      errors.push({
        code: "first-marker",
        severity: "error",
        ledgerLine: 1,
        ledgerPage: 1,
        pdfPageIndex: 1,
        printedPage: null,
        message: "First line of ledger file is not a page marker.",
        repair,
        excerpt: lines[0] ?? "",
      });
    }
  }

  // THE GATE, and it is the whole of the ruling. Without it the format has merely gained a synonym
  // and a machine draft can still call itself reviewed by typing a different word. A named human
  // reviewer is an entry in the receipt's transcription.editors with a name that is not an agent
  // identity; `agent:<name>` is the project's convention for relayed agent attribution and an agent
  // signing off its own draft is exactly what this refuses.
  if (firstMarker?.status === "reviewed" && !hasNamedHumanReviewer(frontMatter)) {
    errors.push({
      code: "reviewed-without-named-reviewer",
      severity: "error",
      ledgerLine: 1,
      ledgerPage: 1,
      pdfPageIndex: 1,
      printedPage: null,
      message:
        "Transcript declares REVIEWED but its receipt records no named human reviewer in transcription.editors.",
      repair: `Record the reviewer in the receipt's transcription.editors, or open the transcript "${pageMarkerLine("machine-draft", 1, expectedTotalPages)}".`,
      excerpt: lines[0] ?? "",
    });
  }
  // State
  let currentLedgerPage = 0;
  let expectedPage = 1;
  let currentPrintedPage: number | null = null;
  let currentPdfPageIndex: number | null = null;
  let expectingAnchorNext = false;
  let lastAnchor = 0;
  const seenAnchors = new Set<number>();

  let currentSection = 0; // s0
  let currentPart = 0;
  const seenSections = new Set<number>([0]);
  const seenParts = new Set<number>();

  // Equations
  let inDisplay = false;
  let displayLines: string[] = [];
  let displayStartLine = 0;
  let lastLineWasDisplayEnd = false;
  let lastDisplayEndLine = 0;

  const sectionEqLabels = new Map<number, string[]>();
  const allEqLabels = new Map<string, Set<number>>();

  // Footnotes
  const pageFnMarks = new Map<number, { label: string; line: number }[]>();
  const pageFnTexts = new Map<number, { label: string; line: number }[]>();
  const pageFnContinues = new Map<number, number>(); // page -> line
  const pageFnConts = new Map<number, { label: string; line: number }[]>();

  // Continues tag
  const pageContinues = new Map<number, { line: number; textAfterCount: number }>();

  // Closings & Masthead
  const seenClosings = new Set<string>();
  let hasTitle = false;
  let hasAuthor = false;

  // Emphasis stack
  const openEmphasis: { tag: string; line: number }[] = [];

  // Paragraph & Page statistics
  const pageBodyLineCount = new Map<number, number>();
  const pageParagraphsStarting = new Map<number, number>();
  const pageDisplayEquationCount = new Map<number, number>();
  const pageInlineMathCount = new Map<number, number>();
  const pageFootnotesCount = new Map<number, number>();

  let inParagraph = false;
  // True while inside a multi-line [[FN ...]] block. Only the FIRST line of a footnote
  // starts with "[[FN", so a bare connective printed between two displays inside a footnote
  // (e.g. "also") is otherwise indistinguishable from body text.
  let inFootnoteBlock = false;
  let currentParaWordCount = 0;
  let currentParaStartLine = 0;
  let currentParaLines: { lineNum: number; words: number }[] = [];
  let totalHeadings = 0;
  let totalParagraphs = 0;
  let totalDisplayEquations = 0;
  let totalInlineMath = 0;
  let totalFootnotes = 0;
  let totalClosings = 0;
  let totalEmphasisSpans = 0;

  function endParagraph() {
    if (!inParagraph) return;
    totalParagraphs++;
    if (currentParaWordCount <= 2 && currentParaWordCount > 0) {
      warnings.push({
        code: "short-paragraph",
        severity: "warning",
        ledgerLine: currentParaStartLine,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: `Paragraph has only ${currentParaWordCount} words.`,
        excerpt: `Words: ${currentParaWordCount}`,
      });
    }

    // Check short lines (not the last line of the paragraph)
    for (let i = 0; i < currentParaLines.length - 1; i++) {
      const pLine = currentParaLines[i];
      if (pLine && pLine.words > 0 && pLine.words <= 2) {
        warnings.push({
          code: "short-line",
          severity: "warning",
          ledgerLine: pLine.lineNum,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Line has only ${pLine.words} words inside paragraph body.`,
          excerpt: `Words: ${pLine.words}`,
        });
      }
    }

    inParagraph = false;
    currentParaWordCount = 0;
    currentParaLines = [];
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex] ?? "";
    const lineNumber = lineIndex + 1;
    const trimmed = rawLine.trim();

    // Check trailing whitespace
    if (rawLine !== rawLine.trimEnd()) {
      warnings.push({
        code: "trailing-whitespace",
        severity: "warning",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: "Trailing whitespace detected on line.",
        repair: "Remove trailing spaces and tabs.",
        excerpt: truncateExcerpt(rawLine),
      });
    }

    // Check page marker
    const marker = parsePageMarker(trimmed);
    if (marker) {
      endParagraph();
      lastLineWasDisplayEnd = false;

      // One file, one declared status. Without this a transcript could open MACHINE DRAFT, pass
      // the receipt gate on line 1, and switch to REVIEWED on page 2 - where the gate never looks.
      if (marker.status !== declaredStatus) {
        errors.push({
          code: "marker-status-mixed",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: marker.pageNumber,
          pdfPageIndex: marker.pageNumber,
          printedPage: currentPrintedPage,
          message: `Page ${marker.pageNumber} declares ${marker.status.toUpperCase()} but the transcript opened ${declaredStatus.toUpperCase()}.`,
          repair: `Make every page marker declare the same status as page 1, "${pageMarkerLine(declaredStatus, marker.pageNumber, marker.totalPages)}".`,
          excerpt: trimmed,
        });
      }

      currentLedgerPage = marker.pageNumber;
      if (marker.pageNumber !== expectedPage) {
        errors.push({
          code: "marker-sequence",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: null,
          printedPage: null,
          message: `Page marker out of sequence: expected page ${expectedPage}, found ${marker.pageNumber}.`,
          repair: `Correct page sequence to ${expectedPage}.`,
          excerpt: rawLine,
        });
      }
      expectedPage = marker.pageNumber + 1;

      if (marker.totalPages !== expectedTotalPages) {
        errors.push({
          code: "page-count-mismatch",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: null,
          printedPage: null,
          message: `Declared total pages (${marker.totalPages}) does not match receipt expected page count (${expectedTotalPages}).`,
          repair: `Update page marker to reflect total ${expectedTotalPages} pages.`,
          excerpt: rawLine,
        });
      }

      expectingAnchorNext = true;
      continue;
    }

    // If expecting anchor
    if (expectingAnchorNext) {
      expectingAnchorNext = false;
      const anchor = parseAnnalenPage(trimmed);
      if (!anchor) {
        errors.push({
          code: "anchor-missing",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: null,
          printedPage: null,
          message: "Page marker must be followed immediately by [[ANNALEN-PAGE <n>]].",
          repair:
            "Add [[ANNALEN-PAGE <printedPage>]] on the line immediately following the marker.",
          excerpt: rawLine,
        });
      } else {
        const pNum = anchor.printedPage;
        const mapping = getPageMapping(currentLedgerPage);
        currentPdfPageIndex = mapping.pdfPageIndex;
        currentPrintedPage = pNum;

        // Check duplicate
        if (seenAnchors.has(pNum)) {
          errors.push({
            code: "anchor-duplicate",
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: pNum,
            message: `Duplicate ANNALEN-PAGE anchor ${pNum}.`,
            repair: "Ensure each printed page anchor is unique.",
            excerpt: rawLine,
          });
        }
        seenAnchors.add(pNum);

        // Check order
        if (pNum <= lastAnchor) {
          errors.push({
            code: "anchor-order",
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: pNum,
            message: `ANNALEN-PAGE anchor ${pNum} is not strictly increasing (last was ${lastAnchor}).`,
            repair: "Correct page anchor order.",
            excerpt: rawLine,
          });
        }
        lastAnchor = pNum;

        // Check range
        const jPages = frontMatter.paper?.journal?.pages;
        if (jPages && (pNum < jPages.first || pNum > jPages.last)) {
          errors.push({
            code: "anchor-range",
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: pNum,
            message: `ANNALEN-PAGE anchor ${pNum} is outside journal range [${jPages.first}, ${jPages.last}].`,
            repair: "Correct anchor to match journal publication range.",
            excerpt: rawLine,
          });
        }

        // Check mapping against receipt
        if (mapping.printedPage !== null && pNum !== mapping.printedPage) {
          errors.push({
            code: "anchor-mapping",
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: pNum,
            message: `ANNALEN-PAGE anchor ${pNum} does not match receipt printedPage (${mapping.printedPage}) for ledger page ${currentLedgerPage}.`,
            repair: `Update anchor to [[ANNALEN-PAGE ${mapping.printedPage}]].`,
            excerpt: rawLine,
          });
        }

        continue;
      }
    }

    // Blank line
    if (trimmed === "") {
      endParagraph();
      inFootnoteBlock = false;
      continue;
    }

    // Check display math lines
    if (inDisplay) {
      if (trimmed === "$$" || trimmed.endsWith("$$")) {
        inDisplay = false;
        lastLineWasDisplayEnd = true;
        lastDisplayEndLine = lineNumber;
        displayLines.push(trimmed.replace(/\$\$$/, "").trim());
        totalDisplayEquations++;
        pageDisplayEquationCount.set(
          currentLedgerPage,
          (pageDisplayEquationCount.get(currentLedgerPage) ?? 0) + 1,
        );

        const fullDisplay = displayLines.join("\n").trim();
        const mathCheck = parseLedgerMath(fullDisplay, true);
        if (!mathCheck.ok && mathCheck.code) {
          errors.push({
            code: mathCheck.code,
            severity: "error",
            ledgerLine: displayStartLine,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: currentPrintedPage,
            message: mathCheck.error ?? "Failed to parse display mathematics.",
            repair: "Correct LaTeX syntax for display equation.",
            excerpt: truncateExcerpt(fullDisplay),
          });
        }
        displayLines = [];
      } else {
        displayLines.push(rawLine);
      }
      continue;
    }

    // Check start of display math
    if (trimmed.startsWith("$$")) {
      lastLineWasDisplayEnd = false;
      if (trimmed.endsWith("$$") && trimmed.length > 2) {
        // Single line display: $$ <math> $$
        lastLineWasDisplayEnd = true;
        lastDisplayEndLine = lineNumber;
        totalDisplayEquations++;
        pageDisplayEquationCount.set(
          currentLedgerPage,
          (pageDisplayEquationCount.get(currentLedgerPage) ?? 0) + 1,
        );

        const inner = trimmed.slice(2, -2).trim();
        const mathCheck = parseLedgerMath(inner, true);
        if (!mathCheck.ok && mathCheck.code) {
          errors.push({
            code: mathCheck.code,
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: currentPrintedPage,
            message: mathCheck.error ?? "Failed to parse display mathematics.",
            repair: "Correct LaTeX syntax for display equation.",
            excerpt: truncateExcerpt(trimmed),
          });
        }
        continue;
      }
      inDisplay = true;
      displayStartLine = lineNumber;
      displayLines = [trimmed.slice(2).trim()];
      continue;
    }

    // Line-end hyphen check
    if (/[a-zA-Z\u00C0-\u024F][-\u2010]$/.test(rawLine.trimEnd())) {
      errors.push({
        code: "line-end-hyphen",
        severity: "error",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: "Physical line ends with a wrap hyphen. Rejoin wrapped words mid-line.",
        repair: "Rejoin the hyphenated word whole or move to next line.",
        excerpt: truncateExcerpt(rawLine),
      });
    }

    // Check for draft tokens
    const draftMatch = rawLine.match(
      /\[\[(RUNNING-HEAD|PAGE-NUMBER|ILLEGIBLE)(?:\s+[\s\S]*?)?\]\]/,
    );
    if (draftMatch?.[1]) {
      const dName = draftMatch[1];
      errors.push({
        code: "draft-token",
        severity: "error",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: `Draft token [[${dName}]] is forbidden in reviewed ledgers.`,
        repair: DRAFT_REPAIRS[dName] ?? "Remove draft OCR token.",
        excerpt: truncateExcerpt(rawLine),
      });
    }

    // Check forbidden substrings
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      if (rawLine.includes(forbidden)) {
        errors.push({
          code: "forbidden-token",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Forbidden token or machine output "${forbidden}" detected.`,
          repair: `Remove "${forbidden}" from the ledger.`,
          excerpt: truncateExcerpt(rawLine),
        });
      }
    }

    if (
      /\{.*"(?:confidence|ocr|tokens|box|score)"\s*:/.test(rawLine) ||
      /"confidence"\s*:\s*\d+/.test(rawLine)
    ) {
      errors.push({
        code: "forbidden-token",
        severity: "error",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: "Machine confidence JSON output detected.",
        repair: "Remove machine confidence tokens from reviewed ledger.",
        excerpt: truncateExcerpt(rawLine),
      });
    }

    // Check unknown tags
    const allBracketed = extractAllBracketedTags(rawLine);
    for (const tagInfo of allBracketed) {
      if (!KNOWN_TAG_NAMES.has(tagInfo.name)) {
        errors.push({
          code: "unknown-tag",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Unknown tag ${tagInfo.tag} in ledger.`,
          repair: "Use only documented markup tags defined in LEDGER_FORMAT.md.",
          excerpt: truncateExcerpt(tagInfo.tag),
        });
      }
    }

    // Check equation label
    const eqLabelMatch = rawLine.match(/\[\[EQ-LABEL\s+([\s\S]*?)\]\]/);
    if (eqLabelMatch?.[1]) {
      const label = eqLabelMatch[1].trim();
      if (!lastLineWasDisplayEnd || lineNumber !== lastDisplayEndLine + 1) {
        errors.push({
          code: "eq-label-orphan",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Equation label [[EQ-LABEL ${label}]] must follow immediately on the next line after a display equation.`,
          repair: "Move [[EQ-LABEL ...]] to the line directly after the closing $$ of a display.",
          excerpt: truncateExcerpt(rawLine),
        });
      }
      lastLineWasDisplayEnd = false; // Reset

      // Track per section and across sections
      const secLabels = sectionEqLabels.get(currentSection) ?? [];
      if (secLabels.includes(label)) {
        // Duplicate in same section
        const isAnomaly = resolvedConfig.printingAnomalies.some(
          (a) =>
            a.label === label &&
            a.section === `s${currentSection}` &&
            Boolean(a.typographicalErrorId),
        );
        if (!isAnomaly) {
          errors.push({
            code: "eq-label-duplicate-in-section",
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: currentPrintedPage,
            message: `Equation label "${label}" is duplicated in section s${currentSection}.`,
            repair:
              "Verify against print or record printing anomaly with receipt typographical error ID.",
            excerpt: label,
          });
        }
      } else {
        secLabels.push(label);
        sectionEqLabels.set(currentSection, secLabels);
      }

      const allSecs = allEqLabels.get(label) ?? new Set<number>();
      allSecs.add(currentSection);
      allEqLabels.set(label, allSecs);

      continue;
    } else {
      // If this line is not an EQ-LABEL, reset display end tracker
      lastLineWasDisplayEnd = false;
    }

    // Headings
    // Footnote marks are collected BEFORE the heading branches, because LEDGER_FORMAT.md
    // section 4.6 places `[[FN-MARK <label>]]` "inline at the point of reference in text,
    // headings, or equations" - and the heading branches below `continue`, so a mark
    // printed in a heading was never seen. It surfaced as `fn-text-orphan` against the
    // footnote TEXT, blaming the wrong line entirely.
    //
    // Found transcribing ap-17-549: Einstein attaches footnote 1 to the section 2 heading
    // itself ("...Theorie der Wärme.1)"), so the only ways to pass were to drop a printed
    // mark or to move it into a sentence that does not carry it. Both falsify the source,
    // which is the one thing a diplomatic transcription may never do.
    const fnMarkRegex = /\[\[FN-MARK\s+([\s\S]*?)\]\]/g;
    let fnMarkMatch: RegExpExecArray | null;
    while (true) {
      fnMarkMatch = fnMarkRegex.exec(rawLine);
      if (!fnMarkMatch) break;
      const mLabel = (fnMarkMatch[1] ?? "").trim();
      const pageMarks = pageFnMarks.get(currentLedgerPage) ?? [];
      pageMarks.push({ label: mLabel, line: lineNumber });
      pageFnMarks.set(currentLedgerPage, pageMarks);
    }

    const headingMatch = rawLine.match(/^\[\[HEADING\s+s(\d+)\]\]\s*([\s\S]*)$/);
    if (headingMatch?.[1]) {
      endParagraph();
      totalHeadings++;
      const sNum = Number.parseInt(headingMatch[1], 10);
      if (sNum <= currentSection || seenSections.has(sNum)) {
        errors.push({
          code: "heading-order",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Section heading s${sNum} is out of order (current was s${currentSection}).`,
          repair: "Ensure section numbers increase monotonically.",
          excerpt: truncateExcerpt(rawLine),
        });
      }
      currentSection = sNum;
      seenSections.add(sNum);
      continue;
    }

    const partMatch = rawLine.match(/^\[\[PART-HEADING\s+part-(\d+)\]\]\s*([\s\S]*)$/);
    if (partMatch?.[1]) {
      endParagraph();
      totalHeadings++;
      const pNum = Number.parseInt(partMatch[1], 10);
      if (pNum <= currentPart || seenParts.has(pNum)) {
        errors.push({
          code: "heading-order",
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Part heading part-${pNum} is out of order (current was part-${currentPart}).`,
          repair: "Ensure part heading numbers increase monotonically and precede their sections.",
          excerpt: truncateExcerpt(rawLine),
        });
      }
      currentPart = pNum;
      seenParts.add(pNum);
      continue;
    }

    const fnTextMatch = rawLine.match(/^\[\[FN\s+([\s\S]*?)\]\]\s*([\s\S]*)$/);
    if (fnTextMatch?.[1]) {
      endParagraph();
      const fnLabel = fnTextMatch[1].trim();
      totalFootnotes++;
      pageFootnotesCount.set(
        currentLedgerPage,
        (pageFootnotesCount.get(currentLedgerPage) ?? 0) + 1,
      );
      const pageTexts = pageFnTexts.get(currentLedgerPage) ?? [];
      pageTexts.push({ label: fnLabel, line: lineNumber });
      pageFnTexts.set(currentLedgerPage, pageTexts);
    }

    if (rawLine.includes("[[FN-CONTINUES]]")) {
      pageFnContinues.set(currentLedgerPage, lineNumber);
    }

    const fnContMatch = rawLine.match(/^\[\[FN-CONT\s+([\s\S]*?)\]\]\s*([\s\S]*)$/);
    if (fnContMatch?.[1]) {
      endParagraph();
      const fnLabel = fnContMatch[1].trim();
      totalFootnotes++;
      pageFootnotesCount.set(
        currentLedgerPage,
        (pageFootnotesCount.get(currentLedgerPage) ?? 0) + 1,
      );
      const pageConts = pageFnConts.get(currentLedgerPage) ?? [];
      pageConts.push({ label: fnLabel, line: lineNumber });
      pageFnConts.set(currentLedgerPage, pageConts);
    }

    // Continues
    if (rawLine.includes("[[CONTINUES]]")) {
      pageContinues.set(currentLedgerPage, { line: lineNumber, textAfterCount: 0 });
      if (trimmed === "[[CONTINUES]]") {
        endParagraph();
        continue;
      }
    }

    // Closings
    if (rawLine.includes("[[DATELINE]]")) {
      seenClosings.add("dateline");
      totalClosings++;
    }
    if (rawLine.includes("[[ACK]]")) {
      seenClosings.add("ack");
      totalClosings++;
    }
    if (rawLine.includes("[[RECEIVED]]")) {
      seenClosings.add("received");
      totalClosings++;
    }

    // Masthead
    if (rawLine.includes("[[TITLE]]")) hasTitle = true;
    if (rawLine.includes("[[AUTHOR]]")) hasAuthor = true;

    // Track text line on page
    if (trimmed.startsWith("[[FN")) inFootnoteBlock = true;
    const isSpecialLine =
      trimmed.startsWith("[[FN") ||
      trimmed.startsWith("[[OTHER-ARTICLE-OMITTED") ||
      trimmed.startsWith("[[DATELINE") ||
      trimmed.startsWith("[[ACK") ||
      trimmed.startsWith("[[RECEIVED");

    if (!isSpecialLine) {
      pageBodyLineCount.set(currentLedgerPage, (pageBodyLineCount.get(currentLedgerPage) ?? 0) + 1);

      // Check if this body line is after [[CONTINUES]] on the same page
      const pCont = pageContinues.get(currentLedgerPage);
      if (pCont && lineNumber > pCont.line && !inFootnoteBlock) {
        pCont.textAfterCount++;
      }

      if (!inParagraph) {
        inParagraph = true;
        currentParaStartLine = lineNumber;
        pageParagraphsStarting.set(
          currentLedgerPage,
          (pageParagraphsStarting.get(currentLedgerPage) ?? 0) + 1,
        );
      }
      const wordsInLine = trimmed.split(/\s+/).filter(Boolean).length;
      currentParaWordCount += wordsInLine;
      currentParaLines.push({ lineNum: lineNumber, words: wordsInLine });
    }

    // Emphasis matching
    const empRegex = /\[\[(\/?(?:SPERR|EM))\]\]/g;
    let empMatch: RegExpExecArray | null;
    while (true) {
      empMatch = empRegex.exec(rawLine);
      if (!empMatch) break;
      const tag = empMatch[1];
      if (tag === "SPERR" || tag === "EM") {
        if (openEmphasis.length > 0) {
          errors.push({
            code: "nested-emphasis",
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: currentPrintedPage,
            message: `Nested emphasis tag [[${tag}]] inside [[${openEmphasis[openEmphasis.length - 1]?.tag}]].`,
            repair: "Remove nesting; emphasis tags may not nest.",
            excerpt: truncateExcerpt(rawLine),
          });
        }
        openEmphasis.push({ tag, line: lineNumber });
      } else if (tag === "/SPERR" || tag === "/EM") {
        const expectedOpen = tag.slice(1);
        const last = openEmphasis.pop();
        if (!last || last.tag !== expectedOpen) {
          errors.push({
            code: "unclosed-tag",
            severity: "error",
            ledgerLine: lineNumber,
            ledgerPage: currentLedgerPage,
            pdfPageIndex: currentPdfPageIndex,
            printedPage: currentPrintedPage,
            message: `Closing tag [[${tag}]] without matching opening tag.`,
            repair: `Add matching [[${expectedOpen}]] or remove closing tag.`,
            excerpt: truncateExcerpt(rawLine),
          });
        } else {
          totalEmphasisSpans++;
        }
      }
    }

    // Inline math validation & HTML outside math check
    let textWithoutMath = "";
    let lastIdx = 0;
    const mathRegex = /\$([^$]+)\$/g;
    let mMatch: RegExpExecArray | null;

    // Check for unbalanced single $
    const dollarCount = (rawLine.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
      errors.push({
        code: "math-unbalanced",
        severity: "error",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: "Unbalanced inline math delimiter ($) on line.",
        repair: "Ensure each inline math region is enclosed by a pair of dollar signs ($...$).",
        excerpt: truncateExcerpt(rawLine),
      });
    }

    while (true) {
      mMatch = mathRegex.exec(rawLine);
      if (!mMatch) {
        textWithoutMath += rawLine.slice(lastIdx);
        break;
      }
      textWithoutMath += rawLine.slice(lastIdx, mMatch.index);
      lastIdx = mathRegex.lastIndex;

      totalInlineMath++;
      pageInlineMathCount.set(
        currentLedgerPage,
        (pageInlineMathCount.get(currentLedgerPage) ?? 0) + 1,
      );

      const mathExpr = mMatch[1]?.trim() ?? "";
      const parsedMath = parseLedgerMath(mathExpr, false);
      if (!parsedMath.ok && parsedMath.code) {
        errors.push({
          code: parsedMath.code,
          severity: "error",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: parsedMath.error ?? "Failed to parse inline mathematics.",
          repair: "Correct LaTeX math syntax or wrap German words in \\text{...}.",
          excerpt: truncateExcerpt(mMatch[0]),
        });
      }
    }

    // HTML outside math check
    const htmlCheck = findHtmlOutsideMath(textWithoutMath);
    if (htmlCheck) {
      errors.push({
        code: "html-outside-math",
        severity: "error",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: `HTML-like tag "${htmlCheck.match}" detected outside mathematics.`,
        repair: "Remove HTML tags or escape '<' if not intentional.",
        excerpt: truncateExcerpt(textWithoutMath.slice(htmlCheck.index, htmlCheck.index + 20)),
      });
    }

    // Text warnings (executed on textWithoutMath)
    // 1. Spaced letters (e.g. W ä r m e) outside [[SPERR]]
    const textWithoutSperr = textWithoutMath.replace(/\[\[SPERR\]\][\s\S]*?\[\[\/SPERR\]\]/g, "");
    const spacedMatch = textWithoutSperr.match(
      /(?:^|\s)([a-zA-Z\u00C0-\u024F]\s[a-zA-Z\u00C0-\u024F]\s[a-zA-Z\u00C0-\u024F](?:\s[a-zA-Z\u00C0-\u024F])*)(?:\s|$)/,
    );
    if (spacedMatch?.[1]) {
      warnings.push({
        code: "spaced-letters",
        severity: "warning",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: `Spaced letter sequence "${spacedMatch[1]}" detected outside [[SPERR]] tags.`,
        repair: `Wrap in [[SPERR]]${spacedMatch[1].replace(/\s+/g, "")}[[/SPERR]].`,
        excerpt: truncateExcerpt(spacedMatch[1]),
      });
    }

    // 2. Modern spelling
    for (const item of resolvedConfig.modernSpellingList) {
      const wordRegex = new RegExp(`\\b${item.modern}\\b`, "i");
      if (wordRegex.test(textWithoutMath)) {
        warnings.push({
          code: "modern-spelling",
          severity: "warning",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Modern spelling "${item.modern}" detected; printed witness has "${item.period}" (${item.citation}).`,
          repair: `Use printed spelling "${item.period}".`,
          excerpt: truncateExcerpt(rawLine),
        });
      }
    }

    // 3. Running head like
    for (const pattern of resolvedConfig.runningHeadPatterns) {
      if (new RegExp(pattern).test(trimmed)) {
        warnings.push({
          code: "running-head-like",
          severity: "warning",
          ledgerLine: lineNumber,
          ledgerPage: currentLedgerPage,
          pdfPageIndex: currentPdfPageIndex,
          printedPage: currentPrintedPage,
          message: `Line resembles a printed running head: "${trimmed}".`,
          repair: "Remove running head; running heads belong in the receipt pageMap.",
          excerpt: truncateExcerpt(rawLine),
        });
      }
    }

    // 4. Digit-letter confusion
    const digitLetterMatch = textWithoutMath.match(/\b(?:\d+[lO]|[lO]\d+|\d+[lO]\d+)\b/);
    if (digitLetterMatch) {
      warnings.push({
        code: "digit-letter-confusion",
        severity: "warning",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: `Digit-letter confusion pattern "${digitLetterMatch[0]}" detected in prose.`,
        repair: "Check whether letter l/O should be numeral 1/0 or vice versa.",
        excerpt: truncateExcerpt(digitLetterMatch[0]),
      });
    }

    // 5. ASCII straight quotes
    if (textWithoutMath.includes('"') || textWithoutMath.includes("'")) {
      warnings.push({
        code: "ascii-quote",
        severity: "warning",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: "Straight ASCII quotation marks detected outside mathematics.",
        repair: "Use German typographical quotes („ and “) as printed.",
        excerpt: truncateExcerpt(rawLine),
      });
    }

    // 6. Double space
    if (/\S\s{2,}\S/.test(rawLine)) {
      warnings.push({
        code: "double-space",
        severity: "warning",
        ledgerLine: lineNumber,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: "Consecutive space characters detected in text.",
        repair: "Replace multiple spaces with a single space.",
        excerpt: truncateExcerpt(rawLine),
      });
    }
  }

  // End any remaining paragraph
  endParagraph();

  // 9. Post-Document Consistency Checks

  // Check unclosed emphasis tags
  if (openEmphasis.length > 0) {
    const last = openEmphasis[openEmphasis.length - 1];
    if (last) {
      errors.push({
        code: "unclosed-tag",
        severity: "error",
        ledgerLine: last.line,
        ledgerPage: currentLedgerPage,
        pdfPageIndex: currentPdfPageIndex,
        printedPage: currentPrintedPage,
        message: `Unclosed [[${last.tag}]] tag at end of document.`,
        repair: `Close tag with [[/${last.tag}]].`,
        excerpt: `[[${last.tag}]]`,
      });
    }
  }

  // Check footnote mark / text pairing
  for (let p = 1; p <= expectedTotalPages; p++) {
    const marks = pageFnMarks.get(p) ?? [];
    const texts = pageFnTexts.get(p) ?? [];
    const conts = pageFnConts.get(p) ?? [];
    const mapping = getPageMapping(p);

    // Every mark on page must have corresponding text on the same page
    for (const m of marks) {
      const hasText = texts.some((t) => t.label === m.label);
      if (!hasText) {
        errors.push({
          code: "fn-mark-orphan",
          severity: "error",
          ledgerLine: m.line,
          ledgerPage: p,
          pdfPageIndex: mapping.pdfPageIndex,
          printedPage: mapping.printedPage,
          message: `Footnote mark [[FN-MARK ${m.label}]] has no corresponding [[FN ${m.label}]] text on page ${p}.`,
          repair: `Add [[FN ${m.label}]] footnote text at the foot of page ${p}.`,
          excerpt: `[[FN-MARK ${m.label}]]`,
        });
      }
    }

    // Every text on page must have corresponding mark on the same page (or be continuation)
    for (const t of texts) {
      const hasMark = marks.some((m) => m.label === t.label);
      if (!hasMark) {
        errors.push({
          code: "fn-text-orphan",
          severity: "error",
          ledgerLine: t.line,
          ledgerPage: p,
          pdfPageIndex: mapping.pdfPageIndex,
          printedPage: mapping.printedPage,
          message: `Footnote text [[FN ${t.label}]] has no corresponding [[FN-MARK ${t.label}]] mark on page ${p}.`,
          repair: `Add [[FN-MARK ${t.label}]] at the reference in body text or remove orphan footnote.`,
          excerpt: `[[FN ${t.label}]]`,
        });
      }
    }

    // Continuation checks
    const hasContinues = pageFnContinues.has(p);
    const nextConts = pageFnConts.get(p + 1) ?? [];
    if (hasContinues && nextConts.length === 0) {
      const line = pageFnContinues.get(p) ?? 1;
      errors.push({
        code: "fn-continuation-orphan",
        severity: "error",
        ledgerLine: line,
        ledgerPage: p,
        pdfPageIndex: mapping.pdfPageIndex,
        printedPage: mapping.printedPage,
        message: `Footnote [[FN-CONTINUES]] on page ${p} is not continued with [[FN-CONT]] on page ${p + 1}.`,
        repair: `Add [[FN-CONT <label>]] at the foot of page ${p + 1}.`,
        excerpt: "[[FN-CONTINUES]]",
      });
    }

    if (conts.length > 0 && !pageFnContinues.has(p - 1)) {
      const firstCont = conts[0];
      if (firstCont) {
        errors.push({
          code: "fn-continuation-orphan",
          severity: "error",
          ledgerLine: firstCont.line,
          ledgerPage: p,
          pdfPageIndex: mapping.pdfPageIndex,
          printedPage: mapping.printedPage,
          message: `Footnote [[FN-CONT ${firstCont.label}]] on page ${p} has no preceding [[FN-CONTINUES]] on page ${p - 1}.`,
          repair: `Add [[FN-CONTINUES]] at the foot of page ${p - 1} or change tag to [[FN ${firstCont.label}]].`,
          excerpt: `[[FN-CONT ${firstCont.label}]]`,
        });
      }
    }
  }

  // Check CONTINUES tag orphan / mid-page
  for (const [p, cInfo] of pageContinues.entries()) {
    const mapping = getPageMapping(p);
    if (p === expectedTotalPages) {
      errors.push({
        code: "continues-orphan",
        severity: "error",
        ledgerLine: cInfo.line,
        ledgerPage: p,
        pdfPageIndex: mapping.pdfPageIndex,
        printedPage: mapping.printedPage,
        message: `[[CONTINUES]] tag occurs on the final page (${p}) of the ledger.`,
        repair: "Remove [[CONTINUES]] from the last page.",
        excerpt: "[[CONTINUES]]",
      });
    } else if (cInfo.textAfterCount > 0) {
      errors.push({
        code: "continues-orphan",
        severity: "error",
        ledgerLine: cInfo.line,
        ledgerPage: p,
        pdfPageIndex: mapping.pdfPageIndex,
        printedPage: mapping.printedPage,
        message: `[[CONTINUES]] occurs mid-page with ${cInfo.textAfterCount} body lines following it.`,
        repair: "Move [[CONTINUES]] to the very end of the page body before page break.",
        excerpt: "[[CONTINUES]]",
      });
    }
  }

  // Check equation labels repeating across sections
  const repeatedEquationLabels: string[] = [];
  for (const [lbl, secs] of allEqLabels.entries()) {
    if (secs.size > 1) {
      repeatedEquationLabels.push(lbl);
      info.push({
        code: "eq-label-repeats-across-sections",
        severity: "info",
        ledgerLine: 1,
        ledgerPage: 1,
        pdfPageIndex: null,
        printedPage: null,
        message: `Equation label "${lbl}" is repeated across sections [${Array.from(secs)
          .map((s) => `s${s}`)
          .join(", ")}]. Section-qualified ids must be used.`,
        excerpt: lbl,
      });
    }
  }

  // Check per-page emptiness / skeleton
  let skeletonPagesCount = 0;
  const perPageStats: PageStat[] = [];

  for (let p = 1; p <= expectedTotalPages; p++) {
    const mapping = getPageMapping(p);
    const bodyLines = pageBodyLineCount.get(p) ?? 0;
    const fnCount = pageFootnotesCount.get(p) ?? 0;
    const isSkeleton = bodyLines === 0 && fnCount === 0;

    if (isSkeleton) {
      skeletonPagesCount++;
      if (mode === "completeness") {
        errors.push({
          code: "page-empty",
          severity: "error",
          ledgerLine: 1,
          ledgerPage: p,
          pdfPageIndex: mapping.pdfPageIndex,
          printedPage: mapping.printedPage,
          message: `Page ${p} has no body or footnote content in completeness mode.`,
          repair: "Transcribe text for page or switch receipt ledgerStatus to in-progress.",
          excerpt: `Page ${p}`,
        });
      } else {
        info.push({
          code: "skeleton-page",
          severity: "info",
          ledgerLine: 1,
          ledgerPage: p,
          pdfPageIndex: mapping.pdfPageIndex,
          printedPage: mapping.printedPage,
          message: `Page ${p} is a skeleton page with markers only.`,
          excerpt: `Page ${p}`,
        });
      }
    }

    perPageStats.push({
      ledgerPage: p,
      printedPage: mapping.printedPage,
      paragraphsStarting: pageParagraphsStarting.get(p) ?? 0,
      displayEquations: pageDisplayEquationCount.get(p) ?? 0,
      footnotes: fnCount,
      inlineMathRegions: pageInlineMathCount.get(p) ?? 0,
    });
  }

  // Completeness mode: Masthead check
  if (mode === "completeness") {
    // If first page contents in pageMap includes "masthead" or not scoped
    const isFullArticle =
      !Array.isArray(ledgerScopePages) ||
      ledgerScopePages.length === 0 ||
      (pageMap[0]?.contents ?? []).includes("masthead");

    if (isFullArticle && (!hasTitle || !hasAuthor)) {
      errors.push({
        code: "masthead-missing",
        severity: "error",
        ledgerLine: 1,
        ledgerPage: 1,
        pdfPageIndex: 1,
        printedPage: pageMap[0]?.printedPage ?? null,
        message: "Page 1 of full-article ledger is missing [[TITLE]] or [[AUTHOR]] tags.",
        repair: "Add [[TITLE]]...[[/TITLE]] and [[AUTHOR]]...[[/AUTHOR]] to page 1.",
        excerpt: "Masthead tags missing",
      });
    }

    // Completeness mode: Closings check
    for (const expected of resolvedConfig.expectedClosings) {
      if (!seenClosings.has(expected)) {
        errors.push({
          code: "closing-missing",
          severity: "error",
          ledgerLine: lines.length,
          ledgerPage: expectedTotalPages,
          pdfPageIndex: getPageMapping(expectedTotalPages).pdfPageIndex,
          printedPage: getPageMapping(expectedTotalPages).printedPage,
          message: `Expected closing "[[${expected.toUpperCase()}]]" is absent in completeness mode.`,
          repair: `Add [[${expected.toUpperCase()}]] closing or update expectedClosings in ledger-config.yaml.`,
          excerpt: expected,
        });
      }
    }
  }

  // 10. Allowlist Matching & Stale Entries
  const matchedEntries = new Set<AllowlistEntry>();
  for (const warning of warnings) {
    const lineText = lines[warning.ledgerLine - 1] ?? "";
    const fingerprint = computeLineFingerprint(lineText);

    const match = activeAllowlistEntries.find(
      (e) =>
        e.ledgerKey === ledgerKey &&
        e.code === warning.code &&
        e.ledgerPage === warning.ledgerPage &&
        e.lineFingerprint === fingerprint,
    );

    if (match) {
      warning.acknowledged = true;
      warning.allowlistEntry = match;
      matchedEntries.add(match);
    }
  }

  const staleAllowlistEntries: StaleAllowlistEntry[] = [];
  for (const entry of activeAllowlistEntries) {
    if (!matchedEntries.has(entry)) {
      staleAllowlistEntries.push({
        ...entry,
        staleReason: `Allowlist entry for code "${entry.code}" on page ${entry.ledgerPage} matched no emitted warning.`,
      });
    }
  }

  const valid = errors.length === 0;
  const unacknowledgedWarnings = warnings.filter((w) => !w.acknowledged);
  const clean = valid && unacknowledgedWarnings.length === 0 && staleAllowlistEntries.length === 0;

  const stats: LedgerStats = {
    pages: expectedTotalPages,
    skeletonPages: skeletonPagesCount,
    headings: totalHeadings,
    paragraphs: totalParagraphs,
    displayEquations: totalDisplayEquations,
    inlineMathRegions: totalInlineMath,
    footnotes: totalFootnotes,
    closings: totalClosings,
    emphasisSpans: totalEmphasisSpans,
    perPage: perPageStats,
    repeatedEquationLabels,
  };

  return {
    valid,
    clean,
    mode,
    ledgerStatus,
    ledgerKey,
    ledgerSha256: computedLedgerSha256,
    sourceAssetSha256,
    configSection: resolvedConfig.configSection,
    errors,
    warnings,
    info,
    staleAllowlistEntries,
    stats,
  };
}
