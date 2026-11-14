import { ELEMENTARY_CHARGE, lorentzForce, type Vec3 } from "../physics/reference/fields.ts";

/** A single-frame teaching view of the existing SI Lorentz-force owner. */
export const CHARGE_FIELDS = [
  {
    key: "electricVpm",
    label: "Electric field along y, in volts per metre",
    min: -2000,
    max: 2000,
    refusal: "Enter an electric field from −2000 to 2000 volts per metre.",
  },
  {
    key: "magneticMt",
    label: "Magnetic field along z, in millitesla",
    min: -2,
    max: 2,
    refusal: "Enter a magnetic field from −2 to 2 millitesla.",
  },
  {
    key: "speedKms",
    label: "Speed, in kilometres per second",
    min: 0,
    max: 2000,
    refusal: "Enter a speed from 0 to 2000 kilometres per second.",
  },
] as const;

export const CHARGE_DIRECTIONS = [
  { id: "x", label: "Right, along +x" },
  { id: "y", label: "Up, along +y" },
  { id: "z", label: "Out of the page, along +z" },
] as const;

export const CHARGE_SIGNS = [
  { id: "positive", label: "Positive charge (+e)" },
  { id: "negative", label: "Negative charge (−e)" },
] as const;

export type ChargeDirection = (typeof CHARGE_DIRECTIONS)[number]["id"];
export type ChargeSign = (typeof CHARGE_SIGNS)[number]["id"];
export type ChargeSettings = Readonly<{
  electricVpm: number;
  magneticMt: number;
  speedKms: number;
  direction: ChargeDirection;
  charge: ChargeSign;
}>;
export type ChargeInputKey = keyof ChargeSettings;
export type ChargeInputs = Readonly<Record<ChargeInputKey, string>>;

export const DEFAULT_CHARGE_SETTINGS: ChargeSettings = Object.freeze({
  electricVpm: 1000,
  magneticMt: 1,
  speedKms: 1000,
  direction: "x",
  charge: "positive",
});

export type ChargeRefusal = Readonly<{
  kind: "refused";
  field: ChargeInputKey | null;
  reason: string;
}>;

export type ChargeSnapshot = Readonly<{
  settings: ChargeSettings;
  chargeC: number;
  velocityMps: Vec3;
  electricFieldVpm: Vec3;
  magneticFieldT: Vec3;
  electricForceN: Vec3;
  magneticForceN: Vec3;
  totalForceN: Vec3;
  electricMagnitudeN: number;
  magneticMagnitudeN: number;
  totalMagnitudeN: number;
}>;

export type ChargeResult = Readonly<{ kind: "accepted"; snapshot: ChargeSnapshot }> | ChargeRefusal;

const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

function isDirection(value: unknown): value is ChargeDirection {
  return CHARGE_DIRECTIONS.some((direction) => direction.id === value);
}

function isCharge(value: unknown): value is ChargeSign {
  return CHARGE_SIGNS.some((charge) => charge.id === value);
}

function checkChargeSettings(settings: ChargeSettings): ChargeRefusal | null {
  for (const field of CHARGE_FIELDS) {
    const value = settings[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max)
      return { kind: "refused", field: field.key, reason: field.refusal };
  }
  if (!isDirection(settings.direction))
    return {
      kind: "refused",
      field: "direction",
      reason: "Choose a velocity direction from the list.",
    };
  if (!isCharge(settings.charge))
    return { kind: "refused", field: "charge", reason: "Choose a positive or negative charge." };
  return null;
}

export function chargeInputs(settings: ChargeSettings): ChargeInputs {
  return {
    electricVpm: String(settings.electricVpm),
    magneticMt: String(settings.magneticMt),
    speedKms: String(settings.speedKms),
    direction: settings.direction,
    charge: settings.charge,
  };
}

/** The draft never supplies a zero for an empty field or silently chooses an unknown direction. */
export function readChargeInputs(
  inputs: ChargeInputs,
): Readonly<{ kind: "accepted"; settings: ChargeSettings }> | ChargeRefusal {
  for (const field of CHARGE_FIELDS) {
    if (inputs[field.key].trim() === "")
      return { kind: "refused", field: field.key, reason: field.refusal };
  }
  if (!isDirection(inputs.direction))
    return {
      kind: "refused",
      field: "direction",
      reason: "Choose a velocity direction from the list.",
    };
  if (!isCharge(inputs.charge))
    return { kind: "refused", field: "charge", reason: "Choose a positive or negative charge." };
  const settings: ChargeSettings = {
    electricVpm: Number(inputs.electricVpm),
    magneticMt: Number(inputs.magneticMt),
    speedKms: Number(inputs.speedKms),
    direction: inputs.direction,
    charge: inputs.charge,
  };
  const refusal = checkChargeSettings(settings);
  return refusal ?? { kind: "accepted", settings: Object.freeze(settings) };
}

/**
 * Hold E, B and the velocity at one event in one frame. All three force vectors come from the
 * same existing owner, with the unwanted field set to zero for each separate contribution.
 * No trajectory, acceleration or frame transformation is inferred from this instantaneous force.
 */
export function chargeForces(input: ChargeSettings): ChargeResult {
  const refusal = checkChargeSettings(input);
  if (refusal) return refusal;
  const settings = Object.freeze({ ...input });
  const chargeC = (settings.charge === "positive" ? 1 : -1) * ELEMENTARY_CHARGE;
  const speedMps = settings.speedKms * 1000;
  const velocityMps = Object.freeze({
    x: settings.direction === "x" ? speedMps : 0,
    y: settings.direction === "y" ? speedMps : 0,
    z: settings.direction === "z" ? speedMps : 0,
  });
  const electricFieldVpm = Object.freeze({ x: 0, y: settings.electricVpm, z: 0 });
  const magneticFieldT = Object.freeze({ x: 0, y: 0, z: settings.magneticMt * 1e-3 });
  const electricForceN = lorentzForce(chargeC, electricFieldVpm, ZERO, velocityMps);
  const magneticForceN = lorentzForce(chargeC, ZERO, magneticFieldT, velocityMps);
  const totalForceN = lorentzForce(chargeC, electricFieldVpm, magneticFieldT, velocityMps);
  const forces = [electricForceN, magneticForceN, totalForceN];
  if (forces.some((force) => ![force.x, force.y, force.z].every(Number.isFinite)))
    return {
      kind: "refused",
      field: null,
      reason: "The force model could not calculate these settings. Choose another setting.",
    };

  return {
    kind: "accepted",
    snapshot: Object.freeze({
      settings,
      chargeC,
      velocityMps,
      electricFieldVpm,
      magneticFieldT,
      electricForceN,
      magneticForceN,
      totalForceN,
      electricMagnitudeN: Math.hypot(electricForceN.x, electricForceN.y, electricForceN.z),
      magneticMagnitudeN: Math.hypot(magneticForceN.x, magneticForceN.y, magneticForceN.z),
      totalMagnitudeN: Math.hypot(totalForceN.x, totalForceN.y, totalForceN.z),
    }),
  };
}
