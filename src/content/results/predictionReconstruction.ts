import type { Expression } from "../../equations/ast.ts";
import {
  predictionNumber,
  predictionProduct,
  predictionQuotient,
} from "../../equations/derivations/brownianPrediction.ts";
import type {
  BrownianPredictionNumericalRow,
  BrownianPredictionReconstruction,
  BrownianPredictionReport,
} from "../../equations/derivations/brownianPredictionProof.ts";
import { checkRationalSimplification } from "../../equations/derivations/rationalSimplification.ts";
import { convert, getConstantSet } from "../../physics/reference/constants.ts";
import { printedBrownianDisplacement } from "../../physics/reference/diffusion/printedDisplacement.ts";

const PRINTED_SET = "einstein-1905-brownian-printed";

function equal(left: Expression, right: Expression): boolean {
  return checkRationalSimplification(left, right).outcome === "equal";
}

function unitScales() {
  return {
    energy: predictionNumber(String(convert(1, "erg", "J"))),
    viscosity: predictionNumber(String(convert(1, "poise", "Pa s"))),
    length: predictionNumber(String(convert(1, "cm", "m"))),
  };
}

/**
 * Evaluate only the existing printed-displacement owner. These floating values do not
 * decide whether the algebra passed, and no comparison certifies the source's rounding.
 */
export function reconstructBrownianPrediction(): BrownianPredictionReconstruction {
  const constants = getConstantSet(PRINTED_SET);
  const entry = (quantityId: string) => {
    const matches = constants.entries.filter((candidate) => candidate.quantityId === quantityId);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const temperature = entry("temperature");
  const viscosity = entry("viscosity");
  const radius = entry("particleRadius");
  const gasConstant = entry("molarGasConstant");
  const molecularNumber = entry("avogadroConstant");
  const entries = [temperature, viscosity, radius, gasConstant, molecularNumber];
  const temperatureDecimal = temperature?.exactDecimal;
  const viscosityDecimal = viscosity?.exactDecimal;
  const radiusDecimal = radius?.exactDecimal;
  const gasConstantDecimal = gasConstant?.exactDecimal;
  const molecularNumberDecimal = molecularNumber?.exactDecimal;
  if (
    !temperature ||
    !viscosity ||
    !radius ||
    !gasConstant ||
    !molecularNumber ||
    typeof temperatureDecimal !== "string" ||
    typeof viscosityDecimal !== "string" ||
    typeof radiusDecimal !== "string" ||
    typeof gasConstantDecimal !== "string" ||
    typeof molecularNumberDecimal !== "string" ||
    entries.some(
      (candidate) =>
        !candidate ||
        !Number.isFinite(candidate.value) ||
        candidate.value <= 0 ||
        typeof candidate.exactDecimal !== "string" ||
        candidate.value !== Number(candidate.exactDecimal),
    )
  )
    return { status: "unavailable", reason: "The declared historical input set is incomplete." };

  const scale = unitScales();
  const sourceInputsMatch = [
    equal(
      { kind: "sum", args: [predictionNumber("17"), predictionNumber("273.15")] },
      predictionNumber(temperatureDecimal),
    ),
    equal(
      predictionProduct(predictionNumber("0.0135"), scale.viscosity),
      predictionNumber(viscosityDecimal),
    ),
    equal(
      predictionProduct(
        predictionQuotient(predictionNumber("0.0001"), predictionNumber("2")),
        scale.length,
      ),
      predictionNumber(radiusDecimal),
    ),
    equal(
      predictionProduct(predictionNumber("8.31e7"), scale.energy),
      predictionNumber(gasConstantDecimal),
    ),
    equal(predictionNumber("6e23"), predictionNumber(molecularNumberDecimal)),
  ].every(Boolean);
  if (!sourceInputsMatch)
    return {
      status: "unavailable",
      reason: "The declared inputs no longer match this reconstruction's unit and radius setup.",
    };

  const rows: BrownianPredictionNumericalRow[] = [];
  for (const elapsedSeconds of [1, 60]) {
    const output = printedBrownianDisplacement({
      temperatureK: temperature.value,
      viscosityPaS: viscosity.value,
      particleRadiusM: radius.value,
      elapsedSeconds,
    });
    if (
      output.status !== "value" ||
      output.printed.constantSetId !== PRINTED_SET ||
      !Number.isFinite(output.printed.value) ||
      output.printed.value <= 0 ||
      !Number.isFinite(output.printed.diffusionCoefficient) ||
      output.printed.diffusionCoefficient <= 0
    )
      return {
        status: "unavailable",
        reason: "The shared printed-displacement calculation did not return finite model values.",
      };
    rows.push({
      elapsedSeconds,
      diffusionCoefficientM2PerS: output.printed.diffusionCoefficient,
      rmsMetres: output.printed.value,
      rmsMicrometres: output.printed.value * 1e6,
    });
  }
  return { status: "value", constantSetId: PRINTED_SET, rows };
}

/** Join server-owned numerical rows to an independently checked, serializable reading report. */
export function enrichBrownianPrediction(
  report: BrownianPredictionReport,
): BrownianPredictionReport {
  if (!report.passed) return report;
  return { ...report, reconstruction: reconstructBrownianPrediction() };
}
