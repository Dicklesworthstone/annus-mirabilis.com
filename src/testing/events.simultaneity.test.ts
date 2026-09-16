import { describe, expect, test } from "bun:test";
import { classifySimultaneity } from "../physics/reference/events.ts";

describe("events.simultaneity: Simultaneity classification (am-ref-events-yvl)", () => {
  test("Classifies exact zero as simultaneous", () => {
    expect(classifySimultaneity(0)).toBe("simultaneous");
  });

  test("Classifies positive deltaT as ordered-positive and negative deltaT as ordered-negative", () => {
    expect(classifySimultaneity(2.5)).toBe("ordered-positive");
    expect(classifySimultaneity(-7.5)).toBe("ordered-negative");
  });

  test("Classifies near-cancellation deltaT within tolerance band as indeterminate", () => {
    expect(classifySimultaneity(1e-13, { absolute: 1e-12 })).toBe("indeterminate");
    expect(classifySimultaneity(-1e-13, { absolute: 1e-12 })).toBe("indeterminate");
  });
});
