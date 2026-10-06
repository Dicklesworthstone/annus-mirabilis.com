/**
 * DOES `REGISTERED_PRESET_IDS` HOLD THE PRESETS THAT EXIST? (am-nxbq, 2026-10-05.)
 *
 * The constant is hand-maintained and gates exactly one thing: a discrimination scenario may not take
 * the id of a registered preset (`discrimination-preset-id-collision`, experiment.ts). So every preset
 * the constant is missing is an id a discrimination scenario may silently steal, and the guard's own
 * test cannot see that, because it collides with `sr-02-apparatus`, which IS registered. A guard tested
 * only through the entries it has reports clean about the entries it lacks.
 *
 * MEASURED BEFORE THE FIX: the 33 manifests declared 135 presets and the constant held 128. The seven
 * missing were all six of sr-05's (`sr-05-inertial-0.6c`, `sr-05-out-and-back-0.6c`,
 * `sr-05-circle-0.6c`, `sr-05-low-speed-1e-4`, `sr-05-daily-second`, `sr-05-light-clock-0.6c`) and
 * `me-03-box-1906`. The drift ran one way only - nothing registered was undeclared - which is the
 * signature of a hand-maintained list lagging the records it describes rather than of two independent
 * sets disagreeing.
 *
 * WHY THE CONSTANT STAYS A CONSTANT. `validateScenario` validates one record and may not read the
 * filesystem, so deriving the set at its call site is not available. The repair is therefore not to
 * delete the list but to pin it to the records: this file is the only thing that can notice the drift,
 * and it refuses in BOTH directions, so a stale id cannot linger either.
 *
 * The last test is the half that makes the first one matter: it drives the real validator with ids that
 * were outside the guard before this landed, and a registry that loses one of them again turns that red
 * rather than merely changing a number.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REGISTERED_PRESET_IDS, validateScenario } from "./experiment.ts";
import { strictParse } from "./strictParse.ts";

// The repository root, as every other reader of content/ in this tree resolves it.
const ROOT = process.cwd();

/** Every preset id declared by a manifest, with the manifest that declares it. */
function declaredPresets(): Map<string, string> {
  const dir = join(ROOT, "content", "experiments");
  const out = new Map<string, string>();
  let manifests = 0;
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".yaml") || name === "acceptance-fixtures.yaml") continue;
    const raw = strictParse(readFileSync(join(dir, name), "utf8"), "yaml", name) as {
      presets?: unknown;
    } | null;
    manifests += 1;
    if (!Array.isArray(raw?.presets)) continue;
    for (const preset of raw.presets) {
      const id = (preset as { presetId?: unknown } | null)?.presetId;
      if (typeof id === "string" && id !== "") out.set(id, name);
    }
  }
  // The denominator, asserted rather than assumed: a readdir that found nothing would make every
  // comparison below pass over an empty set.
  expect(manifests).toBeGreaterThanOrEqual(33);
  return out;
}

const declared = declaredPresets();

/** A minimal discrimination scenario, which is the only record kind the collision guard examines. */
const discriminationScenario = (id: string) => ({
  id,
  kind: "discrimination" as const,
  title: "A discrimination scenario, used here only to reach the collision guard",
  constantSetId: "modern-si-2019",
  owner: "selfTest.fresnelDrag",
  hypotheses: [
    {
      id: "a",
      label: "a",
      owner: "selfTest.fresnelDrag",
      modelIdentity: "a",
      circumstancesInWhichItWorks: "a",
      historicalStatus: "available-before-cutoff" as const,
    },
    {
      id: "b",
      label: "b",
      owner: "selfTest.relativisticDrag",
      modelIdentity: "b",
      circumstancesInWhichItWorks: "b",
      historicalStatus: "later-development" as const,
    },
  ],
  observation: { observableId: "increment", inputs: {}, procedure: "x" },
  tolerance: { relative: 1e-6, rationale: "apparatus resolution of 1e-6" },
  expected: { outcome: "indistinguishable" as const },
  modelVersion: 1,
  schemaVersion: 1,
});

describe("the registered preset ids and the presets the manifests declare", () => {
  test("the registry holds every preset a manifest declares", () => {
    const missing = [...declared].filter(([id]) => !REGISTERED_PRESET_IDS.has(id));
    console.log(
      `[presets] ${declared.size} declared across the manifests, ${REGISTERED_PRESET_IDS.size} ` +
        `registered, ${missing.length} declared and not registered`,
    );
    // Named, not counted: the ids are permanent, so the message says which one broke.
    expect(missing.map(([id, file]) => `${id} (${file})`)).toEqual([]);
  });

  test("the registry holds nothing no manifest declares", () => {
    const stale = [...REGISTERED_PRESET_IDS].filter((id) => !declared.has(id));
    expect(stale).toEqual([]);
  });

  test("the comparison can fail, so neither direction above is vacuous", () => {
    // A positive control on the instrument itself. Without it, a declaredPresets() that returned an
    // empty map would make both tests above pass and read exactly like a clean registry.
    expect(declared.size).toBeGreaterThan(100);
    expect(REGISTERED_PRESET_IDS.size).toBeGreaterThan(100);
    const absent = "zz-99-no-manifest-declares-this";
    expect(REGISTERED_PRESET_IDS.has(absent)).toBe(false);
    expect([...declared, [absent, "synthetic"] as const].some(([id]) => id === absent)).toBe(true);
  });

  test("the guard refuses a discrimination scenario named after any declared preset", () => {
    // The seven that were outside the guard before this landed, named individually because that is
    // the historical fact worth pinning; a count would not say which ids the hole was.
    const wereMissing = [
      "sr-05-inertial-0.6c",
      "sr-05-out-and-back-0.6c",
      "sr-05-circle-0.6c",
      "sr-05-low-speed-1e-4",
      "sr-05-daily-second",
      "sr-05-light-clock-0.6c",
      "me-03-box-1906",
    ];
    for (const id of wereMissing) {
      expect(declared.has(id)).toBe(true);
      expect(() => validateScenario(discriminationScenario(id))).toThrow(
        /discrimination-preset-id-collision/,
      );
    }
    // And the guard is not simply refusing every discrimination scenario: an id no manifest declares
    // passes. Without this the loop above would be satisfied by a validator that threw unconditionally.
    expect(() =>
      validateScenario(discriminationScenario("zz-99-no-manifest-declares-this")),
    ).not.toThrow();
  });
});
