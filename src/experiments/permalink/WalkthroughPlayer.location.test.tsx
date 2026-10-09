import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { WalkthroughPlayer } from "./WalkthroughPlayer.tsx";
import type { WalkthroughTarget } from "./walkthroughActions.ts";
import type { WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";

const catalogue: WalkthroughCatalogue = {
  walkthroughs: [
    {
      tapeId: "another",
      experimentId: "sr-03",
      title: "Another walkthrough",
      checkpoints: [{ actionIndex: 0, label: "Another start", settings: { v: 0.1 }, tape: null }],
    },
    {
      tapeId: "a-boost",
      experimentId: "sr-03",
      title: "A boost",
      checkpoints: [
        { actionIndex: 0, label: "At rest", settings: { v: 0 }, tape: null },
        { actionIndex: 7, label: "After the boost", settings: { v: 0.6 }, tape: null },
      ],
    },
  ],
  problems: [],
};
let root: Root | null = null;
let calculated: unknown[];
let restored: unknown[];
let loads: number;
const target: WalkthroughTarget = {
  kind: "session",
  experimentId: "sr-03",
  calculate(settings) {
    calculated.push(settings);
    return { kind: "calculated" };
  },
  restore(tape) {
    restored.push(tape);
    return { kind: "not-restored", notice: "Recorded identity unavailable" };
  },
};
beforeEach(async () => {
  await installDom();
  calculated = [];
  restored = [];
  loads = 0;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});
async function mount(
  search: string,
  load = async () => {
    loads++;
    return catalogue;
  },
) {
  window.history.replaceState({}, "", `/lab/sr-03/${search}`);
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(WalkthroughPlayer, { target, load })));
}
async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === text,
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
}
const stop = () =>
  document
    .querySelector("[data-walkthrough-checkpoint]")
    ?.getAttribute("data-walkthrough-checkpoint");

test("ordinary laboratory visits keep the catalogue lazy", async () => {
  await mount("?tape=unrelated");
  expect(loads).toBe(0);
  expect(document.querySelector("details")?.open).toBe(false);
  expect(calculated).toEqual([]);
  expect(restored).toEqual([]);
});
test("a direct nonconsecutive stop opens the correct walkthrough without acting", async () => {
  await mount("?walkthrough=a-boost&stop=7");
  expect(loads).toBeGreaterThan(0);
  expect(document.querySelector("details")?.open).toBe(true);
  expect(document.querySelector("select")?.value).toBe("a-boost");
  expect(stop()).toBe("7");
  expect(calculated).toEqual([]);
  expect(restored).toEqual([]);
});
test("previous and next inspect only; an explicit new run uses the selected complete settings", async () => {
  await mount("?walkthrough=a-boost&stop=7");
  await click("Inspect previous checkpoint");
  expect(stop()).toBe("0");
  expect(calculated).toEqual([]);
  await click("Inspect next checkpoint");
  expect(stop()).toBe("7");
  expect(calculated).toEqual([]);
  await click("Calculate these settings as a new run");
  expect(calculated).toEqual([{ v: 0.6 }]);
  expect(restored).toEqual([]);
  expect(
    document.querySelector("[data-walkthrough-outcome]")?.getAttribute("data-walkthrough-outcome"),
  ).toBe("new-run");
});
test("missing links show no substituted first walkthrough until the reader asks to browse", async () => {
  await mount("?walkthrough=a-boost&stop=3");
  expect(stop()).toBeUndefined();
  expect(document.querySelector("[role=alert]")?.textContent).toContain("missing or ambiguous");
  await click("Browse this laboratory's walkthroughs");
  expect(document.querySelector("select")?.value).toBe("another");
  expect(calculated).toEqual([]);
});
test("popstate replaces instructions and clears old action feedback, without rerunning the lab", async () => {
  await mount("?walkthrough=a-boost&stop=7");
  await click("Calculate these settings as a new run");
  await act(async () => {
    window.history.pushState({}, "", "/lab/sr-03/?walkthrough=a-boost&stop=0");
    window.dispatchEvent(new Event("popstate"));
  });
  expect(stop()).toBe("0");
  expect(document.querySelector("[data-walkthrough-outcome]")).toBeNull();
  expect(calculated).toEqual([{ v: 0.6 }]);
});
test("a failed catalogue load can retry and retains the requested stop", async () => {
  await mount("?walkthrough=a-boost&stop=7", async () => {
    loads++;
    if (loads === 1) throw new Error("Offline fixture");
    return catalogue;
  });
  expect(document.querySelector("[role=alert]")?.textContent).toContain("could not be loaded");
  await click("Retry loading walkthroughs");
  expect(stop()).toBe("7");
  expect(calculated).toEqual([]);
  expect(restored).toEqual([]);
});
