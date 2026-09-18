/**
 * Scoped Notation Concordance Resolver.
 * Specification: am-not-concordance-model-uag, AGENTS.md (§2.3, §4.5, §4.7, §6.1, §11.4)
 */

import type { SourceManifest } from "../manifest/types.ts";
import type { ConcordanceEntry, Glyph, PaperConcordance } from "../schemas/concordance.ts";
import type {
  ModernGroupRename,
  PaperManifestIndex,
  ResolveGlyphResult,
  SourceManifestIndex,
} from "./types.ts";

/**
 * Normalizes a glyph representation to a comparable string.
 */
export function normalizeGlyph(glyph: string | Glyph): string {
  if (typeof glyph === "string") {
    return glyph.trim();
  }
  return (glyph.latex ?? glyph.unicode ?? "").trim();
}

/**
 * Normalizes a section ID or anchor to allow flexible cross-matching.
 * E.g., "s3", "bm-s3", "ap-17-549-s3" all share the core "s3".
 */
export function normalizeSectionId(id: string): string {
  const trimmed = id.trim();
  return trimmed.replace(/^ap-\d+-\d+-/, "").replace(/^(?:bm|sr|lq|me|md|ap)-/, "");
}

/**
 * Checks if a scope identifier matches a given anchor or sectionId.
 */
export function scopeMatches(
  entryScope: readonly string[],
  anchor: string,
  sectionId?: string,
): boolean {
  if (entryScope.includes("all")) return true;
  if (entryScope.includes(anchor)) return true;
  if (sectionId) {
    if (entryScope.includes(sectionId)) return true;
    const normSection = normalizeSectionId(sectionId);
    for (const s of entryScope) {
      if (s === normSection || normalizeSectionId(s) === normSection) {
        return true;
      }
    }
  }
  const normAnchor = normalizeSectionId(anchor);
  for (const s of entryScope) {
    if (s === normAnchor || normalizeSectionId(s) === normAnchor) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a lookup index from one or more SourceManifests.
 */
export function buildSourceManifestIndex(
  manifests: SourceManifest | readonly SourceManifest[] | Record<string, SourceManifest>,
): SourceManifestIndex {
  const manifestList: readonly SourceManifest[] = Array.isArray(manifests)
    ? manifests
    : "paper" in (manifests as Record<string, unknown>)
      ? [manifests as SourceManifest]
      : Object.values(manifests as Record<string, SourceManifest>);

  const paperMap = new Map<string, PaperManifestIndex>();

  for (const manifest of manifestList) {
    const paper = manifest.paper;
    const unitToSection = new Map<string, string>();
    const sectionToUnits = new Map<string, string[]>();
    const allAnchors = new Set<string>();
    const sections = new Set<string>();

    for (const unit of manifest.units) {
      allAnchors.add(unit.id);
      if (unit.section) {
        sections.add(unit.section);
        unitToSection.set(unit.id, unit.section);
        const list = sectionToUnits.get(unit.section) ?? [];
        list.push(unit.id);
        sectionToUnits.set(unit.section, list);
      }
    }

    paperMap.set(paper, {
      paper,
      document: manifest.document,
      unitToSection,
      sectionToUnits,
      allAnchors,
      sections,
    });
  }

  return {
    papers: paperMap,
    hasPaper(paper: string): boolean {
      return paperMap.has(paper);
    },
    hasAnchor(paper: string, anchor: string): boolean {
      const p = paperMap.get(paper);
      if (!p) return false;
      if (p.allAnchors.has(anchor)) return true;
      if (p.sections.has(anchor)) return true;
      const norm = normalizeSectionId(anchor);
      for (const s of p.sections) {
        if (s === norm || normalizeSectionId(s) === norm) return true;
      }
      for (const a of p.allAnchors) {
        if (a === norm || normalizeSectionId(a) === norm) return true;
      }
      return false;
    },
    getSectionForAnchor(paper: string, anchor: string): string | undefined {
      const p = paperMap.get(paper);
      if (!p) return undefined;
      if (p.unitToSection.has(anchor)) return p.unitToSection.get(anchor);
      if (p.sections.has(anchor)) return anchor;
      const norm = normalizeSectionId(anchor);
      for (const s of p.sections) {
        if (s === norm || normalizeSectionId(s) === norm) return s;
      }
      for (const [u, s] of p.unitToSection.entries()) {
        if (u === norm || normalizeSectionId(u) === norm) return s;
      }
      return undefined;
    },
    getSectionAnchors(paper: string, sectionId: string): readonly string[] {
      const p = paperMap.get(paper);
      if (!p) return [];
      const direct = p.sectionToUnits.get(sectionId);
      if (direct) return direct;
      const norm = normalizeSectionId(sectionId);
      for (const [sec, list] of p.sectionToUnits.entries()) {
        if (sec === norm || normalizeSectionId(sec) === norm) return list;
      }
      return [];
    },
  };
}

/**
 * Finds a paper concordance by paper slug from a single instance or array.
 */
export function getPaperConcordance(
  paper: string,
  concordance: PaperConcordance | readonly PaperConcordance[],
): PaperConcordance | undefined {
  if (Array.isArray(concordance)) {
    return (concordance as readonly PaperConcordance[]).find((c) => c.paper === paper);
  }
  const single = concordance as PaperConcordance;
  return single.paper === paper ? single : undefined;
}

/**
 * Resolves a printed glyph in a specific paper and anchor/section.
 * NEVER returns a ModernOnlySymbol.
 */
export function resolveGlyph(
  paper: string,
  anchor: string,
  glyph: string | Glyph,
  manifestIndex: SourceManifestIndex,
  concordance: PaperConcordance | readonly PaperConcordance[],
): ResolveGlyphResult {
  const paperConcordance = getPaperConcordance(paper, concordance);
  if (!paperConcordance) {
    return {
      ok: false,
      error: "unknownPaper",
      message: `Unknown paper "${paper}" in concordance.`,
    };
  }

  if (manifestIndex.papers.size > 0) {
    if (!manifestIndex.hasPaper(paper)) {
      return {
        ok: false,
        error: "unknownPaper",
        message: `Paper "${paper}" not found in source manifest index.`,
      };
    }
    if (!manifestIndex.hasAnchor(paper, anchor)) {
      return {
        ok: false,
        error: "unknownAnchor",
        message: `Anchor "${anchor}" not found in source manifest for paper "${paper}".`,
      };
    }
  }

  const sectionId = manifestIndex.getSectionForAnchor(paper, anchor);
  const targetGlyph = normalizeGlyph(glyph);

  const matches: ConcordanceEntry[] = [];
  for (const entry of paperConcordance.entries) {
    const entryLatex = normalizeGlyph(entry.glyph.latex);
    const entryUnicode = normalizeGlyph(entry.glyph.unicode);
    const glyphMatches =
      entryLatex === targetGlyph ||
      entryUnicode === targetGlyph ||
      entry.glyph.latex === targetGlyph ||
      entry.glyph.unicode === targetGlyph;

    if (glyphMatches && scopeMatches(entry.scope, anchor, sectionId)) {
      matches.push(entry);
    }
  }

  if (matches.length === 0) {
    return {
      ok: false,
      error: "unscoped",
      message: `Glyph "${targetGlyph}" has no concordance entry in scope "${anchor}" (${sectionId ?? "unassigned section"}) for paper "${paper}".`,
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      error: "ambiguous",
      message: `Glyph "${targetGlyph}" in scope "${anchor}" matches multiple concordance entries: ${matches.map((m) => m.id).join(", ")}.`,
    };
  }

  const match = matches[0];
  if (!match) {
    return {
      ok: false,
      error: "not-found",
      message: `Glyph "${targetGlyph}" not found in scope "${anchor}".`,
    };
  }

  return {
    ok: true,
    entry: match,
  };
}

/**
 * Retrieves all concordance entries in scope for a given anchor/section in a paper.
 */
export function entriesForAnchor(
  paper: string,
  anchor: string,
  manifestIndex: SourceManifestIndex,
  concordance: PaperConcordance | readonly PaperConcordance[],
): readonly ConcordanceEntry[] {
  const paperConcordance = getPaperConcordance(paper, concordance);
  if (!paperConcordance) return [];
  const sectionId = manifestIndex.getSectionForAnchor(paper, anchor);

  return paperConcordance.entries.filter((entry) => scopeMatches(entry.scope, anchor, sectionId));
}

/**
 * Returns the first use anchor for a given quantity ID, entry ID, or printed glyph in a paper.
 */
export function firstUse(
  paper: string,
  quantityIdOrGlyph: string,
  concordance: PaperConcordance | readonly PaperConcordance[],
): string | undefined {
  const paperConcordance = getPaperConcordance(paper, concordance);
  if (!paperConcordance) return undefined;

  const target = quantityIdOrGlyph.trim();
  const entry = paperConcordance.entries.find((e) => {
    if ("quantityId" in e.binding && e.binding.quantityId === target) return true;
    if (e.id === target) return true;
    if (e.glyph.latex === target || e.glyph.unicode === target) return true;
    return false;
  });

  if (!entry) return undefined;
  return entry.collision?.firstUseAnchor ?? entry.sources.anchor;
}

/**
 * Returns the first use anchor in a specific section for a quantity or glyph in a paper.
 */
export function firstUseInSection(
  paper: string,
  sectionId: string,
  quantityIdOrGlyph: string,
  concordance: PaperConcordance | readonly PaperConcordance[],
): string | undefined {
  const paperConcordance = getPaperConcordance(paper, concordance);
  if (!paperConcordance) return undefined;

  const target = quantityIdOrGlyph.trim();
  const entry = paperConcordance.entries.find((e) => {
    if ("quantityId" in e.binding && e.binding.quantityId === target) return true;
    if (e.id === target) return true;
    if (e.glyph.latex === target || e.glyph.unicode === target) return true;
    return false;
  });

  if (!entry) return undefined;

  if (entry.collision?.firstUseBySection) {
    const normSec = normalizeSectionId(sectionId);
    const found = entry.collision.firstUseBySection.find(
      (s) => s.sectionId === sectionId || normalizeSectionId(s.sectionId) === normSec,
    );
    if (found) return found.anchor;
  }

  if (scopeMatches(entry.scope, entry.sources.anchor, sectionId)) {
    return entry.sources.anchor;
  }

  return undefined;
}

/**
 * Retrieves modern group renames (e.g. R/N -> k_B, R\beta/N -> h, 2\kappa -> k_B) in scope.
 */
export function modernGroupsFor(
  paper: string,
  sectionIdOrAnchor: string,
  concordance: PaperConcordance | readonly PaperConcordance[],
  manifestIndex?: SourceManifestIndex,
): readonly ModernGroupRename[] {
  const paperConcordance = getPaperConcordance(paper, concordance);
  if (!paperConcordance) return [];

  const sectionId = manifestIndex?.getSectionForAnchor(paper, sectionIdOrAnchor);
  const result: ModernGroupRename[] = [];

  for (const entry of paperConcordance.entries) {
    if (!scopeMatches(entry.scope, sectionIdOrAnchor, sectionId)) continue;
    if (entry.operation.kind !== "rename") continue;
    const target = entry.operation.target;
    if (target.form === "group") {
      const modernGlyph =
        typeof target.modernGlyph === "string"
          ? target.modernGlyph
          : (target.modernGlyph.latex ?? target.modernGlyph.unicode);
      const printedGroup = entry.glyph.latex || entry.glyph.unicode;
      const factor = target.pattern.factor;
      const scale =
        factor && typeof factor === "object" && "num" in factor && "den" in factor
          ? factor
          : undefined;
      result.push({
        entryId: entry.id,
        printedGroup,
        modernGroup: modernGlyph,
        ...(scale ? { scale } : {}),
      });
    }
  }

  return result;
}

/**
 * Toggle contract: returns modern symbol string under modern perspective for rename operations only.
 * NEVER converts symbols for unitConversion (Gaussian fields remain unconverted).
 * NEVER converts symbols for modernization.
 * NEVER returns a ModernOnlySymbol.
 */
export function modernSymbolFor(
  paper: string,
  anchor: string,
  glyph: string | Glyph,
  manifestIndex: SourceManifestIndex,
  concordance: PaperConcordance | readonly PaperConcordance[],
  options?: { perspective?: "paper" | "modern" },
): string | undefined {
  const perspective = options?.perspective ?? "modern";
  const targetGlyph = normalizeGlyph(glyph);

  if (perspective === "paper") {
    return targetGlyph;
  }

  const res = resolveGlyph(paper, anchor, glyph, manifestIndex, concordance);
  if (!res.ok) {
    return undefined;
  }

  const entry = res.entry;
  // NEVER return modern symbol for unitConversion or modernization
  if (entry.operation.kind !== "rename") {
    return undefined;
  }

  const target = entry.operation.target;
  if (target.form === "symbol" || target.form === "group") {
    return typeof target.modernGlyph === "string"
      ? target.modernGlyph
      : target.modernGlyph.latex || target.modernGlyph.unicode;
  }

  if (target.form === "expression" || target.form === "scaled") {
    if (target.modernGlyph) {
      return typeof target.modernGlyph === "string"
        ? target.modernGlyph
        : target.modernGlyph.latex || target.modernGlyph.unicode;
    }
    return undefined;
  }

  return undefined;
}
