import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { FluorescenceLab } from "../../components/lab/lq07/FluorescenceLab.tsx";
import { IonizationLab } from "../../components/lab/lq09/IonizationLab.tsx";
import { installPredictPersistence, REMEMBERS_NOTHING } from "../../experiments/predict/predictPersistence.ts";
import Lq07ClarificationView from "../../experiments/views/lq07View.tsx";
import Lq09ClarificationView from "../../experiments/views/lq09View.tsx";
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
  window.history.replaceState(null, "", "/papers/light-quanta/s7/?open=instrument-view#s7-p1-s5");
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function bothFaces(id: string) {
  return (["german", "english"] as const).map((face) => {
    const node = document.createElement("span");
    node.className = face === "german" ? "source-sentence" : "translation-unit";
    node.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
    node.setAttribute("aria-describedby", "existing-note");
    node.setAttribute("data-alignment-active", "true");
    node.textContent = "Unchanged " + face + " " + id;
    main.prepend(node);
    return node;
  });
}
function cleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-note");
    expect(node.getAttribute("data-alignment-active")).toBe("true");
  }
}
function lit(nodes: readonly Element[], meaning: string) {
  for (const node of nodes) expect(node.getAttribute("data-live-weave-meaning")).toBe(meaning);
}
async function clickButton(label: string) {
  const button = [...host.querySelectorAll("button")].find((node) => node.textContent?.trim().includes(label));
  assert.ok(button, "Missing production button: " + label);
  await act(async () => button.click());
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
  assert.ok(panel);
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe("awaiting");
  await disclose(panel, true);
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  await clickButton("Skip prediction");
  return panel;
}
function installedChange(input: HTMLInputElement) {
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key]
    : undefined;
  const change = props?.onChange;
  assert.ok(change);
  return change;
}

test("the fluorescence reader follows accepted regimes and withdraws both the unsupported ceiling and stale highlights", async () => {
  const bound = bothFaces("s7-p1-s5");
  const rate = bothFaces("s7-p2-s1");
  const exception = bothFaces("s7-p4-s2");
  const panel = await mount(<Lq07ClarificationView instanceId="closing-fluorescence-reader" mode={null} presentation="standard" />);
  lit(bound, "quantity-compared");
  lit(rate, "assumption-active");
  cleared(exception);

  await clickButton("a 20,000 K source");
  cleared([...bound, ...rate]);
  lit(exception, "outside-selected-domain");
  expect(panel.querySelector('[data-weave-context="regime"]')?.textContent).toContain("Wien-domain");
  const row = [...host.querySelectorAll("tr")].find((node) => node.querySelector("th")?.textContent === "Maximum allowed frequency");
  assert.ok(row);
  expect(row.textContent).toContain("No frequency bound is determined in this regime");
  expect(row.textContent).not.toContain("850.00 THz");

  await clickButton("Stokes's rule (§7 as printed)");
  lit(bound, "quantity-compared");
  cleared(exception);
  const input = host.querySelector<HTMLInputElement>('input[id$="-nu1"]');
  const form = input?.closest("form");
  assert.ok(input && form);
  const change = installedChange(input);
  await act(async () => {
    input.value = "-1";
    change({ target: input, currentTarget: input });
  });
  expect(panel.querySelector('[data-weave-context="nu1"]')?.textContent).toContain("850 THz");
  lit(bound, "quantity-compared");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  cleared([...bound, ...rate, ...exception]);

  await clickButton("Stokes's rule (§7 as printed)");
  lit(bound, "quantity-compared");
  await disclose(panel, false);
  cleared([...bound, ...rate]);
});

test("the ionization reader changes the source qualification when accepted yield changes", async () => {
  const threshold = bothFaces("s9-p1-s2");
  const equality = bothFaces("s9-p3-s5");
  const qualification = bothFaces("s9-p3-s6");
  const panel = await mount(<Lq09ClarificationView instanceId="closing-ionization-reader" mode={null} presentation="standard" />);
  lit(threshold, "quantity-compared");
  lit(equality, "assumption-active");
  cleared(qualification);

  await clickButton("The share that ionizes is unknown");
  lit(threshold, "quantity-compared");
  cleared(equality);
  lit(qualification, "outside-selected-domain");
  expect(panel.textContent).toContain("underdetermined");
  expect(panel.querySelector('[data-weave-context="absorptionMode"]')?.textContent).toContain("unknown");

  await clickButton("Only a quarter of absorbed quanta ionize");
  cleared(equality);
  lit(qualification, "assumption-active");
  expect(panel.querySelector('[data-weave-context="declaredFraction"]')?.textContent).toContain("0.25");

  await clickButton("9 eV quanta: below the threshold");
  cleared([...equality, ...qualification]);
  const countRow = panel.querySelector('[data-weave-row="lq09-s9-full-yield-count"]');
  assert.ok(countRow);
  expect(countRow.querySelector('[data-weave-lit="true"]')).toBeNull();
  expect(panel.textContent).toContain("not applicable");
  await act(async () => root?.unmount());
  root = null;
  cleared([...threshold, ...equality, ...qualification]);
});

test("standalone laboratories retain source links without annotating an unrelated paper", async () => {
  const nodes = bothFaces("s7-p1-s5");
  await mount(<FluorescenceLab instanceId="closing-standalone" restoreFromLocation={false} />);
  cleared(nodes);
});

test("both laboratories export prepared source returns without JavaScript", () => {
  for (const [view, sentence] of [
    [<FluorescenceLab key="fluorescence" instanceId="closing-fluorescence-static" restoreFromLocation={false} />, "s7-p1-s5"],
    [<IonizationLab key="ionization" instanceId="closing-ionization-static" restoreFromLocation={false} />, "s9-p1-s2"],
  ] as const) {
    const html = renderToStaticMarkup(view);
    expect(html).toContain('data-result-weave="light-quanta"');
    expect(html).toContain("/view/german/#" + sentence);
    expect(html).toContain("/view/english/#" + sentence);
    expect(html).not.toContain("e+308");
  }
});
