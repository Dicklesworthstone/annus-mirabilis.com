import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import HistoricalModeAllocationPage, { metadata } from "../../app/lab/lq-02/1904/page.tsx";
import { DEFAULT_HISTORICAL_LQ02_INPUTS } from "../../experiments/lq02/historical.ts";
import { historicalLq02Tape } from "../../experiments/lq02/historicalTape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { HistoricalModeAllocationLab } from "./HistoricalModeAllocationLab.tsx";
import { HistoricalModeAllocationPreview } from "./HistoricalModeAllocationPreview.tsx";

describe("1904 allocation is readable before JavaScript", () => {
  test("the preview and live laboratory render real relative values and Planck's own number", () => {
    for (const element of [
      <HistoricalModeAllocationPreview key="preview" />,
      <HistoricalModeAllocationLab key="lab" />,
    ]) {
      const html = renderToStaticMarkup(element);
      expect(html).toContain('data-mode="lq-02:1904"');
      expect(html).toContain('data-constant-set="planck-1900-1901-printed"');
      expect(html).toContain("Static worked example");
      expect(html).not.toContain("data-execution-label");
      expect(html).toContain('data-output="energyUpToCutoff" data-result-status="symbolic"');
      expect(html).toContain("0.9990000");
      expect(html).toContain("1000.000");
      expect(html).toContain("6.175 times 10 to the power 23");
      expect(html).toContain("p. 565");
      expect(html).not.toMatch(
        /2019|modernComparisons|6\.02214076|299792458|Einstein|hydrogen|k_B|mode counting|hν/,
      );
    }
  });

  test("dedicated historical route is self canonical, noindex and has a no-script worked case", () => {
    expect(metadata.alternates?.canonical).toBe("/lab/lq-02/1904/");
    expect(metadata.robots).toEqual({ index: false });
    const html = renderToStaticMarkup(<HistoricalModeAllocationPage />);
    expect(html).toContain("JavaScript is off");
    expect(html).toContain("/1904/#object-spectrum");
    expect(html).toContain("Rayleigh");
    expect(html).toContain("1900");
    expect(html).not.toContain("2019");
    expect(html).not.toContain('type="range"');
  });
});

type Handlers = Record<string, ((event: unknown) => void) | undefined>;

function element<T extends Element>(container: HTMLElement, selector: string): T {
  const found = container.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found as T;
}

function handlers(control: Element, target: Element = control): Handlers {
  const input = control.closest("form")?.querySelector("input");
  const key = [control, ...(input ? [input] : [])]
    .flatMap((candidate) => Object.keys(candidate))
    .find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error("The mounted control has no React handlers");
  const props = (target as unknown as Record<string, Handlers | undefined>)[key];
  if (!props) throw new Error("The mounted control's props were not found");
  return props;
}

async function change(container: HTMLElement, field: string, value: string) {
  const input = element<HTMLInputElement>(container, `input[name="${field}"]`);
  await act(async () => {
    input.value = value;
    handlers(input).onChange?.({ target: input, currentTarget: input });
  });
}

async function apply(container: HTMLElement) {
  const input = element<HTMLInputElement>(container, 'input[name="T"]');
  const form = element<HTMLFormElement>(container, 'form[aria-label="1904 allocation settings"]');
  await act(async () => {
    handlers(input, form).onSubmit?.({ preventDefault() {} });
  });
}

async function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === label,
  );
  expect(button).toBeDefined();
  await act(async () => {
    button?.click();
  });
}

function output(container: HTMLElement, name: string): string | null {
  return element(container, `[data-output="${name}"]`).textContent;
}

async function withLab(
  run: (container: HTMLElement) => Promise<void>,
  address = "/lab/lq-02/1904/",
) {
  window.history.replaceState(null, "", address);
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(<HistoricalModeAllocationLab />);
    });
    await run(container);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
}

describe("1904 allocation accepted settings", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("typed edits wait for Apply; widening changes the same accepted snapshot", async () => {
    await withLab(async (container) => {
      const root = element(container, '[data-instrument-id="lq-02"]');
      const original = output(container, "relativeEnergy");
      await change(container, "T", "3000");
      expect(output(container, "relativeEnergy")).toBe(original);
      expect(container.textContent).toContain("Static worked example");
      await apply(container);
      expect(output(container, "relativeEnergy")).toBe("2.000000");
      expect(container.textContent).toContain("Calculated from the accepted settings");
      await click(container, "Widen tenfold");
      expect(output(container, "relativeEnergy")).toBe("2000.000");
      expect(root.getAttribute("data-accepted-input-revision")).toBe("2");
      expect(
        element(container, '[data-output="energyUpToCutoff"]').getAttribute("data-result-status"),
      ).toBe("symbolic");
    });
  });

  test("refused edits retain accepted outputs and removing the cutoff shows a separate divergence", async () => {
    await withLab(async (container) => {
      await click(container, "Widen tenfold");
      const accepted = output(container, "relativeEnergy");
      await change(container, "T", "-1");
      await apply(container);
      expect(output(container, "relativeEnergy")).toBe(accepted);
      expect(container.textContent).toContain("positive, finite number");
      expect(container.textContent).toContain("last accepted inputs");
      expect(
        element(container, '[data-instrument-id="lq-02"]').getAttribute(
          "data-accepted-input-revision",
        ),
      ).toBe("1");
      await click(container, "Remove the upper limit");
      expect(output(container, "classicalTotal")).toContain("No finite total");
      expect(output(container, "relativeEnergy")).toBe(accepted);
    });
  });

  test("a probe beyond the cutoff receives its own refusal while other outputs survive", async () => {
    await withLab(async (container) => {
      await change(container, "probeFrequency", "2e14");
      await apply(container);
      expect(output(container, "shareAboveProbe")).toContain("probe is above");
      expect(
        element(container, '[data-output="shareAboveProbe"]').getAttribute("data-result-status"),
      ).toBe("outside-domain");
      expect(output(container, "relativeEnergy")).toBe("1.000000");
    });
  });

  test("shared historical settings restore only the form and re-share the dedicated mode", async () => {
    const tape = historicalLq02Tape({ ...DEFAULT_HISTORICAL_LQ02_INPUTS, T: 3000 });
    if (!tape) throw new Error("Expected a historical tape");
    const address = `/lab/lq-02/1904/?tape=${encodeTapePermalink(tape)}`;
    await withLab(async (container) => {
      // The browser codec is asynchronous. Flush its bounded stream work before inspecting the form.
      for (
        let attempt = 0;
        attempt < 30 && !container.textContent?.includes("Shared settings");
        attempt++
      )
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      expect(container.textContent).toContain("Shared settings are in the form");
      expect(element<HTMLInputElement>(container, 'input[name="T"]').value).toBe("3000");
      expect(output(container, "relativeEnergy")).toBe("1.000000");
      await apply(container);
      for (let attempt = 0; attempt < 30 && !container.querySelector("input[readonly]"); attempt++)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      const link = element<HTMLInputElement>(container, "input[readonly]").value;
      expect(new URL(link).pathname).toBe("/lab/lq-02/1904/");
      const decoded = decodeTapePermalink(new URL(link));
      expect(decoded.kind).toBe("success");
      if (decoded.kind === "success") {
        expect(decoded.tape.mode).toBe("lq-02:1904");
        expect(decoded.tape.initialConditions.T).toBe(3000);
      }
    }, address);
  });
});
