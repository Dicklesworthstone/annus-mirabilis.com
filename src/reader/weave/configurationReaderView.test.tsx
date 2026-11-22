import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { IndependentConfigurationsLab } from "../../components/lab/lq05/IndependentConfigurationsLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import Lq05ClarificationView from "../../experiments/views/lq05View.tsx";
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
  window.history.replaceState(null, "", "/papers/light-quanta/s5/?open=instrument-view#s5-p8-s1");
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function faces(id: string) {
  return (["german", "english"] as const).map((face) => {
    const node = document.createElement("span");
    node.className = face === "german" ? "source-sentence" : "translation-unit";
    node.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
    node.setAttribute("aria-describedby", "original-source-note");
    node.textContent = face + " source " + id;
    main.prepend(node);
    return node;
  });
}

function cleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("original-source-note");
  }
}

function compared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  }
}

function change(input: HTMLInputElement, value: string) {
  // Exercise React's installed handler, matching the existing input tests under Happy DOM.
  const key = Object.keys(input).find((name) => name.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key]
    : undefined;
  assert.ok(props?.onChange);
  input.value = value;
  props.onChange({ target: input, currentTarget: input });
}

test("the reader follows the accepted independence model, gates predictions, and clears refused pointers", async () => {
  const independent = faces("s5-p8-s1");
  const locked = faces("s5-p7-s2");
  const common = [...faces("s5-p6-s3"), ...faces("s5-p3-s4")];
  const all = [...independent, ...locked, ...common];
  const text = all.map((node) => node.textContent);
  await act(async () =>
    root?.render(
      <Lq05ClarificationView
        instanceId="configuration-reader"
        mode={null}
        presentation="standard"
      />,
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
  const skip = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Skip prediction",
  );
  assert.ok(skip);
  await act(async () => skip.click());
  compared([...independent, ...common]);
  cleared(locked);

  const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
  assert.ok(checkbox);
  await act(async () => checkbox.click());
  compared([...locked, ...common]);
  cleared(independent);
  expect(panel.textContent).toContain("removes that premise");
  expect(panel.querySelector('[data-weave-context="locked"]')?.textContent).toContain(
    "one shared, locked position",
  );
  expect(panel.querySelector('[data-weave-row="lq05-s5-independent-probability"]')).toBeNull();

  const input = host.querySelector<HTMLInputElement>('input[type="number"][id$="-n"]');
  assert.ok(input);
  await act(async () => change(input, "0"));
  // Typing is only a draft; it neither resamples nor relabels the accepted result.
  expect(panel.querySelector('[data-weave-context="n"]')?.textContent).toContain("4");
  compared([...locked, ...common]);
  const form = input.closest("form");
  assert.ok(form);
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  cleared(all);

  await act(async () => change(input, "10"));
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  compared([...locked, ...common]);
  expect(panel.querySelector('[data-weave-context="n"]')?.textContent).toContain("10");
  await act(async () => {
    panel.open = false;
    panel.dispatchEvent(new Event("toggle"));
  });
  cleared(all);
  expect(all.map((node) => node.textContent)).toEqual(text);
});

test("source links are available in the standalone worked example without JavaScript", () => {
  const html = renderToStaticMarkup(<IndependentConfigurationsLab restoreFromLocation={false} />);
  expect(html).toContain('data-result-weave="light-quanta"');
  for (const id of ["s5-p8-s1", "s5-p6-s3", "s5-p3-s4"]) {
    expect(html).toContain("/view/german/#" + id);
    expect(html).toContain("/view/english/#" + id);
  }
  expect(html).not.toContain("e+308");
});
