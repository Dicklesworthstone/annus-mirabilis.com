/**
 * THE DECLARED REASON AN INSTRUMENT HAS NO CASE OF SOME KIND (am-nxbq, 2026-10-05).
 *
 * am-nxbq's second acceptance criterion gives two ways to satisfy it: a resolvable refusal case and a
 * resolvable non-numeric case per instrument, "or a written declaration in its manifest saying why its
 * model admits neither". `scripts/check-acceptance-cases.ts` has read `acceptanceCoverage` since it was
 * written. Nothing else could: the field was in no schema, so `validateExperiment` passed it over and
 * every validated Experiment came back without it. A manifest could carry the declaration, that one
 * gate would honour it, and no other consumer could see that the instrument had been excused.
 *
 * So the first test here is the one that would have caught that, and it is deliberately about SURVIVAL
 * rather than acceptance: an unknown key was already accepted before this landed, silently, which is
 * exactly how the hole stayed invisible. Asserting `validateExperiment` does not throw would have
 * passed on the broken tree.
 *
 * The rest are the refusals. An escape hatch with no floor on its reason becomes the default answer to
 * a missing case, so a reason shorter than 80 characters is refused, at the threshold this repository
 * already uses for an authored term definition.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateExperiment } from "./experiment.ts";
import { strictParse } from "./strictParse.ts";

const ROOT = process.cwd();

/** A real manifest, as the base, so these tests exercise the validator's whole path and not a stub. */
function manifestOf(lab: string): Record<string, unknown> {
  const text = readFileSync(join(ROOT, "content", "experiments", `${lab}.yaml`), "utf8");
  return strictParse(text, "yaml", `${lab}.yaml`) as Record<string, unknown>;
}

const A_REASON =
  "Every output of this instrument is finite at every admitted setting, so no scenario could expect " +
  "a non-numeric result from it; building such a path, not declaring it, is what retires this entry.";

describe("acceptanceCoverage, the declared reason a kind of case does not exist", () => {
  test("the live declaration SURVIVES validation, which is the defect this field had", () => {
    // LQ-05 is the one instrument that carries the declaration, on a measurement recorded in commit
    // 698552a0: its nine outputs are probabilities and logarithms, finite at every admitted setting.
    const lq05 = validateExperiment(manifestOf("lq-05"));
    expect(lq05.acceptanceCoverage?.noNonNumericCase).toBeDefined();
    expect(lq05.acceptanceCoverage?.noNonNumericCase?.length).toBeGreaterThan(80);
    // It excuses only the kind it names. LQ-05 HAS a refusal case, and must not be excused one.
    expect(lq05.acceptanceCoverage?.noRefusalCase).toBeUndefined();
  });

  test("an instrument with no declaration validates and reports none", () => {
    // The control. Without it, an `acceptanceCoverage` that was always populated with something would
    // satisfy the test above.
    const bm05 = validateExperiment(manifestOf("bm-05"));
    expect(bm05.acceptanceCoverage).toBeUndefined();
  });

  test("acceptance-coverage-reason-too-short: a reason too short to be a reason is refused", () => {
    const raw = { ...manifestOf("bm-05"), acceptanceCoverage: { noNonNumericCase: "n/a" } };
    expect(() => validateExperiment(raw)).toThrow(/acceptance-coverage-reason-too-short/);
    // And the message says how short it was, so the author is not left guessing the threshold.
    expect(() => validateExperiment(raw)).toThrow(/3 characters/);
  });

  test("acceptance-coverage-reason-too-short: a reason that is not a string is refused by the same code", () => {
    const raw = { ...manifestOf("bm-05"), acceptanceCoverage: { noRefusalCase: 42 } };
    expect(() => validateExperiment(raw)).toThrow(/acceptance-coverage-reason-too-short/);
  });

  test("unknown-acceptance-coverage-key: a key that is not one of the two is refused rather than ignored", () => {
    // The near miss: `noNonNumeric` instead of `noNonNumericCase` would otherwise excuse nothing
    // while reading, in the manifest, exactly like a declaration that works.
    const raw = { ...manifestOf("bm-05"), acceptanceCoverage: { noNonNumeric: A_REASON } };
    expect(() => validateExperiment(raw)).toThrow(/unknown-acceptance-coverage-key/);
  });

  test("empty-acceptance-coverage: a declaration that declares nothing is refused", () => {
    const raw = { ...manifestOf("bm-05"), acceptanceCoverage: {} };
    expect(() => validateExperiment(raw)).toThrow(/empty-acceptance-coverage/);
  });

  test("invalid-acceptance-coverage: a declaration that is not an object at all is refused", () => {
    const raw = { ...manifestOf("bm-05"), acceptanceCoverage: [A_REASON] };
    expect(() => validateExperiment(raw)).toThrow(/invalid-acceptance-coverage/);
  });

  test("a long enough reason is accepted, and is trimmed rather than stored as written", () => {
    const raw = {
      ...manifestOf("bm-05"),
      acceptanceCoverage: { noNonNumericCase: `  ${A_REASON}  ` },
    };
    const validated = validateExperiment(raw);
    expect(validated.acceptanceCoverage?.noNonNumericCase).toBe(A_REASON);
    // Positive control on the threshold itself: A_REASON is over it, so the refusals above are
    // refusing shortness and not refusing every string.
    expect(A_REASON.length).toBeGreaterThanOrEqual(80);
  });
});
