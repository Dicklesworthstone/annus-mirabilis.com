/**
 * Scoped Notation Concordance Compiler Validation & Diagnostics.
 * Specification: am-not-concordance-model-uag, AGENTS.md (§2.3, §4.5, §4.7, §6.1, §11.4)
 */

import {
  CONCORDANCE_UNIT_SYSTEMS,
  type ConcordanceEntry,
  type ConcordanceUnitSystem,
  type PaperConcordance,
} from "../schemas/concordance.ts";
import { gcd } from "../schemas/dimensionBasis.ts";
import { normalizeGlyph, normalizeSectionId } from "./resolve.ts";
import type {
  ConcordanceDiagnostic,
  ConcordanceValidationResult,
  SourceManifestIndex,
} from "./types.ts";

/**
 * Checks if two scope lists share any overlapping section or anchor.
 */
export function scopesOverlap(scope1: readonly string[], scope2: readonly string[]): boolean {
  if (scope1.includes("all") || scope2.includes("all")) return true;
  for (const s1 of scope1) {
    const n1 = normalizeSectionId(s1);
    for (const s2 of scope2) {
      const n2 = normalizeSectionId(s2);
      if (s1 === s2 || n1 === n2) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Validates one or more paper concordances against editorial and semantic rules.
 */
export function checkConcordance(
  concordances: PaperConcordance | readonly PaperConcordance[],
  options?: {
    manifestIndex?: SourceManifestIndex;
    knownQuantityIds?: readonly string[];
  },
): ConcordanceValidationResult {
  const paperList: readonly PaperConcordance[] = Array.isArray(concordances)
    ? concordances
    : [concordances];

  const diagnostics: ConcordanceDiagnostic[] = [];
  const manifestIndex = options?.manifestIndex;
  const knownQuantitySet = options?.knownQuantityIds
    ? new Set(options.knownQuantityIds)
    : undefined;

  for (const pc of paperList) {
    const paper = pc.paper;

    if (pc.entries.length === 0 && (!pc.modernOnlySymbols || pc.modernOnlySymbols.length === 0)) {
      diagnostics.push({
        severity: "warning",
        rule: "empty-concordance",
        paper,
        message: `Paper "${paper}" concordance has no entries.`,
      });
      continue;
    }

    const seenEntryIds = new Set<string>();

    for (let i = 0; i < pc.entries.length; i++) {
      const entry = pc.entries[i];
      if (!entry) continue;

      // 1. Duplicate Entry IDs
      if (seenEntryIds.has(entry.id)) {
        diagnostics.push({
          severity: "error",
          rule: "duplicate-entry-id",
          paper,
          entryId: entry.id,
          message: `Duplicate concordance entry ID "${entry.id}".`,
        });
      } else {
        seenEntryIds.add(entry.id);
      }

      // 2. Unknown Quantity ID
      if (knownQuantitySet && "quantityId" in entry.binding && entry.binding.quantityId) {
        if (!knownQuantitySet.has(entry.binding.quantityId)) {
          diagnostics.push({
            severity: "error",
            rule: "unknown-quantity-id",
            paper,
            entryId: entry.id,
            message: `Unknown quantity ID "${entry.binding.quantityId}" in binding for entry "${entry.id}".`,
          });
        }
      }

      // 3. Scaled rename & rational reduction
      if ("scale" in entry.binding && entry.binding.scale) {
        const sc = entry.binding.scale;
        if (sc.num === 0) {
          diagnostics.push({
            severity: "error",
            rule: "scaled-rename-mismatch",
            paper,
            entryId: entry.id,
            message: `Scale factor cannot be zero for entry "${entry.id}".`,
          });
        }
        if (gcd(sc.num, sc.den) !== 1) {
          diagnostics.push({
            severity: "error",
            rule: "scaled-rename-mismatch",
            paper,
            entryId: entry.id,
            message: `Scale factor ${sc.num}/${sc.den} is not reduced to lowest terms in entry "${entry.id}".`,
          });
        }
      }

      if (entry.operation.kind === "rename") {
        const target = entry.operation.target;
        if (target.form === "scaled") {
          if (!target.modernTree) {
            diagnostics.push({
              severity: "error",
              rule: "scaled-rename-mismatch",
              paper,
              entryId: entry.id,
              message: `Scaled rename operation requires modernTree in entry "${entry.id}".`,
            });
          }
        }
      }

      // 4. Unit conversion valid systems
      if (entry.operation.kind === "unitConversion") {
        const op = entry.operation;
        if (!CONCORDANCE_UNIT_SYSTEMS.includes(op.fromSystem as ConcordanceUnitSystem)) {
          diagnostics.push({
            severity: "error",
            rule: "unit-conversion-invalid-system",
            paper,
            entryId: entry.id,
            message: `Invalid fromSystem "${String(op.fromSystem)}" in unitConversion for entry "${entry.id}". Must be one of: ${CONCORDANCE_UNIT_SYSTEMS.join(", ")}. Loose names like 'gaussian' are rejected.`,
          });
        }
        if (!CONCORDANCE_UNIT_SYSTEMS.includes(op.toSystem as ConcordanceUnitSystem)) {
          diagnostics.push({
            severity: "error",
            rule: "unit-conversion-invalid-system",
            paper,
            entryId: entry.id,
            message: `Invalid toSystem "${String(op.toSystem)}" in unitConversion for entry "${entry.id}". Must be one of: ${CONCORDANCE_UNIT_SYSTEMS.join(", ")}.`,
          });
        }
      }

      // 5. Collision record checks
      if (entry.collision) {
        const col = entry.collision;
        const targetsEmpty =
          col.collidesWith.length === 0 &&
          (!col.collidesWithModern || col.collidesWithModern.length === 0);

        if (targetsEmpty) {
          diagnostics.push({
            severity: "error",
            rule: "collision-targets-empty",
            paper,
            entryId: entry.id,
            message: `Collision record for entry "${entry.id}" must specify at least one target in collidesWith or collidesWithModern.`,
          });
        }

        if (!col.firstUseAnchor?.trim()) {
          diagnostics.push({
            severity: "error",
            rule: "collision-missing-first-use",
            paper,
            entryId: entry.id,
            message: `Collision record for entry "${entry.id}" is missing firstUseAnchor.`,
          });
        } else if (
          manifestIndex &&
          manifestIndex.papers.size > 0 &&
          manifestIndex.hasPaper(paper)
        ) {
          if (!manifestIndex.hasAnchor(paper, col.firstUseAnchor)) {
            diagnostics.push({
              severity: "error",
              rule: "collision-missing-first-use",
              paper,
              entryId: entry.id,
              message: `Collision firstUseAnchor "${col.firstUseAnchor}" not found in source manifest for paper "${paper}".`,
            });
          }
        }

        if (!col.firstUseBySection || col.firstUseBySection.length === 0) {
          diagnostics.push({
            severity: "error",
            rule: "collision-missing-first-use",
            paper,
            entryId: entry.id,
            message: `Collision record for entry "${entry.id}" requires non-empty firstUseBySection.`,
          });
        } else if (
          manifestIndex &&
          manifestIndex.papers.size > 0 &&
          manifestIndex.hasPaper(paper)
        ) {
          for (const s of col.firstUseBySection) {
            if (!manifestIndex.hasAnchor(paper, s.anchor)) {
              diagnostics.push({
                severity: "error",
                rule: "collision-missing-first-use",
                paper,
                entryId: entry.id,
                message: `Collision section anchor "${s.anchor}" for section "${s.sectionId}" not found in source manifest.`,
              });
            }
          }
        }
      }

      // 6. Cross-entry checks (Scope overlap and modern glyph collision)
      for (let j = i + 1; j < pc.entries.length; j++) {
        const other = pc.entries[j];
        if (!other) continue;
        const samePrinted = normalizeGlyph(entry.glyph) === normalizeGlyph(other.glyph);

        // Check scope overlap between different entries with identical printed glyph
        if (samePrinted && scopesOverlap(entry.scope, other.scope)) {
          diagnostics.push({
            severity: "error",
            rule: "scope-overlap",
            paper,
            entryId: entry.id,
            glyph: entry.glyph.latex,
            message: `Entries "${entry.id}" and "${other.id}" define the same printed glyph "${entry.glyph.latex}" with overlapping scopes [${entry.scope.join(", ")}] and [${other.scope.join(", ")}].`,
          });
        }

        // Modern glyph collision: distinct quantities mapping to the same modern symbol in overlapping scope
        const entryModern = getEntryModernGlyph(entry);
        const otherModern = getEntryModernGlyph(other);
        const sameQuantity =
          "quantityId" in entry.binding &&
          "quantityId" in other.binding &&
          entry.binding.quantityId === other.binding.quantityId;

        if (
          !sameQuantity &&
          entryModern &&
          otherModern &&
          entryModern === otherModern &&
          scopesOverlap(entry.scope, other.scope)
        ) {
          const entryFlagsOther =
            entry.collision &&
            (entry.collision.collidesWith.includes(other.id) ||
              entry.collision.collidesWith.includes(other.glyph.latex) ||
              entry.collision.collidesWith.includes(other.glyph.unicode) ||
              entry.collision.collidesWithModern?.includes(otherModern));

          const otherFlagsEntry =
            other.collision &&
            (other.collision.collidesWith.includes(entry.id) ||
              other.collision.collidesWith.includes(entry.glyph.latex) ||
              other.collision.collidesWith.includes(entry.glyph.unicode) ||
              other.collision.collidesWithModern?.includes(entryModern));

          if (!entryFlagsOther && !otherFlagsEntry) {
            diagnostics.push({
              severity: "error",
              rule: "modern-glyph-collision",
              paper,
              entryId: entry.id,
              glyph: entryModern,
              message: `Distinct entries "${entry.id}" and "${other.id}" both map to modern glyph "${entryModern}" in overlapping scope without reciprocal collision warnings.`,
            });
          }
        }
      }
    }

    // 7. Modern-only symbols checks
    if (pc.modernOnlySymbols) {
      for (const m of pc.modernOnlySymbols) {
        const mGlyph = normalizeGlyph(m.glyph);
        const mScope = m.scope.length > 0 ? m.scope : ["all"];

        for (const entry of pc.entries) {
          const printedGlyph = normalizeGlyph(entry.glyph);

          if (mGlyph === printedGlyph) {
            // If they share the exact same scope, this is an unconditional clash!
            if (scopesOverlap(mScope, entry.scope)) {
              diagnostics.push({
                severity: "error",
                rule: "same-scope-modern-only-printed-clash",
                paper,
                entryId: entry.id,
                glyph: mGlyph,
                message: `Modern-only symbol "${m.id}" (${mGlyph}) clashes with printed glyph in the same scope [${entry.scope.join(", ")}]. This cannot be admitted by caution.`,
              });
            } else {
              // Different scopes -> requires cross-toggle caution
              const flaggedInEntry =
                entry.collision &&
                entry.collision.kind === "cross-toggle" &&
                (entry.collision.collidesWithModern?.includes(m.id) ||
                  entry.collision.collidesWithModern?.includes(mGlyph) ||
                  entry.collision.collidesWith.includes(m.id));

              if (!flaggedInEntry) {
                diagnostics.push({
                  severity: "error",
                  rule: "cross-toggle-unflagged",
                  paper,
                  entryId: entry.id,
                  glyph: mGlyph,
                  message: `Modern-only symbol "${m.id}" (${mGlyph}) collides across toggle with printed glyph in entry "${entry.id}" without cross-toggle caution.`,
                });
              }
            }
          }
        }
      }
    }
  }

  const valid = !diagnostics.some((d) => d.severity === "error");
  return {
    valid,
    diagnostics,
  };
}

/**
 * Validates a concordance file/record and returns the diagnostic list.
 */
export function validateConcordanceFile(
  file: PaperConcordance,
  options?: {
    manifestIndex?: SourceManifestIndex;
    knownQuantityIds?: readonly string[];
  },
): readonly ConcordanceDiagnostic[] {
  return checkConcordance(file, options).diagnostics;
}

function getEntryModernGlyph(entry: ConcordanceEntry): string | undefined {
  if (entry.operation.kind !== "rename") return undefined;
  const target = entry.operation.target;
  if (target.form === "symbol" || target.form === "group") {
    return normalizeGlyph(target.modernGlyph);
  }
  if (target.form === "expression" || target.form === "scaled") {
    if (target.modernGlyph) {
      return normalizeGlyph(target.modernGlyph);
    }
  }
  return undefined;
}
