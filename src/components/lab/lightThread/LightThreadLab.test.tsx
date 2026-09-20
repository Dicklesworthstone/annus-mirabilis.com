import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LIGHT_THREAD_QUANTITIES } from "../../../experiments/lightThread/definition.ts";
import { LightThreadLab } from "./LightThreadLab.tsx";

test("SSR retains every quantity, the model boundaries, and the primary-source exits", () => {
  const html = renderToStaticMarkup(<LightThreadLab />);
  for (const id of Object.keys(LIGHT_THREAD_QUANTITIES)) {
    assert.ok(html.includes(`data-quantity-id="${id}"`), id);
  }
  for (const href of ["/papers/light-quanta/#s6", "/papers/special-relativity/#s8", "/papers/mass-energy/", "/lab/me-01", "/lab/me-02"]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.ok(html.includes("Ideal model, host calculation"));
  assert.ok(html.includes("zero invariant mass"));
  assert.ok(html.includes("does not require quanta"));
  assert.ok(html.includes("<noscript>"));
  assert.ok(html.includes("<fieldset disabled="));
  assert.ok(html.includes("lt=1"));
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Infinity"));
  assert.ok(!html.includes("<canvas"));
});
