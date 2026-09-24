import { describe, expect, test } from "bun:test";
import { loadProvenanceReceipts } from "./loadReceipts.ts";
import { parseYaml } from "./yaml.ts";

/*
 * A double-quoted scalar's escapes are decoded once, in one pass. Until 2026-09-24 only \" and \\
 * were, so "da\u00df" reached /sources/ as six characters of escape instead of "daß".
 */
const value = (yaml: string) => (parseYaml(`v: ${yaml}\n`) as { v: unknown }).v;

describe("double-quoted scalars", () => {
  test("a \\u escape is the character it names", () => {
    expect(value('"da\\u00df"')).toBe("daß");
    expect(value('"\\u03c6(\\u0394) = \\u03c6(-\\u0394)"')).toBe("φ(Δ) = φ(-Δ)");
    expect(value('"\\u00a7 7."')).toBe("§ 7.");
  });

  test("an escaped backslash is never the start of another escape", () => {
    // Two passes would turn \\u00df into \u00df and then into ß.
    expect(value('"a\\\\u00df"')).toBe("a\\u00df");
    expect(value('"say \\"so\\""')).toBe('say "so"');
    expect(value('"C:\\\\temp"')).toBe("C:\\temp");
  });

  test("a backslash sequence the parser does not decode is kept as written", () => {
    expect(value('"it\\\'s"')).toBe("it\\'s");
    expect(value('"\\u12"')).toBe("\\u12");
  });

  test("no receipt reading still carries an undecoded \\u escape", () => {
    const readings = loadProvenanceReceipts().receipts.flatMap(({ receipt }) =>
      (receipt?.frontMatter.typographicalErrors ?? []).flatMap((e) => [
        e.originalReading,
        e.proposedReading,
      ]),
    );
    // Non-vacuity: the receipts do record readings, and some use characters beyond ASCII.
    expect(readings.length).toBeGreaterThan(0);
    expect(readings.some((r) => /[^\x00-\x7f]/.test(r))).toBe(true);
    expect(readings.filter((r) => /\\u[0-9a-fA-F]{4}/.test(r))).toEqual([]);
  });
});
