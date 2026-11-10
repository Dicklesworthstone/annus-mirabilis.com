import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../content/checks/voice/index.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { FoundationConstruction } from "./FoundationConstruction.tsx";

function values(region: ParentNode): Record<string, string> {
  return Object.fromEntries(
    [...region.querySelectorAll('[role="status"] dt')].map((label) => [
      label.textContent ?? "",
      label.nextElementSibling?.textContent ?? "",
    ]),
  );
}

describe("the probability foundation is a working comparison in the real dispatcher", () => {
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

  test("changing the dependence changes the weights, product and spread together", async () => {
    await act(async () =>
      root.render(<FoundationConstruction foundationId="probability-independence" />),
    );
    expect(values(container)).toEqual({
      "Average end position": "0 m",
      "Average squared end position": "2 m²",
      "Average product of the two steps": "0 m²",
      "Twice that product: the mixed term": "0 m²",
    });
    expect(container.querySelectorAll("tbody tr").length).toBe(4);
    expect(container.querySelector("tbody")?.textContent).toContain("Chance: 1 in 4");

    const copy = container.querySelector<HTMLInputElement>('input[value="same-direction"]');
    expect(copy?.labels?.[0]?.textContent).toContain("Copy the first step");
    await act(async () => copy?.click());
    expect(copy?.checked).toBe(true);
    expect(values(container)).toEqual({
      "Average end position": "0 m",
      "Average squared end position": "4 m²",
      "Average product of the two steps": "+1 m²",
      "Twice that product: the mixed term": "+2 m²",
    });
    expect(container.querySelectorAll("tbody tr").length).toBe(2);
    expect(container.querySelector("tbody")?.textContent).toContain("Chance: 1 in 2");
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("−2, +2 metres");

    const reverse = container.querySelector<HTMLInputElement>('input[value="opposite-direction"]');
    await act(async () => reverse?.click());
    expect(values(container)).toEqual({
      "Average end position": "0 m",
      "Average squared end position": "0 m²",
      "Average product of the two steps": "−1 m²",
      "Twice that product: the mixed term": "−2 m²",
    });
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("0, 0 metres");
    expect(container.textContent).toContain("0 of the 1 possible walks");
    // A mistaken case that changed only the caption or radio selection would fail the values above.
    expect(container.querySelectorAll('[role="status"]').length).toBe(1);
  });

  test("two instances have separate radio groups and retain their own comparison", async () => {
    await act(async () =>
      root.render(
        <>
          <FoundationConstruction foundationId="probability-independence" />
          <FoundationConstruction foundationId="foundation:probability-independence" />
        </>,
      ),
    );
    const regions = container.querySelectorAll("[data-foundation-construction]");
    expect(regions.length).toBe(2);
    const first = regions[0] as HTMLElement;
    const second = regions[1] as HTMLElement;
    expect(first.querySelector("input")?.name).not.toBe(second.querySelector("input")?.name);
    await act(async () =>
      first.querySelector<HTMLInputElement>('input[value="same-direction"]')?.click(),
    );
    expect(values(first)["Average squared end position"]).toBe("4 m²");
    expect(values(second)["Average squared end position"]).toBe("2 m²");
    expect(second.querySelector<HTMLInputElement>('input[value="independent"]')?.checked).toBe(
      true,
    );
  });

  test("drift changes the weighted paths and distinguishes mean square from variance", async () => {
    await act(async () =>
      root.render(<FoundationConstruction foundationId="probability-independence" />),
    );
    const drift = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("75%:"),
    );
    expect(drift).toBeDefined();
    await act(async () => drift?.click());
    expect(values(container)).toEqual({
      "Average end position": "+1 m",
      "Average squared end position": "2.5 m²",
      "Average product of the two steps": "+0.25 m²",
      "Twice that product: the mixed term": "+0.5 m²",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Independence alone does not remove the mixed term",
    );
    expect(container.querySelector("tbody")?.textContent).toContain("Chance: 56.25%");
    expect(container.querySelector("details")?.textContent).toContain("is 1.5 m²");
    expect(container.querySelector("details")?.textContent).toContain(
      "covariance of the two steps is 0 m²",
    );
    expect(container.querySelector("svg")?.getAttribute("aria-label")).not.toContain(
      "equally likely",
    );
    await act(async () =>
      container.querySelector<HTMLInputElement>('input[value="opposite-direction"]')?.click(),
    );
    expect(values(container)["Average squared end position"]).toBe("0 m²");
    expect(container.textContent).toContain("second has a 25% chance of going right");
    expect(container.textContent).toContain("chance of going right next is 0%");
  });

  test("typed chance survives a rule change and invalid input keeps the last accepted values", async () => {
    await act(async () =>
      root.render(<FoundationConstruction foundationId="probability-independence" />),
    );
    const input = container.querySelector<HTMLInputElement>('input[type="number"]');
    const form = container.querySelector("form");
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();
    if (!input || !form) throw new Error("The chance form must be present.");
    expect(input.labels?.[0]?.textContent).toContain("Chance of a rightward first step");
    await act(async () => {
      input.value = "25";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(values(container)["Average squared end position"]).toBe("2 m²");
    expect(container.textContent).toContain("comparison still uses 50%");
    await act(async () =>
      container.querySelector<HTMLInputElement>('input[value="same-direction"]')?.click(),
    );
    expect(input.value).toBe("25");
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(values(container)["Average end position"]).toBe("−1 m");
    const accepted = values(container);
    await act(async () => {
      input.value = "101";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(values(container)).toEqual(accepted);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "whole percentage from 0 to 100",
    );
    const balanced = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("50%:"),
    );
    await act(async () => balanced?.click());
    expect(input.value).toBe("50");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

test("static reading keeps the complete comparison and its source links without JavaScript", () => {
  const html = renderToStaticMarkup(
    <FoundationConstruction foundationId="probability-independence" headingLevel={4} />,
  );
  expect(html).toContain("JavaScript is off, so the controls below cannot change anything.");
  expect(html).toContain("<h4");
  expect(html).toContain("What it shows, in words");
  expect(html).toContain("squared ends average 4");
  expect(html).toContain("squared ends average 0");
  expect(html).toContain("squared ends average 2.5 m²");
  expect(html).toContain('href="/papers/brownian-motion/s4/#arg-bm-independent-steps"');
  expect(html).toContain('href="/lab/bm-05/"');
  expect(html).not.toContain("katex");
  expect(html).not.toContain("<math");
  const copy = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  expect(
    checkVoice(copy, { context: "prose" }).filter((finding) => finding.severity !== "info"),
  ).toEqual([]);
});
