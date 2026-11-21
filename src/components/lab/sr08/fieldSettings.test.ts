import { describe, expect, test } from "bun:test";
import { SR08_DEFAULTS } from "../../../experiments/sr08/definition.ts";
import { createSr08Session } from "../../../experiments/sr08/session.ts";
import { C_SI } from "../../../physics/reference/fields.ts";
import { readSr08Settings, SR08_NUMBER_FIELDS, typedSr08Settings } from "./fieldSettings.ts";

describe("SR-08 full field and charge controls", () => {
  test("all independent vector components and signed charge reach the real calculation", () => {
    const settings = {
      ...SR08_DEFAULTS,
      electricFieldX: 3,
      electricFieldY: -2,
      electricFieldZ: 5,
      magneticFieldX: 2e-9,
      magneticFieldY: -3e-9,
      magneticFieldZ: 4e-9,
      testCharge: -1.602176634e-19,
      chargeVelocityX: 0.2 * C_SI,
      chargeVelocityY: -0.1 * C_SI,
      chargeVelocityZ: 0.3 * C_SI,
    };
    const parsed = readSr08Settings(SR08_DEFAULTS, typedSr08Settings(settings));
    expect(parsed.kind).toBe("accepted");
    if (parsed.kind !== "accepted") return;
    for (const field of SR08_NUMBER_FIELDS)
      expect(parsed.data[field.key]).toBe(settings[field.key]);
    const session = createSr08Session("full-field-controls");
    expect(session.apply(parsed.data).kind).toBe("accepted");
    const snapshot = session.getSnapshot().accepted;
    if (!snapshot) throw new Error("The accepted full field calculation is missing.");
    expect(snapshot.parameters.electricFieldZ).toBe(5);
    const force = snapshot.outputs.find(
      (output) => output.quantityId === "transverseForceLaboratory",
    );
    expect(force?.status).toBe("value");
    if (force?.status !== "value" || typeof force.value === "number") return;
    // q(E + u × B), independently expanded component by component.
    expect(force.value.at(0)).toBeCloseTo(settings.testCharge * (3 + 0.5e-9 * C_SI), 28);
    expect(force.value.at(1)).toBeCloseTo(settings.testCharge * (-2 - 0.2e-9 * C_SI), 28);
    expect(force.value.at(2)).toBeCloseTo(settings.testCharge * (5 - 0.4e-9 * C_SI), 28);
  });

  test("a blank component is refused by name instead of silently clearing that component", () => {
    for (const field of SR08_NUMBER_FIELDS) {
      const parsed = readSr08Settings(SR08_DEFAULTS, {
        ...typedSr08Settings(SR08_DEFAULTS),
        [field.key]: "",
      });
      expect(parsed.kind).toBe("refused");
      if (parsed.kind === "refused") {
        expect(parsed.requirement).toContain("as a number");
      }
    }
    const zeroCharge = readSr08Settings(SR08_DEFAULTS, {
      ...typedSr08Settings(SR08_DEFAULTS),
      testCharge: "0",
    });
    expect(zeroCharge.kind).toBe("accepted");
  });

  test("the combined speed and declared field bounds remain enforced without clamping", () => {
    for (const changes of [
      { chargeVelocityX: "0.8", chargeVelocityY: "0.8" },
      { electricFieldZ: "1e9" },
      { magneticFieldX: "11" },
      { testCharge: "1e-5" },
      { chargeVelocityZ: "1e400" },
    ]) {
      const parsed = readSr08Settings(SR08_DEFAULTS, {
        ...typedSr08Settings(SR08_DEFAULTS),
        ...changes,
      });
      expect(parsed.kind).toBe("refused");
    }
  });

  test("overflowed boost and velocity controls report their limits in fractions of c", () => {
    for (const field of SR08_NUMBER_FIELDS.filter((candidate) => candidate.scale === C_SI)) {
      const parsed = readSr08Settings(SR08_DEFAULTS, {
        ...typedSr08Settings(SR08_DEFAULTS),
        [field.key]: "1e400",
      });
      expect(parsed.kind).toBe("refused");
      if (parsed.kind !== "refused") throw new Error("An overflowing speed must be refused.");
      expect(parsed.requirement).toContain(field.key === "boost" ? "0.95 c" : "1 c");
      expect(parsed.requirement).not.toContain("m/s");
    }
  });
});
