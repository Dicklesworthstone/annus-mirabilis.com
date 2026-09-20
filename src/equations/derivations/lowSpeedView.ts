import type { LowSpeedCertificate } from "./massEnergyLowSpeed.ts";
import type { LowSpeedOrder } from "./lowSpeedState.ts";

export type LowSpeedFormula = Readonly<{ html:string; mathml:string; spoken:string; latex:string }>;
/** Build output only: importing this type never imports the checkers into a browser. */
export type LowSpeedProofView = Readonly<{
  certificate: Omit<LowSpeedCertificate,"normalizedTree">;
  sourceDigest:string;
  equations: readonly Readonly<{id:string; title:string; spoken:string; html:string; mathml:string; plainLatex:string; treeDigest:string}>[];
  approximations: readonly Readonly<{order:LowSpeedOrder; formula:LowSpeedFormula; omittedPower:number; omittedCoefficient:string}>[];
  factorization:LowSpeedFormula;
  limit:LowSpeedFormula;
}>;
