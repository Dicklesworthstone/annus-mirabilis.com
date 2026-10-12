import { describe, expect, test } from "bun:test";
import {
  formulaUses,
  groupByPaper,
  lessonsBuildingOn,
  lessonsNamedBy,
  lessonUses,
} from "./lessonUses.ts";

const lesson = (id: string) => ({ kind: "foundation", id });
const brownian = {
  paper: {
    id: "brownian-motion",
    title: "Brownian motion: from wandering to a measurable law",
    sections: [
      { id: "s4", title: "§4 · From random displacement to diffusion", arguments: ["a1", "a2"] },
      { id: "s5", title: "§5 · From displacement to molecular scale", arguments: ["a3"] },
    ],
  },
  arguments: [
    // Listed out of section order on purpose: the section's own list decides the order.
    { id: "a3", section: "s5", title: "Third", help: { why: "derivatives" } },
    { id: "a2", section: "s4", title: "Second", readings: { steps: [[lesson("derivatives")]] } },
    { id: "a1", section: "s4", title: "First", readings: { full: [lesson("integration")] } },
  ],
};
const massEnergy = {
  paper: {
    id: "mass-energy",
    title: "Mass and energy: two accounts, one subtraction",
    sections: [
      { id: "s0", title: "The unsectioned argument · explanatory reading", arguments: ["m1"] },
    ],
  },
  arguments: [{ id: "m1", section: "s0", title: "Only one", readings: [lesson("derivatives")] }],
};
const lightQuanta = {
  paper: {
    id: "light-quanta",
    title: "Light quanta: from entropy to an energy scale",
    sections: [
      { id: "s0", title: "Introduction · a heuristic viewpoint", arguments: ["l1"] },
      { id: "s1", title: "§1 · classical energy allocation", arguments: [] },
    ],
  },
  arguments: [{ id: "l1", section: "s0", title: "Opening", help: { example: "derivatives" } }],
};

describe("the passages that send a reader to a lesson", () => {
  test("found in readings and in help links, in reading order, each at its own anchor", () => {
    // Given in the wrong paper order, to show the order is Annalen's and not the input's.
    expect(lessonUses("derivatives", [massEnergy, brownian, lightQuanta])).toEqual([
      {
        href: "/papers/light-quanta/s0/#l1",
        paper: "Light quanta",
        section: "Introduction",
        title: "Opening",
      },
      {
        href: "/papers/brownian-motion/s4/#a2",
        paper: "Brownian motion",
        section: "§4",
        title: "Second",
      },
      {
        href: "/papers/brownian-motion/s5/#a3",
        paper: "Brownian motion",
        section: "§5",
        title: "Third",
      },
      // One section only, so a section label would name nothing a reader can find.
      {
        href: "/papers/mass-energy/s0/#m1",
        paper: "Mass and energy",
        section: null,
        title: "Only one",
      },
    ]);
  });

  test("grouped under their paper, in reading order, each paper named once", () => {
    const groups = groupByPaper(lessonUses("derivatives", [massEnergy, brownian, lightQuanta]));
    expect(groups.map((g) => [g.paper, g.uses.map((u) => u.title)])).toEqual([
      ["Light quanta", ["Opening"]],
      ["Brownian motion", ["Second", "Third"]],
      ["Mass and energy", ["Only one"]],
    ]);
    // Every passage lands in exactly one group.
    expect(groups.flatMap((g) => g.uses).length).toBe(4);
  });

  test("planted: an id that only appears as text, or as another kind of record, is not a link", () => {
    const decoy = {
      id: "d1",
      section: "s4",
      title: "Decoy",
      readings: {
        full: ["derivatives", { kind: "lab", id: "derivatives" }, { text: "see derivatives" }],
      },
    };
    expect(lessonsNamedBy(decoy).size).toBe(0);
    const paper = {
      ...brownian,
      paper: { ...brownian.paper, sections: [{ id: "s4", title: "§4 · x", arguments: ["d1"] }] },
      arguments: [decoy],
    };
    expect(lessonUses("derivatives", [paper])).toEqual([]);
  });

  test("lessons a passage links from outside its record count, in the same reading order", () => {
    // a1 names only integration in its record; its obstacle answers or a mounted derivation may
    // link derivatives too, which passageLessons.ts supplies keyed by argument.
    const extra = new Map([["a1", new Set(["derivatives"])]]);
    expect(lessonUses("derivatives", [brownian], extra).map((u) => u.href)).toEqual([
      "/papers/brownian-motion/s4/#a1",
      "/papers/brownian-motion/s4/#a2",
      "/papers/brownian-motion/s5/#a3",
    ]);
    // An extra entry for an argument no section lists still reaches nobody.
    const unlisted = new Map([["a9", new Set(["derivatives"])]]);
    expect(lessonUses("derivatives", [brownian], unlisted).map((u) => u.href)).toEqual([
      "/papers/brownian-motion/s4/#a2",
      "/papers/brownian-motion/s5/#a3",
    ]);
  });

  test("planted: an argument a section does not list is not a passage a reader can reach", () => {
    const orphan = {
      ...brownian,
      paper: { ...brownian.paper, sections: [{ id: "s4", title: "§4 · x", arguments: [] }] },
    };
    expect(lessonUses("derivatives", [orphan])).toEqual([]);
  });
});

describe("the lessons that build on a lesson", () => {
  test("both spellings of a prerequisite count, and nothing else does", () => {
    const lessons = [
      { id: "integration", title: "Adding continuously", prerequisites: ["derivatives"] },
      {
        id: "taylor-expansion",
        title: "A local expansion",
        prerequisites: [{ foundationId: "foundation:derivatives" }],
      },
      { id: "logarithms", title: "Logarithms", prerequisites: ["exponentials"] },
      // A prefix is not the id.
      { id: "partial-derivatives", title: "Partial", prerequisites: ["derivatives-2"] },
    ];
    expect(lessonsBuildingOn("derivatives", lessons)).toEqual([
      { href: "/foundations/integration/", title: "Adding continuously" },
      { href: "/foundations/taylor-expansion/", title: "A local expansion" },
    ]);
  });
});

describe("the printed displays that print a lesson's formulas", () => {
  const edges = [
    {
      paper: "brownian-motion",
      display: "eq-s2-d11",
      section: "s2",
      note: "Both laws at once.",
    },
    { paper: "light-quanta", display: "eq-s5-d6", section: "s5", note: "Boltzmann's principle." },
    { paper: "light-quanta", display: "eq-s5-d7", section: "s5", note: "The same, turned round." },
    { paper: "mass-energy", display: "eq-s0-d1", section: "s0", note: "The subtraction." },
    // s4 IS one of brownian's fixture sections, so this is the row that exercises a real printed
    // label. Without it every row here lands on a section the fixtures lack and reads null, and
    // the label a reader actually sees would go unasserted.
    { paper: "brownian-motion", display: "eq-s4-d9", section: "s4", note: "The bell curve." },
    { paper: "nowhere-paper", display: "eq-s1-d1", section: "s1", note: "Dropped: unknown paper." },
  ];

  test("rows carry the FACE route, because the bare section page has no display anchor", () => {
    // Measured 2026-10-12 on the built site: /papers/light-quanta/s5/ carries no id eq-s5-d6,
    // while view/parallel, view/english and view/german each do. A route to the bare section
    // would be a link that lands on the page and never reaches the formula.
    const rows = formulaUses(edges, [massEnergy, brownian, lightQuanta]);
    expect(rows.map((row) => row.href)).toEqual([
      "/papers/light-quanta/s5/view/parallel/#eq-s5-d6",
      "/papers/light-quanta/s5/view/parallel/#eq-s5-d7",
      "/papers/brownian-motion/s2/view/parallel/#eq-s2-d11",
      "/papers/brownian-motion/s4/view/parallel/#eq-s4-d9",
      "/papers/mass-energy/s0/view/parallel/#eq-s0-d1",
    ]);
  });

  test("the note is the row's title, and the section its printed label", () => {
    const rows = formulaUses(edges, [brownian, lightQuanta]);
    expect(rows[0]).toEqual({
      href: "/papers/light-quanta/s5/view/parallel/#eq-s5-d6",
      paper: "Light quanta",
      section: null,
      title: "Boltzmann's principle.",
    });
    // A section the paper does lay out is labelled as the paper prints it.
    const s4 = rows.find((row) => row.href.includes("#eq-s4-d9"));
    expect(s4?.section).toBe("\u00a74");
    expect(s4?.paper).toBe("Brownian motion");
    // brownian's s2 is not among its fixture sections, so no label is invented for it.
    expect(rows.find((row) => row.href.includes("#eq-s2-d11"))?.section).toBeNull();
  });

  test("a paper with one section is not labelled, and an unknown paper is dropped", () => {
    const rows = formulaUses(edges, [massEnergy]);
    expect(rows).toEqual([
      {
        href: "/papers/mass-energy/s0/view/parallel/#eq-s0-d1",
        paper: "Mass and energy",
        section: null,
        title: "The subtraction.",
      },
    ]);
    expect(rows.some((row) => row.href.includes("nowhere-paper"))).toBe(false);
  });

  test("a paper that prints a shape twice is named once", () => {
    const groups = groupByPaper(formulaUses(edges, [lightQuanta]));
    expect(groups.length).toBe(1);
    expect(groups[0]?.paper).toBe("Light quanta");
    expect(groups[0]?.uses.length).toBe(2);
  });
});
