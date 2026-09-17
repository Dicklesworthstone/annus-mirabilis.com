import { describe, expect, test } from "bun:test";
import { validateWeavePredicate, WeaveValidationError } from "./validate.ts";

const ctx = {
  instrumentOutputIds: new Set(["x", "kolmogorovDistance", "ensembleSize", "lowerBand", "upperBand"]),
  resolvableTargetIds: new Set(["s4-p1", "s5-p2"]),
};

function basePredicate(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    instrumentId: "bm-01",
    meaning: "quantity-compared",
    conditions: [{ kind: "threshold", quantityId: "x", direction: "at-least", enter: 1, exit: 0.9 }],
    targets: ["s4-p1"],
    pointerText: "This is the quantity being compared.",
    ...overrides,
  };
}

describe("validateWeavePredicate: the compiler's rejection rules (am-read-result-weave-jex)", () => {
  test("a valid predicate validates", () => {
    const predicate = validateWeavePredicate(basePredicate(), ctx);
    expect(predicate.id).toBe("p1");
    expect(predicate.meaning).toBe("quantity-compared");
  });

  test("a predicate without a meaning fails with weave-meaning-missing, naming the predicate and instrument", () => {
    const { meaning, ...withoutMeaning } = basePredicate();
    void meaning;
    try {
      validateWeavePredicate(withoutMeaning, ctx);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
      expect((error as WeaveValidationError).rule).toBe("weave-meaning-missing");
      expect((error as Error).message).toContain("p1");
      expect((error as Error).message).toContain("bm-01");
    }
  });

  test("a meaning outside the four values fails with weave-meaning-missing", () => {
    expect(() => validateWeavePredicate(basePredicate({ meaning: "definitely-true" }), ctx)).toThrow(
      WeaveValidationError,
    );
  });

  test("outside-selected-domain with an agreement condition fails with weave-outside-domain-uses-agreement", () => {
    const predicate = basePredicate({
      meaning: "outside-selected-domain",
      conditions: [
        {
          kind: "agreement",
          statisticQuantityId: "kolmogorovDistance",
          sampleCountQuantityId: "ensembleSize",
          minimumSampleSize: 100,
          boundFamily: "dkw",
          enterAlpha: 1e-3,
          exitAlpha: 1e-4,
        },
      ],
    });
    try {
      validateWeavePredicate(predicate, ctx);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
      expect((error as WeaveValidationError).rule).toBe("weave-outside-domain-uses-agreement");
    }
  });

  test("outside-selected-domain WITHOUT an agreement condition validates", () => {
    const predicate = validateWeavePredicate(
      basePredicate({
        meaning: "outside-selected-domain",
        conditions: [{ kind: "status", quantityId: "x", equals: "outside-domain" }],
      }),
      ctx,
    );
    expect(predicate.meaning).toBe("outside-selected-domain");
  });

  test("a target that does not resolve to a sentence id fails with weave-target-unresolved", () => {
    try {
      validateWeavePredicate(basePredicate({ targets: ["not-a-real-sentence"] }), ctx);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
      expect((error as WeaveValidationError).rule).toBe("weave-target-unresolved");
    }
  });

  test("a condition quantity id that is not a declared output fails with weave-condition-quantity-not-output", () => {
    try {
      validateWeavePredicate(
        basePredicate({
          conditions: [{ kind: "threshold", quantityId: "notAnOutput", direction: "at-least", enter: 1, exit: 0.9 }],
        }),
        ctx,
      );
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
      expect((error as WeaveValidationError).rule).toBe("weave-condition-quantity-not-output");
    }
  });

  test("an agreement condition without a sample-count output fails with weave-agreement-underspecified", () => {
    try {
      validateWeavePredicate(
        basePredicate({
          conditions: [
            {
              kind: "agreement",
              statisticQuantityId: "kolmogorovDistance",
              minimumSampleSize: 100,
              boundFamily: "dkw",
              enterAlpha: 1e-3,
              exitAlpha: 1e-4,
            },
          ],
        }),
        ctx,
      );
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
    }
  });

  test("an owner-band agreement condition whose bound outputs the instrument does not declare fails", () => {
    try {
      validateWeavePredicate(
        basePredicate({
          conditions: [
            {
              kind: "agreement",
              statisticQuantityId: "kolmogorovDistance",
              sampleCountQuantityId: "ensembleSize",
              minimumSampleSize: 100,
              boundFamily: "owner-band",
              enterAlpha: 1e-3,
              exitAlpha: 1e-4,
              lowerBoundQuantityId: "notDeclared",
              upperBoundQuantityId: "alsoNotDeclared",
            },
          ],
        }),
        ctx,
      );
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
      expect((error as WeaveValidationError).rule).toBe("weave-condition-quantity-not-output");
    }
  });

  test("an owner-band agreement condition WITH declared bound outputs validates", () => {
    const predicate = validateWeavePredicate(
      basePredicate({
        conditions: [
          {
            kind: "agreement",
            statisticQuantityId: "kolmogorovDistance",
            sampleCountQuantityId: "ensembleSize",
            minimumSampleSize: 100,
            boundFamily: "owner-band",
            enterAlpha: 1e-3,
            exitAlpha: 1e-4,
            lowerBoundQuantityId: "lowerBand",
            upperBoundQuantityId: "upperBand",
          },
        ],
      }),
      ctx,
    );
    expect(predicate.conditions[0]?.kind).toBe("agreement");
  });

  test("an unknown condition kind fails with weave-unknown-condition-kind", () => {
    try {
      validateWeavePredicate(basePredicate({ conditions: [{ kind: "made-up-kind" }] }), ctx);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
      expect((error as WeaveValidationError).rule).toBe("weave-unknown-condition-kind");
    }
  });

  test("an unknown bound family fails with weave-unknown-bound-family", () => {
    try {
      validateWeavePredicate(
        basePredicate({
          conditions: [
            {
              kind: "agreement",
              statisticQuantityId: "kolmogorovDistance",
              sampleCountQuantityId: "ensembleSize",
              minimumSampleSize: 100,
              boundFamily: "made-up-family",
              enterAlpha: 1e-3,
              exitAlpha: 1e-4,
            },
          ],
        }),
        ctx,
      );
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WeaveValidationError);
      expect((error as WeaveValidationError).rule).toBe("weave-unknown-bound-family");
    }
  });
});
