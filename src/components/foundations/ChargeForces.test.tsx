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

type ForceReadout = {
  x: string;
  y: string;
  z: string;
  magnitude: string;
  direction: string;
};

function readouts(region: ParentNode): Record<string, ForceReadout> {
  const rows = [...region.querySelectorAll("[data-force]")];
  expect(rows.length).toBeGreaterThan(0);
  return Object.fromEntries(
    rows.map((row) => {
      const read = (part: string) => {
        const cell = row.querySelector("[data-force-" + part + "]");
        expect(cell).not.toBeNull();
        const text = cell?.textContent ?? "";
        return part === "direction" ? text : text.replace(/\s+/gu, "");
      };
      return [
        row.getAttribute("data-force") ?? "",
        {
          x: read("x"),
          y: read("y"),
          z: read("z"),
          magnitude: read("magnitude"),
          direction: read("direction"),
        },
      ];
    }),
  );
}

function pictures(region: ParentNode): string[] {
  return [...region.querySelectorAll("svg")].map((figure) => figure.outerHTML);
}

describe("electric and magnetic forces are operable through the foundation dispatcher", () => {
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

  function button(label: string, region: ParentNode = container): HTMLButtonElement {
    const found = [...region.querySelectorAll("button")].find(
      (element) => element.textContent === label,
    );
    expect(found).toBeDefined();
    return found as HTMLButtonElement;
  }

  async function type(name: string, value: string, region: ParentNode = container) {
    const input = region.querySelector<HTMLInputElement>('input[name="' + name + '"]');
    expect(input).not.toBeNull();
    expect(input?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      const field = input as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function choose(name: string, value: string, region: ParentNode = container) {
    const select = region.querySelector<HTMLSelectElement>('select[name="' + name + '"]');
    expect(select).not.toBeNull();
    expect(select?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      const field = select as HTMLSelectElement;
      field.value = value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function submit(region: ParentNode = container) {
    const form = region.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  async function mount() {
    await act(async () => {
      root.render(<FoundationConstruction foundationId="electromagnetism-charges" />);
    });
  }

  test("the initial zero is cancellation, and Apply changes every output from the same settings", async () => {
    await mount();
    const original = readouts(container);
    expect(original.electric?.y).toBe("1.60218×10−16");
    expect(original.magnetic?.y).toBe("−1.60218×10−16");
    expect(original.total).toEqual({
      x: "0.00000",
      y: "0.00000",
      z: "0.00000",
      magnitude: "0.00000",
      direction: "Zero force",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "The electric and magnetic forces cancel at this instant.",
    );
    const originalPictures = pictures(container);
    expect(originalPictures.length).toBeGreaterThan(0);

    await type("electricVpm", "500");
    expect(readouts(container)).toEqual(original);
    expect(pictures(container)).toEqual(originalPictures);
    expect(button("Stop the charge").disabled).toBe(true);
    expect(button("1000 km/s along the field axis").disabled).toBe(true);
    expect(container.textContent).toContain("Apply your changes before using a shortcut");

    await submit();
    const applied = readouts(container);
    expect(applied.electric?.y).toBe("8.01088×10−17");
    expect(applied.magnetic).toEqual(original.magnetic);
    expect(applied.total?.y).toBe("−8.01088×10−17");
    expect(applied.total?.magnitude).toBe("8.01088×10−17");
    expect(applied.total?.direction).toBe("down (−y)");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "The total force points down (−y).",
    );
    expect(container.querySelectorAll('[role="status"]').length).toBe(1);
    const totalArrow = container.querySelectorAll("svg")[2]?.querySelector(".bridge-arrow");
    expect(totalArrow).not.toBeNull();
    expect(Number(totalArrow?.getAttribute("y2"))).toBeGreaterThan(
      Number(totalArrow?.getAttribute("y1")),
    );
    expect(button("Stop the charge").disabled).toBe(false);
  });

  test("changing the charge sign reverses both contributions only when applied", async () => {
    await mount();
    await type("electricVpm", "500");
    await submit();
    const positive = readouts(container);
    await choose("charge", "negative");
    expect(readouts(container)).toEqual(positive);
    expect(button("Stop the charge").disabled).toBe(true);
    await submit();
    const negative = readouts(container);
    expect(negative.electric?.y).toBe("−8.01088×10−17");
    expect(negative.magnetic?.y).toBe("1.60218×10−16");
    expect(negative.total?.y).toBe("8.01088×10−17");
    expect(negative.total?.direction).toBe("up (+y)");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Charge: Negative charge (−e)",
    );
  });

  test("stopping and moving along the field axis remove the magnetic force for different reasons", async () => {
    await mount();
    const electric = readouts(container).electric;
    await act(async () => button("Stop the charge").click());
    expect(readouts(container).electric).toEqual(electric);
    expect(readouts(container).magnetic?.magnitude).toBe("0.00000");
    expect(readouts(container).total?.y).toBe("1.60218×10−16");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "The charge is at rest, so the magnetic force is zero.",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="speedKms"]')?.value).toBe("0");

    await act(async () => button("1000 km/s along the field axis").click());
    expect(container.querySelector<HTMLInputElement>('input[name="speedKms"]')?.value).toBe("1000");
    expect(container.querySelector<HTMLSelectElement>('select[name="direction"]')?.value).toBe("z");
    expect(readouts(container).electric).toEqual(electric);
    expect(readouts(container).magnetic?.magnitude).toBe("0.00000");
    expect(readouts(container).total?.y).toBe("1.60218×10−16");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "the magnetic force is zero even though the charge is moving",
    );
  });

  test("invalid or empty drafts preserve the table, arrows and accepted description", async () => {
    await mount();
    await type("electricVpm", "500");
    await submit();
    const accepted = readouts(container);
    const acceptedPictures = pictures(container);
    const acceptedDescription = container.querySelector('[role="status"]')?.textContent;
    for (const value of ["2001", ""]) {
      await type("electricVpm", value);
      await submit();
      expect(readouts(container)).toEqual(accepted);
      expect(pictures(container)).toEqual(acceptedPictures);
      expect(container.querySelector('[role="status"]')?.textContent).toBe(acceptedDescription);
      const field = container.querySelector('input[name="electricVpm"]');
      expect(field?.getAttribute("aria-invalid")).toBe("true");
      expect(field?.getAttribute("aria-describedby")).toBe(
        container.querySelector('[role="alert"]')?.id,
      );
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "Enter an electric field from −2000 to 2000 volts per metre",
      );
    }
    await act(async () => button("Reset balanced example").click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="electricVpm"]')?.value).toBe(
      "1000",
    );
    expect(readouts(container).total?.magnitude).toBe("0.00000");
  });

  test("zero fields stay inspectable and a force too small to draw is not called zero", async () => {
    await mount();
    await type("electricVpm", "0");
    await type("magneticMt", "0");
    await submit();
    for (const row of Object.values(readouts(container))) {
      expect(row.magnitude).toBe("0.00000");
      expect(row.direction).toBe("Zero force");
    }
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Both contributions are zero.",
    );
    expect(container.querySelector("svg .bridge-arrow")).toBeNull();

    await type("electricVpm", "1e-12");
    await submit();
    expect(readouts(container).total?.y).toBe("1.60218×10−31");
    expect(readouts(container).total?.direction).toBe("up (+y)");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "The total force points up (+y).",
    );
    expect(container.querySelector('[role="status"]')?.textContent).not.toContain(
      "The total force is zero.",
    );
  });

  test("two instances have unique labelled controls and keep independent applied states", async () => {
    await act(async () => {
      root.render(
        <>
          <FoundationConstruction foundationId="electromagnetism-charges" />
          <FoundationConstruction foundationId="foundation:electromagnetism-charges" />
        </>,
      );
    });
    const regions = container.querySelectorAll(
      '[data-foundation-construction="electromagnetism-charges"]',
    );
    expect(regions.length).toBe(2);
    const first = regions[0] as HTMLElement;
    const second = regions[1] as HTMLElement;
    const controls = [
      ...container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
    ];
    const ids = controls.map((control) => control.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const control of controls) {
      expect(control.labels?.length).toBeGreaterThan(0);
    }
    const secondReadouts = readouts(second);
    const secondPictures = pictures(second);

    await type("electricVpm", "500", first);
    await submit(first);
    expect(readouts(first).total?.direction).toBe("down (−y)");
    expect(readouts(second)).toEqual(secondReadouts);
    expect(pictures(second)).toEqual(secondPictures);
  });
});

test("the charge lesson remains meaningful without JavaScript or a visible force arrow", () => {
  const html = renderToStaticMarkup(
    <FoundationConstruction foundationId="electromagnetism-charges" headingLevel={4} />,
  );
  expect(html).toContain("JavaScript is off, so the controls below cannot change anything.");
  expect(html).toContain("<h4");
  expect(html).toContain("Ideal model, host calculation");
  expect(html).toContain(
    "<caption>Separate forces and their total at the applied settings</caption>",
  );
  for (const contribution of ["electric", "magnetic", "total"]) {
    expect(html).toContain('data-force="' + contribution + '"');
  }
  expect(html).toContain('scope="row"');
  expect(html).toContain('scope="col"');
  expect(html).toContain("The electric and magnetic forces cancel at this instant.");
  expect(html).toContain("What it shows, in words");
  expect(html).toContain("does not calculate acceleration or follow a trajectory");
  expect(html).toContain('href="/lab/sr-02/"');
  expect(html).toContain('href="/lab/sr-08/"');
  expect(html).toContain('href="/papers/special-relativity/s6/"');
  expect(html).toContain('href="/papers/special-relativity/s10/"');
  expect(html).not.toContain("<canvas");
});
