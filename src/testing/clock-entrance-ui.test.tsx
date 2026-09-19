import { ClockSyncLab } from "../components/lab/sr01/ClockSyncLab.tsx";
import { CLOCK_WORKED_EXAMPLES } from "../reader/entrances/clockExample.ts";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import raw from "../../content/arguments/special-relativity/entrance-special-relativity.json";
import { validateEntranceRecord } from "../content/entrances/entranceRecord.ts";
import { decodeSr01Settings } from "../experiments/sr01/permalink.ts";
import { ClockFirstEncounter } from "../reader/entrances/ClockFirstEncounter.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);
const record = validateEntranceRecord(raw);

test("SSR retains all four explanations, both owner-generated worked tables, and real links", () => {
  const container = createContainer();
  try {
    container.innerHTML = renderToStaticMarkup(<ClockFirstEncounter record={record} />);
    expect(container.querySelectorAll("[data-clock-choice]").length).toBe(4);
    const tables = Array.from(container.querySelectorAll("[data-clock-worked] [data-reflection-reading]"));
    expect(tables.map(cell => cell.textContent)).toEqual(["5", "25"]);
    expect(container.textContent).toContain("Nothing tells us yet");
    expect(container.textContent).toContain("not a measurement of the separate one-way travel times");
    expect(container.querySelector("[data-clock-accepted] [data-reflection-reading]")?.textContent).toBe("Not assigned before an agreement");
    expect(container.querySelector(".entrance-bridge")?.textContent).toContain(record.bridge.newSkill);
    expect(container.querySelectorAll('.entrance-bridge a[href^="/"]').length).toBe(3);
    expect(Array.from(container.querySelectorAll("fieldset")).every(field => field.disabled)).toBe(true);
  } finally { removeContainer(container); }
});

test("agreeing assigns the distant time; withdrawing the agreement does not invent a measured time", async () => {
  const container = createContainer(); const root = createRoot(container);
  try {
    await act(async () => { root.render(<ClockFirstEncounter record={record} />); });
    const agreement = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => { agreement.click(); });
    expect(container.querySelector("[data-clock-accepted] [data-reflection-reading]")?.textContent).toBe("5");
    expect(container.querySelector("[data-clock-announcement]")?.textContent).toContain("under the equal-travel-time agreement");
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("B is assigned 5");
    const href = container.querySelector<HTMLAnchorElement>("[data-current-clock-lab]")!.href;
    await act(async () => { agreement.click(); });
    expect(container.querySelector("[data-clock-accepted] [data-reflection-reading]")?.textContent).toBe("Not assigned before an agreement");
    expect(container.querySelector<HTMLAnchorElement>("[data-current-clock-lab]")!.href).toBe(href);
    expect(container.querySelectorAll("[data-clock-worked] [data-reflection-reading]")[0]?.textContent).toBe("5");
  } finally { await act(async () => { root.unmount(); }); removeContainer(container); }
});

test("two independently mounted encounters do not share agreement or draft state", async () => {
  const container = createContainer(); const root = createRoot(container);
  try {
    await act(async () => { root.render(<><ClockFirstEncounter record={record} /><ClockFirstEncounter record={record} /></>); });
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => { checkboxes[0]!.click(); });
    const assignments = container.querySelectorAll("[data-clock-accepted] [data-reflection-reading]");
    expect(assignments[0]?.textContent).toBe("5");
    expect(assignments[1]?.textContent).toBe("Not assigned before an agreement");
    for (const link of container.querySelectorAll<HTMLAnchorElement>("[data-current-clock-lab]")) {
      const decoded = decodeSr01Settings(new URL(link.href).search);
      expect(decoded.kind).toBe("settings");
      if (decoded.kind === "settings") expect(decoded.parameters.stationSeparationLs).toBe(5);
    }
  } finally { await act(async () => { root.unmount(); }); removeContainer(container); }
});


test("the actual standalone lab consumes the entrance URL and the embedded lab stays independent", async () => {
  window.history.replaceState({}, "", CLOCK_WORKED_EXAMPLES[1]!.labHref);
  const container = createContainer(); const root = createRoot(container);
  try {
    await act(async () => { root.render(<><ClockSyncLab restoreFromLocation /><ClockSyncLab /></>); });
    const labs = container.querySelectorAll('[data-instrument-id="sr-01"]');
    expect(labs[0]?.querySelector('[data-shared-clock-settings]')).not.toBeNull();
    expect(labs[1]?.querySelector('[data-shared-clock-settings]')).toBeNull();
    expect(labs[0]?.querySelector('input[id^="emit-"]')?.getAttribute("value")).toBe("20");
    expect(labs[1]?.querySelector('input[id^="emit-"]')?.getAttribute("value")).toBe("0");
    expect(labs[0]?.querySelector(".derived-outputs dd")?.textContent).toBe("25 s");
    expect(labs[1]?.querySelector(".derived-outputs dd")?.textContent).toBe("10 s");
  } finally { await act(async () => { root.unmount(); }); removeContainer(container); }
});

test("a malformed shared link preserves the actual prepared laboratory ledger", async () => {
  window.history.replaceState({}, "", "/lab/sr-01/?ab=5junk");
  const container = createContainer(); const root = createRoot(container);
  try {
    await act(async () => { root.render(<ClockSyncLab restoreFromLocation />); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("prepared example is unchanged");
    expect(container.querySelector(".derived-outputs dd")?.textContent).toBe("10 s");
    const reveal = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Show the outcome without a prediction")!;
    await act(async () => { reveal.click(); });
    expect(container.querySelector(".predict-reveal")).not.toBeNull();
  } finally { await act(async () => { root.unmount(); }); removeContainer(container); }
});
