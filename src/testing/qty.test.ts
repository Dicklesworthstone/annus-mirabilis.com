import { describe, expect, test } from "bun:test";
import {
  areDimensionsEqual,
  assertPortValue,
  createPortContract,
  DIM_CURRENT,
  DIM_DIMENSIONLESS,
  DIM_ENERGY,
  DIM_FORCE,
  DIM_LENGTH,
  DIM_MAGNETIC_FLUX_DENSITY,
  DIM_MASS,
  DIM_POWER,
  DIM_TEMPERATURE,
  DIM_TIME,
  DIM_VELOCITY,
  DIM_VOLTAGE,
  DimensionContractError,
  divideDimensions,
  formatDimensionVector,
  isDimensionless,
  multiplyDimensions,
  parseUnitToDimension,
  powerDimension,
  qtyDimension,
  validatePortValue,
} from "../units/qty.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("SI Quantity Algebra and Port Contracts", () => {
  test("dimension vector arithmetic (multiply, divide, power, equality)", () => {
    const start = performance.now();
    // Velocity = Length / Time
    const vel = divideDimensions(DIM_LENGTH, DIM_TIME);
    expect(areDimensionsEqual(vel, DIM_VELOCITY)).toBe(true);

    // Force = Mass * Acceleration = Mass * (Length / Time^2)
    const acc = divideDimensions(DIM_VELOCITY, DIM_TIME);
    const force = multiplyDimensions(DIM_MASS, acc);
    expect(areDimensionsEqual(force, DIM_FORCE)).toBe(true);

    // Energy = Force * Length
    const energy = multiplyDimensions(force, DIM_LENGTH);
    expect(areDimensionsEqual(energy, DIM_ENERGY)).toBe(true);

    // Power = Energy / Time
    const power = divideDimensions(energy, DIM_TIME);
    expect(areDimensionsEqual(power, DIM_POWER)).toBe(true);

    // Power dimension: Length^2
    const area = powerDimension(DIM_LENGTH, 2);
    expect(formatDimensionVector(area)).toBe("L^2");

    expect(isDimensionless(DIM_DIMENSIONLESS)).toBe(true);
    expect(isDimensionless(DIM_ENERGY)).toBe(false);

    appendExtractionLog({
      logRunId,
      testId: "qty-dimension-arithmetic",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "SI dimension vector multiplication, division, and power operations match physical laws",
    });
  });

  test("parses physical units into exact 6D SI dimension vectors", () => {
    const start = performance.now();
    expect(areDimensionsEqual(parseUnitToDimension("N"), DIM_FORCE)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("W"), DIM_POWER)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("J"), DIM_ENERGY)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("V"), DIM_VOLTAGE)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("A"), DIM_CURRENT)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("K"), DIM_TEMPERATURE)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("m/s"), DIM_VELOCITY)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("tesla"), DIM_MAGNETIC_FLUX_DENSITY)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension("T"), DIM_MAGNETIC_FLUX_DENSITY)).toBe(true);
    expect(areDimensionsEqual(parseUnitToDimension(""), DIM_DIMENSIONLESS)).toBe(true);

    expect(qtyDimension("N")).toBe("ML/T²");
    expect(qtyDimension("W")).toBe("ML²/T³");
    expect(qtyDimension("J")).toBe("ML²/T²");

    appendExtractionLog({
      logRunId,
      testId: "qty-unit-parsing",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "parseUnitToDimension parses SI units including tesla (T) and mechanical/electrical units",
    });
  });

  test("port contracts enforce declared dimensions and refuse dimension mismatches", () => {
    const start = performance.now();
    const powerContract = createPortContract("laserPower", "W", "power-in");
    expect(powerContract.isDimensionless).toBe(false);

    const validVal = validatePortValue(powerContract, 100, "W");
    expect(validVal.valid).toBe(true);

    const wrongUnitVal = validatePortValue(powerContract, 100, "J");
    expect(wrongUnitVal.valid).toBe(false);
    expect(wrongUnitVal.refusalReason).toContain("Dimension mismatch");

    const nonFiniteVal = validatePortValue(powerContract, Number.NaN, "W");
    expect(nonFiniteVal.valid).toBe(false);
    expect(nonFiniteVal.refusalReason).toContain("Non-finite numeric value");

    expect(() => assertPortValue(powerContract, 100, "J")).toThrow(DimensionContractError);

    // Topology ports must be dimensionless
    const topoContract = createPortContract("beamSplitterState", "1", "topology");
    expect(topoContract.isDimensionless).toBe(true);

    const topoWithPhysicalUnit = validatePortValue(topoContract, 1, "m/s");
    expect(topoWithPhysicalUnit.valid).toBe(false);
    expect(topoWithPhysicalUnit.refusalReason).toContain("must be dimensionless");

    appendExtractionLog({
      logRunId,
      testId: "qty-port-contracts-validation",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "createPortContract and validatePortValue enforce dimensions and prevent topology/SI confusion",
    });
  });
});
