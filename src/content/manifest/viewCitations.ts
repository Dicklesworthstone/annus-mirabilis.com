/**
 * WHETHER EVERY OUTPUT A VIEW OR ACTION SAYS IT CONSUMES IS ONE THIS MANIFEST DECLARES.
 *
 * The master plan requires each instrument manifest to carry "the representation mapping (which
 * views show which snapshot fields)" and, on every action, an `acceptedResult` naming the outputs it
 * produces. Both are lists of output ids. Nothing read either one.
 *
 * MEASURED 2026-10-06, before this file existed: `rg '\.consumes\b' src scripts` returned exactly ONE
 * site, `src/content/schemas/experiment.ts`, which parses the field into the validated object. No
 * test, no script and no component read it afterwards. A declaration with no consumer is the thing
 * AGENTS.md's creation gate is about, from the other side: it had drifted precisely because nothing
 * could tell.
 *
 * WHAT IT HAD DRIFTED INTO. 583 citations across 33 manifests, of which EIGHT named nothing their own
 * manifest declares - and all eight were real ids in the wrong namespace, which is why they read as
 * correct:
 *
 *   bm-08  camera-path, camera-table  "diffusionCoefficient"  the quantityId SHARED by naiveD,
 *                                     centeredD, covarianceD, pairD and three intervals
 *   bm-08  camera-speed               "apparentSpeed"         the quantityId shared by
 *                                     apparentSpeedIdeal and apparentSpeedMeasured
 *   lq-09  lq-09-data-table           "ionizationEnergyPerMolecule"  the quantityId of the PARAMETER
 *                                     ionizationEnergyEv
 *   lq-06  mean-energy-strip and      "meanQuantumEnergyWienEv",     computed, labelled and
 *          lq-06-compare-mean-energies "moleculeMeanKineticEnergyEv"  displayed, but declared in
 *                                     LQ06_OUTPUTS only, never in the manifest
 *
 * So two defect shapes. The first three cite a QUANTITY id where an OUTPUT id belongs, which AGENTS.md
 * already names for equations - "a similar glyph is never a binding key", "never lookup by human
 * label" - and which bites harder here because a quantityId is deliberately shared by several outputs,
 * so the citation is ambiguous even when the string exists. The fourth is an output the manifest never
 * declared, so its allowedStatuses went undeclared while two sites named it.
 *
 * WHAT THIS ASKS, AND WHAT IT DELIBERATELY DOES NOT. It asks whether each cited id identifies an
 * `outputs[]` or `parameters[]` entry OF THE SAME MANIFEST. A parameter is admitted on purpose:
 * lq-05's configuration grid consumes `n` and `f`, which are controls a reader sets, and a view
 * showing an input is not an error.
 *
 * It does NOT ask whether the id also exists in the laboratory's runtime `*_OUTPUTS` contract. That
 * question was measured at the same time and 35 citations fail it, nearly all because a manifest
 * legitimately names something the session does not: every parameter citation, plus labs whose
 * manifest renames an output (sr-02's `emfMagnet` for `electromotiveForceMagnetFrame`, me-01's
 * `restBodyBefore` for `bodyEnergyRestBefore`, me-02, sr-09, bm-08's apparent speeds). Deciding which
 * of those renames is an error and which is an intended reader-facing name needs each lab's author,
 * not a sweep, so it is recorded here as an open question rather than asserted into a red gate. The
 * count is reported by `contractMismatches` for whoever takes it up.
 *
 * Pure: it reads parsed manifests and nothing else, so the test beside it drives both branches with
 * synthetic manifests AND over the real tree. The synthetic half is what proves the gate can fail,
 * and it keeps working if the tree is ever repaired in a way that makes the live half vacuous.
 */

/** The shape this reads. A manifest validated by `validateExperiment` satisfies it structurally. */
export type CitedManifest = Readonly<{
  id: string;
  // `quantityId` is optional here because the citation half does not need it; the contract join
  // below does, and it is the field that already carries the join (am-gpk5).
  outputs?: readonly Readonly<{ id: string; quantityId?: string | undefined }>[] | undefined;
  parameters?: readonly Readonly<{ id: string }>[] | undefined;
  views?: readonly Readonly<{ id: string; consumes?: readonly string[] | undefined }>[] | undefined;
  actions?:
    | readonly Readonly<{
        actionId: string;
        acceptedResult?: Readonly<{ outputs?: readonly string[] | undefined }> | undefined;
      }>[]
    | undefined;
}>;

/** One citation: where it is written, and what it names. */
export type ViewCitation = Readonly<{
  lab: string;
  /** `view <id>` or `action <id>`, as the report prints it. */
  site: string;
  ref: string;
  /** Whether the ref names an `outputs[]` entry, a `parameters[]` entry, or nothing. */
  resolution: "output" | "parameter" | "unresolved";
}>;

export type ViewCitationReport = Readonly<{
  /** How many manifests were examined. Zero means the citation count below establishes nothing. */
  labs: number;
  citations: readonly ViewCitation[];
  unresolved: readonly ViewCitation[];
}>;

function sitesOf(manifest: CitedManifest): readonly Readonly<{ site: string; ref: string }>[] {
  const out: Array<{ site: string; ref: string }> = [];
  for (const view of manifest.views ?? [])
    for (const ref of view.consumes ?? []) out.push({ site: `view ${view.id}`, ref });
  for (const action of manifest.actions ?? [])
    for (const ref of action.acceptedResult?.outputs ?? [])
      out.push({ site: `action ${action.actionId}`, ref });
  return out;
}

/**
 * Every citation in every manifest given, classified. The report carries the whole population and not
 * only the failures, so a caller can state what it examined beside its verdict.
 */
export function checkViewCitations(manifests: readonly CitedManifest[]): ViewCitationReport {
  const citations: ViewCitation[] = [];
  for (const manifest of manifests) {
    const outputs = new Set((manifest.outputs ?? []).map((o) => o.id));
    const parameters = new Set((manifest.parameters ?? []).map((p) => p.id));
    for (const { site, ref } of sitesOf(manifest)) {
      const resolution = outputs.has(ref)
        ? "output"
        : parameters.has(ref)
          ? "parameter"
          : "unresolved";
      citations.push({ lab: manifest.id, site, ref, resolution });
    }
  }
  return Object.freeze({
    labs: manifests.length,
    citations: Object.freeze(citations),
    unresolved: Object.freeze(citations.filter((c) => c.resolution === "unresolved")),
  });
}

/**
 * The open question this file does not assert, counted so it is not lost: citations naming something
 * the laboratory's runtime contract has no output for. A parameter citation is always one of these and
 * is not a defect, so the count is reported with the parameter share separated out.
 */
export function contractMismatches(
  report: ViewCitationReport,
  contractOutputs: Readonly<Record<string, readonly string[]>>,
): Readonly<{ total: number; fromParameters: number; fromRenamedOutputs: number }> {
  let fromParameters = 0;
  let fromRenamedOutputs = 0;
  for (const citation of report.citations) {
    const contract = contractOutputs[citation.lab];
    if (contract === undefined || contract.includes(citation.ref)) continue;
    if (citation.resolution === "parameter") fromParameters += 1;
    else if (citation.resolution === "output") fromRenamedOutputs += 1;
  }
  return Object.freeze({
    total: fromParameters + fromRenamedOutputs,
    fromParameters,
    fromRenamedOutputs,
  });
}

/** The one line a caller prints beside its verdict, naming the denominator. */
export function summarizeViewCitations(report: ViewCitationReport): string {
  const kind = (r: ViewCitation["resolution"]) =>
    report.citations.filter((c) => c.resolution === r).length;
  return (
    `${report.citations.length} view/action citation(s) across ${report.labs} manifest(s): ` +
    `${kind("output")} name a declared output, ${kind("parameter")} a declared parameter, ` +
    `${kind("unresolved")} name nothing the manifest declares`
  );
}

/**
 * THE JOIN BETWEEN A MANIFEST'S OUTPUT IDS AND ITS LABORATORY'S RUNTIME CONTRACT (am-gpk5).
 *
 * The bead reports thirteen manifest outputs the contract "does not emit" and proposes either a
 * rename or a hand-written join table. NEITHER IS NEEDED: the join is already data, in two fields
 * that were written for it and never read together.
 *
 *   manifest `outputs[].quantityId`  names the contract's key
 *   contract `<key>.ownerId`         ends in "." + the manifest's output id
 *
 * me-02's `limitingCoefficient`, which the bead calls "NO UNAMBIGUOUS COUNTERPART ... needs
 * me-02's author", is `inertialMassDecrease`, whose ownerId is `massEnergy.limitingCoefficient`
 * and whose semanticKind is `limiting-mass-coefficient`. The contract says so itself.
 *
 * So a join is one of three kinds, strongest first, and the kind is reported rather than
 * flattened: `id` (the manifest id IS a contract key), `quantityId-confirmed` (joined by
 * quantityId AND the ownerId names the manifest id back), `quantityId-only` (joined by
 * quantityId; the ownerId cannot confirm because one owner emits several outputs, which is
 * sr-02's case where four share `fields.emfBothDescriptions`).
 *
 * An output that joins by nothing is `unjoined` and is the finding. Four are, and the bead found
 * none of them, because it looked only at outputs a VIEW cites.
 */
export type OutputJoinKind = "id" | "quantityId-confirmed" | "quantityId-only" | "unjoined";

export type OutputJoin = Readonly<{
  lab: string;
  outputId: string;
  quantityId: string | undefined;
  contractKey: string | undefined;
  kind: OutputJoinKind;
}>;

/** One laboratory's runtime contract, as `<key> -> { ownerId }`. */
export type ContractOutputs = Readonly<Record<string, Readonly<{ ownerId?: string }>>>;

/**
 * Joins every declared output to its contract. A laboratory with no contract supplied is skipped
 * and counted separately: absent is not the same as unjoined, and reporting it as unjoined would
 * invent four defects in bm-02 and lq-02 that nobody can act on.
 */
export function outputContractJoins(
  manifests: readonly CitedManifest[],
  contracts: Readonly<Record<string, ContractOutputs>>,
): Readonly<{ joins: readonly OutputJoin[]; labsWithoutContract: readonly string[] }> {
  const joins: OutputJoin[] = [];
  const labsWithoutContract: string[] = [];
  for (const manifest of manifests) {
    const contract = contracts[manifest.id];
    if (contract === undefined) {
      labsWithoutContract.push(manifest.id);
      continue;
    }
    for (const output of manifest.outputs ?? []) {
      const quantityId = typeof output.quantityId === "string" ? output.quantityId : undefined;
      if (contract[output.id] !== undefined) {
        joins.push(
          Object.freeze({
            lab: manifest.id,
            outputId: output.id,
            quantityId,
            contractKey: output.id,
            kind: "id" as const,
          }),
        );
        continue;
      }
      const viaQuantity = quantityId === undefined ? undefined : contract[quantityId];
      if (viaQuantity !== undefined && quantityId !== undefined) {
        const confirmed = (viaQuantity.ownerId ?? "").endsWith(`.${output.id}`);
        joins.push(
          Object.freeze({
            lab: manifest.id,
            outputId: output.id,
            quantityId,
            contractKey: quantityId,
            kind: confirmed ? ("quantityId-confirmed" as const) : ("quantityId-only" as const),
          }),
        );
        continue;
      }
      joins.push(
        Object.freeze({
          lab: manifest.id,
          outputId: output.id,
          quantityId,
          contractKey: undefined,
          kind: "unjoined" as const,
        }),
      );
    }
  }
  return Object.freeze({
    joins: Object.freeze(joins),
    labsWithoutContract: Object.freeze(labsWithoutContract),
  });
}

/**
 * The outputs that join to nothing, declared so an undeclared one fails and a stale declaration is
 * reported, following `requiredUnitKinds.ts`. Each says WHY it cannot be joined, because "no
 * counterpart" without a reason is the silence this bead refuses.
 */
export const UNJOINED_OUTPUTS: Readonly<Record<string, string>> = Object.freeze({
  "bm-08/apparentSpeedIdeal":
    "The contract emits idealSpeeds, a per-interval array; this manifest output is a scalar id and shares the quantityId apparentSpeed with apparentSpeedMeasured. Whether one scalar summarises the array, or the manifest should declare the array, is bm-08's author's call.",
  "bm-08/apparentSpeedMeasured":
    "As above against cameraSpeeds, and it shares the quantityId apparentSpeed with apparentSpeedIdeal, so the quantityId cannot distinguish them even if it were registered.",
  "bm-08/apparentSpeedRatio":
    "The contract emits speedRatios, a per-interval array, against this scalar id. Same question as the two above.",
  "sr-09/detectorCrossings":
    "No counterpart of any kind among sr-09's twelve contract keys, which are speeds, angles, frequencies, Doppler factors, a phase and a Lorentz factor. This is the phantom the bead suspected at me-02 and did not find here.",
});
