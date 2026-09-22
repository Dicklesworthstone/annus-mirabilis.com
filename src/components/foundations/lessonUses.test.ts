import { describe, expect, test } from "bun:test";
import { groupByPaper, lessonsBuildingOn, lessonsNamedBy, lessonUses } from "./lessonUses.ts";

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
