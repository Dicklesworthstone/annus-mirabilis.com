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
 * Measured 2026-10-14 over all 19 chains (17 fixtures plus the one content chain): 34 steps
 * pass their rule, 27 of them catch the planted wrong result, and the 7 below do not. Five of
 * those 7 declare `verification: verified`, which is the part that matters -- that label means
 * machine-checked, and for those five nothing is checking.
 *
 * This file does NOT repair the checks. It names the debt by identity so that a NEW step
 * authored under a blind identity, or a check that becomes blind, fails here instead of
 * arriving silently. Repair is am-1lds: give the five identities a
 * real structural check, which also lets the five `verified` labels stand honestly.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as fixtures from "../fixtures.ts";
import { parseDerivationChain } from "../schema.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { DerivationChain } from "../types.ts";
import { getRule } from "./index.ts";

/** `chainId/stepId` for every passing step whose rule cannot see a wrong result. */
const BLIND_SITES: readonly string[] = [
  // expand: returns pass for any from/to once the shape is a power of a sum.
  "chain-bm-variance-of-sum/bm-variance-expand",
  // registered-identity, by identity id:
  "chain-bm-pedagogical-variance/bm-ped-step-2", // linearity-of-average
  "chain-bm-pedagogical-variance/bm-ped-step-3", // independent-zero-mean-product-vanishes
  "chain-bm-source-diffusion-equation/bm-src-step-3", // kernel-normalization
  "chain-bm-source-diffusion-equation/bm-src-step-4", // odd-moments-symmetric-kernel
  "chain-bm-variance-of-sum/bm-variance-average", // linearity-of-average
  "chain-sr-lorentz-boost-construction/sr-ped-step-4", // spatial-isotropy
];

/**
 * The subset that is also credited `verified`. Separated because the two facts have
 * different weights: a blind check under an `authored-unverified` step overstates nothing,
 * since the step already says a person has not been replaced by a machine here.
 */
const BLIND_AND_CREDITED_VERIFIED: readonly string[] = [
  "chain-bm-pedagogical-variance/bm-ped-step-2",
  "chain-bm-pedagogical-variance/bm-ped-step-3",
  "chain-bm-source-diffusion-equation/bm-src-step-3",
  "chain-bm-source-diffusion-equation/bm-src-step-4",
  "chain-sr-lorentz-boost-construction/sr-ped-step-4",
];

/** 27 today. A floor, so a harness that examined nothing could not read as clean. */
const CAUGHT_FLOOR = 20;

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
      const asAuthored = rule.check({ from: step.from, to: step.to, params: step.rule.params });
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
      const planted = rule.check({ from: step.from, to: step.from, params: step.rule.params });
      const site: Site = { id, declared: step.verification.status, identity };
      if (planted.outcome === "pass") blind.push(site);
      else caught.push(site);
    }
  }
  return { blind, caught, voidPlants };
}

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
    expect(kinds).toEqual(["monotonic-function", "substitute"]);
  });

  test("the blind sites are exactly the declared ones, by identity and not by count", () => {
    const { blind } = survey();
    expect(blind.map((b) => b.id).sort()).toEqual([...BLIND_SITES].sort());
  });

  test("the blind sites credited `verified` are exactly the declared five", () => {
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
      "registered-identity:kernel-normalization",
      "registered-identity:linearity-of-average",
      "registered-identity:odd-moments-symmetric-kernel",
      "registered-identity:spatial-isotropy",
    ]);
  });
});
