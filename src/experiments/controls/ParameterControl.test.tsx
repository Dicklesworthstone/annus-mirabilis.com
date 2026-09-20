import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ParameterSpec } from "../../content/schemas/experiment.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ControlsPanel } from "./ControlsPanel.tsx";
import { ParameterControl } from "./ParameterControl.tsx";
import type { CommandClass, ResetOptions } from "./types.ts";

const TEMPERATURE_SPEC: ParameterSpec = {
  id: "T",
  label: "Temperature",
  accessibleName: "Absolute temperature of the suspension fluid",
  accessibleDescription: "Sets fluid temperature in Kelvin",
  quantityId: "temperature",
  displayUnit: "K",
  modelDomain: {
    min: 270,
    max: 350,
    minInclusive: true,
    maxInclusive: true,
    reason: "Liquid state of water at ordinary laboratory pressure",
  },
  visualRange: { min: 273, max: 330 },
  default: 290.15,
  mapping: { kind: "linear" },
  role: "independent",
  commandClass: "setup-change",
};

const VISCOSITY_SPEC: ParameterSpec = {
  id: "eta",
  label: "Viscosity",
  accessibleName: "Dynamic viscosity of the suspension fluid",
  accessibleDescription: "Sets fluid viscosity in pascal-seconds",
  quantityId: "viscosity",
  displayUnit: "mPa s",
  modelDomain: {
    min: 0.0001,
    max: 0.05,
    minInclusive: true,
    maxInclusive: true,
    reason: "Newtonian-liquid Stokes drag regime",
  },
  visualRange: { min: 0.0005, max: 0.02 },
  default: 0.00135,
  mapping: { kind: "linear" },
  role: "independent",
  commandClass: "setup-change",
};

const INTERVAL_SPEC: ParameterSpec = {
  id: "interval",
  label: "Observation interval",
  accessibleName: "Interval between observations",
  accessibleDescription: "Delta t in seconds",
  quantityId: "observationInterval",
  displayUnit: "s",
  modelDomain: {
    min: 0.01,
    max: 60.0,
    minInclusive: true,
    maxInclusive: true,
    reason: "Time must be on grid",
  },
  visualRange: { min: 0.02, max: 10.0 },
  default: 1.0,
  mapping: { kind: "step", size: 0.02 },
  role: "independent",
  commandClass: "measurement-change",
};

const SEED_SPEC: ParameterSpec = {
  id: "seed",
  label: "Seed",
  accessibleName: "Random stream seed",
  accessibleDescription: "64-bit decimal seed",
  quantityId: "streamSeed",
  displayUnit: "",
  modelDomain: { reason: "Canonical unsigned 64-bit decimal string" },
  visualRange: { min: 0, max: 1 },
  default: "1905",
  mapping: { kind: "linear" },
  role: "independent",
  commandClass: "setup-change",
};

const DERIVED_SPEC: ParameterSpec = {
  id: "D",
  label: "Diffusivity",
  accessibleName: "Calculated diffusion coefficient",
  accessibleDescription: "Read-only derived diffusion coefficient",
  quantityId: "diffusionCoefficient",
  displayUnit: "um^2/s",
  modelDomain: { min: 0 },
  visualRange: { min: 0, max: 10 },
  default: 0.3158,
  mapping: { kind: "linear" },
  role: "derived",
  derivedFrom: ["T", "eta", "a"],
  commandClass: "presentation-change",
};

/**
 * Test harness that manages value and acceptedInputRevision state,
 * synchronizing data-accepted-input-revision across the container and control.
 */
function TestControlHarness({
  spec,
  initialValue,
  initialRevision = 0,
  onAccept,
}: {
  spec: ParameterSpec;
  initialValue: number | string;
  initialRevision?: number;
  onAccept?: (val: number | string, cmdClass: CommandClass, rev: number) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [acceptedInputRevision, setAcceptedInputRevision] = useState(initialRevision);

  const handleChange = (nextVal: number | string, cmdClass: CommandClass) => {
    const nextRev = acceptedInputRevision + 1;
    setValue(nextVal);
    setAcceptedInputRevision(nextRev);
    onAccept?.(nextVal, cmdClass, nextRev);
  };

  return createElement(
    "div",
    {
      "data-testid": "harness-root",
      "data-accepted-input-revision": String(acceptedInputRevision),
    },
    createElement(ParameterControl, {
      spec,
      value,
      acceptedInputRevision,
      onChange: handleChange,
    }),
  );
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const reactKey = Object.keys(input).find((k) => k.startsWith("__reactProps$"));
  const reactProps = reactKey ? (input as unknown as Record<string, any>)[reactKey] : null;
  if (reactProps?.onChange) {
    reactProps.onChange({ target: { value } });
    return;
  }
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("ParameterControl Unit Tests (am-inst-parameter-controls-cmj9)", () => {
  test("a typed value beyond the visual range but inside the model domain is accepted and marked beyond-track", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let acceptedValue: number | string | null = null;
    let acceptedClass: CommandClass | null = null;
    let finalRevision = 0;

    await act(async () => {
      root.render(
        createElement(TestControlHarness, {
          spec: TEMPERATURE_SPEC,
          initialValue: 290.15,
          onAccept: (val, cmdClass, rev) => {
            acceptedValue = val;
            acceptedClass = cmdClass;
            finalRevision = rev;
          },
        }),
      );
    });

    const harnessRoot = container.querySelector('[data-testid="harness-root"]') as HTMLElement;
    const control = container.querySelector('[data-parameter-id="T"]') as HTMLElement;
    const input = container.querySelector('[data-testid="input-T"]') as HTMLInputElement;
    const slider = container.querySelector('[data-testid="slider-T"]') as HTMLInputElement;

    expect(harnessRoot).not.toBeNull();
    expect(control).not.toBeNull();
    expect(input).not.toBeNull();
    expect(slider).not.toBeNull();

    // Initial state: 290.15 K (inside visual range [273, 330])
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("0");
    expect(control.getAttribute("data-accepted-input-revision")).toBe("0");
    expect(control.getAttribute("data-beyond-track")).toBe("false");
    expect(control.getAttribute("data-domain-status")).toBe("inside");
    expect(container.querySelector('[data-testid="beyond-track-T"]')).toBeNull();
    expect(Number(slider.value)).toBe(290.15);

    // Type 340 K: inside model domain [270, 350], outside visual range [273, 330]
    await act(async () => {
      setNativeInputValue(input, "340");
    });

    // 1. Value accepted by onChange
    expect(acceptedValue).toBe(340);
    expect(acceptedClass).toBe("setup-change");

    // 2. data-accepted-input-revision ADVANCES to 1
    expect(finalRevision).toBe(1);
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("1");
    expect(control.getAttribute("data-accepted-input-revision")).toBe("1");

    // 3. Marked as beyond visual track
    expect(control.getAttribute("data-beyond-track")).toBe("true");
    expect(control.getAttribute("data-domain-status")).toBe("beyond-track");
    expect(control.classList.contains("beyond-track")).toBe(true);

    // 4. Beyond-track explanation marker renders
    const marker = container.querySelector('[data-testid="beyond-track-T"]') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.textContent).toContain("Beyond visual track (340 K)");

    // 5. Visual slider is clamped to track max (330) while actual accepted value is 340 (no silent clamp)
    expect(Number(slider.value)).toBe(330);
    expect(input.value).toBe("340");

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("contrast case: a value outside the model domain is refused and data-accepted-input-revision does NOT change", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let changeCallCount = 0;

    await act(async () => {
      root.render(
        createElement(TestControlHarness, {
          spec: TEMPERATURE_SPEC,
          initialValue: 290.15,
          onAccept: () => {
            changeCallCount++;
          },
        }),
      );
    });

    const harnessRoot = container.querySelector('[data-testid="harness-root"]') as HTMLElement;
    const control = container.querySelector('[data-parameter-id="T"]') as HTMLElement;
    const input = container.querySelector('[data-testid="input-T"]') as HTMLInputElement;

    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("0");
    expect(control.getAttribute("data-accepted-input-revision")).toBe("0");

    // Enter out-of-domain value: 360 K (exceeds max 350 K)
    await act(async () => {
      setNativeInputValue(input, "360");
    });

    // 1. onChange must NOT be called
    expect(changeCallCount).toBe(0);

    // 2. data-accepted-input-revision MUST NOT change
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("0");
    expect(control.getAttribute("data-accepted-input-revision")).toBe("0");

    // 3. Marked as outside domain with error
    expect(control.getAttribute("data-beyond-track")).toBe("false");
    expect(control.getAttribute("data-domain-status")).toBe("outside");
    expect(control.classList.contains("has-error")).toBe(true);

    // 4. Error explanation renders
    const explanation = container.querySelector('[data-testid="explanation-T"]') as HTMLElement;
    expect(explanation).not.toBeNull();
    expect(explanation.textContent).toContain("exceeds the maximum allowed bound of 350");

    // 5. Beyond-track marker does NOT render
    expect(container.querySelector('[data-testid="beyond-track-T"]')).toBeNull();

    // Enter out-of-domain value below minimum: 250 K (below min 270 K)
    await act(async () => {
      setNativeInputValue(input, "250");
    });

    expect(changeCallCount).toBe(0);
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("0");
    expect(explanation.textContent).toContain("below the minimum allowed bound of 270");
    expect(container.querySelector('[data-testid="beyond-track-T"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("a value below the visual range but inside the model domain is accepted and marked beyond-track", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let acceptedValue: number | string | null = null;

    await act(async () => {
      root.render(
        createElement(TestControlHarness, {
          spec: TEMPERATURE_SPEC,
          initialValue: 290.15,
          onAccept: (val) => {
            acceptedValue = val;
          },
        }),
      );
    });

    const harnessRoot = container.querySelector('[data-testid="harness-root"]') as HTMLElement;
    const control = container.querySelector('[data-parameter-id="T"]') as HTMLElement;
    const input = container.querySelector('[data-testid="input-T"]') as HTMLInputElement;
    const slider = container.querySelector('[data-testid="slider-T"]') as HTMLInputElement;

    // Type 271 K: model domain min is 270 K, visual range min is 273 K
    await act(async () => {
      setNativeInputValue(input, "271");
    });

    expect(acceptedValue).toBe(271);
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("1");
    expect(control.getAttribute("data-beyond-track")).toBe("true");
    expect(control.getAttribute("data-domain-status")).toBe("beyond-track");

    // Slider thumb is at visual min (273), but accepted value is 271
    expect(Number(slider.value)).toBe(273);

    const marker = container.querySelector('[data-testid="beyond-track-T"]') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.textContent).toContain("Beyond visual track (271 K)");

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("viscosity control handles canonical SI conversion, beyond-track acceptance, and refusal", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let acceptedValue: number | string | null = null;
    let revisions = 0;

    await act(async () => {
      root.render(
        createElement(TestControlHarness, {
          spec: VISCOSITY_SPEC,
          initialValue: 0.00135,
          onAccept: (val, _, rev) => {
            acceptedValue = val;
            revisions = rev;
          },
        }),
      );
    });

    const harnessRoot = container.querySelector('[data-testid="harness-root"]') as HTMLElement;
    const control = container.querySelector('[data-parameter-id="eta"]') as HTMLElement;
    const input = container.querySelector('[data-testid="input-eta"]') as HTMLInputElement;

    // Initial: 0.00135 Pa·s displayed as 1.35 (in mPa s)
    expect(input.value).toBe("1.35");
    expect(control.getAttribute("data-beyond-track")).toBe("false");

    // Type 35 mPa·s (= 0.035 Pa·s): inside model domain [0.0001, 0.05], beyond visual [0.0005, 0.02]
    await act(async () => {
      setNativeInputValue(input, "35");
    });

    expect(acceptedValue).toBe(0.035);
    expect(revisions).toBe(1);
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("1");
    expect(control.getAttribute("data-beyond-track")).toBe("true");

    const marker = container.querySelector('[data-testid="beyond-track-eta"]') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.textContent).toContain("Beyond visual track (35 mPa s)");

    // Type 100 mPa·s (= 0.1 Pa·s > max 0.05 Pa·s): refused
    await act(async () => {
      setNativeInputValue(input, "100");
    });

    expect(revisions).toBe(1); // Revision did NOT advance
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("1");
    expect(control.getAttribute("data-beyond-track")).toBe("false");
    expect(control.getAttribute("data-domain-status")).toBe("outside");

    const explanation = container.querySelector('[data-testid="explanation-eta"]') as HTMLElement;
    expect(explanation).not.toBeNull();
    expect(explanation.textContent).toContain("exceeds the maximum allowed bound of 0.05");

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("off-grid input is refused, preserves revision, and clicking offered neighbour accepts valid step", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let acceptedValue: number | string | null = null;
    let revisions = 0;

    await act(async () => {
      root.render(
        createElement(TestControlHarness, {
          spec: INTERVAL_SPEC,
          initialValue: 1.0,
          onAccept: (val, _, rev) => {
            acceptedValue = val;
            revisions = rev;
          },
        }),
      );
    });

    const harnessRoot = container.querySelector('[data-testid="harness-root"]') as HTMLElement;
    const control = container.querySelector('[data-parameter-id="interval"]') as HTMLElement;
    const input = container.querySelector('[data-testid="input-interval"]') as HTMLInputElement;

    // Type off-grid: 0.015 s on 0.02 s grid
    await act(async () => {
      setNativeInputValue(input, "0.015");
    });

    expect(revisions).toBe(0);
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("0");
    expect(control.getAttribute("data-domain-status")).toBe("outside");

    const explanation = container.querySelector(
      '[data-testid="explanation-interval"]',
    ) as HTMLElement;
    expect(explanation).not.toBeNull();
    expect(explanation.textContent).toContain("off the 0.02 grid");

    // Offered neighbour button should be available for 0.02
    const neighbourBtn = container.querySelector(
      '[data-testid="neighbour-opt-0.02"]',
    ) as HTMLButtonElement;
    expect(neighbourBtn).not.toBeNull();

    // Click offered neighbour button
    await act(async () => {
      neighbourBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(acceptedValue).toBe(0.02);
    expect(revisions).toBe(1);
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("1");
    expect(control.getAttribute("data-domain-status")).toBe("inside");

    // Type on-grid value beyond visual range: 15.0 s (visual max is 10.0 s, model max is 60.0 s)
    await act(async () => {
      setNativeInputValue(input, "15");
    });

    expect(acceptedValue).toBe(15);
    expect(revisions).toBe(2);
    expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("2");
    expect(control.getAttribute("data-beyond-track")).toBe("true");

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("64-bit seed parameter accepts boundary values and roll-seed, rejects invalid representations", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let acceptedSeed: string | null = null;
    let revisions = 0;

    await act(async () => {
      root.render(
        createElement(TestControlHarness, {
          spec: SEED_SPEC,
          initialValue: "1905",
          onAccept: (val, _, rev) => {
            acceptedSeed = String(val);
            revisions = rev;
          },
        }),
      );
    });

    const harnessRoot = container.querySelector('[data-testid="harness-root"]') as HTMLElement;
    const input = container.querySelector('[data-testid="seed-input-seed"]') as HTMLInputElement;

    // 1. Boundary minimum "0"
    await act(async () => {
      setNativeInputValue(input, "0");
    });
    expect(acceptedSeed).toBe("0");
    expect(revisions).toBe(1);

    // 2. Boundary maximum "18446744073709551615" (2^64 - 1)
    await act(async () => {
      setNativeInputValue(input, "18446744073709551615");
    });
    expect(acceptedSeed).toBe("18446744073709551615");
    expect(revisions).toBe(2);

    // 3. Invalid inputs: -1, 1e3, 01, 21-digit overflow (2^64)
    for (const invalid of ["-1", " 1", "01", "1e3", "18446744073709551616"]) {
      await act(async () => {
        setNativeInputValue(input, invalid);
      });
      expect(revisions).toBe(2); // Never advances on refusal
      expect(harnessRoot.getAttribute("data-accepted-input-revision")).toBe("2");
      const err = container.querySelector('[data-testid="explanation-seed"]');
      expect(err).not.toBeNull();
    }

    // 4. Roll Seed button
    const rollBtn = container.querySelector('[data-testid="seed-roll-seed"]') as HTMLButtonElement;
    expect(rollBtn).not.toBeNull();

    await act(async () => {
      rollBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(revisions).toBe(3);
    expect(acceptedSeed).toMatch(/^[0-9]+$/);
    expect(BigInt(acceptedSeed!)).toBeGreaterThanOrEqual(0n);
    expect(BigInt(acceptedSeed!)).toBeLessThanOrEqual(18446744073709551615n);

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("derived parameter renders read-only display with badge and no slider", async () => {
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(ParameterControl, {
          spec: DERIVED_SPEC,
          value: 0.3158,
          acceptedInputRevision: 3,
        }),
      );
    });

    const control = container.querySelector('[data-parameter-id="D"]') as HTMLElement;
    expect(control).not.toBeNull();
    expect(control.getAttribute("data-accepted-input-revision")).toBe("3");
    expect(control.getAttribute("data-command-class")).toBe("presentation-change");

    const input = container.querySelector('[data-testid="derived-D"] input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute("aria-readonly")).toBe("true");
    expect(input.value).toBe("0.3158");

    expect(container.querySelector('[data-testid="slider-D"]')).toBeNull();
    expect(container.querySelector('[data-testid="step-inc-D"]')).toBeNull();
    expect(container.querySelector('[data-testid="step-dec-D"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("ControlsPanel groups controls, passes acceptedInputRevision, and handles reset modes", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let resetMode: ResetOptions["mode"] | null = null;

    const values = {
      T: 290.15,
      eta: 0.00135,
      interval: 1.0,
      seed: "1905",
      D: 0.3158,
    };

    await act(async () => {
      root.render(
        createElement(ControlsPanel, {
          specs: [TEMPERATURE_SPEC, VISCOSITY_SPEC, INTERVAL_SPEC, SEED_SPEC, DERIVED_SPEC],
          values,
          acceptedInputRevision: 5,
          onChange: () => {},
          onReset: (opts) => {
            resetMode = opts.mode;
          },
        }),
      );
    });

    const panel = container.querySelector('[data-testid="controls-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();

    const tControl = container.querySelector('[data-parameter-id="T"]') as HTMLElement;
    expect(tControl.getAttribute("data-accepted-input-revision")).toBe("5");

    const sameSeedBtn = container.querySelector(
      '[data-testid="btn-reset-same-seed"]',
    ) as HTMLButtonElement;
    const newTrialBtn = container.querySelector(
      '[data-testid="btn-reset-new-trial"]',
    ) as HTMLButtonElement;

    expect(sameSeedBtn).not.toBeNull();
    expect(newTrialBtn).not.toBeNull();

    await act(async () => {
      sameSeedBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetMode).toBe("same-seed");

    await act(async () => {
      newTrialBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetMode).toBe("new-trial");

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });
});
