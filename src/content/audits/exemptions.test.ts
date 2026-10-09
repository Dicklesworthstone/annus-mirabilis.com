/**
 * THE EXEMPTION CEILING, AND THE THREE WAYS AN EXEMPTION MAP GOES WRONG.
 *
 * The reasoning is in exemptions.ts. What this file establishes is that each of the three verdicts
 * can actually be reached, because all three are invisible when absent:
 *
 *   - a finding against an exempted item must become a FLAG, not vanish;
 *   - an exemption with no findings left must be an ERROR, or the map outlives its reason;
 *   - an exemption with MORE findings than recorded must be an ERROR, or the exemption is a budget.
 *
 * The third is the one this module was written for, and it is the one a test is most needed for: it
 * fires only on a count comparison, so an implementation that forgot it would pass every other case
 * here and on the real corpus, which is exactly how five grown exemptions went unreported for twenty
 * days.
 *
 * A bare-string exemption must keep behaving as it did, because three other audits' maps are still
 * strings and a silent change in their behaviour would be a gate change nobody asked for.
 */

import { describe, expect, test } from "bun:test";
import { type AuditExemption, applyAuditExemptions, exemptionCeiling } from "./exemptions.ts";
import type { AuditFinding, AuditReport } from "./types.ts";

const finding = (recordId: string, check = "some-rule"): AuditFinding => ({
  check,
  family: "audit",
  severity: "error",
  recordId,
  message: `${recordId} fails ${check}`,
});

const report = (findings: readonly AuditFinding[]): AuditReport =>
  ({ audit: "test", findings, errorCount: findings.length, flagCount: 0 }) as AuditReport;

const apply = (
  findings: readonly AuditFinding[],
  exemptions: ReadonlyMap<string, AuditExemption>,
  total = 10,
) => applyAuditExemptions("test", report(findings), exemptions, (f) => f.recordId, total);

const errorsOf = (r: AuditReport) => r.findings.filter((f) => f.severity === "error");
const checksOf = (r: AuditReport) => errorsOf(r).map((f) => f.check);

describe("a reason alone behaves exactly as before", () => {
  test("a finding against an exempted item becomes a flag, and is not dropped", () => {
    const out = apply([finding("a")], new Map([["a", "because reasons"]]));
    expect(out.findings.length).toBe(1);
    expect(out.findings[0]?.severity).toBe("flag");
    expect(out.findings[0]?.message).toContain("because reasons");
    expect(errorsOf(out)).toEqual([]);
  });

  test("a finding against an item nobody exempted stays an error", () => {
    const out = apply([finding("b")], new Map([["a", "because reasons"]]));
    // And the stale-exemption error for "a" arrives alongside it, so both are reported at once.
    expect(checksOf(out).sort()).toEqual(["some-rule", "stale-audit-exemption"]);
  });

  test("an exemption with nothing left to exempt is an error naming its reason", () => {
    const out = apply([], new Map([["a", "because reasons"]]));
    expect(checksOf(out)).toEqual(["stale-audit-exemption"]);
    expect(errorsOf(out)[0]?.message).toContain("because reasons");
  });

  test("no ceiling means no growth check: ten findings under a bare string stay flags", () => {
    const out = apply(
      Array.from({ length: 10 }, (_, i) => finding("a", `rule-${i}`)),
      new Map([["a", "because reasons"]]),
    );
    expect(errorsOf(out)).toEqual([]);
    expect(out.findings.every((f) => f.severity === "flag")).toBe(true);
  });
});

describe("a ceiling turns the exemption into a debt", () => {
  test("at the ceiling: findings are flags and there is no error", () => {
    const out = apply(
      [finding("a", "r1"), finding("a", "r2")],
      new Map([["a", { reason: "two known", findings: 2 }]]),
    );
    expect(errorsOf(out)).toEqual([]);
    expect(out.findings.filter((f) => f.severity === "flag").length).toBe(2);
  });

  test("UNDER the ceiling is not an error, because paying a debt down must not fail a build", () => {
    const out = apply([finding("a")], new Map([["a", { reason: "three known", findings: 3 }]]));
    expect(errorsOf(out)).toEqual([]);
  });

  test("OVER the ceiling is an error naming both numbers and the shortfall", () => {
    const out = apply(
      [finding("a", "r1"), finding("a", "r2"), finding("a", "r3")],
      new Map([["a", { reason: "two known", findings: 2 }]]),
    );
    const errors = errorsOf(out);
    expect(errors.map((f) => f.check)).toEqual(["grown-audit-exemption"]);
    const message = errors[0]?.message ?? "";
    expect(message).toContain("for 2 test finding(s) and now has 3");
    expect(message).toContain("1 new finding(s)");
    expect(message).toContain("two known");
    // The three findings themselves are still reported, as flags: an error about the count must not
    // replace the findings a reader needs in order to act on it.
    expect(out.findings.filter((f) => f.severity === "flag").length).toBe(3);
  });

  test("the ceiling is read per item, so one item's growth does not indict another's", () => {
    const out = apply(
      [finding("a", "r1"), finding("a", "r2"), finding("b", "r1")],
      new Map<string, AuditExemption>([
        ["a", { reason: "one known", findings: 1 }],
        ["b", { reason: "one known", findings: 1 }],
      ]),
    );
    expect(errorsOf(out).map((f) => f.recordId)).toEqual(["a"]);
  });

  test("a ceiling of 0 is not a free pass: it reads as stale, since nothing is covered", () => {
    // An item with no findings is stale whether or not it carries a number, and that must win:
    // a ceiling of 0 with no findings is an exemption for a debt that no longer exists.
    const out = apply([], new Map([["a", { reason: "none known", findings: 0 }]]));
    expect(checksOf(out)).toEqual(["stale-audit-exemption"]);
  });

  test("exemptionCeiling tells the two forms apart", () => {
    expect(exemptionCeiling("just a reason")).toBeUndefined();
    expect(exemptionCeiling({ reason: "r", findings: 4 })).toBe(4);
    expect(exemptionCeiling({ reason: "r", findings: 0 })).toBe(0);
  });
});

describe("the population is reported, so zero errors cannot read as all of them", () => {
  test("judged excludes the exempted items and never goes negative", () => {
    const out = apply([finding("a")], new Map([["a", "r"]]), 10);
    expect(out.population?.total).toBe(10);
    expect(out.population?.judged).toBe(9);
    expect(out.population?.notYetAuditable).toBe(1);

    // More exemptions than the population is a nonsense state, but it must not produce a negative
    // denominator that a reader would take for a real one.
    const odd = apply(
      [finding("a"), finding("b")],
      new Map<string, AuditExemption>([
        ["a", "r"],
        ["b", "r"],
      ]),
      1,
    );
    expect(odd.population?.judged).toBe(0);
  });
});
