import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { EntropyTemperatureCheck } from "../components/foundations/EntropyTemperatureCheck.tsx";
import { checkVoice } from "../content/checks/voice/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * am-found-transport-thermo-smv3, the entropy-temperature check as a reader gets it: the worked
 * check always, the workbench by link and on request, and, per the test plan, "an unregistered
 * preset yields the status line, not a failure".
 */

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("with the workbench admitted as an embed", () => {
  const html = renderToStaticMarkup(<EntropyTemperatureCheck />);

  test("the worked check, a link to the workbench, and a closed disclosure with no frame in it", () => {
    expect(html).toContain('data-foundation-construction="entropy-temperature"');
    expect(text(html)).toContain("1 ÷ 3000 = 3.333 × 10⁻⁴ per kelvin");
    expect(html).toContain('href="/lab/lq-04/"');
    expect(html).toMatch(/<details><summary>Show the workbench here<\/summary><\/details>/);
    // Measured in Chromium: a lazy iframe inside a closed <details> still fetched the laboratory.
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("not yet available");
  });

  test("the voice lint finds no error", () => {
    const errors = checkVoice(text(html), { context: "prose" }).filter(
      (f) => f.severity === "error",
    );
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});

describe("opening the disclosure adds the workbench, and closing it removes it", () => {
  let container: HTMLElement;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
  });
  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  test("the frame appears only while the disclosure is open", async () => {
    const root = createRoot(container);
    await act(async () => root.render(<EntropyTemperatureCheck />));
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(container.querySelector("iframe")).toBeNull();

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("/embed/lab/lq-04/");
    expect(frame?.getAttribute("title")).toBe("Radiation entropy workbench, at 600 THz and 3000 K");

    await act(async () => {
      details.open = false;
      details.dispatchEvent(new Event("toggle"));
    });
    expect(container.querySelector("iframe")).toBeNull();
    await act(async () => root.unmount());
  });
});

describe("with an instrument that is not an admitted embed", () => {
  const html = renderToStaticMarkup(<EntropyTemperatureCheck instrumentId="lq-99" />);

  test("the status line, the worked check intact, and no link or embed", () => {
    expect(html).toContain("The interactive version is not yet available.");
    expect(text(html)).toContain("1 ÷ 3000 = 3.333 × 10⁻⁴ per kelvin");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("/lab/lq-99/");
  });
});
