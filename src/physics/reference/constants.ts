/**
 * am-ref-constants-xik. Modern SI 2019 and CODATA 2022 sets, the mixing guard, cross-set
 * comparison, scenario derivation, the 1904-mode guard, unit conversions, and the printed-
 * historical entry model are implemented here.
 *
 * The four printed-historical papers (light quanta, Brownian, mass-energy, Planck) are
 * registered and verified against their pinned facsimiles (ap-17-132, ap-17-549, ap-18-639)
 * and primary literature (Planck 1901). The three dissertation sets (1905 thesis, 1906
 * dissertation, 1911 correction) remain reserved for am-ref-viscosity-suspension-c9lp.
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

// ---- Historical constant sets (verified against pinned facsimiles) -----------------------------

const lightQuanta1905 = freezeConstantSet({
  id: "einstein-1905-light-quanta-printed",
  kind: "printed-historical",
  era: 1905,
  provenance:
    "Albert Einstein, Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt, Annalen der Physik (4) 17 (1905), 132–148. Facsimile ap-17-132.pdf.",
  precisionNote:
    "Historical values as printed in Annalen der Physik (4) 17, 132–148 (1905), with Wien constant alpha corrected from the misprint 10^-56 to 10^-57 per docs/provenance/ap-17-132.md#watch-alpha-exponent.",
  gasConstantProvenance: "measured-without-counting-molecules",
  entries: [
    {
      quantityId: "wienConstantAlpha",
      value: 6.1e-57,
      exactDecimal: "6.10e-57",
      unit: "erg s4 / cm3",
      kind: "printed-historical",
      evidentialRole: "fitted-constant",
      provenance:
        "Annalen der Physik (4) 17 (1905), p. 136, §2; corrected per docs/provenance/ap-17-132.md#watch-alpha-exponent",
      dependsOn: [],
      printedStatus: "printed-corrected",
      printedReading: "6,10 · 10^-56",
      printedUnit: "erg s4 / cm3",
      correctedValue: 6.1e-57,
      correctionReason: "reproduces the printed N; the printed exponent is ten times too large",
      receiptRef: "docs/provenance/ap-17-132.md#watch-alpha-exponent",
      journalPage: "136",
      facsimilePdfPage: 5,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-132.md#watch-alpha-exponent and survey ap-17-132.md, cross-referenced with CPAE Vol. 2 Doc. 14 p. 154",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "wienConstantBeta",
      value: 4.866e-11,
      exactDecimal: "4.866e-11",
      unit: "s K",
      kind: "printed-historical",
      evidentialRole: "fitted-constant",
      provenance: "Annalen der Physik (4) 17 (1905), p. 136, §2",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "4,866 · 10^-11",
      printedUnit: "s K",
      journalPage: "136",
      facsimilePdfPage: 5,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-132.md#watch-beta-constant and survey ap-17-132.md, cross-referenced with CPAE Vol. 2 Doc. 14 p. 154",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "molarGasConstant",
      value: 8.31e7,
      exactDecimal: "8.31e7",
      unit: "erg/(mol K)",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "1905 standard value R = 8.31 · 10^7 erg mol^-1 K^-1; editorial input for §2",
      dependsOn: [],
      printedStatus: "editorial-input",
      reason:
        "not printed in paper 1 §2; standard 1905 value R = 8.31e7 erg/(mol K) needed for Avogadro calculation",
      sensitivity:
        "Linear in R: R = 8.314e7 with L = 2.998e10 yields N = 6.1858e23 (R alone 6.1735e23; L alone 6.1828e23)",
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, editorial input per docs/provenance/ap-17-132.md#watch-printed-r-presence; unprinted numeral in §2, standard 1905 value",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "speedOfLight",
      value: 3e10,
      exactDecimal: "3e10",
      unit: "cm/s",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "1905 standard value L = 3 · 10^10 cm/s; editorial input for §2",
      dependsOn: [],
      printedStatus: "editorial-input",
      reason:
        "not printed numerically in paper 1 §2; standard 1905 value L = 3e10 cm/s needed for Avogadro calculation",
      sensitivity:
        "Inverse cubic in L: R = 8.314e7 with L = 2.998e10 yields N = 6.1858e23 (R alone 6.1735e23; L alone 6.1828e23)",
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, editorial input per docs/provenance/ap-17-132.md#watch-speed-of-light-l; unprinted numeral in §2, standard 1905 value",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "avogadroConstant",
      value: 6.17e23,
      exactDecimal: "6.17e23",
      unit: "1/mol",
      kind: "printed-historical",
      evidentialRole: "theoretical-estimate",
      provenance: "Annalen der Physik (4) 17 (1905), p. 136, §2",
      dependsOn: ["wienConstantBeta", "wienConstantAlpha", "molarGasConstant", "speedOfLight"],
      printedStatus: "printed",
      printedReading: "6,17 · 10^23",
      printedUnit: "1/mol",
      journalPage: "136",
      facsimilePdfPage: 5,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-132.md#watch-avogadro-n and survey ap-17-132.md, cross-referenced with CPAE Vol. 2 Doc. 14 p. 154",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "gramEquivalentCharge",
      value: 9.6e3,
      exactDecimal: "9.6e3",
      unit: "emu/mol",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "Annalen der Physik (4) 17 (1905), p. 146, §8",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "9,6 · 10^3",
      printedUnit: "emu/mol",
      journalPage: "146",
      facsimilePdfPage: 15,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-132.md#watch-gram-equivalent-charge and survey ap-17-132.md, cross-referenced with CPAE Vol. 2 Doc. 14 p. 164",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "stoppingPotentialMagnitude",
      value: 4.3,
      exactDecimal: "4.3",
      unit: "V",
      kind: "printed-historical",
      evidentialRole: "illustrative-computation",
      provenance: "Annalen der Physik (4) 17 (1905), p. 147, §8",
      dependsOn: ["molarGasConstant", "wienConstantBeta", "gramEquivalentCharge"],
      printedStatus: "printed",
      printedReading: "ca. 4,3 Volt",
      printedUnit: "Volt",
      journalPage: "147",
      facsimilePdfPage: 16,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-132.md#watch-volt-conversion and survey ap-17-132.md, cross-referenced with CPAE Vol. 2 Doc. 14 p. 164",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "ionizationWorkPerGramEquivalent",
      value: 6.4e12,
      exactDecimal: "6.4e12",
      unit: "erg/mol",
      kind: "printed-historical",
      evidentialRole: "illustrative-computation",
      provenance: "Annalen der Physik (4) 17 (1905), p. 148, §9",
      dependsOn: ["molarGasConstant", "wienConstantBeta", "speedOfLight"],
      printedStatus: "printed",
      printedReading: "ca. 6,4 · 10^12 Erg",
      printedUnit: "Erg",
      journalPage: "148",
      facsimilePdfPage: 17,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-132.md and survey ap-17-132.md, cross-referenced with CPAE Vol. 2 Doc. 14 p. 165",
      checkedAt: "2026-09-17",
    },
  ],
});

const brownian1905 = freezeConstantSet({
  id: "einstein-1905-brownian-printed",
  kind: "printed-historical",
  era: 1905,
  provenance:
    "Albert Einstein, Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen, Annalen der Physik (4) 17 (1905), 549–560. Facsimile ap-17-549.pdf.",
  precisionNote: "Historical values as printed in Annalen der Physik (4) 17, 549–560 (1905).",
  gasConstantProvenance: "measured-without-counting-molecules",
  entries: [
    {
      quantityId: "viscosity",
      value: 0.00135,
      exactDecimal: "0.00135",
      unit: "Pa s",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "Annalen der Physik (4) 17 (1905), p. 559, §5",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "k = 1,35 · 10^-2",
      printedUnit: "Poise",
      journalPage: "559",
      facsimilePdfPage: 11,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-549.md#watch-viscosity-k and survey ap-17-549.md, cross-referenced with CPAE Vol. 2 Doc. 16 p. 235",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "particleRadius",
      value: 5e-7,
      exactDecimal: "5e-7",
      unit: "m",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance:
        "Annalen der Physik (4) 17 (1905), p. 559, §5; particle diameter 0.001 mm gives radius 0.5 um",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "0,001 mm",
      printedUnit: "mm",
      journalPage: "559",
      facsimilePdfPage: 11,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-549.md#watch-particle-size and survey ap-17-549.md, cross-referenced with CPAE Vol. 2 Doc. 16 p. 235",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "temperature",
      value: 290.15,
      exactDecimal: "290.15",
      unit: "K",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance:
        "Annalen der Physik (4) 17 (1905), p. 559, §5; printed temperature 17° converted to kelvin",
      dependsOn: [],
      printedStatus: "editorial-input",
      printedReading: "17°",
      reason: "printed temperature is 17° C; 290.15 K is the modern kelvin conversion",
      sensitivity:
        "Square root in T: 290.0 K vs 290.15 K is 2.586e-4 relative change in displacement",
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, editorial input 17° C stated in §5 text per docs/provenance/ap-17-549.md#watch-viscosity-k, converted to 290.15 K",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "molarGasConstant",
      value: 8.31,
      exactDecimal: "8.31",
      unit: "J/(mol K)",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "1905 standard value R = 8.31 J/(mol K); editorial input for §5",
      dependsOn: [],
      printedStatus: "editorial-input",
      reason:
        "not printed in paper 2; standard 1905 value R = 8.31 J/(mol K) needed for displacement calculation",
      sensitivity: "Square root in R: displacement scales as sqrt(R)",
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, editorial input per docs/provenance/ap-17-549.md#watch-gas-constant-r; standard 1905 gas constant R = 8.31 J/(mol K)",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "avogadroConstant",
      value: 6e23,
      exactDecimal: "6e23",
      unit: "1/mol",
      kind: "printed-historical",
      evidentialRole: "theoretical-estimate",
      provenance: "Annalen der Physik (4) 17 (1905), p. 559, §5",
      dependsOn: ["molarGasConstant"],
      printedStatus: "printed",
      printedReading: "6 · 10²³",
      printedUnit: "1/mol",
      journalPage: "559",
      facsimilePdfPage: 11,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-549.md#watch-avogadro-n and survey ap-17-549.md, cross-referenced with CPAE Vol. 2 Doc. 16 p. 235",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "rmsDisplacement1d",
      value: 0.7947833e-6,
      exactDecimal: "0.7947833e-6",
      unit: "m",
      kind: "printed-historical",
      evidentialRole: "illustrative-computation",
      provenance: "Annalen der Physik (4) 17 (1905), p. 559, §5; 1 second displacement",
      dependsOn: [
        "molarGasConstant",
        "temperature",
        "avogadroConstant",
        "viscosity",
        "particleRadius",
      ],
      printedStatus: "printed",
      printedReading: "0,8 Mikron",
      printedUnit: "Mikron",
      journalPage: "559",
      facsimilePdfPage: 11,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-17-549.md#watch-displacements and survey ap-17-549.md, cross-referenced with CPAE Vol. 2 Doc. 16 p. 235",
      checkedAt: "2026-09-17",
    },
  ],
});

const massEnergy1905 = freezeConstantSet({
  id: "einstein-1905-mass-energy-printed",
  kind: "printed-historical",
  era: 1905,
  provenance:
    "Albert Einstein, Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?, Annalen der Physik (4) 18 (1905), 639–641. Facsimile ap-18-639.pdf.",
  precisionNote: "Historical values as printed in Annalen der Physik (4) 18, 639–641 (1905).",
  gasConstantProvenance: "not-applicable",
  entries: [
    {
      quantityId: "speedOfLightSquared",
      value: 9e16,
      exactDecimal: "9e16",
      unit: "m2 s-2",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "Annalen der Physik (4) 18 (1905), p. 641",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "9 · 10²⁰",
      printedUnit: "erg/g",
      journalPage: "641",
      facsimilePdfPage: 3,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via provenance receipt docs/provenance/ap-18-639.md#watch-factor-9-10-20 and survey ap-18-639.md, cross-referenced with CPAE Vol. 2 Doc. 24 p. 314",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "speedOfLight",
      value: 3e8,
      exactDecimal: "3e8",
      unit: "m/s",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "Paper 4 implicit light speed V = 3e8 m/s",
      dependsOn: ["speedOfLightSquared"],
      printedStatus: "editorial-input",
      reason:
        "paper 4 prints V only as a symbol; this is the positive square root of the printed factor",
      sensitivity:
        "none on the printed conversion, which reads the factor directly; the modern c is 0.0692 percent smaller",
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, editorial input per docs/provenance/ap-18-639.md#watch-energy-l-lightspeed-v; symbol V used in paper, positive square root of factor",
      checkedAt: "2026-09-17",
    },
  ],
});

const planck1901 = freezeConstantSet({
  id: "planck-1900-1901-printed",
  kind: "printed-historical",
  era: 1901,
  provenance:
    "Max Planck, Ueber das Gesetz der Energieverteilung im Normalspektrum, Annalen der Physik (4) 4, 553–563 (1901); Ueber die Elementarquanta der Materie und der Elektricität, Ann. Phys. (4) 4, 564–566 (1901).",
  precisionNote: "Planck's printed constants from Annalen der Physik (4) 4 (1901).",
  gasConstantProvenance: "measured-without-counting-molecules",
  entries: [
    {
      quantityId: "planckConstant",
      value: 6.55e-34,
      exactDecimal: "6.55e-34",
      unit: "J s",
      kind: "printed-historical",
      evidentialRole: "fitted-constant",
      provenance: "Ann. Phys. (4) 4 (1901), p. 563",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "6,55 · 10^-27",
      printedUnit: "erg s",
      journalPage: "563",
      facsimilePdfPage: 1,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via Annalen der Physik (4) 4 (1901) p. 561-563, cross-referenced with CPAE Vol. 2 Doc. 14 editorial notes, not a pinned repository facsimile",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "boltzmannConstant",
      value: 1.346e-23,
      exactDecimal: "1.346e-23",
      unit: "J/K",
      kind: "printed-historical",
      evidentialRole: "fitted-constant",
      provenance: "Ann. Phys. (4) 4 (1901), p. 563",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "1,346 · 10^-16",
      printedUnit: "erg/Grad",
      journalPage: "563",
      facsimilePdfPage: 1,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via Annalen der Physik (4) 4 (1901) p. 561-563, cross-referenced with CPAE Vol. 2 Doc. 14 editorial notes, not a pinned repository facsimile",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "avogadroConstant",
      value: 6.175e23,
      exactDecimal: "6.175e23",
      unit: "1/mol",
      kind: "printed-historical",
      evidentialRole: "fitted-constant",
      provenance: "Ann. Phys. (4) 4 (1901), p. 565",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "6,175 · 10^23",
      printedUnit: "1/mol",
      journalPage: "565",
      facsimilePdfPage: 1,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via Annalen der Physik (4) 4 (1901) p. 564-566, cross-referenced with CPAE Vol. 2 Doc. 14 editorial notes, not a pinned repository facsimile",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "elementaryCharge",
      value: 1.5644156e-19,
      exactDecimal: "1.5644156e-19",
      unit: "C",
      kind: "printed-historical",
      evidentialRole: "fitted-constant",
      provenance: "Ann. Phys. (4) 4 (1901), p. 565",
      dependsOn: [],
      printedStatus: "printed",
      printedReading: "4,69 · 10^-10",
      printedUnit: "esu",
      journalPage: "565",
      facsimilePdfPage: 1,
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, via Annalen der Physik (4) 4 (1901) p. 564-566, cross-referenced with CPAE Vol. 2 Doc. 14 editorial notes, not a pinned repository facsimile",
      checkedAt: "2026-09-17",
    },
    {
      quantityId: "speedOfLight",
      value: 3e8,
      exactDecimal: "3e8",
      unit: "m/s",
      kind: "printed-historical",
      evidentialRole: "measured-observation",
      provenance: "1901 standard value c = 3 · 10^8 m/s; editorial input for consistency check",
      dependsOn: [],
      printedStatus: "editorial-input",
      reason: "editorial input for consistency check; Planck's 1901 papers use 3e10 cm/s",
      sensitivity: "Cubic in L for 8*pi*h/L^3 check",
      transcriptionStatus: "transcribed-and-checked",
      checkedBy:
        "pane21, editorial input c = 3 · 10^8 m/s per standard 1901 optics, not printed as numeral in Planck 1901 §6",
      checkedAt: "2026-09-17",
    },
  ],
});

// ---- Registry -------------------------------------------------------------------------------------

export const RESERVED_SET_IDS = Object.freeze({
  "einstein-1905-thesis-printed": "am-ref-viscosity-suspension-c9lp",
  "einstein-1906-dissertation-printed": "am-ref-viscosity-suspension-c9lp",
  "einstein-1911-correction-printed": "am-ref-viscosity-suspension-c9lp",
});

const unavailable = RESERVED_SET_IDS;

const MODE_1904_FORBIDDEN_SET_IDS: ReadonlySet<string> = new Set([
  "modern-si-2019",
  "modern-codata-2022",
  "einstein-1905-light-quanta-printed",
  "einstein-1905-mass-energy-printed",
  "einstein-1905-brownian-printed",
]);

let mode1904GuardDepth = 0;
let historicalGuardDepth = 0;

export function getConstantSet(id: string): ConstantSet {
  if (mode1904GuardDepth > 0 && MODE_1904_FORBIDDEN_SET_IDS.has(id))
    reject("modern-constant-in-1904-mode", `${id} is not available inside a 1904 mode.`);
  if (id === modern.id) return modern;
  if (id === codata2022.id) return codata2022;
  if (id === scenarioGasConstant.id) return scenarioGasConstant;
  if (id === lightQuanta1905.id) return lightQuanta1905;
  if (id === brownian1905.id) return brownian1905;
  if (id === massEnergy1905.id) return massEnergy1905;
  if (id === planck1901.id) return planck1901;
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

  // Physical consistency recomputations for registered historical sets
  if (set.id === "einstein-1905-light-quanta-printed") {
    const alpha = byId.get("wienConstantAlpha");
    const beta = byId.get("wienConstantBeta");
    const R = byId.get("molarGasConstant");
    const L = byId.get("speedOfLight");
    const N = byId.get("avogadroConstant");
    if (alpha && beta && R && L && N) {
      if (alpha.printedStatus === "printed" && alpha.printedReading?.includes("10^-56")) {
        issues.push({
          quantityId: "wienConstantAlpha",
          code: "printed-inconsistency",
          message: "Alpha misprint 10^-56 was not corrected; gives N = 6.17e22.",
        });
      }
      const alphaVal = alpha.correctedValue ?? alpha.value;
      const recomputedN = (beta.value / alphaVal) * ((8 * Math.PI * R.value) / L.value ** 3);
      const expectedN = 6.170486e23;
      if (Math.abs(recomputedN - expectedN) / expectedN > 1e-6) {
        issues.push({
          quantityId: "avogadroConstant",
          code: "recomputed-mismatch",
          message: `Recomputed N ${recomputedN} does not match expected ${expectedN}.`,
        });
      }
    }
    const E = byId.get("gramEquivalentCharge");
    const Pi = byId.get("stoppingPotentialMagnitude");
    if (R && beta && E && Pi) {
      const nu = 1.03e15;
      const recomputedPiAbvolt = (R.value * beta.value * nu) / E.value;
      const recomputedPiVolts = recomputedPiAbvolt * 1e-8;
      if (Math.abs(recomputedPiVolts - 4.3385) / 4.3385 > 1e-4) {
        issues.push({
          quantityId: "stoppingPotentialMagnitude",
          code: "recomputed-mismatch",
          message: `Recomputed Pi ${recomputedPiVolts} V does not match 4.3385 V.`,
        });
      }
      const slope = ((R.value * beta.value) / E.value) * 1e-8;
      if (Math.abs(slope - 4.2121e-15) / 4.2121e-15 > 1e-4) {
        issues.push({
          quantityId: "stoppingPotentialMagnitude",
          code: "recomputed-mismatch",
          message: `Recomputed slope ${slope} does not match 4.2121e-15 V s.`,
        });
      }
    }
    const ionization = byId.get("ionizationWorkPerGramEquivalent");
    if (R && beta && L && ionization) {
      const lambda = 1.9e-5; // cm
      const recomputedWork = (R.value * beta.value * L.value) / lambda;
      if (Math.abs(recomputedWork - 6.3847e12) / 6.3847e12 > 1e-4) {
        issues.push({
          quantityId: "ionizationWorkPerGramEquivalent",
          code: "recomputed-mismatch",
          message: `Recomputed ionization work ${recomputedWork} does not match 6.3847e12.`,
        });
      }
    }
  } else if (set.id === "einstein-1905-brownian-printed") {
    const R = byId.get("molarGasConstant");
    const T = byId.get("temperature");
    const N = byId.get("avogadroConstant");
    const eta = byId.get("viscosity");
    const a = byId.get("particleRadius");
    const lambda = byId.get("rmsDisplacement1d");
    if (R && T && N && eta && a && lambda) {
      const D = (R.value * T.value) / N.value / (6 * Math.PI * eta.value * a.value);
      const lambda1 = Math.sqrt(2 * D);
      if (Math.abs(lambda1 - 0.7947833e-6) / 0.7947833e-6 > 1e-5) {
        issues.push({
          quantityId: "rmsDisplacement1d",
          code: "recomputed-mismatch",
          message: `Recomputed 1s displacement ${lambda1} does not match 0.7947833 um.`,
        });
      }
      const lambda60 = Math.sqrt(2 * D * 60);
      if (Math.abs(lambda60 - 6.156365e-6) / 6.156365e-6 > 1e-5) {
        issues.push({
          quantityId: "rmsDisplacement1d",
          code: "recomputed-mismatch",
          message: `Recomputed 60s displacement ${lambda60} does not match 6.156365 um.`,
        });
      }
    }
  } else if (set.id === "einstein-1905-mass-energy-printed") {
    const c2 = byId.get("speedOfLightSquared");
    if (c2) {
      const energyJ = 9e13; // 9e20 erg in Joules
      const massKg = energyJ / c2.value; // c2 is 9e16 m2 s-2
      if (Math.abs(massKg - 0.001) > 1e-9) {
        issues.push({
          quantityId: "speedOfLightSquared",
          code: "recomputed-mismatch",
          message: `9e20 erg gives ${massKg * 1000} g, expected 1 g.`,
        });
      }
    }
  } else if (set.id === "planck-1900-1901-printed") {
    const h = byId.get("planckConstant");
    const k = byId.get("boltzmannConstant");
    const c = byId.get("speedOfLight");
    if (h && k && c) {
      const hCgs = h.value * 1e7;
      const kCgs = k.value * 1e7;
      const hOverK = hCgs / kCgs;
      if (Math.abs(hOverK - 4.86627e-11) / 4.86627e-11 > 1e-3) {
        issues.push({
          quantityId: "planckConstant",
          code: "recomputed-mismatch",
          message: `h/k = ${hOverK}, expected 4.866e-11.`,
        });
      }
      const L = c.value * 100; // 3e10 cm/s
      const alphaCalc = (8 * Math.PI * hCgs) / L ** 3;
      if (Math.abs(alphaCalc - 6.097e-57) / 6.097e-57 > 1e-2) {
        issues.push({
          quantityId: "planckConstant",
          code: "recomputed-mismatch",
          message: `8*pi*h/L^3 = ${alphaCalc}, expected 6.097e-57.`,
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
