/**
 * EVERY committed alias entry carries its provenance, across all four papers.
 *
 * Retiring an id is the one irreversible editorial act in the corpus: a frozen id is never
 * renumbered and a retired one is never reused, so the record of WHO retired it and WHY is the
 * only thing that makes it auditable afterwards. `aliases.ts` already enforces most of this at
 * parse time -- a non-empty `reason`, a non-empty `editor`, an ISO `date` -- and
 * `aliasEntryCitesBead` adds the clause that the editor names the bead that retired the id,
 * because the criterion was satisfiable by `editor: "someone"` until that function existed.
 *
 * WHAT THIS FILE IS FOR. `aliasEntryCitesBead` had exactly two callers: `brownianInventory.ts`
 * and `brownian.manifest.test.ts`. Measured 2026-10-19, that is 7 of the corpus's 37 alias
 * entries; the other 30, in light-quanta, mass-energy and special-relativity, were checked by
 * nothing. The property held for all 37 -- this gate was green the first time it ran, which is
 * the point: it guards a corpus that is already right, and the 30 unguarded entries were one
 * careless commit away from not being.
 *
 * Its own docblock says "None of the 34 real entries was touched, and none needed to be: all 34
 * already cite a bead." There are 37 now. A count written into prose goes stale; this reads the
 * directory.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { reportPopulation } from "../../scripts/gate-census/population.ts";
import { aliasEntryCitesBead, validateAliasRecord } from "./aliases.ts";
import { parseYaml } from "./provenance/yaml.ts";

const DIR = join(process.cwd(), "content", "aliases");

type RawEntry = Readonly<{ retiredId?: unknown; editor?: unknown }>;

function aliasFiles(): { file: string; entries: readonly RawEntry[] }[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((file) => {
      const record = parseYaml(readFileSync(join(DIR, file), "utf8")) as {
        aliases?: readonly RawEntry[];
      };
      return { file, entries: record.aliases ?? [] };
    });
}

describe("alias provenance, over every paper rather than one", () => {
  test("every committed entry passes the schema and names its retiring bead", () => {
    const problems: string[] = [];
    const perPaper: string[] = [];
    let entries = 0;

    for (const { file, entries: list } of aliasFiles()) {
      perPaper.push(`${file.replace(/\.yaml$/, "")} ${list.length}`);
      for (const entry of list) {
        entries += 1;
        const id = typeof entry.retiredId === "string" ? entry.retiredId : "(no retiredId)";
        const parsed = validateAliasRecord(entry);
        if (!parsed.ok) {
          problems.push(`${file} ${id}: ${parsed.error}`);
          continue;
        }
        if (!aliasEntryCitesBead(parsed.value)) {
          problems.push(`${file} ${id}: editor names no bead: ${String(entry.editor)}`);
        }
      }
    }

    expect(problems).toEqual([]);
    // Named denominators beside the verdict: four files, and an entry count no smaller than the
    // 37 measured when this was written. A run that found one file would report zero problems
    // and read exactly like this one.
    expect(perPaper).toHaveLength(4);
    expect(entries).toBeGreaterThanOrEqual(37);
    const vacuous = reportPopulation({
      gate: "alias-provenance",
      examined: entries,
      noun: `committed alias entries checked for schema and bead citation (${perPaper.join(", ")})`,
      minimum: 30,
    });
    expect(vacuous).toBe(false);
  });

  test("CONTROL: an editor naming a person rather than a bead is refused", () => {
    // The exact hole `aliasEntryCitesBead` was written to close: the criterion asked that the
    // retiring bead be named, and `editor: "someone"` satisfied every other rule.
    const base = {
      retiredId: "s1-p9",
      kind: "merged" as const,
      replacementIds: ["s1-p8"],
      reason: "flush resumption, not a printed paragraph break",
      date: "2026-10-19",
    };
    const cites = validateAliasRecord({ ...base, editor: "agent:pane30, am-edn-inventory-x" });
    expect(cites.ok).toBe(true);
    if (cites.ok) expect(aliasEntryCitesBead(cites.value)).toBe(true);

    const named = validateAliasRecord({ ...base, editor: "someone" });
    expect(named.ok).toBe(true);
    if (named.ok) expect(aliasEntryCitesBead(named.value)).toBe(false);
  });

  test("CONTROL: the schema half still refuses a record with no reason or editor", () => {
    // Both halves are asserted because the sweep above would pass on a validateAliasRecord that
    // accepted everything, and on an aliasEntryCitesBead that returned true for anything.
    const base = {
      retiredId: "s1-p9",
      kind: "merged" as const,
      replacementIds: ["s1-p8"],
      date: "2026-10-19",
      editor: "agent:pane30, am-edn-inventory-x",
      reason: "flush resumption",
    };
    expect(validateAliasRecord({ ...base, reason: "" }).ok).toBe(false);
    expect(validateAliasRecord({ ...base, editor: "" }).ok).toBe(false);
    // A Date object rather than an ISO string: the rule exists because YAML turns an unquoted
    // date into one, and the record would then serialise differently on every round trip.
    expect(validateAliasRecord({ ...base, date: new Date("2026-10-19") }).ok).toBe(false);
  });
});
