import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { type ShelfId, shelfDefaults, shelfPath } from "../../../experiments/shelf/definition.ts";
import { decodeShelfSettings, encodeShelfSettings } from "../../../experiments/shelf/settings.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { HistoricalShelfLab } from "./HistoricalShelfLab.tsx";

type Handlers = Record<string, ((event: unknown) => void) | undefined>;

function element<T extends Element>(container: ParentNode, selector: string): T {
  const result = container.querySelector<T>(selector);
  expect(result).not.toBeNull();
  return result as T;
}

function handlers(control: Element, target: Element = control): Handlers {
  const input = control.closest("form")?.querySelector("input");
  const key = [control, ...(input ? [input] : [])]
    .flatMap((candidate) => Object.getOwnPropertyNames(candidate))
    .find((name) => name.startsWith("__reactProps$"));
  expect(key).toBeDefined();
  if (!key) return {};
  const props = (target as unknown as Record<string, Handlers | undefined>)[key];
  expect(props).toBeDefined();
  return props ?? {};
}

async function change(container: ParentNode, name: string, value: string | boolean) {
  const control = element<HTMLInputElement | HTMLSelectElement>(container, `[name="${name}"]`);
  await act(async () => {
    if (typeof value === "boolean" && control instanceof HTMLInputElement) control.checked = value;
    else control.value = String(value);
    const onChange = handlers(control).onChange;
    expect(onChange).toBeDefined();
    onChange?.({ target: control, currentTarget: control });
  });
}

async function apply(container: ParentNode) {
  const control = element<HTMLInputElement>(container, "input");
  const form = element<HTMLFormElement>(container, "form");
  await act(async () => {
    const onSubmit = handlers(control, form).onSubmit;
    expect(onSubmit).toBeDefined();
    onSubmit?.({ preventDefault() {} });
  });
}

function value(container: ParentNode, quantityId: string): number {
  const output = element(container, `[data-output="${quantityId}"]`);
  expect(output.getAttribute("data-result-status")).toBe("value");
  const raw = output.getAttribute("data-value");
  expect(raw).not.toBeNull();
  return Number(raw);
}

async function withLab(
  instrumentId: ShelfId,
  run: (container: HTMLElement) => Promise<void>,
  address = shelfPath(instrumentId, "1904"),
) {
  window.history.replaceState(null, "", address);
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => root.render(<HistoricalShelfLab instrumentId={instrumentId} />));
    await run(container);
  } finally {
    await act(async () => root.unmount());
    removeContainer(container);
  }
}

describe("1904 optical comparisons apply the actual guarded shelf sessions", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("MM uses accepted settings, changes its physical run, and keeps contraction at a null prediction", async () => {
    await withLab("shelf-michelson-morley", async (container) => {
      const lab = element(container, "[data-instrument-id]");
      const initialRun = lab.getAttribute("data-run-id");
      const initialShift = value(container, "etherShift");
      await change(container, "beta", "2e-4");
      expect(value(container, "etherShift")).toBe(initialShift);
      expect(lab.getAttribute("data-execution-label")).toBe("static");
      await apply(container);
      expect(value(container, "etherShift") / initialShift).toBeCloseTo(4, 5);
      expect(value(container, "contractedShift")).toBe(0);
      expect(lab.getAttribute("data-run-id")).not.toBe(initialRun);
      expect(lab.getAttribute("data-execution-label")).toBe("host");
      await change(container, "contraction", true);
      await apply(container);
      expect(element(container, '[data-selected-model="true"]').textContent).toContain(
        "With contraction",
      );
      expect(value(container, "etherShift")).toBeGreaterThan(1.5);
    });
  });

  test("rotating the MM schematic changes presentation without creating another physical run", async () => {
    await withLab("shelf-michelson-morley", async (container) => {
      const lab = element(container, "[data-instrument-id]");
      const run = lab.getAttribute("data-run-id");
      const revision = lab.getAttribute("data-accepted-input-revision");
      const shift = value(container, "etherShift");
      await change(container, "orientation", "90");
      expect(element(container, "svg").getAttribute("data-orientation")).toBe("0");
      await apply(container);
      expect(element(container, "svg").getAttribute("data-orientation")).toBe("90");
      expect(lab.getAttribute("data-run-id")).toBe(run);
      expect(lab.getAttribute("data-accepted-input-revision")).toBe(revision);
      expect(value(container, "etherShift")).toBe(shift);
    });
  });

  test("a cleared field refuses the edit and retains the accepted values and link", async () => {
    await withLab("shelf-michelson-morley", async (container) => {
      await change(container, "beta", "2e-4");
      await apply(container);
      const lab = element(container, "[data-instrument-id]");
      const run = lab.getAttribute("data-run-id");
      const shift = value(container, "etherShift");
      const link = element<HTMLAnchorElement>(container, 'a[href*="?shelf="]');
      const href = link.getAttribute("href");
      await change(container, "beta", "");
      await apply(container);
      expect(element<HTMLInputElement>(container, '[name="beta"]').value).toBe("");
      expect(lab.getAttribute("data-run-id")).toBe(run);
      expect(value(container, "etherShift")).toBe(shift);
      expect(link.getAttribute("href")).toBe(href);
      expect(lab.getAttribute("data-currency-state")).toBe("refused");
      expect(element(container, '[role="alert"]').textContent).toContain("last accepted settings");
      await change(container, "beta", "0");
      await apply(container);
      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(value(container, "etherShift")).toBe(0);
    });
  });

  test("reversing Fizeau's flow changes its sign, while the reversal protocol doubles the comparison", async () => {
    await withLab("shelf-fizeau", async (container) => {
      const oneDirection = value(container, "fresnel-drag-shift");
      expect(oneDirection).toBeGreaterThan(0);
      expect(value(container, "no-drag-shift")).toBe(0);
      expect(value(container, "full-drag-shift")).toBeGreaterThan(oneDirection);
      await change(container, "reversal", true);
      await apply(container);
      expect(value(container, "fresnel-drag-shift")).toBeCloseTo(oneDirection * 2, 12);
      await change(container, "waterSpeedFractionOfC", "-2.35e-8");
      await apply(container);
      expect(value(container, "fresnel-drag-shift")).toBeCloseTo(-oneDirection * 2, 12);
    });
  });

  test("a Fizeau beam that cannot return gets a model-domain explanation, never a fringe number", async () => {
    await withLab("shelf-fizeau", async (container) => {
      await change(container, "waterSpeedFractionOfC", "0.9");
      await apply(container);
      const full = element(container, '[data-output="full-drag-shift"]');
      expect(full.getAttribute("data-result-status")).toBe("outside-domain");
      expect(full.getAttribute("data-value")).toBeNull();
      expect(full.textContent).toContain("cannot return");
      expect(value(container, "no-drag-shift")).toBe(0);
      expect(value(container, "fresnel-drag-shift")).toBeGreaterThan(0);
    });
  });

  test("a Maxwell observer change keeps run identity and updates both wave directions", async () => {
    await withLab("shelf-maxwell-galilean", async (container) => {
      const lab = element(container, "[data-instrument-id]");
      const run = lab.getAttribute("data-run-id");
      const observer = lab.getAttribute("data-observer-revision");
      await change(container, "beta", "0.2");
      await change(container, "map", "lorentz");
      await apply(container);
      expect(lab.getAttribute("data-run-id")).toBe(run);
      expect(lab.getAttribute("data-observer-revision")).not.toBe(observer);
      expect(value(container, "galilean-forward")).toBeCloseTo(0.36, 12);
      expect(value(container, "galilean-backward")).toBeCloseTo(0.44, 12);
      expect(value(container, "lorentz-forward")).toBe(0);
      expect(value(container, "lorentz-backward")).toBe(0);
      expect(element(container, '[data-selected-model="true"]').textContent).toContain("1904");
    });
  });

  test("settings links load the form only, then round-trip the accepted historical calculation", async () => {
    const instrumentId = "shelf-fizeau";
    const parameters = {
      ...shelfDefaults(instrumentId, "1904"),
      reversal: true,
      waterPathPerBeam: 6,
    };
    await withLab(
      instrumentId,
      async (container) => {
        const lab = element(container, "[data-instrument-id]");
        expect(element(container, "[data-settings-loaded]").textContent).toContain(
          "Apply them to calculate",
        );
        expect(element<HTMLInputElement>(container, '[name="waterPathPerBeam"]').value).toBe("6");
        expect(element<HTMLInputElement>(container, '[name="reversal"]').checked).toBe(true);
        expect(lab.getAttribute("data-execution-label")).toBe("static");
        const initial = value(container, "fresnel-drag-shift");
        await apply(container);
        expect(value(container, "fresnel-drag-shift")).toBeCloseTo(initial * 4, 12);
        const href = element<HTMLAnchorElement>(container, 'a[href*="?shelf="]').href;
        const decoded = decodeShelfSettings(instrumentId, "1904", new URL(href).search);
        expect(decoded).toEqual({ kind: "settings", parameters });
      },
      encodeShelfSettings(instrumentId, "1904", parameters),
    );
  });

  test("a full-mode settings payload cannot enter a historical comparison", async () => {
    const instrumentId = "shelf-fizeau";
    const fullLink = encodeShelfSettings(instrumentId, "full", shelfDefaults(instrumentId, "full"));
    await withLab(
      instrumentId,
      async (container) => {
        expect(element(container, "[data-settings-notice]").textContent).toContain(
          "another experiment or mode",
        );
        expect(container.querySelector("[data-settings-loaded]")).toBeNull();
        expect(element<HTMLInputElement>(container, '[name="waterSpeedFractionOfC"]').value).toBe(
          "2.35e-8",
        );
        expect(
          element(container, "[data-instrument-id]").getAttribute("data-execution-label"),
        ).toBe("static");
        expect(container.innerHTML).not.toMatch(/299792458|modern-si-2019|laterSpeed/);
      },
      `${shelfPath(instrumentId, "1904")}${new URL(fullLink, "http://localhost").search}`,
    );
  });

  test("two desk copies have independent accepted sessions and do not consume another route's link", async () => {
    const shared = encodeShelfSettings("shelf-fizeau", "1904", {
      ...shelfDefaults("shelf-fizeau", "1904"),
      reversal: true,
    });
    window.history.replaceState(null, "", `/1904/${new URL(shared, "http://localhost").search}`);
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <>
            <HistoricalShelfLab instrumentId="shelf-michelson-morley" />
            <HistoricalShelfLab instrumentId="shelf-michelson-morley" />
          </>,
        ),
      );
      const labs = [...container.querySelectorAll<HTMLElement>("[data-instrument-id]")];
      const first = labs[0];
      const second = labs[1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      if (!first || !second) return;
      expect(first.getAttribute("data-instance-id")).not.toBe(
        second.getAttribute("data-instance-id"),
      );
      const secondRun = second.getAttribute("data-run-id");
      const secondShift = value(second, "etherShift");
      await change(first, "beta", "0");
      await apply(first);
      expect(value(first, "etherShift")).toBe(0);
      expect(second.getAttribute("data-run-id")).toBe(secondRun);
      expect(value(second, "etherShift")).toBe(secondShift);
      expect(container.querySelector("[data-settings-notice]")).toBeNull();
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });
});
