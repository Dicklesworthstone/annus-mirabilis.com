/**
 * THE INFERENCE WORKBENCH'S REFUSAL CARRIES ITS CODE, NOT ONLY ITS SENTENCE (am-ig23).
 *
 * `mountInferenceWorkbench` flattened a typed refusal into a string and handed it to `announce`,
 * which writes a live region. That string was not simply a mistake, which is what makes this site
 * different from the component conversions on this bead: a live region genuinely takes text. What
 * was lost is the refusal's IDENTITY, so the repair publishes the code as an attribute beside the
 * announcement rather than passing a typed failure into `announce`.
 *
 * NOTHING DROVE THIS MODULE BEFORE. It is reached by a reader at /lab/what-can-you-infer/ through
 * FamilyWorkbench, and a search for its own selectors across every test file found none, so the
 * conversion would otherwise have been verified by a typecheck alone. That is the gap this bead
 * recorded against its first thirteen conversions.
 *
 * It needs no React: the module is a scoped enhancement over static markup, so the test renders the
 * real markup, mounts the real controller, and dispatches a real submit event. That also avoids the
 * `__reactProps$` trap that cost the BrownianInvestigation test its first run.
 *
 * THE NEGATIVE A WRONG IMPLEMENTATION FAILS: the assertion is on `data-refusal-code`, which the
 * pre-conversion module never wrote at all, while the announced SENTENCE is unchanged by the repair.
 * So a revert leaves the reader's text identical and turns this red.
 */

import { afterAll, beforeAll, expect, test } from "bun:test";
import generated from "../../generated/inference-workbench.json" with { type: "json" };
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { mountInferenceWorkbench } from "./browser.ts";
import { parseInferenceEvidence } from "./evidence.ts";
import { type InferenceExample, renderInferenceWorkbench } from "./render.ts";

const UID = "inference-test";

function firstExample(): InferenceExample {
  const raw = generated.examples[0];
  if (!raw) throw new Error("inference-workbench.json holds no example.");
  return {
    ideal: parseInferenceEvidence(raw.ideal),
    camera: parseInferenceEvidence(raw.camera),
    sourceDigest: generated.sourceDigest,
  };
}

beforeAll(async () => {
  await installDom();
});
afterAll(async () => {
  await uninstallDom();
});

function mount() {
  const example = firstExample();
  const host = document.createElement("div");
  host.innerHTML = renderInferenceWorkbench(example, UID);
  document.body.append(host);
  const root = host.querySelector<HTMLElement>("[data-infer-workbench]");
  if (!root) throw new Error("rendered markup has no [data-infer-workbench] root.");
  const dispose = mountInferenceWorkbench(root, example, UID);
  return { root, host, dispose };
}

function setField(root: HTMLElement, name: string, value: string) {
  const field = root.querySelector<HTMLInputElement>(`[data-radius-field][name="${name}"]`);
  if (!field) throw new Error(`no radius field named ${name}`);
  field.value = value;
}

test("an inadmissible radius interval is refused with a code on the case element", () => {
  const { root, host, dispose } = mount();
  try {
    const radiusCase = root.querySelector<HTMLElement>('[data-infer-case="radius"]');
    expect(radiusCase).not.toBeNull();
    // NON-VACUITY, both directions: the case must exist and must carry NO refusal yet, or the
    // assertions below could pass on a stale attribute from the markup itself.
    expect(radiusCase?.dataset.refusalCode).toBeUndefined();
    expect(radiusCase?.dataset.applyFailure).toBeUndefined();

    // Lower bound ABOVE the point value. validateRadius refuses exactly this with
    // "Radius bounds must contain the point value; coverage must not exceed one." The fields are
    // read in micrometres and per cent, which is why these are 0.9 and 97.5 rather than SI.
    setField(root, "radius", "0.5");
    setField(root, "radiusLower", "0.9");
    setField(root, "radiusUpper", "0.55");
    setField(root, "radiusCoverage", "97.5");
    setField(root, "provenance", "A synthetic interval for this test, not a calibration.");

    const form = root.querySelector<HTMLFormElement>("[data-radius-form]");
    expect(form).not.toBeNull();
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    // The identity the flattened string destroyed.
    expect(radiusCase?.dataset.applyFailure).toBe("refused");
    expect(radiusCase?.dataset.refusalCode).toBe("invalid-parameter");
    // And the reader still gets the sentence, so the code did not replace the explanation.
    const announced = radiusCase?.querySelector("[data-infer-error]")?.textContent ?? "";
    expect(announced).toContain("Radius bounds must contain the point value");
    expect(announced).toContain("The previous accepted result is unchanged.");
  } finally {
    dispose();
    host.remove();
  }
});

test("an admissible radius clears the refusal identity it set", () => {
  // The other half of the attribute's contract. Without this, a module that set the code and never
  // removed it would pass the test above and leave a stale refusal on screen after a good apply,
  // which is the "never display old numbers beneath new labels" failure in attribute form.
  const { root, host, dispose } = mount();
  try {
    const radiusCase = root.querySelector<HTMLElement>('[data-infer-case="radius"]');
    const form = root.querySelector<HTMLFormElement>("[data-radius-form]");

    setField(root, "radiusLower", "0.9");
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(radiusCase?.dataset.refusalCode).toBe("invalid-parameter");

    // The worked example's own interval, which validateRadius accepts.
    setField(root, "radius", "0.5");
    setField(root, "radiusLower", "0.45");
    setField(root, "radiusUpper", "0.55");
    setField(root, "radiusCoverage", "97.5");
    setField(root, "provenance", "A synthetic interval for this test, not a calibration.");
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(radiusCase?.dataset.applyFailure).toBeUndefined();
    expect(radiusCase?.dataset.refusalCode).toBeUndefined();
  } finally {
    dispose();
    host.remove();
  }
});
