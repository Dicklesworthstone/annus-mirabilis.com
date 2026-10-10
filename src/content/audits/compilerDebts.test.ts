/**
 * THE FOUR VERDICTS A RECORDED DEBT MUST BE ABLE TO REACH, AND THE ONE A COUNT CANNOT.
 *
 * The reasoning is in compilerDebts.ts. What this file establishes is that each verdict is
 * reachable, because every one of them is invisible when it is absent:
 *
 *   - a covered finding must become a FLAG, never vanish;
 *   - MORE findings than recorded must be an error, or the ceiling is a budget;
 *   - a finding against a record the debt does not name must be an error EVEN UNDER THE CEILING,
 *     or a debt paid down in one instrument funds a new one elsewhere and the total never moves;
 *   - zero findings must be an error, or a paid debt outlives its reason.
 *
 * The third is why this module is not `exemptions.ts` with a different key. That one keys on the
 * ITEM and compares a count; this one keys on the RULE and must therefore also pin the population,
 * or it degrades into exactly the per-rule quota AGENTS.md's baseline rule forbids. An
 * implementation that forgot it would pass every other case here AND stay green on the real
 * corpus, since the real totals are at their ceilings today.
 *
 * The last test is the lane-independent half: it asserts the SHIPPED debt declarations against the
 * numbers in their own docblock, so an edit that raises a ceiling without re-measuring is red here
 * even though this file never runs the compiler. The half that watches the real corpus is
 * verify-content itself, which is the lane this gate controls.
 */

import { describe, expect, test } from "bun:test";
import type { CompilerDiagnostic } from "../compiler/compiler.ts";
import { applyCompilerDebts, type CompilerDebt, DECLARED_COMPILER_DEBTS } from "./compilerDebts.ts";

const diagnostic = (code: string, recordId: string): CompilerDiagnostic => ({
  severity: "error",
  code,
  checkId: "kernel-identifier-binding",
  path: "kernel-identifier-binding",
  family: "manifest",
  recordId,
  message: `${recordId} fails ${code}`,
});

const debt = (over: Partial<CompilerDebt> = {}): CompilerDebt => ({
  rule: "live-term-unbound",
  findings: 2,
  records: ["sr-13", "lq-03"],
  owner: "am-owner-1234",
  reason: "a recorded reason",
  ...over,
});

const errorsOf = (diagnostics: readonly CompilerDiagnostic[]) =>
  diagnostics.filter((d) => d.severity === "error");
const flagsOf = (diagnostics: readonly CompilerDiagnostic[]) =>
  diagnostics.filter((d) => d.severity === "flag");

describe("a covered finding becomes a flag and is never dropped", () => {
  test("at the ceiling: both findings are flags, no error, and the message names the owner", () => {
    const out = applyCompilerDebts(
      [diagnostic("live-term-unbound", "sr-13"), diagnostic("live-term-unbound", "lq-03")],
      [debt()],
    );
    expect(out.diagnostics.length).toBe(2);
    expect(flagsOf(out.diagnostics).length).toBe(2);
    expect(errorsOf(out.diagnostics)).toEqual([]);
    expect(out.errors).toEqual([]);
    expect(out.diagnostics[0]?.message).toContain("am-owner-1234");
    expect(out.diagnostics[0]?.message).toContain("ceiling 2");
  });

  test("a rule nobody declared is untouched, so this cannot silence a class by accident", () => {
    const out = applyCompilerDebts([diagnostic("undeclared-kernel-function", "sr-02")], [debt()]);
    expect(errorsOf(out.diagnostics).length).toBe(1);
    expect(errorsOf(out.diagnostics)[0]?.code).toBe("undeclared-kernel-function");
  });

  test("a FLAG on a declared rule stays a flag and is not counted against the ceiling", () => {
    // Only errors are a debt. Counting pre-existing flags would let a class drift over its
    // ceiling without a single new error, which is the ceiling failing open.
    const flag: CompilerDiagnostic = {
      ...diagnostic("live-term-unbound", "sr-13"),
      severity: "flag",
    };
    const out = applyCompilerDebts([flag, diagnostic("live-term-unbound", "lq-03")], [debt()]);
    expect(out.errors.filter((e) => e.startsWith("grown-compiler-debt"))).toEqual([]);
    expect(out.census[0]).toContain("1 of a recorded 2");
  });
});

describe("the ceiling refuses growth", () => {
  test("OVER the ceiling is an error naming both numbers and the shortfall", () => {
    const out = applyCompilerDebts(
      [
        diagnostic("live-term-unbound", "sr-13"),
        diagnostic("live-term-unbound", "sr-13"),
        diagnostic("live-term-unbound", "lq-03"),
      ],
      [debt()],
    );
    const grown = out.errors.filter((e) => e.startsWith("grown-compiler-debt"));
    expect(grown.length).toBe(1);
    expect(grown[0]).toContain("recorded for 2 finding(s) and now has 3");
    expect(grown[0]).toContain("1 new finding(s)");
    expect(grown[0]).toContain("am-owner-1234");
    // The findings themselves are still reported, as flags: an error about a count must not
    // replace the findings a reader needs in order to act on it.
    expect(flagsOf(out.diagnostics).length).toBe(3);
  });

  test("UNDER the ceiling is not an error, because paying a debt down must not fail a build", () => {
    const out = applyCompilerDebts([diagnostic("live-term-unbound", "sr-13")], [debt()]);
    expect(out.errors).toEqual([]);
    // And it says so, with the number to lower the ceiling to.
    expect(out.census.some((l) => l.includes("DOWN from 2 to 1"))).toBe(true);
  });

  test("ZERO findings is an error, so a paid debt cannot outlive its reason", () => {
    const out = applyCompilerDebts([], [debt()]);
    const stale = out.errors.filter((e) => e.startsWith("stale-compiler-debt"));
    expect(stale.length).toBe(1);
    expect(stale[0]).toContain("a recorded reason");
    // Stale wins over the under-ceiling note: there is nothing left to pay down.
    expect(out.errors.some((e) => e.startsWith("grown-compiler-debt"))).toBe(false);
  });
});

describe("THE SWAP: a finding in an undeclared record is red under the ceiling", () => {
  test("one covered record paid down and a new one appearing stays RED, though the total is 2", () => {
    // This is the case a count-only ratchet passes. The total is exactly the recorded 2, so no
    // ceiling fires; what is wrong is that one of the two is somewhere the debt was never
    // measured. A plant of this shape in sr-02 is the acceptance criterion am-1nnj asks for.
    const out = applyCompilerDebts(
      [diagnostic("live-term-unbound", "sr-13"), diagnostic("live-term-unbound", "sr-02")],
      [debt()],
    );
    const swap = out.errors.filter((e) => e.startsWith("undeclared-debt-record"));
    expect(swap.length).toBe(1);
    expect(swap[0]).toContain("sr-02");
    expect(swap[0]).not.toContain("sr-13");
    // The new one is still an ERROR diagnostic, not a flag: it is not covered by anything.
    expect(errorsOf(out.diagnostics).map((d) => d.recordId)).toEqual(["sr-02"]);
    expect(flagsOf(out.diagnostics).map((d) => d.recordId)).toEqual(["sr-13"]);
    // No grown error, which is the whole point: the count alone would have said this was fine.
    expect(out.errors.some((e) => e.startsWith("grown-compiler-debt"))).toBe(false);
    expect(out.census[0]).toContain("1 record(s) NOT covered: sr-02");
  });

  test("several undeclared records are named together, sorted, and counted", () => {
    const out = applyCompilerDebts(
      [
        diagnostic("live-term-unbound", "sr-13"),
        diagnostic("live-term-unbound", "lq-03"),
        diagnostic("live-term-unbound", "zz-99"),
        diagnostic("live-term-unbound", "aa-01"),
      ],
      [debt()],
    );
    const swap = out.errors.filter((e) => e.startsWith("undeclared-debt-record"));
    expect(swap.length).toBe(1);
    expect(swap[0]).toContain("aa-01, zz-99");
    expect(out.census[0]).toContain("2 record(s) NOT covered");
  });
});

describe("the shipped declarations match the measurement their docblock cites", () => {
  test("both debts are declared, and no debt is owned by am-1nnj itself", () => {
    expect(DECLARED_COMPILER_DEBTS.length).toBe(2);
    // A debt that named this bead as its owner would be the bead exempting itself, which is the
    // one shape a declared debt must never take.
    for (const d of DECLARED_COMPILER_DEBTS) {
      expect(d.owner).not.toBe("am-1nnj");
      expect(d.owner.startsWith("am-")).toBe(true);
      expect(d.reason.length).toBeGreaterThan(80);
    }
  });

  test("the ceilings and populations are the ones measured on 2026-10-09 at fa3c3aff", () => {
    const byRule = new Map(DECLARED_COMPILER_DEBTS.map((d) => [d.rule, d]));
    const live = byRule.get("live-term-unbound");
    const dangling = byRule.get("dangling-independent-reference");
    expect(live?.findings).toBe(49);
    expect(dangling?.findings).toBe(22);
    // 15 instruments each, which is a coincidence of the two measurements and not a shared list:
    // the two record sets differ, and an edit that made one a copy of the other would be caught.
    expect(live?.records.length).toBe(15);
    expect(dangling?.records.length).toBe(15);
    expect([...(live?.records ?? [])].sort()).not.toEqual([...(dangling?.records ?? [])].sort());
    expect(live?.records).toContain("sr-13");
    expect(dangling?.records).toContain("bm-03");
    // sr-13 carries six live-term findings and no dangling reference; bm-03 is the other way
    // round. Asserting the asymmetry pins the populations as measured rather than as guessed.
    expect(dangling?.records).not.toContain("sr-13");
    expect(live?.records).not.toContain("bm-03");
  });

  test("no record is declared twice within one debt, so a ceiling cannot be padded", () => {
    for (const d of DECLARED_COMPILER_DEBTS) {
      expect(new Set(d.records).size).toBe(d.records.length);
      expect(d.findings).toBeGreaterThanOrEqual(d.records.length);
    }
  });
});

describe("an absent population is DECLINED, not judged", () => {
  test("zero experiment manifests: nothing downgraded, no ceiling judged, and it says so", () => {
    // A fixture corpus with no manifests cannot produce either class, so reading that silence as
    // a paid debt would turn every correct small-corpus run red. This is the case that broke
    // verifyContent.test.ts's green control when the decline was missing.
    const out = applyCompilerDebts([], [debt()], 0);
    expect(out.errors).toEqual([]);
    expect(out.diagnostics).toEqual([]);
    expect(out.census.length).toBe(1);
    expect(out.census[0]).toContain("DECLINED");
    expect(out.census[0]).toContain("0 experiment manifests");
  });

  test("a declined run does not downgrade a finding either, so it cannot be used as an exemption", () => {
    const out = applyCompilerDebts([diagnostic("live-term-unbound", "sr-13")], [debt()], 0);
    expect(errorsOf(out.diagnostics).length).toBe(1);
    expect(flagsOf(out.diagnostics)).toEqual([]);
  });

  test("ONE manifest is enough to judge: the decline fires at zero and nowhere else", () => {
    // The boundary matters. If the decline triggered on any small number it would be a silent
    // exemption for every partial run, which is the shape this whole module guards against.
    const out = applyCompilerDebts([], [debt()], 1);
    expect(out.errors.filter((e) => e.startsWith("stale-compiler-debt")).length).toBe(1);
  });
});
