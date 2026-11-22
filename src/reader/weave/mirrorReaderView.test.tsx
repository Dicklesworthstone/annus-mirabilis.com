import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MovingMirrorLab } from "../../components/lab/sr11/MovingMirrorLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { DEFAULT_PREPARED_EXAMPLE, snapshotOutputs } from "../../experiments/sr11/session.ts";
import Sr11ClarificationView from "../../experiments/views/sr11View.tsx";
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
    "/papers/special-relativity/s8/?open=instrument-view#s8-p7-s4",
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
  node.textContent = "Unchanged " + face + " sentence " + id;
  main.prepend(node);
  return node;
}

function bothFaces(id: string) {
  return [sentence(id, "german"), sentence(id, "english")];
}

async function disclose(panel: HTMLDetailsElement, open: boolean) {
  await act(async () => {
    panel.open = open;
    panel.dispatchEvent(new Event("toggle"));
  });
}

function expectCleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
    expect(node.getAttribute("data-alignment-active")).toBe("true");
  }
}

function expectCompared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  }
}

async function mount(view: ReactNode) {
  await act(async () => root?.render(view));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The production reader adapter must mount the accepted session's weave");
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

function field(suffix: string): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input[id$="-' + suffix + '"]');
  assert.ok(input);
  return input;
}

function installedHandler(element: Element, name: "onChange" | "onBlur") {
  // Happy DOM does not reliably dispatch these React input events. Exercise the production
  // handlers, as the existing slider-field tests do, preserving the draft/commit distinction.
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactProps$"));
  const props = key
    ? (
        element as unknown as Record<string, Partial<Record<typeof name, (event: unknown) => void>>>
      )[key]
    : undefined;
  const handler = props?.[name];
  assert.ok(handler);
  return handler;
}

async function typeField(suffix: string, value: string) {
  const input = field(suffix);
  const change = installedHandler(input, "onChange");
  await act(async () => {
    input.value = value;
    change({ target: input, currentTarget: input });
  });
}

async function commitField(suffix: string) {
  const input = field(suffix);
  const blur = installedHandler(input, "onBlur");
  await act(async () => blur({ target: input, currentTarget: input }));
}

async function chooseFrame(frame: "lab" | "mirror") {
  const select = host.querySelector<HTMLSelectElement>('select[name="frame"]');
  assert.ok(select);
  const change = installedHandler(select, "onChange");
  await act(async () => {
    select.value = frame;
    change({ target: select, currentTarget: select });
  });
}

test("the production reader follows the accepted frame and clears pointers for refusals and unavailable reflection", async () => {
  const laboratorySource = bothFaces("s8-p7-s4");
  const restSource = bothFaces("s8-p7-s3");
  const energySources = [...bothFaces("s8-p10-s3"), ...bothFaces("s8-p10-s4")];
  const unrelated = bothFaces("s8-p1-s1");
  const allNodes = [...laboratorySource, ...restSource, ...energySources, ...unrelated];
  const sourceText = allNodes.map((node) => node.textContent);
  const panel = await mount(
    <Sr11ClarificationView instanceId="mirror-reader" mode={null} presentation="standard" />,
  );
  const lab = host.querySelector('[data-instrument-id="sr-11"]');
  assert.ok(lab);
  const runId = lab.getAttribute("data-run-id");
  expectCompared([...laboratorySource, ...energySources]);
  expectCleared([...restSource, ...unrelated]);

  await chooseFrame("mirror");
  expect(lab.getAttribute("data-run-id")).toBe(runId);
  expect(panel.querySelector('[data-weave-context="frame"]')?.textContent).toContain(
    "mirror rest frame k",
  );
  expect(panel.querySelector('[data-weave-context="beta"]')?.textContent).toContain("0.6 c");
  expectCompared([...restSource, ...energySources]);
  expectCleared([...laboratorySource, ...unrelated]);
  expect(panel.textContent).toContain("original incident frequency in K");
  expect(panel.textContent).toContain("a finite scalar reading");
  expect(panel.textContent).not.toContain("e+308");

  // Unapplied text cannot relabel the accepted trial.
  await typeField("beta", "-0.6");
  expect(panel.querySelector('[data-weave-context="beta"]')?.textContent).toContain("0.6 c");
  expect(panel.querySelector('[data-weave-context="beta"]')?.textContent).not.toContain("-0.6");
  await commitField("beta");
  expect(panel.querySelector('[data-weave-context="beta"]')?.textContent).toContain("-0.6 c");
  const keptFrequency = host.querySelector('[data-quantity-id="frequencyRatio"]')?.textContent;
  expect(keptFrequency).toBeTruthy();

  // A local validation refusal never leaves the old paper pointers attached.
  await typeField("beta", "1.5");
  await commitField("beta");
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  expect(panel.querySelector('[data-weave-lit="true"]')).toBeNull();
  expect(panel.querySelector("[data-weave-context]")).toBeNull();
  expect(host.querySelector('[data-quantity-id="frequencyRatio"]')?.textContent).toBe(
    keptFrequency,
  );
  expectCleared(allNodes);

  await typeField("beta", "0.6");
  await commitField("beta");
  for (const angle of [60, (Math.acos(0.6) * 180) / Math.PI]) {
    await typeField("incidentAngleDeg", String(angle));
    await commitField("incidentAngleDeg");
    expect(panel.querySelector("[data-weave-inactive]")).toBeNull();
    expect(panel.querySelector('[data-weave-lit="true"]')).toBeNull();
    expect(panel.textContent).toContain("cannot be evaluated from the current accepted outputs");
    expect(host.querySelector(".sr11-diagram polyline")).toBeNull();
    expectCleared(allNodes);
  }

  await typeField("incidentAngleDeg", "0");
  await commitField("incidentAngleDeg");
  expectCompared([...restSource, ...energySources]);
  await disclose(panel, false);
  expectCleared(allNodes);
  await disclose(panel, true);
  expectCompared([...restSource, ...energySources]);
  await act(async () => root?.unmount());
  root = null;
  expectCleared(allNodes);
  expect(allNodes.map((node) => node.textContent)).toEqual(sourceText);
});

test("the standalone mirror lab does not annotate a surrounding paper", async () => {
  const nodes = [...bothFaces("s8-p7-s4"), ...bothFaces("s8-p10-s3")];
  await mount(<MovingMirrorLab example={DEFAULT_PREPARED_EXAMPLE} restoreFromLocation={false} />);
  expectCleared(nodes);
});

test("prepared source links survive server rendering without another trial", () => {
  const html = renderToStaticMarkup(<MovingMirrorLab example={DEFAULT_PREPARED_EXAMPLE} />);
  expect(html).toContain('data-result-weave="special-relativity"');
  expect(html).toContain("Prepared worked example");
  for (const id of ["s8-p7-s4", "s8-p10-s3", "s8-p10-s4"]) {
    expect(html).toContain("/view/german/#" + id);
    expect(html).toContain("/view/english/#" + id);
  }
  expect(html).not.toContain("e+308");
});

test("partial accepted examples render missing incident readings without inventing a ray in either frame", () => {
  const missing = new Set(["incidentAngleInFrameDeg", "incidentFrequencyRatio"]);
  for (const frame of ["lab", "mirror"] as const) {
    const parameters = { ...DEFAULT_PREPARED_EXAMPLE.parameters, frame };
    const example = {
      ...DEFAULT_PREPARED_EXAMPLE,
      parameters,
      results: snapshotOutputs(parameters)
        .filter((output) => !missing.has(output.quantityId))
        .map(encodeResult),
    };
    const rendered = document.createElement("div");
    rendered.innerHTML = renderToStaticMarkup(<MovingMirrorLab example={example} />);
    for (const quantityId of missing) {
      expect(
        rendered.querySelector('[data-quantity-id="' + quantityId + '"]')?.textContent,
      ).toContain("This accepted snapshot does not include this reading.");
    }
    expect(rendered.querySelector(".sr11-diagram polyline")).toBeNull();
    expect(rendered.querySelector(".sr11-diagram")?.textContent).toContain(
      "does not include the incident geometry in this frame",
    );
    expect(
      rendered.querySelector('[data-weave-row="sr11-reflection"] [data-weave-lit="true"]'),
    ).toBeNull();
    expect(
      rendered.querySelector('[data-weave-row="sr11-radiation-pressure"] [data-weave-lit="true"]'),
    ).not.toBeNull();
    expect(
      rendered.querySelector('[data-quantity-id="frequencyRatio"]')?.textContent,
    ).not.toContain("does not include");
  }
});
