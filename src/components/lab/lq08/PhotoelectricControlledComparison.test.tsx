import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { LQ08_PRESETS } from "../../../experiments/lq08/definition.ts";
import { createLq08Session, type PreparedLq08Example } from "../../../experiments/lq08/session.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../../experiments/predict/predictPersistence.ts";
import prepared from "../../../generated/lq08-example.json";
import catalogue from "../../../generated/lq08-notebook-replay.json";
import { getNotebookStore } from "../../../reader/notebook/browserStore.ts";
import { replayEnvironment } from "../../../reader/notebook/replayCurrent.ts";
import { mountReplayView } from "../../../reader/notebook/replayView.ts";
import { installDom, uninstallDom } from "../../../testing/reactDom.ts";
import { PhotoelectricLab } from "./PhotoelectricLab.tsx";

const example = prepared as PreparedLq08Example;
let host: HTMLElement;
let root: Root | null = null;
let owner: ReturnType<typeof createLq08Session>;
let inspection: ReturnType<typeof mountReplayView> | null = null;
const savedIds: string[] = [];

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  installPredictPersistence(REMEMBERS_NOTHING);
  host = document.createElement("div");
  document.body.append(host);
  owner = createLq08Session("comparison-main-bench", example);
});

afterEach(async () => {
  inspection?.dispose();
  inspection = null;
  for (const id of savedIds.splice(0)) getNotebookStore().remove(id);
  await act(async () => root?.unmount());
  root = null;
  owner.disconnect();
  host.remove();
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function required<T extends Element = HTMLElement>(selector: string, scope: ParentNode = host): T {
  const element = scope.querySelector<T>(selector);
  assert.ok(element, "The mounted apparatus must contain " + selector);
  return element;
}

function button(label: string, scope: ParentNode = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === label,
  );
  assert.ok(found, "The mounted apparatus must offer " + label);
  return found;
}

async function click(label: string, scope: ParentNode = host) {
  await act(async () => button(label, scope).click());
}

async function mount(predict = false) {
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <StrictMode>
        <PhotoelectricLab
          example={example}
          session={owner}
          predict={predict}
          linked={false}
          readings={false}
        />
      </StrictMode>,
    );
  });
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Handlers = {
  onChange(event: { target: Control; currentTarget: Control }): void;
  onBlur?(event: { target: Control; currentTarget: Control }): void;
};

function handlers(control: Control): Handlers {
  const key =
    Object.keys(control).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(required("input")).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The real mounted control must have React handlers.");
  const props = (control as unknown as Record<string, Handlers>)[key];
  assert.ok(props);
  return props;
}

async function change(selector: string, value: string) {
  const control = required<Control>(selector);
  const props = handlers(control);
  await act(async () => {
    control.value = value;
    props.onChange({ target: control, currentTarget: control });
  });
}

async function submit() {
  const form = required<HTMLFormElement>('form[aria-label="Controlled photoelectric settings"]');
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "The reader's explicit notebook action must finish.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}

const inputRow = (id: string) => required('[data-comparison-input="' + id + '"]');
const outputRow = (id: string) => required('[data-comparison-output="' + id + '"]');
const columns = (row: Element) => [...row.querySelectorAll("td")].map((cell) => cell.textContent);

test("server rendering keeps the worked apparatus and offers no live comparison before opt-in", () => {
  host.innerHTML = renderToStaticMarkup(
    <PhotoelectricLab example={example} session={owner} linked={false} readings={false} />,
  );
  expect(host.textContent).toContain("JavaScript is off");
  expect(host.textContent).toContain("Values at these settings");
  expect(required('[data-output="quantumEnergy"]').textContent).toContain("eV");
  expect(host.querySelector("[data-photoelectric-comparison]")).toBeNull();
  const offer = required("[data-photoelectric-comparison-offer]");
  expect(offer.closest('[data-predict-response="awaiting"]')).not.toBeNull();
  expect(button("Pin accepted settings for comparison").disabled).toBe(true);
});

test("the existing predict-first gate must reveal before an explicit comparison can open", async () => {
  await mount(true);
  const accepted = owner.getSnapshot().accepted;
  expect(button("Pin accepted settings for comparison").disabled).toBe(true);
  await click("Pin accepted settings for comparison");
  expect(host.querySelector("[data-photoelectric-comparison]")).toBeNull();
  expect(owner.getSnapshot().accepted).toBe(accepted);
  await click("Skip prediction");
  expect(button("Pin accepted settings for comparison").disabled).toBe(false);
  await click("Pin accepted settings for comparison");
  const comparison = required("[data-photoelectric-comparison]");
  expect(comparison.closest('[data-predict-response="shown"]')).not.toBeNull();
  expect(comparison.textContent).toContain("No input has changed");
  expect(comparison.textContent).toContain("Ideal model, host calculation");
  expect(comparison.textContent).not.toContain("calculated when this site was built");
  expect(required("[data-comparison-results]").getAttribute("data-baseline-run-id")).toBe(
    required("[data-comparison-results]").getAttribute("data-variant-run-id"),
  );
});

test("pinning excludes refused drafts and later main-bench changes leave the comparison intact", async () => {
  await mount();
  const selector = 'input[type="text"][id$="-frequency"]';
  await change(selector, "not a frequency");
  const control = required<HTMLInputElement>(selector);
  const onBlur = handlers(control).onBlur;
  assert.ok(onBlur);
  await act(async () => onBlur({ target: control, currentTarget: control }));
  expect(host.textContent).toContain("enter a number");
  await click("Pin accepted settings for comparison");
  expect(columns(inputRow("frequency")).slice(1, 3)).toEqual(["600", "600"]);
  const pinned = required("[data-comparison-results]").getAttribute("data-baseline-snapshot");
  await act(async () => {
    owner.apply({ frequency: 8e14 });
  });
  expect(owner.getSnapshot().accepted?.parameters.frequency).toBe(8e14);
  expect(columns(inputRow("frequency")).slice(1, 3)).toEqual(["600", "600"]);
  expect(required("[data-comparison-results]").getAttribute("data-baseline-snapshot")).toBe(pinned);
  await change('input[name="comparison-value"]', "2");
  await submit();
  expect(columns(inputRow("incidentPower")).slice(1, 3)).toEqual(["1", "2"]);
  expect(owner.getSnapshot().accepted?.parameters.incidentPower).toBe(0.001);
});

test("one-input comparisons lock the other controls, retain refused results and permit explicit repinning", async () => {
  await mount();
  await click("Pin accepted settings for comparison");
  await change('input[name="comparison-value"]', "2");
  await submit();
  expect(required<HTMLSelectElement>('select[name="comparison-input"]').disabled).toBe(true);
  expect(required("[data-comparison-ratio]", outputRow("quantumEnergy")).textContent).toBe("1");
  expect(required("[data-comparison-ratio]", outputRow("emissionRate")).textContent).toBe("2");
  expect(required("[data-comparison-ratio]", outputRow("photocurrent")).textContent).toBe("2");
  await click("Pin current variant as new baseline");
  expect(required<HTMLSelectElement>('select[name="comparison-input"]').disabled).toBe(false);
  expect(columns(inputRow("incidentPower")).slice(1, 3)).toEqual(["2", "2"]);
  await change('select[name="comparison-input"]', "frequency");
  await change('input[name="comparison-value"]', "800");
  await submit();
  expect(columns(inputRow("frequency")).slice(1, 3)).toEqual(["600", "800"]);
  expect(required("[data-comparison-ratio]", outputRow("quantumRate")).textContent).toBe("0.75");
  const version = required("[data-comparison-results]").getAttribute("data-variant-snapshot");
  await change('input[name="comparison-value"]', "0");
  await submit();
  const refusal = required("[data-photoelectric-comparison] [role=alert]");
  expect(refusal.textContent).toBeTruthy();
  expect(required('input[name="comparison-value"]').getAttribute("aria-invalid")).toBe("true");
  expect(required('input[name="comparison-value"]').getAttribute("aria-describedby")).toBe(
    refusal.id,
  );
  expect(required("[data-comparison-results]").getAttribute("data-variant-snapshot")).toBe(version);
  expect(columns(inputRow("frequency")).slice(1, 3)).toEqual(["600", "800"]);
  await click("Return variant to pinned baseline");
  expect(columns(inputRow("frequency")).slice(1, 3)).toEqual(["600", "600"]);
  expect(required<HTMLSelectElement>('select[name="comparison-input"]').disabled).toBe(false);
});

test("below-threshold comparisons retain unavailable energies and genuine zero rates", async () => {
  owner.apply(LQ08_PRESETS.subThreshold.parameters);
  await mount();
  await click("Pin accepted settings for comparison");
  await change('input[name="comparison-value"]', "10");
  await submit();
  expect(
    outputRow("maxKineticEnergy").querySelectorAll('[data-result-status="not-applicable"]'),
  ).toHaveLength(2);
  expect(
    outputRow("stoppingPotentialMagnitude").querySelectorAll(
      '[data-result-status="not-applicable"]',
    ),
  ).toHaveLength(2);
  expect(outputRow("stoppingPotentialMagnitude").textContent).toContain("no emitted electron");
  expect(outputRow("photocurrent").querySelectorAll('[data-result-status="value"]')).toHaveLength(
    2,
  );
  expect(required("[data-comparison-ratio]", outputRow("photocurrent")).textContent).toContain(
    "baseline is zero",
  );
});

test("retarding-collector comparisons show the owner's undetermined current instead of a fabricated zero", async () => {
  owner.apply({ collectorPotential: -0.1 });
  await mount();
  await click("Pin accepted settings for comparison");
  await change('input[name="comparison-value"]', "2");
  await submit();
  expect(
    outputRow("photocurrent").querySelectorAll('[data-result-status="underdetermined"]'),
  ).toHaveLength(2);
  expect(outputRow("photocurrent").textContent).toContain("energy");
  expect(required("[data-comparison-ratio]", outputRow("photocurrent")).textContent).toContain(
    "finite numeric values",
  );
  expect(columns(inputRow("collectorPotential")).slice(1, 3)).toEqual(["−0.1", "−0.1"]);
});

test("the reader saves the accepted comparison and original prediction, then explicitly replays it without a Worker", async () => {
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: undefined });
  try {
    await mount();
    await click("Pin accepted settings for comparison");
    await change('select[name="comparison-prediction"]', "same");
    await change('input[name="comparison-value"]', "2");
    await submit();
    await change('select[name="comparison-prediction"]', "larger");
    await change('textarea[id$="-before"]', "I expect brighter light to deliver more quanta.");
    await change('textarea[id$="-after"]', "The rate doubled; energy per quantum stayed the same.");
    await change('textarea[id$="-notes"]', "Private <script>photoelectric-notes</script>");
    const store = getNotebookStore();
    const oldIds = new Set(store.getSnapshot().document.entries.map((entry) => entry.id));
    await click("Save this comparison and my explanation");
    await until(() => store.getSnapshot().document.entries.some((entry) => !oldIds.has(entry.id)));
    const entry = store.getSnapshot().document.entries.find((item) => !oldIds.has(item.id));
    assert.ok(entry?.kind === "replay");
    savedIds.push(entry.id);
    expect(entry.replay.kind).toBe("lq08-comparison");
    expect(entry.replay.passage).toEqual(catalogue.passages["arg-lq-photoelectric-energy"]);
    expect(entry.frame.paper).toBe("light-quanta");
    expect(entry.replay.baseline.parameters.incidentPower).toBe(0.001);
    expect(entry.replay.variant.parameters.incidentPower).toBe(0.002);
    expect(entry.replay.tape.predictions?.[0]?.payload).toEqual({ candidateId: "same" });
    expect(entry.replay.explanationAfter).toBe(
      "The rate doubled; energy per quantum stayed the same.",
    );
    expect(entry.text).toBe("Private <script>photoelectric-notes</script>");
    const notebook = document.createElement("div");
    host.append(notebook);
    inspection = mountReplayView(notebook, entry, store, replayEnvironment(entry.replay));
    const again = button("Run the saved comparison again", notebook);
    await until(() => !again.disabled);
    expect(notebook.querySelector("script")).toBeNull();
    expect(notebook.querySelectorAll("table")).toHaveLength(1);
    await click("Run the saved comparison again", notebook);
    await until(
      () =>
        notebook.querySelector<HTMLElement>("[data-fresh-replay]")?.dataset.phase === "complete",
    );
    expect(notebook.querySelectorAll("table")).toHaveLength(2);
    expect(store.getSnapshot().document.entries.find((item) => item.id === entry.id)).toEqual(
      entry,
    );
  } finally {
    if (previousWorker) Object.defineProperty(globalThis, "Worker", previousWorker);
    else Reflect.deleteProperty(globalThis, "Worker");
  }
});
