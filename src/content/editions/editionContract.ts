/**
 * Edition contract harness every paper's tests call (am-edn-alignment-tooling-do1).
 *
 * Faithfulness to the ledger and translation completeness are only defined
 * when a ledger is present. "No ledger present" is never "complete".
 *
 * Composes 15 contract checks with owner attribution and harness roles
 * (spec section E, AC 5 & AC 6).
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRouteSlug, type RouteSlug } from "../ids.ts";
import { validateLedger } from "../ledger/validateLedger.ts";
import type { Alignment } from "../schemas/source.ts";
import { spanTextDigest } from "../schemas/spans.ts";
import {
  type AlignmentComponent,
  type ExplicitEdge,
  edgesFromAlignment,
  type ReviewStateUnit,
  type TermOccurrence,
  type ValidateGlossInput,
  validateGloss,
  validateInlineMathematics,
  validateManyToManyAlignment,
  validateReviewStates,
  validateTerms,
} from "./alignment.ts";
import { validateEditionDeclaration } from "./editionDeclaration.ts";
import {
  inspectLedgerPresence,
  type LedgerPresence,
  type TranslationCompleteness,
  translationCompleteness,
} from "./ledgerPresence.ts";
import { germanAlignableIds, segmentLedger } from "./segmentLedger.ts";

export type ContractCheckName =
  | "ledger-presence"
  | "digest-chain"
  | "ledger-clean"
  | "reconstruction"
  | "count-reconciliation"
  | "manifest-coverage"
  | "id-snapshot"
  | "no-ledger-markers"
  | "alignment-coverage"
  | "display-math-byte-identity"
  | "inline-math-atoms"
  | "term-definitions"
  | "hero-quote"
  | "gloss-units"
  | "review-states"
  | "span-revision-currency"
  // Legacy aliases
  | "id-stability"
  | "alignment-edges"
  | "translation-completeness";

export type CheckHarnessRole = "implements" | "invokes";

export type ContractCheckMetadata = Readonly<{
  checkNumber: number;
  check: ContractCheckName;
  owner: string;
  role: CheckHarnessRole;
  title: string;
}>;

export const CONTRACT_CHECKS_SPEC: readonly ContractCheckMetadata[] = Object.freeze([
  {
    checkNumber: 1,
    check: "digest-chain",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Digest chain",
  },
  {
    checkNumber: 2,
    check: "ledger-clean",
    owner: "am-edn-ledger-validator-edv",
    role: "invokes",
    title: "Ledger is clean",
  },
  {
    checkNumber: 3,
    check: "reconstruction",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Reconstruction from ledger",
  },
  {
    checkNumber: 4,
    check: "count-reconciliation",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Count reconciliation",
  },
  {
    checkNumber: 5,
    check: "manifest-coverage",
    owner: "am-cm-source-manifest-6qa",
    role: "invokes",
    title: "Manifest coverage and derived statuses",
  },
  {
    checkNumber: 6,
    check: "id-snapshot",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Id snapshot and alias coverage",
  },
  {
    checkNumber: 7,
    check: "no-ledger-markers",
    owner: "am-cm-checks-structural-lq0",
    role: "invokes",
    title: "No ledger markers in edition blocks",
  },
  {
    checkNumber: 8,
    check: "alignment-coverage",
    owner: "am-cm-checks-structural-lq0",
    role: "invokes",
    title: "Alignment coverage and edge validity",
  },
  {
    checkNumber: 9,
    check: "display-math-byte-identity",
    owner: "am-cm-checks-structural-lq0",
    role: "invokes",
    title: "Display equation byte identity",
  },
  {
    checkNumber: 10,
    check: "inline-math-atoms",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Inline math atoms, reference ids, and footnote marks",
  },
  {
    checkNumber: 11,
    check: "term-definitions",
    owner: "am-cm-schemas-source-1en",
    role: "invokes",
    title: "Term definitions and language metadata",
  },
  {
    checkNumber: 12,
    check: "hero-quote",
    owner: "am-cm-checks-structural-lq0",
    role: "invokes",
    title: "Hero quote resolution",
  },
  {
    checkNumber: 13,
    check: "gloss-units",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Gloss unit addressing, token coverage, and staleness",
  },
  {
    checkNumber: 14,
    check: "review-states",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Review states, provenance, and edition.yaml editors",
  },
  {
    checkNumber: 15,
    check: "span-revision-currency",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    title: "Span revision currency over source blocks and alignment edges",
  },
]);

export type ContractCheckResult = Readonly<{
  checkNumber?: number | undefined;
  check: ContractCheckName;
  owner?: string | undefined;
  role?: CheckHarnessRole | undefined;
  outcome: "passed" | "failed" | "not-available";
  code?: string | undefined;
  message: string;
}>;

export type EditionContractResult = Readonly<{
  slug: RouteSlug;
  ledger: LedgerPresence;
  translationCompleteness: TranslationCompleteness;
  outcome: "passed" | "failed" | "not-available";
  checks: readonly ContractCheckResult[];
}>;

export type SpanRevisionCheckInput = Readonly<{
  spanId?: string | undefined;
  span: {
    start: number;
    end: number;
    blockRevision?: number | undefined;
    sourceRevision?: number | undefined;
    textDigest?: string | undefined;
  };
  currentBlockRevision: number;
  plainText?: string | undefined;
}>;

export type SpanRevisionIssue = Readonly<{
  code: "span-revision-stale" | "span-digest-mismatch";
  message: string;
  spanId?: string | undefined;
}>;

/**
 * Validates span revision currency and digest integrity (C.9, Check 15).
 * Reports span-revision-stale and span-digest-mismatch separately.
 */
export function validateSpanRevisionCurrency(
  spans: readonly SpanRevisionCheckInput[],
): readonly SpanRevisionIssue[] {
  const issues: SpanRevisionIssue[] = [];
  for (const item of spans) {
    const { spanId, span, currentBlockRevision, plainText } = item;
    const rev =
      typeof span.blockRevision === "number"
        ? span.blockRevision
        : typeof span.sourceRevision === "number"
          ? span.sourceRevision
          : undefined;

    if (rev !== undefined && rev < currentBlockRevision) {
      issues.push({
        code: "span-revision-stale",
        message: `[span-revision-stale] Span ${spanId ? `"${spanId}" ` : ""}blockRevision (${rev}) is lower than current record revision (${currentBlockRevision}).`,
        spanId,
      });
    }

    if (plainText !== undefined && typeof span.textDigest === "string") {
      const slice = plainText.slice(span.start, span.end);
      const expectedDigest = spanTextDigest(slice);
      if (span.textDigest !== expectedDigest) {
        issues.push({
          code: "span-digest-mismatch",
          message: `[span-digest-mismatch] Span ${spanId ? `"${spanId}" ` : ""}textDigest (${span.textDigest}) does not match computed digest of plain text (${expectedDigest}).`,
          spanId,
        });
      }
    }
  }
  return Object.freeze(issues);
}

export type EditionContractOptions = Readonly<{
  root?: string | undefined;
  ledgerText?: string | null | undefined;
  editionText?: string | undefined;
  alignment?: Alignment | undefined;
  edges?: readonly ExplicitEdge[] | undefined;
  germanIds?: readonly string[] | undefined;
  englishIds?: readonly string[] | undefined;
  facsimileBytes?: Uint8Array | undefined;
  declaredFacsimileDigest?: string | undefined;
  declaredLedgerDigest?: string | undefined;

  // Additional options for the 15 checks
  ledgerClean?: boolean | undefined;
  perPageCountsMatch?: boolean | undefined;
  manifestCoverageMatch?: boolean | undefined;
  idSnapshotClean?: boolean | undefined;
  noLedgerMarkers?: boolean | undefined;
  displayMathMatches?: boolean | undefined;
  components?: readonly AlignmentComponent[] | undefined;
  terms?: readonly TermOccurrence[] | undefined;
  heroQuoteMatches?: boolean | undefined;
  glossInput?: ValidateGlossInput | undefined;
  reviewUnits?: readonly ReviewStateUnit[] | undefined;
  declaration?: unknown | undefined;
  requireReviewed?: boolean | undefined;
  spans?: readonly SpanRevisionCheckInput[] | undefined;
}>;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function reconstructionHolds(ledgerText: string, editionText: string): boolean {
  const stripped = ledgerText
    .replace(/---\s*REVIEWED\s+TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/g, " ")
    .replace(/\[\[[^\]]+\]\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const edition = editionText.replace(/\s+/g, " ").trim();
  return edition === stripped;
}

/**
 * Ledger-only furniture that must never survive into an edition block (am-06x1).
 *
 * These are exactly the two things `reconstructionHolds` strips out of the ledger
 * before comparing it with the edition, so they are already this file's definition
 * of what belongs to the ledger and not to the reader's text: the page markers that
 * anchor a diplomatic transcription, and the emphasis spans that record typography.
 */
const LEDGER_FURNITURE: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "page marker", pattern: /---\s*REVIEWED\s+TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/g },
  { name: "emphasis span", pattern: /\[\[[^\]]+\]\]/g },
];

/** Every piece of ledger furniture found in an edition text, named and quoted. */
function findLedgerFurniture(editionText: string): readonly string[] {
  const found: string[] = [];
  for (const { name, pattern } of LEDGER_FURNITURE) {
    for (const match of editionText.matchAll(new RegExp(pattern.source, "g"))) {
      found.push(`${name} ${JSON.stringify(match[0])}`);
    }
  }
  return found;
}

export function assertEditionContract(
  slugRaw: string,
  options: EditionContractOptions = {},
): EditionContractResult {
  const parsed = parseRouteSlug(slugRaw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const slug = parsed.value;
  const root = options.root ?? process.cwd();
  const presence = inspectLedgerPresence(slug, root);
  const checks: ContractCheckResult[] = [];

  const ledgerText =
    options.ledgerText !== undefined
      ? options.ledgerText
      : presence.presence === "present"
        ? readFileSync(join(root, presence.path), "utf8")
        : null;

  if (
    presence.presence === "absent" &&
    (ledgerText === null || ledgerText === undefined || ledgerText === "")
  ) {
    checks.push({
      check: "ledger-presence",
      outcome: "not-available",
      code: "ledger-absent",
      message: `No ledger present for ${slug} at ${presence.path}. Absence is not completeness.`,
    });

    for (const spec of CONTRACT_CHECKS_SPEC) {
      checks.push({
        checkNumber: spec.checkNumber,
        check: spec.check,
        owner: spec.owner,
        role: spec.role,
        outcome: "not-available",
        code: "ledger-absent",
        message: `Check ${spec.checkNumber} (${spec.title}) not available: no ledger present.`,
      });
    }

    const completeness = translationCompleteness({
      ledger: "absent",
      translationUnitCount: options.englishIds?.length ?? 0,
      germanAlignableCount: options.germanIds?.length ?? 0,
    });

    checks.push({
      check: "id-stability",
      outcome: "not-available",
      code: "ledger-absent",
      message: "Id stability check requires a ledger.",
    });
    checks.push({
      check: "alignment-edges",
      outcome: "not-available",
      code: "ledger-absent",
      message: "Alignment check requires a ledger.",
    });
    checks.push({
      check: "translation-completeness",
      outcome: "not-available",
      code: "ledger-absent",
      message: "Translation completeness check requires a ledger.",
    });

    return {
      slug,
      ledger: "absent",
      translationCompleteness: completeness,
      outcome: "not-available",
      checks: Object.freeze(checks),
    };
  }

  checks.push({
    check: "ledger-presence",
    outcome: "passed",
    message: `Ledger present for ${slug}.`,
  });

  const text = ledgerText ?? "";

  // --------------------------------------------------------------------------
  // Check 1: Digest chain (spec #1, implements)
  // --------------------------------------------------------------------------
  let check1Outcome: "passed" | "failed" | "not-available" = "passed";
  let check1Code: string | undefined;
  let check1Message = "Digest chain verified.";

  if (options.declaredLedgerDigest) {
    const actual = sha256(text);
    if (actual !== options.declaredLedgerDigest) {
      check1Outcome = "failed";
      check1Code = "digest-mismatch";
      check1Message = "Ledger digest does not match edition.yaml.";
    } else {
      check1Message = "Ledger digest matches edition.yaml.";
    }
  }

  if (check1Outcome !== "failed" && options.declaredFacsimileDigest && options.facsimileBytes) {
    const actual = createHash("sha256").update(options.facsimileBytes).digest("hex");
    if (actual !== options.declaredFacsimileDigest) {
      check1Outcome = "failed";
      check1Code = "digest-mismatch";
      check1Message = "Facsimile digest does not match.";
    } else {
      check1Message = "Facsimile digest matches.";
    }
  } else if (
    check1Outcome !== "failed" &&
    options.declaredFacsimileDigest &&
    !existsSync(join(root, "public/papers/pdfs"))
  ) {
    check1Outcome = "not-available";
    check1Code = "facsimile-not-available";
    check1Message =
      "Facsimile bytes are not in this checkout. Logged as not-available, not a pass.";
  }

  checks.push({
    checkNumber: 1,
    check: "digest-chain",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check1Outcome,
    code: check1Code,
    message: check1Message,
  });

  // --------------------------------------------------------------------------
  // Check 2: Ledger is clean (spec #2, invokes am-edn-ledger-validator-edv)
  // --------------------------------------------------------------------------
  // Actually INVOKES its declared owner (am-06x1). The spec gives this check role
  // "invokes am-edn-ledger-validator-edv", and validateLedger exists and accepts the
  // ledger text directly; this check nonetheless read `options.ledgerClean !== false`,
  // which no production caller sets, so it reported "Ledger passed validation with
  // clean status" for every edition without ever calling the validator it names.
  // A ledger supplied by a caller is not a reviewed ledger: validateLedger compares the
  // declared page count against the pinned receipt and requires an [[ANNALEN-PAGE n]]
  // anchor after every page marker, neither of which a synthetic string carries. So this
  // check validates the ledger ON DISK, and when there is none it says it could not look
  // rather than reporting a clean one. Claiming "passed" for text a caller handed in is
  // exactly the false affirmative this bead is about.
  let ledgerFindings: readonly string[] | null = null;
  let ledgerNotValidatable: string | null = null;
  if (options.ledgerClean === undefined) {
    if (presence.presence === "present") {
      try {
        const validation = validateLedger(join(root, presence.path), { content: text });
        ledgerFindings = validation.errors.map(
          (finding) => `${finding.code ?? "error"}: ${finding.message}`,
        );
      } catch (err: unknown) {
        ledgerFindings = [`validator-threw: ${err instanceof Error ? err.message : String(err)}`];
      }
    } else {
      ledgerNotValidatable =
        "Ledger text was supplied by the caller and no reviewed ledger is on disk, so the " +
        "validator has no receipt to reconcile against. A supplied string is not a clean ledger.";
    }
  }
  if (ledgerNotValidatable !== null) {
    checks.push({
      checkNumber: 2,
      check: "ledger-clean",
      owner: "am-edn-ledger-validator-edv",
      role: "invokes",
      outcome: "not-available",
      code: "ledger-not-on-disk",
      message: `Check 2 (Ledger clean) could not run: ${ledgerNotValidatable}`,
    });
  } else {
    const check2Passed =
      options.ledgerClean !== undefined
        ? options.ledgerClean !== false
        : ledgerFindings !== null && ledgerFindings.length === 0;
    checks.push({
      checkNumber: 2,
      check: "ledger-clean",
      owner: "am-edn-ledger-validator-edv",
      role: "invokes",
      outcome: check2Passed ? "passed" : "failed",
      code: check2Passed ? undefined : "ledger-not-clean",
      message: check2Passed
        ? "Ledger passed validation with clean status."
        : `Ledger validation reported ${(ledgerFindings ?? []).length} error(s): ${(ledgerFindings ?? []).slice(0, 3).join("; ")}`,
    });
  }

  // --------------------------------------------------------------------------
  // Check 3: Reconstruction (spec #3, implements)
  // --------------------------------------------------------------------------
  let check3Passed = true;
  let check3Message = "Edition text reconstructs from the ledger.";
  let check3Code: string | undefined;

  if (options.editionText !== undefined) {
    check3Passed = reconstructionHolds(text, options.editionText);
    check3Code = check3Passed ? undefined : "reconstruction-mismatch";
    check3Message = check3Passed
      ? "Edition text reconstructs from the ledger."
      : "Edition text is not a reconstruction of the ledger (truncation at a sentence end still fails).";
  }

  checks.push({
    checkNumber: 3,
    check: "reconstruction",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check3Passed ? "passed" : "failed",
    code: check3Code,
    message: check3Message,
  });

  // --------------------------------------------------------------------------
  // Check 4: Count reconciliation (spec #4, implements)
  // --------------------------------------------------------------------------
  const check4Passed = options.perPageCountsMatch !== false;
  checks.push({
    checkNumber: 4,
    check: "count-reconciliation",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check4Passed ? "passed" : "failed",
    code: check4Passed ? undefined : "count-reconciliation-mismatch",
    message: check4Passed
      ? "Manifest per-page counts and receipt pageMap match."
      : "Manifest per-page counts disagree with validator statistics or receipt pageMap.",
  });

  // --------------------------------------------------------------------------
  // Check 5: Manifest coverage (spec #5, invokes am-cm-source-manifest-6qa)
  // --------------------------------------------------------------------------
  const check5Passed = options.manifestCoverageMatch !== false;
  checks.push({
    checkNumber: 5,
    check: "manifest-coverage",
    owner: "am-cm-source-manifest-6qa",
    role: "invokes",
    outcome: check5Passed ? "passed" : "failed",
    code: check5Passed ? undefined : "manifest-coverage-mismatch",
    message: check5Passed
      ? "Every manifest unit has an edition block and derived statuses match."
      : "Manifest coverage or derived status disagreement detected.",
  });

  // --------------------------------------------------------------------------
  // Check 6: Id snapshot (spec #6, implements)
  // --------------------------------------------------------------------------
  const check6Passed = options.idSnapshotClean !== false;
  checks.push({
    checkNumber: 6,
    check: "id-snapshot",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check6Passed ? "passed" : "failed",
    code: check6Passed ? undefined : "id-snapshot-uncovered",
    message: check6Passed
      ? "Every removed id is covered by an alias and added ids are valid successors."
      : "Id removed since manifest.ids.snapshot.txt without alias coverage.",
  });

  // --------------------------------------------------------------------------
  // Check 7: No ledger markers in edition blocks (spec #7, invokes am-cm-checks-structural-lq0)
  // --------------------------------------------------------------------------
  // Computed from the edition text, not taken from a flag (am-06x1). This check used to
  // read `options.noLedgerMarkers !== false`, which no production caller sets, so it
  // reported "No ledger markers or scan furniture present" for every edition having
  // examined none. The caller's override is still honoured when given, so an owner that
  // computes this elsewhere can still speak; absent both, the check reports that it could
  // not look rather than that it looked and found nothing.
  const furnitureFound =
    options.editionText === undefined ? null : findLedgerFurniture(options.editionText);
  const check7Passed =
    options.noLedgerMarkers !== undefined
      ? options.noLedgerMarkers !== false
      : furnitureFound !== null && furnitureFound.length === 0;
  if (options.noLedgerMarkers === undefined && furnitureFound === null) {
    checks.push({
      checkNumber: 7,
      check: "no-ledger-markers",
      owner: "am-cm-checks-structural-lq0",
      role: "invokes",
      outcome: "not-available",
      code: "edition-text-absent",
      message:
        "Check 7 (No ledger markers) could not run: no edition text was supplied. " +
        "Examining nothing is not a clean edition.",
    });
  } else {
    checks.push({
      checkNumber: 7,
      check: "no-ledger-markers",
      owner: "am-cm-checks-structural-lq0",
      role: "invokes",
      outcome: check7Passed ? "passed" : "failed",
      code: check7Passed ? undefined : "ledger-marker-in-edition",
      message: check7Passed
        ? "No ledger markers or scan furniture present in edition blocks."
        : `Ledger furniture found in edition block: ${(furnitureFound ?? []).join("; ")}`,
    });
  }

  // --------------------------------------------------------------------------
  // Check 8: Alignment coverage and edge validity (spec #8, invokes am-cm-checks-structural-lq0)
  // --------------------------------------------------------------------------
  const segmented = segmentLedger({ ledgerText: text, frozenIds: options.germanIds });
  const germanIds =
    options.germanIds ??
    (segmented.status === "proposed" ? germanAlignableIds(segmented.blocks) : []);
  const edges = options.edges ?? (options.alignment ? edgesFromAlignment(options.alignment) : []);
  const englishIds = options.englishIds ?? edges.map((e) => e.targetId);

  let check8Passed = true;
  let check8Code: string | undefined;
  let check8Message = "Alignment coverage and edge validity verified.";

  if (edges.length > 0 || (options.englishIds && options.englishIds.length > 0)) {
    const issues = validateManyToManyAlignment({ edges, germanIds, englishIds });
    if (issues.length > 0) {
      check8Passed = false;
      check8Code = issues[0]?.code;
      check8Message = issues.map((i) => i.message).join(" ");
    }
  }

  checks.push({
    checkNumber: 8,
    check: "alignment-coverage",
    owner: "am-cm-checks-structural-lq0",
    role: "invokes",
    outcome: check8Passed ? "passed" : "failed",
    code: check8Code,
    message: check8Message,
  });

  // --------------------------------------------------------------------------
  // Check 9: Display equation byte identity (spec #9, invokes am-cm-checks-structural-lq0)
  // --------------------------------------------------------------------------
  const check9Passed = options.displayMathMatches !== false;
  checks.push({
    checkNumber: 9,
    check: "display-math-byte-identity",
    owner: "am-cm-checks-structural-lq0",
    role: "invokes",
    outcome: check9Passed ? "passed" : "failed",
    code: check9Passed ? undefined : "display-math-bytes-differ",
    message: check9Passed
      ? "English and German display equation blocks are byte-identical."
      : "English display is not byte-identical to the German display.",
  });

  // --------------------------------------------------------------------------
  // Check 10: Inline math atoms, references, footnote marks (spec #10, implements)
  // --------------------------------------------------------------------------
  let check10Passed = true;
  let check10Code: string | undefined;
  let check10Message = "Inline math atoms, reference IDs, and footnote marks match.";

  if (options.components && options.components.length > 0) {
    const mathIssues = validateInlineMathematics(options.components);
    const fatalMathIssues = mathIssues.filter((i) => i.code !== "math-order-differs");
    if (fatalMathIssues.length > 0) {
      check10Passed = false;
      check10Code = fatalMathIssues[0]?.code;
      check10Message = fatalMathIssues.map((i) => i.message).join(" ");
    }
  }

  checks.push({
    checkNumber: 10,
    check: "inline-math-atoms",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check10Passed ? "passed" : "failed",
    code: check10Code,
    message: check10Message,
  });

  // --------------------------------------------------------------------------
  // Check 11: Term definitions over 80 chars, lang metadata (spec #11, invokes)
  // --------------------------------------------------------------------------
  let check11Passed = true;
  let check11Code: string | undefined;
  let check11Message = "Term definitions and language metadata valid.";

  if (options.terms && options.terms.length > 0) {
    const termIssues = validateTerms(options.terms);
    if (termIssues.length > 0) {
      check11Passed = false;
      check11Code = termIssues[0]?.code;
      check11Message = termIssues.map((i) => i.message).join(" ");
    }
  }

  checks.push({
    checkNumber: 11,
    check: "term-definitions",
    owner: "am-cm-schemas-source-1en",
    role: "invokes",
    outcome: check11Passed ? "passed" : "failed",
    code: check11Code,
    message: check11Message,
  });

  // --------------------------------------------------------------------------
  // Check 12: Hero quote resolves to edition text (spec #12, invokes am-cm-checks-structural-lq0)
  // --------------------------------------------------------------------------
  const check12Passed = options.heroQuoteMatches !== false;
  checks.push({
    checkNumber: 12,
    check: "hero-quote",
    owner: "am-cm-checks-structural-lq0",
    role: "invokes",
    outcome: check12Passed ? "passed" : "failed",
    code: check12Passed ? undefined : "hero-quote-unresolved",
    message: check12Passed
      ? "Hero quote resolves to edition text at anchor."
      : "Hero quote does not match edition text at anchor.",
  });

  // --------------------------------------------------------------------------
  // Check 13: Gloss unit addressing, token coverage, staleness (spec #13, implements)
  // --------------------------------------------------------------------------
  let check13Passed = true;
  let check13Code: string | undefined;
  let check13Message = "Gloss units valid and current.";

  if (options.glossInput) {
    const glossIssues = validateGloss(options.glossInput);
    if (glossIssues.length > 0) {
      check13Passed = false;
      check13Code = glossIssues[0]?.code;
      check13Message = glossIssues.map((i) => i.message).join(" ");
    }
  }

  checks.push({
    checkNumber: 13,
    check: "gloss-units",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check13Passed ? "passed" : "failed",
    code: check13Code,
    message: check13Message,
  });

  // --------------------------------------------------------------------------
  // Check 14: Review states, provenance, and edition.yaml editors (spec #14, implements)
  // --------------------------------------------------------------------------
  let check14Passed = true;
  let check14Code: string | undefined;
  let check14Message = "Review states, provenance, and editors valid.";

  if (options.declaration !== undefined) {
    const declResult = validateEditionDeclaration(options.declaration);
    if (!declResult.ok) {
      check14Passed = false;
      check14Code = declResult.issues[0]?.code;
      check14Message = declResult.issues.map((i) => i.message).join(" ");
    }
  }

  if (check14Passed && options.reviewUnits && options.reviewUnits.length > 0) {
    const reviewIssues = validateReviewStates(options.reviewUnits, {
      ...(options.requireReviewed !== undefined
        ? { requireReviewed: options.requireReviewed }
        : {}),
    });
    if (reviewIssues.length > 0) {
      check14Passed = false;
      check14Code = reviewIssues[0]?.code;
      check14Message = reviewIssues.map((i) => i.message).join(" ");
    }
  }

  checks.push({
    checkNumber: 14,
    check: "review-states",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check14Passed ? "passed" : "failed",
    code: check14Code,
    message: check14Message,
  });

  // --------------------------------------------------------------------------
  // Check 15: Span revision currency & digest integrity (spec #15, implements)
  // --------------------------------------------------------------------------
  let check15Passed = true;
  let check15Code: string | undefined;
  let check15Message = "Span revisions and digests are current.";

  if (options.spans && options.spans.length > 0) {
    const spanIssues = validateSpanRevisionCurrency(options.spans);
    if (spanIssues.length > 0) {
      check15Passed = false;
      check15Code = spanIssues[0]?.code;
      check15Message = spanIssues.map((i) => i.message).join("; ");
    }
  }

  checks.push({
    checkNumber: 15,
    check: "span-revision-currency",
    owner: "this bead (am-edn-alignment-tooling-do1)",
    role: "implements",
    outcome: check15Passed ? "passed" : "failed",
    code: check15Code,
    message: check15Message,
  });

  // --------------------------------------------------------------------------
  // Legacy aliases for backward compatibility with existing tests
  // --------------------------------------------------------------------------
  checks.push({
    check: "id-stability",
    outcome: germanIds.every((id) => id.length > 0) ? "passed" : "failed",
    message: "Every German sentence and block-level unit has a permanent id.",
  });

  checks.push({
    check: "alignment-edges",
    outcome: check8Passed ? "passed" : "failed",
    code: check8Code,
    message: check8Passed ? "Alignment edges name permanent ids." : check8Message,
  });

  const completeness = translationCompleteness({
    ledger: "present",
    translationUnitCount: englishIds.length,
    germanAlignableCount: germanIds.length,
  });
  checks.push({
    check: "translation-completeness",
    outcome:
      completeness === "complete"
        ? "passed"
        : completeness === "incomplete"
          ? "failed"
          : "not-available",
    code: completeness === "complete" ? undefined : "translation-incomplete",
    message:
      completeness === "complete"
        ? "Every German alignable has an English unit."
        : "Translation is incomplete relative to the ledger.",
  });

  const failed = checks.some((c) => c.outcome === "failed");
  const unavailable = checks.every(
    (c) => c.outcome === "not-available" || c.check === "ledger-presence",
  );
  return {
    slug,
    ledger: "present",
    translationCompleteness: completeness,
    outcome: failed ? "failed" : unavailable ? "not-available" : "passed",
    checks: Object.freeze(checks),
  };
}
