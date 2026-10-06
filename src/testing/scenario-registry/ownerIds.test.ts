/**
 * Every scenario owner has its own id, and the guard that says so can fail (am-nxbq).
 *
 * WHY THIS EXISTS. `new Map(entries)` keeps the LAST entry for a repeated key, so adding a second owner
 * under an id that already exists is not a collision: it is a silent substitution. One of the two owners
 * becomes unreachable and every scenario naming that id is evaluated by the other, with no warning from
 * anywhere. Found by making the mistake while writing am-nxbq's acceptance cases - a second
 * "sr02.session" meant a scenario refused on `inducedCircuitCurrent`, an output the intended owner never
 * reads, and the only clue was that the number was wrong.
 *
 * THE GUARD'S PROOF DOES NOT LIVE IN THE POPULATION IT GUARDS. `duplicateOwnerIds` is a pure function so
 * both directions can be exercised on lists built here, which matters because the registry is - and should
 * stay - free of duplicates: a test that could only pass once the registry was broken would be no test at
 * all. AGENTS.md's rule about a gate's own test is the reason this file is shaped this way.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { duplicateOwnerIds, OWNER_REGISTRY } from "./owners.ts";

describe("scenario owner ids are unique, and the detection works in both directions", () => {
  test("a repeated id is reported, once, in first-seen order", () => {
    expect(duplicateOwnerIds(["a", "b", "a"])).toEqual(["a"]);
    expect(duplicateOwnerIds(["a", "a", "a"])).toEqual(["a"]);
    expect(duplicateOwnerIds(["x", "y", "x", "y"])).toEqual(["x", "y"]);
  });

  test("NON-VACUITY: a list with no repeat comes back empty", () => {
    // Without this, a function returning every id would satisfy the assertions above.
    expect(duplicateOwnerIds(["a", "b", "c"])).toEqual([]);
    expect(duplicateOwnerIds([])).toEqual([]);
  });

  test("the live registry has no repeated id, and the count examined is printed", () => {
    // The registry is a Map, so its size is the number of DISTINCT ids; a repeat would have been
    // swallowed before this test could see it. That is exactly why the guard runs at module load and
    // why this assertion is a floor on the population rather than the whole check: importing the module
    // at all is what proves the registry is clean, and this says how much was examined.
    const ids = [...OWNER_REGISTRY.keys()];
    console.log(`[owner ids] ${ids.length} distinct scenario owner ids registered`);
    expect(ids.length).toBeGreaterThan(100);
    expect(duplicateOwnerIds(ids)).toEqual([]);
  });

  test("refusal (owners.ts): owner-id-duplicated is thrown, with its code readable at the site", () => {
    // NOT expect(code).toBe(code), which was the first version of this test and asserted nothing. The
    // guard runs once when the module loads and the module must load for this file to run, so it cannot
    // be driven from here; what CAN be checked is that the site exists, raises this code as a literal the
    // refusal scanner can read, and is reached from the id list rather than from somewhere unrelated.
    // The code as a BARE literal, which is what credits this site with the refusal scanner: a literal
    // whose value is `"owner-id-duplicated"` WITH the quote characters inside it is a different string,
    // and the first version of this test used that form and credited nothing.
    const DUPLICATE_CODE = "owner-id-duplicated";
    const source = readFileSync(new URL("./owners.ts", import.meta.url), "utf8");
    expect(source).toContain(`"${DUPLICATE_CODE}"`);
    expect(source).toContain(
      "const repeatedOwnerIds = duplicateOwnerIds(OWNERS.map((owner) => owner.id));",
    );
    expect(source).toContain("if (repeatedOwnerIds.length > 0)");

    // The guard must sit BEFORE the Map is built, or the duplicate it exists to catch has already been
    // swallowed by the time it looks. Positions in the file, not prose about them.
    expect(source.indexOf("const repeatedOwnerIds")).toBeLessThan(
      source.indexOf("export const OWNER_REGISTRY"),
    );

    // PLANTED AND OBSERVED, 2026-10-06, rather than assumed: adding a second entry with an existing id
    // made this module throw at import with "1 scenario owner id(s) are registered twice: lq05.session",
    // and every test in this file and in scenario-registry errored on the import rather than failing a
    // comparison. That is the intended shape - a broken registry is not a wrong answer, it is no answer.
  });
});
