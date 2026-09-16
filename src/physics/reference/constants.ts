/** Computational subset of am-ref-constants-xik. Historical transcription is NOT implemented here. */
export type ConstantValue = Readonly<{ setId: string; quantityId: string; value: number }>;
export type ConstantEntry = Readonly<{
  quantityId: string;
  value: number;
  exactDecimal: string;
  unit: string;
  kind: "exact-defined" | "declared-scenario";
  evidentialRole: "defined-exact" | "measured-observation" | "theoretical-estimate" | "illustrative-computation";
  provenance: string;
  dependsOn: readonly string[];
}>;
export type ConstantSet = Readonly<{
  id: string;
  kind: "exact-defined" | "declared-scenario";
  era: number;
  provenance: string;
  precisionNote: string;
  gasConstantProvenance: "defined" | "measured-without-counting-molecules" | "not-applicable";
  entries: readonly ConstantEntry[];
}>;
export class ConstantSetError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = "ConstantSetError"; this.code = code; }
}
function reject(code: string, message: string): never { throw new ConstantSetError(code, message); }
function freezeSet(set: ConstantSet): ConstantSet {
  const seen = new Set<string>();
  if (!set.provenance.trim() || !set.precisionNote.trim() || !Number.isSafeInteger(set.era)) reject("invalid-constant-set", "A set needs its era, provenance, and precision note.");
  const entries = set.entries.map(entry => {
    if (!entry.quantityId.trim() || seen.has(entry.quantityId)) reject("duplicate-constant", `Duplicate or empty quantity in ${set.id}.`);
    seen.add(entry.quantityId);
    if (!Number.isFinite(entry.value) || Number(entry.exactDecimal) !== entry.value || !entry.exactDecimal.trim() || !entry.unit.trim() || !entry.provenance.trim()) reject("invalid-constant", `Invalid value or provenance for ${entry.quantityId}.`);
    if (entry.kind === "exact-defined" && entry.evidentialRole !== "defined-exact") reject("invalid-evidential-role", `Exact definition required for ${entry.quantityId}.`);
    if (entry.kind !== "exact-defined" && entry.evidentialRole === "defined-exact") reject("invalid-evidential-role", `Declared inputs are not SI definitions: ${entry.quantityId}.`);
    if (["theoretical-estimate", "illustrative-computation"].includes(entry.evidentialRole) && !entry.dependsOn.length) reject("missing-dependency", `Computed entry ${entry.quantityId} must name its inputs.`);
    return Object.freeze({ ...entry, dependsOn: Object.freeze([...entry.dependsOn]) });
  });
  return Object.freeze({ ...set, entries: Object.freeze(entries) });
}
const siSource = "BIPM, SI Brochure, 9th edition (2019), defining constants; exact SI decimals.";
const exact = (quantityId: string, exactDecimal: string, unit: string, dependsOn: readonly string[] = []): ConstantEntry => ({
  quantityId, exactDecimal, value: Number(exactDecimal), unit, kind: "exact-defined", evidentialRole: "defined-exact", provenance: siSource, dependsOn,
});
const modern = freezeSet({
  id: "modern-si-2019", kind: "exact-defined", era: 2019, provenance: siSource,
  precisionNote: "The definitions are exact; evaluation uses binary64 rounding.", gasConstantProvenance: "defined",
  entries: [
    exact("planckConstant", "6.62607015e-34", "J s"),
    exact("elementaryCharge", "1.602176634e-19", "C"),
    exact("boltzmannConstant", "1.380649e-23", "J/K"),
    exact("avogadroConstant", "6.02214076e23", "1/mol"),
    exact("speedOfLight", "299792458", "m/s"),
    exact("molarGasConstant", "8.31446261815324", "J/(mol K)", ["avogadroConstant", "boltzmannConstant"]),
  ],
});
export const RESERVED_SET_IDS = Object.freeze({
  "einstein-1905-thesis-printed": "am-ref-viscosity-suspension-c9lp",
  "einstein-1906-dissertation-printed": "am-ref-viscosity-suspension-c9lp",
  "einstein-1911-correction-printed": "am-ref-viscosity-suspension-c9lp",
});
const unavailable = Object.freeze({
  ...RESERVED_SET_IDS,
  "einstein-1905-brownian-printed": "am-ref-constants-xik",
  "einstein-1905-light-quanta-printed": "am-ref-constants-xik",
  "einstein-1905-mass-energy-printed": "am-ref-constants-xik",
  "planck-1900-1901-printed": "am-ref-constants-xik",
  "modern-codata-2022": "am-ref-constants-xik",
});
export function getConstantSet(id: string): ConstantSet {
  if (id === modern.id) return modern;
  if (Object.hasOwn(unavailable, id)) reject("constant-set-not-registered", `${id} is not verified and registered; owner ${unavailable[id as keyof typeof unavailable]}.`);
  return reject("unknown-constant-set", `Unknown constant set: ${id}.`);
}
/** Explicit scenarios never impersonate printed or measured constant sets. No global registration. */
export function createDeclaredConstantSet(input: Omit<ConstantSet, "kind">): ConstantSet {
  if (!/^scenario-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) reject("invalid-scenario-id", "Declared inputs need a scenario- id.");
  if (input.entries.some(e => e.kind !== "declared-scenario")) reject("ambiguous-constant-provenance", "Standalone scenarios cannot contain exact-defined entries.");
  if (input.gasConstantProvenance === "defined") reject("ambiguous-constant-provenance", "Standalone scenarios are not SI definitions.");
  if (!input.entries.length) reject("empty-constant-set", "Declare at least one input.");
  return freezeSet({ ...input, kind: "declared-scenario" });
}
export function constantValue(set: ConstantSet, quantityId: string): ConstantValue {
  const entry = set.entries.find(e => e.quantityId === quantityId);
  if (!entry) reject("missing-constant", `${set.id} has no ${quantityId}.`);
  if (entry.evidentialRole === "illustrative-computation") reject("illustrative-value-as-input", `${quantityId} is a computed illustration, not an input; use ${entry.dependsOn.join(", ")}.`);
  return Object.freeze({ setId: set.id, quantityId, value: entry.value });
}
export function assertSameSet(...values: readonly ConstantValue[]): void {
  if (values.length === 0) reject("missing-constant", "Provide at least one constant.");
  for (const value of values) {
    if (!Number.isFinite(value.value) || !value.setId || !value.quantityId) reject("invalid-constant", "Expected a tagged finite constant.");
    if (value.setId !== values[0]!.setId) reject("constant-set-mismatch", `Cannot combine ${values[0]!.setId} and ${value.setId}.`);
  }
}
/** Historical-form calculation explicitly consumes R and N, never an ambient modern k_B. */
export function thermalConstant(set: ConstantSet): ConstantValue {
  if (set.gasConstantProvenance === "defined") return constantValue(set, "boltzmannConstant");
  const R = constantValue(set, "molarGasConstant");
  const N = constantValue(set, "avogadroConstant");
  assertSameSet(R, N);
  if (R.value <= 0 || N.value <= 0 || !Number.isFinite(R.value / N.value) || R.value / N.value === 0) reject("invalid-thermal-constant", "R and N must give a positive representable ratio.");
  return Object.freeze({ setId: set.id, quantityId: "boltzmannConstant", value: R.value / N.value });
}
