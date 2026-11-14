import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import type { MolecularDimensionsInputs } from "../../physics/reference/molecularDimensions.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { type AvogadroBasis, avogadroBasis } from "./basis.ts";
import { refuseAvogadro, validateAvogadroParameters } from "./definition.ts";

export type PinnedMolecularObservations = Readonly<{
  inputs: MolecularDimensionsInputs;
  basis: AvogadroBasis;
  source: Readonly<{
    instanceId: string;
    runId: string;
    snapshotVersion: number;
    sourceDigest: string;
  }>;
}>;

/** Copy accepted observations, not the already inferred radius/number and never the form's draft. */
export function pinMolecularObservations(snapshot: AcceptedSnapshot, sourceDigest: string) {
  if (snapshot.experimentId !== "avogadro-lab" || !snapshot.final)
    return refuseAvogadro("Pin a complete accepted molecular-number laboratory result.");
  const checked = validateAvogadroParameters(snapshot.parameters);
  if (checked.kind !== "accepted") return checked;
  const p = checked.parameters;
  const basis = avogadroBasis(p);
  const observations: PinnedMolecularObservations = Object.freeze({
    inputs: Object.freeze({
      temperature: p.temperature,
      viscosity: p.viscosityMpaS * 1e-3,
      diffusion: p.soluteDiffusionUm2S * 1e-12,
      molarConcentration: p.molarConcentration,
      specificViscosity: p.specificViscosity,
      gasConstant: constantValue(getConstantSet(basis.setId), "molarGasConstant").value,
      viscosityCoefficient: p.coefficient === 1 ? 1 : 2.5,
    }),
    basis,
    source: Object.freeze({
      instanceId: snapshot.instanceId,
      runId: snapshot.runId,
      snapshotVersion: snapshot.snapshotVersion,
      sourceDigest,
    }),
  });
  return Object.freeze({ kind: "accepted" as const, observations });
}
