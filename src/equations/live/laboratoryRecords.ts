import { ContentError } from "../../content/compiler/json.ts";
import { type EquationRecord, parseEquationRecord } from "../record.ts";
import type { LaboratoryEquationId } from "./laboratoryOutputs.ts";

type Declaration = Readonly<{ id: string; terms: readonly (readonly [string, string])[] }>;
/** Exact occurrences, including repeated angles and speeds, rather than a quantity-wide guess. */
const declarations: Readonly<Record<LaboratoryEquationId, readonly Declaration[]>> = {
  "bm-06": [
    {
      id: "eq-model-bm-rms",
      terms: [
        ["rms", "rmsDisplacement1d"],
        ["diffusion", "diffusionCoefficient"],
      ],
    },
  ],
  "sr-03": [
    {
      id: "eq-model-sr-event-separation-position",
      terms: [
        ["positionMoving", "eventSeparationSpatialMoving"],
        ["factor", "lorentzFactor"],
        ["position", "eventSeparationSpatial"],
        ["time", "eventSeparationTemporalStationary"],
      ],
    },
    {
      id: "eq-model-sr-event-separation-time",
      terms: [
        ["timeMoving", "eventSeparationTemporalMoving"],
        ["factor", "lorentzFactor"],
        ["time", "eventSeparationTemporalStationary"],
        ["position", "eventSeparationSpatial"],
      ],
    },
  ],
  "sr-09": [
    {
      id: "eq-model-sr-doppler-factor",
      terms: [
        ["ratio", "dopplerFactor"],
        ["factor", "lorentzFactor"],
        ["speed", "frameSpeed"],
        ["angle", "propagationAngleStationary"],
      ],
    },
    {
      id: "eq-model-sr-doppler-ratio",
      terms: [
        ["ratio", "dopplerFactor"],
        ["frequencyMoving", "waveFrequencyMoving"],
        ["frequency", "waveFrequencyStationary"],
      ],
    },
    {
      id: "eq-model-sr-aberration",
      terms: [
        ["angleMoving", "propagationAngleMoving"],
        ["angle", "propagationAngleStationary"],
        ["speed", "frameSpeed"],
        ["speed2", "frameSpeed"],
        ["angle2", "propagationAngleStationary"],
      ],
    },
  ],
};

/**
 * Bind existing authored trees in their laboratory context. The paper records keep their original
 * bindings, and reading-only equations can never acquire a live value through this projection.
 */
export function laboratoryEquationRecords(
  records: readonly EquationRecord[],
  experimentId: LaboratoryEquationId,
): readonly EquationRecord[] {
  return declarations[experimentId].map(({ id, terms }) => {
    const matches = records.filter((record) => record.id === id);
    const record = matches[0];
    if (matches.length !== 1 || !record)
      throw new ContentError(
        "equation-live-source",
        experimentId,
        `Expected one authored equation ${id}.`,
      );
    return parseEquationRecord(
      {
        ...record,
        bindings: terms.map(([suffix, quantityId]) => ({
          termId: `${id}.t.${suffix}`,
          quantityId,
          outputId: quantityId,
          experimentId,
          instanceSlot: "primary",
        })),
      },
      `${experimentId}/${id}`,
    );
  });
}
