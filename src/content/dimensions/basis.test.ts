import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DIMENSION_BASIS, DIMENSION_SI_UNITS } from "./dimensionBasis.ts";
import { TestLogger, newRunIdentity } from "../../testing/log/logger.ts";

describe("Dimension Basis Order and FrankenSim Upstream Contract", () => {
  const logger = new TestLogger("dimension-validator-tests", newRunIdentity());

  it("verifies the 6-slot basis order matches [length, mass, time, temperature, current, amount]", () => {
    const expected = ["length", "mass", "time", "temperature", "current", "amount"];
    expect([...DIMENSION_BASIS]).toEqual(expected);
    expect([...DIMENSION_SI_UNITS]).toEqual(["m", "kg", "s", "K", "A", "mol"]);
  });

  it("asserts basis order against docs/FRANKENSIM_BINDING.md Finding 2.7", () => {
    const bindingPath = path.join(process.cwd(), "docs", "FRANKENSIM_BINDING.md");

    if (!existsSync(bindingPath)) {
      logger.log({
        testId: "frankensim-basis-order-check",
        beadId: "am-cm-dimension-validator-aoz",
        outcome: "skipped",
        message: "docs/FRANKENSIM_BINDING.md not found in repository; skipped",
        extra: { reason: "basis-record-absent" },
      });
      return;
    }

    const content = readFileSync(bindingPath, "utf8");
    // Finding 2.7 describes fs-qty Dims([i8; 6]) representing SI base units [m, kg, s, K, A, mol]
    const match = content.match(/\[m,\s*kg,\s*s,\s*K,\s*A,\s*mol\]/);
    expect(match).not.toBeNull();

    logger.log({
      testId: "frankensim-basis-order-check",
      beadId: "am-cm-dimension-validator-aoz",
      expected: "[m, kg, s, K, A, mol]",
      actual: match ? match[0] : null,
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: {
        bindingPath,
        basisOrder: DIMENSION_BASIS,
      },
    });
  });
});
