/**
 * EVERY LABORATORY ROUTE THAT SHIPS IS IN THE AUDIT'S POPULATION, OR DECLARED HERE WITH A REASON.
 *
 * WHY THIS GUARD IS KEYED TO ROUTES AND NOT TO MANIFESTS, which is the whole point of it. Measured
 * 2026-10-13: `src/app/lab/` holds 41 instrument route directories and `out/lab/` holds the same
 * 41 built pages, while `loadLiveInstrumentRows` examines 38, because its population is
 * `CATALOGUE_IDS`. The three it never sees are `brownian-data`, `countermodels` and
 * `what-can-you-infer`.
 *
 * Those three are not static explainers. Read off their built HTML they carry 19, 21 and 20 reader
 * inputs and 5, 7 and 6 buttons, each with an honest execution label ("host calculation" on the
 * first two, "Static worked example" on the last two), which is the same shape as their peers
 * `light-thread` (16 inputs) and `avogadro-lab` (23) and as core labs like bm-06 (19).
 * `src/reader/actions/labNames.ts` names all five together under one comment, "Instruments that
 * serve more than one paper, or none", and two of the five are audited.
 *
 * AND THEY ARE EXACTLY THE THREE BUILT LAB PAGES THAT SHOW NO NOT-MODELED LINE. 38 of the 41 show
 * one; these three do not. That is not a coincidence, it is the mechanism: `NotModeledLine` reads
 * `content/experiments/<id>.yaml` and these three have no manifest, so the component would throw
 * rather than render. Every other guard in the chain is manifest-keyed too -- the audit's
 * `notModeled` column, `src/testing/notModeledVisible.test.tsx`, and the definition-of-done row --
 * so a lab page without a manifest is invisible to all of them at once, and AGENTS.md's rule that
 * `notModeled` is "shown as a plain line" goes unenforced on precisely the pages that do not meet
 * it.
 *
 * This file is the one check in that chain that cannot be escaped by not having a manifest, because
 * its population is the directory of routes. It does not fix the three: giving them manifests, a
 * `NON_CORE_INSTRUMENT_IDS` entry with a `kind` and an `owningBead`, and a `familyPaper` mapping
 * (all three return null today, where every one of the 38 catalogue ids maps) is work owned by
 * whoever owns those labs, and is filed on am-cm-audit-scripts-d34. What this does is make the
 * omission impossible to ENLARGE silently: a fourth unaudited lab route turns it red.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_INSTRUMENT_PATTERN, NON_CORE_INSTRUMENT_IDS } from "../ids.ts";
import { loadLiveInstrumentRows } from "./instruments.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * The lab routes that ship without being audited, each with why it is not simply added. Removing an
 * entry from here is the fix; adding one needs the same evidence these carry.
 */
const DECLARED_UNAUDITED: readonly Readonly<{ id: string; reason: string }>[] = [
  {
    id: "brownian-data",
    reason:
      'No manifest, so it is in no catalogue, shows no not-modeled line, and familyPaper returns null. labNames.ts calls it "What does your recording actually identify?". Needs a manifest and a NON_CORE_INSTRUMENT_IDS entry; the kind and owning bead are the owner\'s to name (am-cm-audit-scripts-d34).',
  },
  {
    id: "countermodels",
    reason:
      'No manifest, as above. labNames.ts calls it "What would actually distinguish these models?". It is the only one of the three carrying both a host-calculation and a static-worked-example label, so its model status is worth stating explicitly when its manifest is written.',
  },
  {
    id: "what-can-you-infer",
    reason:
      'No manifest, as above. labNames.ts calls it "Keep the data. Change what you know.". AGENTS.md treats a synthetic inverse exercise as having a model whose limits must be declared, so its notModeled list is not vacuous work.',
  },
];

/** What ships: one directory per instrument route. Always current, unlike out/. */
function labRoutes(): string[] {
  return readdirSync(join(ROOT, "src/app/lab"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
    .map((entry) => entry.name)
    .sort();
}

/**
 * The predicate, taken out of the test so a synthetic population can drive it. A plant cannot
 * create a real route here: RULE 2 of AGENTS.md forbids scratch files under `src`, and a new
 * directory in `src/app/lab` IS a route. So the control below feeds the same function a route list
 * with an id nobody declared, which is the part that could otherwise pass by the two sets happening
 * to agree.
 */
function undeclaredRoutes(
  routes: readonly string[],
  audited: ReadonlySet<string>,
  declared: ReadonlySet<string>,
): string[] {
  return routes.filter((id) => !audited.has(id) && !declared.has(id));
}

describe("the instrument audit's population is what ships", () => {
  test("every lab route is audited, core, or declared unaudited here", () => {
    const routes = labRoutes();
    const audited = new Set(loadLiveInstrumentRows(ROOT).map((row) => row.id));
    const declared = new Set(DECLARED_UNAUDITED.map((entry) => entry.id));

    const undeclared = undeclaredRoutes(routes, audited, declared);
    // Named, not counted, so a failure says which route to look at.
    expect(undeclared, `lab routes neither audited nor declared: ${undeclared.join(", ")}`).toEqual(
      [],
    );

    // The denominator beside the verdict, and a floor on it: an empty lab directory would satisfy
    // the assertion above while proving nothing.
    expect(routes.length).toBeGreaterThanOrEqual(38);
    console.log(
      `[census] instrument population: ${routes.length} lab route(s) ship, ${audited.size} audited, ` +
        `${routes.filter((id) => declared.has(id)).length} declared unaudited`,
    );
  });

  test("planted: a fourth unaudited lab route is caught, and a declared one is not", () => {
    const audited = new Set(loadLiveInstrumentRows(ROOT).map((row) => row.id));
    const declared = new Set(DECLARED_UNAUDITED.map((entry) => entry.id));
    const real = labRoutes();

    // The plant: one id nobody audits and nobody declared, added to the real population.
    const planted = [...real, "lab-nobody-declared"].sort();
    expect(planted.length).toBe(real.length + 1);
    expect(undeclaredRoutes(planted, audited, declared)).toEqual(["lab-nobody-declared"]);

    // The control in the other direction: the real population is clean, and a route that IS
    // declared stays clean, so the predicate is not simply flagging everything.
    expect(undeclaredRoutes(real, audited, declared)).toEqual([]);
    expect(undeclaredRoutes(["brownian-data"], audited, declared)).toEqual([]);
    // And one that is audited stays clean for the other reason.
    expect(undeclaredRoutes(["bm-06"], audited, declared)).toEqual([]);
    // Removing the declarations would surface all three, which is what this guard is holding.
    expect(undeclaredRoutes(real, audited, new Set())).toEqual([
      "brownian-data",
      "countermodels",
      "what-can-you-infer",
    ]);
  });

  test("the declarations are live, not stale", () => {
    // A declaration for a route that no longer ships, or for one that is now audited, is a stale
    // exemption and must be deleted rather than left to accumulate.
    const routes = new Set(labRoutes());
    const audited = new Set(loadLiveInstrumentRows(ROOT).map((row) => row.id));
    for (const entry of DECLARED_UNAUDITED) {
      expect(routes.has(entry.id), `${entry.id} is declared but ships no route`).toBe(true);
      expect(audited.has(entry.id), `${entry.id} is declared unaudited but IS audited now`).toBe(
        false,
      );
      // Each reason has to say something; a one-word reason is how an exemption list rots.
      expect(entry.reason.length).toBeGreaterThan(80);
    }
    expect(DECLARED_UNAUDITED.length).toBe(3);
  });

  test("every audited row is a route a reader can reach", () => {
    // The other direction, which no existing check asks: an id in the catalogue with no route is an
    // audit row about a page nobody can open, and it would read as covered.
    const routes = new Set(labRoutes());
    const rows = loadLiveInstrumentRows(ROOT).map((row) => row.id);
    const routeless = rows.filter((id) => !routes.has(id));
    expect(routeless, `audited ids with no lab route: ${routeless.join(", ")}`).toEqual([]);
    expect(rows.length).toBeGreaterThanOrEqual(38);
  });

  test("the audited population really is the catalogue, and the core pattern still matches", () => {
    // Non-vacuity for the two classifications this file leans on: if CORE_INSTRUMENT_PATTERN
    // stopped matching, "core" would silently become an empty class and the first test would pass
    // by accident.
    const audited = loadLiveInstrumentRows(ROOT).map((row) => row.id);
    const core = audited.filter((id) => CORE_INSTRUMENT_PATTERN.test(id));
    expect(core.length).toBe(33);
    const nonCore = audited.filter((id) => NON_CORE_INSTRUMENT_IDS.some((e) => e.id === id));
    expect(nonCore.length).toBe(NON_CORE_INSTRUMENT_IDS.length);
    // And the two classes together account for every audited row, so nothing is unclassified.
    expect(core.length + nonCore.length).toBe(audited.length);
  });
});
