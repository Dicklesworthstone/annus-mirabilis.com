/**
 * Paper 3 §8: the energy of the SAME moving light complex.
 *
 * The factors are projections of the equation records already used by the reader and SR10.
 * The substitutions check the stated algebra; the physical amplitude and moving-boundary
 * premises remain authored draft explanations, not a new claim of scientific review.
 * This reconstruction uses modern q, gamma and c and does not assume photons or E = mc².
 */

import dopplerRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import frequencyRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-ratio.json";
import densityRecord from "../../../content/equations/special-relativity/eq-model-sr-light-density.json";
import energyRecord from "../../../content/equations/special-relativity/eq-model-sr-light-energy.json";
import volumeRecord from "../../../content/equations/special-relativity/eq-model-sr-light-volume.json";
import type { Expression } from "../ast.ts";
import { nodeId } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import {
  type DerivationChain,
  DerivationSchemaError,
  type DerivationStep,
  type PremiseRef,
} from "./types.ts";

export type SRLightComplexRefusalCode =
  | "sr-light-complex-missing-glyph"
  | "sr-light-complex-relation-required"
  | "sr-light-complex-unaddressable-target";

/** Keep the schema error's path and message while exposing a stable authoring refusal code. */
export class SRLightComplexError extends DerivationSchemaError {
  readonly code: SRLightComplexRefusalCode;

  constructor(code: SRLightComplexRefusalCode, message: string, path: string) {
    super(message, path);
    this.code = code;
  }
}

const glyphs: Readonly<Record<string, string>> = {
  lightComplexEnergyMoving: "E'",
  lightComplexEnergyStationary: "E",
  lightEnergyDensityMoving: "u'",
  lightEnergyDensityStationary: "u",
  lightComplexVolumeMoving: "S'",
  lightComplexVolumeStationary: "S",
  dopplerFactor: "q",
  waveFrequencyMoving: "ν'",
  waveFrequencyStationary: "ν",
  lorentzFactor: "γ",
  frameSpeed: "v",
  speedOfLight: "c",
  propagationAngleStationary: "φ",
};

export function projectSRLightComplexRelation(record: {
  readonly id: string;
  readonly tree: Expression;
}) {
  const projected = projectDerivationSymbols(record.tree as Expression, (symbol) => {
    const glyph = glyphs[symbol.quantityId];
    if (!glyph)
      throw new SRLightComplexError(
        "sr-light-complex-missing-glyph",
        `No derivation glyph for ${symbol.quantityId}.`,
        `${record.id}.tree`,
      );
    return glyph;
  });
  if (projected.kind !== "relation")
    throw new SRLightComplexError(
      "sr-light-complex-relation-required",
      "Expected a relation.",
      `${record.id}.tree`,
    );
  return projected;
}

const projectedRelation = (record: { readonly id: string; readonly tree: unknown }) =>
  projectSRLightComplexRelation({ id: record.id, tree: record.tree as Expression });

const density = projectedRelation(densityRecord);
const volume = projectedRelation(volumeRecord);
const energy = projectedRelation(energyRecord);
const frequency = projectedRelation(frequencyRecord);

export const srLightComplexDoppler = projectedRelation(dopplerRecord);
export const srLightComplexResult: Expression = {
  kind: "relation",
  opId: "sr-light-complex.op.same-factor",
  operator: "=",
  left: energy.left,
  right: frequency.right,
};

const product = (densityFactor: Expression, volumeFactor: Expression): Expression => ({
  kind: "product",
  opId: "sr-light-complex.op.density-times-volume",
  args: [densityFactor, volumeFactor],
});
const ratios = product(density.left, volume.left);
const withDensity = product(density.right, volume.left);
const withVolume = product(density.right, volume.right);

const premise = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const reconstruction = (ref: string): PremiseRef => ({
  ref,
  edgeType: "pedagogical-reconstruction",
});

export function createSRLightComplexSubstitution(
  from: Expression,
  to: Expression,
  target: Expression,
  replacement: Expression,
  citedEquality: string,
): Pick<DerivationStep, "from" | "to" | "changedSubexpressionIds" | "rule"> {
  const targetId = nodeId(target);
  if (!targetId)
    throw new SRLightComplexError(
      "sr-light-complex-unaddressable-target",
      "SR §8 substitution needs an addressable expression.",
      "sr-light-complex.substitution.target",
    );
  const replacementId = nodeId(replacement);
  return {
    from,
    to,
    changedSubexpressionIds: [targetId, ...(replacementId ? [replacementId] : [])],
    rule: { kind: "substitute", params: { targetId, replacement, citedEquality } },
  };
}

const substitution = createSRLightComplexSubstitution;

const draft = {
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "exact-within-model",
  verification: { status: "authored-unverified" },
} as const;

export const srLightComplexDerivation: DerivationChain = {
  id: "chain-sr-light-complex",
  proofRouteId: "route-sr-light-complex-density-volume",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [
    premise("arg-sr-doppler-aberration"),
    premise("sr-light-complex-same-moving-boundary"),
    premise("sr-light-complex-energy-is-density-times-volume"),
    reconstruction("sr-light-complex-positive-q-subluminal-domain"),
  ],
  target: "sr-light-complex-energy-frequency-ratio",
  targetStepId: "sr-light-complex-same-frequency-factor",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-light-complex-separate-density-volume",
      ...substitution(
        energy.left,
        ratios,
        energy.left,
        ratios,
        "For a uniform plane-wave packet, E = u S and E' = u' S'.",
      ),
      reasonKind: "definition",
      reasons: {
        r0: "The whole packet's energy is its energy per unit volume times its volume. Compare both factors between the two frames.",
        r1: "Write E = u S in K and E′ = u′ S′ in k. The ratio E′/E therefore separates into the energy-density ratio u′/u and the packet-volume ratio S′/S. A change in density alone does not give the change in total energy.",
        r2: "For the plane-wave light complex, the energy density is uniform (or cycle averaged) over each frame's simultaneous volume. Thus E′/E = (u′ S′)/(u S) = (u′/u)(S′/S). In the printed Gaussian notation u = A²/(8π); the common unit-system factor cancels. S and S′ refer to the same moving boundary, each measured at one time in its own frame.",
      },
      tool: "foundation:integration",
      premiseRefs: [premise("sr-light-complex-energy-is-density-times-volume")],
      sourceAnchor: "sr-light-complex-source-energy",
      isMove: false,
    },
    {
      ...draft,
      id: "sr-light-complex-density-factor",
      ...substitution(
        ratios,
        withDensity,
        density.left,
        density.right,
        "eq-model-sr-light-density: u'/u = q², from the §7 field-amplitude transformation.",
      ),
      reasonKind: "physical-premise",
      reasons: {
        r0: "The wave's amplitude changes by q. Energy density depends on amplitude squared, so its factor is q².",
        r1: "Section 7 gives A′/A = q for this light's direction. Since the electromagnetic energy density is proportional to A² in each frame, u′/u = (A′/A)² = q². Leave the volume factor visible: it still has to be found.",
        r2: "The plane-wave field transformation supplies A′²/A² = γ²[1 − (v/c) cos φ]². With q = γ[1 − (v/c) cos φ] and the same field-energy coefficient in each frame, u′/u = q². The angle φ is measured in K; substituting the angle measured in k into this formula would change the premise.",
      },
      tool: "foundation:fields-waves",
      premiseRefs: [premise("arg-sr-doppler-aberration"), reconstruction(densityRecord.id)],
      sourceAnchor: "sr-light-complex-source-amplitude",
      isMove: false,
    },
    {
      ...draft,
      id: "sr-light-complex-moving-volume",
      ...substitution(
        withDensity,
        withVolume,
        volume.left,
        volume.right,
        "eq-model-sr-light-volume: S'/S = 1/q for the same boundary travelling with the light.",
      ),
      reasonKind: "physical-premise",
      reasons: {
        r0: "Follow the same piece of light. Measuring its moving boundary at one instant of the other frame gives a volume factor 1/q.",
        r1: "Einstein surrounds the light with a sphere whose surface travels with it. At one time in k, that same moving boundary is an ellipsoid with volume S′ = S/q. A material body's contraction factor 1/γ answers a different boundary question; the light's direction is essential here.",
        r2: "Let a = cos φ and let a, b, d be the direction cosines in K. Transform the moving sphere (x − ca t)² + (y − cb t)² + (z − cd t)² = R² and set t′ = 0. With x = γx′ and t = γv x′/c², its ellipsoid is [γ(1 − av/c)x′]² + [y′ − bγ(v/c)x′]² + [z′ − dγ(v/c)x′]² = R². The map from these primed coordinates back to the sphere has diagonal factors q, 1, 1 and two shears; its determinant is q. Hence q S′ = S. This is a change of simultaneous slices of the same moving light complex, not a rest volume of light.",
      },
      tool: "foundation:matrices-linear-maps",
      premiseRefs: [
        premise("sr-light-complex-same-moving-boundary"),
        reconstruction(volumeRecord.id),
      ],
      sourceAnchor: "sr-light-complex-source-volume",
      isMove: true,
      moveLabel: "Measure the same boundary travelling with the light: its volume changes by 1/q.",
    },
    {
      ...draft,
      id: "sr-light-complex-combine-factors",
      from: withVolume,
      to: energy.right,
      changedSubexpressionIds: ["sr-light-complex.op.density-times-volume", "q"],
      rule: { kind: "collect", params: {} },
      reasonKind: "algebra",
      reasons: {
        r0: "Two factors of q from density and one inverse factor from volume leave one factor of q for total energy.",
        r1: "Multiply the two different changes: E′/E = q² × (1/q) = q. At q = 0.5, the density is one quarter and the volume doubles, so the energy is one half.",
        r2: "For |v| < c and a physical propagation angle, γ > 0 and 1 − (v/c) cos φ > 0, so q is positive and division is valid. Cancel one q in q²/q to obtain E′/E = q. No small-speed expansion is used: this is exact within the plane-wave, moving-boundary model.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [reconstruction("sr-light-complex-positive-q-subluminal-domain")],
      sourceAnchor: "sr-light-complex-source-energy",
      isMove: false,
    },
    {
      ...draft,
      id: "sr-light-complex-same-frequency-factor",
      ...substitution(
        energy.right,
        frequency.right,
        energy.right,
        frequency.right,
        "eq-model-sr-doppler-ratio: q is defined as ν'/ν.",
      ),
      reasonKind: "definition",
      reasons: {
        r0: "The packet's total energy and the light's frequency change by the same factor.",
        r1: "Section 7 already identified q = ν′/ν from the wave's phase. Section 8 has now obtained E′/E = q from fields and volume, so E′/E = ν′/ν. These are two independently accounted-for changes with the same factor.",
        r2: "The shared factor is γ[1 − (v/c) cos φ], with φ measured in K. Substituting the earlier Doppler definition into the result gives E′/E = ν′/ν. This conclusion is about comparing one light complex between frames; it does not introduce a photon energy hν or a body's mass-energy formula. The September paper may subsequently import the light-energy law.",
      },
      tool: "foundation:frames-events",
      premiseRefs: [premise("arg-sr-doppler-aberration"), reconstruction(frequencyRecord.id)],
      sourceAnchor: "sr-light-complex-source-frequency",
      isMove: false,
    },
  ],
};

export const srLightComplexDerivationMetadata = {
  paper: "special-relativity",
  section: "s8",
  argument: "arg-sr-light-complex",
  review: "draft",
  notation: "modern-pedagogical",
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "exact-within-model",
  executionStatus: "static-illustration",
  sourceEquationIds: ["eq-s8-d3", "eq-s8-d4"],
} as const;

export const srLightComplexHistoricalReading = {
  r3: "Section 7 transforms the frequency and the squared field amplitude. Section 8 then follows a spherical boundary moving with the light, measures its ellipsoid on a simultaneous slice of the moving frame, and multiplies the transformed density by that volume. The paper writes the speed of light as V, the Lorentz factor as β, and the volumes as S and S′. This reconstruction introduces q and uses γ and c to keep the three factors visible. The observation that energy and frequency follow the same transformation law is Einstein’s; no light-quantum hypothesis or body mass-energy formula is a premise of this argument.",
  r3Citations: [
    "Einstein, A. (1905). Zur Elektrodynamik bewegter Körper. Annalen der Physik 17, 891–921, §§7–8, pp. 910–913.",
  ],
} as const;

export function srLightComplexReadingSet(step: DerivationStep) {
  return { ...step.reasons, ...srLightComplexHistoricalReading };
}
