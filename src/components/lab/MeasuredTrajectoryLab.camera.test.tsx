import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import type { Root } from "react-dom/client";
import { parseTrajectoryCsv } from "../../experiments/bm07/trajectoryCsv.ts";
import { analyzeImportedCameraTrajectory } from "../../experiments/bm07/trajectoryHost.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { MeasuredTrajectoryLab } from "./MeasuredTrajectoryLab.tsx";

const csv = "track,time,x\nA,0,0\nA,1,2\nA,2,999\nA,3,1003\nA,4,0\nA,5,6\n";
let root: Root | null = null;
let downloads: Blob[] = [];
let filenames: string[] = [];
let originalCreate: PropertyDescriptor | undefined;
let originalRevoke: PropertyDescriptor | undefined;
let originalClick: HTMLAnchorElement["click"];

beforeEach(async () => {
  await installDom();
  downloads = [];
  filenames = [];
  originalCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  originalRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  originalClick = HTMLAnchorElement.prototype.click;
  // Only the browser download boundary is intercepted; the form, CSV parser, camera owner,
  // molecular inference and serialization are the production implementations.
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      downloads.push(blob);
      return `blob:accepted-analysis-${downloads.length}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
  HTMLAnchorElement.prototype.click = function () {
    filenames.push(this.download);
  };
  const { createRoot } = await import("react-dom/client");
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(<MeasuredTrajectoryLab />));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  if (originalCreate) Object.defineProperty(URL, "createObjectURL", originalCreate);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevoke) Object.defineProperty(URL, "revokeObjectURL", originalRevoke);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
  HTMLAnchorElement.prototype.click = originalClick;
  await uninstallDom();
});

function element<T extends Element = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  assert.ok(found, `Expected production control ${selector}`);
  return found;
}
async function setValue(selector: string, value: string) {
  const control = element<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
  const prototype =
    control instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  const set = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  assert.ok(set);
  await act(async () => {
    set.call(control, value);
    control.dispatchEvent(
      new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}
async function check(suffix: string) {
  await act(async () => element<HTMLInputElement>(`input[id$="-${suffix}"]`).click());
}
async function settle() {
  for (
    let step = 0;
    step < 50 && element(".measured-trajectory-lab").getAttribute("data-pending") === "true";
    step++
  )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  expect(element(".measured-trajectory-lab").getAttribute("data-pending")).toBe("false");
}
async function submit() {
  await act(async () => {
    element("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}
async function cameraSettings() {
  await setValue('select[id$="-timeUnit"]', "s");
  await setValue('select[id$="-positionUnit"]', "um");
  await setValue('select[id$="-model"]', "camera-disjoint-pairs");
  await check("camera-model");
  await setValue('[name="localizationNanometres"]', "100");
  await setValue('[name="exposureMilliseconds"]', "300");
  await setValue('select[id$="-censored"]', "no");
}
async function physicalInputs() {
  await setValue('[name="temperatureKelvin"]', "293.15");
  await setValue('[name="viscosityMillipascalSeconds"]', "1");
  await setValue('[name="radiusMicrometres"]', "0.5");
}
async function exported() {
  const button = [...document.querySelectorAll("button")].find(
    (node) => node.textContent === "Download accepted analysis and observations (JSON)",
  );
  assert.ok(button);
  await act(async () => button.click());
  const blob = downloads.at(-1);
  assert.ok(blob);
  return JSON.parse(await blob.text());
}

describe("camera observations through the molecular-number comparison", () => {
  test("a real CSV file, explicit radius and accepted export carry the camera owner's result", async () => {
    const input = element<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File([csv], "measured-track.csv", { type: "text/csv" })],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    await cameraSettings();
    await submit();
    expect(document.body.textContent).toContain("Diffusion alone does not separate");
    expect(document.querySelector('table[data-semantic-kind="consistency-check"]')).toBeNull();

    await check("radius");
    await submit();
    expect(document.body.textContent).toContain("Temperature needs an explicit positive");
    expect(element(".measured-trajectory-lab").getAttribute("data-snapshot-version")).toBe("1");
    await physicalInputs();
    await submit();
    const resultTable = element('table[data-semantic-kind="consistency-check"]');
    expect(resultTable.textContent).toContain("not an independent molecular count");
    expect(resultTable.textContent).toContain("Estimated Boltzmann constant");
    expect(document.body.textContent).toContain("measured-track.csv");
    const acceptedMarkup = resultTable.innerHTML;
    const first = await exported();
    const expected = analyzeImportedCameraTrajectory(
      parseTrajectoryCsv(csv, { time: "s", position: "um" }),
      {
        estimator: "drift-centered",
        coverage: 0.95,
        independentIsotropic: false,
        commonDriftAndDiffusion: false,
        localizationStd: 100 * 1e-9,
        exposureTime: 300 * 1e-3,
        censored: false,
        independentRadius: { T: 293.15, eta: 0.001, a: 0.5e-6 },
      },
      true,
    );
    expect(first.molecular).toEqual(expected.molecular);
    expect(first.camera).toEqual(expected.camera);
    expect(first.trajectory.points).toHaveLength(6);
    expect(first.outputUnits.molecular).toBe("1/mol");
    expect(filenames[0]).toBe("brownian-accepted-2-analysis.json");

    await setValue('[name="radiusMicrometres"]', "1");
    expect(element('table[data-semantic-kind="consistency-check"]').innerHTML).toBe(acceptedMarkup);
    expect(await exported()).toEqual(first);
    await submit();
    const second = await exported();
    expect(second.molecular.estimate).toBe(first.molecular.estimate / 2);
    expect(second.camera).toEqual(first.camera);
    expect(second.trajectory).toEqual(first.trajectory);
    expect(second.assumptions.independentRadius.a).toBe(1e-6);
  });

  for (const model of ["ideal-increments", "camera-disjoint-pairs"] as const) {
    test(`${model} combines an independent radius measurement with the same accepted record`, async () => {
      await setValue("textarea", csv);
      if (model === "camera-disjoint-pairs") await cameraSettings();
      else {
        await setValue('select[id$="-timeUnit"]', "s");
        await setValue('select[id$="-positionUnit"]', "um");
        await check("independent");
        await setValue('[name="localizationNanometres"]', "0");
        await setValue('[name="exposureMilliseconds"]', "0");
        await setValue('select[id$="-censored"]', "no");
      }
      await check("radius");
      await physicalInputs();
      await check("radius-interval");
      await setValue('[name="radiusLowerUm"]', "0.4");
      await setValue('[name="radiusUpperUm"]', "0.6");
      await setValue('[name="radiusCoveragePercent"]', "97.5");
      await setValue('[name="radiusSource"]', "Independent bead calibration C17");
      await submit();
      if (model === "ideal-increments") {
        expect(document.body.textContent).not.toContain("[object Object]");
      }
      const combined = element('[data-radius-comparison="combined"]');
      expect(combined.textContent).toContain("Independent bead calibration C17");
      expect(combined.textContent).toContain("95% joint coverage");
      const first = await exported();
      const analysis = first.result ?? first;
      expect(analysis.radiusComparison.diffusionInterval.coverage).toBeCloseTo(0.975, 12);
      expect(analysis.radiusComparison.diffusionInterval.q).toBe(
        model === "camera-disjoint-pairs" ? 2 : 4,
      );
      expect(analysis.radiusComparison.lower).toBeLessThan(analysis.molecular.interval.lower);
      expect(analysis.radiusComparison.upper).toBeGreaterThan(analysis.molecular.interval.upper);
      // Direct Stokes–Einstein endpoint inversion, independently of the UI.
      const C = (8.31446261815324 * 293.15) / (6 * Math.PI * 0.001);
      const ratio =
        analysis.radiusComparison.lower /
        (C / (0.6e-6 * analysis.radiusComparison.diffusionInterval.upper));
      expect(ratio).toBeCloseTo(1, 10);
      expect(first.assumptions.independentRadius.calibration.source).toBe(
        "Independent bead calibration C17",
      );

      await setValue('[name="radiusCoveragePercent"]', "95");
      expect(await exported()).toEqual(first);
      await submit();
      expect(element('[data-radius-comparison="unavailable"]').textContent).toContain(
        "stronger coverage",
      );
      const next = await exported();
      expect((next.result ?? next).molecular).toEqual(analysis.molecular);
      expect(next.trajectory).toEqual(first.trajectory);

      await setValue('[name="radiusLowerUm"]', "0.7");
      await submit();
      expect(element('[role="alert"]').textContent).toContain("must contain the measured");
      expect(await exported()).toEqual(next);
    });
  }

  test("wider allocated camera set can reach zero while the fixed-radius result remains finite", async () => {
    await setValue("textarea", csv);
    await cameraSettings();
    await setValue('[name="localizationNanometres"]', "700");
    await check("radius");
    await physicalInputs();
    await check("radius-interval");
    await setValue('[name="radiusLowerUm"]', "0.4");
    await setValue('[name="radiusUpperUm"]', "0.6");
    await setValue('[name="radiusCoveragePercent"]', "97.5");
    await setValue('[name="radiusSource"]', "Independent radius measurement");
    await submit();
    expect(element('[data-radius-comparison="unavailable"]').textContent).toContain(
      "no finite upper endpoint",
    );
    const result = await exported();
    expect(result.camera.interval.lower).toBeGreaterThan(0);
    expect(result.molecular.interval.upper).toBeGreaterThan(0);
    expect(result.radiusComparison.upper).toBeUndefined();
  });

  test("unknown camera noise is inferred from neighboring displacements without joining tracks or inventing intervals", async () => {
    // On A the declared drift shifts the y increments [-1,0,-3,-2] to [0,1,-2,-1] μm.
    const source =
      "track,time,x,y\nA,0,9,0\nB,0,2,50\nA,1,8,-1\nB,2,3,51\nA,2,7,-1\nA,3,6,-4\nA,4,5,-6";
    await setValue("textarea", source);
    await setValue('select[id$="-timeUnit"]', "s");
    await setValue('select[id$="-positionUnit"]', "um");
    await setValue('select[id$="-model"]', "camera-lag-one");
    await setValue('select[id$="-moment-axis"]', "y");
    await check("camera-model");
    await setValue('[name="momentDriftUmPerS"]', "-1");
    await setValue('[name="exposureMilliseconds"]', "300");
    await setValue('select[id$="-censored"]', "no");
    expect(document.querySelector('[name="localizationNanometres"]')).toBeNull();
    expect(document.querySelector('[name="coveragePercent"]')).toBeNull();
    await submit();
    const panel = element('[data-analysis-model="camera-lag-one"]');
    expect(panel.textContent).toContain("supplies no confidence interval");
    expect(panel.textContent).toContain("four positions from this track");
    const first = await exported();
    expect(first.source).toBe("Pasted CSV");
    expect(first.assumptions.knownDriftMPerS).toBe(-1e-6);
    expect(first.interval).toBeNull();
    expect(first.trajectory.dt).toBeNull(); // unequal spacings across tracks are valid here
    expect(first.tracks[0].sourceRows).toEqual([2, 4, 6, 7, 8]);
    expect(first.tracks[1].sourceRows).toEqual([3, 5]);
    expect(first.tracks[0].increments).toBe(4);
    expect(first.tracks[0].neighboringPairs).toBe(3);
    expect(first.tracks[0].variance * 1e12).toBeCloseTo(1.5, 8);
    expect(first.tracks[0].covariance * 1e12).toBeCloseTo(0, 8);
    expect(first.tracks[0].D * 1e12).toBeCloseTo(0.75, 8);
    expect(first.tracks[0].sigma2 * 1e12).toBeCloseTo(0.075, 8);
    expect(first.tracks[0].spreadAlone.maximumNoiseVariance * 1e12).toBeCloseTo(0.75, 8);
    await setValue('[name="momentDriftUmPerS"]', "0");
    expect(await exported()).toEqual(first);
    await submit();
    expect(element('[data-analysis-model="camera-lag-one"]').textContent).toContain(
      "A fitted value is negative",
    );
    const second = await exported();
    expect(second.tracks[0].sigma2).toBeLessThan(0);
    expect(second.trajectory).toEqual(first.trajectory);
    await setValue('select[id$="-censored"]', "unknown");
    await submit();
    expect((await exported()).kind).toBe("unavailable");
  });

  test("zero-reaching and empty camera sets keep all observations without a finite molecular interval", async () => {
    await setValue("textarea", csv);
    await cameraSettings();
    await check("radius");
    await physicalInputs();
    await setValue('[name="localizationNanometres"]', "1000");
    await submit();
    expect(document.body.textContent).toContain("no finite upper bound");
    expect(document.querySelector('table[data-semantic-kind="consistency-check"]')).toBeNull();
    const boundary = await exported();
    expect(boundary.camera.interval.lower).toBe(0);
    expect(boundary.molecular).toBeNull();
    expect(boundary.trajectory.points).toHaveLength(6);

    await setValue('[name="localizationNanometres"]', "10000");
    await submit();
    expect(document.body.textContent).toContain("no nonempty physical diffusion confidence set");
    const empty = await exported();
    expect(empty.camera.empty).toBe(true);
    expect(empty.camera.estimate).toBeLessThan(0);
    expect(empty.molecular).toBeNull();
    expect(empty.trajectory).toEqual(boundary.trajectory);
  });
});
