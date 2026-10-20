/**
 * Staged edition pipeline (am-edn-alignment-tooling-do1).
 *
 * Nine stages in the order the bead specifies: ledger, reconcile, ids, digests,
 * compile, align, contract, coverage, static-html. Each one calls the owner it
 * names and reports what that owner found.
 *
 * WHAT THIS REPLACES (am-06x1's defect class, found here on 2026-09-19). The
 * ledger-present branch of this script used to push three literal results:
 *
 *   stages.push({ stage: "ledger",  outcome: "passed", message: "Ledger present." });
 *   stages.push({ stage: "segment", outcome: "passed", message: "Segmentation ran." });
 *   stages.push({ stage: "align",   outcome: "passed", message: "Alignment ran." });
 *
 * "Segmentation ran" was written by a line that ran no segmentation. Nothing
 * caught it because no ledger is on disk for any of the five papers, so that
 * branch was unreachable in production and untested: every case in
 * e2e-edition-pipeline.test.ts went down the ledger-absent branch.
 *
 * A stage that cannot do its work reports not-available with the reason. A stage
 * that does part of its work reports that part and lists the rest in `pending`
 * with the bead that owns it, so a pass can never be read as covering work that
 * was not done.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import {
  loadAlignmentComponents,
  loadAuthoredEdges,
  loadGlossInput,
  loadTermOccurrences,
  manifestUnitIds,
  translationUnitIds,
} from "../src/content/editions/authoredInputs.ts";
import {
  coverageReport,
  coverageReportIsHonest,
  coverageReportJson,
  coverageReportMarkdown,
} from "../src/content/editions/coverageReport.ts";
import { assertEditionContract } from "../src/content/editions/editionContract.ts";
import { loadGermanSourceFace } from "../src/content/editions/germanSourceFace.ts";
import {
  inspectLedgerPresence,
  PAPER_BIB_KEYS,
  type TranslationCompleteness,
  translationCompleteness,
} from "../src/content/editions/ledgerPresence.ts";
import { germanAlignableIds, segmentLedger } from "../src/content/editions/segmentLedger.ts";
import {
  compareSentenceDivision,
  formatDivisionComparison,
} from "../src/content/editions/sentenceDivisionComparison.ts";
import { type ScannedFace, scanFaceHtml } from "../src/content/editions/staticHtmlScan.ts";
import { parseRouteSlug, type RouteSlug } from "../src/content/ids.ts";
import { validateLedger } from "../src/content/ledger/validateLedger.ts";
import { validateSourceManifest } from "../src/content/manifest/schema.ts";
import { newRunIdentity, TestLogger } from "../src/testing/log/logger.ts";
import { runAlignEditions } from "./align-editions.ts";
import { loadReadingFiles } from "./build-content.ts";

export const PIPELINE_STAGES = [
  "ledger",
  "reconcile",
  "ids",
  "digests",
  "compile",
  "align",
  "contract",
  "coverage",
  "static-html",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Whether a string names one of the nine stages. */
export function isPipelineStage(raw: string): raw is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(raw);
}

/**
 * The --require-stage argument, or a refusal naming the nine stages.
 *
 * Exported so the argument handling can be driven in a test without spawning a process, exactly
 * as `resolveSlugArgument` is.
 */
export function resolveRequireStageArgument(
  raw: string | undefined,
): { ok: true; stage: PipelineStage | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, stage: undefined };
  if (!isPipelineStage(raw)) {
    return {
      ok: false,
      error:
        `--require-stage "${raw}" is not a pipeline stage. ` +
        `The nine are: ${PIPELINE_STAGES.join(", ")}.`,
    };
  }
  return { ok: true, stage: raw };
}

export type StageResult = Readonly<{
  stage: PipelineStage;
  outcome: "passed" | "failed" | "not-available";
  code?: string | undefined;
  message: string;
  /** Work this stage did NOT do, each entry naming the bead that owns it. */
  pending?: readonly string[] | undefined;
  /** Findings kept as evidence when the stage failed. */
  evidence?: readonly string[] | undefined;
  durationMs: number;
}>;

export type PipelineRun = Readonly<{
  exitCode: number;
  slug: RouteSlug;
  translationCompleteness: TranslationCompleteness;
  stages: readonly StageResult[];
  logPath?: string | undefined;
  /**
   * Why the run refused before it could judge anything, when it did.
   *
   * A refusal is not a failed stage, and `exitCode: 1` alone cannot say which happened. See
   * `resolveRequireStageArgument`.
   */
  refusal?: Readonly<{ code: "unknown-require-stage"; message: string }> | undefined;
}>;

/**
 * The sentence-unit ruling this pipeline stops at.
 *
 * src/content/manifest/types.ts has no `sentence` kind, so a proposed sentence
 * has no manifest unit to reconcile against. Block-level reconciliation is real
 * and runs; sentence-level reconciliation is not performed and is never counted
 * as performed. The decision belongs to am-xz2d and the owner, not to this file.
 */
export const SENTENCE_UNIT_RULING =
  "sentence-level reconciliation: the manifest format has no sentence kind (am-xz2d decision 1, owner ruling pending)";

/** Control-flow marker for an empty corpus; never surfaced as a compiler error. */
/**
 * The corpus loaded but held nothing to check.
 *
 * Carries a code as its first constructor argument, per the owner's ruling on am-p465
 * ("Positional code argument"). It threw with no arguments at all before, so nothing naming the
 * refusal reached a reader or the scanner.
 */
class EmptyCorpusError extends Error {
  readonly code: string;
  constructor(code: string, message = "The corpus contains no records to check.") {
    super(message);
    this.name = "EmptyCorpusError";
    this.code = code;
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

/**
 * The manifest's units with the three fields this file needs.
 *
 * `locators` is carried because the sentence-division screen places a unit by its printed page,
 * and a unit with no page is counted as unplaceable rather than guessed. Returning only id and
 * kind made that counter read 91 unplaceable units on brownian-motion and 0 comparable pages --
 * the harness correctly refusing to compare, against a shape this loader had flattened.
 */
function loadManifestUnits(
  root: string,
  slug: RouteSlug,
):
  | readonly Readonly<{
      id: string;
      kind: string;
      locators?: readonly Readonly<{ page?: number | undefined }>[] | undefined;
    }>[]
  | null {
  const manifestPath = join(root, `content/source-blocks/${slug}/manifest.yaml`);
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest = validateSourceManifest(
      parseYaml(readFileSync(manifestPath, "utf8")),
      manifestPath,
    );
    return manifest.units.map((unit) => ({
      id: unit.id,
      kind: String(unit.kind),
      ...(unit.locators !== undefined ? { locators: unit.locators } : {}),
    }));
  } catch {
    return null;
  }
}

function loadManifestUnitIds(root: string, slug: RouteSlug): readonly string[] | null {
  return loadManifestUnits(root, slug)?.map((unit) => unit.id) ?? null;
}

/*
 * WHICH MANIFEST UNITS ARE ANCHORS, which is what section G's "every in-scope anchor id present"
 * turns on. The authority is docs/CONTENT_IDS.md sections 7.1 and 7.2, and two kinds are
 * deliberately NOT anchors there:
 *
 *   inline-equation  AGENTS.md: "These units have no reader-facing anchor, deliberately: the
 *                    anchor grammar above defines no #s<n>-p<m>-s<k>-m<i>, so a reader arrives at
 *                    the sentence that prints the formula." 270 units over the corpus.
 *   the reference kinds (bibliographic, internal, cross-paper)  CONTENT_IDS.md section 6:
 *                    "Names the occurrence in the text, not the target." 66 units.
 *
 * Counting either as a missing anchor would report 336 defects that are decisions. Measured
 * 2026-10-20 against the built faces with the remaining kinds: the German face resolves 930 of
 * 930 in-scope anchors across the four papers (53, 178, 263, 436), so this is a live gate on a
 * real population and not a floor over an empty one.
 */
const ANCHOR_BEARING_UNIT_KINDS: ReadonlySet<string> = new Set([
  "paragraph",
  "sentence",
  "heading",
  "section-heading",
  "part-heading",
  "footnote",
  "masthead-title",
  "masthead-author",
  "closing-dateline",
  "closing-ack",
  "closing-received",
  "display-equation",
]);

/** The reading face each `--layers` value is published as. */
const FACE_FOR_LAYER: Readonly<Record<string, ScannedFace>> = Object.freeze({
  german: "german",
  translation: "english",
  gloss: "gloss",
});

/**
 * The anchors a given face is responsible for publishing.
 *
 * THE ENGLISH FACE IS NOT ASKED FOR PARAGRAPH ANCHORS, and that exclusion is a scope statement
 * with a measurement and an owner behind it, not a relaxation. The English face publishes
 * translation units, which are sentence-grained; a paragraph is a German structural unit and the
 * face declares it as `data-source-paragraph` rather than as an id. Measured 2026-10-20: with
 * paragraphs excluded the English faces resolve 742 of 742, and with them included 188 German
 * paragraph ids have no English anchor. Whether a reader who switches faces at `#s1-p7` should be
 * carried to the nearest unit that exists on the new face is the nearest-ancestor arm of
 * `src/reader/anchors/mapToFace.ts`, which is recorded as unowned and gated as debt by
 * `unwiredAnchorModules.test.ts` under am-read-anchors-navigation-a6o. That bead owns the
 * question; this stage reports the number so it cannot be forgotten.
 *
 * THE GLOSS FACE ASSERTS NO ANCHORS. It is partial by design -- the reader is told "Not yet
 * glossed" for the sections that have no gloss units -- so the manifest is not its denominator.
 * Measured 2026-10-20: light quanta's gloss face declares 15 ids against 263 manifest anchors.
 * The scan says in its own notes that nothing was asserted, rather than passing quietly.
 */
function anchorsForFace(
  face: ScannedFace,
  units: readonly Readonly<{ id: string; kind: string }>[],
  sections: readonly string[] | undefined,
): { expected: readonly string[]; notes: readonly string[] } {
  if (face === "gloss") {
    return {
      expected: [],
      notes: ["the gloss face is partial by design, so the manifest is not its anchor denominator"],
    };
  }
  const inSections = (id: string) =>
    sections === undefined ||
    sections.length === 0 ||
    sections.some((section) => id === section || id.startsWith(`${section}-`));
  const anchored = units.filter(
    (unit) => ANCHOR_BEARING_UNIT_KINDS.has(unit.kind) && inSections(unit.id),
  );
  if (face !== "english") {
    return { expected: anchored.map((unit) => unit.id), notes: [] };
  }
  const paragraphs = anchored.filter((unit) => unit.kind === "paragraph");
  return {
    expected: anchored.filter((unit) => unit.kind !== "paragraph").map((unit) => unit.id),
    notes: [
      `${paragraphs.length} German paragraph id(s) are not asserted on the English face; ` +
        "the nearest-ancestor face mapping is am-read-anchors-navigation-a6o's",
    ],
  };
}

export async function runEditionPipeline(options: {
  slug: RouteSlug;
  requireStage?: PipelineStage | undefined;
  root?: string | undefined;
  layers?: readonly string[] | undefined;
  sections?: readonly string[] | undefined;
  requireReviewed?: boolean | undefined;
  logger?: TestLogger | undefined;
}): Promise<PipelineRun> {
  const root = options.root ?? process.cwd();
  const slug = options.slug;
  /*
   * AN UNKNOWN STAGE NAME IS A REFUSAL, NOT A FAILED STAGE, and until 2026-10-19 the two were the
   * same exit code with the same fields. `--require-stage` was read as
   * `requireRaw as PipelineStage` and never checked, so the require test below --
   * `stages.find(s => s.stage === options.requireStage)` returning undefined, then
   * `undefined?.outcome !== "passed"` -- was true for every misspelling. Measured on
   * molecular-dimensions: `--require-stage ledger` exits 1 with ledger `not-available`, and
   * `--require-stage ledgre` exits 1 with nine stages recorded, no stage by that name, and
   * nothing anywhere in the result saying the name was wrong.
   *
   * That direction is the dangerous one. The definition-of-done audits run
   * `--require-stage static-html`; a run spelled `static_html` or `statichtml` goes red for ever
   * and reads as a content problem, and the obvious "fix" -- dropping the flag -- turns the gate
   * green over nothing.
   *
   * This is the same defect `resolveSlugArgument` above was written for, on the other argument.
   */
  if (options.requireStage !== undefined && !isPipelineStage(options.requireStage)) {
    return {
      exitCode: 2,
      slug,
      translationCompleteness: "not-applicable-no-ledger",
      stages: Object.freeze([]),
      refusal: {
        code: "unknown-require-stage",
        message:
          `--require-stage "${String(options.requireStage)}" is not a pipeline stage. ` +
          `The nine are: ${PIPELINE_STAGES.join(", ")}.`,
      },
    };
  }
  const layers = options.layers ?? ["german"];
  const stages: StageResult[] = [];
  const started = new Map<PipelineStage, number>();

  const push = (
    stage: PipelineStage,
    outcome: StageResult["outcome"],
    message: string,
    extra?: {
      code?: string | undefined;
      pending?: readonly string[] | undefined;
      evidence?: readonly string[] | undefined;
    },
  ): void => {
    const begin = started.get(stage) ?? Date.now();
    stages.push({
      stage,
      outcome,
      message,
      ...(extra?.code !== undefined ? { code: extra.code } : {}),
      ...(extra?.pending !== undefined ? { pending: extra.pending } : {}),
      ...(extra?.evidence !== undefined ? { evidence: extra.evidence } : {}),
      durationMs: Date.now() - begin,
    });
  };
  const begin = (stage: PipelineStage): void => {
    started.set(stage, Date.now());
  };

  // ---------------------------------------------------------------- 1. ledger
  begin("ledger");
  const presence = inspectLedgerPresence(slug, root);
  let ledgerText: string | null = null;
  if (presence.presence === "absent") {
    push("ledger", "not-available", `No ledger present for ${slug} at ${presence.path}.`, {
      code: "ledger-absent",
    });
  } else {
    try {
      ledgerText = readFileSync(join(root, presence.path), "utf8");
      // The receipt that governs this ledger is the one in the root under test, not the one
      // in the process's working directory. validateLedger otherwise resolves it from cwd,
      // so a run against another root would reconcile page counts against a receipt that
      // describes a different document.
      const receiptPath = join(root, `docs/provenance/${PAPER_BIB_KEYS[slug]}.md`);
      const validation = validateLedger(join(root, presence.path), {
        content: ledgerText,
        ...(existsSync(receiptPath) ? { receiptPath } : {}),
      });
      const errors = validation.errors.map((e) => `${e.code ?? "error"}: ${e.message}`);
      if (errors.length > 0) {
        push("ledger", "failed", `Ledger is not clean: ${errors.slice(0, 3).join("; ")}`, {
          code: "ledger-not-clean",
          evidence: errors,
        });
      } else {
        /*
         * THE PASS NAMES ITS MODE AND KEEPS ITS WARNINGS, and it used to say neither.
         *
         * "Validated clean" reads as the strongest verdict the validator has. It is not: the
         * validator runs in STRUCTURAL mode unless the ledger's status is corrected,
         * corrected-second-read or reviewed, and all four papers are in-progress or not-started,
         * so completeness mode -- which checks page coverage and the closing blocks -- has never
         * run on any of them. That is correct behaviour and a weaker claim than the sentence made.
         *
         * AND SIXTEEN WARNINGS WERE BEING DROPPED. This branch reported only `errors`. Measured
         * 2026-10-20: 0, 3, 5 and 8 warnings across the four papers, every one of them
         * `short-line`, "Line has only N words inside paragraph body" -- which is one of the
         * leftovers AGENTS.md forbids by name, "sentences broken into one-word lines". The
         * validator found them and the stage threw them away. They stay warnings, because the
         * validator ranks them so and a machine draft is allowed to have them, but a warning
         * nobody is shown is the same as a warning nobody raised.
         */
        const warnings = validation.warnings.map((w) => `${w.code ?? "warning"}: ${w.message}`);
        push(
          "ledger",
          "passed",
          `Ledger at ${presence.path} validated clean in ${validation.mode} mode ` +
            `(status ${validation.ledgerStatus}), with ${validation.warnings.length} warning(s) ` +
            `and ${validation.info.length} note(s).`,
          {
            pending: [
              ...(validation.mode === "structural"
                ? [
                    "completeness mode has not run: it needs ledgerStatus corrected, corrected-second-read or reviewed, and no paper has one. Page coverage and the closing blocks are therefore unchecked here",
                  ]
                : []),
              ...warnings,
            ],
          },
        );
      }
    } catch (err: unknown) {
      push("ledger", "failed", `Reading or validating the ledger threw: ${String(err)}`, {
        code: "ledger-unreadable",
      });
    }
  }

  // ------------------------------------------------------------- 2. reconcile
  begin("reconcile");
  const manifestIds = loadManifestUnitIds(root, slug);
  let germanIds: readonly string[] = [];
  if (ledgerText === null) {
    push("reconcile", "not-available", "Reconciliation skipped: no ledger to segment.", {
      code: "ledger-absent",
      pending: [SENTENCE_UNIT_RULING],
    });
  } else if (manifestIds === null) {
    push(
      "reconcile",
      "not-available",
      `No manifest at content/source-blocks/${slug}/manifest.yaml to reconcile the proposal against.`,
      { code: "manifest-absent", pending: [SENTENCE_UNIT_RULING] },
    );
  } else {
    // THE PAIRING COMES FROM THE FACE THAT ALREADY COMPUTES IT, not from a fourth copy of the rule.
    // loadGermanSourceFace segments the ledger, joins its continuations, places its pages and then
    // calls manifestAnchors, whose `anchorOf` says which frozen id each proposal id is published
    // under. Supplying it here is what lets this stage compare the two namespaces at all; without it
    // every unit whose proposal spelling differs from its frozen spelling was reported twice.
    //
    // A pairing failure is reported as the reconcile verdict rather than thrown away: if the face
    // cannot pair the proposal with the manifest, that IS the reconciliation result, and it is a more
    // precise statement than a list of name differences.
    let anchorOf: Readonly<Record<string, string>> | undefined;
    let pairingRefusal: string | undefined;
    let pairingAbsent = false;
    try {
      const face = loadGermanSourceFace(slug, root);
      /*
       * A FACE THAT RETURNS NOTHING IS A THIRD STATE AND THIS GUARDED ONLY THE THROW.
       *
       * `loadGermanSourceFace(...)?.anchors.anchorOf` yields undefined when the loader returns
       * null, and the optional chain made that indistinguishable from "no pairing was asked for".
       * The run then compared two namespaces with nothing joining them and reported the result as
       * content differences -- which the comment above says in its own words would read as a
       * content problem rather than as a missing pairing.
       *
       * Measured 2026-10-20: the loader returns null for special-relativity and a real pairing for
       * the other three (87, 128 and 25 entries). So relativity's stage reported 429 unresolved
       * differences, of which the first three I checked were a retired id recorded in
       * content/aliases with its plate evidence, a paragraph the segmenter did not join across a
       * page break, and a display whose proposal spelling is `s1-eq1` where the manifest froze
       * `eq-s1-d1`. None is a content defect, and the stage named none of them as a pairing
       * artifact.
       *
       * The null is DELIBERATE and documented: relativity's receipt holds `ledgerStatus:
       * not-started` because flipping it makes `manifestAnchors` throw, 106 paragraphs on the face
       * against 94 in the manifest. So this is not-available with the reason, and
       * `--require-stage reconcile` is what turns it back into a failure for a caller that needs
       * it -- which is the whole purpose of that flag.
       */
      if (face === null || face === undefined) pairingAbsent = true;
      else anchorOf = face.anchors.anchorOf;
    } catch (err: unknown) {
      pairingRefusal = err instanceof Error ? err.message : String(err);
    }
    const segmented = segmentLedger({
      ledgerText,
      frozenIds: manifestIds,
      ...(anchorOf !== undefined ? { anchorOf } : {}),
    });
    if (segmented.status === "absent") {
      push("reconcile", "not-available", segmented.message, {
        code: segmented.code,
        pending: [SENTENCE_UNIT_RULING],
      });
    } else {
      germanIds = germanAlignableIds(segmented.blocks);
      const differences = segmented.differences;
      const detail = differences.map((d) => `${d.kind} ${d.unitId}: ${d.message}`);
      /*
       * THE SENTENCE-DIVISION SCREEN, WHICH THE OWNER CHOSE AND NOTHING CALLED.
       *
       * am-span-recording-decision-ero2, owner decision 2026-09-21, verbatim: "Option 3 now,
       * Option 1 later". Option 3 is a harness comparing the manifest's sentence division with
       * the one a segmentation run proposes, keyed on the PRINTED PAGE because a manifest's
       * paragraph labels are an allocation history and a shared label names different paragraphs
       * on the two sides. `sentenceDivisionComparison.ts` implements it, with its per-page
       * determination and its unplaceable counters, and measured 2026-10-20 it had ZERO non-test
       * callers -- a month after the decision.
       *
       * This stage already holds all three of its inputs, and it is the stage whose sentence
       * differences need the frame: of the differences above, the sentence-level ones are
       * reported as "frozen id has no proposed ledger unit", which says nothing about WHERE the
       * two divisions part. The screen gives a page and a pair of counts.
       *
       * IT IS A SCREEN AND NOT A VERDICT, in the module's own words, so it does not change this
       * stage's outcome. It compares how many sentences each side places on a page and is blind
       * to a boundary that moves within one. Measured over the raw cut: 63 ledger pages across
       * the four papers, all comparable, 21 agreeing and 42 differing, almost all by one.
       *
       * It is run on the RAW segmenter output deliberately. The German face joins page
       * continuations and display run-ons before publishing, and a joined sentence spans two
       * pages, so the harness cannot place it: measured, joining takes brownian-motion from 0 to
       * 13 unplaceable sentences and light quanta from 1 to 13. The page key only works before
       * the join, which is what the module was built against.
       */
      const division = compareSentenceDivision({
        ledgerText,
        manifestUnits: (loadManifestUnits(root, slug) ?? []) as never,
        proposedSentences: segmented.blocks.flatMap((b) =>
          b.sentences.map((s) => ({ id: s.id, text: s.text })),
        ),
      });
      const divisionLine = formatDivisionComparison(slug, division).split("\n")[0] ?? "";
      const divisionPending = [
        `sentence-division screen (am-span-recording-decision-ero2 Option 3): ${divisionLine}`,
        ...(division.totals.differing > 0
          ? [
              `pages where the two divisions differ: ${division.pages
                .filter((page) => page.outcome === "comparable" && !page.agrees)
                .map((page) => `p${page.page} ${page.manifestSentences}/${page.proposedSentences}`)
                .join(", ")}`,
            ]
          : []),
      ];
      if (pairingAbsent) {
        push(
          "reconcile",
          "not-available",
          `No pairing between the proposal and the frozen manifest: the German source face for ` +
            `${slug} is not published, so the two namespaces cannot be compared. ` +
            `${differences.length} name difference(s) were computed without it and are retained as ` +
            `evidence, not reported as content differences.`,
          {
            code: "manifest-pairing-unavailable",
            evidence: detail,
            pending: [
              SENTENCE_UNIT_RULING,
              "the German face is held back by the paper's receipt (ledgerStatus not-started), and publishing it is am-german-face-anchors-not-frozen-ids-jtv6's; --require-stage reconcile turns this not-available into a failure",
              ...divisionPending,
            ],
          },
        );
      } else if (pairingRefusal !== undefined) {
        // Reported FIRST, because a list of name differences computed without a pairing describes
        // the missing pairing rather than the edition, and would read as a content problem.
        push(
          "reconcile",
          "failed",
          `The proposal could not be paired with the frozen manifest: ${pairingRefusal}`,
          {
            code: "manifest-pairing-refused",
            evidence: detail,
            pending: [SENTENCE_UNIT_RULING, ...divisionPending],
          },
        );
      } else if (differences.length > 0) {
        push(
          "reconcile",
          "failed",
          `${differences.length} unresolved difference(s) between the ledger proposal and the manifest: ${detail
            .slice(0, 3)
            .join("; ")}`,
          {
            code: "reconciliation-differences",
            evidence: detail,
            pending: [SENTENCE_UNIT_RULING, ...divisionPending],
          },
        );
      } else {
        push(
          "reconcile",
          "passed",
          `${segmented.blocks.length} proposed block(s) reconcile with ${manifestIds.length} manifest unit(s) with no unresolved difference. ${divisionLine}`,
          { pending: [SENTENCE_UNIT_RULING, ...divisionPending] },
        );
      }
    }
  }

  // ------------------------------------------- 3 & 4 & 7. contract-owned stages
  // THE CONTRACT IS GIVEN THE AUTHORED INPUTS, because it judged whatever its caller supplied and
  // this caller supplied none. Check 8 therefore reported `empty-alignment` for every paper while
  // 821 edges sat in content/alignments/ -- the same unsupplied-argument shape the contract's own
  // note records about check 1 and the edition declaration. The loaders are shared with
  // scripts/align-editions.ts so one rule has one implementation.
  const authoredEdges = loadAuthoredEdges(slug, root);
  /*
   * THREE POPULATIONS THE CONTRACT ASKS FOR AND THIS CALL DID NOT PASS.
   *
   * Measured 2026-10-20, the contract stage reported "9 passed and 10 not-available" on every
   * paper -- a pass over barely half the contract. Three of the ten said in their own words that
   * nothing had been supplied:
   *
   *     #10 inline-math-atoms    "no alignment components were supplied"
   *     #11 term-definitions     "no term occurrences were supplied"
   *     #13 gloss-units          "no gloss input was supplied"
   *
   * All three loaders exist in authoredInputs.ts and scripts/align-editions.ts already calls
   * them, so the data was one import away: 742 alignment components with 914 inline atoms, 30
   * term occurrences, and 542 gloss units across the corpus. The same unsupplied-argument shape
   * this file's own comments record about check 1, check 8 and the translation denominator.
   *
   * The remaining seven not-available are NOT this: #1 and #14 need an edition.yaml that no paper
   * has (a human gate: the declaration requires a human editor id from docs/OWNERS.md), #3, #7
   * and #9 need an edition text and an English face this stage does not assemble, #12 is correct
   * (no paper declares a hero quote), and #15 needs a span loader that does not exist -- the
   * 542 sentence spans are read by a test that builds the input itself.
   */
  const contractComponents = loadAlignmentComponents(slug, root);
  const contractTerms = loadTermOccurrences(slug, root);
  const contractGloss = loadGlossInput(slug, root);
  const contract = assertEditionContract(slug, {
    root,
    ...(ledgerText !== null ? { ledgerText } : {}),
    ...(authoredEdges.edges.length > 0 ? { edges: authoredEdges.edges } : {}),
    ...(manifestUnitIds(slug, root).length > 0 ? { germanIds: manifestUnitIds(slug, root) } : {}),
    ...(translationUnitIds(slug, root).length > 0
      ? { englishIds: translationUnitIds(slug, root) }
      : {}),
    ...(contractComponents.components.length > 0
      ? { components: contractComponents.components }
      : {}),
    ...(contractTerms.terms.length > 0 ? { terms: contractTerms.terms } : {}),
    ...(contractGloss.glossInput !== undefined ? { glossInput: contractGloss.glossInput } : {}),
  });
  const checkOf = (n: number) => contract.checks.find((c) => c.checkNumber === n);

  begin("ids");
  const idCheck = checkOf(6);
  push(
    "ids",
    idCheck?.outcome ?? "not-available",
    idCheck?.message ?? "Contract check 6 produced no result.",
    { ...(idCheck?.code !== undefined ? { code: idCheck.code } : {}) },
  );

  begin("digests");
  const digestCheck = checkOf(1);
  push(
    "digests",
    digestCheck?.outcome ?? "not-available",
    digestCheck?.message ?? "Contract check 1 produced no result.",
    { ...(digestCheck?.code !== undefined ? { code: digestCheck.code } : {}) },
  );

  // --------------------------------------------------------------- 5. compile
  begin("compile");
  try {
    if (!existsSync(join(root, "content"))) {
      // A root with no content directory has no records to compile. loadReadingFiles
      // throws ENOENT here, and reporting that as a compiler failure would blame the
      // compiler for an absent corpus.
      push("compile", "not-available", `No content directory at ${join(root, "content")}.`, {
        code: "content-corpus-absent",
      });
      throw new EmptyCorpusError("corpus-empty");
    }
    const files = await loadReadingFiles(root);
    if (files.length === 0) {
      // Compiling an empty corpus succeeds trivially. A pass here would say the
      // paper's records are sound when none were read, which is the defect this
      // rewrite removes, so an empty corpus is not-available.
      push("compile", "not-available", `No content records found under ${join(root, "content")}.`, {
        code: "content-corpus-absent",
      });
      throw new EmptyCorpusError("corpus-empty");
    }
    const compiled = compileReadingContent(files);
    const errors = compiled.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      push("compile", "failed", `Content compiler reported ${errors.length} error(s).`, {
        code: "compile-errors",
        evidence: errors.map((d) => `${d.code} ${d.path}: ${d.message}`),
      });
    } else {
      /*
       * THIS STAGE DOES NOT RUN THE REGISTERED CHECKS, and section G says it does.
       *
       * Section G: "`compile`: the content compiler's check entry point for the paper
       * (am-cm-compiler-core-oa7), including every registered check." Measured 2026-10-20: there
       * are two compiler entry points, and this calls the one that runs none of them.
       *
       *   compileReadingContent (compile.ts)  what this stage calls. A probe check registered
       *                                       before it never ran, so ZERO of the 26 registered
       *                                       checks are invoked. Its 247 diagnostics are the
       *                                       compiler's own review flags, `equation-review-pending`
       *                                       and `editorial-review-pending`, with no checkId.
       *   compileContent (compiler.ts)        registers the seven check families in its Phase 4 and
       *                                       calls runAllChecks. verify-content uses it.
       *
       * AND POINTING THIS STAGE AT THE OTHER ONE WOULD NOT HELP, which is why this reports rather
       * than switches. `loadReadingFiles` hands over 357 files that carry no source blocks, no
       * manifests and no journeys, so the checks' own censuses over that population read: 0 proof
       * records, 0 world checks on 0 journeys, 0 equation pairs, 0 span digests, 0 manifests, and
       * 52 editorial-note ids declined "because no source blocks were supplied for their papers".
       * The same checks under verify-content report 4 world checks on 4 journeys, 200 equation
       * pairs over 821 edges, 542 span digests on 453 blocks, 4 manifests with 37 aliases, and 7
       * real inline-mathematics differences. The checks are alive; they are alive THERE.
       *
       * So running them here would be a second owner of one rule over a smaller population, which
       * is the defect this pipeline's reconcile stage was just repaired for. The stage says what it
       * compiled and names who runs the checks.
       */
      push(
        "compile",
        "passed",
        `Content compiler accepted ${files.length} file(s) and produced ${compiled.papers.length} paper payload(s), ` +
          `with ${compiled.diagnostics.length} review flag(s) and no error.`,
        {
          pending: [
            "the 26 registered content checks are NOT run by this stage: compileReadingContent invokes none of them, and the 357 files it loads carry no source blocks, manifests or journeys for them to judge. bun scripts/verify-content.ts runs them over the whole corpus through compileContent (am-cm-compiler-core-oa7)",
          ],
        },
      );
    }
  } catch (err: unknown) {
    if (err instanceof EmptyCorpusError) {
      // RECORD THE ABORT'S OWN CODE RATHER THAN DISCARDING IT. This catch used to swallow the
      // refusal whole: it discriminated the deliberate abort by class and never read `err.code`,
      // so the code existed for no reader. That is the flattened-refusal class - a catch that
      // keeps less than it caught - and it is the same defect as a catch collapsing several named
      // conditions into one generic code, just smaller.
      //
      // The stage already pushed says WHY the corpus is absent. This says WHICH refusal stopped
      // the stage, and it amends that record rather than adding a second one, because the abort's
      // whole purpose is that the compiler is never asked and never blamed twice.
      const last = stages.at(-1);
      if (last?.stage === "compile") {
        stages[stages.length - 1] = {
          ...last,
          evidence: [...(last.evidence ?? []), `aborted-by: ${err.code}`],
        };
      }
    } else {
      push("compile", "failed", `The content compiler threw: ${String(err)}`, {
        code: "compile-threw",
      });
    }
  }

  // ----------------------------------------------------------------- 6. align
  begin("align");
  if (germanIds.length === 0) {
    push(
      "align",
      "not-available",
      "Alignment skipped: no German alignable units were segmented, so there is nothing to align.",
      { code: "no-german-units" },
    );
  } else {
    const aligned = runAlignEditions({
      slug,
      root,
      layers,
      ...(options.sections !== undefined ? { sections: options.sections } : {}),
      ...(options.requireReviewed !== undefined
        ? { requireReviewed: options.requireReviewed }
        : {}),
    });
    const issues = aligned.issues.map((i) => `${i.code}: ${i.message}`);
    if (aligned.ok) {
      /*
       * THE PASS CARRIES THE CENSUS `runAlignEditions` ALREADY COMPUTES, and it used to drop it.
       *
       * `AlignEditionsExamined` exists because of the defect align-editions.ts records in its own
       * docblock: `"issues": []` while five of the eight rules had examined nothing at all. The
       * census is returned on every run -- edges, German ids, English ids, components, terms,
       * gloss units, review units -- and this stage reported one of the seven numbers.
       *
       * A pass naming only the German unit count cannot distinguish "rules C.1 to C.8 all ran and
       * found nothing" from "five of them had no population", which is the exact thing the census
       * was built to make visible.
       */
      const examined = aligned.examined;
      push(
        "align",
        "passed",
        `Alignment validated ${germanIds.length} German unit(s): ${examined.edges} edge(s), ` +
          `${examined.englishIds} English id(s), ${examined.components} component(s), ` +
          `${examined.terms} term(s), ${examined.glossUnits} gloss unit(s), ` +
          `${examined.reviewUnits} review unit(s).`,
        {
          ...(examined.reviewUnits === 0
            ? {
                pending: [
                  "rule C.7 examined 0 review units: recordBackedReviewStateCheck asks the German-source question of a translation-layer corpus, and wiring it as written would redden four papers over a decision disagreement (am-edit-review-records-hofz)",
                ],
              }
            : {}),
        },
      );
    } else {
      push(
        "align",
        "failed",
        `Alignment reported ${issues.length} issue(s): ${issues.slice(0, 3).join("; ")}`,
        {
          code: aligned.issues[0]?.code ?? "alignment-issues",
          evidence: issues,
        },
      );
    }
  }

  // -------------------------------------------------------------- 7. contract
  begin("contract");
  const failedChecks = contract.checks.filter((c) => c.outcome === "failed");
  const perPaperTests = ["edition", "translation", "gloss", "review"].map(
    (kind) => `src/content/editions/<paperFile>.${kind}.test.ts`,
  );
  push(
    "contract",
    contract.outcome,
    failedChecks.length > 0
      ? `Edition contract failed ${failedChecks.length} check(s): ${failedChecks
          .map((c) => `#${c.checkNumber} ${c.code ?? c.check}`)
          .join("; ")}`
      : `Edition contract reported ${contract.checks.filter((c) => c.outcome === "passed").length} passed and ${contract.checks.filter((c) => c.outcome === "not-available").length} not-available.`,
    {
      // The checks that reached NO verdict are named, not only counted. "5 passed and 10
      // not-available" is honest about the arithmetic and says nothing about which ten, and a stage
      // that passes while two thirds of its checks examined nothing is exactly the citation AGENTS.md
      // warns about. Naming them puts the gap where a reader of the run will see it.
      evidence: [
        ...failedChecks.map((c) => `#${c.checkNumber} ${c.code ?? c.check}: ${c.message}`),
        ...contract.checks
          .filter((c) => c.outcome === "not-available")
          .map((c) => `not-available #${c.checkNumber} ${c.check}: ${c.message}`),
      ],
      pending: [
        `per-paper edition test files do not exist in this tree (${perPaperTests.join(", ")}); this stage runs assertEditionContract and does not run bun test (am-edn-alignment-tooling-do1)`,
      ],
    },
  );

  // -------------------------------------------------------------- 8. coverage
  begin("coverage");
  // THE TRANSLATION UNITS ARE COUNTED, not assumed to be none. This passed a literal 0, which
  // `translationCompleteness` turns into the verdict "incomplete" whatever is on disk -- so every
  // paper's coverage report said the translation was incomplete while 821 unit records sat in
  // content/translation-units/ (43, 235, 162 and 381), all four of which AGENTS.md records as final
  // under D-2026-09-25-agent-reviewed-translations. A hardcoded denominator is not a measurement, and
  // this one was reported in a reader- and owner-facing artifact.
  const translationUnits = translationUnitIds(slug, root);
  /*
   * THREE MORE OPTIONAL INPUTS THIS CALL NEVER PASSED, and each defaulted to absent in a
   * reader- and owner-facing artifact. This is the same defect the paragraph above records being
   * fixed once, for the translation denominator, three more times in the same call.
   *
   * Measured 2026-10-20, the report brownian-motion's own run wrote:
   *
   *     german-edition  absent  107  "German edition not yet authored."
   *     alignment       absent    0  "Alignment is explicit many-to-many edges, never paragraph counts."
   *     gloss           absent    0  "Gloss coverage is counted by unit kind, not as a score."
   *
   * All three are authored, and two of the three numbers were already in this process: the align
   * stage of the SAME RUN validated 162 edges for that paper. `coverageReport` reads
   * `alignmentEdgeCount` and `glossUnitCount` as optional and treats undefined as zero, so the
   * row said "absent" about content on disk.
   *
   * Across the four papers: 43, 162, 235 and 381 alignment edges, and 34, 103, 161 and 244 gloss
   * units -- the gloss figures matching AGENTS.md's own count to the unit. `germanEditionPresent`
   * is read from the authored source blocks rather than from the manifest, because the row's note
   * says "German edition blocks authored" and that is a statement about the block files: 29, 92,
   * 133 and 218 of them.
   */
  // `authoredEdges` is the contract stage's, loaded above for the same reason and reused rather
  // than re-read: one load, and the two stages cannot disagree about the edge count.
  const glossInput = loadGlossInput(slug, root);
  const sourceBlockDir = join(root, "content/source-blocks", slug);
  const germanEditionPresent =
    existsSync(sourceBlockDir) &&
    readdirSync(sourceBlockDir).some((name) => !name.startsWith("manifest."));
  const report = coverageReport({
    slug,
    germanUnitCount: germanIds.length,
    translationUnitCount: translationUnits.length,
    alignmentEdgeCount: authoredEdges.edges.length,
    glossUnitCount: glossInput.glossInput?.glossUnits.length ?? 0,
    germanEditionPresent,
    root,
  });
  const markdown = coverageReportMarkdown(report);
  const json = coverageReportJson(report);
  const coverageDir = join(root, "artifacts/edition-coverage", slug);
  const coverageRunId = newRunIdentity();
  mkdirSync(coverageDir, { recursive: true });
  const coverageJsonPath = join(coverageDir, `${coverageRunId}.json`);
  const coverageMarkdownPath = join(coverageDir, `${coverageRunId}.md`);
  writeFileSync(coverageJsonPath, json);
  writeFileSync(coverageMarkdownPath, markdown);
  // Section F: the report carries no percentage, score, or aggregate completeness figure.
  // coverageReportIsHonest owns that rule, and the stage fails when the file it has just
  // written breaks it instead of reporting that a report was written and stopping there.
  if (coverageReportIsHonest(markdown, json)) {
    push(
      "coverage",
      "passed",
      `Coverage report written to ${coverageJsonPath} and ${coverageMarkdownPath}: ledger ${report.ledger}, ` +
        `translation ${report.translation}, no aggregate figure. Layers: ` +
        `${report.layers.map((l) => `${l.layer} ${l.presence} ${l.unitCount}`).join(", ")}.`,
    );
  } else {
    push(
      "coverage",
      "failed",
      `The coverage report written to ${coverageMarkdownPath} carries a percentage, score, or aggregate completeness figure.`,
      { code: "coverage-report-not-honest", evidence: [coverageJsonPath, coverageMarkdownPath] },
    );
  }

  // ----------------------------------------------------------- 9. static-html
  /*
   * THE FIVE SCANS OF SECTION G, over each face in the layers.
   *
   * Audited 2026-10-20. This stage performed two of the five, over one route, and both of the two
   * were wrong in the direction that reads as a pass:
   *
   *   - the marker regex was keyed on the word REVIEWED while all four shipping ledgers open
   *     `--- MACHINE DRAFT TRANSCRIPTION PAGE n OF m ---`, so the only form it could meet was
   *     the one it could not match. Two other modules had already been bitten by that exact
   *     keying and fixed it; this was the third copy. It now imports the owned pattern;
   *   - the LaTeX test ran over the whole file, where a match proves nothing: one relativity face
   *     carries 505 KaTeX annotations and 1,213 flight-payload chunks, 351 `\frac` among them.
   *     Scanning reader-visible text instead found one real defect on two built pages.
   *
   * The scans themselves, their populations and their negative controls are
   * `src/content/editions/staticHtmlScan.ts`; this is the file-finding and reporting half.
   */
  begin("static-html");
  const outDir = join(root, "out");
  const scannedFaces = layers
    .map((layer) => FACE_FOR_LAYER[layer])
    .filter((face): face is ScannedFace => face !== undefined);
  const anchorUnits = loadManifestUnits(root, slug) ?? [];
  const faceRoutes = scannedFaces.map((face) => ({
    face,
    path: join(outDir, "papers", slug, "view", face, "index.html"),
  }));
  const missingRoutes = faceRoutes.filter((route) => !existsSync(route.path));
  if (scannedFaces.length === 0) {
    push(
      "static-html",
      "not-available",
      `No layer in [${layers.join(", ")}] is published as a reading face, so no emitted HTML was scanned.`,
      { code: "static-html-no-face" },
    );
  } else if (missingRoutes.length > 0) {
    push(
      "static-html",
      "not-available",
      `No prerendered page at ${missingRoutes
        .map((route) => `out/papers/${slug}/view/${route.face}/index.html`)
        .join(", ")}, so the emitted HTML cannot be scanned. Run bun run build first.`,
      { code: "static-html-not-available" },
    );
  } else {
    const findings: string[] = [];
    const census: string[] = [];
    const notes: string[] = [];
    for (const route of faceRoutes) {
      const html = readFileSync(route.path, "utf8");
      const anchors = anchorsForFace(route.face, anchorUnits, options.sections);
      const scan = scanFaceHtml({ html, face: route.face, expectedAnchors: anchors.expected });
      for (const finding of scan.findings) {
        findings.push(
          `${route.face}: ${finding.code}: ${finding.message}${
            finding.sample ? ` -- ${finding.sample}` : ""
          }`,
        );
      }
      census.push(
        `${route.face} ${Math.round(scan.examined.bytes / 1024)}K ` +
          `(${Math.round(scan.examined.readerVisibleBytes / 1024)}K read by a reader), ` +
          `${scan.examined.declaredIds} ids, ` +
          `${scan.examined.anchorsResolved} of ${scan.examined.anchorsExpected} anchors, ` +
          `${scan.examined.germanTextElements} German element(s)`,
      );
      for (const note of [...anchors.notes, ...scan.notes]) notes.push(`${route.face}: ${note}`);
    }
    const built = faceRoutes
      .map((route) => statSync(route.path).mtime.toISOString())
      .sort()
      .at(-1);
    if (findings.length > 0) {
      push("static-html", "failed", `Emitted HTML: ${findings.length} finding(s). ${findings[0]}`, {
        code: "static-html-findings",
        evidence: findings,
      });
    } else {
      push(
        "static-html",
        "passed",
        `Five scans clean over ${faceRoutes.length} face(s), oldest written ${built}: ${census.join("; ")}.`,
        {
          pending: [
            ...notes,
            "whether out/ was built from the current commit is not checked here, and a scan of stale output is a scan of stale output (build freshness belongs to am-rel-verified-deploy-qndt)",
            'an UNTAGGED running head is the bare line "A. Einstein.", which the printed author line also is, so only the tagged form is scanned',
          ],
        },
      );
    }
  }

  // ------------------------------------------------------------------ logging
  const logger = options.logger ?? new TestLogger("edition-pipeline");
  for (const stage of stages) {
    logger.log({
      testId: `${slug}:${stage.stage}`,
      paper: slug,
      outcome: stage.outcome,
      durationMs: stage.durationMs,
      message: stage.message,
      ...(stage.code !== undefined ? { extra: { code: stage.code } } : {}),
    });
  }
  await logger.flush();

  // Failure evidence is retained beside the log, never deleted by this script.
  const evidenceRoot = join(dirname(logger.filePath), logger.logRunId, "evidence");
  for (const stage of stages) {
    if (stage.outcome !== "failed" || stage.evidence === undefined) continue;
    const file = join(evidenceRoot, stage.stage, "findings.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({ slug, stage: stage.stage, findings: stage.evidence }, null, 2),
    );
  }

  const completeness = translationCompleteness({
    ledger: presence.presence,
    translationUnitCount: 0,
    germanAlignableCount: germanIds.length,
  });

  if (options.requireStage) {
    const required = stages.find((s) => s.stage === options.requireStage);
    if (required?.outcome !== "passed") {
      return {
        exitCode: 1,
        slug,
        translationCompleteness: completeness,
        stages: Object.freeze(stages),
        logPath: logger.filePath,
      };
    }
  }
  const failed = stages.some((s) => s.outcome === "failed");
  return {
    exitCode: failed ? 1 : 0,
    slug,
    translationCompleteness: completeness,
    stages: Object.freeze(stages),
    logPath: logger.filePath,
  };
}

/**
 * WHICH PAPER THE RUN IS ABOUT, AND A REFUSAL WHEN THAT IS NOT CLEAR.
 *
 * This was `argValue("--paper") ?? argValue("--slug") ?? "brownian-motion"`, which reads only the
 * two flags. A POSITIONAL argument was ignored in silence, so
 * `bun scripts/e2e-edition-pipeline.ts mass-energy` ran the whole nine-stage pipeline against
 * BROWNIAN-MOTION and printed `"slug": "brownian-motion"` in a result nobody re-reads after
 * scrolling to the stage table. Measured 2026-10-14: three different slugs passed positionally
 * all produced `result slug: brownian-motion`, with `reconcile` failing on brownian's own block
 * ids (s1-p5, s3-p3) while the operator believed they had asked about a paper that has no
 * sections. With the flag, mass-energy and special-relativity differ: special-relativity also
 * fails `align` and `contract`, which no positional run could ever have shown.
 *
 * The default was the other half of the same trap: a bare invocation picked one paper and said so
 * only inside the JSON. Nothing in a gate runs this script, so a refusal costs nobody anything and
 * AGENTS.md's first rule applies -- a run over the wrong population reads exactly like a clean one.
 *
 * Exported so the argument handling can be driven in a test without spawning a process.
 */
export function resolveSlugArgument(argv: readonly string[]):
  | {
      ok: true;
      slug: RouteSlug;
    }
  | {
      ok: false;
      error: string;
    } {
  const flags = ["--paper", "--slug"];
  let fromFlag: string | undefined;
  const positionals: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (flags.includes(arg)) {
      fromFlag = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      // Every other flag this script reads takes a value, except --require-reviewed.
      if (arg !== "--require-reviewed") i += 1;
      continue;
    }
    positionals.push(arg);
  }

  const candidates = [fromFlag, ...positionals].filter((c): c is string => c !== undefined);
  if (candidates.length === 0) {
    return {
      ok: false,
      error:
        "Name the paper: --paper <slug>, or pass the slug as the single argument. " +
        "There is no default, because a run that silently chose one paper and reported on it " +
        "reads exactly like a run of the paper you asked for.",
    };
  }
  const distinct = [...new Set(candidates)];
  if (distinct.length > 1) {
    return {
      ok: false,
      error: `More than one paper was named (${distinct.join(", ")}); this runs one paper at a time.`,
    };
  }
  const parsed = parseRouteSlug(distinct[0] ?? "");
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, slug: parsed.value };
}

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const parsed = resolveSlugArgument(process.argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(2);
  }
  const requireParsed = resolveRequireStageArgument(argValue("--require-stage"));
  if (!requireParsed.ok) {
    console.error(requireParsed.error);
    process.exit(2);
  }
  const layersRaw = argValue("--layers");
  const sectionsRaw = argValue("--sections");
  const result = await runEditionPipeline({
    slug: parsed.slug,
    ...(requireParsed.stage !== undefined ? { requireStage: requireParsed.stage } : {}),
    ...(layersRaw !== undefined ? { layers: layersRaw.split(",") } : {}),
    ...(sectionsRaw !== undefined ? { sections: sectionsRaw.split(",") } : {}),
    requireReviewed: process.argv.includes("--require-reviewed"),
  });
  console.log(JSON.stringify(result, null, 2));
  for (const stage of result.stages) {
    console.log(`${stage.stage.padEnd(12)} ${stage.outcome.padEnd(14)} ${stage.durationMs}ms`);
  }
  process.exit(result.exitCode);
}
