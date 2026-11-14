import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { RodSimultaneityLab } from "../../components/lab/RodSimultaneityLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import type { PreparedSr03Example } from "../../experiments/sr03/session.ts";
import Sr03ClarificationView from "../../experiments/views/sr03View.tsx";
import example from "../../generated/sr03-example.json";
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
  node.textContent = "Unchanged " + face + " sentence " + id;
  main.prepend(node);
  return node;
}

async function disclose(panel: HTMLDetailsElement, open: boolean) {
  await act(async () => {
    panel.open = open;
    panel.dispatchEvent(new Event("toggle"));
  });
}

test("the real rod reader view gates its pointers, distinguishes platform marks, and clears a refused comparison", async () => {
  window.history.replaceState(
    null,
    "",
    "/papers/special-relativity/s2/?open=instrument-view#s2-p8",
  );
  const simultaneity = [sentence("s2-p8-s1", "german"), sentence("s2-p8-s1", "english")];
  const rod = [sentence("s2-p2-s5", "german"), sentence("s2-p2-s5", "english")];
  const sphere = [sentence("s4-p1-s4", "german"), sentence("s4-p1-s4", "english")];
  const nodes = [...simultaneity, ...rod, ...sphere];
  const originalText = nodes.map((node) => node.textContent);
  await act(async () =>
    root?.render(
      <Sr03ClarificationView instanceId="reader-rod" mode={null} presentation="standard" />,
    ),
  );
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel);
  expect(
    panel.closest("[data-predict-response]")?.getAttribute("data-predict-response"),
  ).toBe("awaiting");
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
  for (const node of [...simultaneity, ...sphere]) {
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  }
  for (const node of rod) expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
  expect(
    panel.querySelector('[data-weave-row="sr03-s4-rod-measurement"] [data-weave-lit="true"]'),
  ).toBeNull();
  expect(panel.querySelector('[data-weave-context="endpointPairId"]')?.textContent).toContain(
    "marks simultaneous in K",
  );
  const measurement = host.querySelector('[data-output="measuredLength"]')?.textContent;
  expect(measurement).toBeTruthy();

  // The local typed-number refusal happens before the session issues a request. Its kept
  // calculation must not keep pointing while the form says 1.5c.
  const input = host.querySelector<HTMLInputElement>('input[type="number"][id$="-v"]');
  assert.ok(input);
  // Happy DOM does not dispatch React's synthetic onChange for text inputs. Use the installed
  // handler, as the laboratory's existing form integration tests do.
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange(event: unknown): void }>)[key]
    : undefined;
  assert.ok(props);
  await act(async () => {
    input.value = "1.5";
    props.onChange({ target: input, currentTarget: input });
  });
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  expect(panel.querySelector('[data-weave-lit="true"]')).toBeNull();
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(nodes.map((node) => node.textContent)).toEqual(originalText);
  for (const node of nodes) {
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
  }
  expect(host.querySelector('[data-refusal-code="superluminal-observer"]')).not.toBeNull();
  // Refused form values never replace the last accepted measurement, and source links remain.
  expect(host.querySelector('[data-output="measuredLength"]')?.textContent).toBe(measurement);
  expect(panel.querySelector("[data-weave-context]")).toBeNull();
  expect(panel.querySelector('a[href*="#s2-p8-s1"]')).not.toBeNull();
});

test("the no-script rod laboratory retains prepared source and translation links", () => {
  const html = renderToStaticMarkup(
    <RodSimultaneityLab example={example as PreparedSr03Example} />,
  );
  expect(html).toContain('data-result-weave="special-relativity"');
  expect(html).toContain("Prepared worked example");
  for (const sentenceId of ["s2-p8-s1", "s2-p2-s5", "s4-p1-s4"]) {
    expect(html).toContain("/view/german/#" + sentenceId);
    expect(html).toContain("/view/english/#" + sentenceId);
  }
});
