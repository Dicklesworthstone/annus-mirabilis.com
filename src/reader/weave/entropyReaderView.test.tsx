import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { EntropyWorkbenchLab } from "../../components/lab/lq04/EntropyWorkbenchLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import Lq04ClarificationView from "../../experiments/views/lq04View.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";

const VOLUME = "lq04-s4-volume-law";
const LIMIT = "lq04-s4-wien-validity-limit";
const DERIVATIVE = "lq04-s3-derivative-check";
let root: Root | null = null;
let main: HTMLElement;
let host: HTMLElement;

beforeEach(async () => {
  await installDom();
  installPredictPersistence(REMEMBERS_NOTHING);
  main = document.createElement("main");
  host = document.createElement("div");
  main.append(host);
  document.body.append(main);
  root = createRoot(host);
  window.history.replaceState(null, "", "/papers/light-quanta/view/parallel/#s4-p5-s1");
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function sentence(id: string, face: "german" | "english" = "german") {
  const node = document.createElement("span");
  node.className = face === "german" ? "source-sentence" : "translation-unit";
  node.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
  node.setAttribute("aria-describedby", "existing-source-note");
  node.textContent = `Unchanged ${face} sentence ${id}`;
  main.prepend(node);
  return node;
}

async function disclose(panel: HTMLDetailsElement, open: boolean) {
  await act(async () => {
    panel.open = open;
    panel.dispatchEvent(new Event("toggle"));
  });
}

async function mount(element: ReactNode) {
  await act(async () => root?.render(element));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The entropy workbench must expose its accepted session's source pointers");
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain(
    "Prepared worked example",
  );
  expect(panel.querySelector("[data-weave-inactive]")).toBeNull();
  // The prepared comparison stays in the no-script HTML. Even opening its hidden disclosure
  // must not annotate the paper or announce an answer while the optional prediction is waiting.
  await disclose(panel, true);
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  const skip = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Skip prediction",
  );
  assert.ok(skip, "The reader must be able to reveal the comparison without a prediction");
  await act(async () => skip.click());
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "shown",
  );
  return panel;
}

function lit(id: string) {
  return host.querySelector(`[data-weave-row="${id}"] [data-weave-lit="true"]`) !== null;
}

function expectCleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.hasAttribute("data-live-weave-meaning")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
  }
}

async function draftInput(suffix: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`);
  assert.ok(input);
  // Happy DOM does not dispatch React's synthetic input change. Use the installed handler,
  // as the existing laboratory integration tests do, then submit the actual form below.
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange(event: unknown): void }>)[key]
    : undefined;
  assert.ok(props);
  await act(async () => {
    input.value = value;
    props.onChange({ target: input, currentTarget: input });
  });
}

async function draftRatio(value: string) {
  await draftInput("ratio", value);
}

async function applyRatio() {
  const form = host.querySelector("form");
  assert.ok(form);
  await act(async () =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

test("the real reader dialog follows accepted volume changes and identifies loss of validity", async () => {
  const volume = [sentence("s4-p5-s1"), sentence("s4-p5-s1", "english")];
  const limit = [sentence("s4-p1-s3"), sentence("s4-p1-s3", "english")];
  const derivative = [sentence("s3-p4-s3"), sentence("s3-p4-s3", "english")];
  const empirical = sentence("s4-p1-s2");
  const nodes = [...volume, ...limit, ...derivative, empirical];
  const originalText = nodes.map((node) => node.textContent);
  // Production clarification dialogs are siblings of main, not children of the source article.
  const dialog = document.createElement("dialog");
  dialog.append(host);
  document.body.append(dialog);
  dialog.showModal();
  const panel = await mount(
    <Lq04ClarificationView
      instanceId="entropy-reader-dialog"
      mode={null}
      presentation="standard"
    />,
  );
  expect(panel.closest("main")).toBeNull();
  expect(lit(VOLUME)).toBe(true);
  expect(lit(LIMIT)).toBe(false);
  expect(lit(DERIVATIVE)).toBe(true);
  for (const node of volume)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  for (const node of derivative)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("agreement-within-stated-bound");
  expectCleared([...limit, empirical]);
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");

  await draftRatio("0.0001");
  expect(lit(VOLUME)).toBe(true);
  expect(lit(DERIVATIVE)).toBe(true);
  expect(host.querySelector('[data-weave-context="volumeRatio"]')?.textContent).toContain("1");
  await applyRatio();
  expect(lit(VOLUME)).toBe(false);
  expect(lit(LIMIT)).toBe(true);
  expect(lit(DERIVATIVE)).toBe(false);
  expectCleared([...volume, ...derivative, empirical]);
  for (const node of limit)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("outside-selected-domain");
  expect(panel.querySelector('[role="status"]')?.textContent).toContain("cannot give an entropy");
  expect(host.querySelector('[data-weave-context="volumeRatio"]')?.textContent).toContain("0.0001");

  await draftRatio("2");
  await applyRatio();
  expect(lit(VOLUME)).toBe(true);
  expect(lit(LIMIT)).toBe(false);
  expect(lit(DERIVATIVE)).toBe(true);
  expectCleared([...limit, empirical]);
  expect(nodes.map((node) => node.textContent)).toEqual(originalText);
  await disclose(panel, false);
  expectCleared(nodes);
  await disclose(panel, true);
  expect(volume[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
  await act(async () => root?.unmount());
  root = null;
  expectCleared(nodes);
  dialog.close();
});

test("invalid input hides old pointers and the reader never annotates an unrelated paper", async () => {
  const volume = sentence("s4-p5-s1");
  const limit = sentence("s4-p1-s3");
  const derivative = sentence("s3-p4-s3");
  const panel = await mount(
    <Lq04ClarificationView
      instanceId="entropy-reader-refusal"
      mode={null}
      presentation="standard"
    />,
  );
  await draftRatio("0");
  await applyRatio();
  expect(host.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  expect(host.querySelector('[data-weave-lit="true"]')).toBeNull();
  expectCleared([volume, limit, derivative]);
  await draftRatio("0.5");
  await applyRatio();
  expect(lit(VOLUME)).toBe(true);
  expect(lit(DERIVATIVE)).toBe(true);
  expect(volume.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");

  await disclose(panel, false);
  window.history.replaceState(null, "", "/papers/special-relativity/view/german/#s4-p5-s1");
  await disclose(panel, true);
  expect(lit(VOLUME)).toBe(true);
  expectCleared([volume, limit, derivative]);
});

test("standalone and no-script entropy examples expose canonical source links without page marks", async () => {
  const node = sentence("s4-p5-s1");
  await mount(<EntropyWorkbenchLab instanceId="entropy-standalone" restoreFromLocation={false} />);
  expect(lit(VOLUME)).toBe(true);
  expectCleared([node]);
  const html = renderToStaticMarkup(
    <EntropyWorkbenchLab instanceId="entropy-static" restoreFromLocation={false} />,
  );
  for (const id of ["s4-p5-s1", "s4-p1-s3", "s3-p4-s3"])
    for (const face of ["german", "english"])
      expect(html).toContain(`/papers/light-quanta/view/${face}/#${id}`);
  expect(html).toContain('data-weave-predicate="lq04-s4-volume-law"');
  expect(html).toContain('data-weave-predicate="lq04-s3-derivative-check"');
  expect(html).toContain("Prepared worked example");
  expect(html).not.toContain('data-weave-inactive="refused"');
  expect(html).toContain('data-predict-response="awaiting"');
  expect(html).toContain("Entropy density slope at fixed frequency");
  expect(html).toContain("Inverse temperature 1/T");
});

test("a local slope boundary keeps the volume result and explains which comparison is unavailable", async () => {
  const volume = sentence("s4-p5-s1");
  const derivative = sentence("s3-p4-s3");
  await mount(
    <Lq04ClarificationView
      instanceId="entropy-reader-slope-boundary"
      mode={null}
      presentation="standard"
    />,
  );
  await draftRatio("2");
  await draftInput("xmin", "9.59845");
  expect(lit(DERIVATIVE)).toBe(true);
  await applyRatio();
  expect(lit(VOLUME)).toBe(true);
  expect(lit(LIMIT)).toBe(false);
  expect(lit(DERIVATIVE)).toBe(false);
  expect(volume.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  expectCleared([derivative]);
  const unavailable = host.querySelector('[data-entropy-slope-unavailable="initial"]');
  expect(unavailable?.textContent).toContain("higher-density slope probe");
  expect(unavailable?.getAttribute("rowspan")).toBe("4");
  expect(host.querySelector('[data-entropy-slope-unavailable="final"]')).toBeNull();
  expect(host.querySelector("[data-entropy-slope-method]")?.textContent).toContain(
    "holds frequency and volume fixed",
  );
  await draftInput("xmin", String(Math.log(100)));
  await applyRatio();
  expect(lit(DERIVATIVE)).toBe(true);
  expect(host.querySelector("[data-entropy-slope-unavailable]")).toBeNull();
});
