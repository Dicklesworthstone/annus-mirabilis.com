import type { Uncertainty } from "../../experiments/results/types.ts";
import type {
  AcceptedSnapshot,
  ExperimentView,
  PublishedResult,
} from "../../experiments/store/instanceStore.ts";
import { convertValue } from "../../units/adapters.ts";
import {
  type EquationUnitConversion,
  LABORATORY_OUTPUT_PROJECTIONS,
  LABORATORY_SOURCE_OUTPUTS,
  type LaboratoryEquationId,
  matchesLaboratorySource,
} from "./laboratoryOutputs.ts";

/** Representation changes only: c and light-seconds use the shared exact unit registry. */
function convertScalar(value: number, conversion: EquationUnitConversion): number | null {
  if (!Number.isFinite(value)) return null;
  const converted =
    conversion === "speed-in-c-to-metres-per-second"
      ? convertValue(value, "c", "m/s")
      : conversion === "light-seconds-to-metres"
        ? convertValue(value, "ls", "m")
        : conversion === "degrees-to-radians"
          ? value * (Math.PI / 180)
          : value;
  return Number.isFinite(converted) && (value === 0 || converted !== 0) ? converted : null;
}

function convertUncertainty(
  uncertainty: Uncertainty,
  conversion: EquationUnitConversion,
): Uncertainty | null {
  if (conversion === "identity" || uncertainty.kind === "input-precision") return uncertainty;
  if (uncertainty.kind === "statistical-interval" || uncertainty.kind === "enclosure") {
    const lower = convertScalar(uncertainty.lower, conversion);
    const upper = convertScalar(uncertainty.upper, conversion);
    return lower === null || upper === null
      ? null
      : Object.freeze({ ...uncertainty, lower, upper });
  }
  const magnitude = convertScalar(uncertainty.magnitude, conversion);
  return magnitude === null ? null : Object.freeze({ ...uncertainty, magnitude });
}

const projectedSnapshots = new WeakMap<AcceptedSnapshot, AcceptedSnapshot>();

/**
 * A view for the equation surface, projected solely from one immutable accepted snapshot.
 * Its requested/accepted identities, parameters, refusals and owner ids remain the laboratory's.
 * Missing, duplicated or mismatched sources leave a term symbolic; arrays are never scalarized.
 */
export function projectLaboratoryEquationView(
  experimentId: LaboratoryEquationId,
  view: ExperimentView,
): ExperimentView {
  const accepted = view.accepted;
  if (!accepted || accepted.experimentId !== experimentId) return view;
  let projected = projectedSnapshots.get(accepted);
  if (!projected) {
    const outputs: PublishedResult[] = [];
    for (const [quantityId, entry] of Object.entries(LABORATORY_OUTPUT_PROJECTIONS[experimentId])) {
      const candidates = accepted.outputs.filter(
        (output) => output.quantityId === entry.sourceQuantityId,
      );
      const source = candidates[0];
      const contract = LABORATORY_SOURCE_OUTPUTS[experimentId][entry.sourceQuantityId];
      if (
        candidates.length !== 1 ||
        !source ||
        !contract ||
        !matchesLaboratorySource(contract, entry) ||
        !matchesLaboratorySource(source, entry) ||
        !contract.statuses.includes(source.status)
      )
        continue;
      const identity = { quantityId, unit: entry.unit, semanticKind: entry.semanticKind };
      if (source.status === "value") {
        if (typeof source.value !== "number") continue;
        const value = convertScalar(source.value, entry.conversion);
        if (value === null) continue;
        const uncertainty = source.uncertainty
          ? convertUncertainty(source.uncertainty, entry.conversion)
          : undefined;
        if (uncertainty === null) continue;
        outputs.push(
          Object.freeze({
            ...source,
            ...identity,
            value,
            ...(uncertainty ? { uncertainty } : {}),
          }),
        );
      } else {
        // These admitted outputs carry domain explanations, not
        // numeric limit representations. Preserve the owner's status, reason and repair intact.
        outputs.push(Object.freeze({ ...source, ...identity }));
      }
    }
    projected = Object.freeze({ ...accepted, outputs: Object.freeze(outputs) });
    projectedSnapshots.set(accepted, projected);
  }
  return Object.freeze({ ...view, accepted: projected });
}
