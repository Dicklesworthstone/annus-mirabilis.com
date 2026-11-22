import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import Bm03ClarificationView from "../../experiments/views/bm03View.tsx";
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
    "/papers/brownian-motion/s2/?open=instrument-view#s2-p8-s1",
  );
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});
function faces(id: string) {
  return (["german", "english"] as const).map((face) => {
    const span = document.createElement("span");
    span.className = face === "german" ? "source-sentence" : "translation-unit";
    span.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
    span.setAttribute("aria-describedby", "prior-note");
    span.textContent = id;
    main.prepend(span);
    return span;
  });
}
function button(label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  assert.ok(found, label);
  return found;
}
function change(input: HTMLInputElement, value: string) {
  const key = Object.keys(input).find((name) => name.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key]
    : undefined;
  assert.ok(props?.onChange);
  input.value = value;
  props.onChange({ target: input, currentTarget: input });
}
function cleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("prior-note");
  }
}

test("the reader uses accepted BM03 evidence, respects predictions, and clears refused source highlights", async () => {
  const pressure = faces("s2-p8-s1"),
    locked = faces("s2-p5-s2");
  const common = faces("s2-p7-s1"),
    range = faces("s2-p7-s2");
  const all = [...pressure, ...locked, ...common, ...range];
  await act(async () =>
    root?.render(
      <Bm03ClarificationView instanceId="osmotic-reader" mode={null} presentation="standard" />,
    ),
  );
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel);
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  await act(async () => {
    panel.open = true;
    panel.dispatchEvent(new Event("toggle"));
  });
  cleared(all);
  await act(async () => button("Skip prediction").click());
  for (const node of pressure)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  cleared(locked);
  await act(async () => button("Locked cluster (counterexample)").click());
  cleared(pressure);
  for (const node of locked)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  expect(panel.querySelector('[data-weave-context="model"]')?.textContent).toContain(
    "one freely placed rigid cluster",
  );
  const input = host.querySelector<HTMLInputElement>('input[name="Np"]');
  assert.ok(input);
  await act(async () => change(input, "0"));
  expect(panel.querySelector('[data-weave-context="Np"]')?.textContent).toContain("2");
  const form = input.closest("form");
  assert.ok(form);
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  cleared(all);
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  await act(async () => button("One million particles (logarithmic evaluation)").click());
  expect(
    panel.querySelector('[data-weave-row="bm03-s2-logarithmic-range"]')?.textContent,
  ).toContain("number format");
  for (const node of range)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("outside-selected-domain");
  cleared(locked);
  await act(async () => {
    panel.open = false;
    panel.dispatchEvent(new Event("toggle"));
  });
  cleared(all);
  expect(all.map((node) => node.textContent)).toEqual([
    "s2-p8-s1",
    "s2-p8-s1",
    "s2-p5-s2",
    "s2-p5-s2",
    "s2-p7-s1",
    "s2-p7-s1",
    "s2-p7-s2",
    "s2-p7-s2",
  ]);
});
