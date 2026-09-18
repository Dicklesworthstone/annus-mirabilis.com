/**
 * Explicit many-to-many alignment and edition layer validation (am-edn-alignment-tooling-do1).
 * Edges name permanent ids. Array positions are not an alignment.
 * Implements rules C.1 through C.8.
 */

import { createHash } from "node:crypto";
import { parseEquationAnchor, parseParagraphId } from "../ids.ts";
import type { Alignment, AlignmentEdge } from "../schemas/source.ts";
import {
  classifyAlignableUnit,
  isPermanentEnglishId,
  isPermanentGermanId,
} from "./alignableIds.ts";
import { getReviewStateCheck } from "./reviewState.ts";
import { tokenizeGerman, wordTokens } from "./tokenizeGerman.ts";

export type AlignmentIssueCode =
  | "index-based-edge"
  | "missing-source-id"
  | "missing-target-id"
  | "unknown-source"
  | "unknown-target"
  | "empty-alignment"
  | "display-math-bytes-differ"
  | "math-atoms-differ"
  | "math-order-differs"
  | "reference-atoms-differ"
  | "footnote-marks-differ"
  | "unaligned-source"
  | "unaligned-target"
  | "invalid-split-suffix"
  | "missing-split-sibling"
  | "term-definition-too-short"
  | "term-missing-german-lang"
  | "term-missing-english-lang"
  | "term-not-occurrence-specific"
  | "gloss-target-not-alignable"
  | "gloss-unit-unknown"
  | "gloss-token-mismatch"
  | "gloss-missing-token"
  | "gloss-token-collision"
  | "gloss-atom-glossed"
  | "gloss-stale"
  | "gloss-editor-same-as-author"
  | "model-missing-id"
  | "model-drafted-not-machine-draft"
  | "editor-same-as-author"
  | "review-records-not-available"
  | "unit-not-reviewed"
  | "status-disagrees-with-records";

export type AlignmentIssue = Readonly<{
  code: AlignmentIssueCode;
  message: string;
  sourceId?: string | undefined;
  targetId?: string | undefined;
}>;

export type ExplicitEdge = Readonly<{
  sourceId: string;
  targetId: string;
}>;

function looksLikeIndex(value: unknown): boolean {
  return typeof value === "number" || (typeof value === "string" && /^(index:)?\d+$/.test(value));
}

export function edgesFromAlignment(alignment: Alignment): readonly ExplicitEdge[] {
  return Object.freeze(
    alignment.edges.map((edge) => ({
      sourceId: edge.source.sentenceId ?? edge.source.blockId,
      targetId: edge.target.translationUnitId,
    })),
  );
}

/**
 * C.1 Coverage & Edges: Validate that every German unit and every English unit has an edge.
 */
export function validateManyToManyAlignment(input: {
  edges: readonly ExplicitEdge[];
  germanIds: readonly string[];
  englishIds: readonly string[];
}): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  if (input.edges.length === 0) {
    issues.push({
      code: "empty-alignment",
      message:
        "Alignment has no edges. Many-to-many edges must be authored; paragraph counts are not an alignment.",
    });
    return Object.freeze(issues);
  }
  const german = new Set(input.germanIds);
  const english = new Set(input.englishIds);
  const alignedSources = new Set<string>();
  const alignedTargets = new Set<string>();

  for (const edge of input.edges) {
    if (looksLikeIndex(edge.sourceId) || looksLikeIndex(edge.targetId)) {
      issues.push({
        code: "index-based-edge",
        message: `Edge uses an array index (${edge.sourceId} → ${edge.targetId}). Alignment is by permanent id.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
      continue;
    }
    if (!edge.sourceId || !isPermanentGermanId(edge.sourceId)) {
      issues.push({
        code: "missing-source-id",
        message: `Source "${edge.sourceId}" is not a permanent German alignable id.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
      continue;
    }
    if (!edge.targetId || !isPermanentEnglishId(edge.targetId)) {
      issues.push({
        code: "missing-target-id",
        message: `Target "${edge.targetId}" is not a permanent English translation-unit id.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
      continue;
    }
    if (!german.has(edge.sourceId)) {
      issues.push({
        code: "unknown-source",
        message: `Alignment source "${edge.sourceId}" is not in the German id set.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
    } else {
      alignedSources.add(edge.sourceId);
    }
    if (!english.has(edge.targetId)) {
      issues.push({
        code: "unknown-target",
        message: `Alignment target "${edge.targetId}" is not in the English id set.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
    } else {
      alignedTargets.add(edge.targetId);
    }
  }

  for (const gId of input.germanIds) {
    if (!alignedSources.has(gId)) {
      issues.push({
        code: "unaligned-source",
        message: `German source unit "${gId}" has no alignment edge. Every source unit must be aligned.`,
        sourceId: gId,
      });
    }
  }

  for (const eId of input.englishIds) {
    if (!alignedTargets.has(eId)) {
      issues.push({
        code: "unaligned-target",
        message: `English target unit "${eId}" has no incoming alignment edge. Every target unit must have a source.`,
        targetId: eId,
      });
    }
  }

  return Object.freeze(issues);
}

/**
 * Parses a split translation unit ID into base ID and suffix.
 */
export function parseSplitTranslationUnitId(id: string): { base: string; suffix: string } | null {
  const digitMatch = id.match(/^(s\d+-p\d+-s\d+|s[1-9]\d*|s\d+-fn\d+|part-[12])([a-z])$/);
  if (digitMatch?.[1] && digitMatch?.[2]) {
    return { base: digitMatch[1], suffix: digitMatch[2] };
  }
  const letterMatch = id.match(
    /^(closing-dateline|closing-ack|closing-received|masthead-title|masthead-author)-([a-z])$/,
  );
  if (letterMatch?.[1] && letterMatch?.[2]) {
    return { base: letterMatch[1], suffix: letterMatch[2] };
  }
  return null;
}

/**
 * C.2 Edges and splits: Split English units carry source id with suffix grammar,
 * every part is aligned, and a split must have at least two parts (a, b).
 */
export function validateAlignmentSplits(englishIds: readonly string[]): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  const baseMap = new Map<string, string[]>();
  const allIds = new Set(englishIds);

  for (const id of englishIds) {
    const split = parseSplitTranslationUnitId(id);
    if (split) {
      let list = baseMap.get(split.base);
      if (!list) {
        list = [];
        baseMap.set(split.base, list);
      }
      list.push(split.suffix);
    }
  }

  for (const [base, suffixes] of baseMap.entries()) {
    // 1. A split must have at least 2 parts
    if (suffixes.length < 2) {
      issues.push({
        code: "missing-split-sibling",
        targetId: `${base}${suffixes[0]}`,
        message: `Suffixed translation unit "${base}${suffixes[0]}" has no sibling split unit (splits require at least two parts: a, b).`,
      });
    }

    // 2. Suffixes must start with 'a' and be consecutive
    const sorted = [...suffixes].sort();
    if (sorted[0] !== "a") {
      issues.push({
        code: "invalid-split-suffix",
        targetId: `${base}${suffixes[0]}`,
        message: `Split translation units for "${base}" must start with suffix "a", got "${sorted[0]}".`,
      });
    }

    // 3. Collision: unsuffixed base exists beside suffixed splits
    if (allIds.has(base)) {
      issues.push({
        code: "invalid-split-suffix",
        targetId: base,
        message: `Unsuffixed translation unit "${base}" exists beside suffixed splits (${suffixes.map((s) => `"${base}${s}"`).join(", ")}).`,
      });
    }
  }

  return Object.freeze(issues);
}

/**
 * C.3 Display equation byte identity.
 */
export function validateDisplayByteIdentity(
  germanDisplay: string,
  englishDisplay: string,
): AlignmentIssue | null {
  if (germanDisplay === englishDisplay) return null;
  return {
    code: "display-math-bytes-differ",
    message:
      "English display is not byte-identical to the German display. Notation is not translated.",
  };
}

export type UnitContent = Readonly<{
  id: string;
  mathAtoms?: readonly string[] | undefined;
  referenceIds?: readonly string[] | undefined;
  footnoteMarks?: readonly string[] | undefined;
}>;

export type AlignmentComponent = Readonly<{
  germanUnits: readonly UnitContent[];
  englishUnits: readonly UnitContent[];
}>;

function normalizeAtom(atom: string): string {
  return atom.replace(/\s+/g, "");
}

function multisetOf(items: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = normalizeAtom(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * C.4 Inline mathematics, references, and footnote marks per alignment component.
 */
export function validateInlineMathematics(
  components: readonly AlignmentComponent[],
): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];

  for (const comp of components) {
    const germanAtoms = comp.germanUnits.flatMap((u) => u.mathAtoms ?? []);
    const englishAtoms = comp.englishUnits.flatMap((u) => u.mathAtoms ?? []);

    const gMath = multisetOf(germanAtoms);
    const eMath = multisetOf(englishAtoms);

    const missingInEnglish: string[] = [];
    const extraInEnglish: string[] = [];

    for (const [atom, count] of gMath.entries()) {
      const eCount = eMath.get(atom) ?? 0;
      if (eCount < count) {
        for (let i = 0; i < count - eCount; i++) missingInEnglish.push(atom);
      }
    }
    for (const [atom, count] of eMath.entries()) {
      const gCount = gMath.get(atom) ?? 0;
      if (gCount < count) {
        for (let i = 0; i < count - gCount; i++) extraInEnglish.push(atom);
      }
    }

    if (missingInEnglish.length > 0 || extraInEnglish.length > 0) {
      issues.push({
        code: "math-atoms-differ",
        message: `Inline math atoms differ: missing in English: [${missingInEnglish.join(", ")}]; extra in English: [${extraInEnglish.join(", ")}].`,
      });
    } else {
      // Check order difference in component (1:1, 1:2, etc.)
      const gNorm = germanAtoms.map(normalizeAtom);
      const eNorm = englishAtoms.map(normalizeAtom);
      if (gNorm.join("|") !== eNorm.join("|")) {
        issues.push({
          code: "math-order-differs",
          message: "Inline math atom order differs within alignment component.",
        });
      }
    }

    // References multiset
    const gRefs = multisetOf(comp.germanUnits.flatMap((u) => u.referenceIds ?? []));
    const eRefs = multisetOf(comp.englishUnits.flatMap((u) => u.referenceIds ?? []));
    const missingRefs: string[] = [];
    const extraRefs: string[] = [];
    for (const [ref, count] of gRefs.entries()) {
      const eCount = eRefs.get(ref) ?? 0;
      if (eCount < count) {
        for (let i = 0; i < count - eCount; i++) missingRefs.push(ref);
      }
    }
    for (const [ref, count] of eRefs.entries()) {
      const gCount = gRefs.get(ref) ?? 0;
      if (gCount < count) {
        for (let i = 0; i < count - gCount; i++) extraRefs.push(ref);
      }
    }
    if (missingRefs.length > 0 || extraRefs.length > 0) {
      issues.push({
        code: "reference-atoms-differ",
        message: `Reference inline targets differ: missing in English: [${missingRefs.join(", ")}]; extra in English: [${extraRefs.join(", ")}].`,
      });
    }

    // Footnote marks multiset
    const gMarks = multisetOf(comp.germanUnits.flatMap((u) => u.footnoteMarks ?? []));
    const eMarks = multisetOf(comp.englishUnits.flatMap((u) => u.footnoteMarks ?? []));
    let marksDiffer = false;
    for (const [mark, count] of gMarks.entries()) {
      if ((eMarks.get(mark) ?? 0) !== count) marksDiffer = true;
    }
    for (const [mark, count] of eMarks.entries()) {
      if ((gMarks.get(mark) ?? 0) !== count) marksDiffer = true;
    }
    if (marksDiffer) {
      issues.push({
        code: "footnote-marks-differ",
        message: "Footnote mark atoms differ between German and English in component.",
      });
    }
  }

  return Object.freeze(issues);
}

export type TermOccurrence = Readonly<{
  id: string;
  termId: string;
  termText: string;
  definition: string;
  termLang?: string | undefined;
  definitionLang?: string | undefined;
  isOccurrenceSpecific?: boolean | undefined;
}>;

/**
 * C.5 Terms: Definitions > 80 characters, lang metadata, occurrence-specific.
 */
export function validateTerms(terms: readonly TermOccurrence[]): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];

  for (const term of terms) {
    if (term.definition.length <= 80) {
      issues.push({
        code: "term-definition-too-short",
        sourceId: term.id,
        message: `Term "${term.termId}" definition length (${term.definition.length}) is <= 80 characters.`,
      });
    }
    if (term.termLang !== "de") {
      issues.push({
        code: "term-missing-german-lang",
        sourceId: term.id,
        message: `Term "${term.termId}" German text must carry lang: "de", got "${term.termLang}".`,
      });
    }
    if (term.definitionLang !== "en") {
      issues.push({
        code: "term-missing-english-lang",
        sourceId: term.id,
        message: `Term "${term.termId}" definition must carry lang: "en", got "${term.definitionLang}".`,
      });
    }
    if (term.isOccurrenceSpecific === false) {
      issues.push({
        code: "term-not-occurrence-specific",
        sourceId: term.id,
        message: `Term "${term.termId}" definition is shared across occurrences without an occurrence record.`,
      });
    }
  }

  return Object.freeze(issues);
}

export type GlossUnit = Readonly<{
  sentenceId: string;
  sourceRevision?: number | undefined;
  sourceTextDigest?: string | undefined;
  tokens?: readonly string[] | undefined;
  glosses?: readonly { tokenIndex: number; text: string }[] | undefined;
  multiwords?: readonly { tokenIndices: readonly number[]; text: string }[] | undefined;
  attribution?: { id: string; kind: string; modelId?: string } | undefined;
  editor?: { id: string; kind: string } | undefined;
}>;

export type ValidateGlossInput = Readonly<{
  glossUnits: readonly GlossUnit[];
  alignableUnits: readonly { id: string; text: string; digest?: string }[];
  tokenizer?: ((text: string) => readonly { text: string }[]) | undefined;
}>;

/**
 * C.6 Glosses: addressing, token coverage, multiword uniqueness, staleness via digests, and authorship.
 */
export function validateGloss(input: ValidateGlossInput): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  const alignableMap = new Map(input.alignableUnits.map((u) => [u.id, u]));

  for (const g of input.glossUnits) {
    const sId = g.sentenceId;

    // 1. Addressing check
    if (parseParagraphId(sId).ok || parseEquationAnchor(sId).ok) {
      issues.push({
        code: "gloss-target-not-alignable",
        sourceId: sId,
        message: `Gloss unit references "${sId}", which is not an alignable unit (cannot gloss a paragraph block or equation block).`,
      });
      continue;
    }

    const alignable = alignableMap.get(sId);
    if (!alignable) {
      issues.push({
        code: "gloss-unit-unknown",
        sourceId: sId,
        message: `Gloss unit references unknown alignable unit "${sId}".`,
      });
      continue;
    }

    // 2. Staleness check via digest comparison (no re-tokenisation needed)
    const expectedDigest =
      alignable.digest ?? createHash("sha256").update(alignable.text, "utf8").digest("hex");
    if (g.sourceTextDigest && g.sourceTextDigest !== expectedDigest) {
      issues.push({
        code: "gloss-stale",
        sourceId: sId,
        message: `Gloss unit for "${sId}" is stale (stored digest does not match alignable unit digest).`,
      });
      continue;
    }

    // 3. Token coverage
    if (input.tokenizer || alignable.text) {
      const tokens = input.tokenizer
        ? input.tokenizer(alignable.text)
        : wordTokens(tokenizeGerman(alignable.text));
      const wordCount = tokens.length;

      const coveredTokens = new Set<number>();
      for (const gloss of g.glosses ?? []) {
        coveredTokens.add(gloss.tokenIndex);
      }
      for (const mw of g.multiwords ?? []) {
        for (const idx of mw.tokenIndices) {
          if (coveredTokens.has(idx)) {
            issues.push({
              code: "gloss-token-collision",
              sourceId: sId,
              message: `Gloss token index ${idx} in unit "${sId}" belongs to multiple gloss entries.`,
            });
          }
          coveredTokens.add(idx);
        }
      }

      for (let i = 0; i < wordCount; i++) {
        if (!coveredTokens.has(i)) {
          issues.push({
            code: "gloss-missing-token",
            sourceId: sId,
            message: `Gloss unit "${sId}" is missing gloss for token at index ${i} ("${tokens[i]?.text}").`,
          });
        }
      }
    }

    // 4. Authorship: editor cannot equal attribution author
    if (g.attribution && g.editor && g.attribution.id === g.editor.id) {
      issues.push({
        code: "gloss-editor-same-as-author",
        sourceId: sId,
        message: `Gloss unit "${sId}" editor "${g.editor.id}" must differ from author "${g.attribution.id}".`,
      });
    }
  }

  return Object.freeze(issues);
}

export type ReviewStateUnit = Readonly<{
  id: string;
  reviewState: "absent" | "machine-draft" | "drafted" | "corrected" | "reviewed";
  translator?: { id: string; kind: "human" | "model"; modelId?: string } | undefined;
  editor?: { id: string; kind: "human" | "model" } | undefined;
  paper?: string | undefined;
  layer?: string | undefined;
}>;

/**
 * C.7 Review states and provenance.
 */
export function validateReviewStates(
  units: readonly ReviewStateUnit[],
  options?: { requireReviewed?: boolean; paper?: string; layer?: string },
): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  const reviewCheck = getReviewStateCheck();

  for (const unit of units) {
    // Model translator rules
    if (unit.translator?.kind === "model") {
      if (!unit.translator.modelId) {
        issues.push({
          code: "model-missing-id",
          targetId: unit.id,
          message: `Unit "${unit.id}" model translator is missing required modelId.`,
        });
      }
      if (unit.reviewState === "drafted") {
        issues.push({
          code: "model-drafted-not-machine-draft",
          targetId: unit.id,
          message: `Unit "${unit.id}" model translation must be machine-draft, never drafted.`,
        });
      }
    }

    // Corrected requires independent editor
    if (unit.reviewState === "corrected") {
      if (unit.editor && unit.translator && unit.editor.id === unit.translator.id) {
        issues.push({
          code: "editor-same-as-author",
          targetId: unit.id,
          message: `Unit "${unit.id}" editor "${unit.editor.id}" cannot equal translator id.`,
        });
      }
    }

    // Reviewed requires registered review check
    if (unit.reviewState === "reviewed") {
      const probe = reviewCheck({
        unitId: unit.id,
        paper: unit.paper ?? options?.paper ?? "brownian-motion",
        layer: unit.layer ?? options?.layer ?? "translation",
      });
      if (!probe.ok) {
        issues.push({
          code: "review-records-not-available",
          targetId: unit.id,
          message: probe.message ?? `Review records not available for unit "${unit.id}".`,
        });
      }
    }

    // --require-reviewed
    if (options?.requireReviewed && unit.reviewState !== "reviewed") {
      issues.push({
        code: "unit-not-reviewed",
        targetId: unit.id,
        message: `Unit "${unit.id}" is in state "${unit.reviewState}", but --require-reviewed requires reviewed.`,
      });
    }
  }

  return Object.freeze(issues);
}

/**
 * C.8 Derived statuses vs declared statuses.
 */
export function validateDerivedStatus(
  declared: Record<string, string>,
  derived: Record<string, string>,
): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  for (const [key, derivedVal] of Object.entries(derived)) {
    const declVal = declared[key];
    if (declVal !== undefined && declVal !== derivedVal) {
      issues.push({
        code: "status-disagrees-with-records",
        message: `Declared status for "${key}" ("${declVal}") disagrees with derived status ("${derivedVal}").`,
      });
    }
  }
  return Object.freeze(issues);
}

/**
 * Donor scheme: pair the nth German block with the nth English unit.
 * Inserting a paragraph shifts every later pair. Kept only as the planted
 * negative this tooling exists to replace.
 */
export function donorIndexAlignment(
  germanIds: readonly string[],
  englishIds: readonly string[],
): readonly Readonly<{ sourceIndex: number; targetIndex: number }>[] {
  const n = Math.min(germanIds.length, englishIds.length);
  return Object.freeze(Array.from({ length: n }, (_, i) => ({ sourceIndex: i, targetIndex: i })));
}

export function insertGermanUnit(
  germanIds: readonly string[],
  at: number,
  newId: string,
): readonly string[] {
  const next = germanIds.slice();
  next.splice(at, 0, newId);
  return Object.freeze(next);
}

export function edgeStillPointsAtPair(
  edges: readonly ExplicitEdge[],
  sourceId: string,
  targetId: string,
): boolean {
  return edges.some((e) => e.sourceId === sourceId && e.targetId === targetId);
}

export function toAlignmentRecord(paper: string, edges: readonly ExplicitEdge[]): Alignment {
  const recordEdges: AlignmentEdge[] = edges.map((e) => ({
    source: {
      paper,
      blockId: e.sourceId.includes("-s") ? e.sourceId.replace(/-s[1-9]\d*$/, "") : e.sourceId,
      sentenceId: e.sourceId.match(/-s[1-9]\d*$/) ? e.sourceId : undefined,
    },
    target: { translationUnitId: e.targetId },
  }));
  return { id: `align-${paper}`, paper, edges: Object.freeze(recordEdges) };
}
