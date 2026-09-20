/**
 * Source Manifest Corpus Validation Engine.
 *
 * Enforces page coverage, spans, sequence continuity, alias explanations,
 * footnote and display equation rules, status derivations, and epistemic import/export chronology.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import { type AliasRecord, explainGap } from "../aliases.ts";
import type {
  ManifestDiagnostic,
  ManifestUnit,
  PaperSourceLayers,
  SourceManifest,
} from "./types.ts";

export const KNOWN_DOCUMENT_JOURNAL_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  "ap-17-132": [132, 148],
  "ap-17-549": [549, 560],
  "ap-17-891": [891, 921],
  "ap-18-639": [639, 641],
  "ap-19-289": [289, 306],
  "ap-34-591": [591, 592],
};

export interface ManifestValidationContext {
  readonly manifests: ReadonlyMap<string, SourceManifest>;
  readonly aliases?: readonly AliasRecord[] | undefined;
  readonly citations?: ReadonlySet<string> | undefined;
  readonly sourceBlocks?:
    | ReadonlyMap<string, { readonly diplomaticText: string; readonly printedLatex?: string }>
    | undefined;
  readonly frozenSnapshots?: ReadonlyMap<string, readonly string[]> | undefined;
  readonly paperDates?:
    | ReadonlyMap<string, { readonly received: string; readonly published?: string }>
    | undefined;
  readonly sourceLayers?: ReadonlyMap<string, PaperSourceLayers> | undefined;
}

export interface ManifestValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly ManifestDiagnostic[];
}

/**
 * Determines whether a unit spans multiple printed pages.
 */
export function spansPages(unit: ManifestUnit): boolean {
  if (!unit.locators || unit.locators.length === 0) return false;
  const pages = unit.locators.map((l) => l.page);
  const min = Math.min(...pages);
  const max = Math.max(...pages);
  return max > min;
}

/**
 * Validates a single SourceManifest against its own rules and the corpus context.
 */
export function validateManifest(
  manifest: SourceManifest,
  context: ManifestValidationContext,
): ManifestDiagnostic[] {
  const diagnostics: ManifestDiagnostic[] = [];

  const addDiag = (
    severity: "error" | "flag",
    rule: string,
    message: string,
    extra?: Partial<ManifestDiagnostic>,
  ) => {
    diagnostics.push({
      severity,
      rule,
      paper: manifest.paper,
      document: manifest.document,
      message,
      file: `source-blocks/${manifest.paper}/manifest.yaml`,
      path: `source-blocks/${manifest.paper}/manifest.yaml`,
      ...extra,
    });
  };

  const [startPage, endPage] = manifest.pageRange;

  // Check known journal ranges
  const knownRange = KNOWN_DOCUMENT_JOURNAL_RANGES[manifest.document];
  if (knownRange) {
    const [knownStart, knownEnd] = knownRange;
    if (startPage < knownStart || endPage > knownEnd) {
      addDiag(
        "error",
        "journal-range-mismatch",
        `Manifest pageRange [${startPage}, ${endPage}] exceeds known journal page range [${knownStart}, ${knownEnd}] for document '${manifest.document}'.`,
        {
          expected: knownRange,
          actual: manifest.pageRange,
          repair: `Align manifest pageRange to be within journal range [${knownStart}, ${knownEnd}].`,
        },
      );
    }
  }

  // Empty units: a complete paper cannot omit its source inventory. An
  // in-preparation paper may be empty; that is absence, not a reviewed edition.
  if (manifest.units.length === 0) {
    if (manifest.status === "complete") {
      addDiag(
        "error",
        "empty-manifest",
        `Source manifest for '${manifest.paper}' is marked complete with no units. Completeness cannot be claimed without an inventory.`,
        {
          repair: "Inventory units from the pinned facsimile, or keep status in-preparation.",
        },
      );
    } else {
      addDiag(
        "flag",
        "source-units-absent",
        `Source units for '${manifest.paper}' are absent. The facsimile is not pinned; invented units are not admitted.`,
        {
          repair:
            "Inventory units from the pinned facsimile. Until then keep status in-preparation and units empty.",
        },
      );
    }
    return diagnostics;
  }

  // =========================================================================
  // 1. Page Coverage and Bounds
  // =========================================================================
  const pageUnits = new Map<number, ManifestUnit[]>();
  for (let p = startPage; p <= endPage; p++) {
    pageUnits.set(p, []);
  }

  let previousBodyEndPage: number | null = null;
  const unitsById = new Map<string, ManifestUnit>();

  for (const unit of manifest.units) {
    unitsById.set(unit.id, unit);

    if (unit.locators.length === 0) {
      addDiag("error", "unit-locators-missing", `Unit '${unit.id}' has no locators.`, {
        unitId: unit.id,
      });
      continue;
    }

    const unitStartPage = unit.locators[0]?.page ?? startPage;
    const unitEndPage = unit.locators[unit.locators.length - 1]?.page ?? unitStartPage;
    let lastLocPage = 0;

    for (let i = 0; i < unit.locators.length; i++) {
      const loc = unit.locators[i];
      if (!loc) continue;

      // Out of range check
      if (loc.page < startPage || loc.page > endPage) {
        addDiag(
          "error",
          "page-out-of-range",
          `Printed page ${loc.page} for unit '${unit.id}' is outside paper range [${startPage}, ${endPage}].`,
          {
            unitId: unit.id,
            expected: [startPage, endPage],
            actual: loc.page,
            repair: `Adjust locator page to be within [${startPage}, ${endPage}].`,
          },
        );
      }

      // Locators non-decreasing check
      if (loc.page < lastLocPage) {
        addDiag(
          "error",
          "locators-decreasing",
          `Unit '${unit.id}' locators decrease in page order (${lastLocPage} -> ${loc.page}).`,
          {
            unitId: unit.id,
            expected: `>= ${lastLocPage}`,
            actual: loc.page,
          },
        );
      } else if (
        loc.page === lastLocPage &&
        loc.column !== undefined &&
        unit.locators[i - 1]?.column !== undefined
      ) {
        const prevCol = unit.locators[i - 1]?.column;
        if (prevCol !== undefined && loc.column < prevCol) {
          addDiag(
            "error",
            "locators-decreasing",
            `Unit '${unit.id}' column locators decrease on page ${loc.page}.`,
            { unitId: unit.id },
          );
        }
      }
      lastLocPage = loc.page;

      // Register page coverage
      if (loc.page >= startPage && loc.page <= endPage) {
        pageUnits.get(loc.page)?.push(unit);
      }
    }

    // Multi-page unit span continuity: a unit spanning across multiple printed pages
    // (e.g. a paragraph spanning three printed pages) must cover all intermediate pages,
    // including the middle page(s).
    if (spansPages(unit) && unitEndPage > unitStartPage + 1) {
      const unitLocatorPages = new Set(unit.locators.map((l) => l.page));
      for (let p = unitStartPage + 1; p < unitEndPage; p++) {
        if (!unitLocatorPages.has(p)) {
          addDiag(
            "error",
            "unit-span-gap",
            `Unit '${unit.id}' spans pages ${unitStartPage}–${unitEndPage} but is missing a locator for intermediate page ${p}. A paragraph spanning three printed pages must cover the middle page.`,
            {
              unitId: unit.id,
              expected: `Locator for page ${p}`,
              actual: `Missing page ${p}`,
              repair: `Add a locator entry for page ${p} to unit '${unit.id}' locators list.`,
            },
          );
        }
      }
    }

    // Body units start page order check (paragraphs, headings, closing units)
    const isBodyUnit =
      unit.kind === "paragraph" ||
      unit.kind === "heading" ||
      unit.kind === "part-heading" ||
      unit.kind === "section-heading" ||
      unit.kind === "masthead" ||
      unit.kind === "masthead-title" ||
      unit.kind === "masthead-author";

    if (isBodyUnit) {
      if (previousBodyEndPage !== null && unitStartPage < previousBodyEndPage) {
        addDiag(
          "error",
          "unit-order-decreasing",
          `Body unit '${unit.id}' start page (${unitStartPage}) precedes previous body unit's end page (${previousBodyEndPage}).`,
          { unitId: unit.id },
        );
      }
      if (previousBodyEndPage === null) {
        previousBodyEndPage = unitEndPage;
      } else {
        previousBodyEndPage = Math.max(previousBodyEndPage, unitEndPage);
      }
    }
  }

  // Check that every page in pageRange is covered by at least one unit
  for (let p = startPage; p <= endPage; p++) {
    const unitsOnPage = pageUnits.get(p) ?? [];
    if (unitsOnPage.length === 0) {
      addDiag(
        "error",
        "page-uncovered",
        `Page ${p} has no unit span. Every page in [${startPage}, ${endPage}] must contain at least one unit.`,
        {
          expected: `At least 1 unit on page ${p}`,
          actual: 0,
          repair: `Add a unit or expand a spanning unit's locators to cover page ${p}.`,
        },
      );
    }
  }

  // =========================================================================
  // 2. Footnotes, Display Equations, and containedIn
  // =========================================================================
  for (const unit of manifest.units) {
    if (unit.containedIn) {
      const parent = unitsById.get(unit.containedIn);
      if (!parent) {
        addDiag(
          "error",
          "containedin-target-invalid",
          `Unit '${unit.id}' containedIn references missing unit '${unit.containedIn}'.`,
          { unitId: unit.id },
        );
      } else {
        const isParentValid =
          parent.kind === "paragraph" ||
          parent.kind === "footnote" ||
          parent.kind === "heading" ||
          parent.kind === "section-heading";
        if (!isParentValid) {
          addDiag(
            "error",
            "containedin-target-invalid",
            `Unit '${unit.id}' containedIn references unit '${unit.containedIn}' with invalid kind '${parent.kind}'.`,
            { unitId: unit.id },
          );
        }
      }
    }

    if (unit.kind === "footnote") {
      if (!unit.footnoteMark && !unit.unmarked) {
        addDiag(
          "error",
          "footnote-unmarked",
          `Footnote '${unit.id}' has no corresponding text mark and is not marked 'unmarked: true'.`,
          {
            unitId: unit.id,
            repair: `Add footnoteMark or specify 'unmarked: true' with unmarkedReason.`,
          },
        );
      }

      // Check split page footnote against mark page
      const fnPage = unit.locators[0]?.page;
      const parentP = unit.containedIn ? unitsById.get(unit.containedIn) : undefined;
      const parentPage = parentP?.locators[0]?.page;
      const effectiveMarkPage = unit.markPage ?? parentPage;

      if (fnPage !== undefined && effectiveMarkPage !== undefined) {
        if (fnPage < effectiveMarkPage) {
          addDiag(
            "error",
            "footnote-precedes-mark",
            `Footnote '${unit.id}' printed on page ${fnPage} precedes mark on page ${effectiveMarkPage}.`,
            {
              unitId: unit.id,
              expected: `>= ${effectiveMarkPage}`,
              actual: fnPage,
              repair: `Footnote cannot appear on a page before the sentence carrying its mark.`,
            },
          );
        } else if (fnPage === effectiveMarkPage + 1) {
          const isRecorded =
            unit.isSplitFootnote === true ||
            unit.locators.some((l) => l.splitPage) ||
            (unit.markPage !== undefined && unit.locators.some((l) => l.splitPage));
          if (!isRecorded) {
            addDiag(
              "error",
              "footnote-split-unrecorded",
              `Footnote '${unit.id}' printed on page ${fnPage} after mark on page ${effectiveMarkPage} must be recorded with splitPage.`,
              {
                unitId: unit.id,
                expected: "splitPage: true or isSplitFootnote: true",
                actual: "unrecorded",
                repair: `Record 'splitPage: true' on locator or 'isSplitFootnote: true' on footnote '${unit.id}' with 'markPage: ${effectiveMarkPage}'.`,
              },
            );
          }
        } else if (fnPage > effectiveMarkPage + 1) {
          addDiag(
            "error",
            "footnote-page-too-far",
            `Footnote '${unit.id}' printed on page ${fnPage} is more than one page after mark on page ${effectiveMarkPage}. Footnotes can only appear on the mark page or the immediately following page.`,
            {
              unitId: unit.id,
              expected: `Page ${effectiveMarkPage} or ${effectiveMarkPage + 1}`,
              actual: fnPage,
              repair: `Verify locator page ${fnPage} against facsimile or correct markPage.`,
            },
          );
        }
      }
    }

    if ((unit.kind === "equation" || unit.kind === "display-equation") && unit.containedIn) {
      const parentP = unitsById.get(unit.containedIn);
      const parentLastLoc = parentP?.locators[parentP.locators.length - 1];
      const eqFirstLoc = unit.locators[0];
      if (parentLastLoc && eqFirstLoc) {
        const parentEndPage = parentLastLoc.page;
        const eqStartPage = eqFirstLoc.page;
        if (parentEndPage < eqStartPage) {
          addDiag(
            "error",
            "equation-containedin-mismatch",
            `Display equation '${unit.id}' on page ${eqStartPage} cannot be contained in paragraph '${unit.containedIn}' that ends on page ${parentEndPage}.`,
            { unitId: unit.id },
          );
        }
      }
    }
  }

  // Check duplicate printed equation labels without section qualification
  const printedEqLabels = new Map<string, ManifestUnit[]>();
  for (const unit of manifest.units) {
    if ((unit.kind === "equation" || unit.kind === "display-equation") && unit.originalLabel) {
      const list = printedEqLabels.get(unit.originalLabel) ?? [];
      list.push(unit);
      printedEqLabels.set(unit.originalLabel, list);
    }
  }

  for (const [label, eqs] of printedEqLabels.entries()) {
    if (eqs.length > 1) {
      for (const eq of eqs) {
        // am-o44v: `!eq.id.includes("-s") &&` stood here too. AGENTS.md fixes the qualified
        // form as #eq-s<n>-<printed>, which the regex already tests; the substring clause let
        // any id containing those two characters anywhere count as qualified, so an unqualified
        // eq-17-series escaped this error. Measured before removing it: of 130 equation ids in
        // the committed manifests, 128 match the regex and 0 depended on the loose clause.
        if (!eq.id.match(/^eq-s\d+/)) {
          addDiag(
            "error",
            "duplicate-equation-anchor",
            `Equation '${eq.id}' with repeated printed label '${label}' must be section-qualified (e.g. 'eq-s3-1').`,
            { unitId: eq.id },
          );
        }
      }
    }
  }

  // =========================================================================
  // 3. References and Citations (Reference Occurrences)
  // =========================================================================
  for (const unit of manifest.units) {
    if (unit.references) {
      for (const ref of unit.references) {
        const occurrenceId = ref.occurrenceId ?? ref.id;
        const hasOccurrencePattern = Boolean(occurrenceId?.match(/^.+-r[1-9]\d*$/));
        const matchesUnitPrefix =
          Boolean(occurrenceId) &&
          (occurrenceId.startsWith(`${unit.id}-r`) ||
            occurrenceId.startsWith(`${unit.id}-s`) ||
            Boolean(unit.containedIn && occurrenceId.startsWith(`${unit.containedIn}-`)));

        if (!hasOccurrencePattern || !matchesUnitPrefix) {
          addDiag(
            "error",
            "reference-occurrence-id-invalid",
            `Reference sub-entry in unit '${unit.id}' has invalid reference occurrence ID '${occurrenceId}'. Reference occurrence IDs must match '<alignableUnitId>-r<i>' (e.g. '${unit.id}-r1') naming the occurrence in the text, not the target citation.`,
            {
              unitId: unit.id,
              expected: `${unit.id}-r<i>`,
              actual: occurrenceId,
              repair: `Change reference occurrence ID to '${unit.id}-r1' matching the unit prefix and an occurrence index.`,
            },
          );
          addDiag(
            "error",
            "reference-id-invalid",
            `Reference sub-entry ID '${ref.id}' in unit '${unit.id}' must match '<unit>-r<i>'.`,
            {
              unitId: unit.id,
              expected: `${unit.id}-r<i>`,
              actual: ref.id,
              repair: `Change reference occurrence ID to '${unit.id}-r1' matching the unit prefix and an occurrence index.`,
            },
          );
        }

        const citationId = ref.target?.citationId ?? ref.targetCitationId;
        if (citationId) {
          if (context.citations && !context.citations.has(citationId)) {
            const isComplete = manifest.status === "complete";
            addDiag(
              isComplete ? "error" : "flag",
              isComplete ? "citation-not-found" : "reference-target-unresolved",
              `Reference '${ref.id}' points to unknown citation '${citationId}'.`,
              { unitId: unit.id },
            );
          }
        } else if (!ref.target?.id) {
          addDiag(
            "flag",
            "citation-target-missing",
            `Reference '${ref.id}' in unit '${unit.id}' has no target citation or internal reference.`,
            { unitId: unit.id },
          );
        }
      }
    }
  }

  // =========================================================================
  // 4. Status and Completeness
  // =========================================================================
  const aliases = context.aliases ?? [];
  const inScopeUnits = manifest.units.filter((u) => u.scope !== "not-in-scope");
  const notInScopeUnits = manifest.units.filter((u) => u.scope === "not-in-scope");

  if (manifest.status === "complete") {
    if (notInScopeUnits.length > 0) {
      addDiag(
        "error",
        "companion-scope-invalid",
        `Paper marked complete cannot have units with scope: 'not-in-scope'.`,
      );
    }
    const unreviewed = inScopeUnits.filter(
      (u) => u.status && u.status !== "reviewed" && u.status !== "accepted",
    );
    if (unreviewed.length > 0) {
      addDiag(
        "error",
        "manifest-incomplete",
        `Paper marked complete has ${unreviewed.length} unreviewed unit(s).`,
        { actual: unreviewed.map((u) => u.id).join(", ") },
      );
    }

    // A complete paper requires all canonical source layers to be present.
    // Absent source layers are a typed state; absence is never completeness.
    if (context.sourceLayers) {
      const layers = context.sourceLayers.get(manifest.paper);
      if (layers) {
        const absent = Object.values(layers).filter((l) => l.state === "absent");
        if (absent.length > 0) {
          addDiag(
            "error",
            "absent-source-layers-cannot-be-complete",
            `Paper '${manifest.paper}' is marked complete, but source layer(s) [${absent.map((l) => l.layer).join(", ")}] are absent. Absence is never completeness.`,
            {
              repair:
                "Keep status as 'in-preparation' until all source layers are present and reviewed.",
            },
          );
        }
      }
    }

    if (manifest.scope === "full-document") {
      const hasClosingReceived = manifest.units.some(
        (u) =>
          u.kind === "closing-received" || u.kind === "closing-dateline" || u.kind === "closing",
      );
      if (!hasClosingReceived) {
        addDiag(
          "error",
          "closing-received-missing",
          `Complete full-document manifest for '${manifest.paper}' must include a closing-received unit.`,
          {
            repair: `Add a 'closing-received' unit for the receipt date printed on the facsimile.`,
          },
        );
      }
    }
  }

  // =========================================================================
  // 5. Sequence Gaps & Aliases
  // =========================================================================
  // Group paragraphs by section
  const sectionParagraphs = new Map<string, number[]>();
  for (const unit of manifest.units) {
    if (unit.kind === "paragraph") {
      const match = unit.id.match(/^s(\d+)-p(\d+)$/);
      if (match?.[1] && match[2]) {
        const sec = `s${match[1]}`;
        const pNum = Number.parseInt(match[2], 10);
        const list = sectionParagraphs.get(sec) ?? [];
        list.push(pNum);
        sectionParagraphs.set(sec, list);
      }
    }
  }

  for (const [sec, pNums] of sectionParagraphs.entries()) {
    if (pNums.length === 0) continue;
    const sorted = [...pNums].sort((a, b) => a - b);
    const minP = sorted[0];
    const maxP = sorted[sorted.length - 1];
    if (minP === undefined || maxP === undefined) continue;
    const numSet = new Set(sorted);

    for (let p = minP; p <= maxP; p++) {
      if (!numSet.has(p)) {
        const missingId = `${sec}-p${p}`;
        const gapStatus = explainGap(missingId, aliases);
        if (gapStatus.status === "unexplained") {
          addDiag(
            "error",
            "sequence-gap",
            `Unexplained paragraph sequence gap: missing '${missingId}'. Must have a registered alias record or consecutive numbering.`,
            {
              unitId: missingId,
              repair: `Register an alias in content/aliases/ for '${missingId}' or renumber.`,
            },
          );
        }
      }
    }
  }

  // Group footnotes by section / document
  const sectionFootnotes = new Map<string, { nums: number[]; isDocLevel: boolean }>();
  for (const unit of manifest.units) {
    if (unit.kind === "footnote") {
      const matchSec = unit.id.match(/^s(\d+)-fn(\d+)$/);
      if (matchSec?.[1] && matchSec[2]) {
        const sec = `s${matchSec[1]}`;
        const fnNum = Number.parseInt(matchSec[2], 10);
        const entry = sectionFootnotes.get(sec) ?? { nums: [], isDocLevel: false };
        entry.nums.push(fnNum);
        sectionFootnotes.set(sec, entry);
      } else {
        const matchDoc = unit.id.match(/^fn(\d+)$/);
        if (matchDoc?.[1]) {
          const fnNum = Number.parseInt(matchDoc[1], 10);
          const entry = sectionFootnotes.get("doc") ?? { nums: [], isDocLevel: true };
          entry.nums.push(fnNum);
          sectionFootnotes.set("doc", entry);
        }
      }
    }
  }

  for (const [sec, entry] of sectionFootnotes.entries()) {
    if (entry.nums.length === 0) continue;
    const sorted = [...entry.nums].sort((a, b) => a - b);
    const minFn = sorted[0];
    const maxFn = sorted[sorted.length - 1];
    if (minFn === undefined || maxFn === undefined) continue;
    const numSet = new Set(sorted);

    for (let f = minFn; f <= maxFn; f++) {
      if (!numSet.has(f)) {
        const missingId = entry.isDocLevel ? `fn${f}` : `${sec}-fn${f}`;
        const gapStatus = explainGap(missingId, aliases);
        if (gapStatus.status === "unexplained") {
          addDiag(
            "error",
            "sequence-gap",
            `Unexplained footnote sequence gap: missing '${missingId}'. Must have a registered alias record or consecutive numbering.`,
            {
              unitId: missingId,
              repair: `Register an alias in content/aliases/ for '${missingId}' or renumber footnotes.`,
            },
          );
        }
      }
    }
  }

  // Check frozen snapshot IDs
  if (context.frozenSnapshots) {
    const frozenList = context.frozenSnapshots.get(manifest.paper);
    if (frozenList) {
      const currentUnitIds = new Set(manifest.units.map((u) => u.id));
      for (const frozenId of frozenList) {
        if (!currentUnitIds.has(frozenId)) {
          const gap = explainGap(frozenId, aliases);
          if (gap.status !== "explained" || gap.alias.kind !== "retired") {
            addDiag(
              "error",
              "frozen-id-missing",
              `Frozen id '${frozenId}' is missing from manifest without a registered 'retired' alias.`,
              { unitId: frozenId },
            );
          }
        }
      }
    }
  }

  // =========================================================================
  // 6. Imports and Exports (Epistemic Chronology)
  // =========================================================================
  const allExports = manifest.exportedResults ?? manifest.exports;
  if (allExports && context.sourceBlocks) {
    for (const exp of allExports) {
      const expId = exp.id ?? exp.resultId ?? "";
      const block = context.sourceBlocks.get(expId);
      if (block?.printedLatex) {
        if (block.printedLatex !== exp.printedForm) {
          addDiag(
            "error",
            "export-latex-mismatch",
            `Export '${expId}' printedForm does not match source block LaTeX.`,
            {
              unitId: expId,
              expected: block.printedLatex,
              actual: exp.printedForm,
            },
          );
        }
      } else if (!block) {
        addDiag(
          "flag",
          "export-printed-form-unverified",
          `Export '${expId}' source block does not exist yet to verify printedForm.`,
          { unitId: expId },
        );
      }
    }
  }

  if (manifest.importedResults) {
    const currentPaperDates =
      context.paperDates?.get(manifest.paper) ?? context.paperDates?.get(manifest.document);

    for (const imp of manifest.importedResults) {
      const fromPaper = imp.fromPaper ?? imp.paper ?? "";
      if (!imp.use) {
        addDiag(
          "error",
          "import-use-missing",
          `Imported result '${imp.resultId}' is missing 'use'.`,
        );
      }

      // Self-reference check
      if (fromPaper === manifest.paper || fromPaper === manifest.document) {
        addDiag(
          "error",
          "import-self-reference",
          `Paper cannot import result '${imp.resultId}' from itself.`,
        );
      }

      // Check that exported result exists in target manifest
      const targetManifest = context.manifests.get(fromPaper);
      if (targetManifest) {
        const targetExports = targetManifest.exportedResults ?? targetManifest.exports;
        const exported = targetExports?.find((e) => (e.id ?? e.resultId) === imp.resultId);
        if (!exported) {
          addDiag(
            "error",
            "import-unexported-result",
            `Imported result '${imp.resultId}' is not exported by paper '${fromPaper}'.`,
            {
              actual: imp.resultId,
              repair: `Export '${imp.resultId}' in ${fromPaper}'s manifest or correct the reference.`,
            },
          );
        }
      }

      // Chronological check
      if (currentPaperDates?.received && context.paperDates) {
        const importedDates = context.paperDates.get(fromPaper);
        if (importedDates?.received && importedDates.received > currentPaperDates.received) {
          addDiag(
            "error",
            "import-anachronism",
            `Import from paper '${fromPaper}' (received ${importedDates.received}) is anachronistic for '${manifest.paper}' (received ${currentPaperDates.received}).`,
          );
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Validates all manifests in a corpus.
 */
export function validateManifestCorpus(
  manifests: ReadonlyMap<string, SourceManifest>,
  context?: Omit<ManifestValidationContext, "manifests">,
): ManifestValidationResult {
  const allDiagnostics: ManifestDiagnostic[] = [];
  const fullContext: ManifestValidationContext = {
    manifests,
    ...context,
  };

  for (const manifest of manifests.values()) {
    const diags = validateManifest(manifest, fullContext);
    allDiagnostics.push(...diags);
  }

  const ok = !allDiagnostics.some((d) => d.severity === "error");
  return { ok, diagnostics: allDiagnostics };
}
