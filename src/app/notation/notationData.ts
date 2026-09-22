/**
 * Data loading and normalization for the Scoped Notation Concordance page.
 * Specification: AGENTS.md, am-not-concordance-model-uag, am-not-notation-page-2us.
 */

import { renderToString } from "katex";
import { loadAllConcordances } from "../../content/notation/loader.ts";
import type {
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
  readonly modernOnlySymbols: readonly (ModernOnlySymbol & {
    readonly glyphRendered: RenderedMath;
  })[];
}

export interface NotationPageData {
  readonly totalEntriesCount: number;
  readonly totalCollisionsCount: number;
  readonly dangerCollisionsCount: number;
  readonly papers: readonly PaperNotationSection[];
  readonly allEntries: readonly EnrichedConcordanceEntry[];
  readonly collisionClusters: readonly CollisionCluster[];
  /**
   * One item per printed glyph for the index at the top of the page: `html` is the glyph set by
   * KaTeX (HTML and MathML) rather than its ASCII spelling, and `href` is the first entry that
   * uses it, an element that exists on the page.
   */
  readonly uniqueGlyphs: readonly {
    key: string;
    display: string;
    count: number;
    html: string;
    href: string;
  }[];
  /**
   * How far the entries have been checked against the printed pages, computed from each entry's
   * `verification.checkedAgainst`, so the sentence cannot outlive the records it describes.
   */
  readonly honestyNotice: {
    readonly isPendingFacsimile: boolean;
    readonly checkedCount: number;
    readonly pendingCount: number;
    readonly message: string;
  };
}

/** The controlled wording every not-yet-checked entry carries in `verification.checkedAgainst`. */
const PENDING_SCAN = /^Pending facsimile scan\b/;

/**
 * The status sentence under the page's lead: how many entries have been checked symbol by symbol
 * against the printed pages, for which papers, and how many still come from transcriptions only.
 */
export function describeVerification(entries: readonly EnrichedConcordanceEntry[]): {
  checkedCount: number;
  pendingCount: number;
  message: string;
} {
  const checked = entries.filter((e) => !PENDING_SCAN.test(e.verification.checkedAgainst));
  const pendingCount = entries.length - checked.length;
  const papers = [...new Set(checked.map((e) => e.paperTitle))];
  const where = papers.length === 1 ? `, all of them in ${papers[0]}` : "";
  const pending = `${pendingCount === 1 ? "entry was" : "entries were"} taken from transcriptions of the papers and ${pendingCount === 1 ? "has" : "have"} not yet been checked against the scans`;
  const one = entries.length === 1;
  const message =
    checked.length === 0
      ? one
        ? "The one entry has not yet been checked against the printed pages; it was taken from a transcription of the paper."
        : `None of the ${entries.length} entries has yet been checked against the printed pages. All of them were taken from transcriptions of the papers.`
      : pendingCount === 0
        ? one
          ? "The one entry has been checked symbol by symbol against the printed pages."
          : `All ${entries.length} entries have been checked symbol by symbol against the printed pages.`
        : `${checked.length} of ${entries.length} entries ${checked.length === 1 ? "has" : "have"} been checked symbol by symbol against the printed pages${where}. The other ${pendingCount} ${pending}.`;
  return { checkedCount: checked.length, pendingCount, message };
}

const PAPER_METADATA: Record<string, { title: string; number: number; locator: string }> = {
  "light-quanta": {
    title: "Light quanta",
    number: 1,
    locator: "Ann. Phys. (4) 17, 132–148 (1905)",
  },
  "brownian-motion": {
    title: "Brownian motion",
    number: 2,
    locator: "Ann. Phys. (4) 17, 549–560 (1905)",
  },
  "special-relativity": {
    title: "Special relativity",
    number: 3,
    locator: "Ann. Phys. (4) 17, 891–921 (1905)",
  },
  "mass-energy": {
    title: "Mass and energy",
    number: 4,
    locator: "Ann. Phys. (4) 18, 639–641 (1905)",
  },
  "molecular-dimensions": {
    title: "Molecular dimensions (the dissertation)",
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
    const parts = entry.binding.quantityId
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
      .split(" ");
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
  if (
    entry.id.includes("R_over_N") ||
    entry.glyph.latex.includes("R/N") ||
    entry.glyph.latex.includes("R\\beta/N")
  ) {
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
    const hasCollision = entries.length > 1 || entries.some((e) => e.collision !== undefined);
    if (!hasCollision) continue;

    const hasDanger = entries.some((e) => e.collision?.severity === "danger");
    const sample = entries[0];
    if (!sample) continue;

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
      html: renderStaticKatex(key).html,
      href: `#${list[0]?.id ?? ""}`,
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
    honestyNotice: (() => {
      const verification = describeVerification(allEntries);
      return { isPendingFacsimile: verification.pendingCount > 0, ...verification };
    })(),
  };
}
