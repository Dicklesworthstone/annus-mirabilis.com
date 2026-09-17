/**
 * Run all epistemic rejections and flags against a compiler check context.
 */

import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { computeFlagFingerprint } from "../../compiler/reviewQueue.ts";
import {
  type ConstantSetLike,
  circularMolecularCount,
  circularRestEnergy,
  type EnergyExpr,
  type InferenceRecord,
  type RestEnergyInit,
} from "./circularity.ts";
import {
  findProofCycle,
  historicalRouteUsesOracle,
  type ProofGraphNode,
  type ProofRecord,
} from "./proofGraph.ts";
import {
  asRecord,
  eachRecord,
  isArgumentNodeRecord,
  isExperimentRecord,
  isJourneyRecord,
  isProofRecord,
  recordId,
} from "./records.ts";
import { evaluateShelfDate, type ShelfPremise, type ShelfPremiseStatus } from "./shelfDate.ts";

export const EPISTEMIC_BEAD_ID = "am-cm-checks-epistemic-o7n";

const LATER_LABEL = /^later evidence \((\d{4})\)$/i;

function report(context: CheckContext, item: CheckReportItem & { rule: string }): void {
  context.report(item);
}

function asNodes(context: CheckContext): ProofGraphNode[] {
  const nodes: ProofGraphNode[] = [];
  eachRecord(context, (id, rec) => {
    if (!isArgumentNodeRecord(rec)) return;
    nodes.push({
      id,
      premises: Array.isArray(rec.premises) ? (rec.premises as ProofGraphNode["premises"]) : [],
      prerequisites: Array.isArray(rec.prerequisites)
        ? (rec.prerequisites as ProofGraphNode["prerequisites"])
        : [],
    });
  });
  return nodes;
}

function asProofs(context: CheckContext): ProofRecord[] {
  const proofs: ProofRecord[] = [];
  eachRecord(context, (id, rec) => {
    if (!isProofRecord(rec)) return;
    proofs.push({
      id,
      route: String(rec.route),
      argumentNodeIds: rec.argumentNodeIds as string[],
    });
  });
  return proofs;
}

export function runProofCycle(context: CheckContext): void {
  const nodes = asNodes(context);
  for (const proof of asProofs(context)) {
    const cycle = findProofCycle(nodes, proof);
    if (cycle) {
      report(context, {
        rule: "proof-cycle",
        recordId: proof.id,
        path: proof.id,
        flaggedText: cycle.join(" -> "),
        message: `Proof "${proof.id}" has a derivation cycle: ${cycle.join(" -> ")}.`,
        repair:
          "Remove a historical-derivation, pedagogical-reconstruction, modern-verification-oracle, or proof-edge premise so the selected proof is acyclic. Cross-reference, evidence, and cross-link edges may cycle.",
      });
    }
  }
}

export function runOracleInHistoricalRoute(context: CheckContext): void {
  const nodes = asNodes(context);
  for (const proof of asProofs(context)) {
    const hit = historicalRouteUsesOracle(nodes, proof);
    if (hit) {
      report(context, {
        rule: "oracle-in-historical-route",
        recordId: proof.id,
        path: hit.nodeId,
        flaggedText: hit.premiseId,
        message: `Proof "${proof.id}" route "${proof.route}" uses modern-verification-oracle "${hit.premiseId}" as a derivation premise.`,
        repair:
          "Move the oracle to a modern-verification route, or keep it off the source-order and discovery proofs.",
      });
    }
  }
}

function premiseFromRecord(rec: Record<string, unknown>, id: string): ShelfPremise | null {
  const status = rec.status;
  if (status !== "available" && status !== "parallel-work" && status !== "later") return null;
  const date = asRecord(rec.date);
  const latestYear =
    typeof rec.latestYear === "number"
      ? rec.latestYear
      : typeof date?.latestYear === "number"
        ? date.latestYear
        : undefined;
  if (latestYear === undefined) return null;
  return {
    id,
    status: status as ShelfPremiseStatus,
    latestYear,
    admittedImport: rec.admittedImport as ShelfPremise["admittedImport"],
  };
}

export function runShelfDate(context: CheckContext): void {
  const premises = new Map<string, ShelfPremise>();
  eachRecord(context, (id, rec) => {
    if (rec.kind === "historical-premise" || rec.kind === "knowledge-card" || rec.status) {
      const p = premiseFromRecord(rec, id);
      if (p) premises.set(id, p);
    }
  });

  eachRecord(context, (id, rec) => {
    if (!isJourneyRecord(rec)) return;
    const admittedImports = Array.isArray(rec.admittedImports)
      ? rec.admittedImports
          .map((item) =>
            typeof item === "string"
              ? item
              : String(asRecord(item)?.importId ?? asRecord(item)?.resultId ?? ""),
          )
          .filter(Boolean)
      : [];
    const exported = Array.isArray(rec.sourcePaperExportedResults)
      ? (rec.sourcePaperExportedResults as string[])
      : undefined;
    const journey = { id, admittedImports, sourcePaperExportedResults: exported };

    const cite = (
      stageId: string,
      kind: "shelf" | "chain" | "fork" | "move",
      cardId: string,
      acknowledged?: boolean,
    ) => {
      const premise = premises.get(cardId);
      if (!premise) return;
      const decision = evaluateShelfDate(
        { id: stageId, kind, parallelWorkAcknowledged: acknowledged },
        premise,
        journey,
      );
      if (!decision.ok) {
        report(context, {
          rule: "shelf-date-violation",
          recordId: cardId,
          path: `${id}/${stageId}`,
          flaggedText: decision.reason,
          message: `Journey "${id}" ${kind} stage "${stageId}" cites "${cardId}" (${decision.reason}).`,
          repair: decision.repair,
        });
      }
    };

    if (Array.isArray(rec.shelf)) {
      for (const cardId of rec.shelf) {
        if (typeof cardId === "string") cite("shelf", "shelf", cardId);
      }
    }
    if (Array.isArray(rec.stages)) {
      for (const stage of rec.stages) {
        const s = asRecord(stage);
        if (!s) continue;
        const stageId = typeof s.id === "string" ? s.id : "stage";
        for (const ref of Array.isArray(s.premiseRefs) ? s.premiseRefs : []) {
          const r = asRecord(ref);
          if (!r || typeof r.cardId !== "string" || !r.cardId) continue;
          cite(stageId, "chain", r.cardId, r.parallelWorkAcknowledged === true);
        }
      }
    }
    if (Array.isArray(rec.forks)) {
      for (const fork of rec.forks) {
        const f = asRecord(fork);
        if (!f) continue;
        const forkId = typeof f.id === "string" ? f.id : "fork";
        for (const cardId of Array.isArray(f.premiseRefs) ? f.premiseRefs : []) {
          if (typeof cardId === "string") cite(forkId, "fork", cardId);
        }
        const branches = Array.isArray(f.branches) ? f.branches : [];
        for (const b of branches) {
          const br = asRecord(b);
          const cardId = asRecord(br?.proponent)?.cardId;
          if (typeof cardId === "string") cite(forkId, "fork", cardId);
        }
      }
    }
    const move = asRecord(rec.move);
    if (move && typeof move.cardId === "string") {
      cite(typeof move.id === "string" ? move.id : "move", "move", move.cardId);
    }
  });
}

export function runLaterEvidenceUnlabeled(context: CheckContext): void {
  eachRecord(context, (id, rec) => {
    if (isArgumentNodeRecord(rec) && Array.isArray(rec.evidence)) {
      for (const edge of rec.evidence) {
        const e = asRecord(edge);
        if (!e) continue;
        const year = typeof e.latestYear === "number" ? e.latestYear : undefined;
        const label = typeof e.dateLabel === "string" ? e.dateLabel : undefined;
        if (year !== undefined && year > 1904) {
          if (!label || !LATER_LABEL.test(label)) {
            report(context, {
              rule: "later-evidence-unlabeled",
              recordId: id,
              flaggedText: typeof e.ref === "object" ? String(asRecord(e.ref)?.id ?? "") : "",
              message: `Evidence on "${id}" postdates 1904 without a date label of the form "later evidence (YEAR)".`,
              repair: `Set dateLabel to "later evidence (${year})".`,
            });
          }
        }
      }
    }
    if (!isJourneyRecord(rec) || !Array.isArray(rec.worldChecks)) return;
    for (const check of rec.worldChecks) {
      const w = asRecord(check);
      if (!w) continue;
      const wcId = typeof w.id === "string" ? w.id : id;
      const quantityId = typeof w.quantityId === "string" ? w.quantityId.trim() : "";
      if (!quantityId) {
        report(context, {
          rule: "later-evidence-unlabeled",
          recordId: wcId,
          message: `World-check "${wcId}" binds no quantity id.`,
          repair: "Bind a canonical quantity id for the live comparison.",
        });
      }
      const later = asRecord(w.laterEvidence);
      const measured = w.comparisonKind === "measured-fact";
      if (measured && !later) {
        report(context, {
          rule: "later-evidence-unlabeled",
          recordId: wcId,
          message: `World-check "${wcId}" has no dated comparison.`,
          repair: "Attach laterEvidence with a year and the label later evidence (YEAR).",
        });
        continue;
      }
      if (!later) continue;
      const year = typeof later.year === "number" ? later.year : 0;
      const description = typeof later.description === "string" ? later.description : "";
      if (year > 1904 && !LATER_LABEL.test(description)) {
        report(context, {
          rule: "later-evidence-unlabeled",
          recordId: wcId,
          flaggedText: description,
          message: `World-check "${wcId}" cites ${year} without the label "later evidence (${year})".`,
          repair: `Set laterEvidence.description to "later evidence (${year})".`,
        });
      }
    }
  });
}

export function runMissingAccessibility(context: CheckContext): void {
  eachRecord(context, (id, rec) => {
    if (isExperimentRecord(rec)) {
      const views = Array.isArray(rec.views) ? rec.views.map(asRecord) : [];
      const actions = Array.isArray(rec.actions) ? rec.actions : [];
      const parameters = Array.isArray(rec.parameters) ? rec.parameters : [];
      if ((parameters.length > 0 || views.length > 0) && actions.length === 0) {
        report(context, {
          rule: "missing-accessibility-alternative",
          recordId: id,
          message: `Experiment "${id}" has interactive parameters or views without action-contract equivalents.`,
          repair: "Add actions[] with equivalentAffordance for each interactive control.",
        });
      }
      const visual = views.filter((v) => v && (v.kind === "canvas" || v.kind === "three"));
      const textual = views.some((v) => v && (v.kind === "table" || v.kind === "text"));
      const described =
        typeof rec.textualDescription === "string" && rec.textualDescription.trim().length > 0;
      if (visual.length > 0 && !textual && !described) {
        report(context, {
          rule: "missing-accessibility-alternative",
          recordId: id,
          message: `Experiment "${id}" has a canvas or Three.js view without a table/text view or textual description.`,
          repair: "Add a table or text view, or a textualDescription specification.",
        });
      }
    }
    if (rec.kind === "foundation" || rec.kind === "bridge") {
      const hasProse =
        (typeof rec.textualEquivalent === "string" && rec.textualEquivalent.trim().length > 0) ||
        (typeof rec.text === "string" && rec.text.trim().length > 0) ||
        (typeof rec.summary === "string" && rec.summary.trim().length > 0) ||
        (Array.isArray(rec.explanation) && rec.explanation.length > 0) ||
        (Array.isArray(rec.example) && rec.example.length > 0);
      if (!hasProse) {
        report(context, {
          rule: "missing-accessibility-alternative",
          recordId: id,
          message: `${rec.kind} "${id}" has no textual equivalent.`,
          repair: "Author a textualEquivalent that carries the same claim.",
        });
      }
    }
  });
}

export function runMissingNotModeled(context: CheckContext): void {
  eachRecord(context, (id, rec) => {
    if (!isExperimentRecord(rec) && rec.kind !== "experiment") return;
    if (rec.kind !== "experiment") return;
    const list = rec.notModeled;
    if (!Array.isArray(list) || list.length === 0) {
      report(context, {
        rule: "missing-not-modeled",
        recordId: id,
        message: `Experiment "${id}" is missing a non-empty notModeled list.`,
        repair: "Declare at least one notModeled limitation as a plain line.",
      });
    }
  });
}

export function runCoverageWithoutOwner(context: CheckContext): void {
  const experiments = new Map<string, Record<string, unknown>>();
  eachRecord(context, (id, rec) => {
    if (rec.kind === "experiment") experiments.set(id, rec);
  });
  const usage = new Map<string, string[]>();

  eachRecord(context, (id, rec) => {
    if (!isArgumentNodeRecord(rec)) return;
    const obligation = asRecord(rec.coverageObligation);
    const treatment = asRecord(obligation?.treatment) ?? asRecord(rec.treatment);
    if (!treatment) return;
    if (treatment.kind === "omitted") {
      const reason = typeof treatment.reason === "string" ? treatment.reason.trim() : "";
      if (!reason) {
        report(context, {
          rule: "coverage-without-owner",
          recordId: id,
          message: `Argument node "${id}" omits instrument treatment without a written reason.`,
          repair: "Add treatment.reason or name a resolvable experiment owner.",
        });
      }
      return;
    }
    if (treatment.kind !== "instrument") return;
    const ids = Array.isArray(treatment.experimentIds) ? treatment.experimentIds : [];
    if (ids.length === 0) {
      report(context, {
        rule: "coverage-without-owner",
        recordId: id,
        message: `Argument node "${id}" names instrument treatment without a resolvable experiment id.`,
        repair: "Set treatment.experimentIds to a registered experiment with an owner.",
      });
      return;
    }
    for (const expId of ids) {
      if (typeof expId !== "string") continue;
      const exp = experiments.get(expId);
      const owner = exp ? (asRecord(exp.owner) ?? exp.owner) : undefined;
      if (!exp || !owner) {
        report(context, {
          rule: "coverage-without-owner",
          recordId: id,
          flaggedText: expId,
          message: `Argument node "${id}" names instrument "${expId}" without a resolvable owner.`,
          repair: `Register experiment "${expId}" with an owner, or change the treatment.`,
        });
      }
      const list = usage.get(expId) ?? [];
      list.push(id);
      usage.set(expId, list);
    }
  });

  for (const [expId, nodes] of usage) {
    if (nodes.length < 2) continue;
    for (const nodeId of nodes) {
      const rec = asRecord(context.records.get(nodeId));
      if (!rec) continue;
      const obligation = asRecord(rec.coverageObligation);
      const treatment = asRecord(obligation?.treatment) ?? asRecord(rec.treatment);
      const note =
        typeof treatment?.correspondenceNote === "string"
          ? treatment.correspondenceNote.trim()
          : "";
      if (!note) {
        report(context, {
          rule: "coverage-without-owner",
          recordId: nodeId,
          flaggedText: expId,
          message: `Instrument "${expId}" is shared by ${nodes.join(", ")} without a correspondence note on "${nodeId}".`,
          repair:
            "Add treatment.correspondenceNote explaining what this node uses the instrument for.",
        });
      }
    }
  }
}

export function runMisconceptionMinimum(context: CheckContext): void {
  const byPaper = new Map<string, { complete: boolean; declared: boolean; count: number }>();
  eachRecord(context, (_id, rec) => {
    if (rec.kind === "paper") {
      const paper = recordId(rec, String(rec.slug ?? rec.id ?? ""));
      const status = typeof rec.status === "string" ? rec.status : "";
      const current = byPaper.get(paper) ?? { complete: false, declared: false, count: 0 };
      current.complete = status === "complete";
      if (rec.misconceptionLedgerDeclared === true) current.declared = true;
      byPaper.set(paper, current);
    }
    if (rec.kind === "misconception-ledger") {
      const paper = typeof rec.paper === "string" ? rec.paper : "";
      const current = byPaper.get(paper) ?? { complete: false, declared: true, count: 0 };
      current.declared = true;
      current.count += Array.isArray(rec.entries) ? rec.entries.length : 0;
      if (rec.complete === true) current.complete = true;
      byPaper.set(paper, current);
    }
    if (rec.kind === "misconception") {
      const paper = typeof rec.paper === "string" ? rec.paper : "";
      const current = byPaper.get(paper) ?? { complete: false, declared: true, count: 0 };
      current.declared = true;
      current.count += 1;
      byPaper.set(paper, current);
    }
  });
  for (const [paper, info] of byPaper) {
    if ((info.complete || info.declared) && info.count < 5) {
      report(context, {
        rule: "misconception-minimum",
        recordId: paper,
        message: `Paper "${paper}" has a declared or complete misconception ledger with ${info.count} entries; at least five are required.`,
        repair:
          "Author at least five typed misconception entries with instruments, anchors, and sources.",
      });
    }
  }
}

export function runApproximationUnlabeled(context: CheckContext): void {
  eachRecord(context, (id, rec) => {
    const contract = asRecord(rec.authoringContract);
    if (!contract) return;
    const approximations = Array.isArray(contract.approximationsIntroduced)
      ? contract.approximationsIntroduced
      : [];
    const meanings = asRecord(rec.meanings) ?? asRecord(rec.meaning);
    const modelStatus =
      typeof meanings?.modelStatus === "string" ? meanings.modelStatus : undefined;
    if (approximations.length > 0 && modelStatus === "exact-within-model") {
      report(context, {
        rule: "approximation-unlabeled",
        recordId: id,
        message: `Record "${id}" lists an approximation in its authoring contract but presents the equation as exact-within-model.`,
        repair: "Set modelStatus to approximation, or remove the unlabeled exact claim.",
      });
    }
    if (modelStatus === "approximation" && approximations.length === 0) {
      report(context, {
        rule: "approximation-unlabeled",
        recordId: id,
        message: `Record "${id}" presents an approximation without naming it in the authoring contract.`,
        repair: "Name the approximation in authoringContract.approximationsIntroduced.",
      });
    }
  });
}

function collectConstantSets(context: CheckContext): ConstantSetLike[] {
  const sets: ConstantSetLike[] = [];
  eachRecord(context, (id, rec) => {
    if (rec.kind !== "constant-set") return;
    const entries = Array.isArray(rec.entries) ? rec.entries : [];
    sets.push({
      id,
      entries: entries.map((entry) => {
        const e = asRecord(entry);
        return {
          quantityId: String(e?.quantityId ?? ""),
          dependsOn: Array.isArray(e?.dependsOn) ? (e.dependsOn as string[]) : [],
        };
      }),
    });
  });
  return sets;
}

export function runCircularMolecularCount(context: CheckContext): void {
  const sets = collectConstantSets(context);
  eachRecord(context, (id, rec) => {
    if (rec.kind !== "scenario" && rec.kind !== "inference" && rec.kind !== "experiment-mode")
      return;
    const inference: InferenceRecord = {
      id,
      kind: typeof rec.kind === "string" ? rec.kind : undefined,
      historicalMode: rec.historicalMode === true || rec.mode === "historical",
      purpose: typeof rec.purpose === "string" ? rec.purpose : undefined,
      constantSetId: typeof rec.constantSetId === "string" ? rec.constantSetId : undefined,
      outputQuantityId: typeof rec.outputQuantityId === "string" ? rec.outputQuantityId : undefined,
    };
    const hit = circularMolecularCount({ inference, constantSets: sets });
    if (hit === "wrong-output-binding") {
      report(context, {
        rule: "circular-molecular-count",
        recordId: id,
        flaggedText: inference.outputQuantityId,
        message: `Historical inference "${id}" binds output N to avogadroConstant; the unknown must stay avogadroNumberEstimate.`,
        repair: "Bind the inference output to avogadroNumberEstimate.",
      });
    } else if (hit === "modern-constant") {
      report(context, {
        rule: "circular-molecular-count",
        recordId: id,
        flaggedText: inference.constantSetId,
        message: `Historical inference "${id}" resolves k_B or N_A from modern-si-2019, directly or through dependsOn.`,
        repair: "Use a historical constant set whose unknown stays unknown.",
      });
    }
  });
}

export function runCircularRestEnergy(context: CheckContext): void {
  eachRecord(context, (id, rec) => {
    if (rec.kind !== "scenario" && rec.kind !== "energy-ledger") return;
    const init: RestEnergyInit = {
      id,
      historicalMode: rec.historicalMode === true || rec.mode === "historical",
      quantityId: typeof rec.quantityId === "string" ? rec.quantityId : "bodyEnergyRestBefore",
      expr: rec.expr as EnergyExpr | undefined,
      numericFrom: rec.numericFrom as RestEnergyInit["numericFrom"],
    };
    if (circularRestEnergy(init)) {
      report(context, {
        rule: "circular-rest-energy",
        recordId: id,
        message: `Historical mass-energy record "${id}" initializes body energy with Mc^2 or γMc^2. Absolute body energies on the historical route must stay symbolic.`,
        repair: "Leave bodyEnergyRestBefore symbolic on the historical route.",
      });
    }
  });
}

export function runSimulationAsEvidence(context: CheckContext): void {
  eachRecord(context, (id, rec) => {
    if (!isArgumentNodeRecord(rec)) return;
    const role =
      rec.logicalRole ?? asRecord(rec.meanings)?.logicalRole ?? asRecord(rec.meaning)?.logicalRole;
    if (role !== "empirical-observation") return;
    const supportKind = typeof rec.supportKind === "string" ? rec.supportKind : undefined;
    const evidence = Array.isArray(rec.evidence) ? rec.evidence : [];
    const simulatorSupport =
      supportKind === "simulator-output" ||
      supportKind === "experiment-output" ||
      evidence.some((edge) => {
        const e = asRecord(edge);
        const ref = asRecord(e?.ref);
        return ref?.kind === "experiment" || e?.relation === "simulator-output";
      });
    if (simulatorSupport) {
      report(context, {
        rule: "simulation-as-evidence",
        recordId: id,
        message: `Argument node "${id}" has logical role empirical-observation but is supported by a simulator output.`,
        repair:
          "Cite a dataset or observation, or change the logical role. A simulator programmed with a threshold is not proof that nature has one.",
      });
    }
  });
}

export function runFlags(context: CheckContext): void {
  eachRecord(context, (id, rec) => {
    if (
      rec.kind === "translation-unit" &&
      Array.isArray(rec.unresolvedAlternatives) &&
      rec.unresolvedAlternatives.length > 0
    ) {
      const flaggedText = JSON.stringify(rec.unresolvedAlternatives);
      report(context, {
        rule: "translation-ambiguity",
        severity: "flag",
        recordId: id,
        flaggedText,
        fingerprint: computeFlagFingerprint({
          rule: "translation-ambiguity",
          recordId: id,
          flaggedText,
        }),
        message: `Translation unit "${id}" has unresolved alternatives.`,
        repair: "Record the alternatives for human review; do not silently pick one.",
      });
    }
    const influence =
      rec.kind === "historical-premise" ||
      rec.kind === "editorial-note" ||
      rec.kind === "knowledge-card";
    if (
      influence &&
      (rec.claimsEinsteinKnew === true ||
        (rec.kind === "editorial-note" && rec.noteKind === "influence"))
    ) {
      const flaggedText = typeof rec.proposition === "string" ? rec.proposition : id;
      report(context, {
        rule: "historical-influence-claim",
        severity: "flag",
        recordId: id,
        flaggedText,
        fingerprint: computeFlagFingerprint({
          rule: "historical-influence-claim",
          recordId: id,
          flaggedText,
        }),
        message: `Record "${id}" asserts influence or Einstein's knowledge.`,
        repair:
          "Keep the claim flagged for a historian. Date availability is not evidence of knowledge.",
      });
    }
    const contract = asRecord(rec.authoringContract);
    if (
      Array.isArray(contract?.approximationsIntroduced) &&
      contract.approximationsIntroduced.length > 0
    ) {
      const flaggedText = JSON.stringify(contract.approximationsIntroduced);
      report(context, {
        rule: "approximation-prose",
        severity: "flag",
        recordId: id,
        flaggedText,
        fingerprint: computeFlagFingerprint({
          rule: "approximation-prose",
          recordId: id,
          flaggedText,
        }),
        message: `Record "${id}" makes an approximation claim in prose.`,
        repair: "Review that the approximation is named and not restated as exact.",
      });
    }
    if (
      rec.kind === "editorial-note" &&
      (rec.noteKind === "dispute" || rec.noteKind === "source-disagreement")
    ) {
      const flaggedText = typeof rec.claim === "string" ? rec.claim : id;
      report(context, {
        rule: "source-disagreement",
        severity: "flag",
        recordId: id,
        flaggedText,
        fingerprint: computeFlagFingerprint({
          rule: "source-disagreement",
          recordId: id,
          flaggedText,
        }),
        message: `Record "${id}" records a source disagreement.`,
        repair: "Leave the disagreement visible; the compiler does not resolve it.",
      });
    }
  });
}
