/**
 * Known circularity patterns (am-cm-checks-epistemic-o7n).
 * Matched on typed fields and semantic trees, never on message regex.
 */

export const MODERN_SI_2019 = "modern-si-2019";
export const AVOGADRO_CONSTANT = "avogadroConstant";
export const AVOGADRO_NUMBER_ESTIMATE = "avogadroNumberEstimate";
export const BOLTZMANN_CONSTANT = "boltzmannConstant";
export const MIXED_DIFFUSION_SCENARIO = "diffusion-einstein-1905-modern-kb";

export type ConstantEntry = Readonly<{
  quantityId: string;
  dependsOn?: readonly string[] | undefined;
  setId?: string | undefined;
}>;

export type ConstantSetLike = Readonly<{
  id: string;
  entries: readonly ConstantEntry[];
}>;

export type EnergyExpr =
  | Readonly<{ kind: "quantity"; id: string }>
  | Readonly<{ kind: "constant"; id: string }>
  | Readonly<{ kind: "product"; factors: readonly EnergyExpr[] }>
  | Readonly<{ kind: "power"; base: EnergyExpr; exponent: number }>
  | Readonly<{ kind: "symbolic"; symbols: readonly string[] }>;

const MASS_IDS = new Set(["restMass", "mass", "M"]);
const C_IDS = new Set(["speedOfLight", "c"]);
const GAMMA_IDS = new Set(["lorentzFactor", "gamma"]);

function flattenProduct(expr: EnergyExpr): EnergyExpr[] {
  if (expr.kind === "product") return expr.factors.flatMap(flattenProduct);
  return [expr];
}

function isCSquared(expr: EnergyExpr): boolean {
  return (
    expr.kind === "power" &&
    expr.exponent === 2 &&
    ((expr.base.kind === "quantity" && C_IDS.has(expr.base.id)) ||
      (expr.base.kind === "constant" && C_IDS.has(expr.base.id)))
  );
}

function isMass(expr: EnergyExpr): boolean {
  return expr.kind === "quantity" && MASS_IDS.has(expr.id);
}

function isGamma(expr: EnergyExpr): boolean {
  return expr.kind === "quantity" && GAMMA_IDS.has(expr.id);
}

export function isMc2Tree(expr: EnergyExpr): boolean {
  if (expr.kind === "symbolic") return false;
  const parts = flattenProduct(expr);
  return parts.some(isMass) && parts.some(isCSquared) && !parts.some(isGamma);
}

export function isGammaMc2Tree(expr: EnergyExpr): boolean {
  if (expr.kind === "symbolic") return false;
  const parts = flattenProduct(expr);
  return parts.some(isMass) && parts.some(isCSquared) && parts.some(isGamma);
}

export function followsDependsOnTo(
  set: ConstantSetLike,
  startQuantityId: string,
  target: string,
): boolean {
  const byId = new Map(set.entries.map((e) => [e.quantityId, e]));
  const seen = new Set<string>();
  const stack = [startQuantityId];
  while (stack.length) {
    const id = stack.pop();
    if (id === undefined) break;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = byId.get(id);
    if (!entry) continue;
    for (const dep of entry.dependsOn ?? []) stack.push(dep);
  }
  return false;
}

export type InferenceRecord = Readonly<{
  id: string;
  kind?: string | undefined;
  historicalMode?: boolean | undefined;
  purpose?: string | undefined;
  constantSetId?: string | undefined;
  outputQuantityId?: string | undefined;
}>;

export function circularMolecularCount(input: {
  inference: InferenceRecord;
  constantSets: readonly ConstantSetLike[];
}): "modern-constant" | "wrong-output-binding" | null {
  if (input.inference.id === MIXED_DIFFUSION_SCENARIO) return null;
  if (input.inference.historicalMode !== true) return null;
  const purpose = input.inference.purpose ?? input.inference.kind ?? "";
  const isMolecular =
    purpose === "molecular-number-estimation" ||
    purpose === "inference" ||
    input.inference.kind === "inference";
  if (!isMolecular) return null;

  if (input.inference.outputQuantityId === AVOGADRO_CONSTANT) {
    return "wrong-output-binding";
  }

  const set = input.constantSets.find((s) => s.id === input.inference.constantSetId);
  if (!set) return null;
  if (set.id === MODERN_SI_2019) return "modern-constant";
  for (const entry of set.entries) {
    if (
      followsDependsOnTo(set, entry.quantityId, AVOGADRO_CONSTANT) ||
      followsDependsOnTo(set, entry.quantityId, BOLTZMANN_CONSTANT)
    ) {
      return "modern-constant";
    }
  }
  return null;
}

export type RestEnergyInit = Readonly<{
  id: string;
  historicalMode?: boolean | undefined;
  quantityId?: string | undefined;
  expr?: EnergyExpr | undefined;
  numericFrom?: "mc2" | "gamma-mc2" | undefined;
}>;

export function circularRestEnergy(init: RestEnergyInit): boolean {
  if (init.historicalMode !== true) return false;
  if (init.quantityId && init.quantityId !== "bodyEnergyRestBefore") return false;
  if (init.numericFrom === "mc2" || init.numericFrom === "gamma-mc2") return true;
  if (!init.expr) return false;
  if (init.expr.kind === "symbolic") return false;
  return isMc2Tree(init.expr) || isGammaMc2Tree(init.expr);
}
