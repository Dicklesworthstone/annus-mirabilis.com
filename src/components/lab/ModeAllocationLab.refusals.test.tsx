import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ModeAllocationLab } from "./ModeAllocationLab.tsx";

/**
 * LQ-02 refuses a field that is not a positive quantity at the form, in words, and states a large
 * accepted temperature in powers of ten. On live on 2026-09-24 a cutoff of -1e300 reached the
 * kernel, and every energy row printed "Not modeled here: Cutoff frequency must be positive and
 * finite (got -1e+300)."; a temperature of 1e300 was stated "at 1e+300 K".
 */
type Props = Record<string, ((event: unknown) => void) | undefined>;
function reactProps(el: Element): Props {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
  return key ? ((el as unknown as Record<string, Props>)[key] ?? {}) : {};
}
function field(container: HTMLElement, label: string): HTMLInputElement {
  const l = [...container.querySelectorAll("label")].find((x) => x.textContent === label);
  const input = container.querySelector<HTMLInputElement>(`#${CSS.escape(l?.htmlFor ?? "")}`);
  if (!input) throw new TypeError(`no field labelled ${label}`);
  return input;
}
/** Under this happy-dom harness dispatched events do not reach React, so the props are called. */
function type(input: HTMLInputElement, value: string) {
  const onChange = reactProps(input).onChange;
  expect(onChange).toBeDefined();
  input.value = value;
  onChange?.({ currentTarget: input, target: input });
}
/**
 * The form's current onSubmit. happy-dom's form element does not list React's expando keys, but
 * reading one by name works, and the name is the input's props key: React gives every element in a
 * root the same suffix.
 */
function submit(input: HTMLInputElement) {
  const key = Object.keys(input).find((k) => k.startsWith("__reactProps$")) ?? "";
  const form = input.closest("form");
  const onSubmit = form
    ? (form as unknown as Record<string, Props | undefined>)[key]?.onSubmit
    : undefined;
  expect(onSubmit).toBeDefined();
  onSubmit?.({ preventDefault() {} });
}

/**
 * What the LAB says, without the show-the-code panel's quoted kernel source. That source carries
 * literals like 6.1e-57 and 1.602176634e-19, which would trip the scans below although a reader
 * only meets them by opening a closed <details> to read code. The clone keeps React's own tree
 * untouched, since these cases go on rendering into the same container afterwards.
 */
function readerText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const panel of [...clone.querySelectorAll("details.show-the-code")]) panel.remove();
  return clone.textContent ?? "";
}

describe("LQ-02 refuses a non-positive field and states a large temperature readably", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("the code-panel filter takes the panel and nothing beside it", () => {
    const container = createContainer();
    try {
      container.innerHTML = "<p>kept 1e+300</p>";
      expect(readerText(container)).toBe("kept 1e+300");
      container.innerHTML =
        '<p>kept 1e+300</p><details class="show-the-code"><p>dropped 6.1e-57</p></details>';
      expect(readerText(container)).toBe("kept 1e+300");
      // The container itself is left as it was, which is what the clone is for.
      expect(container.textContent).toContain("dropped 6.1e-57");
    } finally {
      removeContainer(container);
    }
  });

  test("a negative cutoff is refused at the form and never reaches the table", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(ModeAllocationLab));
      });
      const cutoff = field(container, "Highest resonator frequency, the cutoff (Hz)");
      await act(async () => {
        type(cutoff, "-1e300");
      });
      await act(async () => {
        submit(cutoff);
      });
      const alert = container.querySelector("[role=alert]");
      // The declared range in words (validateLq02Parameters, dispatch 184), and the kept sentence.
      expect(alert?.textContent).toMatch(
        /^Enter the highest resonator frequency greater than 0 Hz, the range this model describes: /,
      );
      expect(alert?.textContent).toContain("still those of the last accepted settings");
      expect(container.textContent).not.toContain("Not modeled here: Cutoff frequency");
      expect(readerText(container)).not.toMatch(/\de[+-]\d/);

      const temperature = field(container, "Temperature (K)");
      // One field per act: each onChange closes over the draft of the render it came from.
      await act(async () => {
        type(cutoff, "1e14");
      });
      await act(async () => {
        type(temperature, "1e300");
      });
      await act(async () => {
        submit(cutoff);
      });
      expect(container.querySelector("[role=alert]")).toBeNull();
      expect(container.textContent).toContain("at 1 × 10³⁰⁰ K");
      expect(readerText(container)).not.toContain("1e+300");
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("probe changes publish measurement revisions while retaining the accepted physical setup", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(ModeAllocationLab));
      });
      const lab = container.querySelector<HTMLElement>('[data-instrument-id="lq-02"]');
      if (!lab) throw new TypeError("The mode-allocation laboratory did not mount.");
      const probe = field(container, "Probe frequency, for the share-above readout (Hz)");
      const inputRevision = lab.getAttribute("data-accepted-input-revision");
      const runId = lab.getAttribute("data-run-id");
      const measurementRevision = lab.getAttribute("data-accepted-measurement-revision");
      expect(measurementRevision).toMatch(/^\d+$/);
      expect(lab.getAttribute("data-measurement-revision")).toBe(measurementRevision);

      const readout = (label: string): string => {
        const row = [...container.querySelectorAll("tr")].find(
          (entry) => entry.querySelector("th")?.textContent === label,
        );
        const text = row?.querySelector("td")?.textContent;
        if (text === undefined || text === null) throw new TypeError(`No readout: ${label}`);
        return text;
      };
      const meanLabel = "Mean energy per resonator oscillation";
      const cutoffLabel = "Energy with resonators up to the cutoff";
      const shareLabel = "Share of that energy above the probe frequency";
      const mean = readout(meanLabel);
      const cutoff = readout(cutoffLabel);
      expect(readout(shareLabel)).toContain("0.9990000");

      for (const [index, value] of ["5e13", "1e300"].entries()) {
        await act(async () => {
          type(probe, value);
        });
        await act(async () => {
          submit(probe);
        });
        const acceptedMeasurement = String(Number(measurementRevision) + index + 1);
        expect(lab.getAttribute("data-accepted-measurement-revision")).toBe(acceptedMeasurement);
        expect(lab.getAttribute("data-measurement-revision")).toBe(acceptedMeasurement);
        expect(lab.getAttribute("data-accepted-input-revision")).toBe(inputRevision);
        expect(lab.getAttribute("data-input-revision")).toBe(inputRevision);
        expect(lab.getAttribute("data-run-id")).toBe(runId);
        expect(readout(meanLabel)).toBe(mean);
        expect(readout(cutoffLabel)).toBe(cutoff);
        expect(container.querySelector("[role=alert]")).toBeNull();
        expect(probe.value).toBe(value);
        expect(readerText(container)).not.toMatch(/\bNaN\b|\bInfinity\b/);
        if (index === 0) expect(readout(shareLabel)).toContain("0.8750000");
        else {
          // Positive probes have no declared upper bound. Unrepresentable probe energy is a
          // typed unavailable measurement, not a silently clamped value or a rejected setup.
          expect(readout(shareLabel)).toContain("Not modeled here:");
          expect(readout(shareLabel)).toContain(
            "needs both the cutoff and probe energies to be finite values",
          );
        }
      }
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
