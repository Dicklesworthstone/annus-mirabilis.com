/**
 * THE JOIN BETWEEN THE TWO TAPE SCHEMAS (am-3zt7).
 *
 * Each side of this seam was tested alone, and nothing tested the join, which is how a belief that
 * the two contradicted each other could stand for a day. These tests drive real authored records
 * through validate-then-convert-then-compatibility, which is the path a replay would take.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { type ControlTapeV2, validateControlTape } from "../tapes/schema.ts";
import { encodeTapePermalink } from "./codec.ts";
import { MAX_PERMALINK_URL_LENGTH } from "./codecCore.ts";
import { checkTapeCompatibility } from "./compatibility.ts";
import { permalinkTapeFromControlTape } from "./fromControlTape.ts";
import type { ExperimentEnvironment, TapeV2 } from "./types.ts";

const DIR = join(process.cwd(), "content/experiments/tapes");
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith(".yaml"))
  .sort();
const RECORDS: readonly ControlTapeV2[] = FILES.map((f) =>
  validateControlTape(strictParse(readFileSync(join(DIR, f), "utf8"), "yaml")),
);

/** The environment a tape was recorded against, built from the record's own declared identity.
 *  This is what "its own laboratory" means for a replay: the instrument as the author pinned it. */
function environmentAsRecorded(tape: TapeV2): ExperimentEnvironment {
  return {
    experimentId: tape.experimentId,
    mode: tape.mode,
    modelId: tape.modelIdentity.modelId,
    modelVersion: tape.modelIdentity.modelVersion,
    constantSetId: tape.constantSetId,
    streamVersion: tape.streamVersion,
    allocationId: tape.allocationId,
  };
}

/** The records that reach a permalink tape at all; the rest are refused by name and are the
 *  subject of the first test rather than of the compatibility ones. */
const CONVERTIBLE: readonly ControlTapeV2[] = RECORDS.filter(
  (r) => permalinkTapeFromControlTape(r).kind === "converted",
);

function convert(record: ControlTapeV2): TapeV2 {
  const out = permalinkTapeFromControlTape(record);
  if (out.kind !== "converted") throw new Error(`${record.tapeId}: ${out.field} ${out.reason}`);
  return out.tape;
}

describe("an authored control tape becomes a permalink tape", () => {
  test("the corpus this suite reads is the authored one, and it is not empty", () => {
    // Non-vacuity before anything else: an empty directory would make every loop below pass.
    expect(FILES.length).toBeGreaterThan(15);
    expect(RECORDS.length).toBe(FILES.length);
    expect(RECORDS.map((r) => r.tapeId)).toContain("the-boost-to-0.6c");
  });

  test("every record either converts or is refused by name, and a converted one always encodes", () => {
    // Not a census: the split moves as records are corrected. The property is that there is no
    // third outcome, that a refusal is actionable, and that nothing downstream can throw on a
    // converted tape. Before the converter checked its own output, 10 records produced a tape that
    // `encodeTapePermalink` threw on, which is a failure moved downstream rather than refused.
    let converted = 0;
    let refused = 0;
    for (const record of RECORDS) {
      const out = permalinkTapeFromControlTape(record);
      if (out.kind !== "converted") {
        refused += 1;
        expect(out.field.length, `${record.tapeId} refused with no field`).toBeGreaterThan(0);
        expect(out.repair.length, `${record.tapeId} refused with no repair`).toBeGreaterThan(20);
        expect(out.reason, `${record.tapeId}`).toContain(" ");
        continue;
      }
      converted += 1;
      // The wire accepts it: this is the join that was missing one layer over.
      expect(() => encodeTapePermalink(out.tape)).not.toThrow();
      expect(
        `/lab/${record.experimentId}/?tape=${encodeTapePermalink(out.tape)}`.length,
      ).toBeLessThanOrEqual(MAX_PERMALINK_URL_LENGTH);
      // The record writes a string; the link carries a number; they name the same version.
      expect(typeof record.modelIdentity.modelVersion).toBe("string");
      expect(typeof out.tape.modelIdentity.modelVersion).toBe("number");
      expect(String(out.tape.modelIdentity.modelVersion)).toBe(record.modelIdentity.modelVersion);
    }
    expect(converted + refused).toBe(RECORDS.length);
    // Non-vacuity in both directions, so neither a converter that refused everything nor one that
    // converted everything could pass this file unnoticed.
    expect(converted).toBeGreaterThan(0);
    console.log(
      `[control tape -> permalink] ${converted} convert, ${refused} refused, of ${RECORDS.length}`,
    );
  });

  test("the conversion carries what the AUTHOR recorded, not a laboratory's own identity", () => {
    // This is the property that distinguishes a converter from the generator's rebuild-from-binding
    // path. If this ever starts reading a binding, every compatibility result below becomes
    // tautological and the refusals that are real findings would vanish silently.
    for (const record of CONVERTIBLE) {
      const tape = convert(record);
      expect(tape.modelIdentity.modelId).toBe(record.modelIdentity.modelId);
      expect(tape.allocationId).toBe(record.allocationId);
      expect(tape.streamVersion).toBe(record.streamVersion);
      expect(tape.constantSetId).toBe(record.constantSetId);
      expect(tape.seed).toBe(record.seed);
      expect(tape.teachingTapeRef?.tapeId).toBe(record.tapeId);
    }
  });

  test("a version with no unambiguous numeric spelling is refused by name, and an integer is not", () => {
    const base = RECORDS.find((r) => r.tapeId === "the-boost-to-0.6c");
    if (!base) throw new Error("the-boost-to-0.6c is not in the corpus");
    for (const bad of ["1.2.0", "v1", "1.0", "01", "", " 1"]) {
      const out = permalinkTapeFromControlTape({
        ...base,
        modelIdentity: { ...base.modelIdentity, modelVersion: bad },
      });
      expect(out.kind, `${JSON.stringify(bad)} should not convert`).toBe("unconvertible");
      if (out.kind === "unconvertible") {
        expect(out.field).toBe("modelIdentity.modelVersion");
        expect(out.repair.length).toBeGreaterThan(20);
      }
    }
    // Both directions, so a rule that refused everything could not pass this test.
    for (const good of ["0", "1", "2", "17"])
      expect(
        permalinkTapeFromControlTape({
          ...base,
          modelIdentity: { ...base.modelIdentity, modelVersion: good },
        }).kind,
        `${good} should convert`,
      ).toBe("converted");
  });
});

describe("the join: validate, convert, then compatibility", () => {
  test("a real authored tape is COMPATIBLE with the instrument it was recorded against", () => {
    // "the-boost-to-0.6c", one of the five tapes AGENTS.md names. Driven the whole way: the YAML on
    // disk, through the control-tape validator, through the converter, into checkTapeCompatibility.
    const record = RECORDS.find((r) => r.tapeId === "the-boost-to-0.6c");
    if (!record) throw new Error("the-boost-to-0.6c is not in the corpus");
    const tape = convert(record);
    const verdict = checkTapeCompatibility(tape, environmentAsRecorded(tape));
    expect(verdict.compatible).toBe(true);
  });

  test("every authored tape is compatible with the instrument as its author pinned it", () => {
    const refused: string[] = [];
    for (const record of CONVERTIBLE) {
      const tape = convert(record);
      const verdict = checkTapeCompatibility(tape, environmentAsRecorded(tape));
      if (!verdict.compatible) refused.push(`${record.tapeId}: ${verdict.refusalCode}`);
    }
    expect(refused).toEqual([]);
    expect(CONVERTIBLE.length).toBeGreaterThan(5);
  });

  test("a model that genuinely differs is still refused, and the notice names the difference", () => {
    const record = RECORDS.find((r) => r.tapeId === "the-boost-to-0.6c");
    if (!record) throw new Error("the-boost-to-0.6c is not in the corpus");
    const tape = convert(record);
    const asRecorded = environmentAsRecorded(tape);

    const otherModel = checkTapeCompatibility(tape, { ...asRecorded, modelId: "sr-03-rewritten" });
    expect(otherModel.compatible).toBe(false);
    if (!otherModel.compatible) {
      expect(otherModel.refusalCode).toBe("tape-model-mismatch");
      expect(otherModel.notice).toContain("sr-03-rewritten");
    }

    const otherVersion = checkTapeCompatibility(tape, { ...asRecorded, modelVersion: 2 });
    expect(otherVersion.compatible).toBe(false);
    if (!otherVersion.compatible) expect(otherVersion.refusalCode).toBe("tape-model-mismatch");

    // And the conversion does not make a difference disappear: a tape converted from a record
    // declaring version "1" must NOT match an environment declaring 2.
    expect(tape.modelIdentity.modelVersion).toBe(1);
  });
});
