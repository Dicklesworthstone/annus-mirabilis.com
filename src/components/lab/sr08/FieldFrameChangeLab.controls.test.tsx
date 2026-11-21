import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { encodeTapePermalink } from "../../../experiments/permalink/codec.ts";
import { tapeForSettings } from "../../../experiments/permalink/sessionTape.ts";
import { SR08_DEFAULTS, type Sr08Parameters } from "../../../experiments/sr08/definition.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/sr08/session.ts";
import { SR08_TAPE } from "../../../experiments/sr08/tape.ts";
import { C_SI } from "../../../physics/reference/fields.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { display } from "../presentation.ts";
import { FieldFrameChangeLab } from "./FieldFrameChangeLab.tsx";
import { SR08_NUMBER_FIELDS, typedSr08Settings } from "./fieldSettings.ts";

let container: HTMLElement;
let root: Root | null;

beforeEach(async () => {
  await installDom();
  container = createContainer();
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  removeContainer(container);
  await uninstallDom();
});

async function mount(restoreFromLocation = false) {
  await act(async () =>
    root?.render(
      <FieldFrameChangeLab
        example={DEFAULT_PREPARED_EXAMPLE}
        instanceId="sr08-full-controls"
        restoreFromLocation={restoreFromLocation}
      />,
    ),
  );
}

function input(name: string): HTMLInputElement {
  const control = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  assert.ok(control, `The ${name} control must be mounted.`);
  return control;
}

type Handlers = {
  onChange?: (event: unknown) => void;
  onSubmit?: (event: unknown) => void;
  onClick?: () => void;
};

// happy-dom does not dispatch React's number-input change event reliably. Invoke the real
// mounted handler, as the form-session integration tests do, rather than substituting an owner.
function handlers(element: Element): Handlers {
  const key = Object.keys(input("boost")).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The mounted control must have its React handlers.");
  const props = (element as unknown as Record<string, Handlers>)[key];
  assert.ok(props);
  return props;
}

async function edit(name: string, value: string) {
  const control = input(name);
  await act(async () => {
    control.value = value;
    const change = handlers(control).onChange;
    assert.ok(change);
    change({ target: control, currentTarget: control });
  });
}

async function apply() {
  const form = input("boost").closest("form");
  assert.ok(form);
  await act(async () => {
    const submit = handlers(form).onSubmit;
    assert.ok(submit);
    submit({ preventDefault() {} });
  });
}

async function clickButton(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === label,
  );
  assert.ok(button);
  await act(async () => {
    const click = handlers(button).onClick;
    assert.ok(click);
    click();
  });
}

function reading(quantityId: string) {
  const output = container.querySelector(`[data-quantity-id="${quantityId}"]`);
  assert.ok(output, `The accepted ${quantityId} reading must be visible.`);
  return output.textContent;
}

function identity() {
  const lab = container.querySelector('[data-instrument-id="sr-08"]');
  assert.ok(lab);
  return {
    run: lab.getAttribute("data-run-id"),
    snapshot: lab.getAttribute("data-snapshot-version"),
    input: lab.getAttribute("data-accepted-input-revision"),
  };
}

const parameters: Sr08Parameters = {
  ...SR08_DEFAULTS,
  boost: 0.4 * C_SI,
  electricFieldX: 3,
  electricFieldY: -2,
  electricFieldZ: 5,
  magneticFieldX: 2e-9,
  magneticFieldY: -3e-9,
  magneticFieldZ: 4e-9,
  testCharge: -1e-9,
  chargeVelocityX: 0.2 * C_SI,
  chargeVelocityY: -0.1 * C_SI,
  chargeVelocityZ: 0.3 * C_SI,
};

async function enterParameters() {
  const text = typedSr08Settings(parameters);
  for (const field of SR08_NUMBER_FIELDS) await edit(field.name, text[field.key]);
  await apply();
}

describe("SR-08 reader controls", () => {
  test("full vectors and signed charge change the physical state; observer changes keep it", async () => {
    await mount();
    const initial = identity();
    await enterParameters();
    const physical = identity();
    expect(physical.run).not.toBe(initial.run);
    expect(reading("electricFieldStationary")).toBe("(3, −2, 5)");
    expect(reading("magneticFieldStationary")).toBe("(2 × 10⁻⁹, −3 × 10⁻⁹, 4 × 10⁻⁹)");
    // A nonzero invariant remains visible as a power of ten, with no contradictory rounded SVG copy.
    expect(reading("fieldInvariantEDotB")).toBe("3.2 × 10⁻⁸");
    expect(reading("fieldInvariantEDotBMoving")).toBe("3.2 × 10⁻⁸");
    expect(container.querySelector(".field-svg")?.textContent).not.toContain("E·B");
    expect(input("testCharge").value).toBe("-1e-9");
    const velocity = reading("chargeVelocityStationary");
    const laboratoryForce = reading("transverseForceLaboratory");
    const movingForce = reading("transverseForceComoving");
    const q = parameters.testCharge;
    const expectedForce = [
      q * (3 + 0.5e-9 * C_SI),
      q * (-2 - 0.2e-9 * C_SI),
      q * (5 - 0.4e-9 * C_SI),
    ];
    expect(laboratoryForce).toBe(`(${expectedForce.map((value) => display(value)).join(", ")})`);

    await edit("boost", "-0.3");
    await apply();
    expect(identity().run).toBe(physical.run);
    expect(reading("electricFieldStationary")).toBe("(3, −2, 5)");
    expect(reading("chargeVelocityStationary")).toBe(velocity);
    expect(reading("transverseForceLaboratory")).toBe(laboratoryForce);
    expect(reading("transverseForceComoving")).not.toBe(movingForce);
  });

  test("refused blank and superluminal drafts retain the accepted fields and identity", async () => {
    await mount();
    await enterParameters();
    const accepted = identity();
    const field = reading("electricFieldStationary");
    const force = reading("transverseForceLaboratory");
    await edit("ez", "");
    await apply();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("electric ez");
    expect(identity()).toEqual(accepted);
    expect(reading("electricFieldStationary")).toBe(field);
    expect(reading("transverseForceLaboratory")).toBe(force);
    expect(input("ez").value).toBe("");

    await edit("ez", "5");
    await edit("chargeVelocityX", "0.8");
    await edit("chargeVelocityY", "0.8");
    await apply();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(identity()).toEqual(accepted);
    expect(reading("transverseForceLaboratory")).toBe(force);
  });

  test("placing the charge at rest in k exposes a purely electric moving-frame force", async () => {
    await mount();
    await enterParameters();
    await clickButton("Charge at rest in k");
    expect(input("chargeVelocityX").value).toBe(input("boost").value);
    expect(reading("chargeVelocityMoving")).toBe("(0, 0, 0)");
    expect(reading("magneticForceMoving")).toBe("(0, 0, 0)");
    expect(reading("transverseForceComoving")).toBe(reading("electricForceMoving"));
    expect(reading("electricFieldStationary")).toBe("(3, −2, 5)");
  });

  test("both rest-frame presets apply the fields, signed charge and boost currently being edited", async () => {
    await mount();
    await edit("boost", "0.25");
    await edit("ex", "2");
    await edit("ez", "7");
    await edit("by", "3e-9");
    await edit("testCharge", "-2e-9");
    await clickButton("Charge at rest in k");
    expect(input("boost").value).toBe("0.25");
    expect(input("chargeVelocityX").value).toBe("0.25");
    expect(input("testCharge").value).toBe("-2e-9");
    expect(reading("electricFieldStationary")).toBe("(2, 1, 7)");
    expect(reading("magneticFieldStationary")).toBe("(0, 3 × 10⁻⁹, 0)");
    expect(reading("chargeVelocityMoving")).toBe("(0, 0, 0)");
    expect(reading("transverseForceComoving")).toBe(reading("electricForceMoving"));

    await edit("boost", "-0.5");
    await edit("ey", "4");
    await edit("testCharge", "3e-9");
    await clickButton("Charge at rest in K");
    expect(input("boost").value).toBe("-0.5");
    expect(input("testCharge").value).toBe("3e-9");
    expect(reading("electricFieldStationary")).toBe("(2, 4, 7)");
    expect(reading("chargeVelocityStationary")).toBe("(0, 0, 0)");
    expect(reading("transverseForceLaboratory")).toBe(reading("electricForceStationary"));
  });

  test("a rest-frame preset refuses invalid current drafts without losing their edits", async () => {
    await mount();
    const accepted = identity();
    const field = reading("electricFieldStationary");
    await edit("ex", "7");
    await edit("testCharge", "-1e-9");
    for (const boost of ["", "1.2"]) {
      await edit("boost", boost);
      await clickButton("Charge at rest in k");
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(identity()).toEqual(accepted);
      expect(reading("electricFieldStationary")).toBe(field);
      expect(input("boost").value).toBe(boost);
      expect(input("ex").value).toBe("7");
      expect(input("testCharge").value).toBe("-1e-9");
    }
    await edit("boost", "0.3");
    await edit("ez", "");
    await clickButton("Charge at rest in K");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("electric ez");
    expect(identity()).toEqual(accepted);
    expect(input("ez").value).toBe("");
    expect(input("ex").value).toBe("7");
  });

  test("a shared full-vector state restores every text control and reapplies unchanged", async () => {
    const shared = { ...parameters, boost: 123456789.1234567, chargeVelocityX: 1234567.8912345 };
    const tape = tapeForSettings(SR08_TAPE, shared);
    assert.ok(tape);
    history.replaceState({}, "", `/lab/sr-08/?tape=${encodeTapePermalink(tape)}`);
    await mount(true);
    const deadline = Date.now() + 2000;
    while (input("ez").value !== "5") {
      assert.ok(Date.now() < deadline, "The full shared state must restore into the form.");
      await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    }
    const restored = identity();
    const expected = typedSr08Settings(shared);
    for (const field of SR08_NUMBER_FIELDS) {
      expect(input(field.name).value).toBe(expected[field.key]);
    }
    const force = reading("transverseForceComoving");
    await apply();
    expect(identity()).toEqual(restored);
    expect(reading("transverseForceComoving")).toBe(force);
  });

  test("the printed-symbol guide keeps SI labels and the same accepted numerical fields", async () => {
    await mount();
    await enterParameters();
    const accepted = identity();
    const field = reading("electricFieldMoving");
    const guide = container.querySelectorAll<HTMLInputElement>('input[name="unitLayer"]')[1];
    assert.ok(guide);
    await act(async () => {
      const change = handlers(guide).onChange;
      assert.ok(change);
      change({ target: guide, currentTarget: guide });
    });
    await apply();
    expect(identity().run).toBe(accepted.run);
    expect(reading("electricFieldMoving")).toBe(field);
    expect(container.querySelector(".sr08-plot-frame")?.textContent).toContain("SI units");
    expect(
      container.querySelector('aside[aria-label="Einstein’s printed field names"]')?.textContent,
    ).toContain("below remain SI");
    expect(container.querySelector("[data-field-projection-components]")?.textContent).toContain(
      "Out of this plane: Ez = 5 V/m",
    );
  });
});
