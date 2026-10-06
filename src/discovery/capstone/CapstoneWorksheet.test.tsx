import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { CapstoneWorksheet } from "./CapstoneWorksheet.tsx";
import type { Capstone } from "./capstoneSchema.ts";
import type { WorksheetStorage } from "./worksheetStore.ts";

const ids = ["a", "b", "c", "d", "e", "f"];
const dependencies: Record<string, string[]> = { a: [], b: [], c: ["a", "b"], d: ["c"], e: ["d"], f: ["d"] };
const capstone: Capstone = {
  id: "capstone-fixture", paper: "brownian-motion", title: "A test chain", question: "What follows from the assumptions?",
  claims: ids.map((id) => ({ id, text: `Statement ${id}`, anchor: `s1-${id}`, logicalRole: "derivation", buildsOn: dependencies[id] ?? [], assumptionIds: ["independence"] })),
  startOrder: [...ids].reverse(), paperOrder: ids, presets: [], equations: [],
  assumptions: [{ id: "independence", statement: "Independent intervals", kind: "idealization" }],
  explanationPrompt: "Explain the chain to another reader.", selfCheckNotes: {}, limits: "A test fixture, not a measurement.", reviewRecordIds: [],
};
let saved: string | null = null;
let quota = false;
const storage: WorksheetStorage = {
  read: () => saved === null ? { status: "missing" } : { status: "ok", raw: saved },
  write(raw) { if (quota) return "quota"; saved = raw; return "saved"; },
  remove() { saved = null; return "removed"; },
};
const props = { capstone, equations: [], instruments: [], storage };
let root: Root | null = null;

beforeEach(async () => { await installDom(); saved = null; quota = false; });
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});
async function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(CapstoneWorksheet, props)));
}
function button(name: string) {
  const found = [...document.querySelectorAll("button")].find((element) => (element.getAttribute("aria-label") ?? element.textContent) === name);
  expect(found).toBeDefined();
  return found as HTMLButtonElement;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
const order = () => [...document.querySelectorAll<HTMLElement>("[data-worksheet-claim]")].map((element) => element.dataset.worksheetClaim);

describe("optional capstone worksheet", () => {
  test("server output provides a printable blank worksheet without inert editing controls", () => {
    const html = renderToStaticMarkup(createElement(CapstoneWorksheet, props));
    expect(html).toContain("Editing needs JavaScript");
    expect(html).toContain(capstone.explanationPrompt);
    expect(html).toContain("capstone-drawing-box");
    expect(html).not.toContain("<button");
  });
  test("button and Alt-arrow moves preserve focus and make one live announcement", async () => {
    await mount();
    expect(order()).toEqual([...ids].reverse());
    const up = button("Move claim 5 up");
    up.focus();
    await act(async () => up.click());
    expect(order()).toEqual(["e", "f", "d", "c", "b", "a"]);
    expect(document.activeElement).toBe(up);
    expect(up.getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector(".capstone-reorder [role=status]")?.textContent).toBe("Claim 5 moved to position 1 of 6.");
    await act(async () => { up.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true })); });
    expect(order()).toEqual([...ids].reverse());
    expect(document.activeElement).toBe(up);
  });
  test("comparison names broken edges rather than assigning a score, then accepts the paper order", async () => {
    await mount();
    await click("Compare your chain");
    expect(document.body.textContent).toContain("Claim 3 builds on claim 1");
    expect(document.body.textContent).toContain("Claim 6 builds on claim 4");
    expect(document.body.textContent).not.toContain("Your score");
    await click("Use the paper's order");
    expect(order()).toEqual(ids);
    expect(document.body.textContent).toContain("This order respects the authored dependencies");
  });
  test("clearing requires confirmation; cancelling retains the arranged claims and table", async () => {
    await mount();
    await click("Use the paper's order");
    await click("Add a row");
    await click("Add a column");
    expect(document.querySelectorAll(".capstone-table-row input").length).toBe(3);
    await click("Clear this worksheet");
    await click("Keep my work");
    expect(order()).toEqual(ids);
    expect(document.querySelectorAll(".capstone-table-row input").length).toBe(3);
    await click("Clear this worksheet");
    await click("Confirm clear");
    expect(order()).toEqual([...ids].reverse());
    expect(document.querySelectorAll(".capstone-table-row input").length).toBe(0);
  });
  test("device work survives unmount and returning to the worksheet", async () => {
    await mount();
    await click("Use the paper's order");
    await click("Add a row");
    await act(async () => { (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click(); });
    await act(async () => root?.unmount());
    root = null;
    await mount();
    expect(order()).toEqual(ids);
    expect(document.querySelectorAll(".capstone-table-row input").length).toBe(2);
    expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    expect(document.body.textContent).toContain("Changes stay on this device");
  });
  test("a full device retains editing and displays session-only recovery", async () => {
    quota = true;
    await mount();
    await click("Use the paper's order");
    expect(order()).toEqual(ids);
    expect(document.body.textContent).toContain("could not be saved on this device");
    expect(button("Retry saving")).toBeDefined();
    quota = false;
    await click("Retry saving");
    expect(document.body.textContent).toContain("Saved on this device");
  });

});
