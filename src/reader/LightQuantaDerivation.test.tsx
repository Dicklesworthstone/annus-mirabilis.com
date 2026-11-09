import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  lqCoefficientCorrespondence,
  lqWienEntropyDerivation,
} from "../equations/derivations/lightQuantaEntropy.ts";
import { LightQuantaDerivation } from "./LightQuantaDerivation.tsx";

test("both LQ reader sections render complete readable mathematics, moves and working source/foundation anchors", () => {
  for (const [section, chain] of [
    ["s4", lqWienEntropyDerivation],
    ["s6", lqCoefficientCorrespondence],
  ] as const) {
    const html = renderToStaticMarkup(<LightQuantaDerivation section={section} />);
    assert.ok(html.includes(`data-derivation-chain="${chain.id}"`));
    assert.ok(html.includes('data-review="draft"'));
    assert.ok(html.includes('data-model-status="wien-approximation"'));
    assert.ok(html.includes('data-is-move="true"'));
    assert.ok(html.includes("<math"));
    assert.ok(!html.includes("katex-error"));
    for (const step of chain.steps) {
      assert.ok(html.includes(`data-step-id="${step.id}"`));
      assert.ok(html.includes(`id="${step.sourceAnchor}"`));
      assert.ok(html.includes(`/foundations/${step.tool?.replace("foundation:", "")}/`));
    }
    for (const match of html.matchAll(/aria-label="([^"]*)"/g)) {
      assert.ok(!match[1]?.includes("\\"), match[1]);
      assert.ok(!match[1]?.includes("eq-model-"), match[1]);
    }
    assert.ok(html.includes("Historical context and notation"));
  }
});

test("§4 exposes the boundary condition, held-fixed derivative and noncancelling constant", () => {
  const html = renderToStaticMarkup(<LightQuantaDerivation section="s4" activeDetail="2" />);
  assert.ok(html.includes('id="lq-wien-entropy-derivation"'));
  assert.ok(html.includes('href="/papers/light-quanta/view/german/#s3-p4"'));
  assert.ok(html.includes("Why the integration constant cannot just cancel"));
  assert.ok(html.includes("Moving reflecting"));
  assert.ok(html.includes("<msub>"));
  assert.ok(html.includes('data-detail="1" hidden=""'));
  assert.ok(!/data-detail="2" hidden=""/.test(html));
});

test("§6 keeps the heuristic scope, independence counterexample and equal-volume exception visible", () => {
  const html = renderToStaticMarkup(<LightQuantaDerivation section="s6" />);
  assert.ok(html.includes('id="lq-entropy-correspondence-derivation"'));
  assert.ok(html.includes('href="/papers/light-quanta/view/german/#s6-p6"'));
  assert.ok(html.includes("heuristic correspondence"));
  assert.ok(html.includes("cannot identify a coefficient"));
  assert.ok(html.includes("1/16"));
  assert.ok(html.includes("does not"));
  assert.ok(html.includes("round it"));
  assert.ok(html.includes('href="/lab/lq-05/"'));
});
