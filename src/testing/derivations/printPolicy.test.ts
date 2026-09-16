import assert from "node:assert/strict";
import test from "node:test";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
} from "../../equations/derivations/fixtures.ts";
import { printPolicyFor } from "../../equations/derivations/hooks.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";

test("printPolicyFor: source-order default is expanded", () => {
  const result = printPolicyFor(fixtureBrownianSourceOrder);
  assert.equal(result.layout, "expanded");
  assert.equal(result.routeLabel, "Original 1905 Derivation");
  assert.ok(result.chainTitle?.includes("chain-bm-source-diffusion-equation"));
});

test("printPolicyFor: pedagogical-reconstruction default is collapsed", () => {
  const result = printPolicyFor(fixtureBrownianPedagogicalReconstruction);
  assert.equal(result.layout, "collapsed");
  assert.equal(result.routeLabel, "Step-by-Step Reconstruction");
  assert.ok(result.chainTitle?.includes("chain-bm-pedagogical-variance"));
});

test("printPolicyFor: essentialForPrint override takes precedence", () => {
  // Pedagogical reconstruction with essentialForPrint: true -> expanded
  const pedExpanded: DerivationChain = {
    ...fixtureBrownianPedagogicalReconstruction,
    essentialForPrint: true,
  };
  const res1 = printPolicyFor(pedExpanded);
  assert.equal(res1.layout, "expanded");

  // Source-order with essentialForPrint: false -> collapsed
  const srcCollapsed: DerivationChain = {
    ...fixtureBrownianSourceOrder,
    essentialForPrint: false,
  };
  const res2 = printPolicyFor(srcCollapsed);
  assert.equal(res2.layout, "collapsed");
});
