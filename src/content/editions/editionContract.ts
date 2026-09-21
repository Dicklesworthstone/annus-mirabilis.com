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
import { load as parseYaml } from "js-yaml";
import { type AliasRecord, validateAliasRecord } from "../aliases.ts";
import { parseIdSnapshot, validateFrozenIds } from "../frozenIds.ts";
import { parseRouteSlug, type RouteSlug } from "../ids.ts";
import { validateLedger } from "../ledger/validateLedger.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import type { SourceManifest } from "../manifest/types.ts";
import { validateManifest } from "../manifest/validator.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
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
  classifyLedgerCoverage,
  inspectLedgerPresence,
  type LedgerPresence,
  PAPER_BIB_KEYS,
  type TranslationCompleteness,
  translationCompleteness,
} from "./ledgerPresence.ts";
import {
  type ManifestUnitLike,
  type PageMapEntryLike,
  type PageMapMismatch,
  reconcilePageMapAgainstManifest,
} from "./pageMapReconciliation.ts";
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

/**
 * What the harness was given, what it judged, and what it declined.
 *
 * A harness that reports only its successes is the same shape as a gate printing PASSED on
 * an empty set, and check 8 was exactly that before this landed: with zero German units,
 * zero English units and zero edges it reported `passed` with the message "Alignment
 * coverage and edge validity verified." Nothing had been verified. Every run now states
 * its denominator on both axes - how many checks of the fifteen actually reached a verdict
 * and why the rest did not, and how many alignable units were aligned out of how many were
 * supplied - so a reader can tell a clean edition from an unexamined one (am-edn-alignment-tooling-do1).
 */
export type ContractDenominator = Readonly<{
  /** Checks in CONTRACT_CHECKS_SPEC. */
  checksSpecified: number;
  /** Checks that reached passed or failed. */
  checksJudged: number;
  /** Checks that declined, with the reason each gave. */
  checksDeclined: number;
  declined: readonly Readonly<{
    checkNumber?: number | undefined;
    check: ContractCheckName;
    code?: string | undefined;
    reason: string;
  }>[];
  /** German alignable units supplied to check 8, and how many carry at least one edge. */
  germanUnitsGiven: number;
  germanUnitsAligned: number;
  germanUnitsUnaligned: readonly string[];
  /** English units supplied to check 8, and how many carry at least one edge. */
  englishUnitsGiven: number;
  englishUnitsAligned: number;
  englishUnitsUnaligned: readonly string[];
  edgesGiven: number;
}>;

export type EditionContractResult = Readonly<{
  slug: RouteSlug;
  ledger: LedgerPresence;
  translationCompleteness: TranslationCompleteness;
  outcome: "passed" | "failed" | "not-available";
  checks: readonly ContractCheckResult[];
  /** Never optional: a run that cannot say what it examined has not reported. */
  denominator: ContractDenominator;
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
    // Status-agnostic, like every other place that REMOVES or DETECTS a marker rather than
    // deciding whether one is legal. am-wisq made drafts open MACHINE DRAFT; a stripper that
    // enumerates statuses leaves the new marker in the reconstruction and the whole check fails
    // for a reason that has nothing to do with the edition.
    .replace(/---\s*[A-Z][A-Z\s]*\s+TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/g, " ")
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
  // Status-agnostic for the same reason: this one CATCHES furniture that leaked into the edition,
  // and a detector that enumerates goes blind the instant a new status word starts leaking.
  {
    name: "page marker",
    pattern: /---\s*[A-Z][A-Z\s]*\s+TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/g,
  },
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

/**
 * The manifest and alias records a slug's contract checks share (am-06x1).
 *
 * Checks 4, 5 and 6 each need the same two files, and each one is defined only when
 * they are on disk. Loading them once, in one place, keeps a missing manifest reported
 * as "could not look" by every check that needs it rather than as three different
 * stories. An alias record that does not parse is a failure of the alias file, not an
 * empty alias list: returning `[]` there would silently turn an unexplained gap into
 * an explained one, so a bad record makes the bundle unavailable and says which file.
 */
type ManifestBundle =
  | {
      readonly ok: true;
      readonly manifest: SourceManifest;
      readonly aliases: readonly AliasRecord[];
      readonly manifestPath: string;
    }
  | { readonly ok: false; readonly reason: string };

function loadManifestBundle(root: string, slug: RouteSlug): ManifestBundle {
  const manifestPath = join(root, `content/source-blocks/${slug}/manifest.yaml`);
  if (!existsSync(manifestPath)) {
    return { ok: false, reason: `no manifest at ${manifestPath}` };
  }
  try {
    const manifest = validateSourceManifest(
      parseYaml(readFileSync(manifestPath, "utf8")),
      manifestPath,
    );
    const aliasPath = join(root, `content/aliases/${slug}.yaml`);
    const aliases: AliasRecord[] = [];
    if (existsSync(aliasPath)) {
      const raw = parseYaml(readFileSync(aliasPath, "utf8")) as { aliases?: unknown[] };
      for (const record of raw.aliases ?? []) {
        const alias = validateAliasRecord(record);
        if (!alias.ok) {
          return { ok: false, reason: `invalid alias record in ${aliasPath}: ${alias.error}` };
        }
        aliases.push(alias.value);
      }
    }
    return { ok: true, manifest, aliases, manifestPath };
  } catch (err: unknown) {
    return {
      ok: false,
      reason: `loading ${manifestPath} threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * A check that was handed nothing declines and says so.
 *
 * Six checks shared one shape: a default message asserting the thing was valid, a guarded
 * validation that only ran when inputs existed, and an unconditional push of that default.
 * Supplied with nothing they reported `passed` over "Inline math atoms, reference IDs, and
 * footnote marks match", "Term definitions and language metadata valid", "Gloss units valid
 * and current", "Review states, provenance, and editors valid", "Span revisions and digests
 * are current", and check 8's "Alignment coverage and edge validity verified". None of it
 * had been examined. A check cannot distinguish a clean edition from an unexamined one
 * unless it states its population, so each now declines when that population is empty
 * (am-edn-alignment-tooling-do1).
 */
function declineEmptyPopulation(
  meta: ContractCheckMetadata,
  populationDescription: string,
): ContractCheckResult {
  return {
    checkNumber: meta.checkNumber,
    check: meta.check,
    owner: meta.owner,
    role: meta.role,
    outcome: "not-available",
    code: `${meta.check}-population-empty`,
    message:
      `Check ${meta.checkNumber} (${meta.title}) could not run: ${populationDescription} ` +
      "Nothing was examined, so nothing is verified.",
  };
}

function specFor(checkNumber: number): ContractCheckMetadata {
  const meta = CONTRACT_CHECKS_SPEC.find((c) => c.checkNumber === checkNumber);
  if (!meta) throw new Error(`No contract check spec for check ${checkNumber}`);
  return meta;
}

/** The denominator of a run, derived from what the checks were actually handed. */
function buildDenominator(
  checks: readonly ContractCheckResult[],
  units: {
    germanIds: readonly string[];
    englishIds: readonly string[];
    germanUnaligned: readonly string[];
    englishUnaligned: readonly string[];
    edges: number;
  },
): ContractDenominator {
  const declined = checks
    .filter((c) => c.outcome === "not-available" && c.checkNumber !== undefined)
    .map((c) => ({
      checkNumber: c.checkNumber,
      check: c.check,
      code: c.code,
      reason: c.message,
    }));
  const judged = checks.filter(
    (c) => c.checkNumber !== undefined && c.outcome !== "not-available",
  ).length;
  return Object.freeze({
    checksSpecified: CONTRACT_CHECKS_SPEC.length,
    checksJudged: judged,
    checksDeclined: declined.length,
    declined: Object.freeze(declined),
    germanUnitsGiven: units.germanIds.length,
    germanUnitsAligned: units.germanIds.length - units.germanUnaligned.length,
    germanUnitsUnaligned: Object.freeze([...units.germanUnaligned]),
    englishUnitsGiven: units.englishIds.length,
    englishUnitsAligned: units.englishIds.length - units.englishUnaligned.length,
    englishUnitsUnaligned: Object.freeze([...units.englishUnaligned]),
    edgesGiven: units.edges,
  });
}

/**
 * Check 5, lifted so it can run when the LEDGER IS ABSENT.
 *
 * Neither check reads the ledger - verified by searching their bodies for the ledger
 * text - yet the absent-ledger branch marked all fifteen not-available, so four real
 * manifests, four real id snapshots and four real alias files sat unexamined behind an
 * unrelated missing input. Measured: supplying any ledger string at all makes these two
 * pass over 25 real units for mass-energy and 87 for brownian-motion
 * (am-edn-alignment-tooling-do1).
 */
function runCheck5(
  root: string,
  slug: RouteSlug,
  options: EditionContractOptions,
): ContractCheckResult {
  const bundle = loadManifestBundle(root, slug);
  // Check 5: Manifest coverage (spec #5, invokes am-cm-source-manifest-6qa)
  // --------------------------------------------------------------------------
  // Actually INVOKES its declared owner (am-06x1). The spec gives this check role
  // "invokes am-cm-source-manifest-6qa", whose validateManifest is what decides page
  // coverage, locator order, footnote and equation placement, sequence gaps and the
  // derived-status rules; this check read `options.manifestCoverageMatch !== false`,
  // which no production caller sets, so it announced "Every manifest unit has an edition
  // block and derived statuses match" for every paper without loading a manifest.
  // Alias records are passed because the validator needs them to tell an explained gap
  // from an unexplained one; they explain gaps, they do not waive them. Frozen snapshots
  // are deliberately NOT passed here: the snapshot question is check 6's, and one defect
  // reported twice under two owners would overstate what the fifteen cover.
  let manifestDiagnostics: readonly { severity: string; rule: string; message: string }[] | null =
    null;
  let manifestUnavailable: string | null = null;
  if (options.manifestCoverageMatch === undefined) {
    if (!bundle.ok) {
      manifestUnavailable = bundle.reason;
    } else {
      try {
        manifestDiagnostics = validateManifest(bundle.manifest, {
          manifests: new Map([[bundle.manifest.paper, bundle.manifest]]),
          aliases: bundle.aliases,
        });
      } catch (err: unknown) {
        manifestUnavailable = `validateManifest threw: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  const manifestErrors = (manifestDiagnostics ?? []).filter((d) => d.severity === "error");
  if (manifestUnavailable !== null) {
    return {
      checkNumber: 5,
      check: "manifest-coverage",
      owner: "am-cm-source-manifest-6qa",
      role: "invokes",
      outcome: "not-available",
      code: "manifest-not-loadable",
      message:
        `Check 5 (Manifest coverage) could not run: ${manifestUnavailable}. ` +
        "Validating nothing is not coverage.",
    };
  } else {
    const check5Passed =
      options.manifestCoverageMatch !== undefined
        ? options.manifestCoverageMatch !== false
        : manifestDiagnostics !== null && manifestErrors.length === 0;
    return {
      checkNumber: 5,
      check: "manifest-coverage",
      owner: "am-cm-source-manifest-6qa",
      role: "invokes",
      outcome: check5Passed ? "passed" : "failed",
      code: check5Passed ? undefined : "manifest-coverage-mismatch",
      message: check5Passed
        ? `Every manifest unit has an edition block and derived statuses match (${bundle.ok ? bundle.manifest.units.length : 0} unit(s) validated).`
        : `Manifest validation reported ${manifestErrors.length} error(s): ${manifestErrors
            .slice(0, 3)
            .map((d) => `${d.rule}: ${d.message}`)
            .join("; ")}`,
    };
  }
}

/**
 * Check 6, lifted so it can run when the LEDGER IS ABSENT.
 *
 * Neither check reads the ledger - verified by searching their bodies for the ledger
 * text - yet the absent-ledger branch marked all fifteen not-available, so four real
 * manifests, four real id snapshots and four real alias files sat unexamined behind an
 * unrelated missing input. Measured: supplying any ledger string at all makes these two
 * pass over 25 real units for mass-energy and 87 for brownian-motion
 * (am-edn-alignment-tooling-do1).
 */
function runCheck6(
  root: string,
  slug: RouteSlug,
  options: EditionContractOptions,
): ContractCheckResult {
  const bundle = loadManifestBundle(root, slug);
  // Check 6: Id snapshot (spec #6, implements)
  // --------------------------------------------------------------------------
  // Computed from the frozen snapshot on disk (am-06x1). This check read
  // `options.idSnapshotClean !== false`, which no production caller sets, so it reported
  // "Every removed id is covered by an alias" for every paper without opening
  // manifest.ids.snapshot.txt. The three inputs it needs - the snapshot, the manifest's
  // live unit ids, and the alias records - are all on disk for every slug, so it runs
  // today. validateFrozenIds fails on a frozen id that vanished without a resolving
  // alias and on a retired id that came back; an id added since the snapshot is reported
  // but does not fail, because the snapshot is a floor under retirement, not a freeze on
  // authoring.
  const snapshotPath = join(root, `content/source-blocks/${slug}/manifest.ids.snapshot.txt`);
  let frozenResult: ReturnType<typeof validateFrozenIds> | null = null;
  let frozenUnavailable: string | null = null;
  if (options.idSnapshotClean === undefined) {
    if (!bundle.ok) {
      frozenUnavailable = bundle.reason;
    } else if (!existsSync(snapshotPath)) {
      frozenUnavailable = `no frozen id snapshot at ${snapshotPath}`;
    } else {
      try {
        const snapshotText = readFileSync(snapshotPath, "utf8");
        if (parseIdSnapshot(snapshotText).length === 0) {
          frozenUnavailable = `${snapshotPath} lists no ids to hold the manifest to`;
        } else {
          frozenResult = validateFrozenIds(
            snapshotText,
            bundle.manifest.units.map((unit) => unit.id),
            bundle.aliases,
          );
        }
      } catch (err: unknown) {
        frozenUnavailable = `snapshot validation threw: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  if (frozenUnavailable !== null) {
    return {
      checkNumber: 6,
      check: "id-snapshot",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: "not-available",
      code: "id-snapshot-absent",
      message:
        `Check 6 (Id snapshot) could not run: ${frozenUnavailable}. ` +
        "An unread snapshot covers no retirement.",
    };
  } else {
    const check6Passed =
      options.idSnapshotClean !== undefined
        ? options.idSnapshotClean !== false
        : frozenResult?.ok === true;
    const breaking = (frozenResult?.findings ?? []).filter((f) => f.kind !== "new-id");
    return {
      checkNumber: 6,
      check: "id-snapshot",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check6Passed ? "passed" : "failed",
      code: check6Passed ? undefined : "id-snapshot-uncovered",
      message: check6Passed
        ? `Every removed id is covered by an alias and added ids are valid successors (${frozenResult?.newCount ?? 0} id(s) added since the snapshot).`
        : `Id snapshot broken in ${breaking.length} place(s): ${breaking
            .slice(0, 3)
            .map((f) => `${f.kind}: ${f.id}`)
            .join("; ")}`,
    };
  }
}

/**
 * The edition declaration, read FROM DISK.
 *
 * Nothing loaded `content/source-blocks/<slug>/edition.yaml` before this: checks 1 and 14
 * read `options.declaration`, an object no production caller passes, so authoring the file
 * would have changed nothing. Reading it is what makes check 1 able to judge material that
 * already exists - five of the six pinned facsimiles verify against their receipts today.
 *
 * THE THREE DISK CONDITIONS ARE NOT CONTRACT VERDICTS. A file that is missing, unreadable,
 * or malformed says nothing about whether the edition is faithful; it says the input is not
 * here. Each is `not-available` with its own code, the same distinction the empty-population
 * declines draw. Only a declaration that loads can produce a pass or a failure about the
 * edition (am-edn-alignment-tooling-do1).
 */
export type DeclarationLoad =
  | Readonly<{ kind: "loaded"; path: string; raw: unknown }>
  | Readonly<{ kind: "absent"; path: string }>
  | Readonly<{ kind: "unreadable"; path: string; reason: string }>
  | Readonly<{ kind: "malformed"; path: string; reason: string }>;

export function loadEditionDeclaration(root: string, slug: RouteSlug): DeclarationLoad {
  const path = join(root, `content/source-blocks/${slug}/edition.yaml`);
  if (!existsSync(path)) {
    return { kind: "absent", path };
  }
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    return { kind: "unreadable", path, reason: err instanceof Error ? err.message : String(err) };
  }
  try {
    return { kind: "loaded", path, raw: parseYaml(text) };
  } catch (err) {
    return { kind: "malformed", path, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** A disk condition reported as an absent input rather than a verdict about the edition. */
function declineForDisk(meta: ContractCheckMetadata, load: DeclarationLoad): ContractCheckResult {
  const detail =
    load.kind === "absent"
      ? `no edition declaration at ${load.path}`
      : load.kind === "unreadable"
        ? `${load.path} could not be read: ${load.reason}`
        : `${load.path} is not valid YAML: ${(load as { reason: string }).reason}`;
  return {
    checkNumber: meta.checkNumber,
    check: meta.check,
    owner: meta.owner,
    role: meta.role,
    outcome: "not-available",
    code: `edition-declaration-${load.kind}`,
    message:
      `Check ${meta.checkNumber} (${meta.title}) could not run: ${detail}. ` +
      "A missing or unreadable input is not a verdict about the edition.",
  };
}

/**
 * Check 1 with no ledger: the facsimile link of the chain still exists and can be judged.
 *
 * Only the ledger-digest half of check 1 needs the ledger. The facsimile half needs a
 * declaration and a PDF, and five of the six pinned facsimiles already verify against their
 * receipts. Declining the whole check because a different input is missing is the same
 * error the absent-ledger branch made about checks 5 and 6.
 */
function runCheck1FacsimileOnly(root: string, slug: RouteSlug): ContractCheckResult {
  const meta = specFor(1);
  const load = loadEditionDeclaration(root, slug);
  if (load.kind !== "loaded") return declineForDisk(meta, load);
  const declared = validateEditionDeclaration(load.raw, { repoRoot: root });
  const facsimileDigest = declared.declaration?.facsimileDigest;
  if (!facsimileDigest) {
    return declineEmptyPopulation(
      meta,
      `${load.path} declares no facsimile digest, and the ledger is absent, so no link of the chain was compared.`,
    );
  }
  const pdfPath = join(root, `public/papers/pdfs/${PAPER_BIB_KEYS[slug]}.pdf`);
  if (!existsSync(pdfPath)) {
    return {
      checkNumber: meta.checkNumber,
      check: meta.check,
      owner: meta.owner,
      role: meta.role,
      outcome: "not-available",
      code: "facsimile-not-available",
      message:
        `Check 1 (Digest chain) could not run: ${load.path} declares a facsimile digest but ` +
        `${pdfPath} is not in this checkout. Absent bytes are not a verdict about the edition.`,
    };
  }
  const actual = createHash("sha256").update(readFileSync(pdfPath)).digest("hex");
  const ok = actual === facsimileDigest;
  return {
    checkNumber: meta.checkNumber,
    check: meta.check,
    owner: meta.owner,
    role: meta.role,
    outcome: ok ? "passed" : "failed",
    code: ok ? undefined : "digest-mismatch",
    message: ok
      ? `Digest chain verified from ${load.path}: facsimile ${pdfPath} sha256 ${actual.slice(0, 12)}. ` +
        "The ledger link was NOT compared, because no ledger is present."
      : `Digest chain broken: facsimile ${pdfPath} hashes to ${actual.slice(0, 12)} but ${load.path} declares ${facsimileDigest.slice(0, 12)}.`,
  };
}

/**
 * A refusal from the edition contract, carrying a code the refusal scanner can read.
 *
 * The bare built-in this replaces was invisible twice over: the bare-throw ratchet counted it as an
 * uncoded refusal, and the untested-refusal scanner could not see it at all, because a built-in
 * Error carries no code to attribute a test to. A caller handed a bad slug got a string and no way
 * to branch on what went wrong.
 *
 * The wording above avoids spelling the built-in constructor call out: the bare-throw scanner reads
 * text, not syntax, so a comment quoting one is counted as a site. My first draft of this comment
 * added a phantom bare throw to this very file.
 */
export class EditionContractError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EditionContractError";
    this.code = code;
  }
}

export function assertEditionContract(
  slugRaw: string,
  options: EditionContractOptions = {},
): EditionContractResult {
  const parsed = parseRouteSlug(slugRaw);
  if (!parsed.ok) {
    // The code is a literal, not `parsed.rule ?? "..."`. A scanner reading the first argument
    // cannot see through a conditional, which is the defect am-utmv names, and a refusal whose
    // code depends on its input is one nobody can write a targeted test for. The parser's own
    // message still carries the detail.
    throw new EditionContractError("invalid-route-slug", parsed.error);
  }
  const slug = parsed.value;
  const root = options.root ?? process.cwd();
  const presence = inspectLedgerPresence(slug, root);
  const checks: ContractCheckResult[] = [];

  const ledgerText =
    options.ledgerText !== undefined
      ? options.ledgerText
      : presence.presence !== "absent"
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

    // Checks 5 and 6 do NOT read the ledger, and marking them not-available because a
    // different input is missing left four real manifests, four real id snapshots and four
    // real alias files unexamined. Measured before changing this: supplying any ledger
    // string at all made both pass over 25 real units for mass-energy and 87 for
    // brownian-motion. An absent ledger is a reason those two cannot be part of a COMPLETE
    // edition verdict; it is not a reason to decline to look at them
    // (am-edn-alignment-tooling-do1).
    const LEDGER_INDEPENDENT = new Set([1, 5, 6]);
    for (const spec of CONTRACT_CHECKS_SPEC) {
      if (spec.checkNumber === 1) {
        checks.push(runCheck1FacsimileOnly(root, slug));
        continue;
      }
      if (spec.checkNumber === 5) {
        checks.push(runCheck5(root, slug, options));
        continue;
      }
      if (spec.checkNumber === 6) {
        checks.push(runCheck6(root, slug, options));
        continue;
      }
      checks.push({
        checkNumber: spec.checkNumber,
        check: spec.check,
        owner: spec.owner,
        role: spec.role,
        outcome: "not-available",
        code: "ledger-absent",
        message:
          `Check ${spec.checkNumber} (${spec.title}) not available: no ledger present. ` +
          `${LEDGER_INDEPENDENT.size} of the fifteen do not read the ledger and were run anyway.`,
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
      denominator: buildDenominator(checks, {
        germanIds: [],
        englishIds: [],
        germanUnaligned: [],
        englishUnaligned: [],
        edges: 0,
      }),
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

  // The declaration is read from disk when the caller does not inject digests, so a paper
  // that has one is judged against it rather than skipped.
  const declarationLoad =
    options.declaredLedgerDigest || options.declaredFacsimileDigest
      ? null
      : loadEditionDeclaration(root, slug);

  if (declarationLoad !== null && declarationLoad.kind !== "loaded") {
    checks.push(declineForDisk(specFor(1), declarationLoad));
  } else if (declarationLoad !== null) {
    const declared = validateEditionDeclaration(declarationLoad.raw, { repoRoot: root });
    const ledgerDigest = declared.declaration?.ledgerDigest;
    const facsimileDigest = declared.declaration?.facsimileDigest;
    if (!ledgerDigest && !facsimileDigest) {
      checks.push(
        declineEmptyPopulation(
          specFor(1),
          `${declarationLoad.path} declares neither a ledger digest nor a facsimile digest, so no link of the chain was compared.`,
        ),
      );
    } else {
      // A PASS NAMES ITS INPUT. "The chain verified" over an unnamed input is how a pass
      // over a fixture becomes indistinguishable from a pass over the real facsimile, and
      // untangling exactly that confusion is what the last several commits have been for.
      const compared: string[] = [];
      let failed: string | undefined;
      if (ledgerDigest) {
        const actual = sha256(text);
        if (actual === ledgerDigest) {
          compared.push(`ledger ${presence.path} sha256 ${actual.slice(0, 12)}`);
        } else {
          failed = `ledger ${presence.path} hashes to ${actual.slice(0, 12)} but ${declarationLoad.path} declares ${ledgerDigest.slice(0, 12)}`;
        }
      }
      if (!failed && facsimileDigest) {
        const pdfPath = join(root, `public/papers/pdfs/${PAPER_BIB_KEYS[slug]}.pdf`);
        if (!existsSync(pdfPath)) {
          compared.push(
            `facsimile ${pdfPath} not in this checkout, digest ${facsimileDigest.slice(0, 12)} recorded but not re-verified`,
          );
        } else {
          const actual = createHash("sha256").update(readFileSync(pdfPath)).digest("hex");
          if (actual === facsimileDigest) {
            compared.push(`facsimile ${pdfPath} sha256 ${actual.slice(0, 12)}`);
          } else {
            failed = `facsimile ${pdfPath} hashes to ${actual.slice(0, 12)} but ${declarationLoad.path} declares ${facsimileDigest.slice(0, 12)}`;
          }
        }
      }
      checks.push({
        checkNumber: 1,
        check: "digest-chain",
        owner: "this bead (am-edn-alignment-tooling-do1)",
        role: "implements",
        outcome: failed ? "failed" : "passed",
        code: failed ? "digest-mismatch" : undefined,
        message: failed
          ? `Digest chain broken: ${failed}.`
          : `Digest chain verified from ${declarationLoad.path}: ${compared.join("; ")}.`,
      });
    }
  } else {
    checks.push({
      checkNumber: 1,
      check: "digest-chain",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check1Outcome,
      code: check1Code,
      message: check1Message,
    });
  }

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
    if (presence.presence !== "absent") {
      try {
        // The receipt that governs this ledger is the one in the root under test.
        // validateLedger resolves it from process.cwd() when none is given, so a contract
        // call against another root reconciled page counts against a receipt describing a
        // different document and reported ledger-not-clean for a clean ledger. Found on
        // 2026-09-19 while wiring the edition pipeline's ledger stage, which had the same
        // defect.
        const receiptPath = join(root, `docs/provenance/${PAPER_BIB_KEYS[slug]}.md`);
        const validation = validateLedger(join(root, presence.path), {
          content: text,
          ...(existsSync(receiptPath) ? { receiptPath } : {}),
        });
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

  if (options.editionText === undefined) {
    // Check 7 already declined this exact condition - "no edition text was supplied.
    // Examining nothing is not a clean edition." - while check 3 blessed it. Eighth
    // instance of the shape, and the two checks disagreeing about the same missing input
    // is how it stayed invisible.
    checks.push(
      declineEmptyPopulation(
        specFor(3),
        "no edition text was supplied, so there was nothing to reconstruct against the ledger.",
      ),
    );
  } else {
    checks.push({
      checkNumber: 3,
      check: "reconstruction",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check3Passed ? "passed" : "failed",
      code: check3Code,
      message: check3Message,
    });
  }

  // --------------------------------------------------------------------------
  // Check 4: Count reconciliation (spec #4, implements)
  // --------------------------------------------------------------------------
  // Actually reconciles (am-06x1). reconcilePageMapAgainstManifest already exists and is
  // what the per-paper gates use; this check claimed its result while calling nothing, so
  // "Manifest per-page counts and receipt pageMap match" was asserted for every edition.
  // Both inputs are loadable from root and slug, so this needs no ledger and runs today.
  const bundle = loadManifestBundle(root, slug);

  let pageMapMismatches: readonly PageMapMismatch[] | null = null;
  let reconciliationUnavailable: string | null = null;
  // am-izth. The option may force a FAILURE, which is how the test drives the mismatch branch,
  // but it may never assert a PASS. The defect this check carried was a positive match reported
  // without comparing anything, and a caller-supplied `true` would be the same defect through a
  // different door, so the real reconciliation runs in every case except a forced failure.
  if (options.perPageCountsMatch !== false) {
    const bibKey = PAPER_BIB_KEYS[slug];
    const receiptPath = join(root, `docs/provenance/${bibKey}.md`);
    if (!bundle.ok || !existsSync(receiptPath)) {
      reconciliationUnavailable = bundle.ok ? `receipt absent (${receiptPath})` : bundle.reason;
    } else {
      try {
        const manifest = bundle.manifest;
        const parsedReceipt = parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath);
        const pageMap = parsedReceipt.frontMatter?.pageMap;
        if (!Array.isArray(pageMap) || pageMap.length === 0) {
          reconciliationUnavailable = `${receiptPath} declares no pageMap to reconcile against`;
        } else {
          // refinedBy must be the bead the RECEIPT records as having refined those pages,
          // not a bead this file chose. Passing the contract's own id made every refined
          // page report a mismatch that was purely my argument choice; pinning the Brownian
          // inventory bead then did the same thing to the other three papers, 67 phantom
          // mismatches in all, because each paper was refined by its own bead. The receipt
          // states its refiner, so the refiner is read from it: the stamp the receipt uses
          // on most of its refined pages. That still fails a page stamped by a different
          // bead than the rest, a stamp on a page that prints no display, and a refined
          // page that lost its stamp. A receipt that stamps nothing at all - the
          // pre-refinement stub state the Brownian audit found - fails every stampable
          // page against a named absence rather than passing for want of an expectation.
          const stampCounts = new Map<string, number>();
          for (const entry of pageMap as readonly PageMapEntryLike[]) {
            const stamp = entry.refinedBy;
            if (stamp !== undefined && stamp !== "") {
              stampCounts.set(stamp, (stampCounts.get(stamp) ?? 0) + 1);
            }
          }
          let refiner = "(this receipt records no refinedBy stamp)";
          let best = 0;
          for (const [stamp, count] of stampCounts) {
            if (count > best) {
              refiner = stamp;
              best = count;
            }
          }
          // The printed sections are this paper's own, not Brownian's six. Passing the
          // default would drop every section above s5 from the manifest side and report
          // the relativity and light-quanta receipts as wrong about their own pages.
          const sectionIds = [
            ...new Set(
              manifest.units
                .map((unit) => unit.section ?? unit.id.split("-")[0])
                .filter((section): section is string => /^s\d+$/.test(section ?? "")),
            ),
          ].sort();
          pageMapMismatches = reconcilePageMapAgainstManifest(
            manifest.units as readonly ManifestUnitLike[],
            pageMap as readonly PageMapEntryLike[],
            refiner,
            sectionIds,
          );
        }
      } catch (err: unknown) {
        reconciliationUnavailable = `reconciliation threw: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  if (reconciliationUnavailable !== null) {
    checks.push({
      checkNumber: 4,
      check: "count-reconciliation",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: "not-available",
      code: "reconciliation-inputs-absent",
      message:
        `Check 4 (Count reconciliation) could not run: ${reconciliationUnavailable}. ` +
        "Reconciling nothing is not a match.",
    });
  } else {
    const check4Passed =
      options.perPageCountsMatch === false
        ? false
        : pageMapMismatches !== null && pageMapMismatches.length === 0;
    checks.push({
      checkNumber: 4,
      check: "count-reconciliation",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check4Passed ? "passed" : "failed",
      code: check4Passed ? undefined : "count-reconciliation-mismatch",
      message: check4Passed
        ? `Manifest per-page counts and receipt pageMap match across ${(pageMapMismatches ?? []).length === 0 ? "every reconciled page" : "?"}.`
        : `Manifest per-page counts disagree with the receipt pageMap in ${(pageMapMismatches ?? []).length} place(s): ${(
            pageMapMismatches ?? []
          )
            .slice(0, 3)
            .map((m) => JSON.stringify(m))
            .join("; ")}`,
    });
  }

  // --------------------------------------------------------------------------
  checks.push(runCheck5(root, slug, options));

  // --------------------------------------------------------------------------
  checks.push(runCheck6(root, slug, options));

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

  // The denominator this check was given, computed before any verdict so it is reported
  // whether the check runs or declines.
  const germanWithEdge = new Set(edges.map((e) => e.sourceId));
  const englishWithEdge = new Set(edges.map((e) => e.targetId));
  const germanUnaligned = germanIds.filter((id) => !germanWithEdge.has(id));
  const englishUnaligned = englishIds.filter((id) => !englishWithEdge.has(id));

  let check8Passed = true;
  let check8Code: string | undefined;
  let check8Message = "Alignment edges name permanent ids.";

  if (germanIds.length === 0 && englishIds.length === 0 && edges.length === 0) {
    // Examining nothing is not coverage. This branch reported `passed` with the message
    // "Alignment coverage and edge validity verified." until am-edn-alignment-tooling-do1;
    // the empty set is precisely the case a coverage check must refuse to bless.
    checks.push({
      checkNumber: 8,
      check: "alignment-coverage",
      owner: "am-cm-checks-structural-lq0",
      role: "invokes",
      outcome: "not-available",
      code: "alignment-population-empty",
      message:
        "Check 8 (Alignment coverage) could not run: 0 German alignable units, 0 English units " +
        "and 0 edges were supplied. Nothing was examined, so nothing is verified.",
    });
  } else {
    check8Message =
      `Alignment coverage and edge validity verified over ${germanIds.length} German unit(s) ` +
      `and ${englishIds.length} English unit(s) across ${edges.length} edge(s).`;

    const issues = validateManyToManyAlignment({ edges, germanIds, englishIds });
    if (issues.length > 0) {
      check8Passed = false;
      check8Code = issues[0]?.code;
      check8Message = issues.map((i) => i.message).join(" ");
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
  }

  // --------------------------------------------------------------------------
  // Check 9: Display equation byte identity (spec #9, invokes am-cm-checks-structural-lq0)
  // --------------------------------------------------------------------------
  // Reports what it can see rather than a flag (am-06x1). This check read
  // `options.displayMathMatches !== false`, which no production caller sets, so it
  // announced "English and German display equation blocks are byte-identical" for four
  // papers that have no English face at all. The comparison it names is defined only
  // when both faces exist, and measured against the tree on 2026-09-19 neither does:
  // the manifests declare every display equation's destination, but no German edition
  // block record and no translation unit record is on disk anywhere in content/ (the
  // Brownian and light-quanta manifests still carry the `planned` placeholder; the
  // relativity manifest names 211 translation unit ids, and grep finds every one of them
  // only in that manifest). So this check counts what the manifest declares and says it
  // could not compare, naming the two things that are missing. It never passes for want
  // of an English face. When the faces land, the byte comparison is a call to
  // validateDisplayByteIdentity per aligned pair, and this is the site of that call.
  const TRANSLATION_UNIT_PLACEHOLDER = "planned";
  let displayEquationCount = 0;
  let declaredEnglishUnits = 0;
  let displayUnavailable: string | null = null;
  if (options.displayMathMatches === undefined) {
    if (!bundle.ok) {
      displayUnavailable = bundle.reason;
    } else {
      for (const unit of bundle.manifest.units) {
        if (unit.kind !== "display-equation") continue;
        displayEquationCount += 1;
        // `destination` is either a bare string (a single edition block) or the record
        // with translation targets; only the second shape can declare an English unit.
        const destination = typeof unit.destination === "string" ? undefined : unit.destination;
        for (const target of destination?.translationUnits ?? []) {
          if (target !== TRANSLATION_UNIT_PLACEHOLDER && target !== "") declaredEnglishUnits += 1;
        }
      }
      const translationDir = join(root, `content/translations/${slug}`);
      if (!existsSync(translationDir)) {
        displayUnavailable =
          `${displayEquationCount} display equation(s) are declared in the manifest and ` +
          `${declaredEnglishUnits} carry a translation unit id, but there is no English face ` +
          `to compare them with: ${translationDir} does not exist, so no translation unit ` +
          "record is on disk. Comparing nothing is not byte identity.";
      } else {
        displayUnavailable =
          `${translationDir} exists but this check does not yet read translation unit records, ` +
          "so the byte comparison has not been made. It is reported as not made rather than passed.";
      }
    }
  }
  if (displayUnavailable !== null) {
    checks.push({
      checkNumber: 9,
      check: "display-math-byte-identity",
      owner: "am-cm-checks-structural-lq0",
      role: "invokes",
      outcome: "not-available",
      code: "english-face-absent",
      message: `Check 9 (Display equation byte identity) could not run: ${displayUnavailable}`,
    });
  } else {
    // Reached only when the caller answered for this check: while the English face is
    // missing the branch above always sets displayUnavailable. An unanswered call that
    // somehow arrived here fails rather than passes, because a false red is loud and a
    // false green is the defect this bead exists to remove.
    const check9Passed = options.displayMathMatches ?? false;
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
  }

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

  if (!(options.components && options.components.length > 0)) {
    checks.push(
      declineEmptyPopulation(
        specFor(10),
        "no alignment components were supplied, so there were no inline math atoms, reference ids or footnote marks to compare.",
      ),
    );
  } else {
    checks.push({
      checkNumber: 10,
      check: "inline-math-atoms",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check10Passed ? "passed" : "failed",
      code: check10Code,
      message: check10Message,
    });
  }

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

  if (!(options.terms && options.terms.length > 0)) {
    checks.push(
      declineEmptyPopulation(
        specFor(11),
        "no term occurrences were supplied, so no definition length or language metadata was examined.",
      ),
    );
  } else {
    checks.push({
      checkNumber: 11,
      check: "term-definitions",
      owner: "am-cm-schemas-source-1en",
      role: "invokes",
      outcome: check11Passed ? "passed" : "failed",
      code: check11Code,
      message: check11Message,
    });
  }

  // --------------------------------------------------------------------------
  // Check 12: Hero quote resolves to edition text (spec #12, invokes am-cm-checks-structural-lq0)
  // --------------------------------------------------------------------------
  // Resolves the quote the paper record actually declares (am-06x1). This check read
  // `options.heroQuoteMatches !== false`, which no production caller sets, so it reported
  // "Hero quote resolves to edition text at anchor" for papers that declare no hero quote
  // and have no edition text. It now reads content/papers/<slug>.json and looks for the
  // three shapes its owner's checkHeroQuoteUnresolved looks for - heroQuote, heroQuotes
  // and pullQuotes - and resolves each declared quote against the edition text under the
  // owner's rule: whitespace collapsed, case and punctuation preserved. A quote that is
  // not in the edition fails. A paper that declares no quote, or declares one with no
  // edition text to resolve it against, reports not-available with which of the two is
  // missing. Measured on 2026-09-19, no paper record declares a hero quote, so all four
  // report not-available today; the check goes live the day one is authored.
  const heroQuotes: { anchor: string; text: string }[] = [];
  let heroUnavailable: string | null = null;
  if (options.heroQuoteMatches === undefined) {
    const paperPath = join(root, `content/papers/${slug}.json`);
    if (!existsSync(paperPath)) {
      heroUnavailable = `no paper record at ${paperPath}`;
    } else {
      try {
        const record = JSON.parse(readFileSync(paperPath, "utf8")) as Record<string, unknown>;
        const candidates: unknown[] = [];
        if (record.heroQuote) candidates.push(record.heroQuote);
        if (Array.isArray(record.heroQuotes)) candidates.push(...record.heroQuotes);
        if (Array.isArray(record.pullQuotes)) candidates.push(...record.pullQuotes);
        for (const candidate of candidates) {
          if (!candidate || typeof candidate !== "object") continue;
          const quote = candidate as Record<string, unknown>;
          const quoteText = typeof quote.text === "string" ? quote.text : quote.quote;
          if (typeof quoteText !== "string" || quoteText === "") continue;
          heroQuotes.push({
            anchor: typeof quote.anchor === "string" ? quote.anchor : "(no anchor)",
            text: quoteText,
          });
        }
        if (heroQuotes.length === 0) {
          heroUnavailable = `${paperPath} declares no hero quote, so there is none to resolve`;
        } else if (options.editionText === undefined) {
          heroUnavailable =
            `${paperPath} declares ${heroQuotes.length} hero quote(s), but no edition text was ` +
            "supplied to resolve them against";
        }
      } catch (err: unknown) {
        heroUnavailable = `reading ${paperPath} threw: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  if (heroUnavailable !== null) {
    checks.push({
      checkNumber: 12,
      check: "hero-quote",
      owner: "am-cm-checks-structural-lq0",
      role: "invokes",
      outcome: "not-available",
      code: "hero-quote-not-declared",
      message:
        `Check 12 (Hero quote resolution) could not run: ${heroUnavailable}. ` +
        "An unresolved quote is not a resolved one.",
    });
  } else {
    const collapsed = (options.editionText ?? "").replace(/\s+/g, " ").trim();
    const unresolved =
      options.heroQuoteMatches !== undefined
        ? []
        : heroQuotes.filter((quote) => !collapsed.includes(quote.text.replace(/\s+/g, " ").trim()));
    const check12Passed =
      options.heroQuoteMatches !== undefined
        ? options.heroQuoteMatches !== false
        : unresolved.length === 0;
    checks.push({
      checkNumber: 12,
      check: "hero-quote",
      owner: "am-cm-checks-structural-lq0",
      role: "invokes",
      outcome: check12Passed ? "passed" : "failed",
      code: check12Passed ? undefined : "hero-quote-unresolved",
      message: check12Passed
        ? `Hero quote resolves to edition text at anchor (${heroQuotes.length} quote(s) checked).`
        : `Hero quote does not match edition text at anchor: ${unresolved
            .slice(0, 2)
            .map((quote) => `${quote.anchor}: ${JSON.stringify(quote.text.slice(0, 60))}`)
            .join("; ")}`,
    });
  }

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

  if (!options.glossInput) {
    checks.push(
      declineEmptyPopulation(
        specFor(13),
        "no gloss input was supplied, so no gloss unit addressing, token coverage or staleness was examined.",
      ),
    );
  } else {
    checks.push({
      checkNumber: 13,
      check: "gloss-units",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check13Passed ? "passed" : "failed",
      code: check13Code,
      message: check13Message,
    });
  }

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

  if (
    !(options.declaration !== undefined || (options.reviewUnits && options.reviewUnits.length > 0))
  ) {
    checks.push(
      declineEmptyPopulation(
        specFor(14),
        "neither an edition declaration nor any review-state units were supplied, so no review state, provenance entry or editor list was examined.",
      ),
    );
  } else {
    checks.push({
      checkNumber: 14,
      check: "review-states",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check14Passed ? "passed" : "failed",
      code: check14Code,
      message: check14Message,
    });
  }

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

  if (!(options.spans && options.spans.length > 0)) {
    checks.push(
      declineEmptyPopulation(
        specFor(15),
        "no spans were supplied, so no span revision or digest was examined.",
      ),
    );
  } else {
    checks.push({
      checkNumber: 15,
      check: "span-revision-currency",
      owner: "this bead (am-edn-alignment-tooling-do1)",
      role: "implements",
      outcome: check15Passed ? "passed" : "failed",
      code: check15Code,
      message: check15Message,
    });
  }

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

  // The coverage of the ledger actually in hand, not an assertion that one exists. This
  // read `ledger: "present"` until 2026-09-21 and so licensed a completeness verdict from
  // any file at all, including one made entirely of page markers.
  const ledgerCoverage: LedgerPresence =
    options.ledgerText !== undefined && options.ledgerText !== null
      ? classifyLedgerCoverage(options.ledgerText)
      : presence.presence;

  const completeness = translationCompleteness({
    ledger: ledgerCoverage,
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
    ledger: ledgerCoverage,
    translationCompleteness: completeness,
    outcome: failed ? "failed" : unavailable ? "not-available" : "passed",
    checks: Object.freeze(checks),
    denominator: buildDenominator(checks, {
      germanIds,
      englishIds,
      germanUnaligned,
      englishUnaligned,
      edges: edges.length,
    }),
  };
}
