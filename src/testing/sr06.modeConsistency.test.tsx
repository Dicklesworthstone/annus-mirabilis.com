import { afterEach, beforeEach, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VelocityCompositionLab } from "../components/lab/sr06/VelocityCompositionLab.tsx";
import { VelocityCompositionPlot } from "../components/lab/sr06/VelocityCompositionPlot.tsx";
import { encodeResult } from "../experiments/results/codec.ts";
import { SR06_DEFAULTS, type Sr06Parameters } from "../experiments/sr06/definition.ts";
import {
  createSr06Session,
  DEFAULT_PREPARED_EXAMPLE,
  evaluateSr06,
} from "../experiments/sr06/session.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(async () => {
  await installDom();
});
afterEach(uninstallDom);

function render(element: ReactNode): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(element);
  return host;
}

function plot(parameters: Sr06Parameters): HTMLElement {
  const snapshot = createSr06Session("sr06-mode-plot", parameters).getSnapshot().accepted;
  if (!snapshot) throw new Error("The real SR-06 session did not publish its initial result.");
  return render(<VelocityCompositionPlot snapshot={snapshot} />);
}

function lab(parameters: Sr06Parameters): HTMLElement {
  return render(
    <VelocityCompositionLab
      restoreFromLocation={false}
      example={{
        ...DEFAULT_PREPARED_EXAMPLE,
        parameters,
        results: evaluateSr06(parameters).map(encodeResult),
      }}
    />,
  );
}

function tip(host: HTMLElement, vector: string): readonly [number, number] {
  const path = host.querySelector(`[data-velocity-vector="${vector}"] path`);
  const coordinates = /^M100 100 L(\S+) (\S+)$/.exec(path?.getAttribute("d") ?? "");
  if (!coordinates?.[1] || !coordinates[2]) throw new Error(`Missing ${vector} vector.`);
  return [Number(coordinates[1]), Number(coordinates[2])];
}

test("the two-boost drawing uses the selected second boost, not saved moving-point controls", () => {
  const host = plot({
    ...SR06_DEFAULTS,
    mode: "two-boosts",
    movingSpeed: 0.8,
    alphaDeg: 180,
    secondBeta: 0.2,
    secondAngleDeg: 90,
  });
  // At this scale: w=(0, .2), Galilean=(.6, .2), U=(.6, .16), all in units of c.
  const [wx, wy] = tip(host, "w");
  expect(wx).toBeCloseTo(100, 12);
  expect(wy).toBeCloseTo(84, 12);
  const [gx, gy] = tip(host, "Galilean");
  expect(gx).toBeCloseTo(148, 12);
  expect(gy).toBeCloseTo(84, 12);
  const [ux, uy] = tip(host, "U");
  expect(ux).toBeCloseTo(148, 12);
  expect(uy).toBeCloseTo(87.2, 12);
  expect(host.textContent).toContain("second boost velocity, measured in the intermediate frame");
});

test("near-light composition keeps the Galilean counterexample visible at the same scale as c", () => {
  const host = plot({ ...SR06_DEFAULTS, frameBeta: 0.99, movingSpeed: 0.99 });
  const radius = Number(host.querySelector("circle")?.getAttribute("r"));
  expect(radius).toBeCloseTo(80 / 1.98, 12);
  const [gx, gy] = tip(host, "Galilean");
  expect(gx).toBeCloseTo(180, 12);
  expect(gy).toBe(100);
  const [ux] = tip(host, "U");
  expect((ux - 100) / radius).toBeCloseTo(19800 / 19801, 12);
  for (const label of ["v", "w", "Galilean", "U"]) {
    const [x, y] = tip(host, label);
    expect(x).toBeGreaterThanOrEqual(20);
    expect(x).toBeLessThanOrEqual(180);
    expect(y).toBeGreaterThanOrEqual(20);
    expect(y).toBeLessThanOrEqual(180);
  }
});

test("an unavailable owner result does not turn into zero-length velocity arrows", () => {
  const host = plot({ ...SR06_DEFAULTS, frameBeta: 1 });
  expect(host.querySelector("svg")).toBeNull();
  expect(host.textContent).toContain("The velocity diagram is unavailable for this result");
  expect(host.textContent).toContain("Composed speed unavailable");
});

test("collinear controls and status describe the collinear result even with a saved angled input", () => {
  const host = lab({ ...SR06_DEFAULTS, alphaDeg: 90 });
  expect(host.querySelector('input[name="movingSpeed"]')).not.toBeNull();
  expect(host.querySelector('input[name="alphaDeg"]')).toBeNull();
  expect(host.querySelector('input[name="secondBeta"]')).toBeNull();
  expect(host.querySelector(".status-line")?.textContent).toContain(
    "composing 0.6c with 0.6c at 0° gives 0.8824c",
  );
  expect(host.querySelector('[data-output="composedSpeedOverC"]')?.textContent).toBe("0.882353");
  expect(host.textContent).toContain("Along one line uses α = 0°");
});

test("two-boost controls, spoken result and rapidity all refer to the active second boost", () => {
  const host = lab({
    ...SR06_DEFAULTS,
    mode: "two-boosts",
    movingSpeed: 0.8,
    alphaDeg: 180,
    secondBeta: 0.2,
    secondAngleDeg: 90,
    showRapidity: true,
  });
  expect(host.querySelector('input[name="movingSpeed"]')).toBeNull();
  expect(host.querySelector('input[name="alphaDeg"]')).toBeNull();
  expect(host.querySelector('input[name="secondBeta"]')?.getAttribute("value")).toBe("0.2");
  expect(host.querySelector('input[name="secondAngleDeg"]')?.getAttribute("value")).toBe("90");
  expect(host.querySelector(".status-line")?.textContent).toContain(
    "composing 0.6c with 0.2c at 90° gives 0.621c",
  );
  expect(host.querySelector('[data-output="composedUyOverC"]')?.textContent).toBe("0.160000");
  expect(host.querySelector('[data-output="rapidityMoving"]')?.textContent).toBe("0.202733");
  expect(host.querySelector("noscript")?.textContent).not.toContain("15/17");
});
