/**
 * THE PARSER, IN BOTH DIRECTIONS (am-ff2s).
 *
 * This exists because the comparison it serves was tried once and discarded. src/content/teachingTapes.ts
 * records why: `parseUnitToDimension` "returns dimensionless for every compound unit it does not know
 * ('m/mol', '1/mol', 'm2/s' and 'J/K' all come back [0,0,0,0,0,0]) ... A guard that cannot fail is not a
 * guard." So the property that matters most here is the NEGATIVE one: an unrecognised unit must never
 * produce a dimension, and the cases below drive that as hard as the positive ones.
 *
 * The specimens are hand-written for the grammar and ENUMERATED for the corpus. The enumeration is what
 * keeps the hand-written set honest: a unit this parser cannot read is a failing test rather than a quiet
 * dimensionless, whoever adds it.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  exponentsEqual,
  formatExponents,
  registryExponents,
  unitDimension,
} from "./outputUnitDimension.ts";

/** Expect a parse and return its exponents, so a case never asserts against an unparsed result. */
function dim(unit: string): readonly number[] {
  const result = unitDimension(unit);
  if (result.kind !== "dimension")
    throw new Error(`${JSON.stringify(unit)} did not parse: ${result.token} (${result.reason})`);
  return result.exponents;
}

describe("the grammar", () => {
  test("a base unit is its own dimension, in DIMENSION_BASIS order", () => {
    // [length, mass, time, temperature, current, amount]. Asserted explicitly because getting this
    // order wrong is the quiet way a dimension comparison becomes meaningless: qty.ts's own vector puts
    // the same six in the same order, and a reader who assumes otherwise compares the wrong slots.
    expect(dim("m")).toEqual([1, 0, 0, 0, 0, 0]);
    expect(dim("kg")).toEqual([0, 1, 0, 0, 0, 0]);
    expect(dim("s")).toEqual([0, 0, 1, 0, 0, 0]);
    expect(dim("K")).toEqual([0, 0, 0, 1, 0, 0]);
    expect(dim("A")).toEqual([0, 0, 0, 0, 1, 0]);
    expect(dim("mol")).toEqual([0, 0, 0, 0, 0, 1]);
  });

  test("dimensionless spellings are dimensionless", () => {
    for (const unit of ["1", "", " ", "%", "rad", "deg", "count"])
      expect(dim(unit)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  test("a quotient subtracts, and the four shapes the corpus writes all agree", () => {
    // m^2 s^-1 four ways. A grammar that read only one of them would leave the others unparsed, and an
    // unparsed unit is excluded from the comparison rather than failing it.
    const expected = [2, 0, -1, 0, 0, 0];
    expect(dim("m2/s")).toEqual(expected);
    expect(dim("m^2/s")).toEqual(expected);
    expect(dim("m2 s-1")).toEqual(expected);
    expect(dim("m^2 s^-1")).toEqual(expected);
  });

  test("a trailing negative is an exponent, not part of the unit's name", () => {
    // The two units this parser could not read on its first run, because the name class was "anything
    // but a digit" and matched greedily through the minus: `m-2` split as name "m-" and `kg-1 s` as
    // "kg-". Both came back unparsed naming a token that does not exist.
    expect(dim("m-2 s-1")).toEqual([-2, 0, -1, 0, 0, 0]);
    expect(dim("kg-1 s")).toEqual([0, -1, 1, 0, 0, 0]);
  });

  test("a parenthesised denominator groups its factors", () => {
    // J/(m^3 Hz K): energy per volume per frequency per temperature. Ungrouped, only m^3 would divide
    // and Hz and K would multiply, which is a different dimension and would read as a disagreement.
    expect(dim("J/(m^3 Hz K)")).toEqual([-1, 1, -1, -1, 0, 0]);
    expect(dim("J/(m^3 Hz)")).toEqual([-1, 1, -1, 0, 0, 0]);
  });

  test("a product separated by a space or a middle dot multiplies", () => {
    expect(dim("Pa s")).toEqual([-1, 1, -1, 0, 0, 0]);
    expect(dim("kg·m/s")).toEqual([1, 1, -1, 0, 0, 0]);
    expect(dim("T V/m")).toEqual(dim("T")?.map((v, i) => v + (dim("V/m")[i] ?? 0)));
  });

  test("the derived units the corpus uses have the dimensions they should", () => {
    expect(dim("N")).toEqual([1, 1, -2, 0, 0, 0]);
    expect(dim("J")).toEqual([2, 1, -2, 0, 0, 0]);
    expect(dim("W")).toEqual([2, 1, -3, 0, 0, 0]);
    expect(dim("Pa")).toEqual([-1, 1, -2, 0, 0, 0]);
    expect(dim("Hz")).toEqual([0, 0, -1, 0, 0, 0]);
    expect(dim("J/K")).toEqual([2, 1, -2, -1, 0, 0]);
    expect(dim("eV")).toEqual(dim("J"));
    // THE SLOT ORDER, WHICH I GOT WRONG HERE FIRST and the parser did not. These three put a CURRENT
    // exponent in slot 5, not slot 4: the basis is [length, mass, time, TEMPERATURE, CURRENT, amount].
    // Writing volt as [2, 1, -3, -1, 0, 0] reads as energy per temperature, which is a different
    // quantity entirely. The case above pins the order for exactly this reason; these are what it is
    // for.
    expect(dim("V")).toEqual([2, 1, -3, 0, -1, 0]);
    expect(dim("C")).toEqual([0, 0, 1, 0, 1, 0]);
    expect(dim("T")).toEqual([0, 1, -2, 0, -1, 0]);
  });

  test("the two period units are what the instruments mean by them", () => {
    // `ls` is a light-second, a LENGTH: the SR laboratories measure distances in light-seconds so that c
    // is 1 in their own numbers. `c` is the speed of light USED AS A UNIT, so an output reported in c is
    // a velocity. Both have to be tokens: left unparsed they would be excluded from every comparison,
    // which is the quiet half of this whole defect.
    expect(dim("ls")).toEqual([1, 0, 0, 0, 0, 0]);
    expect(dim("ls/s")).toEqual([1, 0, -1, 0, 0, 0]);
    expect(dim("ls^2")).toEqual([2, 0, 0, 0, 0, 0]);
    expect(dim("c")).toEqual([1, 0, -1, 0, 0, 0]);
  });
});

describe("an unrecognised unit is NEVER a dimension", () => {
  test("an unknown token is reported by name", () => {
    const result = unitDimension("furlong/fortnight");
    expect(result.kind).toBe("unparsed");
    if (result.kind !== "unparsed") throw new Error("unreachable");
    expect(result.token).toBe("furlong");
    expect(result.reason).toMatch(/unknown unit token/);
  });

  test("THE DISCARDED ATTEMPT: the four units that used to come back dimensionless do not", () => {
    // teachingTapes.ts records these four by name as the reason a dimension comparison was abandoned:
    // "'m/mol', '1/mol', 'm2/s' and 'J/K' all come back [0,0,0,0,0,0]". Here they are, each with its own
    // dimension, and none of them dimensionless.
    const zero = [0, 0, 0, 0, 0, 0];
    expect(dim("m/mol")).toEqual([1, 0, 0, 0, 0, -1]);
    expect(dim("1/mol")).toEqual([0, 0, 0, 0, 0, -1]);
    expect(dim("m2/s")).toEqual([2, 0, -1, 0, 0, 0]);
    expect(dim("J/K")).toEqual([2, 1, -2, -1, 0, 0]);
    for (const unit of ["m/mol", "1/mol", "m2/s", "J/K"]) expect(dim(unit)).not.toEqual(zero);
  });

  test("an unknown token inside a known compound is still unparsed", () => {
    // The dangerous direction: a parser that ignored what it could not read would return the dimension of
    // the rest and call it a match.
    for (const unit of ["J/widget", "widget m", "m^2/widget s"]) {
      const result = unitDimension(unit);
      expect(result.kind, `${unit} should not parse`).toBe("unparsed");
    }
  });

  test("a malformed exponent is unparsed rather than taken as a power of one", () => {
    const result = unitDimension("m^^2");
    expect(result.kind).toBe("unparsed");
  });

  test("the error names the whole unit as well as the token, so a report can quote it", () => {
    const result = unitDimension("J/widget");
    if (result.kind !== "unparsed") throw new Error("unreachable");
    expect(result.unit).toBe("J/widget");
    expect(result.token).toBe("widget");
  });
});

describe("registry exponents and comparison", () => {
  test("a rational dimension of integers converts; a fractional one declines", () => {
    const whole = [
      { num: 2, den: 1 },
      { num: 0, den: 1 },
      { num: -1, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ];
    expect(registryExponents(whole)).toEqual([2, 0, -1, 0, 0, 0]);
    const half = [...whole];
    half[0] = { num: 1, den: 2 };
    expect(registryExponents(half)).toBeNull();
  });

  test("a dimension of the wrong length declines rather than comparing short", () => {
    expect(registryExponents([{ num: 1, den: 1 }])).toBeNull();
  });

  test("exponentsEqual distinguishes a density from a total, which is the point", () => {
    // AGENTS.md: "a spectral density versus a total" is one of the distinctions dimensions must keep.
    expect(exponentsEqual(dim("J"), dim("J/m^3"))).toBe(false);
    expect(exponentsEqual(dim("J"), dim("eV"))).toBe(true);
  });

  test("formatExponents prints something a reader can compare with a unit string", () => {
    expect(formatExponents(dim("m2/s"))).toBe("m^2 s^-1");
    expect(formatExponents(dim("1"))).toBe("1");
    expect(formatExponents(dim("m/mol"))).toBe("m mol^-1");
  });
});

describe("the live corpus", () => {
  const EXPERIMENTS = fileURLToPath(new URL("../experiments/", import.meta.url));
  const EXTRA = ["sr08/forceLedger.ts", "sr08/session.ts", "lightThread/session.ts"];

  test("EVERY unit any laboratory declares parses, with its denominator printed", async () => {
    const files = [
      ...readdirSync(EXPERIMENTS)
        .map((d) => join(d, "definition.ts"))
        .filter((f) => existsSync(join(EXPERIMENTS, f))),
      ...EXTRA,
    ];
    const units = new Set<string>();
    let contracts = 0;
    for (const file of files) {
      const mod = (await import(join(EXPERIMENTS, file))) as Record<string, unknown>;
      for (const [name, value] of Object.entries(mod)) {
        if (!name.includes("OUTPUT") || !value || typeof value !== "object") continue;
        for (const [, contract] of Object.entries(value as Record<string, unknown>)) {
          if (!contract || typeof contract !== "object" || !("semanticKind" in contract)) continue;
          contracts += 1;
          units.add(String((contract as { unit?: unknown }).unit ?? ""));
        }
      }
    }
    // Non-vacuity before the verdict: a broken import or a renamed export would make the check below
    // pass over an empty set, which is the exact shape this parser exists to refuse.
    expect(files.length).toBeGreaterThan(30);
    expect(contracts).toBeGreaterThan(400);
    expect(units.size).toBeGreaterThan(40);
    const unparsed = [...units]
      .map((unit) => ({ unit, result: unitDimension(unit) }))
      .filter((row) => row.result.kind === "unparsed")
      .map((row) =>
        row.result.kind === "unparsed"
          ? `${JSON.stringify(row.unit)} (${row.result.token}: ${row.result.reason})`
          : "",
      );
    console.log(
      `[output units] ${contracts} contracts across ${files.length} modules, ${units.size} distinct units, ${unparsed.length} unparsed`,
    );
    expect(unparsed).toEqual([]);
  });
});
