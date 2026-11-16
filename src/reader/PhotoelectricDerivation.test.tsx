import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { photoelectricChain } from "../equations/derivations/lightQuantaPhotoelectric.ts";
import { PhotoelectricDerivation } from "./PhotoelectricDerivation.tsx";

test("photoelectric steps, math and source returns are available without JavaScript", () => {
  const html = renderToStaticMarkup(<PhotoelectricDerivation activeDetail="2" />);
  assert.ok(html.includes('id="lq-photoelectric-derivation"'));
  assert.ok(html.includes('data-argument-id="arg-lq-photoelectric-energy"'));
  assert.ok(html.includes("<math"));
  assert.ok(!html.includes("katex-error"));
  assert.ok(html.includes("<details"));
  const foundations = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const step of photoelectricChain.steps) {
    assert.ok(html.includes(`data-step-id="${step.id}"`));
    assert.ok(html.includes(`id="${step.sourceAnchor}"`));
    assert.ok(html.includes(`href="#${step.sourceAnchor}"`));
    const slug = step.tool?.replace("foundation:", "");
    assert.ok(slug && foundations.includes(slug));
    assert.ok(html.includes(`/foundations/${slug}/`));
  }
  for (const anchor of ["s8-p2", "s8-p3", "s8-fn2"]) {
    assert.ok(html.includes(`/papers/light-quanta/view/german/#${anchor}`));
    const source = readFileSync(`content/source-blocks/light-quanta/${anchor}.yaml`, "utf8");
    assert.ok(source.includes(`id: "${anchor}"`));
  }
});

test("the reader distinguishes a conditional equality, an energy bound and an emission threshold", () => {
  const html = renderToStaticMarkup(<PhotoelectricDerivation />);
  for (const wording of [
    "one whole quantum",
    "without additional losses",
    "upper bound",
    "Below threshold",
    "Exactly at threshold",
    "not guaranteed",
    "positive charge magnitude",
    "contact potentials",
    "Partial transfer",
    "absorption and yield",
    "Historical context and notation",
    "algebra checks this conditional",
    "collector apparatus",
  ])
    assert.ok(html.toLowerCase().includes(wording.toLowerCase()), wording);
  assert.ok(html.includes('href="/lab/lq-08/"'));
  assert.ok(!html.includes('<div hidden id="S:'));
});
