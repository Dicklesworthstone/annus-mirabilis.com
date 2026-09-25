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
  /** Null when the entry's paper has no reading page yet, so the first use is named, not linked. */
  readonly firstUseUrl: string | null;
  readonly searchKeywords: readonly string[];
  /** Where the meaning holds, in the reader's words: "§2, §5 and §8", "introduction", "note 1". */
  readonly whereLabel: string;
  /** One label per `scope` token, in the same order, for the section filter's options. */
  readonly whereLabelParts: readonly string[];
  /** "Checked against the printed page on 19 September 2026.", or that it has not been. */
  readonly checkedLabel: string;
  /** The other entries printed with the same symbol: the collisions, readable. */
  readonly alsoPrinted: readonly {
    readonly id: string;
    readonly meaning: string;
    readonly paperTitle: string;
    readonly whereLabel: string;
  }[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function joinInProse(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * A scope token as a reader would say it. Tokens are paper-prefixed content ids ("lq-s1-fn1",
 * "me-s0-p5", "md-1911", "all"); papers 1 to 3 number their unnumbered introduction s0, and the
 * mass-energy paper has no sections, so its s0 is the whole paper. An unrecognised token is
 * returned as it is, so a new kind shows up on the page instead of vanishing.
 */
export function formatScopeToken(paper: string, token: string): string {
  const whole = paper === "mass-energy";
  if (/(^|-)all$/.test(token)) return "throughout";
  if (/-1906$/.test(token)) return "the 1906 text";
  if (/-1911$/.test(token)) return "the 1911 correction";
  let m = /-s0-p(\d+)$/.exec(token);
  if (m) return whole ? `paragraph ${m[1]}` : `introduction, paragraph ${m[1]}`;
  if (/-s0$/.test(token)) return whole ? "throughout" : "introduction";
  m = /-s(\d+)-fn(\d+)$/.exec(token);
  if (m) return `§${m[1]}, note ${m[2]}`;
  m = /-s(\d+)$/.exec(token);
  if (m) return `§${m[1]}`;
  return token;
}

export function formatScope(paper: string, scope: readonly string[]): string {
  return joinInProse([...new Set(scope.map((token) => formatScopeToken(paper, token)))]);
}

function formatCheckedLabel(entry: ConcordanceEntry): string {
  if (PENDING_SCAN.test(entry.verification.checkedAgainst))
    return "Not yet checked against the printed page; taken from a transcription.";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.verification.date);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  const on = m && month ? ` on ${Number(m[3])} ${month} ${m[1]}` : "";
  // An agent's reading of the page image is not a review, and the label must not read like one. It
  // says who read it and no more (D-2026-09-25-no-review-status-banners).
  if (entry.verification.by.startsWith("agent:"))
    return `Read from the printed page by an agent${on}.`;
  return `Checked against the printed page${on}.`;
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
  /** "Paper 3 · 1905", or for the companion "The dissertation · 1906". */
  readonly eyebrow: string;
  readonly locator: string;
  readonly entries: readonly EnrichedConcordanceEntry[];
  readonly modernOnlySymbols: readonly (ModernOnlySymbol & {
    readonly glyphRendered: RenderedMath;
    /** formatScope of the symbol's scope, computed here so client components import no value. */
    readonly whereLabel: string;
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
    /**
     * The link's accessible name. Its only content is KaTeX, whose visual half is aria-hidden, and
     * neither Chromium nor WebKit names a link from the MathML half: on live /notation/ all 121
     * links read as "link" with no name. It begins with the glyph as displayed, so a reader who
     * says what they see still finds it (WCAG 2.5.3), then says how many meanings it has.
     */
    name: string;
    /**
     * What the glyph means in each paper that prints it, in the page's own order, with the symbol
     * a modern reader would write where the concordance gives one. Site search indexes the glyph
     * from this (src/search/documents.ts, notationDocuments), so a search for a symbol and this
     * page group its meanings the same way.
     */
    meanings: readonly { paperTitle: string; meaning: string; modernGlyph: string | null }[];
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
  // Say who did the checking: an agent reading page images is not a person reviewing them.
  const byAgent = checked.filter((e) => e.verification.by.startsWith("agent:")).length;
  const agentNote =
    byAgent === 0
      ? ""
      : byAgent === checked.length
        ? " An agent did that checking, reading each page image."
        : ` ${byAgent} of those checks ${byAgent === 1 ? "was" : "were"} made by an agent reading the page images.`;
  return { checkedCount: checked.length, pendingCount, message: message + agentNote };
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
    title: "Molecular dimensions",
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
  return `${glyphName}, ${entry.meaning}, ${paperTitle}, ${formatScope(entry.paper, entry.scope)}`;
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
 * The symbol a modern reader would write for an entry, as the concordance records it (a LaTeX or
 * Unicode string, or a glyph), or null where the operation names none.
 */
function modernGlyphOf(entry: EnrichedConcordanceEntry): string | null {
  const target = (entry.operation as { target?: { modernGlyph?: unknown } }).target;
  const glyph = target?.modernGlyph;
  if (typeof glyph === "string") return glyph.trim() || null;
  if (glyph && typeof glyph === "object") {
    const { latex, unicode } = glyph as { latex?: string; unicode?: string };
    return latex?.trim() || unicode?.trim() || null;
  }
  return null;
}

/** "φ, 7 meanings" for a glyph with several meanings; the glyph alone for one. */
export function glyphLinkName(display: string, meanings: number): string {
  return meanings > 1 ? `${display}, ${meanings} meanings` : display;
}

/**
 * Loads and constructs the full notation page data model.
 */
export function loadNotationPageData(
  injectedConcordances?: readonly PaperConcordance[],
  /** Where each first use opens (firstUseTargets.ts: the German paragraph, else the section's
   *  page, else the paper; null for a paper with no page). Without it the old paper-reading URL
   *  is built, which the page itself no longer uses. */
  resolveFirstUse?: (paper: string, anchor: string) => string | null,
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

      const firstUseUrl = resolveFirstUse
        ? resolveFirstUse(entry.paper, entry.sources.anchor)
        : buildFirstUseUrl(entry.paper, entry.sources.anchor);
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
        whereLabel: formatScope(entry.paper, entry.scope),
        whereLabelParts: entry.scope.map((token) => formatScopeToken(entry.paper, token)),
        checkedLabel: formatCheckedLabel(entry),
        alsoPrinted: [],
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
      eyebrow: meta.number <= 4 ? `Paper ${meta.number} · 1905` : "The dissertation · 1906",
      locator: meta.locator,
      entries: paperEntries,
      modernOnlySymbols: (pc.modernOnlySymbols ?? []).map((symbol) => ({
        ...symbol,
        glyphRendered: renderStaticKatex(symbol.glyph.latex || symbol.glyph.unicode),
        whereLabel: formatScope(pc.paper, symbol.scope),
      })),
    });
  }

  // Sort papers by paper number
  papersSections.sort((a, b) => a.paperNumber - b.paperNumber);

  // Second pass: each entry learns the other entries printed with its symbol. Every list that
  // holds entries is rewritten, so the catalogue, the clusters and the index see the same objects.
  const withSiblings = new Map<string, EnrichedConcordanceEntry>();
  for (const list of glyphMap.values()) {
    for (const entry of list) {
      withSiblings.set(entry.id, {
        ...entry,
        alsoPrinted: list
          .filter((other) => other.id !== entry.id)
          .map((other) => ({
            id: other.id,
            meaning: other.meaning,
            paperTitle: other.paperTitle,
            whereLabel: other.whereLabel,
          })),
      });
    }
  }
  const resolve = (entry: EnrichedConcordanceEntry) => withSiblings.get(entry.id) ?? entry;
  const entries = allEntries.map(resolve);
  const papers = papersSections.map((section) => ({
    ...section,
    entries: section.entries.map(resolve),
  }));
  for (const [key, list] of glyphMap) glyphMap.set(key, list.map(resolve));

  // Build collision clusters (glyphs with >1 entry or explicit collision record)
  const collisionClusters: CollisionCluster[] = [];
  for (const [gKey, entries] of glyphMap.entries()) {
    const hasCollision = entries.length > 1 || entries.some((e) => e.collision !== undefined);
    if (!hasCollision) continue;

    const hasDanger = entries.some((e) => e.collision?.severity === "danger");
    const sample = entries[0];
    if (!sample) continue;

    // Said in counts, not by listing titles: "Light quanta and Mass and energy" cannot be parsed,
    // and the list under each cluster names every paper anyway. A lone entry's collision is with
    // a meaning the page does not print, usually the modern one; its ids stay off the page.
    let desc = "";
    if (entries.length > 1) {
      const distinctPapers = new Set(entries.map((e) => e.paperTitle));
      desc =
        distinctPapers.size > 1
          ? `${entries.length} meanings across ${distinctPapers.size} papers.`
          : `${entries.length} meanings within ${sample.paperTitle}.`;
    } else if (sample.collision) {
      desc =
        sample.collision.kind === "cross-toggle"
          ? "Means something else in modern notation."
          : "Printed with another meaning elsewhere.";
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
      name: glyphLinkName(list[0]?.glyph.unicode || key, list.length),
      meanings: list.map((entry) => ({
        paperTitle: entry.paperTitle,
        meaning: entry.meaning,
        modernGlyph: modernGlyphOf(entry),
      })),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    totalEntriesCount: entries.length,
    totalCollisionsCount: totalCollisions,
    dangerCollisionsCount: dangerCount,
    papers,
    allEntries: entries,
    collisionClusters,
    uniqueGlyphs,
    honestyNotice: (() => {
      const verification = describeVerification(entries);
      return { isPendingFacsimile: verification.pendingCount > 0, ...verification };
    })(),
  };
}
