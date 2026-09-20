/** SI adapter for the constants consumed by the §6 radiation owners.
 * Values are read through the registry's guarded readers, never from ambient SI fallbacks.
 * The printed light-paper action coefficient is derived from (R/N) beta, not a modern h.
 */
export type QuantumConstantSource = Readonly<{
  id: string;
  gasConstantProvenance: string;
  entries: readonly Readonly<{ quantityId: string; unit: string }>[];
}>;
export type TaggedQuantumConstant = Readonly<{ setId: string; value: number }>;
export type QuantumConstantReaders<S extends QuantumConstantSource> = Readonly<{
  read: (set: S, quantityId: string) => TaggedQuantumConstant;
  thermal: (set: S) => TaggedQuantumConstant;
}>;

function finitePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and representable in SI.`);
  }
  return value;
}
function unitOf(set: QuantumConstantSource, quantityId: string): string {
  const entries = set.entries.filter((entry) => entry.quantityId === quantityId);
  if (entries.length !== 1) throw new TypeError(`Expected one ${quantityId} in ${set.id}.`);
  return entries[0]?.unit ?? "";
}
function tagged(set: QuantumConstantSource, value: TaggedQuantumConstant): number {
  if (value.setId !== set.id) throw new TypeError("Cannot mix constant sets in a quantum calculation.");
  return finitePositive(value.value, "Constant");
}
function thermalFactor(set: QuantumConstantSource): number {
  const direct = set.gasConstantProvenance === "defined";
  const unit = unitOf(set, direct ? "boltzmannConstant" : "molarGasConstant");
  if (unit === (direct ? "J/K" : "J/(mol K)")) return 1;
  if (unit === (direct ? "erg/K" : "erg/(mol K)")) return 1e-7;
  throw new TypeError(`Unsupported thermal-constant unit: ${unit}.`);
}

/** Includes the unit conversion omitted by a raw R/N read of the printed CGS set. */
export function thermalConstantSI<S extends QuantumConstantSource>(
  set: S,
  readers: QuantumConstantReaders<S>,
): number {
  return finitePositive(tagged(set, readers.thermal(set)) * thermalFactor(set), "Thermal constant");
}

export function quantumConstantsSI<S extends QuantumConstantSource>(
  set: S,
  readers: QuantumConstantReaders<S>,
): Readonly<{ kB: number; h: number; constantSetId: string }> {
  const kB = thermalConstantSI(set, readers);
  let h: number;
  if (set.id === "einstein-1905-light-quanta-printed") {
    if (unitOf(set, "wienConstantBeta") !== "s K") {
      throw new TypeError("The printed Wien beta must have unit s K.");
    }
    const beta = tagged(set, readers.read(set, "wienConstantBeta"));
    h = finitePositive(kB * beta, "Printed action coefficient (R/N) beta");
  } else {
    const unit = unitOf(set, "planckConstant");
    if (unit !== "J s" && unit !== "erg s") {
      throw new TypeError(`Unsupported action-constant unit: ${unit}.`);
    }
    h = finitePositive(
      tagged(set, readers.read(set, "planckConstant")) * (unit === "erg s" ? 1e-7 : 1),
      "Action constant",
    );
  }
  return Object.freeze({ kB, h, constantSetId: set.id });
}
