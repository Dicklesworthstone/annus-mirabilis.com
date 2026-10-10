/**
 * A COMPILER DIAGNOSTIC CLASS RECORDED AS A DEBT, SO THE POPULATION CAN WIDEN GREEN (am-1nnj).
 *
 * `scripts/verify-content.ts` compiled three of the thirty-three experiment manifests for eleven
 * days. The reason was not neglect, it was a deadlock, and the deadlock is worth stating because
 * this module exists only to break it:
 *
 *   - leave the population at three and `runKernelIdentifierCheck` is silent on thirty
 *     instruments, where a 0 from a check that opened three records reads exactly like a 0 from
 *     one that opened thirty-three;
 *   - widen it and the gate goes red for every pane on 71 findings that belong to two other beads,
 *     and the standing instruction is that the widening lands only when the count is zero.
 *
 * The count cannot reach zero by this bead's own work. Measured 2026-10-09 at fa3c3aff over all 33
 * manifests, the 71 are exactly two classes, and NEITHER is this bead's deliverable:
 *
 *     49  live-term-unbound              am-inst-show-the-code-4brv
 *     22  dangling-independent-reference am-ver-quantity-records-fby2
 *
 * and the three classes that WOULD be this bead's own (`undeclared-kernel-function`,
 * `unregistered-trace-scenario`, `instrument-declares-no-arguments`) are all at zero on the full
 * population. So the widening is blocked entirely by other people's debt, which is the case a
 * recorded ceiling is for: the population widens to 33, the two known classes become flags that
 * cannot grow, and the three clean classes become live errors on all 33 instruments immediately.
 *
 * WHAT THIS IS NOT. It is not an exemption in the sense AGENTS.md warns about, because it refuses
 * three different ways, and the middle one is the one a plain count would miss:
 *
 *   - MORE findings than recorded is an error. A ceiling is a debt, not a budget to draw on.
 *   - A finding against a record the debt does NOT name is an error even when the total is under
 *     the ceiling. Otherwise a debt paid down in one instrument silently funds a new finding in
 *     another, and the total never moves. That swap is invisible to every count-only ratchet, and
 *     it is the failure this module was shaped around.
 *   - ZERO findings for a declared class is an error, so a paid debt cannot outlive its reason.
 *
 * Under the ceiling is deliberately NOT an error: paying a debt down must never fail a build. It
 * prints instead, with the new number, because AGENTS.md's rule is that a ceiling comes down with
 * the debt and a baseline that only ever rises is a budget.
 */

import type { CompilerDiagnostic } from "../compiler/compiler.ts";

/** A diagnostic class recorded as a debt, with the records it was measured over. */
export type CompilerDebt = Readonly<{
  /** The diagnostic `code` this covers, which is the rule name the check reported. */
  rule: string;
  /** How many findings it was recorded for. More than this is an error. */
  findings: number;
  /**
   * The record ids it was measured over. A finding against anything else is an error, which is
   * what makes this a debt against a named population rather than a quota for a rule.
   */
  records: readonly string[];
  /** The bead that owns paying it down. Never this bead: a debt names its real owner. */
  owner: string;
  reason: string;
}>;

/**
 * The two classes standing between the 33-manifest population and a green gate.
 *
 * Both counts and both record lists were produced by `bun scripts/verify-content.ts
 * --all-instruments` on 2026-10-09 at fa3c3aff and are reproducible with that one command. Neither
 * is a judgement about whether the finding is worth fixing; both owners have that argument
 * recorded on their own beads, and in the `live-term-unbound` case the owning bead's analysis is
 * that most of the 49 cannot be bound honestly at all.
 */
export const DECLARED_COMPILER_DEBTS: readonly CompilerDebt[] = Object.freeze([
  Object.freeze({
    rule: "live-term-unbound",
    findings: 49,
    owner: "am-inst-show-the-code-4brv",
    reason:
      "A live term is a symbol of an equation bound to the instrument, while the rule demands an " +
      "identifier in the instrument's KERNEL, so an instrument that displays a subset of an " +
      "equation's quantities fails for the rest by construction. Measured exhaustively on " +
      "2026-10-06: not one of the 49 is among its own instrument's declared outputs, and several " +
      "cannot be bound without attaching a scalar quantity to a vector (sr-06) or a quantity to a " +
      "chain-rule derivative operator that merely shares its spelling (sr-07 dTau).",
    records: Object.freeze([
      "bm-04",
      "lq-02",
      "lq-03",
      "lq-05",
      "lq-06",
      "me-02",
      "me-03",
      "sr-03",
      "sr-04",
      "sr-05",
      "sr-06",
      "sr-07",
      "sr-10",
      "sr-11",
      "sr-13",
    ]),
  }),
  Object.freeze({
    rule: "dangling-independent-reference",
    findings: 22,
    owner: "am-ver-quantity-records-fby2",
    reason:
      "Every one resolves into content/verification/, which does not exist at all, so these are a " +
      "layer that was never created rather than 22 separate mistakes. Confirmed not reader-facing " +
      "today: ShowTheCode renders these as links, but it reads SLICE_KERNEL_CATALOG, whose " +
      "entries all declare independentReferences: [], and the 22 live in the manifests instead.",
    records: Object.freeze([
      "bm-03",
      "bm-04",
      "lq-03",
      "lq-04",
      "me-01",
      "me-02",
      "me-03",
      "sr-01",
      "sr-02",
      "sr-04",
      "sr-08",
      "sr-09",
      "sr-10",
      "sr-11",
      "sr-12",
    ]),
  }),
]);

export type CompilerDebtOutcome = Readonly<{
  /** Every diagnostic, with a covered one's severity rewritten to `flag`. None is dropped. */
  diagnostics: readonly CompilerDiagnostic[];
  /** Lines for the ceiling's own refusals, which are errors in their own right. */
  errors: readonly string[];
  /** One line per debt saying what it covers and what was actually found. Always printed. */
  census: readonly string[];
}>;

const recordOf = (diagnostic: CompilerDiagnostic): string =>
  diagnostic.recordId ?? diagnostic.file ?? "(no record id)";

/**
 * Downgrade the declared classes to flags, and refuse growth, an undeclared record, or a debt with
 * nothing left to cover.
 *
 * The diagnostics are returned in their original order and none is removed: a reader who has to
 * act on a flag needs to see it, and a count that replaced its own findings would be the thing
 * this module is guarding against.
 */
export function applyCompilerDebts(
  diagnostics: readonly CompilerDiagnostic[],
  debts: readonly CompilerDebt[] = DECLARED_COMPILER_DEBTS,
  /**
   * How many experiment manifests the corpus being judged actually held.
   *
   * ZERO MEANS DECLINE, NOT PASS, AND NOT STALE. Both declared classes are reported only by
   * `runKernelIdentifierCheck` over experiment manifests, so a corpus with none of them cannot
   * produce a finding, and reading that silence as "the debt is paid" would condemn a correct
   * fixture run. This is the same rule the compiler's `sourceBlockIndex` already follows: a check
   * that needs a population it was not given declines and says so, rather than judging the
   * absence. It defaults to 1, the strict direction, so a caller that forgets to say gets the
   * full check rather than a quiet exemption.
   */
  experimentsCompiled = 1,
): CompilerDebtOutcome {
  if (experimentsCompiled === 0) {
    return {
      diagnostics,
      errors: [],
      census: [
        "[compiler-debt] DECLINED: the corpus held 0 experiment manifests, so neither declared " +
          "debt could have produced a finding. Nothing is downgraded and no ceiling is judged.",
      ],
    };
  }
  const byRule = new Map(debts.map((debt) => [debt.rule, debt]));
  const covered = new Map<string, number>();
  const undeclared = new Map<string, Set<string>>();
  const out: CompilerDiagnostic[] = [];
  const errors: string[] = [];

  for (const diagnostic of diagnostics) {
    const debt = byRule.get(diagnostic.code);
    if (debt === undefined || diagnostic.severity !== "error") {
      out.push(diagnostic);
      continue;
    }
    const record = recordOf(diagnostic);
    if (!debt.records.includes(record)) {
      // A new record under a declared class. It stays an ERROR, and it is named separately so the
      // reason it is red is the swap and not the ceiling.
      let set = undeclared.get(debt.rule);
      if (set === undefined) {
        set = new Set<string>();
        undeclared.set(debt.rule, set);
      }
      set.add(record);
      out.push(diagnostic);
      continue;
    }
    covered.set(debt.rule, (covered.get(debt.rule) ?? 0) + 1);
    out.push({
      ...diagnostic,
      severity: "flag",
      message: `${diagnostic.message} [recorded as debt, ceiling ${debt.findings}, owner ${debt.owner}]`,
    });
  }

  const census: string[] = [];
  for (const debt of debts) {
    const actual = covered.get(debt.rule) ?? 0;
    const names = undeclared.get(debt.rule);
    census.push(
      `[compiler-debt] ${debt.rule}: ${actual} of a recorded ${debt.findings} over ` +
        `${debt.records.length} record(s), owner ${debt.owner}` +
        (names ? `; ${names.size} record(s) NOT covered: ${[...names].sort().join(", ")}` : ""),
    );
    if (names) {
      errors.push(
        `undeclared-debt-record: ${debt.rule}: ${[...names].sort().join(", ")}: this class is ` +
          `recorded as a debt over ${debt.records.length} named record(s) and these are not among ` +
          `them. A debt covers the findings it was measured over, not the rule in general, so a ` +
          `finding in a new record is red even while the total sits under the ceiling. Either fix ` +
          `it or re-measure the debt and say why it grew. Owner: ${debt.owner}`,
      );
    }
    if (actual === 0) {
      errors.push(
        `stale-compiler-debt: ${debt.rule}: recorded as a debt of ${debt.findings} finding(s) and ` +
          `the compiler now reports none. Delete the entry and this reason: ${debt.reason}`,
      );
      continue;
    }
    if (actual > debt.findings) {
      errors.push(
        `grown-compiler-debt: ${debt.rule}: recorded for ${debt.findings} finding(s) and now has ` +
          `${actual}. A ceiling records a debt, not a budget: account for the ` +
          `${actual - debt.findings} new finding(s) before raising the number. Owner: ${debt.owner}`,
      );
    } else if (actual < debt.findings) {
      census.push(
        `[compiler-debt] ${debt.rule} is DOWN from ${debt.findings} to ${actual}. Lower the ` +
          `ceiling to ${actual} in the same commit that paid it, or it becomes a budget.`,
      );
    }
  }

  return { diagnostics: out, errors, census };
}
