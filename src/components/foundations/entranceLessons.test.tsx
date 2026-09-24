import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import lightQuantaEntrance from "../../../content/arguments/light-quanta/entrance-light-quanta.json";
import clockEntrance from "../../../content/arguments/special-relativity/entrance-special-relativity.json";
import { validateEntranceRecord } from "../../content/entrances/entranceRecord.ts";
import { contentIndex, loadPaper } from "../../content/server";
import massEnergyEntrance from "../../generated/mass-energy-entrance.json";
import { BrownianFirstEncounter } from "../../reader/entrances/BrownianFirstEncounter.tsx";
import { ClockFirstEncounter } from "../../reader/entrances/ClockFirstEncounter.tsx";
import { LightQuantaFirstEncounter } from "../../reader/entrances/LightQuantaFirstEncounter.tsx";
import { MassEnergyFirstEncounter } from "../../reader/entrances/MassEnergyFirstEncounter.tsx";
import type { MassEnergyEntranceScenario } from "../../reader/entrances/massEnergyExample.ts";
import { lessonUses } from "./lessonUses.ts";
import { entranceLessons } from "./passageLessons.ts";

/**
 * am-ep-foundations-z1e: "every foundation has computed backlinks to all calling passages".
 * Measured on live at 01478983, three first encounters sent readers to a lesson whose rail did not
 * name them: light quanta to bridge-fractions-ratios, special relativity to frames-events, mass and
 * energy to work-energy. The rail now reads each entrance record's bridge; this checks that what
 * the record names is what the entrance renders, because the components write their links in
 * their own markup rather than from the record.
 */

const index = await contentIndex();
const papers = await Promise.all(
  index.payloads.filter((p) => p.kind === "paper").map((p) => loadPaper(p.id)),
);
const lessons = new Set(index.payloads.filter((p) => p.kind === "foundation").map((p) => p.id));
const entrances = entranceLessons();

/** Each entrance rendered with the props its page gives it (PaperPage, and PaperReader for Brownian). */
const RENDERED: Readonly<Record<string, string>> = {
  "light-quanta": renderToStaticMarkup(
    <LightQuantaFirstEncounter record={validateEntranceRecord(lightQuantaEntrance)} />,
  ),
  // PaperReader mounts the Brownian entrance with no record, so it renders its own defaults.
  "brownian-motion": renderToStaticMarkup(<BrownianFirstEncounter />),
  "special-relativity": renderToStaticMarkup(
    <ClockFirstEncounter record={validateEntranceRecord(clockEntrance)} />,
  ),
  "mass-energy": renderToStaticMarkup(
    <MassEnergyFirstEncounter
      record={validateEntranceRecord(massEnergyEntrance.record)}
      scenarios={massEnergyEntrance.scenarios as readonly MassEnergyEntranceScenario[]}
      sourceDigest={massEnergyEntrance.sourceDigest}
    />,
  ),
};

/** The lessons a rendered entrance links to, by the path of each link. */
const linkedLessons = (html: string) =>
  new Set([...html.matchAll(/href="\/foundations\/([^/"#?]+)\/?["#?]/g)].map((m) => m[1] ?? ""));

/** The three measured gaps, and the Brownian entrance, whose lesson its sections already name. */
const MEASURED: readonly (readonly [string, string])[] = [
  ["light-quanta", "bridge-fractions-ratios"],
  ["brownian-motion", "mean-variance-rms"],
  ["special-relativity", "frames-events"],
  ["mass-energy", "work-energy"],
];

describe("lessons a paper's first encounter links", () => {
  test("each paper's entrance names its measured lesson, and every name is a lesson", () => {
    expect([...entrances.keys()].sort()).toEqual(Object.keys(RENDERED).sort());
    for (const [paper, lesson] of MEASURED)
      expect(entrances.get(paper)?.lessons.has(lesson), `${paper} -> ${lesson}`).toBe(true);
    for (const { lessons: named } of entrances.values())
      for (const id of named) expect(lessons.has(id), id).toBe(true);
  });

  test("each entrance, rendered as its page renders it, links exactly the lessons its record names", () => {
    for (const [paper, html] of Object.entries(RENDERED)) {
      expect(html, `${paper} carries its anchor`).toContain(`id="entry-${paper}"`);
      const linked = linkedLessons(html);
      expect(linked.size, `${paper} links at least one lesson`).toBeGreaterThan(0);
      expect([...linked].sort(), paper).toEqual([...(entrances.get(paper)?.lessons ?? [])].sort());
    }
  });

  test("the lesson's rail names the entrance first under its paper, by its question", () => {
    for (const [paper, lesson] of MEASURED) {
      const uses = lessonUses(lesson, papers, new Map(), entrances);
      const mine = uses.filter((u) => u.href.startsWith(`/papers/${paper}/`));
      expect(mine[0]?.href, `${lesson}'s rail`).toBe(`/papers/${paper}/#entry-${paper}`);
      expect(mine[0]?.section).toBe("First encounter");
      expect(mine[0]?.title).toBe(entrances.get(paper)?.question ?? "");
      expect(mine[0]?.title.length).toBeGreaterThan(0);
      // Without the entrances, the gap is back: no argument record reaches an entrance's anchor.
      expect(lessonUses(lesson, papers).some((u) => u.href.includes("#entry-"))).toBe(false);
    }
  });
});
