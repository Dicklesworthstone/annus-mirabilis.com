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

function values(region: ParentNode): Record<string, string> {
  return Object.fromEntries(
    [...region.querySelectorAll('[role="status"] dt')].map((label) => [
      label.textContent ?? "",
      label.nextElementSibling?.textContent ?? "",
    ]),
  );
}

describe("fields and waves is operable through the foundation dispatcher", () => {
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

  async function type(name: string, value: string) {
    const input = container.querySelector<HTMLInputElement>('input[name="' + name + '"]');
    expect(input).not.toBeNull();
    expect(input?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      const field = input as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function submit() {
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  }

  test("typed settings update the curve, probe, table and cycle averages together on Apply", async () => {
    await act(async () => root.render(<FoundationConstruction foundationId="fields-waves" />));
    expect(values(container)).toEqual({
      Frequency: "599.5849 THz",
      "Time for one cycle": "1.6678 fs",
      "Mean field over a cycle": "0 V/m",
      "Mean square field over a cycle": "0.5 (V/m)²",
    });
    const oldCurve = container.querySelector("polyline")?.getAttribute("points");
    expect(oldCurve).toBeDefined();

    await type("wavelengthNm", "1000");
    await type("amplitudeVpm", "2");
    expect(container.querySelector("polyline")?.getAttribute("points")).toBe(oldCurve);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Applied wavelength: 500 nm",
    );
    expect(button("Advance a quarter period").disabled).toBe(true);
    expect(container.textContent).toContain("Apply your changes before advancing time");

    await submit();
    expect(values(container)).toEqual({
      Frequency: "299.7925 THz",
      "Time for one cycle": "3.3356 fs",
      "Mean field over a cycle": "0 V/m",
      "Mean square field over a cycle": "2 (V/m)²",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Applied wavelength: 1000 nm",
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Field amplitude: 2 V/m",
    );
    expect(container.querySelector("polyline")?.getAttribute("points")).not.toBe(oldCurve);
    expect(container.querySelector("circle")?.getAttribute("cy")).toBe("40");
    expect(container.querySelector("tbody td")?.textContent).toBe("2");
    expect(container.querySelectorAll("table")[1]?.textContent).toContain("Square: 4 (V/m)²");
    expect(button("Advance a quarter period").disabled).toBe(false);
    expect(container.querySelectorAll('[role="status"]').length).toBe(1);
  });

  test("one keyboard-operable step changes the instant and leaves frequency and cycle means fixed", async () => {
    await act(async () => root.render(<FoundationConstruction foundationId="fields-waves" />));
    const means = values(container);
    await act(async () => button("Advance a quarter period").click());
    expect(values(container)).toEqual(means);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "At position 0 nm and time 0.417 fs, the field is 0 V/m",
    );
    expect(container.querySelector("tbody td")?.textContent).toBe("0");
    await act(async () => button("Advance a quarter period").click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "the field is −1 V/m",
    );
    expect(container.querySelector("tbody td")?.textContent).toBe("−1");
    expect(values(container)).toEqual(means);
  });

  test("an invalid or empty draft retains all applied outputs and identifies the field", async () => {
    await act(async () => root.render(<FoundationConstruction foundationId="fields-waves" />));
    await type("probeNm", "125");
    await submit();
    const accepted = container.querySelector('[role="status"]')?.textContent;
    const oldCurve = container.querySelector("polyline")?.getAttribute("points");
    const oldTables = [...container.querySelectorAll("table")].map((table) => table.textContent);
    for (const invalid of ["21", ""]) {
      await type("timeFs", invalid);
      await submit();
      expect(container.querySelector('[role="status"]')?.textContent).toBe(accepted);
      expect(container.querySelector("polyline")?.getAttribute("points")).toBe(oldCurve);
      expect([...container.querySelectorAll("table")].map((table) => table.textContent)).toEqual(
        oldTables,
      );
      expect(container.querySelector('input[name="timeFs"]')?.getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "Enter an elapsed time from 0 to 20 femtoseconds",
      );
    }
    await act(async () => button("Reset worked example").click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="probeNm"]')?.value).toBe("0");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("the field is 1 V/m");
  });

  test("a small nonzero wave keeps its mean square visible without exposing phase roundoff", async () => {
    await act(async () => root.render(<FoundationConstruction foundationId="fields-waves" />));
    await type("amplitudeVpm", "0.001");
    await submit();
    const meanSquare = values(container)["Mean square field over a cycle"];
    expect(meanSquare).toMatch(/5.*10[−-]7/);
    expect(container.querySelectorAll("table")[1]?.textContent).toMatch(/Square: 1.*10[−-]6/);
    expect(values(container)["Mean field over a cycle"]).toBe("0 V/m");
    await act(async () => button("Advance a quarter period").click());
    expect(values(container)["Mean square field over a cycle"]).toBe(meanSquare);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("the field is 0 V/m");
    expect(container.querySelector("tbody td")?.textContent).toBe("0");
  });

  test("a zero field and the last allowed instant remain real inspectable states", async () => {
    await act(async () => root.render(<FoundationConstruction foundationId="fields-waves" />));
    await type("amplitudeVpm", "0");
    await type("timeFs", "20");
    await submit();
    expect(values(container)["Mean square field over a cycle"]).toBe("0 (V/m)²");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("the field is 0 V/m");
    expect(button("Advance a quarter period").disabled).toBe(true);
    expect(container.textContent).toContain("Another quarter period would pass 20 fs");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  test("two copies have unique labels and changing one does not change the other", async () => {
    await act(async () =>
      root.render(
        <>
          <FoundationConstruction foundationId="fields-waves" />
          <FoundationConstruction foundationId="foundation:fields-waves" />
        </>,
      ),
    );
    const regions = container.querySelectorAll("[data-foundation-construction]");
    expect(regions.length).toBe(2);
    const first = regions[0] as HTMLElement;
    const second = regions[1] as HTMLElement;
    expect(first.querySelector("input")?.id).not.toBe(second.querySelector("input")?.id);
    const secondPicture = second.querySelector("polyline")?.getAttribute("points");
    await act(async () => button("Advance a quarter period", first).click());
    expect(first.querySelector('[role="status"]')?.textContent).toContain("the field is 0 V/m");
    expect(second.querySelector('[role="status"]')?.textContent).toContain("the field is 1 V/m");
    expect(second.querySelector("polyline")?.getAttribute("points")).toBe(secondPicture);
  });
});

test("without JavaScript the complete worked example, meanings and next steps are still readable", () => {
  const html = renderToStaticMarkup(
    <FoundationConstruction foundationId="fields-waves" headingLevel={4} />,
  );
  expect(html).toContain("JavaScript is off, so the controls below cannot change anything.");
  expect(html).toContain("<h4");
  expect(html).toContain("One instant, many positions");
  expect(html).toContain("One position through a cycle");
  expect(html).toContain("What it shows, in words");
  expect(html).toContain("makes the mean square four times as large");
  expect(html).toContain("zero mean field does not imply zero energy delivered");
  expect(html).toContain("Ideal model, host calculation");
  expect(html).toContain('href="/papers/special-relativity/s7/"');
  expect(html).toContain('href="/lab/lq-01/"');
  expect(html.match(/<caption>/g)?.length).toBe(2);
  expect(html).not.toContain("<canvas");
});
