/**
 * A REAL AUTHORED TAPE, DRIVEN THROUGH VALIDATE, CONVERT AND COMPATIBILITY (am-3zt7).
 *
 * The bead reports that "no authored teaching tape can be replayed, whatever it writes", because
 * `tapes/schema.ts` requires `modelVersion` to be a non-empty STRING while the laboratory bindings
 * and `ExperimentEnvironment` use a NUMBER and `checkTapeCompatibility` compares with `!==`. Its
 * diagnosis of WHY that could stand is exactly right and is the reason this file exists: "each side
 * is tested alone and nothing tests the join."
 *
 * THE PREMISE NO LONGER HOLDS, measured 2026-10-05 over all 22 records. The two types are deliberate
 * and `permalinkTapeFromControlTape` crosses between them once, explicitly, refusing by name a
 * version it cannot carry -- its own docblock records the decision: the authored record may need
 * "1.2.0" or a date, the permalink tape is a wire format inside a URL compared field by field, and
 * widening either to `string | number` would reintroduce am-w3g8. So the join works, and EIGHT
 * records are compatible with their laboratory end to end.
 *
 * WHAT THIS TEST IS THEREFORE FOR. Not asserting that the two types should have been one -- that
 * would overturn a documented boundary. It guards the BOUNDARY, which is the real risk once the types
 * differ on purpose: a broken conversion would silently make every record unreplayable again, and
 * nothing else would notice. It also pins the three refusal classes so they cannot grow unobserved.
 *
 * THE POPULATION, printed by this file on every run rather than frozen here:
 *
 *   22 validate · 12 convert · 8 COMPATIBLE
 *   10 unconvertible on acceptedCheckpoint.digest   a placeholder an author cannot compute (am-2rl9);
 *                                                   the record opens a laboratory at its settings,
 *                                                   it just cannot deep-link to a recorded state
 *    3 tape-constant-set-mismatch                   record "not-applicable" vs binding "modern-si-2019"
 *    1 tape-allocation-mismatch                     camera-bias
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { type ControlTapeV2, validateControlTape } from "../tapes/schema.ts";
import { checkTapeCompatibility } from "./compatibility.ts";
import { permalinkTapeFromControlTape } from "./fromControlTape.ts";
import type { ExperimentEnvironment } from "./types.ts";

const ROOT = process.cwd();
const TAPES = join(ROOT, "content/experiments/tapes");

const records: readonly { file: string; record: ControlTapeV2 }[] = readdirSync(TAPES)
  .filter((file) => file.endsWith(".yaml"))
  .sort()
  .map((file) => ({
    file,
    record: validateControlTape(
      strictParse(readFileSync(join(TAPES, file), "utf8"), "yaml", file),
      file,
    ) as ControlTapeV2,
  }));

/**
 * A laboratory's declared environment, found by its own module rather than a hand-kept table, so a
 * new laboratory joins this check by existing.
 */
async function environmentOf(lab: string): Promise<ExperimentEnvironment | undefined> {
  const dir = lab.replace("-", "");
  for (const file of ["draftTape.ts", "tape.ts"]) {
    try {
      const mod = (await import(`../${dir}/${file}`)) as Record<string, unknown>;
      const found = Object.values(mod).find(
        (value) => value && typeof value === "object" && "environment" in (value as object),
      ) as { environment?: ExperimentEnvironment } | undefined;
      if (found?.environment) return found.environment;
    } catch {
      // A laboratory may expose neither module; the caller reports that rather than failing here.
    }
  }
  return undefined;
}

describe("the join nothing tested: a record, converted, against its own laboratory", () => {
  test("every authored record validates, which is the denominator for everything below", () => {
    // Non-vacuity first: with no records, every verdict below is a pass over nothing.
    expect(records.length).toBeGreaterThanOrEqual(22);
  });

  test("records convert, and those that cannot are refused BY NAME rather than coerced", async () => {
    const unconvertible: string[] = [];
    let converted = 0;
    for (const { file, record } of records) {
      const conversion = permalinkTapeFromControlTape(record);
      if (conversion.kind === "converted") {
        converted += 1;
        continue;
      }
      // The refusal has to say which field and why, or an author cannot act on it.
      expect(conversion.field.length).toBeGreaterThan(0);
      expect(conversion.reason.length).toBeGreaterThan(0);
      expect(conversion.repair.length).toBeGreaterThan(0);
      unconvertible.push(`${file}: ${conversion.field}`);
    }
    console.log(
      `[authored tape join] ${converted} of ${records.length} records convert to a permalink tape; ` +
        `${unconvertible.length} refused: ${unconvertible.slice(0, 3).join("; ")}`,
    );
    // A floor, not a census: more records converting is correct work and must not turn this red.
    expect(converted).toBeGreaterThanOrEqual(12);
  });

  test("the model version crosses the boundary and MATCHES the laboratory, which is am-3zt7", async () => {
    // THE BEAD'S CLAIM, TESTED DIRECTLY. The record writes a string, the environment holds a number,
    // and the conversion is the only place they meet. If it ever stops converting, every record
    // becomes unreplayable again and this is the assertion that says so.
    const checked: string[] = [];
    for (const { file, record } of records) {
      const conversion = permalinkTapeFromControlTape(record);
      if (conversion.kind !== "converted") continue;
      const env = await environmentOf(record.experimentId);
      if (!env) continue;
      expect(typeof record.modelIdentity.modelVersion).toBe("string");
      expect(typeof conversion.tape.modelIdentity.modelVersion).toBe("number");
      expect(typeof env.modelVersion).toBe("number");
      // And having crossed, they are equal: the refusal this bead describes does not fire.
      expect(conversion.tape.modelIdentity.modelVersion).toBe(env.modelVersion);
      checked.push(file);
    }
    console.log(
      `[authored tape join] model version crossed and matched for ${checked.length} record(s)`,
    );
    expect(checked.length).toBeGreaterThanOrEqual(12);
  });

  test("eight records are COMPATIBLE with their laboratory, and the refusals are named", async () => {
    const compatible: string[] = [];
    const refused = new Map<string, string[]>();
    for (const { file, record } of records) {
      const conversion = permalinkTapeFromControlTape(record);
      if (conversion.kind !== "converted") continue;
      const env = await environmentOf(record.experimentId);
      expect(env).toBeDefined();
      if (!env) continue;
      const result = checkTapeCompatibility(conversion.tape, env);
      if (result.compatible) {
        compatible.push(file);
        continue;
      }
      refused.set(result.refusalCode, [...(refused.get(result.refusalCode) ?? []), file]);
      // Every refusal names both sides, or an author is told two things differ and nothing more.
      expect(result.notice.length).toBeGreaterThan(20);
    }
    console.log(
      `[authored tape join] ${compatible.length} compatible; refused: ` +
        [...refused].map(([code, files]) => `${code} ${files.length}`).join(", "),
    );
    // The bead says NO authored tape can be replayed. A floor of eight is the refutation, and a
    // floor rather than an equality so that fixing a mismatch is not a red test.
    expect(compatible.length).toBeGreaterThanOrEqual(8);
    // And the two remaining classes are pinned by NAME, so a new mismatch shows up as a new code
    // rather than as a number nobody reads.
    expect([...refused.keys()].sort()).toEqual([
      "tape-allocation-mismatch",
      "tape-constant-set-mismatch",
    ]);
  });
});

describe("the planted negative: a genuinely different model is still refused", () => {
  test("a changed model version refuses, and the notice names both versions", async () => {
    const first = records.find(
      ({ record }) => permalinkTapeFromControlTape(record).kind === "converted",
    );
    expect(first).toBeDefined();
    if (!first) return;
    const conversion = permalinkTapeFromControlTape(first.record);
    expect(conversion.kind).toBe("converted");
    if (conversion.kind !== "converted") return;
    const env = await environmentOf(first.record.experimentId);
    expect(env).toBeDefined();
    if (!env) return;
    // The control: unchanged, this pair is compatible or refused for a reason that is NOT the model.
    const before = checkTapeCompatibility(conversion.tape, env);
    expect(before.compatible || before.refusalCode !== "tape-model-mismatch").toBe(true);
    // The plant: a version the laboratory does not run.
    const planted = {
      ...conversion.tape,
      modelIdentity: { ...conversion.tape.modelIdentity, modelVersion: 99 },
    };
    const result = checkTapeCompatibility(planted, env);
    expect(result.compatible).toBe(false);
    if (result.compatible) return;
    expect(result.refusalCode).toBe("tape-model-mismatch");
    // Both values in the sentence, so the difference is actionable rather than asserted.
    expect(result.notice).toContain("99");
    expect(result.notice).toContain(String(env.modelVersion));
    expect(result.offerNewRun).toBe(true);
  });

  test("a changed model id refuses too, so the check is not version-only", async () => {
    const first = records.find(
      ({ record }) => permalinkTapeFromControlTape(record).kind === "converted",
    );
    if (!first) return;
    const conversion = permalinkTapeFromControlTape(first.record);
    if (conversion.kind !== "converted") return;
    const env = await environmentOf(first.record.experimentId);
    if (!env) return;
    const planted = {
      ...conversion.tape,
      modelIdentity: { ...conversion.tape.modelIdentity, modelId: "not-this-laboratorys-model" },
    };
    const result = checkTapeCompatibility(planted, env);
    expect(result.compatible).toBe(false);
    if (result.compatible) return;
    expect(result.refusalCode).toBe("tape-model-mismatch");
    expect(result.notice).toContain("not-this-laboratorys-model");
  });
});
