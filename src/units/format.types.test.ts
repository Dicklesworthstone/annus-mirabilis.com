/**
 * Type-level proof for `ConstantSetDependentValue` (am-ver-precision-display-5e5): a value whose
 * meaning depends on a constant set cannot be formatted without naming that set.
 *
 * Checked by `bun run check:types`, because an UNUSED `@ts-expect-error` is itself a type error.
 * So if `constantSetId` ever becomes optional, this file fails the repository-wide gate.
 *
 * It did not before. This file asserted the same claim in a comment:
 *
 *     // Type-level assertion:
 *     // The following line would fail TypeScript compilation if uncommented:
 *     // const invalid: ConstantSetDependentValue = { value: 1.0, unit: "m" };
 *
 * A commented-out negative is not a negative. Nothing compiled it, nothing ran it, and the file
 * held no runtime assertion either -- it constructed a valid value and called the formatter for
 * its side effect, which in `bun test` (types stripped) passes however the interface is declared.
 * Making `constantSetId` optional would have left both lanes green. Its two sibling
 * `.types.test.ts` files, `src/experiments/labels/labelProps.types.test.ts` and
 * `src/experiments/lq03/frequencyBrand.types.test.ts`, already use live `@ts-expect-error`
 * negatives; this one was the outlier.
 */
import { describe, expect, test } from "bun:test";
import { type ConstantSetDependentValue, formatConstantSetDependentValue } from "./format.ts";

const METRE = { value: 1.0, unit: "m" } as const;

describe("ConstantSetDependentValue requires its constant set (am-ver-precision-display-5e5)", () => {
  test("omitting constantSetId is a compile error, which is the point of the type", () => {
    // @ts-expect-error constantSetId is required: a value whose meaning depends on a constant set
    // may not be declared without naming it. Removing the `?`-lessness in format.ts would make
    // this directive unused, which fails `tsc --noEmit` and so fails check:types for every pane.
    const invalid: ConstantSetDependentValue = { ...METRE };
    // Referenced so the declaration is not merely discarded as unused.
    expect(invalid.value).toBe(1);
  });

  test("a complete value formats, and the set it depends on reaches the reader's string", () => {
    const formatted = formatConstantSetDependentValue({
      ...METRE,
      constantSetId: "modern-si-2019",
    });
    expect(formatted).toBe("1 m (modern-si-2019)");
  });

  test("a different constant set formats differently, so the id is used and not merely required", () => {
    // Without this, the test above would pass over an implementation that accepted the field and
    // ignored it, which is the failure the required field exists to prevent: a displayed value
    // that does not say which constants produced it, or says the wrong one.
    const modern = formatConstantSetDependentValue({
      ...METRE,
      constantSetId: "modern-si-2019",
    });
    const printed = formatConstantSetDependentValue({
      ...METRE,
      constantSetId: "einstein-1905-brownian-printed",
    });
    expect(printed).toBe("1 m (einstein-1905-brownian-printed)");
    expect(printed).not.toBe(modern);
  });

  test("an authored label is shown in place of the raw id, and the id is not also shown", () => {
    const formatted = formatConstantSetDependentValue({
      ...METRE,
      constantSetId: "modern-si-2019",
      constantSetLabel: "modern SI (2019)",
    });
    expect(formatted).toBe("1 m (modern SI (2019))");
    expect(formatted).not.toContain("modern-si-2019");
  });
});
