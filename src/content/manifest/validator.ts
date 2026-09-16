/**
 * Source Manifest Corpus Validation Engine.
 *
 * Enforces page coverage, spans, sequence continuity, alias explanations,
 * footnote and display equation rules, status derivations, and epistemic import/export chronology.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import { type AliasRecord, explainGap } from "../aliases.ts";
import type { ManifestDiagnostic, ManifestUnit, SourceManifest } from "./types.ts";

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
}

export interface ManifestValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly ManifestDiagnostic[];
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

  // =========================================================================
  // 1. Page Coverage and Bounds
  // =========================================================================
  const pageUnits = new Map<number, ManifestUnit[]>();
  for (let p = startPage; p <= endPage; p++) {
    pageUnits.set(p, []);
  }

  let previousBodyEndPage = startPage;

  for (const unit of manifest.units) {
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

    // Body units start page order check
    const isBodyUnit =
      unit.kind === "paragraph" || unit.kind === "heading" || unit.kind === "part-heading";
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
  // 2. Footnotes and Display Equations
  // =========================================================================
  const paragraphsById = new Map<string, ManifestUnit>();
  for (const u of manifest.units) {
    if (u.kind === "paragraph") {
      paragraphsById.set(u.id, u);
    }
  }

  for (const unit of manifest.units) {
    if (unit.kind === "footnote") {
      if (!unit.footnoteMark) {
        addDiag(
          "error",
          "footnote-unmarked",
          `Footnote '${unit.id}' has no corresponding text mark.`,
          {
            unitId: unit.id,
          },
        );
      }

      // Check split page footnote
      const fnPage = unit.locators[0]?.page;
      if (fnPage && unit.containedIn) {
        const parentP = paragraphsById.get(unit.containedIn);
        const parentFirstLoc = parentP?.locators[0];
        if (parentFirstLoc) {
          const parentPage = parentFirstLoc.page;
          if (
            fnPage > parentPage &&
            !unit.isSplitFootnote &&
            !unit.locators.some((l) => l.splitPage)
          ) {
            addDiag(
              "error",
              "footnote-split-unrecorded",
              `Footnote '${unit.id}' printed on page ${fnPage} after mark on page ${parentPage} must be recorded with splitPage.`,
              { unitId: unit.id },
            );
          }
        }
      }
    }

    if (unit.kind === "equation" && unit.containedIn) {
      const parentP = paragraphsById.get(unit.containedIn);
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
    if (unit.kind === "equation" && unit.originalLabel) {
      const list = printedEqLabels.get(unit.originalLabel) ?? [];
      list.push(unit);
      printedEqLabels.set(unit.originalLabel, list);
    }
  }

  for (const [label, eqs] of printedEqLabels.entries()) {
    if (eqs.length > 1) {
      for (const eq of eqs) {
        if (!eq.id.includes("-s") && !eq.id.match(/^eq-s\d+/)) {
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
  // 3. References and Citations
  // =========================================================================
  for (const unit of manifest.units) {
    if (unit.references) {
      for (const ref of unit.references) {
        if (!ref.id.match(/^.+-r[1-9]\d*$/)) {
          addDiag(
            "error",
            "reference-id-invalid",
            `Reference sub-entry ID '${ref.id}' in unit '${unit.id}' must match '<unit>-r<i>'.`,
            { unitId: unit.id },
          );
        }

        if (ref.targetCitationId) {
          if (context.citations && !context.citations.has(ref.targetCitationId)) {
            const isComplete = manifest.status === "complete";
            addDiag(
              isComplete ? "error" : "flag",
              "citation-not-found",
              `Reference '${ref.id}' points to unknown citation '${ref.targetCitationId}'.`,
              { unitId: unit.id },
            );
          }
        } else {
          addDiag(
            "flag",
            "citation-target-missing",
            `Reference '${ref.id}' in unit '${unit.id}' has no targetCitationId.`,
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
  // Group paragraphs, sentences, and equations by section
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
  if (manifest.exports && context.sourceBlocks) {
    for (const exp of manifest.exports) {
      const block = context.sourceBlocks.get(exp.id);
      if (block?.printedLatex && block.printedLatex !== exp.printedForm) {
        addDiag(
          "error",
          "export-latex-mismatch",
          `Export '${exp.id}' printedForm does not match source block LaTeX.`,
          {
            unitId: exp.id,
            expected: block.printedLatex,
            actual: exp.printedForm,
          },
        );
      }
    }
  }

  if (manifest.importedResults) {
    const currentPaperDates =
      context.paperDates?.get(manifest.paper) ?? context.paperDates?.get(manifest.document);

    for (const imp of manifest.importedResults) {
      if (!imp.use) {
        addDiag(
          "error",
          "import-use-missing",
          `Imported result '${imp.resultId}' is missing 'use'.`,
        );
      }

      // Self-reference check
      if (imp.paper === manifest.paper || imp.paper === manifest.document) {
        addDiag(
          "error",
          "import-self-reference",
          `Paper cannot import result '${imp.resultId}' from itself.`,
        );
      }

      // Check that exported result exists in target manifest
      const targetManifest = context.manifests.get(imp.paper);
      if (targetManifest) {
        const exported = targetManifest.exports?.find((e) => e.id === imp.resultId);
        if (!exported) {
          addDiag(
            "error",
            "import-unexported-result",
            `Imported result '${imp.resultId}' is not exported by paper '${imp.paper}'.`,
            {
              actual: imp.resultId,
              repair: `Export '${imp.resultId}' in ${imp.paper}'s manifest or correct the reference.`,
            },
          );
        }
      }

      // Chronological check
      if (currentPaperDates?.received && context.paperDates) {
        const importedDates = context.paperDates.get(imp.paper);
        if (importedDates?.received && importedDates.received > currentPaperDates.received) {
          addDiag(
            "error",
            "import-anachronism",
            `Import from paper '${imp.paper}' (received ${importedDates.received}) is anachronistic for '${manifest.paper}' (received ${currentPaperDates.received}).`,
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
