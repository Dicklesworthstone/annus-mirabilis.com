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
 * The two that remain are `expand`, whose step is authored-unverified so it credits nothing, and
 * `independent-zero-mean-product-vanishes`, whose n-step generalisation is not a structural
 * rewrite.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as fixtures from "../fixtures.ts";
import { parseDerivationChain } from "../schema.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { DerivationChain } from "../types.ts";
import { getRule } from "./index.ts";

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
  // expand: returns pass for any from/to once the shape is a power of a sum.
  "chain-bm-variance-of-sum/bm-variance-expand",
  // independent-zero-mean-product-vanishes: the n-step generalisation of a mean square, which is
  // not a structural rewrite of its input and is left declared rather than half-checked.
  "chain-bm-pedagogical-variance/bm-ped-step-3",
];

/**
 * The subset that is also credited `verified`. Separated because the two facts have
 * different weights: a blind check under an `authored-unverified` step overstates nothing,
 * since the step already says a person has not been replaced by a machine here.
 */
const BLIND_AND_CREDITED_VERIFIED: readonly string[] = [
  "chain-bm-pedagogical-variance/bm-ped-step-3",
];

/** 32 today, 27 before the four repairs. A floor, so a harness that examined nothing cannot read
 * as clean, and it rises with the debt that is paid. */
const CAUGHT_FLOOR = 30;

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
      "monotonic-function",
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
    expect([...new Set(blind.map((b) => b.identity))].sort()).toEqual([
      "expand",
      "registered-identity:independent-zero-mean-product-vanishes",
    ]);
    // And the four that were repaired are asserted to be CAUGHT now, by name, so a regression in
    // any one of them reddens this file rather than quietly rejoining the blind list.
    const caughtIdentities = new Set(caughtNow().map((c) => c.identity));
    for (const id of [
      "registered-identity:kernel-normalization",
      "registered-identity:odd-moments-symmetric-kernel",
      "registered-identity:spatial-isotropy",
      "registered-identity:linearity-of-average",
    ]) {
      expect(caughtIdentities.has(id), `${id} should catch a wrong result`).toBe(true);
    }
  });
});
