import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SHELF_DISCLAIMER_NOTE, Shelf, sortShelfCards } from "./Shelf.tsx";
import type { KnowledgeCard } from "./types.ts";

describe("am-disc-knowledge-cards-iw8j: Shelf component and sort order", () => {
  const card1828: KnowledgeCard = {
    id: "brown-1828-microscopical-observations",
    proposition: "Brownian motion observations in 1827.",
    status: "available",
    sources: ["Phil. Mag. 4, 161 (1828)"],
    date: {
      earliest: "1828",
      latest: "1828",
      precision: "year",
      latestYear: 1828,
      eventKind: "published",
    },
  };

  const card1855: KnowledgeCard = {
    id: "fick-1855-diffusion",
    proposition: "Diffusion equation.",
    status: "available",
    sources: ["Pogg. Ann. (1855)"],
    date: {
      earliest: "1855",
      latest: "1855",
      precision: "year",
      latestYear: 1855,
      eventKind: "published",
    },
  };

  const card1904Month: KnowledgeCard = {
    id: "sutherland-1904-dunedin",
    proposition: "Diffusion formula presented Jan 1904.",
    status: "available",
    sources: ["AAAS 1904"],
    date: {
      earliest: "1904-01",
      latest: "1904-01",
      precision: "month",
      latestYear: 1904,
      eventKind: "presented",
    },
  };

  const card1904DayA: KnowledgeCard = {
    id: "alpha-1904-experiment",
    proposition: "Alpha experiment in May 1904.",
    status: "available",
    sources: ["Journal"],
    date: {
      earliest: "1904-05-15",
      latest: "1904-05-15",
      precision: "day",
      latestYear: 1904,
      eventKind: "performed",
    },
  };

  const card1904DayZ: KnowledgeCard = {
    id: "zeta-1904-experiment",
    proposition: "Zeta experiment on same day.",
    status: "available",
    sources: ["Journal"],
    date: {
      earliest: "1904-05-15",
      latest: "1904-05-15",
      precision: "day",
      latestYear: 1904,
      eventKind: "performed",
    },
  };

  const card1860Range: KnowledgeCard = {
    id: "maxwell-1860-equipartition",
    proposition: "Equipartition theorem across papers.",
    status: "available",
    sources: ["Phil. Mag."],
    date: {
      earliest: "1860",
      latest: "1879",
      precision: "range",
      latestYear: 1879,
      eventKind: "published",
    },
  };

  const card1909Later: KnowledgeCard = {
    id: "perrin-1909-sedimentation",
    proposition: "Sedimentation equilibrium verification.",
    status: "later",
    sources: ["Ann. Chim. Phys. (1909)"],
    date: {
      earliest: "1909",
      latest: "1909",
      precision: "year",
      latestYear: 1909,
      eventKind: "published",
    },
  };

  test("sortShelfCards orders cards by earliest date, latestYear, and breaks ties by id", () => {
    const unsorted = [card1904DayZ, card1855, card1904Month, card1828, card1860Range, card1904DayA];

    const sorted = sortShelfCards(unsorted);
    const sortedIds = sorted.map((c) => c.id);

    expect(sortedIds).toEqual([
      "brown-1828-microscopical-observations", // 1828
      "fick-1855-diffusion", // 1855
      "maxwell-1860-equipartition", // 1860
      "sutherland-1904-dunedin", // 1904-01
      "alpha-1904-experiment", // 1904-05-15 (id alpha before zeta)
      "zeta-1904-experiment", // 1904-05-15
    ]);
  });

  test("Shelf component renders disclaimer note, status legend, and excludes later cards", () => {
    const allCards = [card1828, card1855, card1909Later];
    const html = renderToStaticMarkup(<Shelf cards={allCards} />);

    // Disclaimer note present
    expect(html).toContain(SHELF_DISCLAIMER_NOTE);

    // Status legend present
    expect(html).toContain("Legend:");
    expect(html).toContain("Available by the end of 1904");
    expect(html).toContain("Parallel work: not available to a 1904 reader");
    expect(html).toContain("Admitted 1905 import");

    // 1828 and 1855 are on the shelf
    expect(html).toContain("brown-1828-microscopical-observations");
    expect(html).toContain("fick-1855-diffusion");

    // Later card 1909 is excluded from the shelf
    expect(html).not.toContain("perrin-1909-sedimentation");
  });
});
