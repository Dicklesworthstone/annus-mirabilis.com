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
