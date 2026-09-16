import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Scenario } from "../../content/schemas/experiment.ts";
import {
  type ConstantSet,
  createDeclaredConstantSet,
  getConstantSet,
} from "../../physics/reference/constants.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";
import { parsePrintedNumber } from "../scenario-fixtures/evaluator.ts";
import { compareByKind } from "./compare.ts";
import { checkDatasetInference } from "./datasetInference.ts";
import { compareHypotheses } from "./discrimination.ts";
import { checkEditorialInputs } from "./editorialInputs.ts";
import { guardIllustrativeInputs, historicalDerivedValueFlag } from "./evidentialRoleGuard.ts";
import { checkIdentityIndependence, readOwnerSource } from "./identityRoutes.ts";
import type { LoadedScenario } from "./load.ts";
import { getOwner, ownerSourceMap } from "./owners.ts";

export type ScenarioRunStatus = "passed" | "failed" | "not-available";

export type ScenarioRunResult = Readonly<{
  scenarioId: string;
  kind: string;
  status: ScenarioRunStatus;
  message: string;
  path: string;
  durationMs: number;
  extra: Record<string, unknown>;
}>;

function inputNumbers(scenario: Scenario): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, spec] of Object.entries(scenario.inputs ?? {})) {
    const value = typeof spec.value === "number" ? spec.value : Number(spec.value);
    out[key] = value;
  }
  return out;
}

function resolveSet(id: string): ConstantSet {
  try {
    return getConstantSet(id);
  } catch {
    if (id === "scenario-einstein-1905-brownian-printed") {
      return createDeclaredConstantSet({
        id,
        era: 1905,
        provenance: "Declared editorial R and N for paper 2 arithmetic.",
        precisionNote: "Not a facsimile transcription.",
        gasConstantProvenance: "measured-without-counting-molecules",
        entries: [
          {
            quantityId: "molarGasConstant",
            value: 8.31,
            exactDecimal: "8.31",
            unit: "J/(mol K)",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "Editorial input; paper 2 does not print R.",
            dependsOn: [],
            uncertainty: 0.01,
          },
          {
            quantityId: "avogadroConstant",
            value: 6e23,
            exactDecimal: "6e23",
            unit: "1/mol",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "Paper 2 printed N.",
            dependsOn: [],
            uncertainty: 0.01,
          },
        ],
      });
    }
    if (id === "scenario-self-test-illustrative") {
      return createDeclaredConstantSet({
        id,
        era: 1905,
        provenance: "Self-test set with an illustrative displacement.",
        precisionNote: "Self-test only.",
        gasConstantProvenance: "measured-without-counting-molecules",
        entries: [
          {
            quantityId: "molarGasConstant",
            value: 8.31,
            exactDecimal: "8.31",
            unit: "J/(mol K)",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "Self-test R.",
            dependsOn: [],
            uncertainty: 0.01,
          },
          {
            quantityId: "avogadroConstant",
            value: 6e23,
            exactDecimal: "6e23",
            unit: "1/mol",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "Self-test N.",
            dependsOn: [],
            uncertainty: 0.01,
          },
          {
            quantityId: "rmsDisplacement1d",
            value: 7.947833e-7,
            exactDecimal: "7.947833e-7",
            unit: "m",
            kind: "declared-scenario",
            evidentialRole: "illustrative-computation",
            provenance: "Einstein's printed 0,8 Mikron is an output, never an input.",
            dependsOn: ["temperature", "viscosity", "particleRadius"],
          },
        ],
      });
    }
    if (id === "scenario-self-test-theoretical") {
      return createDeclaredConstantSet({
        id,
        era: 1905,
        provenance: "Self-test theoretical estimate.",
        precisionNote: "Self-test only.",
        gasConstantProvenance: "measured-without-counting-molecules",
        entries: [
          {
            quantityId: "avogadroNumberEstimate",
            value: 6e23,
            exactDecimal: "6e23",
            unit: "1/mol",
            kind: "declared-scenario",
            evidentialRole: "theoretical-estimate",
            provenance: "Self-test derived estimate.",
            dependsOn: ["molarGasConstant"],
          },
        ],
      });
    }
    if (id.startsWith("scenario-")) {
      return createDeclaredConstantSet({
        id,
        era: 1905,
        provenance: "Self-test declared constant set.",
        precisionNote: "Self-test only.",
        gasConstantProvenance: "measured-without-counting-molecules",
        entries: [
          {
            quantityId: "molarGasConstant",
            value: 8.31,
            exactDecimal: "8.31",
            unit: "J/(mol K)",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "Self-test R.",
            dependsOn: [],
            uncertainty: 0.01,
          },
          {
            quantityId: "avogadroConstant",
            value: 6e23,
            exactDecimal: "6e23",
            unit: "1/mol",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "Self-test N.",
            dependsOn: [],
            uncertainty: 0.01,
          },
        ],
      });
    }
    throw new Error(`Constant set ${id} is not registered.`);
  }
}

function writeFailure(
  logRunId: string,
  scenarioId: string,
  payload: Record<string, unknown>,
): string {
  const path = join(
    process.cwd(),
    "artifacts/test-logs/scenarios",
    logRunId,
    "failures",
    `${scenarioId}.json`,
  );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

export function runLoadedScenarios(
  loaded: readonly LoadedScenario[],
  options: { logRunId?: string } = {},
): { results: ScenarioRunResult[]; logRunId: string; failed: number; notAvailable: number } {
  const logRunId = options.logRunId ?? newRunIdentity();
  const logger = new TestLogger("scenarios", logRunId);
  const results: ScenarioRunResult[] = [];
  const sources = ownerSourceMap();
  const sourceTexts: Record<string, string> = {};
  for (const [id, path] of Object.entries(sources)) sourceTexts[id] = readOwnerSource(path);

  for (const item of loaded) {
    const started = Date.now();
    const result = runOne(item, { logRunId, sourceTexts });
    const durationMs = Date.now() - started;
    const row = { ...result, durationMs };
    results.push(row);
    const comparisonKind =
      item.scenario.expected.outputs?.[0]?.comparisonKind === "rounds-to"
        ? "rounds-to"
        : item.scenario.expected.outputs?.[0]?.comparisonKind === "bitwise"
          ? "bitwise"
          : "tolerance";
    const event: Record<string, unknown> = {
      testId: item.scenario.id,
      beadId: "am-ver-scenario-registry-om3",
      outcome: row.status,
      message: row.message,
      durationMs,
      extra: { ...row.extra, comparisonKind },
    };
    if (comparisonKind === "tolerance") {
      event.comparisonKind = "tolerance";
      event.tolerance = item.scenario.expected.outputs?.[0]?.tolerance ?? {
        relative: 1e-12,
        relativeTo: "larger",
      };
    } else if (comparisonKind === "rounds-to" || comparisonKind === "bitwise") {
      event.comparisonKind = comparisonKind;
    }
    logger.log(event);
    if (row.status === "failed") {
      const failurePath = writeFailure(logRunId, item.scenario.id, {
        scenarioId: item.scenario.id,
        path: item.path,
        message: row.message,
        extra: row.extra,
        reproductionCommand: `bun scripts/run-scenarios.ts --id ${item.scenario.id}`,
      });
      row.extra.failurePath = failurePath;
    }
  }
  logger.flushSync();
  return {
    results,
    logRunId,
    failed: results.filter((r) => r.status === "failed").length,
    notAvailable: results.filter((r) => r.status === "not-available").length,
  };
}

function runOne(
  item: LoadedScenario,
  ctx: { logRunId: string; sourceTexts: Record<string, string> },
): Omit<ScenarioRunResult, "durationMs"> {
  const { scenario, path, raw } = item;
  const extra: Record<string, unknown> = {
    scenarioId: scenario.id,
    kind: scenario.kind,
    owner: scenario.owner,
    constantSetId: scenario.constantSetId,
    scenarioKind: scenario.kind,
    reproductionCommand: `bun scripts/run-scenarios.ts --id ${scenario.id}`,
  };
  const base = {
    scenarioId: scenario.id,
    kind: scenario.kind,
    path,
    extra,
  };

  if (scenario.kind === "historical-fixture" && scenario.transcription?.status === "pending") {
    return {
      ...base,
      status: "not-available",
      message: `Transcription pending: ${scenario.transcription.reason}`,
    };
  }

  let set: ConstantSet;
  try {
    set = resolveSet(scenario.constantSetId);
  } catch (err) {
    return { ...base, status: "failed", message: err instanceof Error ? err.message : String(err) };
  }

  const inputIds = Object.keys(scenario.inputs ?? {});
  const editorialIds = (scenario.editorialInputs ?? []).map((e) => e.quantityId);
  const deriveIds = Array.isArray(
    (raw as { deriveScenarioSet?: { quantityId: string }[] }).deriveScenarioSet,
  )
    ? (raw as { deriveScenarioSet: { quantityId: string }[] }).deriveScenarioSet.map(
        (e) => e.quantityId,
      )
    : [];
  const illustrative = guardIllustrativeInputs(
    [...inputIds, ...editorialIds, ...deriveIds],
    set,
    scenario.id,
    "the physical inputs of the fixture (temperature, viscosity, radius)",
  );
  if (illustrative) {
    extra.illustrativeInputRefusals = [illustrative];
    extra.evidentialRoles = set.entries.map((e) => ({
      quantityId: e.quantityId,
      evidentialRole: e.evidentialRole,
    }));
    return { ...base, status: "failed", message: illustrative.message };
  }
  const derivedFlag = historicalDerivedValueFlag(inputIds, set, Boolean(raw.historicalMode));
  if (derivedFlag) extra.historicalInferenceUsesDerivedValue = derivedFlag;

  if (scenario.editorialInputs && scenario.editorialInputs.length > 0) {
    const printed = new Set(
      set.entries
        .filter((e) => e.provenance.toLowerCase().includes("printed n"))
        .map((e) => e.quantityId),
    );
    const checks = checkEditorialInputs(scenario.editorialInputs, set, printed);
    extra.editorialInputCheck = checks.map((c) => c.check);
    extra.editorialInputs = scenario.editorialInputs;
    const mismatch = checks.find(
      (c) => c.check === "value-mismatch" || c.check === "declared-printed",
    );
    if (mismatch) {
      return { ...base, status: "failed", message: mismatch.message };
    }
  }

  if (scenario.datasetId && scenario.inferenceModelId) {
    const datasetPath = String(raw.datasetPath ?? "");
    if (!datasetPath) {
      return {
        ...base,
        status: "failed",
        message: `Scenario ${scenario.id} names dataset ${scenario.datasetId} but no datasetPath was given.`,
      };
    }
    const admitted = checkDatasetInference(
      datasetPath,
      scenario.datasetId,
      scenario.inferenceModelId,
    );
    extra.datasetId = scenario.datasetId;
    extra.inferenceModelId = scenario.inferenceModelId;
    extra.datasetInferenceAdmitted = admitted.ok;
    extra.allowedInferenceModelIds = admitted.allowed;
    if (!admitted.ok) {
      return { ...base, status: "failed", message: admitted.message };
    }
  } else if (scenario.datasetId && !scenario.inferenceModelId) {
    extra.datasetId = scenario.datasetId;
  }

  if (scenario.kind === "identity") {
    const routes = scenario.routes ?? [];
    const independence = checkIdentityIndependence(routes, ctx.sourceTexts);
    extra.identityRoutes = routes;
    extra.identityIndependence = independence.ok;
    if (!independence.ok && independence.missing) {
      return { ...base, status: "not-available", message: independence.message };
    }
    if (!independence.ok) {
      return { ...base, status: "failed", message: independence.message };
    }
    const routeA = routes[0];
    const routeB = routes[1];
    if (!routeA || !routeB) {
      return { ...base, status: "not-available", message: "Identity is missing a route." };
    }
    const first = getOwner(routeA.owner).fn({
      inputs: inputNumbers(scenario),
      constantSetId: scenario.constantSetId,
    });
    const second = getOwner(routeB.owner).fn({
      inputs: inputNumbers(scenario),
      constantSetId: scenario.constantSetId,
    });
    extra.identityRouteResults = [first, second];
    const key = Object.keys(first)[0] ?? "value";
    const spec = scenario.expected.outputs?.[0]?.tolerance ?? {
      relative: 1e-12,
      relativeTo: "larger" as const,
    };
    const compared = compareByKind("tolerance", first[key], second[key], {
      tolerance: {
        ...(spec.absolute !== undefined ? { absolute: spec.absolute } : {}),
        ...(spec.relative !== undefined ? { relative: spec.relative } : {}),
        relativeTo: spec.relativeTo === "larger" ? "larger" : "reference",
      },
    });
    extra.computedDifference = Math.abs((first[key] ?? 0) - (second[key] ?? 0));
    if (!compared.ok) {
      return { ...base, status: "failed", message: `Identity routes disagreed on ${key}.` };
    }
    return { ...base, status: "passed", message: "Identity routes agree." };
  }

  if (scenario.kind === "discrimination") {
    const hyps = scenario.hypotheses ?? [];
    extra.hypothesisIds = hyps.map((h) => h.id);
    extra.ownerFunctions = hyps.map((h) => h.owner);
    const inputs = {
      ...inputNumbers(scenario),
      ...Object.fromEntries(
        Object.entries(scenario.observation?.inputs ?? {}).map(([k, v]) => [
          k,
          typeof v === "number" ? v : Number((v as { value?: number }).value ?? v),
        ]),
      ),
    };
    const values = hyps.map((h) => {
      const out = getOwner(h.owner).fn({ inputs, constantSetId: scenario.constantSetId });
      const key = Object.keys(out)[0] ?? "value";
      return out[key] ?? Number.NaN;
    });
    const specRaw = (raw.tolerance ?? scenario.expected.outputs?.[0]?.tolerance) as
      | { absolute?: number; relative?: number; relativeTo?: string; rationale?: string }
      | undefined;
    if (!specRaw?.rationale) {
      return {
        ...base,
        status: "failed",
        message: "A discrimination tolerance needs a rationale.",
      };
    }
    const compared = compareHypotheses(values[0] ?? Number.NaN, values[1] ?? Number.NaN, {
      ...(specRaw.absolute !== undefined ? { absolute: specRaw.absolute } : {}),
      ...(specRaw.relative !== undefined ? { relative: specRaw.relative } : {}),
      relativeTo: specRaw.relativeTo === "reference" ? "reference" : "larger",
    });
    extra.computedDifference = compared.difference;
    extra.discriminationOutcome = compared.outcome;
    extra.verdictKind = compared.verdictKind;
    extra.observableId = scenario.observation?.observableId;
    if (compared.outcome === "indeterminate") {
      return {
        ...base,
        status: "failed",
        message: "Discrimination difference sits in the tolerance boundary band (indeterminate).",
      };
    }
    if (compared.outcome !== scenario.expected.outcome) {
      return {
        ...base,
        status: "failed",
        message: `Discrimination expected ${scenario.expected.outcome} but computed ${compared.outcome}.`,
      };
    }
    return { ...base, status: "passed", message: `Discrimination outcome ${compared.outcome}.` };
  }

  const outputs = getOwner(scenario.owner).fn({
    inputs: inputNumbers(scenario),
    constantSetId: scenario.constantSetId,
  });
  extra.actual = outputs;
  if (scenario.transcription?.status === "verified-suspected-misprint") {
    extra.transcription = scenario.transcription;
    extra.printedReading = scenario.transcription.printedReading;
  }

  for (const expected of scenario.expected.outputs ?? []) {
    const actual = outputs[expected.outputId];
    extra.quantityId = expected.outputId;
    if (expected.comparisonKind === "rounds-to") {
      const printed = parsePrintedNumber(String(expected.printedValue));
      const compared = compareByKind("rounds-to", actual, printed, {
        printedValue: printed,
        ...(expected.printedPrecision !== undefined
          ? { printedPrecision: expected.printedPrecision }
          : {}),
        ...(expected.roundingConvention !== undefined
          ? { roundingConvention: expected.roundingConvention }
          : {}),
      });
      extra.printedValue = expected.printedValue;
      extra.printedPrecision = expected.printedPrecision;
      extra.roundingIntervalLow = compared.detail.low;
      extra.roundingIntervalHigh = compared.detail.high;
      if (!compared.ok) {
        return {
          ...base,
          status: "failed",
          message: `${expected.outputId} ${actual} is outside the printed interval [${compared.detail.low}, ${compared.detail.high}).`,
        };
      }
      continue;
    }
    if (expected.comparisonKind === "bitwise") {
      const compared = compareByKind("bitwise", actual, expected.value);
      if (!compared.ok) {
        return { ...base, status: "failed", message: `${expected.outputId} bitwise mismatch.` };
      }
      continue;
    }
    const compared = compareByKind("tolerance", actual, expected.value, {
      tolerance: {
        ...(expected.tolerance?.absolute !== undefined
          ? { absolute: expected.tolerance.absolute }
          : {}),
        ...(expected.tolerance?.relative !== undefined
          ? { relative: expected.tolerance.relative }
          : {}),
        relativeTo: expected.tolerance?.relativeTo === "larger" ? "larger" : "reference",
      },
    });
    extra.tolerance = expected.tolerance;
    if (!compared.ok) {
      return {
        ...base,
        status: "failed",
        message: `${expected.outputId} ${actual} is outside tolerance of ${expected.value}.`,
      };
    }
  }

  if (scenario.kind === "adversarial" && scenario.plausibleMistake) {
    extra.plausibleMistake = scenario.plausibleMistake;
    extra.intendedFailure = scenario.intendedFailure;
  }

  return { ...base, status: "passed", message: "Scenario passed." };
}
