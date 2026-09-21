/**
 * Targeted tests for the refusals in csv.ts, one per throw site (am-p465, am-kd9h).
 *
 * The owner's ruling is that the kebab-code migration tests what it converts. Batch 3 gave these
 * 32 sites codes; this file drives them. Each case cites the site it reaches as `(csv.ts:NN)`,
 * which the refusal scanner reads as a claim about THAT line, and asserts on the MESSAGE as well
 * as the code: several sites share a code, so the code alone would not distinguish them and a
 * test could credit a line it never reached.
 */

import { describe, expect, test } from "bun:test";
import { parseKitchenCsv } from "./csv.ts";
import { KITCHEN_LIMITS, KitchenInputError } from "./schema.ts";

/** Runs `text` through the parser and returns the refusal, or fails if none is raised. */
function refusalFor(text: string): KitchenInputError {
  try {
    parseKitchenCsv(text);
  } catch (err) {
    if (err instanceof KitchenInputError) return err;
    throw err;
  }
  throw new Error("The parser accepted input that should have been refused.");
}

const HEADER = "# sample=A Reader\n";

describe("csv.ts refusals: the tokenizer", () => {
  test("too many columns (csv.ts:30)", () => {
    const wide = `${HEADER}${Array.from({ length: 60 }, (_, i) => `c${i}`).join(",")}\n`;
    const err = refusalFor(wide);
    expect(err.code).toBe("csv-shape-invalid");
    expect(err.message).toContain("too many columns.");
  });

  test("a quote must begin a field or be doubled (csv.ts:62)", () => {
    const err = refusalFor(`${HEADER}point_id,t_s\nab"cd,1\n`);
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("a quote must begin a field or be doubled");
  });

  test("characters after a closing quote (csv.ts:75)", () => {
    const err = refusalFor(`${HEADER}point_id,t_s\n"ab"cd,1\n`);
    expect(err.code).toBe("csv-shape-invalid");
    expect(err.message).toContain("unexpected characters after a closing quote.");
  });

  test("a cell over the text limit (csv.ts:79)", () => {
    const err = refusalFor(`${HEADER}point_id\n${"x".repeat(KITCHEN_LIMITS.cell + 1)}\n`);
    expect(err.code).toBe("csv-shape-invalid");
    expect(err.message).toContain("this cell exceeds the text limit.");
  });

  test("an unclosed quoted field (csv.ts:81)", () => {
    const err = refusalFor(`${HEADER}point_id,t_s\n"unterminated,1\n`);
    expect(err.code).toBe("csv-shape-invalid");
    expect(err.message).toContain("the quoted field is not closed.");
  });
});

describe("csv.ts refusals: the file and its metadata block", () => {
  test("a file over 2 MiB (csv.ts:119)", () => {
    const err = refusalFor("x".repeat(KITCHEN_LIMITS.bytes + 1));
    expect(err.code).toBe("csv-shape-invalid");
    expect(err.message).toContain("the CSV must be at most 2 MiB.");
  });

  test("a metadata line with no equals sign (csv.ts:136)", () => {
    const err = refusalFor("# sample\npoint_id\n");
    expect(err.code).toBe("metadata-invalid");
    expect(err.message).toContain("use # key=value.");
  });

  test("an unknown metadata key (csv.ts:147)", () => {
    const err = refusalFor("# not_a_real_key=1\npoint_id\n");
    expect(err.code).toBe("metadata-invalid");
    expect(err.message).toContain("unknown metadata key.");
  });

  test("a duplicated metadata key (csv.ts:149)", () => {
    const err = refusalFor("# sample=A\n# sample=B\npoint_id\n");
    expect(err.code).toBe("metadata-invalid");
    expect(err.message).toContain("duplicate metadata declaration.");
  });

  test("metadata text over its length limit (csv.ts:106)", () => {
    const err = refusalFor(`# sample=${"n".repeat(513)}\npoint_id\n`);
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("text characters and no control codes.");
  });

  test("the deprecated scale mixed with per-axis scales (csv.ts:163)", () => {
    const err = refusalFor("# pixels_per_um=10\n# pixels_per_um_x=10\npoint_id\n");
    expect(err.code).toBe("observations-inconsistent");
    expect(err.message).toContain("do not mix deprecated and per-axis scales.");
  });
});
