import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { FoundationConstruction } from "./FoundationConstruction.tsx";

describe("the distant-clock lesson can be operated through labelled readings", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  async function mount() {
    await act(async () => root.render(<FoundationConstruction foundationId="frames-events" />));
  }
  async function type(name: string, value: string) {
    const field = container.querySelector<HTMLInputElement>(`[name='clock-sync-${name}']`);
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }
  async function submit() {
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  }
  async function click(label: string) {
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }
  function output(name: string) {
    const cell = container.querySelector(`[data-clock-value='${name}']`);
    expect(cell).not.toBeNull();
    return cell?.textContent;
  }
  function current() {
    const element = container.querySelector("[data-clock-current]");
    expect(element).not.toBeNull();
    return element?.outerHTML;
  }
  function signalPath() {
    return container.querySelector("[data-clock-signal]")?.getAttribute("d");
  }

  test("all three drafts update the diagram, table and summary as one accepted exchange", async () => {
    await mount();
    expect(container.querySelector("fieldset")?.disabled).toBe(false);
    expect(output("midpoint")).toBe("5");
    expect(output("correction")).toBe("−2");
    const first = current();
    await type("leaves", "-2");
    await type("reflection", "1");
    await type("returns", "4");
    expect(current()).toBe(first);
    expect(container.textContent).toContain("Changes are waiting");
    await submit();
    expect(output("departure")).toBe("−2");
    expect(output("reflection")).toBe("1");
    expect(output("return")).toBe("4");
    expect(output("round-trip")).toBe("6");
    expect(output("assigned-outward")).toBe("3");
    expect(output("assigned-return")).toBe("3");
    expect(output("correction")).toBe("0");
    const summary = container.querySelector("[role='status']")?.textContent;
    expect(summary).toContain("B agrees with the midpoint rule");
    expect(container.querySelector("[data-clock-diagram]")?.getAttribute("aria-label")).toContain(
      summary ?? "missing summary",
    );
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
  });

  test("setting B changes its display, not the signal or A's accepted readings", async () => {
    await mount();
    const path = signalPath();
    expect(path).toBeTruthy();
    await type("leaves", "unfinished");
    await click("Set B by the midpoint rule");
    expect(output("departure")).toBe("0");
    expect(output("return")).toBe("10");
    expect(output("reflection")).toBe("5");
    expect(output("round-trip")).toBe("10");
    expect(output("outward-difference")).toBe("5");
    expect(output("return-difference")).toBe("5");
    expect(output("correction")).toBe("0");
    expect(signalPath()).toBe(path);
    expect(container.querySelector<HTMLInputElement>("[name='clock-sync-leaves']")?.value).toBe(
      "0",
    );
    expect(container.querySelector<HTMLInputElement>("[name='clock-sync-reflection']")?.value).toBe(
      "5",
    );
    expect(container.querySelector("[role='alert']")).toBeNull();
    const corrected = current();
    await click("Set B by the midpoint rule");
    expect(current()).toBe(corrected);
  });

  test("a common clock-origin shift preserves intervals and offsets, and reset restores the worked reading", async () => {
    await mount();
    await click("Add 10 seconds to all readings");
    expect(output("departure")).toBe("10");
    expect(output("reflection")).toBe("17");
    expect(output("return")).toBe("20");
    expect(output("round-trip")).toBe("10");
    expect(output("midpoint")).toBe("15");
    expect(output("outward-difference")).toBe("7");
    expect(output("return-difference")).toBe("3");
    expect(output("offset")).toBe("2");
    expect(output("correction")).toBe("−2");
    await click("Set B by the midpoint rule");
    expect(output("reflection")).toBe("15");
    await click("Restore the first readings");
    expect(output("departure")).toBe("0");
    expect(output("reflection")).toBe("7");
    expect(output("return")).toBe("10");
  });

  test("decimal synchronization survives an origin change and reapplying unchanged readings", async () => {
    await mount();
    await type("leaves", "0.1");
    await type("reflection", "0.15");
    await type("returns", "0.2");
    await submit();
    expect(output("correction")).not.toBe("0");
    expect(output("correction")).toContain("10");
    const beforeCorrection = current();
    await click("Add 10 seconds to all readings");
    expect(current()).toBe(beforeCorrection);
    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "hide B's nonzero offset",
    );
    await click("Set B by the midpoint rule");
    await click("Add 10 seconds to all readings");
    expect(output("origin")).toBe("10");
    expect(output("departure")).toBe("10.1");
    expect(output("reflection")).toBe("10.15");
    expect(output("return")).toBe("10.2");
    expect(output("round-trip")).toBe("0.1");
    expect(output("outward-difference")).toBe("0.05");
    expect(output("return-difference")).toBe("0.05");
    expect(output("correction")).toBe("0");
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "B agrees with the midpoint rule",
    );
    const shifted = current();
    await submit();
    expect(current()).toBe(shifted);
    await type("reflection", "10.16");
    await submit();
    expect(output("origin")).toBe("0");
    expect(output("reflection")).toBe("10.16");
    expect(output("correction")).toBe("−0.01");
  });

  test("an unsynchronised reading outside A's interval is accepted and distinguished from backwards travel", async () => {
    await mount();
    await type("reflection", "-20");
    await submit();
    expect(output("outward-difference")).toBe("−20");
    expect(output("return-difference")).toBe("30");
    expect(output("correction")).toBe("25");
    expect(container.querySelector("[role='status']")?.textContent).toContain("25 seconds behind");
    expect(container.textContent).toContain("not light travelling backwards in time");
    expect(container.querySelector("[role='alert']")).toBeNull();
    await click("Set B by the midpoint rule");
    expect(output("reflection")).toBe("5");
    expect(container.textContent).not.toContain("not light travelling backwards in time");
  });

  test("refused drafts retain every accepted output and link the refusal to the responsible reading", async () => {
    await mount();
    const first = current();
    for (const text of ["", "-", "1e", "NaN", "1+1", "1e-999", "1000001"]) {
      await type("reflection", text);
      await submit();
      expect(current()).toBe(first);
      const field = container.querySelector("[name='clock-sync-reflection']");
      expect(field?.getAttribute("aria-invalid")).toBe("true");
      const alert = container.querySelector("[role='alert']");
      expect(alert?.textContent).toContain("last accepted clock readings");
      expect(field?.getAttribute("aria-describedby")?.split(" ")).toContain(alert?.id);
    }
    await type("reflection", "7");
    await type("returns", "0");
    await submit();
    expect(current()).toBe(first);
    expect(
      container.querySelector("[name='clock-sync-returns']")?.getAttribute("aria-invalid"),
    ).toBe("true");
    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "later than its departure",
    );
    await type("returns", "14");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(output("round-trip")).toBe("14");
    expect(output("correction")).toBe("0");
  });

  test("separate instances retain their own readings and unique labelled fields", async () => {
    await act(async () =>
      root.render(
        <>
          <FoundationConstruction foundationId="frames-events" />
          <FoundationConstruction foundationId="frames-events" />
        </>,
      ),
    );
    const panels = [...container.querySelectorAll("[data-clock-current]")];
    expect(panels.length).toBe(2);
    const second = panels[1]?.outerHTML;
    await type("reflection", "5");
    await submit();
    expect(panels[1]?.outerHTML).toBe(second);
    const fields = [...container.querySelectorAll<HTMLInputElement>("input")];
    expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
    for (const field of fields) expect(field.labels?.length).toBeGreaterThan(0);
  });
});

test("static HTML retains both named figures and a readable default clock account with inert controls", () => {
  const html = renderToStaticMarkup(<FoundationConstruction foundationId="frames-events" />);
  expect(html).toContain("the two clocks are synchronous by the rule.");
  expect(html).toContain("clock B is 2 seconds fast and setting it back by 2 makes the two agree.");
  expect(html).toContain("JavaScript is off");
  expect(html).toContain("B is 2 seconds ahead of the assigned reflection reading of 5 seconds");
  expect(html).toContain('<fieldset class="construction-controls" disabled="">');
  expect(html).toContain("What it shows, in words");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("Infinity");
});
