import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { srFieldTransformDerivations } from "../equations/derivations/srFieldTransforms.ts";
import { SRFieldDerivation } from "./SRFieldDerivation.tsx";

test("the section six reader exposes every operator, component, normalization step and source return before hydration", () => {
  const html = renderToStaticMarkup(<SRFieldDerivation />);
  assert.ok(html.includes('id="sr-field-derivation"'));
  assert.ok(html.includes('data-argument-id="arg-sr-field-components"'));
  assert.ok(html.includes('data-historical-status="source-order-reconstruction"'));
  assert.ok(html.includes('data-review="draft"'));
  assert.ok(html.includes('data-is-move="true"'));
  for (const chain of srFieldTransformDerivations) {
    assert.ok(html.includes(`data-derivation-chain="${chain.id}"`), chain.id);
    for (const step of chain.steps) {
      assert.ok(html.includes(`data-step-id="${step.id}"`), step.id);
      assert.ok(html.includes(`id="${step.sourceAnchor}"`), step.sourceAnchor);
      assert.ok(step.tool);
      assert.ok(html.includes(`/foundations/${step.tool.replace("foundation:", "")}/`), step.tool);
    }
  }
  for (const component of ["X", "Y", "Z", "L", "M", "N"])
    assert.ok(html.includes(`data-field-component="${component}"`));
  const returnedSources = [
    ...html.matchAll(/href="\/papers\/special-relativity\/view\/german\/#([a-z0-9-]+)"/g),
  ].map((match) => {
    assert.ok(match[1]);
    return match[1];
  });
  assert.ok(returnedSources.length > 0);
  for (const id of returnedSources)
    assert.ok(
      readFileSync(
        new URL(`../../content/source-blocks/special-relativity/${id}.yaml`, import.meta.url),
        "utf8",
      ).includes(`id: "${id}"`),
      id,
    );
  for (const id of [
    "eq-s6-d1",
    "eq-s6-d2",
    "eq-s6-d4",
    "eq-s6-d5",
    "eq-s6-d6",
    "eq-s6-d7",
    "eq-s6-d8",
    "eq-s6-d9",
    "s6-fn1",
  ])
    assert.ok(returnedSources.includes(id), id);
  assert.ok(html.includes('href="/lab/sr-02/"'));
});

test("Gaussian source math and the separate modern SI mapping render without placeholders or raw speech commands", () => {
  const html = renderToStaticMarkup(<SRFieldDerivation />);
  assert.ok(html.includes("<math"));
  assert.ok(html.includes("<mfrac>"));
  assert.ok(!html.includes("katex-error"));
  assert.ok(!html.includes('class="math-fallback"'));
  assert.ok(!html.includes("\\dots"));
  assert.ok(!/aria-label="[^"]*\\(?:partial|gamma|beta|xi)/.test(html));
  assert.ok(html.includes("partial derivative with respect to τ"));
  assert.ok(html.includes('data-unit-system="si"'));
  assert.ok(html.includes("Form invariance alone does not prove uniqueness."));
  assert.ok(html.includes("zero electric divergence"));
  assert.ok(html.includes("zero magnetic divergence"));
  assert.ok(html.includes("positive square root"));
  assert.ok(html.includes("same fields"));
  assert.ok(html.includes("q in Gaussian units = q in SI units divided by a"));
  assert.ok(html.includes("unit conversions, not just renamed letters"));
  assert.ok(!html.includes("—"));
});

test("source-order reasoning remains available in modern perspective with every-step detail and historical context", () => {
  const html = renderToStaticMarkup(<SRFieldDerivation activeDetail="2" perspective="modern" />);
  assert.ok(html.includes('data-detail="1" hidden=""'));
  assert.ok(!/data-detail="2" hidden=""/.test(html));
  assert.ok(html.includes('data-reading="3"'));
  assert.ok(html.includes("pp. 907–910"));
  assert.ok(html.includes("Show every step here"));
  assert.ok(html.includes("not a uniqueness theorem"));
  for (const chain of srFieldTransformDerivations)
    assert.ok(html.includes(`data-derivation-chain="${chain.id}"`));
});
