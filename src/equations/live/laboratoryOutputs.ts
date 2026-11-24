import { BM06_OUTPUTS } from "../../experiments/bm06/definition.ts";
import { SR03_OUTPUTS } from "../../experiments/sr03/definition.ts";
import { SR09_OUTPUTS } from "../../experiments/sr09/definition.ts";
import type { OutputContract } from "../../experiments/store/instanceStore.ts";

export type LaboratoryEquationId = "bm-06" | "sr-03" | "sr-09";
export type EquationUnitConversion =
  | "identity"
  | "speed-in-c-to-metres-per-second"
  | "light-seconds-to-metres"
  | "degrees-to-radians";

/** Each correspondence is authored for one published quantity, never inferred from its glyph. */
export type LaboratoryOutputProjection = Readonly<{
  sourceQuantityId: string;
  sourceUnit: string;
  sourceSemanticKind: string;
  sourceOwnerId: string;
  unit: string;
  semanticKind: string;
  conversion: EquationUnitConversion;
}>;

const projection = (
  sourceQuantityId: string,
  sourceUnit: string,
  sourceSemanticKind: string,
  sourceOwnerId: string,
  unit: string,
  semanticKind: string,
  conversion: EquationUnitConversion = "identity",
): LaboratoryOutputProjection =>
  Object.freeze({
    sourceQuantityId,
    sourceUnit,
    sourceSemanticKind,
    sourceOwnerId,
    unit,
    semanticKind,
    conversion,
  });

/**
 * A closed translation between the laboratories' published vocabulary and the equation registry.
 * No output is calculated here. Constants and unpublished quantities deliberately have no entry.
 */
export const LABORATORY_OUTPUT_PROJECTIONS: Readonly<
  Record<LaboratoryEquationId, Readonly<Record<string, LaboratoryOutputProjection>>>
> = Object.freeze({
  "bm-06": Object.freeze({
    // A copied D governs the spread. The physical-settings Stokes–Einstein D may be different
    // and must never substitute for this output, even if the active output is absent.
    diffusionCoefficient: projection(
      "activeDiffusionCoefficient",
      "m2/s",
      "active-latent-diffusivity",
      "bm06.evaluate",
      "m2/s",
      "latent-diffusivity",
    ),
    rmsDisplacement1d: projection(
      "rmsDisplacement1d",
      "m",
      "latent-coordinate-rms",
      "diffusion.rmsDisplacement",
      "m",
      "latent-coordinate-rms",
    ),
  }),
  "sr-03": Object.freeze({
    // These are differences between the same pair of events, never single-event coordinates
    // or rod lengths. The owner has already transformed both events before publishing them.
    eventSeparationSpatial: projection(
      "spatialSeparationK",
      "ls",
      "coordinate-differential",
      "sr03-rod-simultaneity-v1",
      "m",
      "event-separation",
      "light-seconds-to-metres",
    ),
    eventSeparationSpatialMoving: projection(
      "spatialSeparationKPrime",
      "ls",
      "coordinate-differential",
      "sr03-rod-simultaneity-v1",
      "m",
      "event-separation",
      "light-seconds-to-metres",
    ),
    eventSeparationTemporalStationary: projection(
      "temporalSeparationK",
      "s",
      "coordinate-differential",
      "sr03-rod-simultaneity-v1",
      "s",
      "event-separation",
    ),
    eventSeparationTemporalMoving: projection(
      "temporalSeparationKPrime",
      "s",
      "coordinate-differential",
      "sr03-rod-simultaneity-v1",
      "s",
      "event-separation",
    ),
    lorentzFactor: projection(
      "gammaFactor",
      "1",
      "lorentz-factor",
      "sr03-rod-simultaneity-v1",
      "1",
      "lorentz-factor",
    ),
  }),
  "sr-09": Object.freeze({
    frameSpeed: projection(
      "frameSpeed",
      "c",
      "speed",
      "waves",
      "m/s",
      "velocity-along-x",
      "speed-in-c-to-metres-per-second",
    ),
    propagationAngleStationary: projection(
      "propagationAngleStationary",
      "deg",
      "angle",
      "waves",
      "rad",
      "propagation-angle",
      "degrees-to-radians",
    ),
    propagationAngleMoving: projection(
      "propagationAngleMoving",
      "deg",
      "angle",
      "waves",
      "rad",
      "propagation-angle",
      "degrees-to-radians",
    ),
    waveFrequencyStationary: projection(
      "waveFrequencyStationary",
      "Hz",
      "frequency",
      "waves",
      "Hz",
      "wave-frequency",
    ),
    waveFrequencyMoving: projection(
      "waveFrequencyMoving",
      "Hz",
      "frequency",
      "waves",
      "Hz",
      "wave-frequency",
    ),
    dopplerFactor: projection("dopplerFactor", "1", "ratio", "waves", "1", "doppler-factor"),
    lorentzFactor: projection(
      "lorentzFactor",
      "1",
      "lorentz-factor",
      "waves",
      "1",
      "lorentz-factor",
    ),
  }),
});

export const LABORATORY_SOURCE_OUTPUTS: Readonly<
  Record<LaboratoryEquationId, Readonly<Record<string, OutputContract>>>
> = Object.freeze({ "bm-06": BM06_OUTPUTS, "sr-03": SR03_OUTPUTS, "sr-09": SR09_OUTPUTS });

export function matchesLaboratorySource(
  identity: Readonly<{ unit: string; semanticKind: string; ownerId: string }>,
  declaration: LaboratoryOutputProjection,
): boolean {
  return (
    identity.unit === declaration.sourceUnit &&
    identity.semanticKind === declaration.sourceSemanticKind &&
    identity.ownerId === declaration.sourceOwnerId
  );
}

/** The parser admits only these canonical projections, with the source's statuses and owners. */
export const LABORATORY_EQUATION_OUTPUTS: Readonly<
  Record<LaboratoryEquationId, Readonly<Record<string, OutputContract>>>
> = Object.freeze(
  Object.fromEntries(
    (Object.keys(LABORATORY_OUTPUT_PROJECTIONS) as LaboratoryEquationId[]).map((experimentId) => [
      experimentId,
      Object.freeze(
        Object.fromEntries(
          Object.entries(LABORATORY_OUTPUT_PROJECTIONS[experimentId]).flatMap(
            ([quantityId, entry]) => {
              const source = LABORATORY_SOURCE_OUTPUTS[experimentId][entry.sourceQuantityId];
              // A changed source contract does not retain the old meaning. The record parser
              // refuses bindings to the missing canonical contract.
              return source && matchesLaboratorySource(source, entry)
                ? [
                    [
                      quantityId,
                      Object.freeze({
                        ...source,
                        unit: entry.unit,
                        semanticKind: entry.semanticKind,
                      }),
                    ],
                  ]
                : [];
            },
          ),
        ),
      ),
    ]),
  ) as Record<LaboratoryEquationId, Readonly<Record<string, OutputContract>>>,
);
