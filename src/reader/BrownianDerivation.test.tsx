import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  brownianEquilibriumDerivation,
  brownianKernelDerivation,
} from "../equations/derivations/brownianSource.ts";
import { BrownianDerivation } from "./BrownianDerivation.tsx";

test("Brownian section readers render all source steps, mathematics, moves and real source anchors", () => {
  const registry = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const [section, chain] of [
    ["s3", brownianEquilibriumDerivation],
    ["s4", brownianKernelDerivation],
  ] as const) {
    const html = renderToStaticMarkup(<BrownianDerivation section={section} />);
    assert.ok(html.includes('data-derivation-chain="' + chain.id + '"'));
    assert.ok(html.includes('data-review="draft"'));
    assert.ok(html.includes('data-historical-status="source-order-reconstruction"'));
    assert.ok(html.includes('data-is-move="true"'));
    assert.ok(html.includes("<math"));
    assert.ok(!html.includes("katex-error"));
    for (const step of chain.steps) {
      assert.ok(html.includes('data-step-id="' + step.id + '"'));
      assert.ok(html.includes('id="' + step.sourceAnchor + '"'));
      const slug = step.tool?.replace("foundation:", "");
      assert.ok(slug && registry.includes(slug), step.id);
      assert.ok(html.includes("/foundations/" + slug + "/"));
    }
    for (const match of html.matchAll(
      /href="\/papers\/brownian-motion\/view\/german\/#([^"]+)"/g,
    )) {
      const id = match[1];
      assert.ok(id);
      const source = readFileSync("content/source-blocks/brownian-motion/" + id + ".yaml", "utf8");
      assert.ok(source.includes('id: "' + id + '"'), id);
    }
    for (const match of html.matchAll(/aria-label="([^"]*)"/g)) {
      assert.ok(!match[1]?.includes("\\"), match[1]);
      assert.ok(!match[1]?.includes("eq-model-"), match[1]);
    }
    assert.ok(html.includes("Historical context and notation"));
  }
});

test("§3 supplies the variational premise, zero-gradient exception and Stokes model conditions", () => {
  const html = renderToStaticMarkup(<BrownianDerivation section="s3" activeDetail="2" />);
  assert.ok(html.includes('id="bm-equilibrium-derivation"'));
  assert.ok(html.includes('data-argument-id="arg-bm-diffusivity"'));
  assert.ok(html.includes("Where the thermodynamic starting equation comes from"));
  assert.ok(html.includes("boundary term is zero"));
  assert.ok(html.includes("0/0"));
  assert.ok(html.includes("Newtonian liquid"));
  assert.ok(html.includes('href="/lab/bm-04/"'));
  assert.ok(html.includes('data-detail="1" hidden=""'));
  assert.ok(!/data-detail="2" hidden=""/.test(html));
});

test("§4 shows whole-line moments, the source sign convention and the qualified continuum transition", () => {
  const html = renderToStaticMarkup(<BrownianDerivation section="s4" />);
  assert.ok(html.includes('id="bm-source-diffusion-derivation"'));
  assert.ok(html.includes('data-argument-id="arg-bm-diffusion-equation"'));
  assert.ok(html.includes("∞"));
  assert.ok(html.includes("≈"));
  assert.ok(html.includes("Why the source writes a plus sign"));
  assert.ok(html.includes("biased kernel"));
  assert.ok(html.includes("fourth moment"));
  assert.ok(html.includes("arbitrarily short physical times"));
  assert.ok(html.includes('href="#arg-bm-independent-steps"'));
  assert.ok(html.includes('href="/lab/bm-03/"'));
  assert.ok(!html.includes("partialt"));
  assert.ok(!html.includes("partialx"));
});
