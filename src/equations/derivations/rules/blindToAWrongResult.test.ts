/**
 * Which rule checks cannot tell a step's result from the step's own input?
 *
 * `verifyChain` credits a step as machine-`verified` when its rule check returns `pass`, and
 * several checks in this library return `pass` on the way out of a structural test they did
 * not satisfy. `registeredIdentity`'s `linearity-of-average` branch tests the shape and then
 * returns `pass` whether or not the shape matched; four identity ids
 * (`odd-moments-symmetric-kernel`, `cosh-sinh-identity`, `spatial-isotropy`,
 * `velocity-addition`) return `pass` unconditionally; and `kernel-normalization` returns
 * `pass` for any sum or relation.
 *
 * The instrument is the cheapest plant there is: re-run each passing step's own rule with
 * `to` replaced by `from`. A result equal to the step's input is certainly not the step's
 * result, so a check that still says `pass` is not reading the transformation at all.
 *
 * Measured 2026-10-14 over all 19 chains (17 fixtures plus the one content chain). When this file
 * was written: 34 steps passed their rule, 27 caught the planted wrong result, 7 did not, and five
 * of those 7 declared `verification: verified`. Later the same day four of the seven were given
 * real structural checks (am-1lds), and the figures are now 34 passing, 32 caught, 2 blind, 1 of
 * them credited `verified`.
 *
 * This file does not repair a check; it names the debt by identity so that a NEW step authored
 * under a blind identity, or a check that becomes blind, fails here instead of arriving silently.
 * NONE REMAIN as of 2026-10-14. The last two left by different repairs: `expand`'s five-seed
 * equivalence check passes an unchanged step, because an expansion is an identity, so the rule now
 * refuses a result equal to its own input; and `independent-zero-mean-product-vanishes` applied to
 * one side of an equation is checked by the other side holding, the rewritten side changing, and
 * the declared subexpression leaving it.
 *
 * An empty list is the strong form of this file's claim, and it is not the same as "the physics is
 * verified". Each check's residue is asserted in registeredIdentity.test.ts, in the same test as
 * its licensed shape.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as fixtures from "../fixtures.ts";
import { parseDerivationChain } from "../schema.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { DerivationChain } from "../types.ts";
import { getRule, ruleLibrary } from "./index.ts";

/**
 * `chainId/stepId` for every passing step whose rule cannot see a wrong result.
 *
 * Seven when this ratchet was written, two since the four repairs of 2026-10-14. The five that
 * left are kept in the comment rather than in the list, because which identities were blind is
 * the history this file exists to carry: bm-ped-step-2 and bm-variance-average under
 * linearity-of-average, bm-src-step-3 under kernel-normalization, bm-src-step-4 under
 * odd-moments-symmetric-kernel, and sr-ped-step-4 under spatial-isotropy.
 */
const BLIND_SITES: readonly string[] = [
  // EMPTY since 2026-10-14, and an empty list is the strong form of this assertion: any step whose
  // rule cannot see a wrong result fails here, by name, with nothing to compare it against.
  //
  // The seven that were here: bm-variance-expand under `expand`; bm-ped-step-2 and
  // bm-variance-average under `linearity-of-average`; bm-src-step-3 under `kernel-normalization`;
  // bm-src-step-4 under `odd-moments-symmetric-kernel`; sr-ped-step-4 under `spatial-isotropy`;
  // and bm-ped-step-3 under `independent-zero-mean-product-vanishes`, the last to go and the one
  // whose check is weakest, since the n-step generalisation of a mean square is not a structural
  // rewrite. Each check's residue is asserted in registeredIdentity.test.ts: "catches a wrong
  // result" is not "verifies the physics", and the difference is written down per identity.
];

/**
 * The subset that is also credited `verified`. Separated because the two facts have
 * different weights: a blind check under an `authored-unverified` step overstates nothing,
 * since the step already says a person has not been replaced by a machine here.
 */
const BLIND_AND_CREDITED_VERIFIED: readonly string[] = [];

/** 34 today, 27 before the repairs of 2026-10-14. A floor, so a harness that examined nothing
 * cannot read as clean, and it rises with the debt that is paid. */
const CAUGHT_FLOOR = 33;

function allChains(): readonly DerivationChain[] {
  const chains = Object.values(fixtures).filter(
    (v): v is DerivationChain =>
      typeof v === "object" && v !== null && "steps" in v && "target" in v && "proofRouteId" in v,
  );
  const record = JSON.parse(
    readFileSync("content/equations/derivations/bm-variance.yaml", "utf-8"),
  ) as { chain: unknown };
  return [...chains, parseDerivationChain(record.chain)];
}

type Site = { id: string; declared: string; identity: string };

function survey(): { blind: Site[]; caught: Site[]; voidPlants: string[] } {
  const blind: Site[] = [];
  const caught: Site[] = [];
  const voidPlants: string[] = [];
  for (const chain of allChains()) {
    for (const step of chain.steps) {
      const rule = getRule(step.rule.kind);
      if (!rule) continue;
      // `changed` is the step's own declaration, which the substitution checks read. Omitting it
      // here would measure a path no record takes: an instrument has to drive what verifyChain
      // drives, or its verdict is about the instrument.
      const asAuthored = rule.check({
        from: step.from,
        to: step.to,
        params: step.rule.params,
        changed: step.changedSubexpressionIds,
      });
      if (asAuthored.outcome !== "pass") continue;
      const id = `${chain.id}/${step.id}`;
      // The plant must be a CHANGE, or its verdict says nothing about the check.
      if (structurallyEqual(step.from, step.to)) {
        voidPlants.push(id);
        continue;
      }
      const identity =
        typeof step.rule.params?.identityId === "string"
          ? `${step.rule.kind}:${step.rule.params.identityId}`
          : step.rule.kind;
      const planted = rule.check({
        from: step.from,
        to: step.from,
        params: step.rule.params,
        changed: step.changedSubexpressionIds,
      });
      const site: Site = { id, declared: step.verification.status, identity };
      if (planted.outcome === "pass") blind.push(site);
      else caught.push(site);
    }
  }
  return { blind, caught, voidPlants };
}

const caughtNow = (): readonly Site[] => survey().caught;

describe("rule checks measured against a result equal to the step's own input", () => {
  test("no step is its own result, so every plant below is a real change", () => {
    // A step whose authored `to` already equals its `from` would make the plant a no-op and
    // its pass meaningless. None exist; if one is authored, this names it rather than
    // letting it inflate the caught column.
    expect(survey().voidPlants).toEqual([]);
  });

  test("the checks that DO read the transformation catch the planted wrong result", () => {
    const { caught } = survey();
    // The positive control: without this, a library where nothing could fail would produce
    // the same empty blind set as a library where everything is checked.
    expect(caught.length).toBeGreaterThanOrEqual(CAUGHT_FLOOR);
    const kinds = [...new Set(caught.map((c) => c.identity))].sort();
    expect(kinds).toEqual([
      // expand catches it since 2026-10-14: an expansion that changed nothing is refused, which
      // the five-seed equivalence check could never see.
      "expand",
      "monotonic-function",
      "registered-identity:independent-zero-mean-product-vanishes",
      // The four repaired on 2026-10-14 (am-1lds), which used to sit in the blind list.
      "registered-identity:kernel-normalization",
      "registered-identity:linearity-of-average",
      "registered-identity:odd-moments-symmetric-kernel",
      "registered-identity:spatial-isotropy",
      "substitute",
    ]);
  });

  test("the blind sites are exactly the declared ones, by identity and not by count", () => {
    const { blind } = survey();
    expect(blind.map((b) => b.id).sort()).toEqual([...BLIND_SITES].sort());
  });

  test("the blind sites credited `verified` are exactly the declared ones", () => {
    const { blind } = survey();
    const credited = blind.filter((b) => b.declared === "verified").map((b) => b.id);
    expect(credited.sort()).toEqual([...BLIND_AND_CREDITED_VERIFIED].sort());
    // Every entry of the smaller list is in the bigger one: the two are a subset relation,
    // not two hand-maintained lists that can drift apart.
    for (const id of BLIND_AND_CREDITED_VERIFIED) expect(BLIND_SITES).toContain(id);
  });

  test("the blind identities are named, so a new step under one of them is not a surprise", () => {
    const { blind } = survey();
    expect([...new Set(blind.map((b) => b.identity))].sort()).toEqual([]);
    // And the four that were repaired are asserted to be CAUGHT now, by name, so a regression in
    // any one of them reddens this file rather than quietly rejoining the blind list.
    const caughtIdentities = new Set(caughtNow().map((c) => c.identity));
    for (const id of [
      "expand",
      "registered-identity:independent-zero-mean-product-vanishes",
      "registered-identity:kernel-normalization",
      "registered-identity:odd-moments-symmetric-kernel",
      "registered-identity:spatial-isotropy",
      "registered-identity:linearity-of-average",
    ]) {
      expect(caughtIdentities.has(id), `${id} should catch a wrong result`).toBe(true);
    }
  });
});

/**
 * EVERY RULE IN THE LIBRARY, NOT ONLY THE ONES A CHAIN USES.
 *
 * The survey above walks the 19 chains' 41 steps, so it can only ask a rule whether it reads its
 * transformation once somebody has authored a step against it. Measured 2026-10-16, 0 of those 41
 * steps used `add-subtract-multiply-divide`, and that rule was blind: both branches of its final
 * comparison returned `pass`, under a comment saying the first should return `unverifiable`. The
 * one unexercised check in the library was the one that was broken, which is the shape AGENTS.md
 * calls an absent class that cannot fail a present loop.
 *
 * So each rule is probed directly here, with a call built to satisfy its own preconditions, and
 * the plant is the same one the survey uses: a `to` equal to `from`. A result equal to the step's
 * input is certainly not the step's result, so `pass` means the check is not reading it.
 *
 * `unverifiable` is NOT blindness. Three rules answer that way by design -- integrate, differentiate
 * and a registered identity whose licensed shape this generic input does not match -- and
 * verifyChain refuses a step that declares `verified` on an unverifiable outcome, so nothing is
 * certified by them.
 *
 * EVERY RULE MUST HAVE A PROBE. The last assertion is what keeps this honest: a rule added without
 * one fails here, rather than being skipped and leaving the next blind check to be found by
 * whoever first authors a step against it.
 */
type Probe = Readonly<{ from: unknown; params: unknown }>;

const sym = (termId: string) => ({ kind: "symbol", termId, quantityId: "q" }) as const;
const relation = (left: unknown, right: unknown) =>
  ({ kind: "relation", operator: "=", left, right }) as const;
const PROBE_FROM_RELATION = relation(sym("a"), sym("b"));
const PROBE_FROM_SUM = { kind: "sum", args: [sym("a"), sym("b")] } as const;

/** One precondition-satisfying call per rule, so the probe reaches the transformation check. */
const PROBES: Readonly<Record<string, Probe>> = {
  substitute: {
    from: PROBE_FROM_RELATION,
    params: { targetId: "a", replacement: sym("c"), citedEquality: "a = c by definition" },
  },
  "cancel-common-factor": {
    from: PROBE_FROM_RELATION,
    params: { factor: sym("k"), nonzeroCondition: "k > 0" },
  },
  "monotonic-function": {
    from: PROBE_FROM_RELATION,
    params: {
      function: "square-root",
      domain: "nonnegative",
      branch: "positive",
      branchCondition: "a distance is nonnegative",
    },
  },
  integrate: {
    from: PROBE_FROM_RELATION,
    params: { variable: "x", boundaryCondition: "vanishes at infinity" },
  },
  "truncate-series": {
    from: PROBE_FROM_SUM,
    params: { order: 2, variable: "x", justification: "small x" },
  },
  "registered-identity": {
    from: PROBE_FROM_SUM,
    params: { identityId: "linearity-of-average", premises: ["linearity"] },
  },
  expand: { from: PROBE_FROM_SUM, params: {} },
  collect: { from: PROBE_FROM_SUM, params: { termIds: ["a"] } },
  factor: { from: PROBE_FROM_SUM, params: { factor: sym("k") } },
  reorder: { from: PROBE_FROM_SUM, params: { justification: "commutativity" } },
  "add-subtract-multiply-divide": {
    from: PROBE_FROM_RELATION,
    params: { operation: "divide", quantity: sym("t"), nonzeroCondition: "t > 0" },
  },
  differentiate: { from: PROBE_FROM_RELATION, params: { variable: "x" } },
  "take-limit": {
    from: PROBE_FROM_RELATION,
    params: { variable: "v", to: "0", justification: "low speed" },
  },
  "evaluate-numerical-instance": {
    from: PROBE_FROM_RELATION,
    params: { bindings: { a: 1 }, tolerance: 1e-9 },
  },
};

describe("every rule in the library is measured, not only the ones a chain uses", () => {
  test("a rule with no probe fails here rather than being skipped", () => {
    const missing = ruleLibrary.map((r) => r.kind).filter((kind) => PROBES[kind] === undefined);
    expect(missing).toEqual([]);
    // The denominator, so a library read as empty cannot pass this file.
    expect(ruleLibrary.length).toBeGreaterThanOrEqual(14);
  });

  test("no rule returns pass for a result equal to its own input", () => {
    const blind: string[] = [];
    const verdicts: string[] = [];
    for (const rule of ruleLibrary) {
      const probe = PROBES[rule.kind];
      if (!probe) continue;
      const outcome = rule.check({
        from: probe.from as never,
        to: probe.from as never,
        params: probe.params as never,
        changed: [],
      }).outcome;
      verdicts.push(`${rule.kind}=${outcome}`);
      if (outcome === "pass") blind.push(rule.kind);
    }
    console.log(`[library blindness] ${verdicts.length} rules probed: ${verdicts.join(", ")}`);
    expect(blind).toEqual([]);
  });
});
