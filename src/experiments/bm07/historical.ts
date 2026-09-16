/**
 * Historical BM-07 path. Does not invent Perrin table numbers: the digitized
 * HistoricalDataset is owned by am-data-perrin-1909-p7ku and is not in this tree.
 * Einstein's printed N = 6.17e23 is a light-paper regression of the inversion
 * owner, reconstructed from R measured without counting molecules, never from
 * a modern exact k_B.
 */
import {
  type ConstantSet,
  createDeclaredConstantSet,
  withHistoricalGuard,
} from "../../physics/reference/constants.ts";
import {
  type Assessment,
  estimateSummaryStatistics,
  invertToMolecularNumber,
  type NumberMeaning,
  summaryChiSquareInterval,
} from "../../physics/reference/inference.ts";

export const EINSTEIN_PRINTED_MOLECULAR_NUMBER = 6.17e23;

export function einsteinPrintedInversionSet(): ConstantSet {
  return createDeclaredConstantSet({
    id: "scenario-einstein-printed-molecular-number",
    era: 1905,
    provenance:
      "Ann. Phys. (4) 17, 136-137 prints N = 6.17e23 from Planck's coefficients. R is an editorial gas-measurement input; modern exact k_B and N_A are not used.",
    precisionNote:
      "Printed-era inversion regression, not a facsimile transcription of table cells.",
    gasConstantProvenance: "measured-without-counting-molecules",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: 8.31,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "measured-observation",
        provenance: "Gas-measurement R used with the printed molecular number; not N_A k_B.",
        dependsOn: [],
        uncertainty: 0.01,
      },
    ],
  });
}

export function invertEinsteinPrintedMolecularNumber(): ReturnType<typeof invertToMolecularNumber> {
  const set = einsteinPrintedInversionSet();
  const temperature = 293.15,
    viscosity = 0.001,
    particleRadius = 0.5e-6;
  const molarGasConstant = 8.31;
  const C = (molarGasConstant * temperature) / (6 * Math.PI * viscosity * particleRadius);
  const diffusionCoefficient = C / EINSTEIN_PRINTED_MOLECULAR_NUMBER;
  return withHistoricalGuard(() =>
    invertToMolecularNumber(
      {
        T: temperature,
        eta: viscosity,
        a: particleRadius,
        radiusProvenance: "independently-declared",
        dHat: diffusionCoefficient,
        interval: {
          lower: diffusionCoefficient,
          upper: diffusionCoefficient,
          coverage: 1,
          q: 100,
          uncertaintyKind: "statistical-interval",
          coverageKind: "exact",
          estimatorId: "printed-point",
        },
        synthetic: false,
      },
      set,
    ),
  );
}

export type PerrinSummarySeries = Readonly<{
  id: string;
  meanSquareDisplacement: number;
  observationInterval: number;
  independentCoordinateCount: number | null;
  temperature: number;
  viscosity: number;
  radius: number;
  reportedN: number | null;
  locator: string;
}>;

export function evaluatePerrinSummary(
  series: PerrinSummarySeries,
  set: ConstantSet,
): Assessment<{
  dHat: number;
  nHat: number | null;
  semanticKind: NumberMeaning;
  intervalStatus: "value" | "not-applicable";
  intervalReason: string;
}> {
  return withHistoricalGuard(() => {
    const summary = estimateSummaryStatistics({
      meanSquareDisplacement: series.meanSquareDisplacement,
      observationInterval: series.observationInterval,
      independentCoordinateCount: series.independentCoordinateCount,
    });
    if (summary.kind !== "accepted") return summary;
    const band = summaryChiSquareInterval(summary.data, 0.05);
    const intervalStatus =
      band.kind === "accepted" ? ("value" as const) : ("not-applicable" as const);
    const intervalReason =
      band.kind === "no-value" ? band.reason : band.kind === "refused" ? band.refusal.message : "";
    if (band.kind !== "accepted") {
      const inverse = invertToMolecularNumber(
        {
          T: series.temperature,
          eta: series.viscosity,
          a: series.radius,
          radiusProvenance: "independently-declared",
          dHat: summary.data.dHat,
          interval: {
            lower: summary.data.dHat,
            upper: summary.data.dHat,
            coverage: 1,
            q: 1,
            uncertaintyKind: "statistical-interval",
            coverageKind: "exact",
            estimatorId: "summary-statistic",
          },
          synthetic: false,
        },
        set,
      );
      if (inverse.kind !== "accepted") return inverse;
      return {
        kind: "accepted",
        data: {
          dHat: summary.data.dHat,
          nHat: inverse.data.estimate,
          semanticKind: inverse.data.semanticKind,
          intervalStatus,
          intervalReason,
        },
      };
    }
    const inverse = invertToMolecularNumber(
      {
        T: series.temperature,
        eta: series.viscosity,
        a: series.radius,
        radiusProvenance: "independently-declared",
        dHat: summary.data.dHat,
        interval: band.data,
        synthetic: false,
      },
      set,
    );
    if (inverse.kind !== "accepted") return inverse;
    return {
      kind: "accepted",
      data: {
        dHat: summary.data.dHat,
        nHat: inverse.data.estimate,
        semanticKind: inverse.data.semanticKind,
        intervalStatus,
        intervalReason,
      },
    };
  });
}

export function perrin1909DatasetStatus(): Assessment<never> {
  return {
    kind: "no-value",
    status: "underdetermined",
    reason:
      "The Perrin 1909 HistoricalDataset is not yet admitted (am-data-perrin-1909-p7ku). No table numbers have been invented.",
  };
}
