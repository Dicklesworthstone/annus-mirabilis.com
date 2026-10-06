/**
 * DOES A MANIFEST'S DECLARED DEFAULT MATCH THE ONE THE LAB OPENS AT? (am-bzsk, 2026-10-05.)
 *
 * AGENTS.md says one schema generates the controls, URL-state validation, unit formatting and test
 * cases. It does not: `content/experiments/<lab>.yaml` carries a `default:` per parameter and
 * `src/experiments/<lab>/definition.ts` carries a `*_DEFAULTS` object, they are two records of the
 * same thing, and until this file nothing compared them. The runtime object wins everywhere it
 * matters - parameters.ts keys the controls off it and the generators build each static worked
 * example from it - so a manifest default that disagrees is dead data that contradicts the live value.
 *
 * WHAT IT FOUND, and it is why this exists rather than being tidy-up. BM-01 opens at modern water.
 * Its manifest declares Einstein's printed T 290.15 K and eta 0.00135 Pa s, its defaultScenario and
 * traceScenarioId are both `diffusion-einstein-1905-printed`, and its trace row shows the printed
 * diffusivity 0.3158402 um^2/s. BM01_DEFAULTS is T 293.15 and eta 0.001, water at 20 C, so
 * src/generated/bm01-example.json computes 0.4294 um^2/s. Thirty-six per cent apart, on the
 * reference-slice instrument, with the lab naming a scenario whose own number it does not show.
 *
 * TWO LISTS, BOTH BY IDENTITY, BOTH SHRINKING ONLY. A value disagreement and a type mismatch are
 * different defects and are recorded apart: the first means a reader sees a number from one record
 * and controls from another, the second means the manifest models a boolean or a string enum as a
 * numeric slider, which AGENTS.md forbids by name - "sliders suit continuous parameters and nothing
 * else". Neither list is a count, so a new entry is NAMED rather than folded into a total.
 *
 * WHY THE DEBT IS RECORDED RATHER THAN PAID HERE. Both directions for BM-01 are real changes: moving
 * BM01_DEFAULTS to the printed values changes the lab's arrival state and regenerates a committed
 * artifact on the reference slice, and moving the manifest to modern water contradicts its own
 * scenario id. That is the owner's call, and it is on am-bzsk.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = process.cwd();

/** Numbers agreeing to this are the same declaration written two ways. */
const SAME = 1e-9;

/**
 * A manifest default and a runtime default that are not the same number or the same string. Recorded
 * by identity. lq-04's is a rounded declaration, 6.5e-6 apart, and is a drift rather than a defect;
 * BM-01's three are the real one and are the subject of am-bzsk.
 */
const VALUE_DISAGREEMENTS: readonly string[] = [
  "bm-01.H",
  "bm-01.T",
  "bm-01.eta",
  "lq-04.diluteThresholdX",
];

/**
 * A manifest modelling a boolean or a string enum as a number. Each is semantically aligned at index
 * 0 - sr-13's forceConvention 0 is "source", Einstein's 1905 convention - so no reader sees a wrong
 * value today; what is wrong is the control the manifest asks for. Recorded separately so that
 * fixing one kind cannot hide the other.
 */
const TYPE_MISMATCHES: readonly string[] = [
  "bm-06.gridEnabled",
  "bm-07.radiusKnown",
  "me-03.assignLightMass",
  "sr-11.frame",
  "sr-11.unitLayer",
  "sr-13.datasetOverlay",
  "sr-13.forceConvention",
  "sr-13.massLanguage",
  "sr-13.particle",
];

type Census = {
  manifests: number;
  withoutDefaultsExport: number;
  compared: number;
  valueDisagreements: string[];
  typeMismatches: string[];
  manifestOnly: string[];
};

async function compareDefaults(): Promise<Census> {
  const dir = join(ROOT, "content", "experiments");
  const census: Census = {
    manifests: 0,
    withoutDefaultsExport: 0,
    compared: 0,
    valueDisagreements: [],
    typeMismatches: [],
    manifestOnly: [],
  };
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".yaml") || name === "acceptance-fixtures.yaml") continue;
    const lab = name.slice(0, -".yaml".length);
    census.manifests += 1;
    const modulePath = join(ROOT, "src", "experiments", lab.replace("-", ""), "definition.ts");
    if (!existsSync(modulePath)) {
      census.withoutDefaultsExport += 1;
      continue;
    }
    // The export is READ from the file rather than assumed from the lab id, so a module naming it
    // differently is counted as unexported instead of silently skipped.
    const exportName = /export const (\w*_DEFAULTS)\b/.exec(readFileSync(modulePath, "utf8"))?.[1];
    if (exportName === undefined) {
      census.withoutDefaultsExport += 1;
      continue;
    }
    const imported = (await import(modulePath)) as Record<string, unknown>;
    const runtime = imported[exportName];
    if (!runtime || typeof runtime !== "object") {
      census.withoutDefaultsExport += 1;
      continue;
    }
    const runtimeDefaults = runtime as Record<string, unknown>;
    const doc = strictParse(readFileSync(join(dir, name), "utf8"), "yaml", name) as {
      parameters?: { id?: string; default?: unknown }[];
    } | null;
    for (const p of doc?.parameters ?? []) {
      if (typeof p.id !== "string") continue;
      const key = `${lab}.${p.id}`;
      if (!(p.id in runtimeDefaults) || p.default === undefined) {
        census.manifestOnly.push(key);
        continue;
      }
      const runtimeValue = runtimeDefaults[p.id];
      const manifestValue = p.default;
      census.compared += 1;
      // A YAML scalar may arrive as a string where the runtime holds a number ("5e-7"), which is one
      // declaration written two ways and not a disagreement.
      const numeric =
        typeof runtimeValue === "number" &&
        (typeof manifestValue === "number" ||
          (typeof manifestValue === "string" && Number.isFinite(Number(manifestValue))));
      if (numeric) {
        const declared = Number(manifestValue);
        const live = runtimeValue as number;
        const off =
          live === 0
            ? Math.abs(declared) > SAME
            : Math.abs(declared - live) / Math.abs(live) > SAME;
        if (off) census.valueDisagreements.push(key);
      } else if (typeof runtimeValue === typeof manifestValue) {
        if (String(runtimeValue) !== String(manifestValue)) census.valueDisagreements.push(key);
      } else {
        census.typeMismatches.push(key);
      }
    }
  }
  census.valueDisagreements.sort();
  census.typeMismatches.sort();
  return census;
}

const census = await compareDefaults();

describe("a manifest's declared default against the default the lab opens at (am-bzsk)", () => {
  test("the population is every manifest's every parameter, and it is not empty", () => {
    console.log(
      `[manifest defaults] ${census.compared} parameters compared across ${census.manifests} ` +
        `manifests (${census.withoutDefaultsExport} with no *_DEFAULTS export, which are bm-02 and ` +
        `lq-02); ${census.valueDisagreements.length} value disagreements, ` +
        `${census.typeMismatches.length} type mismatches, ${census.manifestOnly.length} manifest only`,
    );
    // The denominator, asserted rather than printed only: a readdir that found nothing, or an import
    // that failed for every instrument, would make both lists empty and read as a clean sweep.
    expect(census.manifests).toBe(33);
    expect(census.compared).toBeGreaterThan(200);
    expect(census.withoutDefaultsExport).toBeLessThanOrEqual(2);
  });

  test("every manifest parameter exists in its runtime defaults", () => {
    // Nothing is manifest-only today. If a parameter is declared and the runtime has no default for
    // it, the control has no starting value and the manifest is describing something that is not there.
    expect(census.manifestOnly).toEqual([]);
  });

  test("exactly the recorded value disagreements exist, named", () => {
    expect(census.valueDisagreements).toEqual([...VALUE_DISAGREEMENTS].sort());
    // Non-vacuity, deliberately: the debt is real and this is what tells the next author the day it
    // reaches zero that both lists and this assertion come out together.
    expect(VALUE_DISAGREEMENTS.length).toBeGreaterThan(0);
  });

  test("exactly the recorded type mismatches exist, named", () => {
    expect(census.typeMismatches).toEqual([...TYPE_MISMATCHES].sort());
  });

  test("BM-01's three are the material one, and the comparison can tell 36 percent from rounding", async () => {
    // The specimen, asserted so that a future reader of this file does not have to take the docblock
    // on trust, and so that a comparison which stopped distinguishing them would fail here.
    for (const key of ["bm-01.T", "bm-01.eta", "bm-01.H"])
      expect(census.valueDisagreements).toContain(key);
    const bm01 = (await import(join(ROOT, "src/experiments/bm01/definition.ts"))) as {
      BM01_DEFAULTS: Record<string, unknown>;
    };
    expect(bm01.BM01_DEFAULTS.T).toBe(293.15);
    expect(bm01.BM01_DEFAULTS.eta).toBe(0.001);
    const manifest = strictParse(
      readFileSync(join(ROOT, "content/experiments/bm-01.yaml"), "utf8"),
      "yaml",
      "bm-01.yaml",
    ) as { parameters?: { id?: string; default?: unknown }[] };
    const declared = new Map((manifest.parameters ?? []).map((p) => [p.id, p.default] as const));
    expect(declared.get("T")).toBe(290.15);
    expect(declared.get("eta")).toBe(0.00135);
    // And lq-04's is in the list for a different reason: 4.6052 against 4.605170185988092 is a
    // rounded declaration, 6.5e-6 apart. It is recorded because the rule is exactness, not because
    // a reader could see it, and the two must not be conflated when either is repaired.
    expect(census.valueDisagreements).toContain("lq-04.diluteThresholdX");
  });
});
