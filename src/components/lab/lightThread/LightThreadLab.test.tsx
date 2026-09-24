import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LIGHT_THREAD_QUANTITIES } from "../../../experiments/lightThread/definition.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import { LightThreadLab } from "./LightThreadLab.tsx";

test("SSR retains every quantity, the model boundaries, and the primary-source exits", () => {
  const html = renderToStaticMarkup(<LightThreadLab />);
  for (const id of Object.keys(LIGHT_THREAD_QUANTITIES)) {
    assert.ok(html.includes(`data-quantity-id="${id}"`), id);
  }
  for (const href of [
    "/papers/light-quanta/#s6",
    "/papers/special-relativity/#s8",
    "/papers/mass-energy/",
    "/lab/me-01",
    "/lab/me-02",
  ]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  // The label is derived (am-inst-execution-labels-5ywv); until 5a97f929 it was the hard-coded badge
  // "Ideal model, host calculation". Without the page's source digest no label is earned.
  assert.ok(!html.includes('data-execution-label="host"'));
  assert.ok(!html.includes('data-execution-label="static"'));
  assert.ok(html.includes("zero invariant mass"));
  assert.ok(html.includes("does not require quanta"));
  assert.ok(html.includes("<noscript>"));
  assert.ok(html.includes("<fieldset disabled="));
  assert.ok(html.includes("lt=1"));
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Infinity"));
  assert.ok(!html.includes("<canvas"));
});

test("with the page's source digest, the build-time example earns the static label", () => {
  const html = renderToStaticMarkup(<LightThreadLab sourceDigest={labDigests["light-thread"]} />);
  assert.ok(html.includes('data-execution-label="static"'));
  assert.ok(html.includes("Static worked example"));
  assert.ok(!html.includes('data-execution-label="host"'));
});
