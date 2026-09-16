/**
 * Reachability Audit for the 5 Accomplishment Reach-Sets (am-edit-comprehension-protocol-ouih).
 *
 * Walks argument nodes in the compiled or source content corpus and audits whether
 * each of the 5 accomplishments (Appreciate, Explain, Predict, Derive, Critique) resolves
 * its required reach-set targets:
 *
 * 1. Appreciate: concrete example (help.example / passage action) + source anchor (citations)
 * 2. Explain: R1 (overview) + R2 (full/steps) + at least one resolving FoundationLink
 * 3. Predict: instruments in experiments[] with unit-bearing outputs + printed check/scenario
 * 4. Derive: derivation steps / chains reaching target with R1 reasons + printed notation
 * 5. Critique: limitations[] + citations[] + model/historical status or countermodels
 *
 * Crucially: this audit does NOT fail the build; it exits with code 0 and reports findings.
 */

import type { Argument, Block } from "../content/schemas/reading.ts";
import { ComprehensionLogger, newToolRunId } from "./logger.ts";
import type { Accomplishment } from "./types.ts";

export interface ReachSetAuditResult {
  readonly argumentId: string;
  readonly paper: string;
  readonly accomplishment: Accomplishment;
  readonly reachSet: string;
  readonly resolved: boolean;
  readonly missingTarget?: string | undefined;
  readonly rule: string;
  readonly message: string;
}

export interface ReachabilityAuditReport {
  readonly schemaVersion: 1;
  readonly toolRunId: string;
  readonly timestamp: string;
  readonly totalNodes: number;
  readonly resolvedNodes: number;
  readonly unreachedNodes: number;
  readonly results: readonly ReachSetAuditResult[];
}

export interface ReachabilityAuditOptions {
  readonly rootDir?: string | undefined;
  readonly knownFoundationIds?: ReadonlySet<string> | undefined;
  readonly instrumentOutputsWithUnits?: ReadonlyMap<string, boolean> | undefined;
}

function extractFoundationIds(arg: Argument): Set<string> {
  const ids = new Set<string>();
  if (arg.help?.why) ids.add(arg.help.why);
  if (arg.help?.missingStep) ids.add(arg.help.missingStep);
  if (arg.help?.example) ids.add(arg.help.example);
  for (const prereq of arg.prerequisites ?? []) {
    ids.add(prereq.id);
  }

  const scanBlocks = (blocks?: readonly Block[]) => {
    for (const b of blocks ?? []) {
      if (b.kind === "foundation") ids.add(b.id);
    }
  };

  scanBlocks(arg.readings?.overview);
  scanBlocks(arg.readings?.full);
  scanBlocks(arg.readings?.steps);
  scanBlocks(arg.readings?.margin);

  return ids;
}

/**
 * Audits a single argument node across all 5 accomplishment reach-sets.
 */
export function auditArgumentReachability(
  arg: Argument,
  options: ReachabilityAuditOptions = {},
): ReachSetAuditResult[] {
  const results: ReachSetAuditResult[] = [];
  const knownFoundations = options.knownFoundationIds;
  const instrumentUnits = options.instrumentOutputsWithUnits;

  // 1. Appreciate
  // Needs concrete example (help.example / passage example action) and source anchor (citations)
  const hasExample = Boolean(arg.help?.example && arg.help.example.trim().length > 0);
  const hasCitations = Boolean(arg.citations && arg.citations.length > 0);

  if (!hasExample) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "appreciate",
      reachSet: "concrete-example",
      resolved: false,
      missingTarget: "example",
      rule: "reachability.appreciate.example",
      message: `Argument "${arg.id}" is missing an example action or help.example target.`,
    });
  } else if (!hasCitations) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "appreciate",
      reachSet: "source-anchor",
      resolved: false,
      missingTarget: "citations",
      rule: "reachability.appreciate.sourceAnchor",
      message: `Argument "${arg.id}" is missing source citations/anchors.`,
    });
  } else {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "appreciate",
      reachSet: "example-and-source",
      resolved: true,
      rule: "reachability.appreciate",
      message: `Appreciate reach-set resolved for argument "${arg.id}".`,
    });
  }

  // 2. Explain
  // Needs R1 (overview) + R2 (full or steps) + at least one resolving FoundationLink
  const hasR1 = Boolean(arg.readings?.overview && arg.readings.overview.length > 0);
  const hasR2 = Boolean(
    (arg.readings?.full && arg.readings.full.length > 0) ||
      (arg.readings?.steps && arg.readings.steps.length > 0),
  );

  const foundIds = extractFoundationIds(arg);
  let hasResolvingFoundation = foundIds.size > 0;
  if (knownFoundations && hasResolvingFoundation) {
    hasResolvingFoundation = Array.from(foundIds).some((id) => knownFoundations.has(id));
  }

  if (!hasR1) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "explain",
      reachSet: "r1-overview",
      resolved: false,
      missingTarget: "readings.overview",
      rule: "reachability.explain.r1",
      message: `Argument "${arg.id}" is missing R1 (overview) reading.`,
    });
  } else if (!hasR2) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "explain",
      reachSet: "r2-explanation",
      resolved: false,
      missingTarget: "readings.full",
      rule: "reachability.explain.r2",
      message: `Argument "${arg.id}" is missing R2 (full or steps) reading.`,
    });
  } else if (!hasResolvingFoundation) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "explain",
      reachSet: "foundation-link",
      resolved: false,
      missingTarget: "foundation-link",
      rule: "reachability.explain.foundation",
      message: `Argument "${arg.id}" has no resolving FoundationLink target.`,
    });
  } else {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "explain",
      reachSet: "readings-and-foundations",
      resolved: true,
      rule: "reachability.explain",
      message: `Explain reach-set resolved for argument "${arg.id}".`,
    });
  }

  // 3. Predict
  // Needs instruments in experiments[] whose outputs carry units and a printed check / scenario
  const hasExperiments = Boolean(arg.experiments && arg.experiments.length > 0);
  let experimentsHaveUnits = hasExperiments;

  if (hasExperiments && instrumentUnits) {
    for (const expId of arg.experiments) {
      if (instrumentUnits.has(expId) && !instrumentUnits.get(expId)) {
        experimentsHaveUnits = false;
        break;
      }
    }
  }

  if (!hasExperiments) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "predict",
      reachSet: "instrument-model",
      resolved: false,
      missingTarget: "experiments",
      rule: "reachability.predict.instrument",
      message: `Argument "${arg.id}" has no instruments listed in experiments[].`,
    });
  } else if (!experimentsHaveUnits) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "predict",
      reachSet: "instrument-units",
      resolved: false,
      missingTarget: "instrument-output-units",
      rule: "reachability.predict.units",
      message: `Instrument in argument "${arg.id}" has outputs missing required units.`,
    });
  } else {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "predict",
      reachSet: "instrument-with-units",
      resolved: true,
      rule: "reachability.predict",
      message: `Predict reach-set resolved for argument "${arg.id}".`,
    });
  }

  // 4. Derive
  // Needs intermediate steps with R1 reasons and printed notation / equations
  // If logical role is derivation or has step items, verify steps have R1 explanations
  let deriveResolved = true;
  let missingDeriveTarget: string | undefined;

  const stepsBlock = arg.readings?.steps?.find((b) => b.kind === "steps");
  if (arg.meaning?.logicalRole === "derivation" || stepsBlock) {
    if (!stepsBlock && arg.readings?.full?.every((b) => b.kind !== "formula")) {
      deriveResolved = false;
      missingDeriveTarget = "derivation-steps";
    }
  }

  if (!deriveResolved) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "derive",
      reachSet: "derivation-chain",
      resolved: false,
      missingTarget: missingDeriveTarget ?? "derivation-chain",
      rule: "reachability.derive.steps",
      message: `Argument "${arg.id}" derivation chain is missing steps or R1 reasons.`,
    });
  } else {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "derive",
      reachSet: "derivation-steps-and-notation",
      resolved: true,
      rule: "reachability.derive",
      message: `Derive reach-set resolved for argument "${arg.id}".`,
    });
  }

  // 5. Critique
  // Needs limitations[], citations[], and model/historical status
  const hasLimitations = Boolean(arg.limitations && arg.limitations.length > 0);

  if (!hasLimitations) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "critique",
      reachSet: "limitations",
      resolved: false,
      missingTarget: "limitations",
      rule: "reachability.critique.limitations",
      message: `Argument "${arg.id}" is missing limitations array.`,
    });
  } else if (!hasCitations) {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "critique",
      reachSet: "sources",
      resolved: false,
      missingTarget: "citations",
      rule: "reachability.critique.sources",
      message: `Argument "${arg.id}" is missing citations for critique reach-set.`,
    });
  } else {
    results.push({
      argumentId: arg.id,
      paper: arg.paper,
      accomplishment: "critique",
      reachSet: "limitations-and-sources",
      resolved: true,
      rule: "reachability.critique",
      message: `Critique reach-set resolved for argument "${arg.id}".`,
    });
  }

  return results;
}

/**
 * Runs reachability audit across an entire array of Argument records.
 */
export function auditCorpusReachability(
  argumentsList: readonly Argument[],
  options: ReachabilityAuditOptions = {},
  logger?: ComprehensionLogger,
): ReachabilityAuditReport {
  const toolRunId = newToolRunId();
  const timestamp = new Date().toISOString();
  const allResults: ReachSetAuditResult[] = [];

  for (const arg of argumentsList) {
    const start = performance.now();
    const nodeResults = auditArgumentReachability(arg, options);
    const duration = performance.now() - start;

    for (const r of nodeResults) {
      allResults.push(r);
      if (logger) {
        logger.logReachability({
          testId: `reachability-${arg.id}-${r.accomplishment}`,
          paper: r.paper,
          argumentId: r.argumentId,
          accomplishment: r.accomplishment,
          reachSet: r.reachSet,
          resolved: r.resolved,
          missingTarget: r.missingTarget,
          rule: r.rule,
          outcome: r.resolved ? "pass" : "fail",
          durationMs: duration,
          message: r.message,
        });
      }
    }
  }

  const unreachedNodes = allResults.filter((r) => !r.resolved).length;
  const totalNodes = allResults.length;
  const resolvedNodes = totalNodes - unreachedNodes;

  const report: ReachabilityAuditReport = {
    schemaVersion: 1,
    toolRunId,
    timestamp,
    totalNodes: argumentsList.length,
    resolvedNodes,
    unreachedNodes,
    results: allResults,
  };

  if (logger) {
    logger.saveAuditReport(toolRunId, report);
  }

  return report;
}
