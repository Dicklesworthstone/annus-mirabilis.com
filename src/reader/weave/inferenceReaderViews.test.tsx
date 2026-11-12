import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { TranslationUnit } from "../../content/schemas/source.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import Lq06ClarificationView from "../../experiments/views/lq06View.tsx";
import Me01ClarificationView from "../../experiments/views/me01View.tsx";
import Me02ClarificationView from "../../experiments/views/me02View.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { TranslationUnitComponent } from "../faces/TranslationUnit.tsx";

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

async function mount(element: ReactNode, paper: string) {
  window.history.replaceState(null, "", `/papers/${paper}/?open=instrument-view`);
  await act(async () => root?.render(element));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The real reader adapter must render its session's weave");
  await act(async () => {
    panel.open = true;
    panel.dispatchEvent(new Event("toggle"));
  });
  return panel;
}

function meaning(node: Element) {
  return node.getAttribute("data-live-weave-meaning");
}

test("LQ-06 keeps the optional prediction private, then links the accepted match to all aligned source parts", async () => {
  const nodes = [
    sentence("s6-p1-s2", "german"),
    sentence("s6-p1-s2a", "english"),
    sentence("s6-p1-s2b", "english"),
  ];
  // The third part cannot be discovered by an a/b suffix guess. Render the real
  // translation record and component so the source-reference contract is exercised.
  const third = load(
    readFileSync(
      new URL(
        "../../../content/translation-units/light-quanta/08006-s6-p1-s2c.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as TranslationUnit;
  const english = document.createElement("div");
  english.innerHTML = renderToStaticMarkup(<TranslationUnitComponent unit={third} />);
  main.prepend(english);
  const thirdNode = english.querySelector<HTMLElement>("[data-translation-unit-id]");
  assert.ok(thirdNode);
  thirdNode.setAttribute("aria-describedby", "existing-source-note");
  nodes.push(thirdNode);
  const inference = sentence("s6-p6-s1", "german");
  const panel = await mount(
    <Lq06ClarificationView instanceId="reader-quantum" mode={null} presentation="standard" />,
    "light-quanta",
  );
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  expect(meaning(inference)).toBeNull();
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  await click("Skip");
  await click("NE/(Rβν), or E/(hν)");
  for (const node of nodes) expect(meaning(node)).toBe("quantity-compared");
  expect(meaning(inference)).toBe("quantity-compared");
  await click("the total radiation energy, in joules");
  for (const node of nodes) {
    expect(meaning(node)).toBeNull();
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
  }
  expect(meaning(inference)).toBe("quantity-compared");
});

test("ME-01 switches the same source premise from assumption to caution while retaining the energy balances", async () => {
  const nodes = [
    sentence("s0-p7-s9", "german"),
    sentence("s0-p7-s9a", "english"),
    sentence("s0-p7-s9b", "english"),
  ];
  const conservation = sentence("s0-p7-s3", "german");
  await mount(
    <Me01ClarificationView instanceId="reader-ledgers" mode={null} presentation="standard" />,
    "mass-energy",
  );
  await click("Skip");
  for (const node of nodes) expect(meaning(node)).toBe("assumption-active");
  await click("Allowed to change");
  for (const node of nodes) expect(meaning(node)).toBe("outside-selected-domain");
  expect(meaning(conservation)).toBe("quantity-compared");
  await click("Unchanged, as the paper assumes");
  for (const node of nodes) expect(meaning(node)).toBe("assumption-active");
  await act(async () => root?.unmount());
  root = null;
  for (const node of [...nodes, conservation]) {
    expect(meaning(node)).toBeNull();
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
  }
});

test("ME-02 shows convergence only near low speed and keeps the analytic limit at exactly zero", async () => {
  const approximation = sentence("s0-p11-s1", "german");
  const conclusion = sentence("s0-p12-s1", "english");
  await mount(
    <Me02ClarificationView instanceId="reader-coefficient" mode={null} presentation="standard" />,
    "mass-energy",
  );
  await click("Skip");
  expect(meaning(approximation)).toBeNull();
  expect(meaning(conclusion)).toBe("quantity-compared");
  await click("Show 0.01c");
  expect(meaning(approximation)).toBe("agreement-within-stated-bound");
  await click("Show vanishing speed");
  expect(meaning(approximation)).toBeNull();
  expect(meaning(conclusion)).toBe("quantity-compared");
  expect(host.textContent).toContain("analytic limit");
});

test("all three inference readers retain exact bilingual source links without JavaScript", () => {
  for (const [paper, anchor, view] of [
    [
      "light-quanta",
      "s6-p6-s1",
      <Lq06ClarificationView
        key="q"
        instanceId="ssr-quantum"
        mode={null}
        presentation="standard"
      />,
    ],
    [
      "mass-energy",
      "s0-p7-s9",
      <Me01ClarificationView
        key="l"
        instanceId="ssr-ledgers"
        mode={null}
        presentation="standard"
      />,
    ],
    [
      "mass-energy",
      "s0-p12-s1",
      <Me02ClarificationView
        key="c"
        instanceId="ssr-coefficient"
        mode={null}
        presentation="standard"
      />,
    ],
  ] as const) {
    const html = renderToStaticMarkup(view);
    expect(html).toContain(`/papers/${paper}/view/german/#${anchor}`);
    expect(html).toContain(`/papers/${paper}/view/english/#${anchor}`);
    expect(html).toContain("Prepared worked example");
  }
});
