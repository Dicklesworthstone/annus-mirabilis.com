import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import Sr01ClarificationView from "../../experiments/views/sr01View.tsx";
import Sr04ClarificationView from "../../experiments/views/sr04View.tsx";
import { TestLogger } from "../../testing/log/logger.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { SR04_READER_WEAVE } from "./constructionPassages.ts";
import { SR01_READER_WEAVE } from "./synchronizationPassages.ts";

const log = new TestLogger("synchronization-construction-reader-views");
afterAll(() => log.flush());
let root: Root | null = null;
let main: HTMLElement;
let host: HTMLElement;

beforeEach(async () => {
  await installDom();
  installPredictPersistence(REMEMBERS_NOTHING);
  window.history.replaceState(null, "", "/papers/special-relativity/?open=instrument-view#s1-p7");
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

function passage(id: string) {
  return (["german", "english"] as const).map((face) => {
    const node = document.createElement("span");
    node.className = face === "german" ? "source-sentence" : "translation-unit";
    node.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
    node.setAttribute("aria-describedby", "existing-source-note");
    node.textContent = `Unchanged ${face} sentence ${id}`;
    main.prepend(node);
    return node;
  });
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
  assert.ok(panel, "The real reader adapter must show its accepted-result pointers");
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
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "shown",
  );
  return panel;
}

function cleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.hasAttribute("data-live-weave-meaning")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
  }
}

async function type(selector: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(selector);
  assert.ok(input);
  expect(input.labels?.length).toBeGreaterThan(0);
  // Happy DOM does not dispatch React's onChange for text controls. Use the installed handler
  // as the other laboratory integration tests do, retaining the real form's apply path.
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

test("the clock reader highlights both faces from accepted settings and withdraws them after a refused form", async () => {
  const definition = passage("s1-p7-s4");
  const criterion = passage("s1-p7-s6");
  const roundTrip = passage("s1-p10-s1");
  const movingPair = passage("s2-p8-s1");
  const nodes = [...definition, ...criterion, ...roundTrip, ...movingPair];
  const textBefore = nodes.map((node) => node.textContent);
  const panel = await mount(
    <Sr01ClarificationView instanceId="clock-weave-reader" mode={null} presentation="standard" />,
  );
  for (const node of [...definition, ...roundTrip]) {
    expect(node.getAttribute("data-live-weave-meaning")).toBe("assumption-active");
  }
  for (const node of [...criterion, ...movingPair]) {
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  }
  const snapshot = panel
    .querySelector("[data-weave-snapshot]")
    ?.getAttribute("data-weave-snapshot");
  await type('input[id^="offb-"]', "2");
  expect(panel.querySelector('[data-weave-context="clockOffsetB"]')?.textContent).toContain("0 s");
  expect(panel.querySelector("[data-weave-snapshot]")?.getAttribute("data-weave-snapshot")).toBe(
    snapshot,
  );
  await submit();
  expect(panel.querySelector('[data-weave-context="clockOffsetB"]')?.textContent).toContain("2 s");
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain("Accepted trial");
  expect(criterion[0]?.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");

  await type('input[id^="pairv-"]', "1.5");
  await submit();
  expect(host.querySelector("[data-refusal-code]")).not.toBeNull();
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  cleared(nodes);
  expect(panel.querySelectorAll("a[href*='/view/']").length).toBeGreaterThan(0);
  await type('input[id^="pairv-"]', "0");
  await submit();
  expect(movingPair[0]?.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  await disclose(panel, false);
  cleared(nodes);
  expect(nodes.map((node) => node.textContent)).toEqual(textBefore);
  log.info(
    "Clock definition, accepted offset, zero speed, refusal and disclosure cleanup exercised",
    {
      testId: "clock-reader",
      beadId: "am-read-result-weave-jex",
    },
  );
});

test("the map reader follows underdetermined and constructed publications without treating candidate discrepancies as agreement", async () => {
  const candidate = passage("s3-p15-s1");
  const unfixed = passage("s3-p21-s1");
  const constructed = passage("s3-p22-s10");
  const nodes = [...candidate, ...unfixed, ...constructed];
  const panel = await mount(
    <Sr04ClarificationView
      instanceId="construction-weave-reader"
      mode={null}
      presentation="standard"
    />,
  );
  expect(candidate[0]?.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  cleared([...unfixed, ...constructed]);
  const fieldset = [...host.querySelectorAll("fieldset")].find((field) =>
    field.querySelector("legend")?.textContent?.startsWith("Enabled constraints"),
  );
  assert.ok(fieldset);
  const boxes = [...fieldset.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  expect(boxes.length).toBeGreaterThan(0);
  await act(async () => boxes[0]?.click());
  expect(unfixed[0]?.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  cleared([...candidate, ...constructed]);
  for (const box of boxes.slice(1)) await act(async () => box.click());
  expect(constructed[0]?.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  cleared([...candidate, ...unfixed]);
  expect(panel.textContent).toContain("transverse scale requires the separate");
  const snapshot = panel
    .querySelector("[data-weave-snapshot]")
    ?.getAttribute("data-weave-snapshot");
  await type('input[name="vOverC"]', "1.5");
  expect(panel.querySelector("[data-weave-snapshot]")?.getAttribute("data-weave-snapshot")).toBe(
    snapshot,
  );
  await submit();
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  cleared(nodes);
  await type('input[name="vOverC"]', "-0.6");
  await submit();
  expect(constructed[0]?.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  await act(async () => root?.unmount());
  root = null;
  cleared(nodes);
  log.info(
    "Candidate, partial family, completed longitudinal construction and refusal cleanup exercised",
    {
      testId: "construction-reader",
      beadId: "am-read-result-weave-jex",
    },
  );
});

test("both real reader adapters publish their exact source links and prepared pointers without JavaScript", () => {
  for (const [binding, element] of [
    [
      SR01_READER_WEAVE,
      <Sr01ClarificationView
        key="clock"
        instanceId="clock-static"
        mode={null}
        presentation="standard"
      />,
    ],
    [
      SR04_READER_WEAVE,
      <Sr04ClarificationView
        key="map"
        instanceId="map-static"
        mode={null}
        presentation="standard"
      />,
    ],
  ] as const) {
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Prepared worked example");
    for (const passage of Object.values(binding.passages)) {
      expect(html).toContain(`/papers/special-relativity/view/german/#${passage.sentenceId}`);
      expect(html).toContain(`/papers/special-relativity/view/english/#${passage.sentenceId}`);
    }
    expect(html).not.toContain("data-live-weave-owner");
  }
});
