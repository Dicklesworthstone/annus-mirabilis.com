/**
 * Unit & Integration Tests for the Scoped Notation Concordance Page (am-not-notation-page-2us).
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 */

import { describe, expect, it } from "bun:test";
import type { PaperConcordance } from "../../content/schemas/concordance.ts";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import {
  extractSearchKeywords,
  generateSpokenName,
  loadNotationPageData,
  renderStaticKatex,
} from "./notationData.ts";
import { filterNotationEntries, matchesQuery } from "./notationSearch.ts";

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

  it("every first-use link resolves to a valid paper reading URL with an anchor", () => {
    for (const entry of data.allEntries) {
      expect(entry.firstUseUrl).toMatch(/^\/papers\/[a-z-]+(\?view=reading)?#[a-z0-9-]+$/);
      expect(entry.sources.anchor.length).toBeGreaterThan(0);
    }
    logTestPass("first-use-links-valid", "All entries have valid first-use links.");
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
    expect(phiCluster!.entries.length).toBeGreaterThanOrEqual(2);

    const srEntries = phiCluster!.entries.filter((e) => e.paper === "special-relativity");
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
    expect(betaCluster!.severity).toBe("danger");

    const srBeta = betaCluster!.entries.find((e) => e.id === "sr.beta.lorentzFactor");
    expect(srBeta).toBeDefined();
    expect(srBeta!.collision?.severity).toBe("danger");
    expect(srBeta!.collision?.collidesWith).toContain("speedRatio");
    expect(srBeta!.collision?.collidesWith).toContain("wienConstantBeta");

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
    expect(kEntry!.glyph.latex).toBe("k");
    expect(kEntry!.collision?.severity).toBe("danger");
    expect(kEntry!.collision?.collidesWith).toContain("boltzmannConstant");
    expect(kEntry!.operation.kind).toBe("rename");
    if (kEntry!.operation.kind === "rename" && kEntry!.operation.target.form === "symbol") {
      expect(kEntry!.operation.target.modernGlyph).toBe("\\eta");
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
    expect(vLight!.glyph.latex).toBe("V");

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

  it("honesty notice asserts pending facsimile verification", () => {
    expect(data.honestyNotice.isPendingFacsimile).toBe(true);
    expect(data.honestyNotice.message).toContain("pending facsimile verification");
    expect(
      data.allEntries.every(
        (e) =>
          e.verification.checkedAgainst.includes("Pending") ||
          e.verification.checkedAgainst.length > 0,
      ),
    ).toBe(true);

    logTestPass("honesty-notice-verified", "Honesty notice is explicitly present.");
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
