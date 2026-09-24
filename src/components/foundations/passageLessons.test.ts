import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripCommentsAndPreserveStrings } from "../../../scripts/rsc-client-boundary.ts";
import { contentIndex, loadPaper } from "../../content/server";
import { ELIMINATION_STEPS } from "../../equations/derivations/massEnergyElimination.ts";
import { lessonUses } from "./lessonUses.ts";
import { MASS_ENERGY_DERIVATION_ARGUMENT, passageLessons } from "./passageLessons.ts";

/**
 * am-ep-foundations-z1e: "every foundation has computed backlinks to all calling passages".
 * Measured on live at 01478983 by collecting every link record from the paper routes into a
 * lesson (lesson bodies excluded) and reading each lesson's rail: 9 of 72 passage-to-lesson links
 * had no backlink. Six came from obstacle answers (4) and the mass-energy derivation's step tools
 * (2), which render inside an argument but live outside its record; this file checks those six
 * now reach the rail. The other three, from first-encounter records, are reported on the bead.
 */

const index = await contentIndex();
const papers = await Promise.all(
  index.payloads.filter((p) => p.kind === "paper").map((p) => loadPaper(p.id)),
);
const lessons = new Set(index.payloads.filter((p) => p.kind === "foundation").map((p) => p.id));
const extra = passageLessons(papers.flatMap((p) => p.arguments));

/** The six measured gaps: argument, and the lesson it links without its record naming it. */
const MEASURED: readonly (readonly [string, string])[] = [
  ["arg-bm-observable", "distributions"],
  ["arg-bm-observable", "random-walks"],
  ["arg-lq-independent-configurations", "bridge-fractions-ratios"],
  ["arg-lq-independent-configurations", "logarithms"],
  ["arg-me-constant-premise", "bridge-negative-numbers-direction"],
  ["arg-me-constant-premise", "taylor-expansion"],
];

describe("lessons a passage links from outside its record", () => {
  test("the measured gaps are in the map, and every id in it is a lesson", () => {
    expect(papers.length).toBe(4);
    for (const [argument, lesson] of MEASURED)
      expect(extra.get(argument)?.has(lesson), `${argument} -> ${lesson}`).toBe(true);
    const all = [...extra.values()].flatMap((s) => [...s]);
    expect(all.length).toBeGreaterThan(0);
    for (const id of all) expect(lessons.has(id), id).toBe(true);
  });

  test("each derivation step's tool is credited to the argument that mounts the derivation", () => {
    for (const step of ELIMINATION_STEPS)
      expect(extra.get(MASS_ENERGY_DERIVATION_ARGUMENT)?.has(step.foundation)).toBe(true);
  });

  test("the lesson's rail now names those passages", () => {
    for (const [argument, lesson] of MEASURED)
      expect(
        lessonUses(lesson, papers, extra).some((u) => u.href.endsWith(`/#${argument}`)),
        `${lesson}'s rail names ${argument}`,
      ).toBe(true);
    // Without the map, the measured gap is back: the check is not satisfied by the records alone.
    expect(
      lessonUses("taylor-expansion", papers).some((u) =>
        u.href.endsWith(`/#${MASS_ENERGY_DERIVATION_ARGUMENT}`),
      ),
    ).toBe(false);
  });

  test("PaperPage still mounts the derivation in the argument this module credits", () => {
    const source = stripCommentsAndPreserveStrings(
      readFileSync(join(process.cwd(), "src/reader/PaperPage.tsx"), "utf8"),
    );
    expect(source).toMatch(
      new RegExp(
        `a\\.id === "${MASS_ENERGY_DERIVATION_ARGUMENT}" && \\(\\s*<MassEnergyDerivation />`,
      ),
    );
  });
});
