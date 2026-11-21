import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ElectronDynamicsLab } from "../../components/lab/sr13/ElectronDynamicsLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../../experiments/sr13/session.ts";
import Sr13ClarificationView from "../../experiments/views/sr13View.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";

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
  window.history.replaceState(
    null,
    "",
    "/papers/special-relativity/s10/?open=instrument-view#s10-p8-s1",
  );
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function sentence(id: string, face: "german" | "english") {
  const node = document.createElement("span");
  node.className = face === "german" ? "source-sentence" : "translation-unit";
  node.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
  node.setAttribute("aria-describedby", "existing-source-note");
  node.setAttribute("data-alignment-active", "true");
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

async function mount(view: ReactNode) {
  await act(async () => root?.render(view));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The production reader adapter must mount the existing session's weave");
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain(
    "Prepared worked example",
  );
  await disclose(panel, true);
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  const skip = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Skip prediction",
  );
  assert.ok(skip);
  await act(async () => skip.click());
  return panel;
}

async function typeField(suffix: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`);
  assert.ok(input);
  // Happy DOM does not dispatch React's synthetic onChange for number inputs. Exercise the
  // installed handler, as the laboratory's existing form tests do, without applying the draft.
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

async function submit() {
  const form = host.querySelector("form");
  assert.ok(form);
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function expectCleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
    expect(node.getAttribute("data-alignment-active")).toBe("true");
  }
}

test("electron reader pointers follow accepted speed and clear on refusal, closing, and unmount", async () => {
  const nodes = ["s10-p8-s1", "s10-p11-s1"].flatMap((id) => [
    sentence(id, "german"),
    sentence(id, "english"),
  ]);
  const unrelated = sentence("s10-p1-s1", "german");
  const original = nodes.map((node) => node.textContent);
  const panel = await mount(
    <Sr13ClarificationView instanceId="electron-reader" mode={null} presentation="standard" />,
  );
  const laboratory = host.querySelector('[data-instrument-id="sr-13"]');
  assert.ok(laboratory);
  for (const node of nodes)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  expectCleared([unrelated]);
  const runId = laboratory.getAttribute("data-run-id");
  await typeField("initialSpeed", "0.9");
  expect(panel.querySelector('[data-weave-context="initialSpeed"]')?.textContent).toContain(
    "0.6 c",
  );
  await submit();
  expect(panel.querySelector('[data-weave-context="initialSpeed"]')?.textContent).toContain(
    "0.9 c",
  );
  expect(laboratory.getAttribute("data-run-id")).not.toBe(runId);
  const keptEnergy = host.querySelector('[data-quantity-id="kineticEnergy"]')?.textContent;
  expect(keptEnergy).toBeTruthy();
  await typeField("initialSpeed", "1");
  await submit();
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  expect(panel.querySelector('[data-weave-lit="true"]')).toBeNull();
  expect(panel.querySelector("[data-weave-context]")).toBeNull();
  expect(host.querySelector('[data-quantity-id="kineticEnergy"]')?.textContent).toBe(keptEnergy);
  expectCleared(nodes);
  await typeField("initialSpeed", "0.6");
  await submit();
  expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
  await disclose(panel, false);
  expectCleared(nodes);
  await disclose(panel, true);
  expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
  await act(async () => root?.unmount());
  root = null;
  expectCleared(nodes);
  expect(nodes.map((node) => node.textContent)).toEqual(original);
});

test("the prepared electron lab includes both source faces without JavaScript", () => {
  const html = renderToStaticMarkup(<ElectronDynamicsLab example={DEFAULT_PREPARED_EXAMPLE} />);
  expect(html).toContain('data-result-weave="special-relativity"');
  expect(html).toContain("Prepared worked example");
  for (const id of ["s10-p8-s1", "s10-p11-s1"]) {
    expect(html).toContain(`/view/german/#${id}`);
    expect(html).toContain(`/view/english/#${id}`);
  }
});
