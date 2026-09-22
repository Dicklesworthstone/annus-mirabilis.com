/** Binding only: all optical laws are evaluated by the existing shelf-optics owner.
 * No animation clock, fitted historical dataset or additional physics lives here.
 */
import type { ScientificResult } from "../results/types.ts";
import {
  fizeauFringeShift,
  michelsonMorleyFringeShift,
  relativisticDraggedSpeed,
  waveEquationResidual,
} from "../../physics/reference/shelfOptics.ts";
import { parseShelfParameters, type ShelfParameters } from "./definition.ts";
import type { ShelfMetric, ShelfReport, ShelfRow } from "./state.ts";

function metric(label: string, unit: string, result: ScientificResult): ShelfMetric {
  if (result.status !== "value" || typeof result.value !== "number" || !Number.isFinite(result.value)) {
    throw new Error(`The shelf-optics owner did not return a finite scalar for ${label}.`);
  }
  return { label, unit, value: result.value, quantityId: result.quantityId, ownerId: result.ownerId };
}

function scalar(label: string, unit: string, value: number, quantityId: string, functionName: string): ShelfMetric {
  if (!Number.isFinite(value)) throw new Error(`Nonfinite owner output: ${label}`);
  return { label, unit, value, quantityId, ownerId: `shelf-optics.${functionName}` };
}

export function evaluateShelfOptics(input: ShelfParameters): ShelfReport {
  // Runtime admission also protects direct server/script callers, not only the form.
  const parsed = parseShelfParameters(input.instrumentId, input);
  if (parsed.kind !== "parameters") throw new Error(parsed.message);
  const p = parsed.parameters;
  const constantSet = "modern-si-2019";
  switch (p.instrumentId) {
    case "shelf-michelson-morley": {
      const rows: ShelfRow[] = [false, true].map((contraction) => {
        const result = michelsonMorleyFringeShift({
          length: p.armLength, wavelength: p.wavelength, beta: p.beta, contraction, constantSet,
        });
        if (result.status !== "value") throw new Error(result.reason);
        return {
          modelId: result.modelIdentity,
          label: contraction ? "Ether with longitudinal contraction" : "Ether without contraction",
          metrics: [
            metric("90° rotation shift", "fringes", result.fringeShift),
            scalar("Leading order in β²", "fringes", result.expectedFringeShiftFirstOrder, "leadingRotationShift", "michelsonMorleyFringeShift"),
            metric("Parallel round-trip time", "s", result.timeParallel),
            metric("Perpendicular round-trip time", "s", result.timePerpendicular),
            metric("Arm-time difference before rotation", "s", result.timeDifference),
          ],
        };
      });
      return {
        parameters: p, rows, primaryMetric: "90° rotation shift", later: [],
        interpretation: "For these equal arms, the contraction hypothesis cancels the rotation signal. A null result therefore does not by itself distinguish this contracted-ether model from every other null-predicting account. The arm-time difference at one orientation is not the full 90° rotation fringe shift. The β² expression is a low-speed approximation, not the exact high-speed curve.",
      };
    }
    case "shelf-fizeau": {
      const hypotheses = ["no-drag", "full-drag", "fresnel-drag"] as const;
      const labels = { "no-drag": "No drag", "full-drag": "Full drag", "fresnel-drag": "Fresnel drag" };
      const rows: ShelfRow[] = hypotheses.map((dragHypothesis) => {
        const result = fizeauFringeShift({
          waterPathPerBeam: p.waterPathPerBeam, waterSpeed: p.waterSpeed,
          refractiveIndex: p.refractiveIndex, wavelength: p.wavelength,
          reversal: p.reversal, dragHypothesis, constantSet,
        });
        if (result.status !== "value") throw new Error(result.reason);
        return {
          modelId: result.modelIdentity, label: labels[dragHypothesis],
          metrics: [
            metric("Signed fringe shift", "fringes", result.fringeShift),
            metric("First-order fringe shift", "fringes", result.fringeShiftFirstOrder),
            metric("Drag coefficient", "1", result.dragCoefficient),
            metric("Travel-time difference", "s", result.timeDifference),
            metric("Forward path speed", "m/s", result.speedAlongFlow),
            metric("Backward path speed magnitude", "m/s", result.speedAgainstFlow),
          ],
        };
      });
      const later: ShelfMetric[] = [];
      if (p.showLater) {
        const result = relativisticDraggedSpeed({
          refractiveIndex: p.refractiveIndex, waterSpeed: p.waterSpeed, constantSet,
        });
        if (result.status !== "value") throw new Error(result.reason);
        later.push(
          metric("Relativistic forward speed", "m/s", result.draggedSpeed),
          metric("Relativistic velocity increment", "m/s", result.velocityIncrement),
          metric("Fresnel first-order increment", "m/s", result.fresnelFirstOrderIncrement),
          metric("Correction beyond the Fresnel increment", "m/s", result.secondOrderTerm),
        );
      }
      return {
        parameters: p, rows, primaryMetric: "Signed fringe shift", later,
        interpretation: p.reversal
          ? "The table compares opposite flow directions: the signed shift is twice the one-direction comparison. Reversing the signed water speed reverses this signal. The entered path is the total water path per beam, not the length of one tube. These are consequences of stipulated drag speeds, not fitted measurements."
          : "The table gives the one-direction beam comparison. Selecting flow reversal doubles it; changing the sign of the water speed reverses it. Fresnel's drag-speed law is a first-order description: exact travel-time arithmetic within that law is not an exact theory of a moving dielectric.",
      };
    }
    case "shelf-maxwell-galilean": {
      const rows: ShelfRow[] = (["galilean", "lorentz"] as const).map((map) => {
        const result = waveEquationResidual({ map, beta: p.beta, wavenumber: p.wavenumber, constantSet });
        if (result.status !== "value") throw new Error(result.reason);
        return {
          modelId: result.modelIdentity, label: map === "galilean" ? "Galilean substitution" : "Lorentz substitution",
          metrics: [
            metric("Residual normalized by k²", "1", result.relativeResidual),
            metric("Maximum absolute residual", "1/m²", result.maxResidual),
            scalar("Mixed-derivative coefficient", "s/m", result.crossTermCoefficient, "mixedDerivativeCoefficient", "waveEquationResidual"),
          ],
        };
      });
      return {
        parameters: p, rows, primaryMetric: "Residual normalized by k²", later: [],
        interpretation: "This checks the same forward-travelling plane wave after each coordinate substitution, not a measured wave or a grid simulation. At zero relative speed both residuals vanish. The Lorentz zero is an analytic identity under the stated map; it does not independently prove a field transformation or select an interpretation of space and time. Reversing the frame velocity while holding the forward wave fixed is a different relative configuration.",
      };
    }
  }
}
