/**
 * EVERY REGISTERED PLANT'S ANCHOR STILL NAMES TEXT THAT IS IN ITS FILE, EXACTLY ONCE.
 *
 * A plant is an exact-string edit: `find` is located in `file`, replaced by `replace`, the gate is
 * run, and the gate is required to go red naming `expectFailureNaming`. The whole mechanism rests on
 * `find` matching, and `find` is a string about a file that other people edit.
 *
 * WHEN IT STOPS MATCHING, THE CENSUS SAYS SO AND NOBODY HEARS IT. `judgePlant` reports
 * `plant-anchor-missing` for a dead anchor, which is correct and is reached only by
 * `bun scripts/gate-census.ts --plants` -- a run that executes all 60 recorded gates and then one
 * more whole gate run per plant. That is minutes per plant and nobody pays it to check one record,
 * so the finding sat unread.
 *
 * MEASURED, not hypothesised. `receipts-minimum-unreachable` anchored on `minimum: 6,` in
 * scripts/check-receipts.ts. On 2026-10-07, d072d0aa4 gave that gate a `--key` mode and its floor
 * became `options.key ? 1 : 6`, so from that commit the anchor matched 0 times and the plant proved
 * nothing for fourteen days while reading, in the records file, exactly like the 41 live ones.
 *
 * SO THE ANCHORS ARE CHECKED WITHOUT RUNNING ANY GATE. This reads strings and files, costs
 * milliseconds, and lives in the bun unit lane rather than in the census the plants belong to --
 * AGENTS.md, "A Gate's Own Test Must Not Live Only In The Lane That Gate Controls". The half it
 * cannot answer is whether a gate actually goes red with the plant applied; only `--plants` shows
 * that, and `--gate <id>` now makes it affordable for one record at a time.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CENSUS_RECORDS, type GatePlant } from "./records.ts";

const ROOT = resolve(new URL("../../", import.meta.url).pathname);
const PLANTS: readonly GatePlant[] = CENSUS_RECORDS.flatMap((record) => record.plants);

/** How many times a plant's anchor occurs in its file. -1 when the file is absent. */
function anchorOccurrences(plant: GatePlant): number {
  const path = join(ROOT, plant.file);
  if (!existsSync(path)) return -1;
  return readFileSync(path, "utf8").split(plant.find).length - 1;
}

describe("every census plant can still be applied", () => {
  test("the plant population is not vacuous", () => {
    const withPlants = CENSUS_RECORDS.filter((r) => r.plants.length > 0).length;
    console.log(
      `[census] plant anchors: ${PLANTS.length} plant(s) over ${withPlants} of ${CENSUS_RECORDS.length} record(s)`,
    );
    // A records file that exported nothing would make every assertion below iterate zero times and
    // pass. Measured 2026-10-21: 42 plants over 42 of 60 records.
    expect(PLANTS.length).toBeGreaterThanOrEqual(30);
    expect(withPlants).toBeGreaterThanOrEqual(30);
  });

  test("each plant's file exists", () => {
    const missing = PLANTS.filter((p) => !existsSync(join(ROOT, p.file))).map(
      (p) => `${p.id} -> ${p.file}`,
    );
    expect(missing, missing.join("\n")).toEqual([]);
  });

  test("each plant's anchor occurs exactly once in its file", () => {
    const wrong = PLANTS.map((p) => ({ plant: p, n: anchorOccurrences(p) }))
      .filter(({ n }) => n !== 1)
      .map(
        ({ plant, n }) =>
          `${plant.id}: anchor occurs ${n}x in ${plant.file} -> ${JSON.stringify(plant.find)}`,
      );
    // Named, not counted: a dead anchor is repaired by reading what the floor became, so this prints
    // the string that no longer matches rather than only how many did not.
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  test("no plant is a no-op, and none names an empty failure text", () => {
    const noop = PLANTS.filter((p) => p.find === p.replace).map((p) => p.id);
    expect(noop, `these plants replace their anchor with itself: ${noop.join(", ")}`).toEqual([]);
    // `output.includes("")` is true of every string, so an empty expectFailureNaming would make
    // `plant-red-for-the-wrong-reason` unreachable and any red at all count as proof. The shortest
    // in use is "VACUOUS", at 7 characters.
    const unnamed = PLANTS.filter((p) => p.expectFailureNaming.trim().length < 5).map(
      (p) => `${p.id}: ${JSON.stringify(p.expectFailureNaming)}`,
    );
    expect(unnamed, unnamed.join("\n")).toEqual([]);
  });

  test("plant ids are unique, since every finding names its plant by id", () => {
    const counts = new Map<string, number>();
    for (const plant of PLANTS) counts.set(plant.id, (counts.get(plant.id) ?? 0) + 1);
    const duplicated = [...counts.entries()]
      .filter(([, n]) => n > 1)
      .map(([id, n]) => `${id} appears ${n}x`);
    expect(duplicated, duplicated.join("\n")).toEqual([]);
  });

  test("PLANTED: the real dead anchor of 2026-10-07 is caught, and the live one is not", () => {
    /*
     * The receipts plant as it stood for fourteen days: the literal floor, against a file whose
     * floor is now an expression. Reconstructed rather than invented, so this test is known to
     * reach the defect it was written for.
     */
    const dead: GatePlant = {
      id: "receipts-minimum-unreachable",
      file: "scripts/check-receipts.ts",
      find: "minimum: 6,",
      replace: "minimum: 99999999,",
      expectFailureNaming: "VACUOUS",
      why: "the pre-2026-10-21 anchor, kept here as this test's plant",
    };
    expect(
      anchorOccurrences(dead),
      "scripts/check-receipts.ts holds the literal floor again, so this plant no longer reconstructs the defect",
    ).toBe(0);

    // The control: the repaired anchor matches exactly once, so the zero above is the plant rather
    // than a wrong path or an unreadable file.
    const live = PLANTS.find((p) => p.id === "receipts-minimum-unreachable");
    expect(live, "the receipts plant is no longer registered").toBeDefined();
    if (live !== undefined) {
      expect(live.find).toContain("options.key");
      expect(anchorOccurrences(live)).toBe(1);
    }
  });
});
