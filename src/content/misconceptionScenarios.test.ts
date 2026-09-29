import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A MISCONCEPTION'S SCENARIO MUST BE A SETTING OF ITS OWN LABORATORY (dispatch 439).
 *
 * THE SILENCE THIS FILLS. `intervention.scenarioId` names the setting that demonstrates a
 * correction, and scripts/generate-misconception-links.ts turns it into the `?tape=` link the
 * callout draws. Nothing checked it. src/content/audits/misconceptions.ts checks anchors, result
 * ids and instrument ids against known populations and does not look at the scenario at all, so a
 * record naming a preset that does not exist, or one belonging to a different laboratory, produced
 * no error anywhere. PaperMargins then does `settingsHref ?? /lab/${instrument}/`, so the reader
 * lands on the laboratory's DEFAULT page without the setting that demonstrates the correction and
 * the page looks entirely normal. A fallback that degrades to something plausible is the hardest
 * kind of defect to see, and this one was invisible in both directions: no error, no broken link.
 *
 * It cost nothing until 9dcca34d because every record happened to be right, except
 * misc-me-formula-in-paper, which named content/scenarios/mass-energy-printed-factor.yaml: a real
 * scenario record owned by the paper rather than a preset of ME-02. It resolved against the
 * scenario directory and could never produce a link.
 *
 * WHAT IT READS, AND WHY FROM DISK. The records and the manifests as they are on disk, not a
 * loader's output. A loader that silently drops an unresolvable reference is exactly the layer that
 * would hide the case being tested for, which is the failure this repository has recorded three
 * times: a check is only as honest as the layer it reads.
 *
 * THE POPULATION IS PRINTED BESIDE THE VERDICT. A check that examined zero records reads exactly
 * like a clean one, so the count of records naming a scenario is asserted to be non-trivial and
 * logged with the number that resolved.
 *
 * IT RETIRES when scenario ids stop being hand-written in these records.
 */

const ROOT = process.cwd();

/** Every preset id a manifest registers, and every laboratory's declared default scenario. */
function settingsByLab(): Map<string, Set<string>> {
  const dir = join(ROOT, "content", "experiments");
  const out = new Map<string, Set<string>>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const source = readFileSync(join(dir, file), "utf8");
    const ids = new Set<string>();
    for (const m of source.matchAll(/presetId:\s*"?([\w.-]+)"?/g)) ids.add(m[1] ?? "");
    const fallback = source.match(/^defaultScenario:\s*"?([\w.-]+)"?/m);
    if (fallback?.[1]) ids.add(fallback[1]);
    out.set(file.slice(0, -5), ids);
  }
  return out;
}

type Named = Readonly<{ id: string; lab: string; scenario: string; file: string }>;

/** Every record on disk that names a scenario, with the laboratory it claims it for. */
function recordsNamingAScenario(): Named[] {
  const base = join(ROOT, "content", "misconceptions");
  const out: Named[] = [];
  for (const paper of readdirSync(base)) {
    for (const file of readdirSync(join(base, paper)).filter((f) => f.endsWith(".json"))) {
      const path = join(base, paper, file);
      const record = JSON.parse(readFileSync(path, "utf8")) as {
        id: string;
        instrumentIds?: string[];
        intervention: { instrumentId?: string; scenarioId?: string };
      };
      const scenario = record.intervention.scenarioId;
      if (!scenario) continue;
      const lab = record.intervention.instrumentId ?? record.instrumentIds?.[0] ?? "";
      out.push({ id: record.id, lab, scenario, file: `${paper}/${file}` });
    }
  }
  return out;
}

describe("a misconception's scenario is a setting of its own laboratory", () => {
  test("every named scenario is registered by the laboratory the record names", () => {
    const settings = settingsByLab();
    const named = recordsNamingAScenario();
    const wrong: string[] = [];
    for (const record of named) {
      if (!record.lab) {
        wrong.push(`${record.id}: names scenario ${record.scenario} and no laboratory`);
        continue;
      }
      const registered = settings.get(record.lab);
      if (!registered) {
        wrong.push(`${record.id}: names laboratory ${record.lab}, which has no manifest`);
        continue;
      }
      if (!registered.has(record.scenario))
        wrong.push(
          `${record.id}: names ${record.scenario}, which ${record.lab} does not register. ` +
            `The callout would fall back to /lab/${record.lab}/ and show the default view.`,
        );
    }
    // The denominator, beside the verdict: a run that examined nothing reads like a clean one.
    console.log(
      `[misconception scenarios] ${named.length} records name a scenario; ${named.length - wrong.length} resolve to a setting of their own laboratory`,
    );
    expect(named.length).toBeGreaterThan(10);
    expect(wrong).toEqual([]);
  });

  test("the laboratories it reads are real, so a failed read cannot pass as a clean one", () => {
    const settings = settingsByLab();
    expect(settings.size).toBeGreaterThan(30);
    // A laboratory with at least one registered setting must exist, or every lookup above would
    // fail open on an empty set rather than on a missing one.
    expect([...settings.values()].filter((s) => s.size > 0).length).toBeGreaterThan(10);
  });
});
