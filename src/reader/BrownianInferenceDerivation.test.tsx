import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { brownianInferenceChain } from "../equations/derivations/brownianInference.ts";
import { BrownianInferenceDerivation } from "./BrownianInferenceDerivation.tsx";

test("the inference reader renders every checked step with real source and foundation links", () => {
  const html = renderToStaticMarkup(<BrownianInferenceDerivation />);
  assert.ok(html.includes('id="bm-molecular-number-derivation"'));
  assert.ok(html.includes('data-argument-id="arg-bm-inference"'));
  assert.ok(html.includes('data-historical-status="pedagogical-reconstruction"'));
  assert.ok(html.includes("<math"));
  assert.ok(!html.includes("katex-error"));
  assert.ok(html.includes('data-is-move="true"'));
  const registry = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const step of brownianInferenceChain.steps) {
    assert.ok(html.includes('data-step-id="' + step.id + '"'));
    assert.ok(html.includes('id="' + step.sourceAnchor + '"'));
    assert.ok(html.includes('href="#' + step.sourceAnchor + '"'));
    const slug = step.tool?.replace("foundation:", "");
    assert.ok(slug && registry.includes(slug));
    assert.ok(html.includes("/foundations/" + slug + "/"));
  }
  for (const anchor of ["s5-p3", "s5-p4"]) {
    assert.ok(html.includes('href="/papers/brownian-motion/view/german/#' + anchor + '"'));
    const source = readFileSync("content/source-blocks/brownian-motion/" + anchor + ".yaml", "utf8");
    assert.ok(source.includes('id: "' + anchor + '"'));
  }
});

test("the inference labels sample fitting, identifiability and statistical limits without script", () => {
  const html = renderToStaticMarkup(<BrownianInferenceDerivation activeDetail="2" />);
  for (const text of [
    "population average",
    "observed mean square",
    "method-of-moments definition",
    "independently",
    "Gaussian integral",
    "Doubling the radius",
    "all-zero observed mean square",
    "unbiased estimate",
    "not independent evidence",
    "defined exactly",
    "Historical context and notation",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('href="/lab/bm-07/"'));
  assert.ok(html.includes("<details"));
  assert.ok(!html.includes('<div hidden id="S:'));
  assert.ok(!/data-detail="2" hidden=""/.test(html));
});
