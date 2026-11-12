import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoelectricLab } from "../../components/lab/lq08/PhotoelectricLab.tsx";
import { LQ08_PRESETS } from "../../experiments/lq08/definition.ts";
import { createLq08Session } from "../../experiments/lq08/session.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import Lq08ClarificationView from "../../experiments/views/lq08View.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";

const LINE = "lq08-s8-linear-frequency";
const INDEPENDENCE = "lq08-s8-intensity-rate-independence";
const HISTORICAL = "lq08-s8-printed-stopping-check";
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

function sentence(id: string, face: "german" | "english" = "german") {
  const node = document.createElement("span");
  node.className = face === "german" ? "source-sentence" : "translation-unit";
  node.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
  node.setAttribute("aria-describedby", "existing-source-note");
  node.setAttribute("data-alignment-active", "true");
  node.textContent = `Unchanged ${face} sentence ${id}`;
  main.prepend(node);
  return node;
}

async function click(label: string) {
  const button = [...host.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(label),
  );
  assert.ok(button, `Missing action: ${label}`);
  await act(async () => button.click());
}

async function mount(element: ReactNode) {
  window.history.replaceState(null, "", "/papers/light-quanta/s8/?open=instrument-view#s8-p6");
  await act(async () => root?.render(element));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The photoelectric view must render its accepted session's weave");
  await disclose(panel, true);
  return panel;
}

async function disclose(panel: HTMLDetailsElement, open: boolean) {
  await act(async () => {
    panel.open = open;
    panel.dispatchEvent(new Event("toggle"));
  });
}

function lit(predicateId: string) {
  return host.querySelector(`[data-weave-row="${predicateId}"] [data-weave-lit="true"]`) !== null;
}

function expectCleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.hasAttribute("data-live-weave-meaning")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
    expect(node.getAttribute("data-alignment-active")).toBe("true");
  }
}

function frequencyInput() {
  const input = host.querySelector<HTMLInputElement>('input[type="text"][id$="-frequency"]');
  assert.ok(input);
  // Happy DOM does not dispatch React's synthetic text onChange. Use the actual handlers
  // installed by SliderField, as the existing laboratory integration tests do.
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  const props = key
    ? (
        input as unknown as Record<
          string,
          { onChange(event: unknown): void; onBlur(event: unknown): void }
        >
      )[key]
    : undefined;
  assert.ok(props);
  return { input, props };
}

async function draftFrequency(value: string) {
  const { input, props } = frequencyInput();
  await act(async () => {
    input.value = value;
    props.onChange({ target: input, currentTarget: input });
  });
}

async function commitFrequency() {
  const { input, props } = frequencyInput();
  await act(async () => props.onBlur({ target: input, currentTarget: input }));
}

test("the real reader gates predictions and links source assumptions truthfully", async () => {
  const line = [sentence("s8-p6-s1"), sentence("s8-p6-s1", "english")];
  const independence = [sentence("s8-p7-s2"), sentence("s8-p7-s2", "english")];
  const historical = sentence("s8-p5-s1");
  const empirical = sentence("s8-p5-s2");
  const nodes = [...line, ...independence, historical, empirical];
  const originalText = nodes.map((node) => node.textContent);
  const panel = await mount(
    <Lq08ClarificationView instanceId="reader-photoelectric" mode={null} presentation="standard" />,
  );
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  expectCleared(nodes);
  await click("Skip prediction");
  await click("Green light, 600 THz");
  expect(host.querySelector("[data-instrument-id='lq-08']")?.getAttribute("data-instance-id")).toBe(
    "reader-photoelectric",
  );
  for (const node of line)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  for (const node of independence)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("assumption-active");
  expectCleared([historical, empirical]);
  expect(lit(HISTORICAL)).toBe(false);

  await click("Einstein’s §8 check");
  expect(lit(HISTORICAL)).toBe(true);
  expect(historical.getAttribute("data-live-weave-meaning")).toBe("assumption-active");
  expect(host.querySelector(`[data-weave-row="${HISTORICAL}"]`)?.textContent).toContain(
    "modern SI constants",
  );
  expectCleared([empirical]);
  expect(nodes.map((node) => node.textContent)).toEqual(originalText);
  await disclose(panel, false);
  expectCleared(nodes);
  await disclose(panel, true);
  expect(historical.hasAttribute("data-live-weave-owner")).toBe(true);
  await act(async () => root?.unmount());
  root = null;
  expectCleared(nodes);
});

test("drafts retain accepted evidence and refused settings withdraw it until recovery", async () => {
  const line = sentence("s8-p6-s1");
  const independence = sentence("s8-p7-s2");
  const session = createLq08Session("photoelectric-edits");
  expect(session.apply(LQ08_PRESETS.intensityProbe.parameters).kind).toBe("accepted");
  const before = session.getSnapshot().accepted;
  await mount(
    <PhotoelectricLab
      session={session}
      predict={false}
      linked={false}
      readings={false}
      highlightPaper
    />,
  );
  expect(session.getSnapshot().accepted).toBe(before);
  expect(lit(LINE)).toBe(true);
  await draftFrequency("450");
  expect(session.getSnapshot().accepted).toBe(before);
  expect(lit(LINE)).toBe(true);
  expect(host.querySelector('[data-weave-context="frequency"]')?.textContent).toContain(
    "600000000000000",
  );
  await commitFrequency();
  expect(lit(LINE)).toBe(false);
  expect(lit(INDEPENDENCE)).toBe(true);
  expectCleared([line]);
  const belowThreshold = session.getSnapshot().accepted;

  for (const text of ["", "1"]) {
    await draftFrequency(text);
    await commitFrequency();
    expect(session.getSnapshot().accepted).toBe(belowThreshold);
    expect(host.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
    expect(host.querySelector('[data-weave-lit="true"]')).toBeNull();
    expectCleared([line, independence]);
  }
  await draftFrequency("600");
  await commitFrequency();
  expect(host.querySelector("[data-weave-inactive]")).toBeNull();
  expect(lit(LINE)).toBe(true);
  expect(lit(INDEPENDENCE)).toBe(true);
  expect(line.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
});

test("the standalone lab links sources without annotating the surrounding paper", async () => {
  const node = sentence("s8-p6-s1");
  await mount(<PhotoelectricLab predict={false} linked={false} readings={false} />);
  expect(lit(LINE)).toBe(true);
  for (const face of ["german", "english"]) {
    expect(
      host.querySelector(`a[href="/papers/light-quanta/view/${face}/#s8-p6-s1"]`),
    ).not.toBeNull();
  }
  expectCleared([node]);
});

test("the prepared server HTML retains all bilingual source links", () => {
  const html = renderToStaticMarkup(
    <Lq08ClarificationView instanceId="server-photoelectric" mode={null} presentation="standard" />,
  );
  for (const sentenceId of ["s8-p6-s1", "s8-p7-s2", "s8-p5-s1"]) {
    for (const face of ["german", "english"])
      expect(html).toContain(`/papers/light-quanta/view/${face}/#${sentenceId}`);
  }
  expect(html).toContain("Prepared worked example");
  expect(html).toContain("one point");
  expect(html).toContain("not the full velocity distribution");
});
