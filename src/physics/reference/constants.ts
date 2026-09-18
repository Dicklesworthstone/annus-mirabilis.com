/**
 * am-ref-constants-xik. Modern SI 2019 and CODATA 2022 sets, the mixing guard, cross-set
 * comparison, scenario derivation, the 1904-mode guard, unit conversions, and the printed-
 * historical entry model are implemented here.
 *
 * The four printed-historical papers (light quanta, Brownian, mass-energy, Planck) are NOT
 * registered in this commit. am-src-facsimile-light-quanta-t4n, am-src-facsimile-brownian-mox,
 * and am-src-facsimile-mass-energy-cat -- this bead's own declared blockers -- have not landed a
 * pinned facsimile for any of these papers anywhere in this repository (only a test fixture,
 * src/testing/fixtures/provenance/facsimile-sources/ap-99-001.yaml, exists). Registering them
 * with "transcribed-and-checked" entries would claim a facsimile check that was never performed;
 * that is exactly the fabrication BoldHarbor's 2026-09-16 incident notices forbid. Separately,
 * src/testing/diffusion.einsteinPrinted.test.ts (am-ref-diffusion-lr3, already committed) asserts
 * `getConstantSet("einstein-1905-brownian-printed")` throws and routes its own arithmetic through
 * a declared scenario instead -- registering that id here without coordinating that test would
 * silently break already-landed, passing work from another lane. The printed-historical entry
 * model, its validation rules, and `checkPrintedConsistency`'s structural checks are implemented
 * and tested against fixture sets so that landing real facsimile-checked content later is additive,
 * not a redesign.
 */

// ---- Types ------------------------------------------------------------------------------------

export type ConstantEntryKind =
  | "exact-defined"
  | "measured"
  | "printed-historical"
  | "declared-scenario";

export type EvidentialRole =
  | "defined-exact"
  | "declared-input"
  | "measured-observation"
  | "fitted-constant"
  | "theoretical-estimate"
  | "illustrative-computation"
  | "correction";

export type PrintedStatus = "printed" | "editorial-input" | "printed-corrected";

export type TranscriptionStatus = "transcribed-and-checked" | "pending-transcription";

export type PrintedRegion = Readonly<{ x: number; y: number; width: number; height: number }>;

export type ConstantSetId = string;

export type ConstantEntry = Readonly<{
  quantityId: string;
  value: number;
  exactDecimal: string;
  unit: string;
  kind: ConstantEntryKind;
  evidentialRole: EvidentialRole;
  provenance: string;
  dependsOn: readonly string[];
  uncertainty?: number | undefined;
  printedStatus?: PrintedStatus | undefined;
  printedReading?: string | undefined;
  printedUnit?: string | undefined;
  reason?: string | undefined;
  sensitivity?: string | undefined;
  correctedValue?: number | undefined;
  correctionReason?: string | undefined;
  receiptRef?: string | undefined;
  journalPage?: string | undefined;
  facsimilePdfPage?: number | undefined;
  transcriptionStatus?: TranscriptionStatus | undefined;
  checkedBy?: string | undefined;
  checkedAt?: string | undefined;
  printedRegion?: PrintedRegion | undefined;
}>;

export type ConstantSet = Readonly<{
  id: string;
  kind: ConstantEntryKind;
  era: number | string;
  provenance: string;
  precisionNote: string;
  gasConstantProvenance: "defined" | "measured-without-counting-molecules" | "not-applicable";
  entries: readonly ConstantEntry[];
}>;

export type ConstantValue = Readonly<{ setId: string; quantityId: string; value: number }>;

export type SetComparison = Readonly<{
  leftSetId: string;
  rightSetId: string;
  quantityId: string;
  ratio: number;
  relativeDifference: number;
  reason: string;
}>;

export type OverrideProvenanceRecord = Readonly<{
  quantityId: string;
  originalSetId: string | null;
  provenance: string;
}>;

export type DerivedScenarioSet = ConstantSet &
  Readonly<{
    baseSetId: string | null;
    derivationReason: string;
    overrideProvenance: readonly OverrideProvenanceRecord[];
  }>;

export type ScenarioOverride = Readonly<{
  quantityId: string;
  value: number;
  exactDecimal: string;
  unit: string;
  provenance: string;
  evidentialRole: EvidentialRole;
  dependsOn?: readonly string[] | undefined;
  uncertainty?: number | undefined;
}>;

export type ConsistencyIssue = Readonly<{ quantityId: string; code: string; message: string }>;
export type ConsistencyReport = Readonly<{
  setId: string;
  /** false for a reserved or not-yet-registered set: it is reported not-available, never passed. */
  available: boolean;
  ok: boolean;
  issues: readonly ConsistencyIssue[];
}>;

export class ConstantSetError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ConstantSetError";
    this.code = code;
  }
}

function reject(code: string, message: string): never {
  throw new ConstantSetError(code, message);
}

// ---- Validation and freezing -------------------------------------------------------------------

function validPrintedRegion(r: PrintedRegion): boolean {
  const inBounds = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  return (
    inBounds(r.x) &&
    inBounds(r.y) &&
    inBounds(r.width) &&
    inBounds(r.height) &&
    r.x + r.width <= 100 &&
    r.y + r.height <= 100
  );
}

const DERIVED_ROLES: readonly EvidentialRole[] = [
  "theoretical-estimate",
  "illustrative-computation",
  "correction",
];

/** Validates and deep-freezes a constant set. Exported so tests (and, once it lands, the YAML
 * content loader) validate fixture and future-loaded sets through the same rules real sets use. */
export function freezeConstantSet(set: ConstantSet): ConstantSet {
  const seen = new Set<string>();
  const eraValid =
    typeof set.era === "number" ? Number.isSafeInteger(set.era) : set.era.trim().length > 0;
  if (!set.provenance.trim() || !set.precisionNote.trim() || !eraValid)
    reject("invalid-constant-set", "A set needs its era, provenance, and precision note.");

  const entries = set.entries.map((entry) => {
    if (!entry.quantityId.trim() || seen.has(entry.quantityId))
      reject("duplicate-constant", `Duplicate or empty quantity in ${set.id}.`);
    seen.add(entry.quantityId);

    if (
      !Number.isFinite(entry.value) ||
      Number(entry.exactDecimal) !== entry.value ||
      !entry.exactDecimal.trim() ||
      !entry.unit.trim() ||
      !entry.provenance.trim()
    )
      reject("invalid-constant", `Invalid value or provenance for ${entry.quantityId}.`);

    if (entry.kind === "exact-defined") {
      if (entry.evidentialRole !== "defined-exact")
        reject("invalid-evidential-role", `Exact definition required for ${entry.quantityId}.`);
      if (entry.uncertainty !== undefined)
        reject(
          "exact-defined-has-uncertainty",
          `${entry.quantityId} is exact-defined and cannot carry uncertainty.`,
        );
    }
    if (entry.kind !== "exact-defined" && entry.evidentialRole === "defined-exact")
      reject(
        "invalid-evidential-role",
        `Declared inputs are not SI definitions: ${entry.quantityId}.`,
      );

    if (entry.evidentialRole === "declared-input" && entry.kind !== "declared-scenario")
      reject(
        "invalid-evidential-role",
        "A chosen scenario input cannot stand in for a measurement or historical transcription.",
      );

    if (entry.kind === "measured") {
      if (
        entry.evidentialRole !== "measured-observation" &&
        entry.evidentialRole !== "fitted-constant"
      )
        reject(
          "invalid-evidential-role",
          `Measured entry ${entry.quantityId} must be measured-observation or fitted-constant.`,
        );
    }
    // A declared-scenario entry reporting a measured-observation still describes a measurement --
    // "R measured without counting molecules" needs its uncertainty whether or not its `kind` is
    // literally "measured" (scenario-gas-constant-measured's entries are `declared-scenario` kind
    // at the set's own classification, per this bead's set-id table).
    const requiresUncertainty =
      entry.kind === "measured" ||
      (entry.kind === "declared-scenario" && entry.evidentialRole === "measured-observation");
    if (requiresUncertainty && entry.uncertainty === undefined)
      reject(
        "measured-missing-uncertainty",
        `Measured entry ${entry.quantityId} requires uncertainty.`,
      );

    if (DERIVED_ROLES.includes(entry.evidentialRole) && entry.dependsOn.length === 0)
      reject("missing-dependency", `Computed entry ${entry.quantityId} must name its inputs.`);

    if (entry.kind === "printed-historical") {
      if (!entry.printedStatus)
        reject(
          "missing-printed-status",
          `Printed-historical entry ${entry.quantityId} requires printedStatus.`,
        );
      if (entry.printedStatus === "printed" && !entry.printedReading)
        reject(
          "printed-missing-reading",
          `${entry.quantityId} is printed but has no printedReading.`,
        );
      if (entry.printedStatus === "editorial-input" && (!entry.reason || !entry.sensitivity))
        reject(
          "editorial-input-missing-fields",
          `${entry.quantityId} is an editorial input and needs reason and sensitivity.`,
        );
      if (
        entry.printedStatus === "printed-corrected" &&
        (!entry.printedReading ||
          entry.correctedValue === undefined ||
          !entry.correctionReason ||
          !entry.receiptRef)
      )
        reject(
          "printed-corrected-missing-fields",
          `${entry.quantityId} is printed-corrected and needs printedReading, correctedValue, correctionReason, and receiptRef.`,
        );
      if (!entry.transcriptionStatus)
        reject("missing-transcription-status", `${entry.quantityId} requires transcriptionStatus.`);
      if (
        entry.transcriptionStatus === "transcribed-and-checked" &&
        (!entry.checkedBy || !entry.checkedAt)
      )
        reject(
          "transcribed-missing-check-metadata",
          `${entry.quantityId} claims transcribed-and-checked without checkedBy and checkedAt.`,
        );
    }

    if (entry.printedRegion && !validPrintedRegion(entry.printedRegion))
      reject("invalid-printed-region", `${entry.quantityId} has an out-of-bounds printedRegion.`);

    return Object.freeze({ ...entry, dependsOn: Object.freeze([...entry.dependsOn]) });
  });
  return Object.freeze({ ...set, entries: Object.freeze(entries) });
}

// ---- Modern SI 2019 -----------------------------------------------------------------------------

const siSource = "BIPM, SI Brochure, 9th edition (2019), defining constants; exact SI decimals.";

const exact = (
  quantityId: string,
  exactDecimal: string,
  unit: string,
  dependsOn: readonly string[] = [],
): ConstantEntry => ({
  quantityId,
  exactDecimal,
  value: Number(exactDecimal),
  unit,
  kind: "exact-defined",
  evidentialRole: "defined-exact",
  provenance: siSource,
  dependsOn,
});

const AVOGADRO_EXACT = 6.02214076e23;
const ELEMENTARY_CHARGE_EXACT = 1.602176634e-19;
const FARADAY_EXACT_VALUE = AVOGADRO_EXACT * ELEMENTARY_CHARGE_EXACT;

const modern = freezeConstantSet({
  id: "modern-si-2019",
  kind: "exact-defined",
  era: 2019,
  provenance: siSource,
  precisionNote: "The definitions are exact; evaluation uses binary64 rounding.",
  gasConstantProvenance: "defined",
  entries: [
    exact("planckConstant", "6.62607015e-34", "J s"),
    exact("elementaryCharge", "1.602176634e-19", "C"),
    exact("boltzmannConstant", "1.380649e-23", "J/K"),
    exact("avogadroConstant", "6.02214076e23", "1/mol"),
    exact("speedOfLight", "299792458", "m/s"),
    exact("molarGasConstant", "8.31446261815324", "J/(mol K)", [
      "avogadroConstant",
      "boltzmannConstant",
    ]),
    exact("planckChargeQuotient", "4.135667696923859e-15", "V s", [
      "planckConstant",
      "elementaryCharge",
    ]),
    exact("faradayConstant", String(FARADAY_EXACT_VALUE), "C/mol", [
      "avogadroConstant",
      "elementaryCharge",
    ]),
  ],
});

// ---- Modern CODATA 2022 --------------------------------------------------------------------------
// Every digit below was fetched live from physics.nist.gov/cgi-bin/cuu/Value (electron mass,
// mu0, epsilon0) and cross-checked against NIST/ADS publication records (Moldover 1988) on
// 2026-09-16 by this lane. Not from training-data memory.

const codataSource = "CODATA 2022 recommended values (physics.nist.gov); verified live 2026-09-16.";

const measuredEntry = (
  quantityId: string,
  exactDecimal: string,
  unit: string,
  uncertainty: number,
  role: "measured-observation" | "fitted-constant" = "measured-observation",
): ConstantEntry => ({
  quantityId,
  exactDecimal,
  value: Number(exactDecimal),
  unit,
  kind: "measured",
  evidentialRole: role,
  provenance: codataSource,
  dependsOn: [],
  uncertainty,
});

const codata2022 = freezeConstantSet({
  id: "modern-codata-2022",
  kind: "measured",
  era: 2022,
  provenance: codataSource,
  precisionNote: "CODATA 2022 recommended values; each entry carries its own standard uncertainty.",
  gasConstantProvenance: "not-applicable",
  entries: [
    measuredEntry("electronMass", "9.1093837139e-31", "kg", 0.0000000028e-31),
    measuredEntry("vacuumPermeability", "1.25663706127e-6", "N/A^2", 0.0000000002e-6),
    measuredEntry("vacuumPermittivity", "8.8541878188e-12", "F/m", 0.0000000014e-12),
  ],
});

// ---- Declared scenario: a gas constant measured without counting molecules ----------------------

const scenarioGasConstant = createDeclaredConstantSet({
  id: "scenario-gas-constant-measured",
  era: 1988,
  provenance:
    'M. R. Moldover, J. P. M. Trusler, T. J. Edwards, J. B. Mehl, R. S. Davis, "Measurement of the universal gas constant R using a spherical acoustic resonator," Phys. Rev. Lett. 60 (1988) 249; J. Res. Natl. Bur. Stand. 93 (1988) 85-144. Verified live against NIST and ADS abstract records 2026-09-16.',
  precisionNote:
    "R = 8.314471 J mol^-1 K^-1 with standard uncertainty 0.000014 J mol^-1 K^-1 (1.7 ppm).",
  gasConstantProvenance: "measured-without-counting-molecules",
  entries: [
    {
      quantityId: "molarGasConstant",
      value: 8.314471,
      exactDecimal: "8.314471",
      unit: "J/(mol K)",
      kind: "declared-scenario",
      evidentialRole: "measured-observation",
      provenance:
        "Moldover et al. 1988: from the speed of sound in argon at the triple point of water, a spherical resonator volume found by weighing its mercury fill, and argon's molar mass. No molecule count, N_A, or k_B enters it.",
      dependsOn: [],
      uncertainty: 0.000014,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "MaroonCanyon (Claude Code agent lane), via live NIST/ADS web verification, not a facsimile",
      checkedAt: "2026-09-16",
    },
  ],
});

// ---- Registry -------------------------------------------------------------------------------------

export const RESERVED_SET_IDS = Object.freeze({
  "einstein-1905-thesis-printed": "am-ref-viscosity-suspension-c9lp",
  "einstein-1906-dissertation-printed": "am-ref-viscosity-suspension-c9lp",
  "einstein-1911-correction-printed": "am-ref-viscosity-suspension-c9lp",
});

/** Printed-historical sets whose facsimile beads have not landed; see the module docblock. */
const PENDING_FACSIMILE_SET_IDS = Object.freeze({
  "einstein-1905-light-quanta-printed": "am-ref-constants-xik",
  "einstein-1905-brownian-printed": "am-ref-constants-xik",
  "einstein-1905-mass-energy-printed": "am-ref-constants-xik",
  "planck-1900-1901-printed": "am-ref-constants-xik",
});

const unavailable = Object.freeze({ ...RESERVED_SET_IDS, ...PENDING_FACSIMILE_SET_IDS });

const MODE_1904_FORBIDDEN_SET_IDS: ReadonlySet<string> = new Set([
  "modern-si-2019",
  "modern-codata-2022",
  "einstein-1905-light-quanta-printed",
  "einstein-1905-mass-energy-printed",
]);

let mode1904GuardDepth = 0;
let historicalGuardDepth = 0;

export function getConstantSet(id: string): ConstantSet {
  if (mode1904GuardDepth > 0 && MODE_1904_FORBIDDEN_SET_IDS.has(id))
    reject("modern-constant-in-1904-mode", `${id} is not available inside a 1904 mode.`);
  if (id === modern.id) return modern;
  if (id === codata2022.id) return codata2022;
  if (id === scenarioGasConstant.id) return scenarioGasConstant;
  if (Object.hasOwn(unavailable, id))
    reject(
      "constant-set-not-registered",
      `${id} is not verified and registered; owner ${unavailable[id as keyof typeof unavailable]}.`,
    );
  return reject("unknown-constant-set", `Unknown constant set: ${id}.`);
}

/** Explicit scenarios never impersonate printed or measured constant sets. No global registration. */
export function createDeclaredConstantSet(input: Omit<ConstantSet, "kind">): ConstantSet {
  if (!/^scenario-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id))
    reject("invalid-scenario-id", "Declared inputs need a scenario- id.");
  if (input.entries.some((e) => e.kind !== "declared-scenario"))
    reject(
      "ambiguous-constant-provenance",
      "Standalone scenarios cannot contain exact-defined entries.",
    );
  if (input.gasConstantProvenance === "defined")
    reject("ambiguous-constant-provenance", "Standalone scenarios are not SI definitions.");
  if (!input.entries.length) reject("empty-constant-set", "Declare at least one input.");
  return freezeConstantSet({ ...input, kind: "declared-scenario" });
}

export function constantValue(set: ConstantSet, quantityId: string): ConstantValue {
  if (mode1904GuardDepth > 0 && quantityId === "speedOfLight")
    reject(
      "no-pre-1905-light-speed-set",
      "No constant set holding a light speed available by 1904 is registered.",
    );
  if (
    historicalGuardDepth > 0 &&
    set.id === "modern-si-2019" &&
    (quantityId === "boltzmannConstant" || quantityId === "avogadroConstant")
  )
    reject(
      "modern-constant-in-historical-path",
      `Historical inference paths may not read modern exact ${quantityId} from ${set.id}.`,
    );
  const entry = set.entries.find((e) => e.quantityId === quantityId);
  if (!entry) reject("missing-constant", `${set.id} has no ${quantityId}.`);
  if (entry.evidentialRole === "illustrative-computation")
    reject(
      "illustrative-value-as-input",
      `${quantityId} is a computed illustration, not an input; use ${entry.dependsOn.join(", ")}.`,
    );
  return Object.freeze({ setId: set.id, quantityId, value: entry.value });
}

export function assertSameSet(...values: readonly ConstantValue[]): void {
  if (values.length === 0) reject("missing-constant", "Provide at least one constant.");
  for (const value of values) {
    if (!Number.isFinite(value.value) || !value.setId || !value.quantityId)
      reject("invalid-constant", "Expected a tagged finite constant.");
    if (value.setId !== values[0]?.setId)
      reject("constant-set-mismatch", `Cannot combine ${values[0]?.setId} and ${value.setId}.`);
  }
}

/** Historical-form calculation explicitly consumes R and N, never an ambient modern k_B. */
export function thermalConstant(set: ConstantSet): ConstantValue {
  if (set.gasConstantProvenance === "defined") return constantValue(set, "boltzmannConstant");
  const R = constantValue(set, "molarGasConstant");
  const N = constantValue(set, "avogadroConstant");
  assertSameSet(R, N);
  if (
    R.value <= 0 ||
    N.value <= 0 ||
    !Number.isFinite(R.value / N.value) ||
    R.value / N.value === 0
  )
    reject("invalid-thermal-constant", "R and N must give a positive representable ratio.");
  return Object.freeze({
    setId: set.id,
    quantityId: "boltzmannConstant",
    value: R.value / N.value,
  });
}

// ---- Guards -----------------------------------------------------------------------------------

/** Inside `fn`, any read of modern-si-2019's exact k_B or N_A throws `modern-constant-in-historical-path`. */
export function withHistoricalGuard<T>(fn: () => T): T {
  historicalGuardDepth++;
  try {
    return fn();
  } finally {
    historicalGuardDepth--;
  }
}

/** Inside `fn`, the modern sets and the 1905 printed sets are refused, and any numeric light-speed
 * request throws `no-pre-1905-light-speed-set` -- no constant set holding a pre-1905 light speed is
 * registered (see the bead's "No pre-1905 light-speed constant set" requirement). */
export function withMode1904Guard<T>(fn: () => T): T {
  mode1904GuardDepth++;
  try {
    return fn();
  } finally {
    mode1904GuardDepth--;
  }
}

export function isMode1904(): boolean {
  return mode1904GuardDepth > 0;
}

// ---- Cross-set comparison and scenario derivation ------------------------------------------------

export function compareAcrossSets(input: {
  left: ConstantValue;
  right: ConstantValue;
  reason: string;
}): SetComparison {
  const { left, right, reason } = input;
  if (!reason.trim()) reject("missing-comparison-reason", "compareAcrossSets requires a reason.");
  if (left.quantityId !== right.quantityId)
    reject(
      "comparison-quantity-mismatch",
      `Cannot compare ${left.quantityId} (in ${left.setId}) with ${right.quantityId} (in ${right.setId}).`,
    );
  if (!Number.isFinite(left.value) || !Number.isFinite(right.value) || right.value === 0)
    reject("invalid-constant", "Both compared values must be finite and the right value nonzero.");
  return Object.freeze({
    leftSetId: left.setId,
    rightSetId: right.setId,
    quantityId: left.quantityId,
    ratio: left.value / right.value,
    relativeDifference: (left.value - right.value) / right.value,
    reason,
  });
}

export function deriveScenarioSet(input: {
  id: string;
  base: string | null;
  overrides: readonly ScenarioOverride[];
  reason: string;
}): DerivedScenarioSet {
  if (!/^scenario-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id))
    reject("invalid-scenario-id", "Declared inputs need a scenario- id.");
  if (!input.reason.trim())
    reject("missing-derivation-reason", "deriveScenarioSet requires a reason.");

  const baseSet = input.base ? getConstantSet(input.base) : undefined;
  const baseEntries = baseSet ? baseSet.entries : [];
  const overrideIds = new Set(input.overrides.map((o) => o.quantityId));
  const carried = baseEntries.filter((e) => !overrideIds.has(e.quantityId));
  const overrideEntries: ConstantEntry[] = input.overrides.map((o) => ({
    quantityId: o.quantityId,
    value: Number(o.exactDecimal),
    exactDecimal: o.exactDecimal,
    unit: o.unit,
    kind: "declared-scenario",
    evidentialRole: o.evidentialRole,
    provenance: o.provenance,
    dependsOn: o.dependsOn ?? [],
    ...(o.uncertainty !== undefined ? { uncertainty: o.uncertainty } : {}),
  }));
  const entries = [...carried, ...overrideEntries];

  const hasExactNAorKB = entries.some(
    (e) =>
      e.kind === "exact-defined" &&
      (e.quantityId === "avogadroConstant" || e.quantityId === "boltzmannConstant"),
  );
  if (!baseSet && hasExactNAorKB)
    reject(
      "ambiguous-constant-provenance",
      "Standalone scenarios cannot contain exact-defined N_A or k_B.",
    );

  const set = freezeConstantSet({
    id: input.id,
    kind: "declared-scenario",
    era: baseSet?.era ?? new Date().getFullYear(),
    provenance: `Derived from ${input.base ?? "no base"}: ${input.reason}`,
    precisionNote: baseSet?.precisionNote ?? "Declared scenario; see per-entry precision.",
    gasConstantProvenance: baseSet
      ? baseSet.gasConstantProvenance
      : "measured-without-counting-molecules",
    entries,
  });

  const overrideProvenance: OverrideProvenanceRecord[] = input.overrides.map((o) => ({
    quantityId: o.quantityId,
    originalSetId: baseSet?.entries.some((e) => e.quantityId === o.quantityId) ? baseSet.id : null,
    provenance: o.provenance,
  }));

  return Object.freeze({
    ...set,
    baseSetId: input.base,
    derivationReason: input.reason,
    overrideProvenance: Object.freeze(overrideProvenance),
  });
}

// ---- Unit conversions ---------------------------------------------------------------------------

type UnitConversion = Readonly<{ si: string; factor: number }>;

const SPEED_OF_LIGHT_M_PER_S = 299792458;

const UNIT_TABLE: Readonly<Record<string, UnitConversion>> = Object.freeze({
  erg: { si: "J", factor: 1e-7 },
  J: { si: "J", factor: 1 },
  dyne: { si: "N", factor: 1e-5 },
  N: { si: "N", factor: 1 },
  poise: { si: "Pa s", factor: 0.1 },
  "Pa s": { si: "Pa s", factor: 1 },
  cm: { si: "m", factor: 1e-2 },
  m: { si: "m", factor: 1 },
  "cm2 s-2": { si: "m2 s-2", factor: 1e-4 },
  "m2 s-2": { si: "m2 s-2", factor: 1 },
  statvolt: { si: "V", factor: SPEED_OF_LIGHT_M_PER_S / 1e6 },
  V: { si: "V", factor: 1 },
  statcoulomb: { si: "C", factor: 1 / (10 * SPEED_OF_LIGHT_M_PER_S) },
  C: { si: "C", factor: 1 },
  abvolt: { si: "V", factor: 1e-8 },
  abcoulomb: { si: "C", factor: 10 },
  gauss: { si: "T", factor: 1e-4 },
  T: { si: "T", factor: 1 },
});

/** Converts `value` from `fromUnit` to `toUnit` through the table above. Historical calculations
 * that used 300 V per statvolt or 3e10 cm/s record that factor in their own fixture, never here. */
export function convert(value: number, fromUnit: string, toUnit: string): number {
  const from = UNIT_TABLE[fromUnit];
  const to = UNIT_TABLE[toUnit];
  if (!from) reject("unknown-unit", `Unknown unit "${fromUnit}".`);
  if (!to) reject("unknown-unit", `Unknown unit "${toUnit}".`);
  if (from.si !== to.si)
    reject(
      "incommensurable-units",
      `Cannot convert "${fromUnit}" to "${toUnit}": different physical dimensions.`,
    );
  return (value * from.factor) / to.factor;
}

// ---- Printed-consistency (structural) and display helpers -----------------------------------------

/**
 * Structural consistency for a set's printed-historical bookkeeping: every `dependsOn` name
 * resolves to a real sibling entry, every printed-historical entry carries the fields its
 * `printedStatus` and `transcriptionStatus` require. This does NOT recompute the physics of any
 * particular paper's check (the printed N from alpha/beta/R/L, the section 8 voltage, section 9
 * energies, or paper 4's conversion) -- those formulas are owned by the capability beads listed in
 * this bead's own "Out of scope" section (am-ref-photoelectric-q6r, am-ref-radiation-15c,
 * am-ref-mass-energy-ht0), which call `getConstantSet`/`constantValue` for their inputs.
 */
export function checkPrintedConsistency(setOrId: string | ConstantSet): ConsistencyReport {
  let set: ConstantSet;
  if (typeof setOrId === "string") {
    try {
      set = getConstantSet(setOrId);
    } catch (error) {
      if (error instanceof ConstantSetError && error.code === "constant-set-not-registered") {
        return Object.freeze({
          setId: setOrId,
          available: false,
          ok: false,
          issues: Object.freeze([
            { quantityId: "(set)", code: "not-available", message: error.message },
          ]),
        });
      }
      throw error;
    }
  } else {
    set = setOrId;
  }
  const byId = new Map(set.entries.map((e) => [e.quantityId, e]));
  const issues: ConsistencyIssue[] = [];

  for (const entry of set.entries) {
    for (const dep of entry.dependsOn) {
      if (!byId.has(dep)) {
        issues.push({
          quantityId: entry.quantityId,
          code: "dangling-dependency",
          message: `${entry.quantityId} depends on "${dep}", which is not an entry of ${set.id}.`,
        });
      }
    }
    if (entry.kind === "printed-historical") {
      if (entry.printedStatus === "printed-corrected" && !entry.receiptRef) {
        issues.push({
          quantityId: entry.quantityId,
          code: "missing-receipt-ref",
          message: `${entry.quantityId} is printed-corrected without a receiptRef.`,
        });
      }
      if (
        entry.transcriptionStatus === "transcribed-and-checked" &&
        (!entry.checkedBy || !entry.checkedAt)
      ) {
        issues.push({
          quantityId: entry.quantityId,
          code: "missing-check-metadata",
          message: `${entry.quantityId} claims transcribed-and-checked without checkedBy/checkedAt.`,
        });
      }
    }
  }
  return Object.freeze({
    setId: set.id,
    available: true,
    ok: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

export function printedReadingOf(entry: ConstantEntry): string {
  if (entry.printedStatus === "printed" || entry.printedStatus === "printed-corrected")
    return entry.printedReading ?? "";
  if (entry.printedStatus === "editorial-input") return "(not printed; editorial input)";
  return "(not a printed-historical entry)";
}

const EVIDENTIAL_ROLE_TEXT: Readonly<Record<EvidentialRole, string>> = Object.freeze({
  "defined-exact": "a defining constant of the unit system, exact by definition",
  "declared-input": "a chosen input for a scenario, not a measured or transcribed constant",
  "measured-observation": "a quantity someone measured",
  "fitted-constant": "a constant fitted to measurements",
  "theoretical-estimate": "a value computed from a theory and other constants",
  "illustrative-computation":
    "a number computed from the result to show its size, not evidence for it",
  correction: "a value introduced by a later correction to an earlier printing",
});

/** One authored phrase per evidential role. Every consumer imports this rather than composing its
 * own phrase (this bead's Display requirement); each phrase passes the voice lint at "prose". */
export function evidentialRoleText(entry: ConstantEntry): string {
  return EVIDENTIAL_ROLE_TEXT[entry.evidentialRole];
}
