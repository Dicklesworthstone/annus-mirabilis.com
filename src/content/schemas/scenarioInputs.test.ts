/**
 * A SCENARIO INPUT CANNOT SILENTLY BECOME NaN (am-wop1).
 *
 * The field was typed `number | string` and cast without checking, while its only consumer,
 * `inputNumbers` in src/testing/scenario-registry/run.ts, did `Number(spec.value)`. A string
 * input reached the owner as NaN, the laboratory refused it as `invalid-parameter`, and the
 * scenario failed for a reason unrelated to what it was written to test. A reader of that failure
 * learned the wrong thing.
 *
 * THE PRE-CHANGE PATH IS PLANTED HERE RATHER THAN DESCRIBED, which is what the bead asks for: the
 * first test runs the old coercion on the same value and shows it yields NaN without complaint.
 * That is the behaviour this file exists to prevent, so it is executed rather than asserted about.
 *
 * The decision and its reason live in `validatedScenarioInputs`' own docblock, not only in a
 * commit message. In short: refusing costs nothing today, 0 of 712 inputs hold a string, and it
 * converts a silent NaN into a named refusal that tells the next author the runner must be widened
 * before a categorical can travel as a word.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { validateScenario } from "./experiment.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A scenario that is valid apart from the input under test. */
const base = (value: unknown) => ({
  id: "fx-string-input",
  kind: "modern-golden",
  title: "A fixture whose only question is its input type",
  description: "Planted for am-wop1.",
  constantSetId: "modern-si-2019",
  owner: "diffusion.stokesEinsteinD",
  inputs: { worldline: { value, unit: "" } },
  expected: { outputs: [] },
  modelVersion: 1,
  schemaVersion: 1,
});

describe("the behaviour this replaces, executed rather than described", () => {
  test("the old coercion turned a word into NaN and said nothing", () => {
    // Verbatim the pre-change line from run.ts:119.
    const spec: { value: number | string } = { value: "inertial" };
    const coerced = typeof spec.value === "number" ? spec.value : Number(spec.value);
    expect(Number.isNaN(coerced)).toBe(true);
    // No throw, no warning: the owner received NaN and refused it for the wrong reason.
    expect(() => Number("inertial")).not.toThrow();
  });
});

describe("a non-numeric scenario input is refused by name", () => {
  test("a string is refused, naming the scenario and the key", () => {
    let message = "";
    try {
      validateScenario(base("inertial"));
    } catch (error) {
      message = String((error as Error).message);
    }
    expect(message).toContain("fx-string-input");
    expect(message).toContain("worldline");
    expect(message).toContain("inertial");
    // And it points at the decision rather than just refusing.
    expect(message).toContain("am-wop1");
  });

  test("a NUMERIC string is refused too, which is the point", () => {
    // `value: "5"` would coerce cleanly and work, and admitting it is how the ambiguity returns.
    // One rule: a scenario input is a number in the record, not a number in a string.
    expect(() => validateScenario(base("5"))).toThrow(/must be a finite number/);
  });

  test("NaN and Infinity are refused, not merely non-numbers", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateScenario(base(value))).toThrow(/must be a finite number/);
    }
  });

  test("a plain number passes, so the refusal is not simply always-on", () => {
    const scenario = validateScenario(base(0.6));
    expect(scenario.inputs.worldline?.value).toBe(0.6);
  });
});

describe("every scenario on disk still loads", () => {
  test("the whole corpus validates, with its census printed", () => {
    const dir = join(ROOT, "content/scenarios");
    const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    let inputs = 0;
    const refused: string[] = [];
    for (const file of files) {
      const raw = loadYaml(readFileSync(join(dir, file), "utf8")) as { inputs?: object };
      inputs += Object.keys(raw.inputs ?? {}).length;
      try {
        validateScenario(raw);
      } catch (error) {
        refused.push(`${file}: ${String((error as Error).message).slice(0, 90)}`);
      }
    }
    console.log(
      `[census] scenario-inputs examined ${files.length} scenario files carrying ${inputs} ` +
        `input(s) (minimum 100 files); ${refused.length} refused`,
    );
    // A loader that refused everything, or found nothing, must not read as clean.
    expect(files.length).toBeGreaterThanOrEqual(100);
    expect(inputs).toBeGreaterThanOrEqual(500);
    expect(refused).toEqual([]);
  });
});
