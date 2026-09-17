/**
 * Data loading and normalization for the Scoped Notation Concordance page.
 * Specification: AGENTS.md, am-not-concordance-model-uag, am-not-notation-page-2us.
 */

import { renderToString } from "katex";
import { loadAllConcordances } from "../../content/notation/loader.ts";
import type {
  CollisionRecord,
  ConcordanceEntry,
  ModernOnlySymbol,
  PaperConcordance,
} from "../../content/schemas/concordance.ts";

export interface RenderedMath {
  readonly html: string;
  readonly latex: string;
}

export interface EnrichedConcordanceEntry extends ConcordanceEntry {
  readonly paperTitle: string;
  readonly paperNumber: number;
  readonly spokenName: string;
  readonly glyphRendered: RenderedMath;
  readonly modernRendered?: RenderedMath | undefined;
  readonly firstUseUrl: string;
  readonly searchKeywords: readonly string[];
}

export interface CollisionCluster {
  readonly glyphKey: string;
  readonly glyphRendered: RenderedMath;
  readonly severity: "danger" | "caution";
  readonly entries: readonly EnrichedConcordanceEntry[];
  readonly description: string;
}

export interface PaperNotationSection {
  readonly paperSlug: string;
  readonly paperTitle: string;
  readonly paperNumber: number;
  readonly locator: string;
  readonly entries: readonly EnrichedConcordanceEntry[];
  readonly modernOnlySymbols: readonly (ModernOnlySymbol & { readonly glyphRendered: RenderedMath })[];
}

export interface NotationPageData {
  readonly totalEntriesCount: number;
  readonly totalCollisionsCount: number;
  readonly dangerCollisionsCount: number;
  readonly papers: readonly PaperNotationSection[];
  readonly allEntries: readonly EnrichedConcordanceEntry[];
  readonly collisionClusters: readonly CollisionCluster[];
  readonly uniqueGlyphs: readonly { key: string; display: string; count: number }[];
  readonly honestyNotice: {
    readonly isPendingFacsimile: boolean;
    readonly message: string;
  };
}

const PAPER_METADATA: Record<
  string,
  { title: string; number: number; locator: string }
> = {
  "light-quanta": {
    title: "Light Quanta",
    number: 1,
    locator: "Ann. Phys. (4) 17, 132–148 (1905)",
  },
  "brownian-motion": {
    title: "Brownian Motion",
    number: 2,
    locator: "Ann. Phys. (4) 17, 549–560 (1905)",
  },
  "special-relativity": {
    title: "Special Relativity",
    number: 3,
    locator: "Ann. Phys. (4) 17, 891–921 (1905)",
  },
  "mass-energy": {
    title: "Mass and Energy",
    number: 4,
    locator: "Ann. Phys. (4) 18, 639–641 (1905)",
  },
  "molecular-dimensions": {
    title: "Molecular Dimensions (Companion)",
    number: 5,
    locator: "Ann. Phys. (4) 19, 289–306 (1906)",
  },
};

/**
 * Renders a LaTeX string into KaTeX HTML+MathML for build-time static delivery.
 */
export function renderStaticKatex(latex: string, displayMode = false): RenderedMath {
  try {
    const html = renderToString(latex, {
      displayMode,
      output: "htmlAndMathml",
      throwOnError: false,
      strict: "warn",
      trust: false,
    });
    return { html, latex };
  } catch {
    return {
      html: `<span class="math-fallback">${latex}</span>`,
      latex,
    };
  }
}

/**
 * Generates an accessible, spoken description of a glyph in context.
 * Used for screen-reader aria-labels.
 */
export function generateSpokenName(entry: ConcordanceEntry, paperTitle: string): string {
  const glyphName = entry.glyph.latex.replace(/\\/g, "").replace(/[{}]/g, "");
  const scopeDesc = entry.scope.map((s) => s.replace(/^[a-z]+-/, "")).join(", ");
  return `${glyphName}, ${entry.meaning}, ${paperTitle}, section ${scopeDesc}`;
}

/**
 * Extracts all searchable tokens for an entry.
 */
export function extractSearchKeywords(entry: ConcordanceEntry, paperTitle: string): string[] {
  const tokens = new Set<string>();

  // Glyph identifiers
  if (entry.glyph.unicode) tokens.add(entry.glyph.unicode.toLowerCase());
  if (entry.glyph.latex) {
    tokens.add(entry.glyph.latex.toLowerCase());
    tokens.add(entry.glyph.latex.replace(/\\/g, "").toLowerCase());
  }

  // Meaning & Quantity ID
  tokens.add(entry.meaning.toLowerCase());
  for (const word of entry.meaning.toLowerCase().split(/[\s,()/-]+/)) {
    if (word.length > 1) tokens.add(word);
  }

  if ("quantityId" in entry.binding && entry.binding.quantityId) {
    tokens.add(entry.binding.quantityId.toLowerCase());
    // Split camelCase quantity ID
    const parts = entry.binding.quantityId.replace(/([A-Z])/g, " $1").toLowerCase().split(" ");
    for (const p of parts) {
      if (p.length > 1) tokens.add(p);
    }
  }

  // Modern symbol / group
  if (entry.operation.kind === "rename") {
    const target = entry.operation.target;
    if (target.form === "symbol" || target.form === "group") {
      const sym =
        typeof target.modernGlyph === "string"
          ? target.modernGlyph
          : target.modernGlyph.latex || target.modernGlyph.unicode;
      tokens.add(sym.toLowerCase());
      tokens.add(sym.replace(/\\/g, "").toLowerCase());
    }
    if (target.form === "group" && target.pattern) {
      tokens.add("group");
      if (entry.glyph.latex) tokens.add(entry.glyph.latex.toLowerCase());
    }
  }

  // Specific canonical group aliases
  if (entry.id.includes("R_over_N") || entry.glyph.latex.includes("R/N") || entry.glyph.latex.includes("R\\beta/N")) {
    tokens.add("r/n");
    tokens.add("k_b");
    tokens.add("boltzmann");
  }

  // Paper & Scope
  tokens.add(paperTitle.toLowerCase());
  tokens.add(entry.paper.toLowerCase());
  for (const s of entry.scope) {
    tokens.add(s.toLowerCase());
    tokens.add(s.replace(/^[a-z]+-/, "").toLowerCase());
    const secNum = s.replace(/^[a-z]+-s/, "");
    if (secNum) {
      tokens.add(`§${secNum}`);
      tokens.add(`section ${secNum}`);
    }
  }

  // Collision info
  if (entry.collision) {
    tokens.add("collision");
    tokens.add(entry.collision.severity);
    tokens.add(entry.collision.kind);
    for (const c of entry.collision.collidesWith) tokens.add(c.toLowerCase());
    if (entry.collision.collidesWithModern) {
      for (const cm of entry.collision.collidesWithModern) tokens.add(cm.toLowerCase());
    }
  }

  return Array.from(tokens);
}

/**
 * Builds the canonical first-use URL in the reader face.
 */
export function buildFirstUseUrl(paperSlug: string, anchor: string): string {
  return `/papers/${paperSlug}?view=reading#${anchor}`;
}

/**
 * Loads and constructs the full notation page data model.
 */
export function loadNotationPageData(
  injectedConcordances?: readonly PaperConcordance[],
): NotationPageData {
  const rawConcordances = injectedConcordances ?? loadAllConcordances();
  const allEntries: EnrichedConcordanceEntry[] = [];
  const papersSections: PaperNotationSection[] = [];
  const glyphMap = new Map<string, EnrichedConcordanceEntry[]>();

  let dangerCount = 0;
  let totalCollisions = 0;

  for (const pc of rawConcordances) {
    const meta = PAPER_METADATA[pc.paper] ?? {
      title: pc.paper,
      number: 99,
      locator: "Annalen der Physik (1905)",
    };

    const paperEntries: EnrichedConcordanceEntry[] = [];

    for (const entry of pc.entries) {
      // Exclude expected glyphs marked as not printed in the edition
      if (entry.verification && entry.verification.printed === false) {
        continue;
      }

      const paperTitle = meta.title;
      const spokenName = generateSpokenName(entry, paperTitle);
      const glyphRendered = renderStaticKatex(entry.glyph.latex || entry.glyph.unicode);

      let modernRendered: RenderedMath | undefined;
      if (entry.operation.kind === "rename") {
        const target = entry.operation.target;
        if (target.form === "symbol" || target.form === "group") {
          const mLatex =
            typeof target.modernGlyph === "string"
              ? target.modernGlyph
              : target.modernGlyph.latex || target.modernGlyph.unicode;
          modernRendered = renderStaticKatex(mLatex);
        }
      }

      const firstUseUrl = buildFirstUseUrl(entry.paper, entry.sources.anchor);
      const searchKeywords = extractSearchKeywords(entry, paperTitle);

      const enriched: EnrichedConcordanceEntry = {
        ...entry,
        paperTitle,
        paperNumber: meta.number,
        spokenName,
        glyphRendered,
        modernRendered,
        firstUseUrl,
        searchKeywords,
      };

      allEntries.push(enriched);
      paperEntries.push(enriched);

      if (entry.collision) {
        totalCollisions++;
        if (entry.collision.severity === "danger") {
          dangerCount++;
        }
      }

      // Index for collision clusters
      const gKey = (entry.glyph.latex || entry.glyph.unicode).trim();
      const existing = glyphMap.get(gKey) ?? [];
      existing.push(enriched);
      glyphMap.set(gKey, existing);
    }

    papersSections.push({
      paperSlug: pc.paper,
      paperTitle: meta.title,
      paperNumber: meta.number,
      locator: meta.locator,
      entries: paperEntries,
      modernOnlySymbols: (pc.modernOnlySymbols ?? []).map((symbol) => ({
        ...symbol,
        glyphRendered: renderStaticKatex(symbol.glyph.latex || symbol.glyph.unicode),
      })),
    });
  }

  // Sort papers by paper number
  papersSections.sort((a, b) => a.paperNumber - b.paperNumber);

  // Build collision clusters (glyphs with >1 entry or explicit collision record)
  const collisionClusters: CollisionCluster[] = [];
  for (const [gKey, entries] of glyphMap.entries()) {
    const hasCollision =
      entries.length > 1 || entries.some((e) => e.collision !== undefined);
    if (!hasCollision) continue;

    const hasDanger = entries.some((e) => e.collision?.severity === "danger");
    const sample = entries[0]!;

    let desc = "";
    if (entries.length > 1) {
      const distinctPapers = new Set(entries.map((e) => e.paperTitle));
      if (distinctPapers.size > 1) {
        desc = `Cross-paper collision across ${Array.from(distinctPapers).join(" and ")}.`;
      } else {
        desc = `Within-paper scope collision in ${sample.paperTitle}.`;
      }
    } else if (sample.collision) {
      desc = `Collision with ${sample.collision.collidesWith.join(", ")}.`;
    }

    collisionClusters.push({
      glyphKey: gKey,
      glyphRendered: renderStaticKatex(gKey),
      severity: hasDanger ? "danger" : "caution",
      entries,
      description: desc,
    });
  }

  // Sort collision clusters: danger first, then alphabetical
  collisionClusters.sort((a, b) => {
    if (a.severity === "danger" && b.severity !== "danger") return -1;
    if (a.severity !== "danger" && b.severity === "danger") return 1;
    return a.glyphKey.localeCompare(b.glyphKey);
  });

  // Unique glyph list for quick in-page navigation
  const uniqueGlyphs = Array.from(glyphMap.entries())
    .map(([key, list]) => ({
      key,
      display: list[0]?.glyph.unicode || key,
      count: list.length,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    totalEntriesCount: allEntries.length,
    totalCollisionsCount: totalCollisions,
    dangerCollisionsCount: dangerCount,
    papers: papersSections,
    allEntries,
    collisionClusters,
    uniqueGlyphs,
    honestyNotice: {
      isPendingFacsimile: true,
      message:
        "All notation concordance entries are currently marked pending facsimile verification. No pinned facsimile scan is committed in the repository, and entries reflect checked period transcriptions rather than direct pixel verifications.",
    },
  };
}
