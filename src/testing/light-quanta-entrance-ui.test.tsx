import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import raw from "../../content/arguments/light-quanta/entrance-light-quanta.json";
import { validateEntranceRecord } from "../content/entrances/entranceRecord.ts";
import { decodeLq05Settings } from "../experiments/lq05/permalink.ts";
import { LightQuantaFirstEncounter } from "../reader/entrances/LightQuantaFirstEncounter.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);
const record = validateEntranceRecord(raw);

test("static HTML contains every complete worked table, the bridge and real routes", () => {
  const container = createContainer();
  try {
    container.innerHTML = renderToStaticMarkup(<LightQuantaFirstEncounter record={record} />);
    expect(container.querySelectorAll("[data-token-worked] table").length).toBe(8);
    expect(container.textContent).toContain("1 of 16 equally likely arrangements");
    expect(container.textContent).toContain("1 of 9 equally likely arrangements");
    expect(container.textContent).toContain("Counting tokens is not evidence that light is made of dots.");
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    expect(container.querySelector(".entrance-bridge")?.textContent).toContain(record.bridge.newSkill);
    expect(container.querySelectorAll('.entrance-bridge a[href^="/"]').length).toBe(4);
  } finally { removeContainer(container); }
});

test("changing the shared-choice model updates table, live total and exact lab handoff together", async () => {
  const container = createContainer(); const root = createRoot(container);
  try {
    await act(async () => { root.render(<LightQuantaFirstEncounter record={record} />); });
    expect(container.querySelector("[data-count-summary]")?.textContent).toContain("1 of 4");
    await act(async () => { container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click(); });
    expect(container.querySelector("[data-count-summary]")?.textContent).toContain("1 of 2");
    expect(container.querySelector("table tbody")?.children.length).toBe(2);
    const link = container.querySelector<HTMLAnchorElement>("[data-current-token-lab]")!;
    const decoded = decodeLq05Settings(new URL(link.href).search);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") expect(decoded.parameters.locked).toBe(true);
    const next = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Next arrangement")!;
    await act(async () => { next.click(); });
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("Token 1 in the right part");
    expect(container.querySelector("figcaption")?.textContent).toContain("Arrangement 2 of 2");
    await act(async () => { container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click(); });
    expect(container.querySelector("figcaption")?.textContent).toContain("Arrangement 1 of 4");
  } finally { await act(async () => { root.unmount(); }); removeContainer(container); }
});

test("changing to thirds changes the same displayed enumeration, not an unrelated caption", async () => {
  const container = createContainer(); const root = createRoot(container);
  try {
    await act(async () => { root.render(<LightQuantaFirstEncounter record={record} />); });
    const parts = container.querySelectorAll("select")[1]!;
    await act(async () => { parts.value = "3"; parts.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.querySelector("[data-count-summary]")?.textContent).toContain("1 of 9");
    expect(container.querySelector("table tbody")?.children.length).toBe(9);
    expect(container.querySelector("svg")?.textContent).toContain("middle");
  } finally { await act(async () => { root.unmount(); }); removeContainer(container); }
});
