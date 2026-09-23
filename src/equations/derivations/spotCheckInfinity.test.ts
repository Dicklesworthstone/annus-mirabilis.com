import { describe, expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import { evaluateExpression, SpotCheckDomainError } from "./spotCheck.ts";

/**
 * Infinity is admitted only as an integral's limit, and integrals are outside the spot check's
 * domain, so a whole equation never reaches it. A limit evaluated on its own must still refuse
 * rather than sample a number.
 */
describe("spot check refuses infinity", () => {
  test("refusal spot-check-infinity-limit: infinity, and minus infinity, are limits, not values", () => {
    const infinity = { kind: "constant", name: "infinity" } as Expression;
    for (const tree of [infinity, { kind: "negate", argument: infinity } as Expression]) {
      let caught: unknown;
      try {
        evaluateExpression(tree, {});
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(SpotCheckDomainError);
      expect((caught as SpotCheckDomainError).code).toBe("spot-check-infinity-limit");
    }
  });

  test("pi is still a value", () => {
    expect(evaluateExpression({ kind: "constant", name: "pi" } as Expression, {})).toBe(Math.PI);
  });
});
