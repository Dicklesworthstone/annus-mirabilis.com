import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { SpeedSpread } from "../components/foundations/SpeedSpread.tsx";
import { checkVoice } from "../content/checks/voice/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/** am-found-transport-thermo-smv3: the speed-distribution picture as a reader gets it. */

const words = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");
const ticks = (root: ParentNode) =>
  [...root.querySelectorAll("svg text")].map((t) => t.textContent);

describe("the picture, as first drawn", () => {
  const html = renderToStaticMarkup(<SpeedSpread />);

  test("labelled for a nitrogen molecule, with the width marked in its aria label", () => {
    expect(html).toContain('data-foundation-construction="temperature-thermal-energy"');
    expect(words(html)).toContain(
      "At 293 K, a nitrogen molecule moves along one axis with a spread of about 295 m/s.",
    );
    expect(words(html)).toContain("−590 −295 0 295 590");
    expect(html).toContain("with its width marked at 295 m/s");
  });

  test("the regions are named in words, and the voice lint finds no error", () => {
    expect(words(html)).toContain("about 38 per cent of them");
    expect(words(html)).toContain("about 5 per cent");
    const errors = checkVoice(words(html), { context: "prose" }).filter(
      (f) => f.severity === "error",
    );
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});

describe("relabelling for the grain changes the numbers, not the curve", () => {
  let container: HTMLElement;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
  });
  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  test("the ticks and the status change; the curve's path does not", async () => {
    const root = createRoot(container);
    await act(async () => root.render(<SpeedSpread />));
    const curve = () => container.querySelector("path.curves-band-second")?.getAttribute("d");
    const before = curve();
    const grain = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "a 0.5 μm grain",
    );
    await act(async () => grain?.click());
    expect(ticks(container)).toEqual(["−5", "−2.5", "0", "2.5", "5", "speed along one axis, mm/s"]);
    expect(words(container.querySelector('[role="status"]')?.textContent ?? "")).toContain(
      "about 2.5 mm/s",
    );
    expect(grain?.getAttribute("aria-pressed")).toBe("true");
    expect(curve()).toBe(before);
    await act(async () => root.unmount());
  });
});
