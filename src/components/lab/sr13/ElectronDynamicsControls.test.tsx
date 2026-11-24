import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { encodeTapePermalink } from "../../../experiments/permalink/codec.ts";
import { tapeForSettings } from "../../../experiments/permalink/sessionTape.ts";
import { parseResult } from "../../../experiments/results/codec.ts";
import { SR13_DEFAULTS, type Sr13Parameters } from "../../../experiments/sr13/definition.ts";
import { createSr13Session, DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/sr13/session.ts";
import { SR13_TAPE } from "../../../experiments/sr13/tape.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { display } from "../presentation.ts";
import { ElectronDynamicsLab } from "./ElectronDynamicsLab.tsx";
import { ElectronDynamicsPlot } from "./ElectronDynamicsPlot.tsx";

const NUMERIC_NAMES = [
  "initialSpeed",
  "initialDirectionDeg",
  "integrationInterval",
  "electricFieldX",
  "electricFieldY",
  "electricFieldZ",
  "magneticFieldX",
  "magneticFieldY",
  "magneticFieldZ",
  "customCharge",
  "customMass",
] as const;
const GENERAL_SETTINGS: Sr13Parameters = {
  ...SR13_DEFAULTS,
  initialSpeed: 0.4,
  initialDirectionDeg: 30,
  integrationInterval: 8e-10,
  electricFieldX: 2e5,
  electricFieldY: -3e5,
  electricFieldZ: 4e5,
  magneticFieldX: 0.02,
  magneticFieldY: -0.01,
  magneticFieldZ: 0.03,
  particle: "custom",
  customCharge: 2e-19,
  customMass: 2e-30,
  forceConvention: "laboratory",
  massLanguage: "modern",
};

describe("SR-13 complete particle and field controls", () => {
  let host: HTMLElement;
  let root: Root;

  beforeEach(async () => {
    await installDom();
    window.history.replaceState(null, "", "/lab/sr-13/");
    host = createContainer();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(host);
    await uninstallDom();
  });

  function required<T extends Element = HTMLElement>(
    selector: string,
    scope: ParentNode = host,
  ): T {
    const element = scope.querySelector<T>(selector);
    assert.ok(element, `SR-13 must expose ${selector}`);
    return element;
  }

  async function mount(restoreFromLocation = false) {
    await act(async () =>
      root.render(
        <ElectronDynamicsLab
          example={DEFAULT_PREPARED_EXAMPLE}
          restoreFromLocation={restoreFromLocation}
        />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
  }

  type Control = HTMLInputElement | HTMLSelectElement;
  type Handlers = { onChange(event: { target: Control; currentTarget: Control }): void };
  async function change(name: string, value: string) {
    const control = required<Control>(`[name="${name}"]`);
    // Dispatch the real rendered handler: happy-dom does not implement native number-input tracking.
    const key =
      Object.keys(control).find((name) => name.startsWith("__reactProps$")) ??
      Object.keys(required("input")).find((name) => name.startsWith("__reactProps$"));
    assert.ok(key);
    const props = (control as unknown as Record<string, Handlers>)[key];
    assert.ok(props);
    await act(async () => {
      control.value = value;
      props.onChange({ target: control, currentTarget: control });
    });
  }

  async function apply() {
    await act(async () => {
      required<HTMLFormElement>('form[aria-label="Electron dynamics controls"]').dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  }

  async function setControls(settings: Sr13Parameters) {
    for (const name of ["particle", "forceConvention", "massLanguage"] as const) {
      await change(name, settings[name]);
    }
    for (const name of NUMERIC_NAMES) await change(name, String(settings[name]));
  }

  function path(scope: ParentNode = host): string {
    const d = required<SVGPathElement>(
      'svg.sr13-chamber path[stroke-width="3"]',
      scope,
    ).getAttribute("d");
    assert.ok(d);
    return d;
  }

  function endpoints(d: string) {
    const points = [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/gu)].map((point) => ({
      x: Number(point[1]),
      y: Number(point[2]),
    }));
    const first = points[0];
    const last = points.at(-1);
    assert.ok(first && last);
    return { first, last };
  }

  function ownerPath(settings: Sr13Parameters): string {
    const owner = createSr13Session("sr13-controls-reference");
    expect(owner.apply(settings).kind).toBe("accepted");
    const snapshot = owner.getSnapshot().accepted;
    assert.ok(snapshot);
    const trajectory = snapshot.outputs.find(
      (output) => output.quantityId === "trajectoryPositions",
    );
    assert.ok(trajectory?.status === "value" && typeof trajectory.value !== "number");
    const numeric = (id: string) => {
      const output = snapshot.outputs.find((item) => item.quantityId === id);
      return output?.status === "value" && typeof output.value === "number" ? output.value : null;
    };
    const scalar = (id: string) => {
      const value = numeric(id);
      assert.notEqual(value, null);
      return value as number;
    };
    const rendered = document.createElement("div");
    rendered.innerHTML = renderToStaticMarkup(
      <ElectronDynamicsPlot
        {...settings}
        longitudinalMassKg={scalar("longitudinalMass")}
        transverseMassComovingKg={scalar("transverseMassComoving")}
        transverseMassLaboratoryKg={scalar("transverseMassLaboratory")}
        kineticEnergyJ={scalar("kineticEnergy")}
        kineticEnergyNewtonianJ={scalar("kineticEnergyNewtonian")}
        acceleratingPotentialV={numeric("acceleratingPotential")}
        acceleratingPotentialNewtonianV={numeric("acceleratingPotentialNewtonian")}
        radiusCurvatureMagneticM={numeric("radiusCurvatureMagnetic")}
        radiusCurvatureElectricM={numeric("radiusCurvatureElectric")}
        lorentzFactor={scalar("lorentzFactor")}
        trajectory={trajectory.value}
        integrationIntervalS={settings.integrationInterval}
      />,
    );
    return path(rendered);
  }

  test("the worked example exposes every supported numeric control with accessible labels", () => {
    host.innerHTML = renderToStaticMarkup(
      <ElectronDynamicsLab example={DEFAULT_PREPARED_EXAMPLE} />,
    );
    for (const name of NUMERIC_NAMES) {
      const input = required<HTMLInputElement>(`input[name="${name}"]`);
      expect(input.closest("fieldset")?.disabled).toBe(true);
      expect(required(`label[for="${input.id}"]`).textContent?.length).toBeGreaterThan(0);
    }
    expect(host.textContent).toContain("The calculation refines its time steps");
    expect(host.textContent).toContain("Trajectory numerical check");
    expect(host.textContent).toContain("empirical estimate");
    expect(host.textContent).toContain("motion along z is not shown");
    expect(host.textContent).toContain("1.953125");
  });

  test("an unresolved allowed field removes the accepted path, explains why, and recovers when shortened", async () => {
    await mount();
    expect(path().length).toBeGreaterThan(0);
    await change("electricFieldY", "0");
    await change("magneticFieldZ", "10");
    await change("integrationInterval", "0.000001");
    await apply();
    expect(host.querySelector('svg.sr13-chamber path[stroke-width="3"]')).toBeNull();
    expect(required('[data-trajectory-status="outside-domain"]').textContent).toContain(
      "Shorten the duration or reduce the fields",
    );
    expect(host.textContent).not.toContain("The path appears once the model has run");
    expect(required('[data-quantity-id="kineticEnergy"]').textContent).not.toContain("unavailable");
    expect(host.textContent).not.toMatch(/\b(?:NaN|Infinity)\b/u);

    await change("integrationInterval", "1e-13");
    await apply();
    expect(host.querySelector('[data-trajectory-status="outside-domain"]')).toBeNull();
    expect(required('[data-trajectory-status="value"]').textContent).toContain(
      "Trajectory numerical check",
    );
    expect(path().length).toBeGreaterThan(0);
  });

  test("direction and duration apply together without altering the accepted path while editing", async () => {
    await mount();
    const before = path();
    const settings = {
      ...SR13_DEFAULTS,
      initialDirectionDeg: 90,
      electricFieldY: 0,
      integrationInterval: 1e-9,
    };
    await change("initialDirectionDeg", "90");
    await change("electricFieldY", "0");
    await change("integrationInterval", "1e-9");
    expect(path()).toBe(before);
    await apply();
    expect(path()).toBe(ownerPath(settings));
    const { first, last } = endpoints(path());
    expect(last.x).toBeCloseTo(first.x, 1);
    expect(last.y).toBeLessThan(first.y);
    expect(host.textContent).toContain("first 1 ns");
    await change("integrationInterval", "2e-9");
    await apply();
    expect(path()).toBe(ownerPath({ ...settings, integrationInterval: 2e-9 }));
    expect(host.textContent).toContain("first 2 ns");
  });

  test("all six field components and custom charge and mass reach the real trajectory owner", async () => {
    await mount();
    await setControls(GENERAL_SETTINGS);
    await apply();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(path()).toBe(ownerPath(GENERAL_SETTINGS));
    expect(required(".sr13-chamber-title").textContent).toContain("x–y projection");
    expect(required("svg.sr13-chamber").textContent).toContain("particle entry");
    expect(host.textContent).toContain("Pure transverse magnetic reference radius");
    expect(host.textContent).toContain(
      "neither is the curvature of a general combined-field trajectory",
    );
  });

  test("out-of-plane fields do not invent Ey or Bz direction glyphs", async () => {
    await mount();
    await change("electricFieldY", "0");
    await change("electricFieldZ", "100000");
    await change("magneticFieldX", "0.01");
    await apply();
    expect(path()).toBe(
      ownerPath({ ...SR13_DEFAULTS, electricFieldY: 0, electricFieldZ: 1e5, magneticFieldX: 0.01 }),
    );
    const labels = [...required("svg.sr13-chamber").querySelectorAll("text")].map((item) =>
      item.textContent?.replaceAll("\u200b", ""),
    );
    expect(labels).not.toContain("Ey");
    expect(labels).not.toContain("Bz");
    expect(host.textContent).toContain("Motion along z is not shown");
  });

  test("reversing the custom charge reverses transverse electric bending, and zero charge preserves typed unavailable potentials", async () => {
    await mount();
    const negative = endpoints(path());
    await change("particle", "custom");
    await change("customCharge", "1.602176634e-19");
    await apply();
    const positive = endpoints(path());
    expect(negative.last.y).toBeGreaterThan(negative.first.y);
    expect(positive.last.y).toBeLessThan(positive.first.y);
    expect(path()).toBe(
      ownerPath({ ...SR13_DEFAULTS, particle: "custom", customCharge: 1.602176634e-19 }),
    );
    await change("customCharge", "0");
    await apply();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(path()).toBe(ownerPath({ ...SR13_DEFAULTS, particle: "custom", customCharge: 0 }));
    expect(required('[data-quantity-id="acceleratingPotential"]').textContent).toBe(
      "Accelerating potential requires positive charge magnitude.",
    );
    expect(required('[data-quantity-id="kineticEnergy"]').textContent).not.toContain("outside");
    expect(host.textContent).not.toMatch(/\b(?:NaN|Infinity)\b/u);
    expect(host.textContent).not.toContain("the electron's energy is outside");
  });

  for (const [name, value] of [
    ["integrationInterval", "0"],
    ["customMass", "0"],
    ["electricFieldX", ""],
  ] as const) {
    test(`${name}=${JSON.stringify(value)} refuses without replacing the accepted experiment`, async () => {
      await mount();
      await setControls(GENERAL_SETTINGS);
      await apply();
      const before = path();
      const values = required(".lab-results table").textContent;
      await change(name, value);
      await apply();
      expect(required('[role="alert"]').textContent).toContain("last accepted settings");
      expect(path()).toBe(before);
      expect(required(".lab-results table").textContent).toBe(values);
      expect(required<HTMLInputElement>(`input[name="${name}"]`).value).toBe(value);
    });
  }

  test("actual curvature follows accepted direction while the transverse reference stays a reference", async () => {
    await mount();
    const selector = '[data-quantity-id="initialTrajectoryCurvature"]';
    const before = required(selector).textContent;
    const reference = required('[data-quantity-id="radiusCurvatureElectric"]').textContent;
    expect(before).not.toBe(`${display(0)} m⁻¹`);
    await change("initialDirectionDeg", "90");
    expect(required(selector).textContent).toBe(before);
    await apply();
    expect(required(selector).textContent).toBe(`${display(0)} m⁻¹`);
    expect(required('[data-quantity-id="radiusCurvatureElectric"]').textContent).toBe(reference);
    expect(required("[data-zero-initial-curvature]").textContent).toContain("at entry");
    expect(required("[data-trajectory-curvature]").textContent).toContain("three dimensions");
    expect(required("[data-trajectory-curvature]").textContent).toContain("modern diagnostic");
  });

  test("the force-balance preset shows zero actual bending with two nonzero reference radii", async () => {
    await mount();
    const balanced = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Balance the crossed forces (straight entry)",
    );
    assert.ok(balanced);
    await act(async () => balanced.click());
    const curvature = () => required('[data-quantity-id="initialTrajectoryCurvature"]').textContent;
    expect(curvature()).toBe(`${display(0)} m⁻¹`);
    for (const id of ["radiusCurvatureMagnetic", "radiusCurvatureElectric"]) {
      const reading = required(`[data-quantity-id="${id}"]`).textContent;
      expect(reading).not.toBe(`${display(0)} m`);
      expect(reading).not.toContain("outside");
    }
    const balancedPath = endpoints(path());
    // These are SVG coordinates rounded to 0.1 px. The checked Boris path has a
    // small finite integration error; this does not assert exact physical positions.
    expect(balancedPath.first.y).toBe(balancedPath.last.y);
    await change("initialSpeed", "-0.5");
    expect(curvature()).toBe(`${display(0)} m⁻¹`);
    await apply();
    expect(curvature()).not.toBe(`${display(0)} m⁻¹`);
    expect(host.querySelector("[data-zero-initial-curvature]")).toBeNull();
  });

  test("rest reports an undefined initial tangent without printing an infinite radius", async () => {
    await mount();
    await change("initialSpeed", "0");
    await apply();
    const reading = required('[data-quantity-id="initialTrajectoryCurvature"]').textContent;
    expect(reading).toContain("starts at rest");
    expect(reading).not.toContain("m⁻¹");
    expect(host.querySelector("[data-zero-initial-curvature]")).toBeNull();
    expect(host.textContent).not.toMatch(/\b(?:NaN|Infinity)\b/u);
  });

  test("a saved example without the new diagnostic remains readable until explicit Apply", async () => {
    const previous = {
      ...DEFAULT_PREPARED_EXAMPLE,
      results: DEFAULT_PREPARED_EXAMPLE.results.filter(
        (encoded) => parseResult(encoded).quantityId !== "initialTrajectoryCurvature",
      ),
    };
    await act(async () => root.render(<ElectronDynamicsLab example={previous} />));
    await act(async () => {
      await Promise.resolve();
    });
    expect(required('[data-quantity-id="initialTrajectoryCurvature"]').textContent).toContain(
      "This saved snapshot has no curvature diagnostic",
    );
    expect(required('[data-quantity-id="kineticEnergy"]').textContent).not.toBe("");
    await apply();
    expect(required('[data-quantity-id="initialTrajectoryCurvature"]').textContent).not.toContain(
      "no curvature diagnostic",
    );
  });

  test("named presets reset the whole physical setup after arbitrary custom fields", async () => {
    await mount();
    await setControls(GENERAL_SETTINGS);
    await apply();
    const magneticPreset = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Magnetic deflection (B = 0.01 T)",
    );
    assert.ok(magneticPreset);
    await act(async () => magneticPreset.click());
    const expected = {
      ...SR13_DEFAULTS,
      electricFieldY: 0,
      magneticFieldZ: 0.01,
      forceConvention: "laboratory" as const,
      massLanguage: "modern" as const,
    };
    for (const name of NUMERIC_NAMES) {
      expect(Number(required<HTMLInputElement>(`input[name="${name}"]`).value)).toBe(
        expected[name] as number,
      );
    }
    expect(required<HTMLSelectElement>('select[name="particle"]').value).toBe("electron");
    expect(path()).toBe(ownerPath(expected));
  });

  test("a shared tape restores every new control and reapplying keeps the same physical scenario", async () => {
    const tape = tapeForSettings(SR13_TAPE, GENERAL_SETTINGS);
    assert.ok(tape);
    window.history.replaceState(null, "", `/lab/sr-13/?tape=${encodeTapePermalink(tape)}`);
    await mount(true);
    for (const name of NUMERIC_NAMES) {
      expect(Number(required<HTMLInputElement>(`input[name="${name}"]`).value)).toBe(
        GENERAL_SETTINGS[name] as number,
      );
    }
    expect(required<HTMLSelectElement>('select[name="particle"]').value).toBe("custom");
    expect(path()).toBe(ownerPath(GENERAL_SETTINGS));
    const before = path();
    await apply();
    expect(path()).toBe(before);
  });
});
