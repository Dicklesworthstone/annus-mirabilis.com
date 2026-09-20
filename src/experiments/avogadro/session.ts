import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { estimateSummaryStatistics, identifiabilityFamily, invertToMolecularNumber, summaryChiSquareInterval } from "../../physics/reference/inference.ts";
import { inferMolecularDimensions } from "../../physics/reference/molecularDimensions.ts";
import { avogadroFromPlanckConstants, MODERN_AVOGADRO } from "../../physics/reference/radiation/avogadro.ts";
import type { ResultPayload, ScientificResult } from "../results/types.ts";
import { createInstanceStore, type OutputContract, type ParameterClass } from "../store/instanceStore.ts";
import { AVOGADRO_DEFAULTS, type AvogadroParameters, validateAvogadroParameters } from "./definition.ts";

const constants = getConstantSet("modern-si-2019");
const R = constantValue(constants, "molarGasConstant").value;

function scalar(quantityId: string, unit: string, ownerId: string, payload: ResultPayload): ScientificResult {
  return Object.freeze({ quantityId, unit, ownerId, semanticKind: "avogadro-comparison", ...payload });
}
const outside = (reason: string): ResultPayload => Object.freeze({
  status: "outside-domain", condition: "inference-not-admitted", domainKind: "model", reason,
  boundary: Object.freeze({ alternativeModel: "the detailed Brownian inference laboratory" }),
});

/** Composition only: the radiation, inference and companion owners supply the laws. */
export function evaluateAvogadro(input: unknown) {
  const checked = validateAvogadroParameters(input);
  if (checked.kind !== "accepted") return checked;
  const p = checked.parameters;
  const output: ScientificResult[] = [];
  // N is inversely proportional to alpha with every other historical input held fixed.
  // This is a sensitivity comparison of the existing owner's historical reconstruction,
  // never a claim that the perturbed constant is an observed historical measurement.
  const radiation = avogadroFromPlanckConstants();
  output.push(scalar("radiationNumber", "mol^-1", "radiation", { status: "value", value: radiation.avogadroConstant / p.alphaScale }));
  output.push(scalar("definedNumber", "mol^-1", "radiation", { status: "value", value: MODERN_AVOGADRO }));

  const summary = estimateSummaryStatistics({
    meanSquareDisplacement: p.meanSquareUm2 * 1e-12,
    observationInterval: p.observationSeconds, independentCoordinateCount: p.coordinateCount,
  });
  let brownian: ResultPayload = outside("The supplied summary is not admitted by the inference owner.");
  let product: ResultPayload = brownian;
  if (p.independentModel === 0) {
    brownian = outside("Noise, blur, drift, overlap or censoring need their own observation model. No independent-increment interval is supplied.");
    product = brownian;
  } else if (summary.kind === "accepted") {
    const family = identifiabilityFamily({ D: summary.data.dHat, T: p.temperature,
      eta: p.viscosityMpaS * 1e-3, radiusRange: [p.radiusUm * 1e-6, p.radiusUm * 2e-6], synthetic: false }, constants);
    if (family.kind === "accepted") product = { status: "value", value: family.data.product };
    if (p.radiusKnown === 0) {
      brownian = { status: "underdetermined", compatibleFamily: "a N = RT/(6 pi eta D). Doubling the radius halves the compatible molecular number.",
        neededInformation: Object.freeze(["An independently established particle radius."]) };
    } else {
      const interval = summaryChiSquareInterval(summary.data, 0.05);
      if (interval.kind === "accepted") {
        const inverse = invertToMolecularNumber({ T: p.temperature, eta: p.viscosityMpaS * 1e-3,
          a: p.radiusUm * 1e-6, radiusProvenance: "independently-declared", dHat: summary.data.dHat,
          interval: interval.data, synthetic: false }, constants);
        if (inverse.kind === "accepted") brownian = {
          status: "value", value: inverse.data.estimate,
          uncertainty: Object.freeze({ kind: "statistical-interval", lower: inverse.data.interval.lower,
            upper: inverse.data.interval.upper, coverage: inverse.data.interval.coverage,
            sampleSize: p.coordinateCount, method: "Independent Gaussian coordinate increments, known zero drift; exact auxiliary inputs; conditional 95% chi-square interval." }),
        };
        else if (inverse.kind === "no-value") brownian = outside(inverse.reason);
      }
    }
  }
  output.push(scalar("brownianNumber", "mol^-1", "diffusion-inference", brownian));
  output.push(scalar("brownianRadiusProduct", "m/mol", "diffusion-inference", product));
  const companion = inferMolecularDimensions({ temperature: p.temperature, viscosity: p.viscosityMpaS * 1e-3,
    diffusion: p.soluteDiffusionUm2S * 1e-12, molarConcentration: p.molarConcentration,
    specificViscosity: p.specificViscosity, gasConstant: R, viscosityCoefficient: p.coefficient === 1 ? 1 : 2.5 });
  output.push(companion.radius, companion.molecularNumber, companion.radiusTimesMolecularNumber, companion.volumeFraction);
  return Object.freeze({ kind: "accepted" as const, parameters: p, outputs: Object.freeze(output) });
}

export function createAvogadroSession(instanceId: string, initialParameters: AvogadroParameters = AVOGADRO_DEFAULTS) {
  const initial = evaluateAvogadro(initialParameters);
  if (initial.kind !== "accepted") throw new Error(initial.reason);
  const classes: Record<string, ParameterClass> = Object.fromEntries(Object.keys(AVOGADRO_DEFAULTS).map((key) => [key, "input"]));
  const outputs: Record<string, OutputContract> = Object.fromEntries(initial.outputs.map((r) => [r.quantityId, {
    unit: r.unit, semanticKind: r.semanticKind, ownerId: r.ownerId,
    statuses: Object.freeze(["value", "outside-domain", "underdetermined"] as const),
  }]));
  const store = createInstanceStore({ experimentId: "avogadro-lab", instanceId,
    initialParameters: initial.parameters, parameterClasses: classes, outputs, allowPartial: true });
  const first = store.publish({ ...store.issue("setup-change"), stepIndex: 0, simulationTime: 0, final: true, outputs: initial.outputs });
  if (!first.accepted) throw new Error(`Avogadro publication refused: ${first.reason}`);
  const serverSnapshot = store.getSnapshot();
  return Object.freeze({
    getSnapshot: store.getSnapshot, getServerSnapshot: () => serverSnapshot, subscribe: store.subscribe,
    apply(input: unknown) {
      // A refused draft never relabels old numbers or leaves a pending revision.
      const evaluated = evaluateAvogadro(input);
      if (evaluated.kind !== "accepted") return evaluated;
      // The diff below reads keys from Object.entries, so they arrive typed as `string`. Both sides
      // of this union are object types with no index signature, and indexing them with a string is
      // what TS7053 refuses. Annotating the binding as a read-only bag says what the diff actually
      // does - compare values by identity, key by key - without asserting which keys exist, which a
      // cast at the index site would have done silently.
      const previous: Readonly<Record<string, unknown>> =
        store.getSnapshot().accepted?.parameters ?? initial.parameters;
      const changed = Object.fromEntries(Object.entries(evaluated.parameters).filter(([key, value]) => !Object.is(previous[key], value)));
      if (Object.keys(changed).length) {
        const decision = store.publish({ ...store.issue("setup-change", changed), stepIndex: 0,
          simulationTime: 0, final: true, outputs: evaluated.outputs });
        if (!decision.accepted) throw new Error(`Avogadro publication refused: ${decision.reason}`);
      }
      return Object.freeze({ kind: "accepted" as const, parameters: evaluated.parameters });
    },
  });
}
