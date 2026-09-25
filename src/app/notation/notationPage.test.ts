/**
 * Unit & Integration Tests for the Scoped Notation Concordance Page (am-not-notation-page-2us).
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 */

import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { type FirstUseTargets, loadFirstUseTargets, resolveFirstUse } from "./firstUseTargets.ts";
import { GlyphNav } from "./GlyphNav.tsx";
import {
  describeVerification,
  type EnrichedConcordanceEntry,
  formatScope,
  formatScopeToken,
  glyphLinkName,
  loadNotationPageData,
  renderStaticKatex,
} from "./notationData.ts";
import { filterNotationEntries } from "./notationSearch.ts";

const logRunId = newRunIdentity();
const logger = getLogger("notation-page", logRunId);

function logTestPass(testId: string, message: string, extra: Record<string, unknown> = {}) {
  logger.log({
    testId,
    beadId: "am-not-notation-page-2us",
    suite: "notation-page",
    outcome: "passed",
    message,
    extra,
  });
}

describe("Notation Concordance Page (am-not-notation-page-2us)", () => {
  const data = loadNotationPageData();

  it("page data includes every compiled concordance entry from all available papers", () => {
    expect(data.allEntries.length).toBeGreaterThanOrEqual(50);
    expect(data.papers.length).toBeGreaterThanOrEqual(2);

    const papers = data.papers.map((p) => p.paperSlug);
    expect(papers).toContain("brownian-motion");
    expect(papers).toContain("special-relativity");

    logTestPass(
      "all-entries-loaded",
      `Loaded ${data.allEntries.length} entries across ${data.papers.length} papers.`,
    );
  });

  it("every first-use link opens a page that carries the passage it names", async () => {
    // This once checked only the URL's shape. The links it passed named an id no page carries
    // (/papers/<paper>?view=reading#bm-s1-p1), and 4 named the dissertation, which has no page.
    // Each link is now checked against what the site generates: the German face's block ids, the
    // section pages, the readable papers.
    const targets = await loadFirstUseTargets();
    const routed = loadNotationPageData(undefined, (paper, anchor) =>
      resolveFirstUse(paper, anchor, targets),
    );
    const linked = routed.allEntries.filter((e) => e.firstUseUrl !== null);
    expect(linked.length).toBeGreaterThan(0);
    for (const entry of linked) {
      const url = entry.firstUseUrl ?? "";
      expect(url).toMatch(/^\/papers\/[a-z-]+\/(view\/german\/#[a-z0-9-]+|s\d+\/)?$/);
      const german = /^\/papers\/([a-z-]+)\/view\/german\/#(.+)$/.exec(url);
      const section = /^\/papers\/([a-z-]+)\/(s\d+)\/$/.exec(url);
      const paper = /^\/papers\/([a-z-]+)\/$/.exec(url);
      if (german) expect(targets.german.get(german[1] ?? "")?.has(german[2] ?? "")).toBe(true);
      if (section) expect(targets.sections.has(`${section[1]}/${section[2]}`)).toBe(true);
      if (paper) expect(targets.readable.has(paper[1] ?? "")).toBe(true);
    }
    for (const entry of routed.allEntries.filter((e) => e.firstUseUrl === null)) {
      expect(targets.readable.has(entry.paper)).toBe(false);
    }
    // The unlinked path, proved on a paper that does have a page: withhold it, and every one of
    // its entries loses its link. (Asserting that some entry is unlinked today would break the
    // day the dissertation gets a page.)
    const withheld: FirstUseTargets = {
      ...targets,
      readable: new Set([...targets.readable].filter((p) => p !== "brownian-motion")),
    };
    const without = loadNotationPageData(undefined, (paper, anchor) =>
      resolveFirstUse(paper, anchor, withheld),
    );
    const brownian = without.allEntries.filter((e) => e.paper === "brownian-motion");
    expect(brownian.length).toBeGreaterThan(0);
    for (const entry of brownian) expect(entry.firstUseUrl).toBeNull();
    logTestPass("first-use-links-valid", "Every first-use link opens a page carrying its passage.");
  });

  it("a first use opens the German paragraph, else the section's page, else the paper; a paper with no page is not linked", () => {
    const targets: FirstUseTargets = {
      readable: new Set(["a-paper"]),
      sections: new Set(["a-paper/s2"]),
      german: new Map([["a-paper", new Set(["s1-p1"])]]),
    };
    expect(resolveFirstUse("a-paper", "ap-s1-p1", targets)).toBe(
      "/papers/a-paper/view/german/#s1-p1",
    );
    expect(resolveFirstUse("a-paper", "ap-s2-p3", targets)).toBe("/papers/a-paper/s2/");
    expect(resolveFirstUse("a-paper", "ap-s9-p1", targets)).toBe("/papers/a-paper/");
    expect(resolveFirstUse("no-page", "np-s1-p1", targets)).toBeNull();
  });

  it("every entry anchor is unique across the entire dataset, including case-distinct anchors", () => {
    const ids = new Set<string>();
    for (const entry of data.allEntries) {
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
    }

    // Case-distinct anchors test (e.g. sr.L vs sr.l if present)
    const upperL = data.allEntries.find((e) => e.id.includes(".L.") || e.glyph.latex === "L");
    const lowerL = data.allEntries.find((e) => e.id.includes(".l.") || e.glyph.latex === "l");
    if (upperL && lowerL) {
      expect(upperL.id).not.toBe(lowerL.id);
    }

    logTestPass("anchor-uniqueness", `All ${ids.size} entry anchors are strictly unique.`);
  });

  it("excludes fixture entries marked as not printed in the edition", () => {
    const fixtureConcordance: PaperConcordance = {
      paper: "light-quanta",
      entries: [
        {
          id: "lq.beta.wien",
          paper: "light-quanta",
          scope: ["lq-s2"],
          glyph: { unicode: "β", latex: "\\beta", variant: "plain" },
          meaning: "Wien radiation constant in exponential factor",
          binding: { quantityId: "wienConstantBeta" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "h/k_B" } },
          sources: { anchor: "lq-s2-p1", facsimilePage: 135 },
          verification: { printed: true, checkedAgainst: "AP 17", by: "Rev", date: "2026-09-17" },
        },
        {
          id: "lq.unprinted.ghost",
          paper: "light-quanta",
          scope: ["lq-s2"],
          glyph: { unicode: "G", latex: "G", variant: "plain" },
          meaning: "Ghost unprinted quantity",
          binding: { quantityId: "gravitationalConstant" },
          operation: { kind: "rename", target: { form: "symbol", modernGlyph: "G" } },
          sources: { anchor: "lq-s2-p1" },
          verification: {
            printed: false,
            checkedAgainst: "Unprinted in AP",
            by: "Rev",
            date: "2026-09-17",
          },
        },
      ],
    };

    const result = loadNotationPageData([fixtureConcordance]);
    expect(result.allEntries.some((e) => e.id === "lq.beta.wien")).toBe(true);
    expect(result.allEntries.some((e) => e.id === "lq.unprinted.ghost")).toBe(false);

    logTestPass("unprinted-excluded", "Unprinted fixture entry is excluded from page dataset.");
  });

  it("collision view data for phi includes a within-paper pair from Special Relativity", () => {
    const phiCluster = data.collisionClusters.find(
      (c) => c.glyphKey === "\\varphi" || c.glyphKey === "φ" || c.glyphKey === "\\phi",
    );
    expect(phiCluster).toBeDefined();
    if (!phiCluster) {
      throw new Error("Expected phiCluster to be defined");
    }
    expect(phiCluster.entries.length).toBeGreaterThanOrEqual(2);

    const srEntries = phiCluster.entries.filter((e) => e.paper === "special-relativity");
    expect(srEntries.length).toBeGreaterThanOrEqual(2);

    // One in §3 (function), one in §§7-8 (angle)
    const hasSection3 = srEntries.some((e) => e.scope.some((s) => s.includes("s3")));
    const hasWaveSection = srEntries.some((e) =>
      e.scope.some((s) => s.includes("s7") || s.includes("s8")),
    );
    expect(hasSection3).toBe(true);
    expect(hasWaveSection).toBe(true);

    logTestPass(
      "phi-collision-cluster",
      "Phi collision cluster properly identifies within-paper collisions in SR.",
    );
  });

  it("collision view data for beta includes danger collision with Lorentz factor", () => {
    const betaCluster = data.collisionClusters.find(
      (c) => c.glyphKey === "\\beta" || c.glyphKey === "β",
    );
    expect(betaCluster).toBeDefined();
    if (!betaCluster) {
      throw new Error("Expected betaCluster to be defined");
    }
    expect(betaCluster.severity).toBe("danger");

    const srBeta = betaCluster.entries.find((e) => e.id === "sr.beta.lorentzFactor");
    expect(srBeta).toBeDefined();
    if (!srBeta) {
      throw new Error("Expected srBeta to be defined");
    }
    expect(srBeta.collision?.severity).toBe("danger");
    expect(srBeta.collision?.collidesWith).toContain("speedRatio");
    expect(srBeta.collision?.collidesWith).toContain("wienConstantBeta");

    logTestPass(
      "beta-danger-collision",
      "Beta carries explicit danger collision against modern speedRatio (v/c).",
    );
  });

  it("search records for group renames index both printed and modern keys (e.g. R/N and k_B)", () => {
    const rnSearch = filterNotationEntries(data.allEntries, { query: "R/N" });
    expect(rnSearch.filteredEntries.length).toBeGreaterThan(0);
    expect(
      rnSearch.filteredEntries.some(
        (e) => e.id.includes("R_over_N") || e.glyph.latex.includes("R/N"),
      ),
    ).toBe(true);

    const kbSearch = filterNotationEntries(data.allEntries, { query: "k_B" });
    expect(kbSearch.filteredEntries.length).toBeGreaterThan(0);
    expect(
      kbSearch.filteredEntries.some(
        (e) =>
          e.id.includes("R_over_N") ||
          e.glyph.latex.includes("R/N") ||
          e.meaning.toLowerCase().includes("boltzmann"),
      ),
    ).toBe(true);

    logTestPass("group-rename-search", "Searching R/N and k_B returns group rename entries.");
  });

  it("scope-aware search: searching 'beta' returns entries without collapsing them into one", () => {
    const search = filterNotationEntries(data.allEntries, { query: "beta" });
    expect(search.filteredEntries.length).toBeGreaterThanOrEqual(1);

    for (const e of search.filteredEntries) {
      expect(e.paper).toBeDefined();
      expect(e.scope.length).toBeGreaterThan(0);
    }

    logTestPass(
      "scope-aware-search",
      `Searching 'beta' returns ${search.filteredEntries.length} distinct entries.`,
    );
  });

  it("search for viscosity returns k in Brownian motion with danger collision notice", () => {
    const search = filterNotationEntries(data.allEntries, { query: "viscosity" });
    expect(search.filteredEntries.length).toBeGreaterThanOrEqual(1);

    const kEntry = search.filteredEntries.find((e) => e.id === "bm.k.viscosity");
    expect(kEntry).toBeDefined();
    if (!kEntry) {
      throw new Error("Expected kEntry to be defined");
    }
    expect(kEntry.glyph.latex).toBe("k");
    expect(kEntry.collision?.severity).toBe("danger");
    expect(kEntry.collision?.collidesWith).toContain("boltzmannConstant");
    expect(kEntry.operation.kind).toBe("rename");
    if (kEntry.operation.kind === "rename" && kEntry.operation.target.form === "symbol") {
      expect(kEntry.operation.target.modernGlyph).toBe("\\eta");
    }

    logTestPass(
      "viscosity-search",
      "Found k viscosity in Brownian Motion with danger collision against Boltzmann constant and modern \\eta.",
    );
  });

  it("search for speed of light returns V in Special Relativity", () => {
    const search = filterNotationEntries(data.allEntries, { query: "speed of light" });
    expect(search.filteredEntries.length).toBeGreaterThanOrEqual(1);

    const vLight = search.filteredEntries.find((e) => e.id === "sr.V.speedOfLight");
    expect(vLight).toBeDefined();
    if (!vLight) {
      throw new Error("Expected vLight to be defined");
    }
    expect(vLight.glyph.latex).toBe("V");

    logTestPass("speed-of-light-search", "Found V speed of light in Special Relativity.");
  });

  it("filters correctly by paper, section, operation kind, and collision severity", () => {
    // Filter by paper
    const srOnly = filterNotationEntries(data.allEntries, { paper: "special-relativity" });
    expect(srOnly.filteredEntries.every((e) => e.paper === "special-relativity")).toBe(true);

    // Filter by operation kind
    const renames = filterNotationEntries(data.allEntries, { operation: "rename" });
    expect(renames.filteredEntries.every((e) => e.operation.kind === "rename")).toBe(true);

    // Filter by collision severity
    const dangerOnly = filterNotationEntries(data.allEntries, { collision: "danger" });
    expect(dangerOnly.filteredEntries.every((e) => e.collision?.severity === "danger")).toBe(true);
    expect(dangerOnly.filteredEntries.length).toBe(data.dangerCollisionsCount);

    logTestPass(
      "faceted-filters",
      "All facet filters (paper, operation, collision) operate accurately.",
    );
  });

  // The notice used to be a fixed sentence asserting that every entry was pending and that no
  // facsimile was pinned, and this test asserted the sentence. Both stopped being true when the
  // 26 mass-energy entries were checked against ap-18-639. The notice is now computed from the
  // entries, so these assert properties that hold at any count.
  it("the verification notice partitions the entries it describes", () => {
    const { checkedCount, pendingCount, message, isPendingFacsimile } = data.honestyNotice;
    expect(checkedCount + pendingCount).toBe(data.totalEntriesCount);
    expect(isPendingFacsimile).toBe(pendingCount > 0);
    if (checkedCount > 0 && pendingCount > 0) {
      expect(message).toContain(`${checkedCount} of ${data.totalEntriesCount} entries`);
      expect(message).toContain(`The other ${pendingCount} `);
    }
    expect(message).not.toContain("No pinned facsimile");
    logTestPass("honesty-notice-partition", message, { checkedCount, pendingCount });
  });

  it("the verification notice says the right thing in each of its three states", () => {
    const entry = (checkedAgainst: string, paperTitle = "Mass and energy", by = "A. Reviewer") =>
      ({ verification: { checkedAgainst, by }, paperTitle }) as unknown as EnrichedConcordanceEntry;
    const pending = entry("Pending facsimile scan (ap-17-132)", "Light quanta");
    const checked = entry("Pinned facsimile ap-18-639, read as images");

    const none = describeVerification([pending, pending]);
    expect(none).toMatchObject({ checkedCount: 0, pendingCount: 2 });
    expect(none.message).toContain("None of the 2 entries");

    const all = describeVerification([checked, checked]);
    expect(all).toMatchObject({ checkedCount: 2, pendingCount: 0 });
    expect(all.message).toStartWith("All 2 entries have");
    expect(describeVerification([checked]).message).toStartWith("The one entry has been");
    expect(describeVerification([checked, pending, pending]).message).toStartWith(
      "1 of 3 entries has been",
    );

    const some = describeVerification([checked, checked, pending]);
    expect(some.message).toBe(
      "2 of 3 entries have been checked symbol by symbol against the printed pages, all of them in Mass and energy. The other 1 entry was taken from transcriptions of the papers and has not yet been checked against the scans.",
    );
    // "Pending" elsewhere in the text is not the controlled prefix.
    expect(describeVerification([entry("Checked; nothing pending")]).checkedCount).toBe(1);

    // An agent reading page images is not a person reviewing them, and the notice says who did it,
    // with no review clause (D-2026-09-25-no-review-status-banners).
    const agent = entry("Plate of printed page 639, read by eye", "Mass and energy", "agent:X");
    expect(describeVerification([agent, agent]).message).toEndWith(
      "An agent did that checking, reading each page image.",
    );
    expect(describeVerification([agent, checked, pending]).message).toContain(
      "1 of those checks was made by an agent reading the page images.",
    );
    expect(describeVerification([agent, agent]).message).not.toMatch(/review/);
    expect(describeVerification([checked, checked]).message).not.toContain("agent");
  });

  it("an entry an agent read from the plate never reads as a review", () => {
    let agentChecked = 0;
    for (const entry of data.allEntries) {
      if (!entry.verification.by.startsWith("agent:")) continue;
      agentChecked += 1;
      expect(entry.checkedLabel).toStartWith("Read from the printed page by an agent");
      // It names who read it and claims no check or review.
      expect(entry.checkedLabel).not.toMatch(/review|Checked against/);
    }
    // Non-vacuity: agents read most of the concordance from the plates on 2026-09-24.
    expect(agentChecked).toBeGreaterThan(0);
  });

  it("scope tokens read as a reader would say them", () => {
    expect(formatScopeToken("light-quanta", "lq-s3")).toBe("§3");
    expect(formatScopeToken("light-quanta", "lq-s1-fn1")).toBe("§1, note 1");
    expect(formatScopeToken("light-quanta", "lq-s0")).toBe("introduction");
    // The mass-energy paper has no sections, so its s0 is the whole paper.
    expect(formatScopeToken("mass-energy", "me-s0")).toBe("throughout");
    expect(formatScopeToken("mass-energy", "me-s0-p5")).toBe("paragraph 5");
    // A paragraph inside a numbered section, as the display bindings scope them (dispatch 224).
    expect(formatScopeToken("brownian-motion", "bm-s2-p7")).toBe("§2, paragraph 7");
    expect(formatScopeToken("special-relativity", "sr-s3-p18")).toBe("§3, paragraph 18");
    expect(formatScopeToken("light-quanta", "lq-s0-p2")).toBe("introduction, paragraph 2");
    expect(formatScopeToken("molecular-dimensions", "md-1911")).toBe("the 1911 correction");
    expect(formatScope("light-quanta", ["lq-s2", "lq-s5", "lq-s8"])).toBe("§2, §5 and §8");
    // An unknown token stays visible rather than vanishing.
    expect(formatScopeToken("light-quanta", "lq-part-9")).toBe("lq-part-9");
    // Across the real records, no raw content id reaches the page.
    const leaks = data.allEntries.filter((e) => /\b[a-z]{2}-(s\d|all\b|19\d\d)/.test(e.whereLabel));
    expect(leaks.map((e) => `${e.id}: ${e.whereLabel}`)).toEqual([]);
  });

  it("the same-symbol lists are symmetric and never list the entry itself", () => {
    const byId = new Map(data.allEntries.map((e) => [e.id, e]));
    let pairs = 0;
    for (const entry of data.allEntries) {
      for (const other of entry.alsoPrinted) {
        expect(other.id).not.toBe(entry.id);
        expect(byId.get(other.id)?.alsoPrinted.some((back) => back.id === entry.id)).toBe(true);
        pairs++;
      }
    }
    // Non-vacuity: the corpus has shared symbols (V, k, beta), so an empty result means the
    // second pass never ran, not that nothing collides.
    expect(pairs).toBeGreaterThan(0);
    logTestPass("same-symbol-symmetric", `${pairs} directed same-symbol links, all mutual.`);
  });

  it("every symbol in the index links to an entry that is on the page", () => {
    const ids = new Set(data.allEntries.map((e) => e.id));
    expect(data.uniqueGlyphs.length).toBeGreaterThan(0);
    for (const g of data.uniqueGlyphs) {
      expect(g.href.startsWith("#")).toBe(true);
      expect(ids.has(g.href.slice(1))).toBe(true);
      expect(g.html).toContain("<math");
    }
    logTestPass("glyph-index-targets", `${data.uniqueGlyphs.length} symbols, each to an entry.`);
  });

  it("names every symbol link, since a link holding only KaTeX has no name in any browser", () => {
    // Measured on live /notation/ before this: 121 of 121 links with no name in the Chromium and
    // WebKit accessibility trees, and axe link-name on every one.
    expect(glyphLinkName("α", 1)).toBe("α");
    expect(glyphLinkName("φ", 7)).toBe("φ, 7 meanings");
    const html = renderToStaticMarkup(createElement(GlyphNav, { glyphs: data.uniqueGlyphs }));
    const links = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    expect(links.length).toBe(data.uniqueGlyphs.length);
    const unnamed = links.filter((a) => !/\saria-label="[^"]+"/.test(a));
    expect(unnamed).toEqual([]);
    for (const g of data.uniqueGlyphs) {
      // The name starts with what a sighted reader sees (WCAG 2.5.3, label in name).
      expect(g.name.startsWith(g.display)).toBe(true);
      expect(g.name.includes("meanings")).toBe(g.count > 1);
    }
    logTestPass("glyph-index-names", `${links.length} symbol links, each named.`);
  });

  it("spoken aria-labels are generated with full context for accessibility", () => {
    for (const entry of data.allEntries) {
      expect(entry.spokenName).toBeDefined();
      expect(entry.spokenName.length).toBeGreaterThan(10);
      expect(entry.spokenName).toContain(entry.paperTitle);
    }
    logTestPass("spoken-aria-labels", "Spoken labels provide accessible audio descriptions.");
  });

  it("static KaTeX renders HTML+MathML without throwing", () => {
    const res = renderStaticKatex("\\beta = \\frac{1}{\\sqrt{1 - v^2/c^2}}");
    expect(res.html).toContain("<math");
    expect(res.html).toContain("katex");
    logTestPass("static-katex", "Static KaTeX rendered math successfully.");
  });
});
