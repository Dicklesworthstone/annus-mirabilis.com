import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import HistoricalGalileanPage from "../../../app/lab/sr-04/1904/page.tsx";
import { decodeTapePermalink, encodeTapePermalink } from "../../../experiments/permalink/codec.ts";
import { SR04_HISTORICAL_DEFAULTS } from "../../../experiments/sr04/historical.ts";
import { historicalSr04Tape } from "../../../experiments/sr04/historicalTape.ts";
import { withMode1904Guard } from "../../../physics/reference/constants.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { HistoricalGalileanLab } from "./HistoricalGalileanLab.tsx";

describe("the Galilean comparison without JavaScript", () => {
  test("the standalone route resolves its component and shows the complete guarded example", () => {
    const html = withMode1904Guard(() => renderToStaticMarkup(<HistoricalGalileanPage />));
    expect(html).toContain('data-instrument-mode="sr-04:1904"');
    expect(html).toContain('data-output="slowCaseGalilean">-20 m/s');
    expect(html).toContain('data-output="rightRayFraction">0.4 c');
    expect(html).toContain('data-output="leftRayFraction">-1.6 c');
    expect(html).toContain("Static worked example from illustrative settings");
    expect(html).toContain("not historical measurements");
    expect(html).toContain("<noscript>");
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain('href="/1904/#object-clocks"');
    expect(html).not.toContain("data-execution-label");
    expect(html).not.toMatch(
      /Lorentz factor|rapidity|eigenvalue|spacetime|Minkowski|postulate|relativistic|modern-si|299792458|candidateA|showLaterAids/i,
    );
    expect(html).not.toContain('type="range"');
  });
});

function find<T extends Element>(container: HTMLElement, selector: string): T {
  const result = container.querySelector<T>(selector);
  expect(result).not.toBeNull();
  return result as T;
}
type Handlers = Record<string, ((event: unknown) => void) | undefined>;
function props(input: HTMLInputElement, target: Element = input): Handlers {
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  const result = key ? (target as unknown as Record<string, Handlers>)[key] : undefined;
  expect(result).toBeDefined();
  return result ?? {};
}
async function edit(container: HTMLElement, key: string, value: string) {
  const input = find<HTMLInputElement>(container, `input[name="${key}"]`);
  await act(async () => {
    input.value = value;
    props(input).onChange?.({ currentTarget: input, target: input });
  });
}
async function submit(container: HTMLElement) {
  const input = find<HTMLInputElement>(container, 'input[name="objectSpeed"]');
  const form = find<HTMLFormElement>(container, 'form[aria-label="Galilean comparison settings"]');
  await act(async () => props(input, form).onSubmit?.({ preventDefault() {} }));
}
function readouts(container: HTMLElement) {
  return Object.fromEntries(
    [...container.querySelectorAll("[data-output]")].map((cell) => [
      cell.getAttribute("data-output"),
      cell.textContent,
    ]),
  );
}
async function settleUntil(check: () => boolean) {
  for (let attempt = 0; attempt < 30 && !check(); attempt++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  expect(check()).toBe(true);
}

describe("accepted settings and historical link restoration", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;
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
  async function render(restoreSettingsFromUrl = false) {
    await act(async () =>
      root.render(<HistoricalGalileanLab restoreSettingsFromUrl={restoreSettingsFromUrl} />),
    );
    await settleUntil(
      () => !!container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value,
    );
  }

  test("draft edits wait for Apply and a changed observer updates all three accepted predictions", async () => {
    await render();
    const previous = readouts(container);
    await edit(container, "objectSpeed", "50");
    await edit(container, "observerSpeed", "20");
    await edit(container, "vOverC", "-0.5");
    expect(readouts(container)).toEqual(previous);
    await submit(container);
    expect(readouts(container)).toEqual({
      slowCaseGalilean: "30 m/s",
      rightRayFraction: "1.5 c",
      leftRayFraction: "-0.5 c",
    });
    expect(
      find(container, "[data-instrument-id]").getAttribute("data-accepted-input-revision"),
    ).toBe("1");
    expect(container.textContent).toContain("Settings applied");
    expect(container.innerHTML).not.toContain("data-execution-label");
  });

  test("blank, overflow and boundary failures preserve the accepted table and name the failing field", async () => {
    await render();
    await edit(container, "objectSpeed", "50");
    await submit(container);
    const previous = readouts(container);
    for (const [key, value] of [
      ["objectSpeed", ""],
      ["objectSpeed", "1e400"],
      ["objectSpeed", "10001"],
      ["vOverC", "1"],
      ["vOverC", "0.96"],
    ]) {
      await edit(container, "objectSpeed", "50");
      await edit(container, "vOverC", "0.6");
      await edit(container, key ?? "", value ?? "");
      await submit(container);
      expect(readouts(container)).toEqual(previous);
      expect(
        find(container, "[data-instrument-id]").getAttribute("data-accepted-input-revision"),
      ).toBe("1");
      expect(find(container, "[data-instrument-id]").getAttribute("data-currency-state")).toBe(
        "refused",
      );
      expect(find(container, `input[name="${key}"]`).getAttribute("aria-invalid")).toBe("true");
      expect(find(container, '[role="alert"]').textContent).toContain("last accepted settings");
    }
    await edit(container, "vOverC", "-0.5");
    await submit(container);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(readouts(container).rightRayFraction).toBe("1.5 c");
  });

  test("standalone restoration fills the draft only, then shares the accepted historical settings", async () => {
    const inputs = { objectSpeed: -15, observerSpeed: 5, vOverC: -0.25 };
    const tape = historicalSr04Tape(inputs);
    expect(tape).not.toBeNull();
    if (!tape) return;
    window.history.replaceState(null, "", `/lab/sr-04/1904/?tape=${encodeTapePermalink(tape)}`);
    await render(true);
    await settleUntil(
      () => find<HTMLInputElement>(container, 'input[name="vOverC"]').value === "-0.25",
    );
    expect(readouts(container)).toEqual({
      slowCaseGalilean: "-20 m/s",
      rightRayFraction: "0.4 c",
      leftRayFraction: "-1.6 c",
    });
    expect(
      find(container, "[data-instrument-id]").getAttribute("data-accepted-input-revision"),
    ).toBe("0");
    const shared = () => find<HTMLInputElement>(container, '[data-testid="selectable-url"]').value;
    const before = decodeTapePermalink(new URL(shared()));
    expect(before.kind).toBe("success");
    if (before.kind === "success")
      expect(before.tape.initialConditions).toEqual(SR04_HISTORICAL_DEFAULTS);
    await submit(container);
    expect(readouts(container)).toEqual({
      slowCaseGalilean: "-20 m/s",
      rightRayFraction: "1.25 c",
      leftRayFraction: "-0.75 c",
    });
    await settleUntil(() => {
      const decoded = decodeTapePermalink(new URL(shared()));
      return decoded.kind === "success" && decoded.tape.initialConditions.vOverC === -0.25;
    });
    const decoded = decodeTapePermalink(new URL(shared()));
    expect(decoded.kind).toBe("success");
    if (decoded.kind === "success") expect(decoded.tape.initialConditions).toEqual(inputs);
    expect(new URL(shared()).pathname).toBe("/lab/sr-04/1904/");
  });

  test("a desk instance ignores the page's tape while a standalone instance refuses a later mode", async () => {
    const tape = historicalSr04Tape({ objectSpeed: -15, observerSpeed: 5, vOverC: -0.25 });
    expect(tape).not.toBeNull();
    if (!tape) return;
    window.history.replaceState(null, "", `/1904/?tape=${encodeTapePermalink(tape)}`);
    await render();
    expect(find<HTMLInputElement>(container, 'input[name="vOverC"]').value).toBe("0.6");
    expect(container.textContent).not.toContain("shared settings are in the form");
    window.history.replaceState(
      null,
      "",
      `/lab/sr-04/1904/?tape=${encodeTapePermalink({ ...tape, mode: "sr-04:default" })}`,
    );
    await render(true);
    await settleUntil(() => !!container.textContent?.includes("another mode"));
    expect(find<HTMLInputElement>(container, 'input[name="vOverC"]').value).toBe("0.6");
    expect(readouts(container).rightRayFraction).toBe("0.4 c");
  });
});
