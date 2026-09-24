/**
 * Canonical schemas and validators for Experiment manifests, Scenarios,
 * HistoricalDatasets, Tours, and ConstantSets.
 *
 * Specification: AGENTS.md, am-cm-schemas-experiment-fuu, am-inst-parameter-controls-cmj9,
 * am-ver-scenario-registry-om3, am-inst-dataset-overlay-ra9r, am-tours-infra-g518,
 * am-ref-constants-xik, am-rt-u64-identities-7ce.
 */

import { validateToleranceSpec } from "../../units/tolerance.ts";
import {
  type InstrumentId,
  parseInstrumentId,
  parseModeId,
  parsePredictPromptId,
  parsePresetId,
} from "../ids.ts";
import type { SourceAssetRights } from "../provenance/receiptToSourceAsset.ts";
import { type PaperDate, validatePaperDate } from "./dates.ts";
import type { Citation } from "./source.ts";
import { validateU64String } from "./u64String.ts";

export class ExperimentValidationError extends Error {
  readonly code: string;
  readonly entity: string;
  readonly path: string;

  constructor(code: string, message: string, entity = "ExperimentSchema", path = "root") {
    super(`[${entity}] ${path}: ${message} (${code})`);
    this.name = "ExperimentValidationError";
    this.code = code;
    this.entity = entity;
    this.path = path;
  }
}

export const EXPERIMENT_SCHEMA_VERSION = 1;

// ============================================================================
// 1. EXPERIMENT MANIFEST
// ============================================================================

export type ParameterMapping =
  | Readonly<{ kind: "linear" }>
  | Readonly<{ kind: "log"; base?: number | undefined }>
  | Readonly<{ kind: "step"; size: number }>
  | Readonly<{ kind: "step"; gridParameterId: string }>;

export type ModelDomain = Readonly<{
  min?: number | undefined;
  max?: number | undefined;
  minInclusive?: boolean | undefined;
  maxInclusive?: boolean | undefined;
  enumerated?: readonly number[] | undefined;
  reason?: string | undefined;
}>;

export type NumericalDomain = Readonly<{
  min?: number | undefined;
  max?: number | undefined;
  minInclusive?: boolean | undefined;
  maxInclusive?: boolean | undefined;
}>;

export type VisualRange = Readonly<{
  min: number;
  max: number;
}>;

export const COMMAND_CLASSES = [
  "setup-change",
  "physical-intervention",
  "observer-change",
  "measurement-change",
  "estimator-change",
  "presentation-change",
] as const;
export type CommandClass = (typeof COMMAND_CLASSES)[number];

export type ParameterSpec = Readonly<{
  id: string;
  label: string;
  accessibleName: string;
  accessibleDescription: string;
  quantityId: string;
  displayUnit: string;
  modelDomain: ModelDomain;
  numericalDomain?: NumericalDomain | undefined;
  visualRange: VisualRange;
  default: number | string;
  mapping: ParameterMapping;
  step?: number | undefined;
  role: "independent" | "derived";
  derivedFrom?: readonly string[] | undefined;
  commandClass: CommandClass;
}>;

export const OUTPUT_STATUSES = [
  "value",
  "symbolic",
  "analytic-limit",
  "underdetermined",
  "not-applicable",
  "outside-domain",
] as const;
export type OutputStatus = (typeof OUTPUT_STATUSES)[number];

export type OutputSpec = Readonly<{
  id: string;
  quantityId: string;
  allowedStatuses: readonly OutputStatus[];
  primary: boolean;
}>;

export const KERNEL_DISPLAY_ROLES = [
  "executing-source",
  "reference-implementation",
  "pseudocode",
  "derivation",
] as const;
export type KernelDisplayRole = (typeof KERNEL_DISPLAY_ROLES)[number];

export type KernelFunctionRef = Readonly<{
  displayRole: KernelDisplayRole;
  language?: "ts" | "rust" | undefined;
  module?: string | undefined;
  exportName?: string | undefined;
  crate?: string | undefined;
  path?: string | undefined;
  fnName?: string | undefined;
  revision?: string | undefined;
  independentReferences?:
    | readonly Readonly<{ experimentId: string; quantityId: string }>[]
    | undefined;
}>;

export type IdentifierBinding = Readonly<{
  kernelFunction: string;
  identifier: string;
  quantityId: string;
  termIds?: readonly string[] | undefined;
}>;

export type TraceRow = Readonly<{
  label: string;
  expression: string;
  value: number | string;
  unit: string;
  quantityId?: string | undefined;
  opId?: string | undefined;
}>;

export type ExperimentOwner = Readonly<{
  kind: "reference-evaluator" | "frankensim" | "static";
  capabilityId?: string | undefined;
  staticReason?: string | undefined;
  kernelFunctions?: readonly KernelFunctionRef[] | undefined;
  identifierBindings?: readonly IdentifierBinding[] | undefined;
  traceScenarioId?: string | undefined;
  traceRows?: readonly TraceRow[] | undefined;
}>;

export const VIEW_KINDS = ["svg", "canvas", "three", "table", "text"] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

export const RENDERING_CAPABILITIES = ["webgl", "canvas-2d"] as const;
export type RenderingCapability = (typeof RENDERING_CAPABILITIES)[number];

export type ViewSpec = Readonly<{
  id: string;
  kind: ViewKind;
  consumes: readonly string[];
  requires?: readonly RenderingCapability[] | undefined;
  spatialJustification?: string | undefined;
}>;

export const ACTION_FAMILIES = [
  "interval",
  "event-table",
  "ratio",
  "axis-component",
  "object-inclusion",
  "subexpression",
  "probability-diffusion",
  "probability",
  "clock-event",
  "radiation-entropy",
  "radiation-energy-accounting",
  "fields-boosts",
  "kinematics",
  "relativistic-dynamics",
  "energy-accounting",
  "derivations",
  "premises",
  "wave-optics",
  "observer",
  "geometry",
  "measurement",
] as const;
export type ActionFamily = (typeof ACTION_FAMILIES)[number];

export type ActionContract = Readonly<{
  actionId: string;
  family: ActionFamily;
  question: string;
  inputs: readonly string[];
  commandClass: CommandClass;
  acceptedResult: Readonly<{
    outputs: readonly string[];
    allowedStatuses: readonly string[];
  }>;
  visualAffordance: string;
  equivalentAffordance: string;
  announcement: string;
  modalities?: readonly ActionModality[] | undefined;
}>;

export const VALID_ACTION_MODALITIES = [
  "keyboard",
  "direct-entry",
  "screen-reader",
  "switch-control",
] as const;
export type ActionModality = (typeof VALID_ACTION_MODALITIES)[number];

export const VALID_ACTION_STATUSES = [
  "value",
  "outside-domain",
  "not-applicable",
  "underdetermined",
  "uncomputable",
  "provisional",
  "refused",
  "divergent",
  "analytic-limit",
  "symbolic",
] as const;
export type ValidActionStatus = (typeof VALID_ACTION_STATUSES)[number];

const DRAG_GESTURE_PATTERN =
  /\b(drag|dragging|draggable|swipe|mouse|pointer|canvas|draw|scrub|slider-only)\b/i;

const ACCESSIBLE_MODALITY_PATTERN =
  /\b(type|enter|select|choose|toggle|read|inspect|compare|adjust|advance|retreat|set|switch|press|navigate|button|radio|checkbox|table|direct entry|keyboard|stepper|input)\b/i;

export function checkAccessibleEquivalence(
  contract: Readonly<{
    actionId: string;
    visualAffordance: string;
    equivalentAffordance: string;
    announcement: string;
  }>,
  path = "ActionContract",
): void {
  const vis = contract.visualAffordance?.trim() || "";
  const eq = contract.equivalentAffordance?.trim() || "";
  const ann = contract.announcement?.trim() || "";

  if (!vis) {
    throw new ExperimentValidationError(
      "missing-visual-affordance",
      `Action "${contract.actionId}" must declare visualAffordance.`,
      "Experiment",
      `${path}.visualAffordance`,
    );
  }

  if (!eq) {
    throw new ExperimentValidationError(
      "missing-equivalent-affordance",
      `Action "${contract.actionId}" must declare an accessible equivalentAffordance.`,
      "Experiment",
      `${path}.equivalentAffordance`,
    );
  }

  if (!ann) {
    throw new ExperimentValidationError(
      "missing-action-announcement",
      `Action "${contract.actionId}" must declare an assistive announcement for live regions.`,
      "Experiment",
      `${path}.announcement`,
    );
  }

  // Planted Negative: Drag-only action where equivalent merely repeats visual drag or requires drag
  const isVisualDrag = DRAG_GESTURE_PATTERN.test(vis);
  const isEquivalentDrag = DRAG_GESTURE_PATTERN.test(eq);

  if (isEquivalentDrag && !ACCESSIBLE_MODALITY_PATTERN.test(eq.replace(DRAG_GESTURE_PATTERN, ""))) {
    throw new ExperimentValidationError(
      "drag-only-action-forbidden",
      `Action "${contract.actionId}" declares equivalentAffordance that requires drag or mouse interaction without a non-drag alternative.`,
      "Experiment",
      `${path}.equivalentAffordance`,
    );
  }

  if (isVisualDrag && vis.toLowerCase() === eq.toLowerCase()) {
    throw new ExperimentValidationError(
      "drag-only-action-forbidden",
      `Action "${contract.actionId}" has identical visual and equivalent affordances requiring drag.`,
      "Experiment",
      `${path}.equivalentAffordance`,
    );
  }

  // Ensure equivalent affordance provides an actionable modality
  if (!ACCESSIBLE_MODALITY_PATTERN.test(eq)) {
    throw new ExperimentValidationError(
      "action-equivalent-insufficient",
      `Action "${contract.actionId}" equivalentAffordance must specify an actionable non-visual modality (e.g. type, enter, select, toggle, read, compare, inspect).`,
      "Experiment",
      `${path}.equivalentAffordance`,
    );
  }
}

export function validateActionContract(
  raw: unknown,
  path = "ActionContract",
  _declaredParameterIds?: Set<string>,
  _declaredOutputIds?: Set<string>,
): ActionContract {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-action-contract",
      "Action contract must be an object.",
      "Experiment",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  // actionId
  if (typeof o.actionId !== "string" || !o.actionId.trim()) {
    throw new ExperimentValidationError(
      "missing-action-id",
      "actionId is required.",
      "Experiment",
      `${path}.actionId`,
    );
  }
  const actionId = o.actionId.trim();
  if (!/^[a-z0-9-]+$/.test(actionId)) {
    throw new ExperimentValidationError(
      "invalid-action-id",
      `actionId "${actionId}" must be kebab-case (lowercase alphanumeric with hyphens).`,
      "Experiment",
      `${path}.actionId`,
    );
  }

  // family
  if (typeof o.family !== "string" || !(ACTION_FAMILIES as readonly string[]).includes(o.family)) {
    throw new ExperimentValidationError(
      "invalid-action-family",
      `family "${String(o.family)}" must be one of: ${ACTION_FAMILIES.join(", ")}.`,
      "Experiment",
      `${path}.family`,
    );
  }
  const family = o.family as ActionFamily;

  // question
  if (typeof o.question !== "string" || !o.question.trim() || o.question.trim().length < 5) {
    throw new ExperimentValidationError(
      "missing-action-question",
      `Action "${actionId}" requires a non-empty question.`,
      "Experiment",
      `${path}.question`,
    );
  }
  const question = o.question.trim();

  // inputs
  if (!Array.isArray(o.inputs)) {
    throw new ExperimentValidationError(
      "missing-action-inputs",
      `Action "${actionId}" inputs must be an array of parameter IDs.`,
      "Experiment",
      `${path}.inputs`,
    );
  }
  const inputs: string[] = [];
  for (let i = 0; i < o.inputs.length; i++) {
    const inp = o.inputs[i];
    if (typeof inp !== "string" || !inp.trim()) {
      throw new ExperimentValidationError(
        "invalid-action-input",
        `Action "${actionId}" input at index ${i} must be a non-empty string.`,
        "Experiment",
        `${path}.inputs[${i}]`,
      );
    }
    inputs.push(inp.trim());
  }

  // commandClass
  if (typeof o.commandClass !== "string" || !o.commandClass.trim()) {
    throw new ExperimentValidationError(
      "missing-action-command-class",
      `Action "${actionId}" requires commandClass.`,
      "Experiment",
      `${path}.commandClass`,
    );
  }
  const commandClass = o.commandClass.trim() as CommandClass;
  if (!(COMMAND_CLASSES as readonly string[]).includes(commandClass)) {
    throw new ExperimentValidationError(
      "invalid-action-command-class",
      `Action "${actionId}" commandClass "${commandClass}" must be one of: ${COMMAND_CLASSES.join(", ")}.`,
      "Experiment",
      `${path}.commandClass`,
    );
  }

  // acceptedResult
  if (!o.acceptedResult || typeof o.acceptedResult !== "object") {
    throw new ExperimentValidationError(
      "invalid-accepted-result",
      `Action "${actionId}" acceptedResult must be an object declaring outputs and allowedStatuses.`,
      "Experiment",
      `${path}.acceptedResult`,
    );
  }
  const ar = o.acceptedResult as Record<string, unknown>;
  if (!Array.isArray(ar.outputs)) {
    throw new ExperimentValidationError(
      "invalid-accepted-result",
      `Action "${actionId}" acceptedResult.outputs must be an array.`,
      "Experiment",
      `${path}.acceptedResult.outputs`,
    );
  }
  const outputs: string[] = ar.outputs.map((out) => String(out).trim());

  if (!Array.isArray(ar.allowedStatuses) || ar.allowedStatuses.length === 0) {
    throw new ExperimentValidationError(
      "invalid-accepted-result",
      `Action "${actionId}" acceptedResult.allowedStatuses must be a non-empty array.`,
      "Experiment",
      `${path}.acceptedResult.allowedStatuses`,
    );
  }
  const allowedStatuses: string[] = [];
  for (let i = 0; i < ar.allowedStatuses.length; i++) {
    const st = String(ar.allowedStatuses[i]).trim();
    if (!(VALID_ACTION_STATUSES as readonly string[]).includes(st)) {
      throw new ExperimentValidationError(
        "invalid-accepted-result-status",
        `Action "${actionId}" allowedStatus "${st}" must be one of: ${VALID_ACTION_STATUSES.join(", ")}.`,
        "Experiment",
        `${path}.acceptedResult.allowedStatuses[${i}]`,
      );
    }
    allowedStatuses.push(st);
  }

  // visualAffordance & equivalentAffordance & announcement
  const visualAffordance = typeof o.visualAffordance === "string" ? o.visualAffordance.trim() : "";
  const equivalentAffordance =
    typeof o.equivalentAffordance === "string" ? o.equivalentAffordance.trim() : "";
  const announcement = typeof o.announcement === "string" ? o.announcement.trim() : "";

  checkAccessibleEquivalence(
    {
      actionId,
      visualAffordance,
      equivalentAffordance,
      announcement,
    },
    path,
  );

  return Object.freeze({
    actionId,
    family,
    question,
    inputs: Object.freeze(inputs),
    commandClass,
    acceptedResult: Object.freeze({
      outputs: Object.freeze(outputs),
      allowedStatuses: Object.freeze(allowedStatuses),
    }),
    visualAffordance,
    equivalentAffordance,
    announcement,
    modalities: Array.isArray(o.modalities)
      ? Object.freeze(
          o.modalities.filter(
            (m): m is ActionModality =>
              typeof m === "string" && (VALID_ACTION_MODALITIES as readonly string[]).includes(m),
          ),
        )
      : undefined,
  });
}

export function validateActionContracts(
  rawActions: unknown,
  path = "Experiment.actions",
  declaredParameterIds?: Set<string>,
  declaredOutputIds?: Set<string>,
): readonly ActionContract[] {
  if (!Array.isArray(rawActions)) return Object.freeze([]);
  const seenIds = new Set<string>();
  const validated: ActionContract[] = [];

  for (let i = 0; i < rawActions.length; i++) {
    const aPath = `${path}[${i}]`;
    const contract = validateActionContract(
      rawActions[i],
      aPath,
      declaredParameterIds,
      declaredOutputIds,
    );
    if (seenIds.has(contract.actionId)) {
      throw new ExperimentValidationError(
        "duplicate-action-id",
        `Duplicate actionId "${contract.actionId}" found in actions list.`,
        "Experiment",
        `${aPath}.actionId`,
      );
    }
    seenIds.add(contract.actionId);
    validated.push(contract);
  }

  return Object.freeze(validated);
}

export type RealRate =
  | Readonly<{ natural: false }>
  | Readonly<{
      natural: true;
      quantity: string;
      scaleBar: Readonly<{ length: number; unit: string }>;
    }>;

export type PredictCandidate = Readonly<{
  id: string;
  label: string;
  description: string;
  separatingAssumption: string;
  curve?: string | undefined;
  relation?: string | undefined;
}>;

export type PredictPromptFields = Readonly<{
  promptId: string;
  controlId?: string | undefined;
  actionId?: string | undefined;
  question: string;
  candidates: readonly PredictCandidate[];
  sketchAxes?: Readonly<{ x: string; y: string }> | undefined;
  verbalChoices?: readonly string[] | undefined;
  valueTargets?: readonly number[] | undefined;
}>;

export type PredictMode =
  | Readonly<{ exempt: true; reason: string }>
  | Readonly<{ enabled: true; prompts: readonly PredictPrompt[] }>;

export const HISTORICAL_STATUSES = [
  "original-1905",
  "contemporary-alternative",
  "historical-precursor",
  "later-development",
] as const;
export type HistoricalStatus = (typeof HISTORICAL_STATUSES)[number];

export type ExperimentMode = Readonly<{
  id: string;
  label: string;
  historicalStatus: HistoricalStatus;
  lensLabel?: string | undefined;
  notModeledAdditions?: readonly string[] | undefined;
  parameterOverrides?: Record<string, unknown> | undefined;
  outputOverrides?: Record<string, unknown> | undefined;
  ownerOverride?: ExperimentOwner | undefined;
}>;

export type PresetEntry = Readonly<{
  presetId: string;
  label: string;
  parameterValues: Record<string, number | string>;
  scenarioId?: string | undefined;
}>;

export type Experiment = Readonly<{
  id: InstrumentId;
  title: string;
  explanatoryQuestion: string;
  sourceRefs: readonly Readonly<{ paper: string; id: string }>[];
  argumentIds: readonly string[];
  schemaVersion: number;
  parameters: readonly ParameterSpec[];
  outputs: readonly OutputSpec[];
  assumptions: readonly string[];
  admittedDomain: string;
  notModeled: readonly string[];
  owner: ExperimentOwner;
  views: readonly ViewSpec[];
  actions: readonly ActionContract[];
  acceptanceCases: readonly string[];
  defaultScenario: string;
  tapeModel: Readonly<{ modelId: string; modelVersion: number }>;
  teachingTapes: readonly Readonly<{ tapeId: string; title: string }>[];
  presets: readonly PresetEntry[];
  probes: readonly string[];
  weavePredicates: readonly string[];
  historicalOverlays: readonly string[];
  realRate: RealRate;
  embeddable: boolean;
  predictMode: PredictMode;
  modes?: readonly ExperimentMode[] | undefined;
  provenance?: unknown | undefined;
}>;

export function validateExperiment(raw: unknown, path = "Experiment"): Experiment {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "Experiment must be an object.",
      "Experiment",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  // Identity
  if (typeof o.id !== "string") {
    throw new ExperimentValidationError(
      "missing-id",
      "Experiment id is required.",
      "Experiment",
      `${path}.id`,
    );
  }
  const instParsed = parseInstrumentId(o.id);
  if (!instParsed.ok) {
    throw new ExperimentValidationError(
      "invalid-instrument-id",
      instParsed.error,
      "Experiment",
      `${path}.id`,
    );
  }
  const instrumentId = instParsed.value;

  if (typeof o.title !== "string" || !o.title.trim()) {
    throw new ExperimentValidationError(
      "missing-title",
      "Experiment title is required.",
      "Experiment",
      `${path}.title`,
    );
  }
  if (typeof o.explanatoryQuestion !== "string" || !o.explanatoryQuestion.trim()) {
    throw new ExperimentValidationError(
      "missing-question",
      "explanatoryQuestion is required.",
      "Experiment",
      `${path}.explanatoryQuestion`,
    );
  }
  if (!Array.isArray(o.sourceRefs)) {
    throw new ExperimentValidationError(
      "missing-source-refs",
      "sourceRefs must be an array.",
      "Experiment",
      `${path}.sourceRefs`,
    );
  }
  if (!Array.isArray(o.argumentIds)) {
    throw new ExperimentValidationError(
      "missing-argument-ids",
      "argumentIds must be an array.",
      "Experiment",
      `${path}.argumentIds`,
    );
  }
  if (typeof o.schemaVersion !== "number" || o.schemaVersion <= 0) {
    throw new ExperimentValidationError(
      "invalid-schema-version",
      "schemaVersion must be a positive number.",
      "Experiment",
      `${path}.schemaVersion`,
    );
  }

  // Parameters
  if (!Array.isArray(o.parameters) || o.parameters.length === 0) {
    throw new ExperimentValidationError(
      "missing-parameters",
      "parameters must be a non-empty array.",
      "Experiment",
      `${path}.parameters`,
    );
  }
  const paramMap = new Map<string, ParameterSpec>();
  const parameters: ParameterSpec[] = [];

  for (let i = 0; i < o.parameters.length; i++) {
    const pRaw = o.parameters[i];
    const pPath = `${path}.parameters[${i}]`;
    if (!pRaw || typeof pRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-parameter",
        "Parameter must be an object.",
        "Experiment",
        pPath,
      );
    }
    const p = pRaw as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id.trim()) {
      throw new ExperimentValidationError(
        "missing-param-id",
        "Parameter id is required.",
        "Experiment",
        `${pPath}.id`,
      );
    }
    if (typeof p.quantityId !== "string" || !p.quantityId.trim()) {
      throw new ExperimentValidationError(
        "missing-param-quantity-id",
        "Parameter quantityId is required.",
        "Experiment",
        `${pPath}.quantityId`,
      );
    }
    if (!p.modelDomain || typeof p.modelDomain !== "object") {
      throw new ExperimentValidationError(
        "missing-model-domain",
        "Parameter modelDomain is required.",
        "Experiment",
        `${pPath}.modelDomain`,
      );
    }
    if (!p.visualRange || typeof p.visualRange !== "object") {
      throw new ExperimentValidationError(
        "missing-visual-range",
        "Parameter visualRange is required.",
        "Experiment",
        `${pPath}.visualRange`,
      );
    }
    if (!p.mapping || typeof p.mapping !== "object") {
      throw new ExperimentValidationError(
        "missing-param-mapping",
        "Parameter mapping is required.",
        "Experiment",
        `${pPath}.mapping`,
      );
    }
    const mapping = p.mapping as Record<string, unknown>;
    if (!["linear", "log", "step"].includes(mapping.kind as string)) {
      throw new ExperimentValidationError(
        "invalid-param-mapping-kind",
        `Invalid mapping kind "${mapping.kind}".`,
        "Experiment",
        `${pPath}.mapping.kind`,
      );
    }
    if (!COMMAND_CLASSES.includes(p.commandClass as CommandClass)) {
      throw new ExperimentValidationError(
        "invalid-command-class",
        `Invalid commandClass "${p.commandClass}".`,
        "Experiment",
        `${pPath}.commandClass`,
      );
    }

    const param: ParameterSpec = {
      id: p.id,
      label: (p.label as string) || p.id,
      accessibleName: (p.accessibleName as string) || (p.label as string) || p.id,
      accessibleDescription: (p.accessibleDescription as string) || "",
      quantityId: p.quantityId,
      displayUnit: (p.displayUnit as string) || "",
      modelDomain: p.modelDomain as ModelDomain,
      numericalDomain: (p.numericalDomain as NumericalDomain) || undefined,
      visualRange: p.visualRange as VisualRange,
      default: p.default as number | string,
      mapping: p.mapping as ParameterMapping,
      step: typeof p.step === "number" ? p.step : undefined,
      role: p.role === "derived" ? "derived" : "independent",
      derivedFrom: Array.isArray(p.derivedFrom) ? (p.derivedFrom as string[]) : undefined,
      commandClass: p.commandClass as CommandClass,
    };
    parameters.push(param);
    paramMap.set(param.id, param);
  }

  // Check gridParameterId references
  for (const param of parameters) {
    if (
      param.mapping.kind === "step" &&
      "gridParameterId" in param.mapping &&
      param.mapping.gridParameterId
    ) {
      const targetId = param.mapping.gridParameterId;
      const target = paramMap.get(targetId);
      if (!target) {
        throw new ExperimentValidationError(
          "missing-grid-parameter",
          `Parameter "${param.id}" references non-existent gridParameterId "${targetId}".`,
          "Experiment",
          `${path}.parameters.${param.id}.mapping`,
        );
      }
      if (target.quantityId !== param.quantityId) {
        throw new ExperimentValidationError(
          "grid-parameter-dimension-mismatch",
          `Parameter "${param.id}" (quantity "${param.quantityId}") references gridParameterId "${targetId}" with mismatched quantity "${target.quantityId}".`,
          "Experiment",
          `${path}.parameters.${param.id}.mapping`,
        );
      }
      if (
        target.mapping.kind === "step" &&
        "gridParameterId" in target.mapping &&
        target.mapping.gridParameterId
      ) {
        throw new ExperimentValidationError(
          "grid-parameter-chain-forbidden",
          `Grid parameter chaining is forbidden: "${targetId}" itself uses gridParameterId.`,
          "Experiment",
          `${path}.parameters.${param.id}.mapping`,
        );
      }
    }
  }

  // Outputs
  if (!Array.isArray(o.outputs) || o.outputs.length === 0) {
    throw new ExperimentValidationError(
      "missing-outputs",
      "outputs must be a non-empty array.",
      "Experiment",
      `${path}.outputs`,
    );
  }
  const outputs: OutputSpec[] = [];
  let hasPrimaryOutput = false;
  let allowsNonValue = false;

  for (let i = 0; i < o.outputs.length; i++) {
    const outRaw = o.outputs[i];
    const outPath = `${path}.outputs[${i}]`;
    if (!outRaw || typeof outRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-output",
        "Output must be an object.",
        "Experiment",
        outPath,
      );
    }
    const out = outRaw as Record<string, unknown>;
    if (typeof out.id !== "string" || !out.id.trim()) {
      throw new ExperimentValidationError(
        "missing-output-id",
        "Output id is required.",
        "Experiment",
        `${outPath}.id`,
      );
    }
    if (typeof out.quantityId !== "string" || !out.quantityId.trim()) {
      throw new ExperimentValidationError(
        "missing-output-quantity-id",
        "Output quantityId is required.",
        "Experiment",
        `${outPath}.quantityId`,
      );
    }
    if (!Array.isArray(out.allowedStatuses) || out.allowedStatuses.length === 0) {
      throw new ExperimentValidationError(
        "missing-allowed-statuses",
        "Output allowedStatuses must be a non-empty array.",
        "Experiment",
        `${outPath}.allowedStatuses`,
      );
    }
    for (const st of out.allowedStatuses) {
      if (!OUTPUT_STATUSES.includes(st as OutputStatus)) {
        throw new ExperimentValidationError(
          "invalid-output-status",
          `Invalid output status "${st}".`,
          "Experiment",
          `${outPath}.allowedStatuses`,
        );
      }
      if (st !== "value") {
        allowsNonValue = true;
      }
    }
    if (out.primary === true) {
      hasPrimaryOutput = true;
    }
    outputs.push({
      id: out.id,
      quantityId: out.quantityId,
      allowedStatuses: out.allowedStatuses as OutputStatus[],
      primary: Boolean(out.primary),
    });
  }

  if (!hasPrimaryOutput) {
    throw new ExperimentValidationError(
      "missing-primary-output",
      "Experiment must declare at least one primary output (primary: true).",
      "Experiment",
      `${path}.outputs`,
    );
  }

  // Model Claims: notModeled must be non-empty
  if (!Array.isArray(o.notModeled) || o.notModeled.length === 0) {
    throw new ExperimentValidationError(
      "empty-not-modeled",
      "Experiment notModeled array MUST BE NON-EMPTY. An empty notModeled list fails the audit to ensure honest boundary declarations.",
      "Experiment",
      `${path}.notModeled`,
    );
  }
  const notModeled = o.notModeled as string[];

  if (!Array.isArray(o.assumptions)) {
    throw new ExperimentValidationError(
      "missing-assumptions",
      "assumptions must be an array.",
      "Experiment",
      `${path}.assumptions`,
    );
  }
  if (typeof o.admittedDomain !== "string" || !o.admittedDomain.trim()) {
    throw new ExperimentValidationError(
      "missing-admitted-domain",
      "admittedDomain prose is required.",
      "Experiment",
      `${path}.admittedDomain`,
    );
  }

  // Owner
  if (!o.owner || typeof o.owner !== "object") {
    throw new ExperimentValidationError(
      "missing-owner",
      "owner block is required.",
      "Experiment",
      `${path}.owner`,
    );
  }
  const ow = o.owner as Record<string, unknown>;
  const ownerKind = ow.kind;
  if (ownerKind !== "reference-evaluator" && ownerKind !== "frankensim" && ownerKind !== "static") {
    throw new ExperimentValidationError(
      "invalid-owner-kind",
      `Invalid owner kind "${String(ow.kind)}".`,
      "Experiment",
      `${path}.owner.kind`,
    );
  }
  if (ow.kind === "static") {
    if (typeof ow.staticReason !== "string" || !ow.staticReason.trim()) {
      throw new ExperimentValidationError(
        "missing-static-reason",
        "Static owner requires non-empty staticReason.",
        "Experiment",
        `${path}.owner.staticReason`,
      );
    }
    if (Array.isArray(ow.kernelFunctions) && ow.kernelFunctions.length > 0) {
      throw new ExperimentValidationError(
        "static-owner-has-functions",
        "Static owner cannot declare kernel functions.",
        "Experiment",
        `${path}.owner.kernelFunctions`,
      );
    }
    if (ow.traceScenarioId || (Array.isArray(ow.traceRows) && ow.traceRows.length > 0)) {
      throw new ExperimentValidationError(
        "static-owner-has-trace",
        "Static owner cannot declare trace scenario or trace rows.",
        "Experiment",
        `${path}.owner`,
      );
    }
  }

  // Kernel functions
  const kernelFunctions: KernelFunctionRef[] = [];
  if (Array.isArray(ow.kernelFunctions)) {
    for (let i = 0; i < ow.kernelFunctions.length; i++) {
      const kRaw = ow.kernelFunctions[i];
      const kPath = `${path}.owner.kernelFunctions[${i}]`;
      if (!kRaw || typeof kRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-kernel-function",
          "Kernel function must be an object.",
          "Experiment",
          kPath,
        );
      }
      const k = kRaw as Record<string, unknown>;
      if (!KERNEL_DISPLAY_ROLES.includes(k.displayRole as KernelDisplayRole)) {
        throw new ExperimentValidationError(
          "invalid-kernel-display-role",
          `Invalid displayRole "${k.displayRole}".`,
          "Experiment",
          `${kPath}.displayRole`,
        );
      }
      const role = k.displayRole as KernelDisplayRole;
      if (role === "pseudocode" || role === "derivation") {
        if (k.module || k.crate || k.path || k.fnName || k.revision) {
          throw new ExperimentValidationError(
            "pseudocode-with-exec-fields",
            `Kernel function with displayRole "${role}" must not declare executable reference fields (module, crate, path, fnName, revision).`,
            "Experiment",
            kPath,
          );
        }
      } else if (role === "executing-source" || role === "reference-implementation") {
        if (k.language === "ts") {
          if (!k.module || !k.exportName) {
            throw new ExperimentValidationError(
              "missing-ts-kernel-fields",
              `TypeScript kernel function with displayRole "${role}" requires module and exportName.`,
              "Experiment",
              kPath,
            );
          }
        } else if (k.language === "rust") {
          if (!k.crate || !k.path || !k.fnName || !k.revision) {
            throw new ExperimentValidationError(
              "missing-rust-kernel-fields",
              `Rust kernel function with displayRole "${role}" requires crate, path, fnName, and revision.`,
              "Experiment",
              kPath,
            );
          }
        } else {
          throw new ExperimentValidationError(
            "missing-kernel-language",
            `Kernel function requires language: "ts" | "rust".`,
            "Experiment",
            `${kPath}.language`,
          );
        }
      }
      const kRef: KernelFunctionRef = {
        displayRole: role,
        language:
          typeof k.language === "string" && (k.language === "ts" || k.language === "rust")
            ? k.language
            : undefined,
        module: typeof k.module === "string" ? k.module : undefined,
        exportName: typeof k.exportName === "string" ? k.exportName : undefined,
        crate: typeof k.crate === "string" ? k.crate : undefined,
        path: typeof k.path === "string" ? k.path : undefined,
        fnName: typeof k.fnName === "string" ? k.fnName : undefined,
        revision: typeof k.revision === "string" ? k.revision : undefined,
        independentReferences: Array.isArray(k.independentReferences)
          ? (k.independentReferences as readonly Readonly<{
              experimentId: string;
              quantityId: string;
            }>[])
          : undefined,
      };
      kernelFunctions.push(kRef);
    }
  }

  // Trace rows cap (at most 12 rows)
  let traceRows: TraceRow[] | undefined;
  if (Array.isArray(ow.traceRows)) {
    if (ow.traceRows.length > 12) {
      throw new ExperimentValidationError(
        "trace-rows-exceeded",
        `Experiment "${instrumentId}" traceRows contains ${ow.traceRows.length} rows, exceeding the 12-row cap.`,
        "Experiment",
        `${path}.owner.traceRows`,
      );
    }
    traceRows = ow.traceRows as TraceRow[];
  }

  const owner: ExperimentOwner = {
    kind: ownerKind,
    ...(typeof ow.capabilityId === "string" ? { capabilityId: ow.capabilityId } : {}),
    ...(typeof ow.staticReason === "string" ? { staticReason: ow.staticReason } : {}),
    kernelFunctions,
    identifierBindings: Array.isArray(ow.identifierBindings)
      ? (ow.identifierBindings as IdentifierBinding[])
      : [],
    ...(typeof ow.traceScenarioId === "string" ? { traceScenarioId: ow.traceScenarioId } : {}),
    ...(traceRows ? { traceRows } : {}),
  };

  // Views
  if (!Array.isArray(o.views) || o.views.length === 0) {
    throw new ExperimentValidationError(
      "missing-views",
      "views must be a non-empty array.",
      "Experiment",
      `${path}.views`,
    );
  }
  const views: ViewSpec[] = [];
  let hasCanvasOrThree = false;
  let hasTableOrText = false;
  let hasNoRequiresView = false;

  for (let i = 0; i < o.views.length; i++) {
    const vRaw = o.views[i];
    const vPath = `${path}.views[${i}]`;
    if (!vRaw || typeof vRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-view",
        "View must be an object.",
        "Experiment",
        vPath,
      );
    }
    const v = vRaw as Record<string, unknown>;
    if (!VIEW_KINDS.includes(v.kind as ViewKind)) {
      throw new ExperimentValidationError(
        "invalid-view-kind",
        `Invalid view kind "${v.kind}".`,
        "Experiment",
        `${vPath}.kind`,
      );
    }
    const kind = v.kind as ViewKind;
    if (kind === "three") {
      hasCanvasOrThree = true;
      if (typeof v.spatialJustification !== "string" || !v.spatialJustification.trim()) {
        throw new ExperimentValidationError(
          "missing-spatial-justification",
          `A "three" view requires a non-empty spatialJustification explaining why 3D is necessary over 2D.`,
          "Experiment",
          `${vPath}.spatialJustification`,
        );
      }
      const req = Array.isArray(v.requires) ? v.requires : [];
      if (!req.includes("webgl")) {
        throw new ExperimentValidationError(
          "three-view-missing-webgl",
          'A "three" view must declare requires: ["webgl"].',
          "Experiment",
          `${vPath}.requires`,
        );
      }
    } else if (kind === "canvas") {
      hasCanvasOrThree = true;
      const req = Array.isArray(v.requires) ? v.requires : [];
      if (!req.includes("canvas-2d")) {
        throw new ExperimentValidationError(
          "canvas-view-missing-canvas-2d",
          'A "canvas" view must declare requires: ["canvas-2d"].',
          "Experiment",
          `${vPath}.requires`,
        );
      }
    } else if (kind === "table" || kind === "text") {
      hasTableOrText = true;
      if (Array.isArray(v.requires) && v.requires.length > 0) {
        throw new ExperimentValidationError(
          "table-text-view-declares-capability",
          `A "${kind}" view must not declare rendering capabilities in requires.`,
          "Experiment",
          `${vPath}.requires`,
        );
      }
    } else if (kind === "svg") {
      if (Array.isArray(v.requires) && v.requires.length > 0) {
        throw new ExperimentValidationError(
          "svg-view-declares-capability",
          'An "svg" view must not declare rendering capabilities in requires.',
          "Experiment",
          `${vPath}.requires`,
        );
      }
    }

    if (!Array.isArray(v.requires) || v.requires.length === 0) {
      hasNoRequiresView = true;
    }

    views.push({
      id: (v.id as string) || `${kind}-${i}`,
      kind,
      consumes: Array.isArray(v.consumes) ? (v.consumes as string[]) : [],
      requires: Array.isArray(v.requires) ? (v.requires as RenderingCapability[]) : undefined,
      spatialJustification:
        typeof v.spatialJustification === "string" ? v.spatialJustification : undefined,
    });
  }

  if (hasCanvasOrThree && !hasTableOrText) {
    throw new ExperimentValidationError(
      "canvas-or-three-missing-fallback-view",
      'Every manifest with a "canvas" or "three" view must also include at least one "table" or "text" accessible fallback view.',
      "Experiment",
      `${path}.views`,
    );
  }
  if (!hasNoRequiresView) {
    throw new ExperimentValidationError(
      "all-views-require-capabilities",
      "Every manifest must keep at least one view with no rendering capability requirements.",
      "Experiment",
      `${path}.views`,
    );
  }

  // RealRate
  if (!o.realRate || typeof o.realRate !== "object") {
    throw new ExperimentValidationError(
      "missing-real-rate",
      "realRate declaration is required.",
      "Experiment",
      `${path}.realRate`,
    );
  }
  const rr = o.realRate as Record<string, unknown>;
  let realRate: RealRate;
  if (rr.natural === true) {
    if (typeof rr.quantity !== "string" || !rr.quantity.trim()) {
      throw new ExperimentValidationError(
        "missing-real-rate-quantity",
        "natural: true requires output quantity.",
        "Experiment",
        `${path}.realRate.quantity`,
      );
    }
    const sb = rr.scaleBar as Record<string, unknown>;
    if (!sb || typeof sb.length !== "number" || typeof sb.unit !== "string") {
      throw new ExperimentValidationError(
        "missing-real-rate-scalebar",
        "natural: true requires scaleBar: { length, unit }.",
        "Experiment",
        `${path}.realRate.scaleBar`,
      );
    }
    realRate = {
      natural: true,
      quantity: rr.quantity,
      scaleBar: { length: sb.length as number, unit: sb.unit as string },
    };
  } else if (rr.natural === false) {
    realRate = { natural: false };
  } else {
    throw new ExperimentValidationError(
      "invalid-real-rate",
      "realRate must be { natural: true, ... } or { natural: false }.",
      "Experiment",
      `${path}.realRate`,
    );
  }

  // PredictMode
  if (!o.predictMode || typeof o.predictMode !== "object") {
    throw new ExperimentValidationError(
      "missing-predict-mode",
      "predictMode is required (must be enabled or exempt with reason).",
      "Experiment",
      `${path}.predictMode`,
    );
  }
  const pm = o.predictMode as Record<string, unknown>;
  let predictMode: PredictMode;

  if (pm.exempt === true) {
    if (typeof pm.reason !== "string" || !pm.reason.trim()) {
      throw new ExperimentValidationError(
        "missing-predict-exemption-reason",
        "predictMode exemption requires a non-empty reason.",
        "Experiment",
        `${path}.predictMode.reason`,
      );
    }
    predictMode = { exempt: true, reason: pm.reason };
  } else if (pm.enabled === true) {
    if (!Array.isArray(pm.prompts) || pm.prompts.length === 0) {
      throw new ExperimentValidationError(
        "missing-predict-prompts",
        "predictMode.enabled: true requires a non-empty prompts array.",
        "Experiment",
        `${path}.predictMode.prompts`,
      );
    }
    const prompts: PredictPrompt[] = [];
    const promptControlIds = new Set<string>();

    for (let i = 0; i < pm.prompts.length; i++) {
      const prRaw = pm.prompts[i];
      const prPath = `${path}.predictMode.prompts[${i}]`;
      if (!prRaw || typeof prRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-predict-prompt",
          "Predict prompt must be an object.",
          "Experiment",
          prPath,
        );
      }
      const pr = prRaw as Record<string, unknown>;
      if (typeof pr.promptId !== "string") {
        throw new ExperimentValidationError(
          "missing-prompt-id",
          "promptId is required.",
          "Experiment",
          `${prPath}.promptId`,
        );
      }
      const promptParsed = parsePredictPromptId(pr.promptId);
      if (!promptParsed.ok) {
        throw new ExperimentValidationError(
          "invalid-predict-prompt-id",
          promptParsed.error,
          "Experiment",
          `${prPath}.promptId`,
        );
      }

      const controlKey = (pr.controlId || pr.actionId) as string | undefined;
      if (!controlKey) {
        throw new ExperimentValidationError(
          "missing-prompt-target",
          "Predict prompt requires controlId or actionId.",
          "Experiment",
          prPath,
        );
      }
      if (promptControlIds.has(controlKey)) {
        throw new ExperimentValidationError(
          "duplicate-prompt-target",
          `Only one predict prompt is allowed per control or action (duplicate "${controlKey}").`,
          "Experiment",
          prPath,
        );
      }
      promptControlIds.add(controlKey);

      // Candidates: EXACTLY THREE CANDIDATES!
      if (!Array.isArray(pr.candidates) || pr.candidates.length !== 3) {
        throw new ExperimentValidationError(
          "predict-candidates-count",
          `Predict prompt "${pr.promptId}" must provide exactly 3 plausible candidates (found ${Array.isArray(pr.candidates) ? pr.candidates.length : 0}).`,
          "Experiment",
          `${prPath}.candidates`,
        );
      }

      const candidateIds = new Set<string>();
      const candidates: PredictCandidate[] = [];

      for (let j = 0; j < pr.candidates.length; j++) {
        const cRaw = pr.candidates[j];
        const cPath = `${prPath}.candidates[${j}]`;
        if (!cRaw || typeof cRaw !== "object") {
          throw new ExperimentValidationError(
            "invalid-candidate",
            "Candidate must be an object.",
            "Experiment",
            cPath,
          );
        }
        const c = cRaw as Record<string, unknown>;
        if (typeof c.id !== "string" || !c.id.trim()) {
          throw new ExperimentValidationError(
            "missing-candidate-id",
            "Candidate id is required.",
            "Experiment",
            `${cPath}.id`,
          );
        }
        if (candidateIds.has(c.id)) {
          throw new ExperimentValidationError(
            "duplicate-candidate-id",
            `Candidate id "${c.id}" is duplicated in prompt.`,
            "Experiment",
            `${cPath}.id`,
          );
        }
        candidateIds.add(c.id);

        if (typeof c.separatingAssumption !== "string" || !c.separatingAssumption.trim()) {
          throw new ExperimentValidationError(
            "missing-separating-assumption",
            `Candidate "${c.id}" in prompt "${pr.promptId}" is missing required separatingAssumption. Every candidate, including the accepted one, requires a separatingAssumption.`,
            "Experiment",
            `${cPath}.separatingAssumption`,
          );
        }

        candidates.push({
          id: c.id,
          label: (c.label as string) || c.id,
          description: (c.description as string) || "",
          separatingAssumption: c.separatingAssumption,
          curve: (c.curve as string) || undefined,
          relation: (c.relation as string) || undefined,
        });
      }

      let sketchAxes: Readonly<{ x: string; y: string }> | undefined;
      if (pr.sketchAxes && typeof pr.sketchAxes === "object" && !Array.isArray(pr.sketchAxes)) {
        const sa = pr.sketchAxes as Record<string, unknown>;
        if (typeof sa.x === "string" && typeof sa.y === "string") {
          sketchAxes = Object.freeze({ x: sa.x, y: sa.y });
        }
      }

      prompts.push({
        promptId: pr.promptId,
        controlId: (pr.controlId as string) || undefined,
        actionId: (pr.actionId as string) || undefined,
        question: (pr.question as string) || "",
        ...promptCandidates(pr, candidates, prPath),
        sketchAxes,
        verbalChoices: Array.isArray(pr.verbalChoices) ? (pr.verbalChoices as string[]) : undefined,
        valueTargets: Array.isArray(pr.valueTargets) ? (pr.valueTargets as number[]) : undefined,
      });
    }

    predictMode = { enabled: true, prompts };
  } else {
    throw new ExperimentValidationError(
      "invalid-predict-mode",
      "predictMode must be { enabled: true, prompts: [...] } or { exempt: true, reason: string }.",
      "Experiment",
      `${path}.predictMode`,
    );
  }

  // Presets
  const presets: PresetEntry[] = [];
  if (Array.isArray(o.presets)) {
    for (let i = 0; i < o.presets.length; i++) {
      const psRaw = o.presets[i];
      const psPath = `${path}.presets[${i}]`;
      if (!psRaw || typeof psRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-preset",
          "Preset must be an object.",
          "Experiment",
          psPath,
        );
      }
      const ps = psRaw as Record<string, unknown>;
      if (typeof ps.presetId !== "string") {
        throw new ExperimentValidationError(
          "missing-preset-id",
          "presetId is required.",
          "Experiment",
          `${psPath}.presetId`,
        );
      }
      const presetParsed = parsePresetId(ps.presetId);
      if (!presetParsed.ok) {
        throw new ExperimentValidationError(
          "invalid-preset-id",
          presetParsed.error,
          "Experiment",
          `${psPath}.presetId`,
        );
      }
      if (ps.scenarioId && ps.scenarioId !== ps.presetId) {
        throw new ExperimentValidationError(
          "preset-scenario-id-mismatch",
          `Preset scenarioId "${ps.scenarioId}" must equal presetId "${ps.presetId}".`,
          "Experiment",
          `${psPath}.scenarioId`,
        );
      }
      let parameterValues: Record<string, number | string> = {};
      if (
        ps.parameterValues &&
        typeof ps.parameterValues === "object" &&
        !Array.isArray(ps.parameterValues)
      ) {
        const pvRaw = ps.parameterValues as Record<string, unknown>;
        const pv: Record<string, number | string> = {};
        for (const [k, v] of Object.entries(pvRaw)) {
          if (typeof v === "number" || typeof v === "string") {
            pv[k] = v;
          }
        }
        parameterValues = pv;
      }
      presets.push({
        presetId: ps.presetId,
        label: (ps.label as string) || ps.presetId,
        parameterValues,
        scenarioId: (ps.scenarioId as string) || undefined,
      });
    }
  }

  // Acceptance cases: check refusal/non-value coverage if outputs allow non-value
  const acceptanceCases = Array.isArray(o.acceptanceCases) ? (o.acceptanceCases as string[]) : [];
  if (allowsNonValue && acceptanceCases.length === 0) {
    throw new ExperimentValidationError(
      "missing-refusal-acceptance-case",
      "Outputs allow non-numeric or refusal statuses, but acceptanceCases is empty.",
      "Experiment",
      `${path}.acceptanceCases`,
    );
  }

  // Modes
  const modes: ExperimentMode[] = [];
  if (Array.isArray(o.modes)) {
    for (let i = 0; i < o.modes.length; i++) {
      const mRaw = o.modes[i];
      const mPath = `${path}.modes[${i}]`;
      if (!mRaw || typeof mRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-mode",
          "Mode must be an object.",
          "Experiment",
          mPath,
        );
      }
      const m = mRaw as Record<string, unknown>;
      if (typeof m.id !== "string") {
        throw new ExperimentValidationError(
          "missing-mode-id",
          "Mode id is required.",
          "Experiment",
          `${mPath}.id`,
        );
      }
      const modeParsed = parseModeId(m.id);
      if (!modeParsed.ok) {
        throw new ExperimentValidationError(
          "invalid-mode-id",
          modeParsed.error,
          "Experiment",
          `${mPath}.id`,
        );
      }
      if (!HISTORICAL_STATUSES.includes(m.historicalStatus as HistoricalStatus)) {
        throw new ExperimentValidationError(
          "invalid-historical-status",
          `Invalid historicalStatus "${m.historicalStatus}".`,
          "Experiment",
          `${mPath}.historicalStatus`,
        );
      }
      if (m.historicalStatus === "later-development") {
        if (typeof m.lensLabel !== "string" || !m.lensLabel.trim()) {
          throw new ExperimentValidationError(
            "missing-lens-label",
            'Mode with historicalStatus "later-development" requires lensLabel.',
            "Experiment",
            `${mPath}.lensLabel`,
          );
        }
      }
      modes.push({
        id: m.id,
        label: (m.label as string) || m.id,
        historicalStatus: m.historicalStatus as HistoricalStatus,
        lensLabel: typeof m.lensLabel === "string" ? m.lensLabel : undefined,
        notModeledAdditions: Array.isArray(m.notModeledAdditions)
          ? (m.notModeledAdditions as readonly string[])
          : undefined,
        parameterOverrides:
          m.parameterOverrides &&
          typeof m.parameterOverrides === "object" &&
          !Array.isArray(m.parameterOverrides)
            ? (m.parameterOverrides as Record<string, unknown>)
            : undefined,
        outputOverrides:
          m.outputOverrides &&
          typeof m.outputOverrides === "object" &&
          !Array.isArray(m.outputOverrides)
            ? (m.outputOverrides as Record<string, unknown>)
            : undefined,
        ownerOverride:
          m.ownerOverride && typeof m.ownerOverride === "object"
            ? (m.ownerOverride as ExperimentOwner)
            : undefined,
      });
    }
  }

  return {
    id: instrumentId,
    title: o.title as string,
    explanatoryQuestion: o.explanatoryQuestion as string,
    sourceRefs: o.sourceRefs as { paper: string; id: string }[],
    argumentIds: o.argumentIds as string[],
    schemaVersion: o.schemaVersion as number,
    parameters,
    outputs,
    assumptions: o.assumptions as string[],
    admittedDomain: o.admittedDomain as string,
    notModeled,
    owner,
    views,
    actions: validateActionContracts(
      o.actions,
      `${path}.actions`,
      new Set(parameters.map((p) => p.id)),
      new Set(outputs.map((out) => out.id)),
    ),
    acceptanceCases,
    defaultScenario: (o.defaultScenario as string) || "default",
    tapeModel: (o.tapeModel as { modelId: string; modelVersion: number }) || {
      modelId: "tape-v1",
      modelVersion: 1,
    },
    teachingTapes: Array.isArray(o.teachingTapes)
      ? (o.teachingTapes as { tapeId: string; title: string }[])
      : [],
    presets,
    probes: Array.isArray(o.probes) ? (o.probes as string[]) : [],
    weavePredicates: Array.isArray(o.weavePredicates) ? (o.weavePredicates as string[]) : [],
    historicalOverlays: Array.isArray(o.historicalOverlays)
      ? (o.historicalOverlays as string[])
      : [],
    realRate,
    embeddable: Boolean(o.embeddable),
    predictMode,
    modes: modes.length > 0 ? modes : undefined,
    provenance: o.provenance,
  };
}

// ============================================================================
// 2. SCENARIO
// ============================================================================

export const SCENARIO_KINDS = [
  "historical-fixture",
  "modern-golden",
  "identity",
  "discrimination",
  "adversarial",
] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export type ToleranceSpec = Readonly<{
  absolute?: number | undefined;
  relative?: number | undefined;
  relativeTo?: "reference" | "larger" | undefined;
  rationale?: string | undefined;
}>;

export type PrintedPrecision =
  | Readonly<{ significantFigures: number }>
  | Readonly<{ decimals: number }>;

export type ExpectedOutput = Readonly<{
  outputId: string;
  value?: number | string | undefined;
  comparisonKind: "bitwise" | "tolerance" | "rounds-to";
  tolerance?: ToleranceSpec | undefined;
  printedValue?: string | undefined;
  printedPrecision?: PrintedPrecision | undefined;
  roundingConvention?: "half-up" | "half-even" | undefined;
  roundingReason?: string | undefined;
  qualifier?: "about" | "ca." | undefined;
}>;

export type HistoricalFixtureTranscription =
  | Readonly<{ status: "verified"; facsimilePage: number }>
  | Readonly<{ status: "pending"; reason: string }>
  | Readonly<{
      status: "verified-suspected-misprint";
      facsimilePage: number;
      printedReading: string;
      correctedReading: string;
      reasoning: string;
      receiptRef: string;
    }>;

export type IdentityRoute = Readonly<{
  routeId: string;
  owner: string;
  description: string;
}>;

export type DiscriminationHypothesis = Readonly<{
  id: string;
  label: string;
  owner: string;
  modelIdentity: string;
  circumstancesInWhichItWorks: string;
  historicalStatus: string;
}>;

export type DiscriminationObservation = Readonly<{
  observableId: string;
  inputs: Record<string, unknown>;
  procedure: string;
}>;

export type ScenarioExpected = Readonly<{
  outputs?: readonly ExpectedOutput[] | undefined;
  status?: Readonly<{ outputId: string; status: string; reasonCode: string }> | undefined;
  invariants?: readonly Readonly<{ expression: string; description: string }>[] | undefined;
  outcome?: "indistinguishable" | "discriminates" | undefined;
}>;

export type Scenario = Readonly<{
  id: string;
  kind: ScenarioKind;
  title: string;
  description: string;
  experimentId?: string | undefined;
  provenance?:
    | Readonly<{
        paper: string;
        sectionId: string;
        printedPage: number;
        locator?: string | undefined;
      }>
    | undefined;
  constantSetId: string;
  constantSetMixing?: Readonly<{ declared: true; reason: string }> | undefined;
  inputs: Record<string, Readonly<{ value: number | string; unit: string }>>;
  equations?: readonly string[] | undefined;
  owner: string;
  seedPolicy?: "fixed" | "new-trial-recorded" | undefined;
  seed?: string | undefined;
  streamVersion?: number | undefined;
  allocationId?: string | undefined;
  actions?:
    | readonly Readonly<{
        time?: number | undefined;
        event: string;
        commandClass: string;
        parameters?: Record<string, unknown> | undefined;
      }>[]
    | undefined;
  expected: ScenarioExpected;
  modelVersion: number;
  schemaVersion: number;
  transcription?: HistoricalFixtureTranscription | undefined;
  editorialInputs?:
    | readonly Readonly<{
        quantityId: string;
        value: number | string;
        unit: string;
        source: string;
        reason: string;
        sensitivity: string;
      }>[]
    | undefined;
  documentedAlternatives?:
    | readonly Readonly<{
        quantityId: string;
        value: number | string;
        printedRepresentation: string;
        reason: string;
      }>[]
    | undefined;
  routes?: readonly [IdentityRoute, IdentityRoute] | undefined;
  hypotheses?: readonly DiscriminationHypothesis[] | undefined;
  observation?: DiscriminationObservation | undefined;
  plausibleMistake?: string | undefined;
  intendedFailure?: string | undefined;
  datasetId?: string | undefined;
  inferenceModelId?: string | undefined;
  printedRepresentation?: string | undefined;
  tolerance?: ToleranceSpec | undefined;
}>;

export const REGISTERED_PRESET_IDS: ReadonlySet<string> = new Set([
  "bm-01-radius-probe",
  "bm-01-velocity-trap",
  "bm-01-viscosity-comparison",
  "bm-03-locked-cluster",
  "bm-03-million-particles",
  "bm-03-overflow-guard",
  "bm-03-pressure-matches-bm-02",
  "bm-03-ratio-one",
  "bm-03-two-particles-double",
  "bm-04-einstein-balance",
  "bm-04-mismatched-kicks",
  "bm-04-naegeli-kicks-off",
  "bm-04-naegeli-zero-force",
  "bm-04-zero-force-relaxation",
  "bm-05-asymmetric-deviation",
  "bm-05-coin-to-bell",
  "bm-06-ftcs-refusal",
  "bm-06-modern-one-second",
  "bm-06-point-distribution",
  "bm-07-coverage",
  "bm-07-identifiability",
  "bm-07-inversion-golden",
  "bm-07-perrin-1909",
  "bm-08-apparent-speed-noise",
  "bm-08-cve",
  "bm-08-drift-fluid",
  "bm-08-drift-stage",
  "bm-08-exposure-fixture",
  "bm-08-noise-only",
  "bm-08-overlap-refusal",
  "bm-08-pairs-estimated-coverage",
  "bm-08-pairs-exact-coverage",
  "lq-01-equal-amplitudes",
  "lq-01-instantaneous-snapshot",
  "lq-01-inverse-square-spreading",
  "lq-01-phase-shifted",
  "lq-01-unequal-amplitudes",
  "lq-04-dense-refusal",
  "lq-04-derived-temperature",
  "lq-04-halve-volume",
  "lq-05-first-encounter",
  "lq-05-journey-stage-e",
  "lq-05-locked-positions",
  "lq-05-n60-log",
  "lq-06-the-move",
  "lq-06-unrevealed",
  "lq-07-anti-stokes-disallowed",
  "lq-07-deviation-multi",
  "lq-07-deviation-non-wien",
  "lq-07-modern-thermal",
  "lq-07-stokes-rule",
  "lq-08-historical-check",
  "lq-08-intensity-probe",
  "lq-08-two-metals",
  "lq-09-historical-checks",
  "lq-09-sub-threshold",
  "lq-09-threshold",
  "me-01-default",
  "me-01-rest-frame",
  "me-01-sixty-degree-tilt",
  "me-01-transverse-emission",
  "me-02-0.6c",
  "me-03-card-bulb",
  "me-03-card-candle",
  "me-03-card-coal",
  "me-03-card-radium",
  "me-03-card-sun",
  "me-03-four-momentum-opposite-pulses",
  "me-03-heated-sealed-box",
  "me-03-sealed-lamp-and-mirror",
  "sr-01-moving-pair-0.6c",
  "sr-01-rod-chase-0.6c",
  "sr-01-round-trip-10ls",
  "sr-01-second-flash-20-30",
  "sr-01-sync-0-10",
  "sr-01-three-stations",
  "sr-02-apparatus",
  "sr-02-apparatus-nagging-fact",
  "sr-02-uniform-0.6c",
  "sr-02-uniform-10ms",
  "sr-03-boost-0.6c",
  "sr-03-causal-lightlike",
  "sr-03-causal-threshold",
  "sr-03-causal-timelike",
  "sr-03-reciprocal-0.6c",
  "sr-03-sphere-0.6c",
  "sr-03-valid-pair-0.6c",
  "sr-04-construct-0.6c",
  "sr-04-galilean-shelf",
  "sr-04-later-aids-0.6c",
  "sr-06-angled-90deg-0.6",
  "sr-06-collinear-0.6-0.6",
  "sr-06-fizeau-water",
  "sr-06-near-light-0.99",
  "sr-06-null-ray",
  "sr-06-perpendicular-boosts-0.6",
  "sr-07-equation-1-grouping",
  "sr-07-oblique-wave-0.6c",
  "sr-07-plane-wave-0.6c",
  "sr-08-crossed-fields-null",
  "sr-08-pure-electric-0.6c",
  "sr-08-pure-magnetic-low-speed",
  "sr-09-approaching-0.6",
  "sr-09-earth-orbit-aberration",
  "sr-09-receding-0.6",
  "sr-09-transverse-0.6",
  "sr-10-longitudinal-0.6",
  "sr-10-opposite-0.6",
  "sr-10-transverse-in-k-0.6",
  "sr-10-transverse-unprimed-0.6",
  "sr-11-approaching-0.6",
  "sr-11-interception-limit-0.6",
  "sr-11-mirror-frame-0.6",
  "sr-11-normal-0.6",
  "sr-11-oblique-30deg-0.6",
  "sr-11-stationary",
  "sr-12-convection-0.5c",
  "sr-12-current-loop-0.6c",
  "sr-12-gaussian-pulse-0.5c",
  "sr-12-moving-sphere-0.6c",
  "sr-12-neutral-conductor-0.6",
  "sr-13-bucherer-overlay",
  "sr-13-convention-0.6",
  "sr-13-electric-radius-1e5",
  "sr-13-energy-0.95",
  "sr-13-kaufmann-overlay",
  "sr-13-magnetic-radius-0.01t",
  "sr-13-transverse-e-2ns",
]);

export function isValidToleranceRationale(rationale: string): boolean {
  if (!rationale || typeof rationale !== "string") return false;
  const text = rationale.toLowerCase();
  const apparatus = /apparatus|resolution|detector|instrument/.test(text);
  const numerical = /numerical bound|numerical|precision|bound|rounding|truncation/.test(text);
  const observational = /observational|uncertainty|experimental|observation|measurement/.test(text);
  return apparatus || numerical || observational;
}

export function parseNaturalPrecision(printed: string): {
  decimals: number;
  significantFigures: number;
} | null {
  const clean = printed.trim().replace(",", ".");
  const match = clean.match(/^-?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?/i);
  if (!match) return null;
  const intPart = match[1] ?? "";
  const fracPart = match[2] ?? "";
  const decimals = fracPart.length;
  const digits = (intPart + fracPart).replace(/^0+/, "");
  const significantFigures = digits.length || 1;
  return { decimals, significantFigures };
}

export function validateScenario(raw: unknown, path = "Scenario"): Scenario {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "Scenario must be an object.",
      "Scenario",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError(
      "missing-id",
      "Scenario id is required.",
      "Scenario",
      `${path}.id`,
    );
  }
  if (!SCENARIO_KINDS.includes(o.kind as ScenarioKind)) {
    throw new ExperimentValidationError(
      "invalid-scenario-kind",
      `Invalid scenario kind "${o.kind}".`,
      "Scenario",
      `${path}.kind`,
    );
  }
  const kind = o.kind as ScenarioKind;

  if (kind === "adversarial") {
    if (typeof o.plausibleMistake !== "string" || !o.plausibleMistake.trim()) {
      throw new ExperimentValidationError(
        "adversarial-missing-plausible-mistake",
        "adversarial scenarios require plausibleMistake naming the wrong claim.",
        "Scenario",
        `${path}.plausibleMistake`,
      );
    }
    if (typeof o.intendedFailure !== "string" || !o.intendedFailure.trim()) {
      throw new ExperimentValidationError(
        "adversarial-missing-intended-failure",
        "adversarial scenarios require intendedFailure naming why the wrong claim fails.",
        "Scenario",
        `${path}.intendedFailure`,
      );
    }
  }

  // Retired spelling check
  if ("constantSet" in o && !("constantSetId" in o)) {
    throw new ExperimentValidationError(
      "retired-constant-set-field",
      'Found retired field "constantSet". Use "constantSetId" instead.',
      "Scenario",
      `${path}.constantSet`,
    );
  }
  if (typeof o.constantSetId !== "string" || !o.constantSetId.trim()) {
    throw new ExperimentValidationError(
      "missing-constant-set-id",
      "constantSetId is required.",
      "Scenario",
      `${path}.constantSetId`,
    );
  }

  // Mixed constant sets validation
  const mixedSets = new Set<string>();
  if (typeof o.constantSetId === "string" && o.constantSetId.trim()) {
    mixedSets.add(o.constantSetId.trim());
  }
  if (Array.isArray(o.constantSets)) {
    for (const s of o.constantSets) {
      if (typeof s === "string" && s.trim()) mixedSets.add(s.trim());
    }
  }
  if (Array.isArray(o.constantSetIds)) {
    for (const s of o.constantSetIds) {
      if (typeof s === "string" && s.trim()) mixedSets.add(s.trim());
    }
  }
  if (o.inputs && typeof o.inputs === "object") {
    for (const inp of Object.values(o.inputs as Record<string, unknown>)) {
      if (
        inp &&
        typeof inp === "object" &&
        "constantSetId" in inp &&
        typeof (inp as { constantSetId?: unknown }).constantSetId === "string"
      ) {
        mixedSets.add((inp as { constantSetId: string }).constantSetId.trim());
      }
    }
  }
  if (Array.isArray(o.editorialInputs)) {
    for (const ed of o.editorialInputs) {
      if (
        ed &&
        typeof ed === "object" &&
        "constantSetId" in ed &&
        typeof (ed as { constantSetId?: unknown }).constantSetId === "string"
      ) {
        mixedSets.add((ed as { constantSetId: string }).constantSetId.trim());
      }
    }
  }
  if (Array.isArray(o.hypotheses)) {
    for (const hyp of o.hypotheses) {
      if (
        hyp &&
        typeof hyp === "object" &&
        "constantSetId" in hyp &&
        typeof (hyp as { constantSetId?: unknown }).constantSetId === "string"
      ) {
        mixedSets.add((hyp as { constantSetId: string }).constantSetId.trim());
      }
    }
  }

  const hasMixedSets = mixedSets.size > 1 || o.mixedConstantSets === true;

  if (hasMixedSets) {
    if (!o.constantSetMixing || typeof o.constantSetMixing !== "object") {
      throw new ExperimentValidationError(
        "mixed-constant-sets-forbidden",
        `Scenario mixes constant sets (${[...mixedSets].join(", ")}) without declared constantSetMixing.`,
        "Scenario",
        `${path}.constantSetMixing`,
      );
    }
  }

  let constantSetMixing: Readonly<{ declared: true; reason: string }> | undefined;
  if ("constantSetMixing" in o && o.constantSetMixing !== undefined) {
    const csm = o.constantSetMixing as Record<string, unknown>;
    if (
      !csm ||
      typeof csm !== "object" ||
      csm.declared !== true ||
      typeof csm.reason !== "string" ||
      !csm.reason.trim()
    ) {
      throw new ExperimentValidationError(
        "invalid-constant-set-mixing",
        'constantSetMixing requires { declared: true, reason: "<non-empty explanation>" }.',
        "Scenario",
        `${path}.constantSetMixing`,
      );
    }
    constantSetMixing = { declared: true, reason: csm.reason.trim() };
  }

  // Seed validation
  let seed: string | undefined;
  if ("seed" in o && o.seed !== undefined) {
    if (typeof o.seed === "number") {
      throw new ExperimentValidationError(
        "numeric-seed-rejected",
        `Scenario seed "${o.seed}" was provided as a JSON number. Seeds must be unsigned 64-bit decimal strings.`,
        "Scenario",
        `${path}.seed`,
      );
    }
    seed = validateU64String(o.seed, `${path}.seed`);
  }

  if (o.seedPolicy && !o.allocationId) {
    throw new ExperimentValidationError(
      "stochastic-missing-allocation-id",
      "Stochastic scenario with seedPolicy requires allocationId registered in STREAM_ALLOCATION.md.",
      "Scenario",
      `${path}.allocationId`,
    );
  }

  // Historical fixture checks
  let transcription: HistoricalFixtureTranscription | undefined;
  if (kind === "historical-fixture") {
    if (!o.provenance || typeof o.provenance !== "object") {
      throw new ExperimentValidationError(
        "historical-missing-provenance",
        "historical-fixture requires provenance: { paper, sectionId, printedPage }.",
        "Scenario",
        `${path}.provenance`,
      );
    }
    if (!o.transcription || typeof o.transcription !== "object") {
      throw new ExperimentValidationError(
        "historical-missing-transcription",
        "historical-fixture requires transcription block.",
        "Scenario",
        `${path}.transcription`,
      );
    }
    const tr = o.transcription as Record<string, unknown>;
    if (tr.status === "verified-suspected-misprint") {
      if (!tr.printedReading || !tr.receiptRef) {
        throw new ExperimentValidationError(
          "misprint-missing-evidence",
          "verified-suspected-misprint transcription requires printedReading and receiptRef.",
          "Scenario",
          `${path}.transcription`,
        );
      }
      transcription = {
        status: "verified-suspected-misprint",
        facsimilePage: Number(tr.facsimilePage) || 0,
        printedReading: String(tr.printedReading),
        correctedReading: String(tr.correctedReading ?? ""),
        reasoning: String(tr.reasoning ?? ""),
        receiptRef: String(tr.receiptRef),
      };
    } else if (tr.status === "verified") {
      transcription = {
        status: "verified",
        facsimilePage: Number(tr.facsimilePage) || 0,
      };
    } else if (tr.status === "pending") {
      transcription = {
        status: "pending",
        reason: String(tr.reason ?? ""),
      };
    }
  }

  // Editorial inputs & documented alternatives check
  if (Array.isArray(o.editorialInputs)) {
    for (let i = 0; i < o.editorialInputs.length; i++) {
      const ed = o.editorialInputs[i] as Record<string, unknown>;
      const edPath = `${path}.editorialInputs[${i}]`;
      if (!ed.source || !ed.reason) {
        throw new ExperimentValidationError(
          "editorial-input-missing-fields",
          "editorialInputs entry requires source and reason.",
          "Scenario",
          edPath,
        );
      }
    }
  }
  if (Array.isArray(o.documentedAlternatives)) {
    for (let i = 0; i < o.documentedAlternatives.length; i++) {
      const alt = o.documentedAlternatives[i] as Record<string, unknown>;
      const altPath = `${path}.documentedAlternatives[${i}]`;
      if (!alt.printedRepresentation) {
        throw new ExperimentValidationError(
          "documented-alternative-missing-printed-rep",
          "documentedAlternatives entry requires printedRepresentation.",
          "Scenario",
          altPath,
        );
      }
    }
  }

  // Identity checks (must have exactly 2 routes with distinct owners)
  let routes: [IdentityRoute, IdentityRoute] | undefined;
  if (kind === "identity") {
    if (!Array.isArray(o.routes) || o.routes.length !== 2) {
      throw new ExperimentValidationError(
        "identity-routes-count",
        `Identity scenario requires exactly 2 routes (found ${Array.isArray(o.routes) ? o.routes.length : 0}).`,
        "Scenario",
        `${path}.routes`,
      );
    }
    const r0 = o.routes[0] as IdentityRoute;
    const r1 = o.routes[1] as IdentityRoute;
    if (r0.owner === r1.owner) {
      throw new ExperimentValidationError(
        "identity-routes-same-owner",
        `Identity scenario routes must not share the same owner (both are "${r0.owner}").`,
        "Scenario",
        `${path}.routes`,
      );
    }
    routes = [r0, r1];
  }

  // Discrimination checks
  let hypotheses: DiscriminationHypothesis[] | undefined;
  let observation: DiscriminationObservation | undefined;
  let tolerance: ToleranceSpec | undefined;
  if (kind === "discrimination") {
    if (REGISTERED_PRESET_IDS.has(o.id as string)) {
      throw new ExperimentValidationError(
        "discrimination-preset-id-collision",
        `Discrimination scenario id "${o.id}" collides with a registered preset id.`,
        "Scenario",
        `${path}.id`,
      );
    }
    if (!Array.isArray(o.hypotheses) || o.hypotheses.length < 2) {
      throw new ExperimentValidationError(
        "discrimination-missing-hypotheses",
        "Discrimination scenario requires at least two hypotheses.",
        "Scenario",
        `${path}.hypotheses`,
      );
    }
    const ownersSeen = new Map<string, string>();
    for (let i = 0; i < o.hypotheses.length; i++) {
      const hyp = o.hypotheses[i] as DiscriminationHypothesis;
      if (ownersSeen.has(hyp.owner)) {
        throw new ExperimentValidationError(
          "discrimination-hypotheses-same-owner",
          `Discrimination hypotheses "${ownersSeen.get(hyp.owner)}" and "${hyp.id}" share the same owner "${hyp.owner}".`,
          "Scenario",
          `${path}.hypotheses[${i}]`,
        );
      }
      ownersSeen.set(hyp.owner, hyp.id);
    }
    hypotheses = o.hypotheses as DiscriminationHypothesis[];

    if (!o.observation || typeof o.observation !== "object") {
      throw new ExperimentValidationError(
        "discrimination-missing-observation",
        "Discrimination scenario requires observation block.",
        "Scenario",
        `${path}.observation`,
      );
    }
    observation = o.observation as DiscriminationObservation;

    const expOutputs = (o.expected as Record<string, unknown> | undefined)?.outputs;
    const tol = (o.tolerance ??
      (o.expected as Record<string, unknown> | undefined)?.tolerance ??
      (Array.isArray(expOutputs)
        ? (expOutputs[0] as Record<string, unknown> | undefined)?.tolerance
        : undefined) ??
      (o.observation as Record<string, unknown> | undefined)?.tolerance) as
      | Record<string, unknown>
      | undefined;
    tolerance = tol as unknown as ToleranceSpec | undefined;
    if (!tol || typeof tol !== "object") {
      throw new ExperimentValidationError(
        "discrimination-missing-tolerance",
        "Discrimination scenario requires a tolerance block.",
        "Scenario",
        `${path}.tolerance`,
      );
    }
    if (
      typeof tol.rationale !== "string" ||
      !tol.rationale.trim() ||
      !isValidToleranceRationale(tol.rationale)
    ) {
      throw new ExperimentValidationError(
        "discrimination-invalid-tolerance-rationale",
        "A discrimination tolerance requires a rationale naming an apparatus resolution, a numerical bound, or a stated observational uncertainty.",
        "Scenario",
        `${path}.tolerance.rationale`,
      );
    }
    const tolIssues = validateToleranceSpec(
      tol as unknown as import("../../units/tolerance.ts").ToleranceSpec,
      1,
    );
    if (tolIssues.length > 0) {
      throw new ExperimentValidationError(
        "tolerance-spec-invalid",
        `Tolerance specification invalid: ${tolIssues.map((issue) => issue.message).join("; ")}`,
        "Scenario",
        `${path}.tolerance`,
      );
    }
  }

  // Expected block validation
  if (!o.expected || typeof o.expected !== "object") {
    throw new ExperimentValidationError(
      "missing-expected",
      "Scenario requires expected block.",
      "Scenario",
      `${path}.expected`,
    );
  }
  const exp = o.expected as Record<string, unknown>;

  if (kind === "discrimination") {
    if (!exp.outcome || (exp.outcome !== "indistinguishable" && exp.outcome !== "discriminates")) {
      throw new ExperimentValidationError(
        "discrimination-missing-outcome",
        'Discrimination scenario expected block requires outcome: "indistinguishable" | "discriminates".',
        "Scenario",
        `${path}.expected.outcome`,
      );
    }
    if (exp.outcome === "indistinguishable" && ("residual" in exp || "difference" in exp)) {
      throw new ExperimentValidationError(
        "discrimination-indistinguishable-stored-residual",
        'Discrimination scenario with outcome "indistinguishable" must not store residual literals; runner computes comparison.',
        "Scenario",
        `${path}.expected`,
      );
    }
  }

  const expectedOutputs: ExpectedOutput[] = [];
  if (Array.isArray(exp.outputs)) {
    for (let i = 0; i < exp.outputs.length; i++) {
      const eoRaw = exp.outputs[i] as Record<string, unknown>;
      const eoPath = `${path}.expected.outputs[${i}]`;
      const comp = eoRaw.comparisonKind as string;

      if (comp === "bitwise") {
        if (eoRaw.tolerance) {
          throw new ExperimentValidationError(
            "bitwise-tolerance-forbidden",
            "Bitwise comparison must not declare a tolerance.",
            "Scenario",
            `${eoPath}.tolerance`,
          );
        }
      } else if (comp === "tolerance") {
        if (kind === "historical-fixture") {
          throw new ExperimentValidationError(
            "historical-printed-requires-rounds-to",
            `Historical fixture output "${eoRaw.outputId}" expects a printed number and must use comparisonKind "rounds-to", not "tolerance".`,
            "Scenario",
            `${eoPath}.comparisonKind`,
          );
        }
        const tol = eoRaw.tolerance as Record<string, unknown> | undefined;
        if (
          !tol ||
          (typeof tol.absolute !== "number" && typeof tol.relative !== "number") ||
          !tol.rationale
        ) {
          throw new ExperimentValidationError(
            "tolerance-comparison-missing-spec",
            "Tolerance comparison requires at least one positive absolute/relative tolerance AND a rationale.",
            "Scenario",
            `${eoPath}.tolerance`,
          );
        }
        const tolIssues = validateToleranceSpec(
          tol as unknown as import("../../units/tolerance.ts").ToleranceSpec,
          typeof eoRaw.value === "number" ? eoRaw.value : 1,
        );
        if (tolIssues.length > 0) {
          throw new ExperimentValidationError(
            "tolerance-spec-invalid",
            `Tolerance specification invalid: ${tolIssues.map((issue) => issue.message).join("; ")}`,
            "Scenario",
            `${eoPath}.tolerance`,
          );
        }
      } else if (comp === "rounds-to") {
        if (kind !== "historical-fixture") {
          throw new ExperimentValidationError(
            "rounds-to-non-historical",
            `comparisonKind "rounds-to" is valid only on historical-fixture scenarios (found on ${kind}).`,
            "Scenario",
            `${eoPath}.comparisonKind`,
          );
        }
        if (eoRaw.tolerance) {
          throw new ExperimentValidationError(
            "rounds-to-tolerance-forbidden",
            '"rounds-to" comparison takes no tolerance.',
            "Scenario",
            `${eoPath}.tolerance`,
          );
        }
        if (!eoRaw.printedValue || !eoRaw.printedPrecision) {
          throw new ExperimentValidationError(
            "rounds-to-missing-printed-spec",
            '"rounds-to" comparison requires printedValue and printedPrecision.',
            "Scenario",
            eoPath,
          );
        }
        if (eoRaw.roundingConvention === "half-even" && !eoRaw.roundingReason) {
          throw new ExperimentValidationError(
            "half-even-missing-reason",
            'roundingConvention "half-even" requires roundingReason.',
            "Scenario",
            `${eoPath}.roundingReason`,
          );
        }
        const natural = parseNaturalPrecision(String(eoRaw.printedValue));
        const prec = eoRaw.printedPrecision as Record<string, unknown>;
        const isWidened =
          eoRaw.widened === true ||
          Boolean(
            natural &&
              (("decimals" in prec &&
                typeof prec.decimals === "number" &&
                prec.decimals < natural.decimals) ||
                ("significantFigures" in prec &&
                  typeof prec.significantFigures === "number" &&
                  prec.significantFigures < natural.significantFigures)),
          );
        if (isWidened) {
          const hasFacsimilePage =
            (typeof (o.transcription as Record<string, unknown> | undefined)?.facsimilePage ===
              "number" &&
              Number((o.transcription as Record<string, unknown>).facsimilePage) > 0) ||
            (typeof eoRaw.facsimilePage === "number" && eoRaw.facsimilePage > 0);
          if (!hasFacsimilePage) {
            throw new ExperimentValidationError(
              "rounds-to-widening-unreferenced",
              "Widening printedPrecision to pass a failing row is rejected without a facsimile page reference.",
              "Scenario",
              `${eoPath}.printedPrecision`,
            );
          }
        }
      } else {
        throw new ExperimentValidationError(
          "invalid-comparison-kind",
          `Invalid comparisonKind "${comp}".`,
          "Scenario",
          `${eoPath}.comparisonKind`,
        );
      }
      expectedOutputs.push(eoRaw as ExpectedOutput);
    }
  }

  return {
    id: o.id as string,
    kind,
    title: (o.title as string) || (o.id as string),
    description: (o.description as string) || "",
    experimentId: (o.experimentId as string) || undefined,
    provenance: o.provenance
      ? (o.provenance as Readonly<{
          paper: string;
          sectionId: string;
          printedPage: number;
          locator?: string | undefined;
        }>)
      : undefined,
    constantSetId: o.constantSetId as string,
    constantSetMixing,
    inputs: (o.inputs as Record<string, Readonly<{ value: number | string; unit: string }>>) || {},
    equations: Array.isArray(o.equations) ? (o.equations as string[]) : undefined,
    owner: (o.owner as string) || "",
    seedPolicy: o.seedPolicy as "fixed" | "new-trial-recorded" | undefined,
    seed,
    streamVersion: typeof o.streamVersion === "number" ? o.streamVersion : undefined,
    allocationId: (o.allocationId as string) || undefined,
    actions: Array.isArray(o.actions)
      ? (o.actions as readonly Readonly<{
          time?: number | undefined;
          event: string;
          commandClass: string;
          parameters?: Record<string, unknown> | undefined;
        }>[])
      : undefined,
    expected: {
      outputs: expectedOutputs.length > 0 ? expectedOutputs : undefined,
      status: exp.status as
        | Readonly<{ outputId: string; status: string; reasonCode: string }>
        | undefined,
      invariants: Array.isArray(exp.invariants)
        ? (exp.invariants as readonly Readonly<{ expression: string; description: string }>[])
        : undefined,
      outcome: exp.outcome as "indistinguishable" | "discriminates" | undefined,
    },
    modelVersion: typeof o.modelVersion === "number" ? o.modelVersion : 1,
    schemaVersion: typeof o.schemaVersion === "number" ? o.schemaVersion : 1,
    transcription,
    editorialInputs: Array.isArray(o.editorialInputs)
      ? (o.editorialInputs as Scenario["editorialInputs"])
      : undefined,
    documentedAlternatives: Array.isArray(o.documentedAlternatives)
      ? (o.documentedAlternatives as Scenario["documentedAlternatives"])
      : undefined,
    routes,
    hypotheses,
    observation,
    plausibleMistake: typeof o.plausibleMistake === "string" ? o.plausibleMistake : undefined,
    intendedFailure: typeof o.intendedFailure === "string" ? o.intendedFailure : undefined,
    datasetId: typeof o.datasetId === "string" ? o.datasetId : undefined,
    inferenceModelId: typeof o.inferenceModelId === "string" ? o.inferenceModelId : undefined,
    printedRepresentation:
      typeof o.printedRepresentation === "string" ? o.printedRepresentation : undefined,
    tolerance: (tolerance ?? (o.tolerance as ToleranceSpec | undefined)) as
      | ToleranceSpec
      | undefined,
  };
}

// ============================================================================
// 3. HISTORICAL DATASET
// ============================================================================

export type DataCell =
  | Readonly<{ kind: "number"; value: number; originalToken?: string | undefined }>
  | Readonly<{ kind: "missing"; reason: string }>
  | Readonly<{
      kind: "bound";
      direction: "upper" | "lower";
      value: number;
      originalToken?: string | undefined;
    }>;

export const COLUMN_ROLES = ["observed", "controlled", "derived", "reported-fit"] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

export type DatasetColumn = Readonly<{
  name: string;
  quantityId: string;
  unit: string;
  role: ColumnRole;
  fitDescription?: string | undefined;
}>;

export type DatasetPublicationLocator =
  | Readonly<{ kind: "table"; number: number | string }>
  | Readonly<{ kind: "figure"; number: number | string }>
  | Readonly<{ kind: "unnumbered-table"; page: number; caption?: string | undefined }>
  | Readonly<{ kind: "text"; page: number; sentence: number | string }>;

export type DatasetPublication = Readonly<{
  id: string;
  citation: Citation | string;
  locator: DatasetPublicationLocator;
  publicationDate: PaperDate;
}>;

export type DatasetSeries = Readonly<{
  id: string;
  publicationId: string;
  observationDate?: PaperDate | undefined;
  description: string;
}>;

export type DatasetRow = Readonly<{
  seriesId?: string | undefined;
  cells: readonly DataCell[];
}>;

export const DATASET_RESULT_RELATIONS = [
  "tested-a-prediction",
  "measured-a-quantity-the-result-uses",
  "reinterpreted",
  "narrowed-the-domain",
  "disputed",
] as const;
export type DatasetResultRelation = (typeof DATASET_RESULT_RELATIONS)[number];

export type DatasetAddressesResult = Readonly<{
  resultId: string;
  relation: DatasetResultRelation;
  statement: string;
  openQuestion?: string | undefined;
}>;

export type DatasetFitParameter = Readonly<{
  name: string;
  quantityId: string;
  value: number;
  unit: string;
  uncertainty?: number | undefined;
  source: "fitted-here" | "imported";
  sourceCitation?: string | undefined;
}>;

export type DatasetFitExclusion = Readonly<{
  rowIndex: number;
  reason: string;
}>;

export type DatasetFit = Readonly<{
  id: string;
  seriesId?: string | undefined;
  label: string;
  fitObjective: string;
  analysisDate: PaperDate;
  rowsUsed: readonly number[];
  rowsExcluded: readonly DatasetFitExclusion[];
  parameters: readonly DatasetFitParameter[];
  fitDescription?: string | undefined;
}>;

export type HistoricalDatasetFields = Readonly<{
  id: string;
  title: string;
  evidenceStatus: DatasetEvidenceStatus;
  publications: readonly DatasetPublication[];
  primaryPublicationId: string;
  series?: readonly DatasetSeries[] | undefined;
  digitizer: Readonly<{
    name: string;
    method: string;
    date: string | PaperDate;
    sourcePageImage: string;
    digitizationRevision: number;
  }>;
  columns: readonly DatasetColumn[];
  rows: readonly DatasetRow[];
  uncertainty: Readonly<{
    type: string;
    value?: number | undefined;
    perColumn?: Record<string, number> | undefined;
    perRow?: boolean | undefined;
    description: string;
  }>;
  notes: string;
  rights: SourceAssetRights;
  allowedInferenceModelIds: readonly string[];
  calibrationIds?: readonly string[] | undefined;
  sharedInputIds?: readonly string[] | undefined;
  addressesResults?: readonly DatasetAddressesResult[] | undefined;
  fits?: readonly DatasetFit[] | undefined;
}>;

export function validateDataCell(raw: unknown, path = "cell"): DataCell {
  if (typeof raw === "number") {
    throw new ExperimentValidationError(
      "bare-number-cell-rejected",
      `Bare numbers in cells[] are rejected. Use typed DataCell union: { kind: "number", value, originalToken? }, { kind: "missing", reason }, or { kind: "bound", direction, value }.`,
      "HistoricalDataset",
      path,
    );
  }
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-data-cell",
      "DataCell must be an object.",
      "HistoricalDataset",
      path,
    );
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind as string;

  if (kind === "number") {
    if (typeof o.value !== "number" || Number.isNaN(o.value)) {
      throw new ExperimentValidationError(
        "missing-cell-number-value",
        'DataCell of kind "number" requires numeric value.',
        "HistoricalDataset",
        `${path}.value`,
      );
    }
    return {
      kind: "number",
      value: o.value,
      originalToken: (o.originalToken as string) || undefined,
    };
  } else if (kind === "missing") {
    if (typeof o.reason !== "string" || !o.reason.trim()) {
      throw new ExperimentValidationError(
        "missing-cell-reason",
        'DataCell of kind "missing" requires a reason in words.',
        "HistoricalDataset",
        `${path}.reason`,
      );
    }
    return { kind: "missing", reason: o.reason };
  } else if (kind === "bound") {
    if (o.direction !== "upper" && o.direction !== "lower") {
      throw new ExperimentValidationError(
        "invalid-bound-direction",
        'DataCell of kind "bound" requires direction: "upper" | "lower".',
        "HistoricalDataset",
        `${path}.direction`,
      );
    }
    if (typeof o.value !== "number" || Number.isNaN(o.value)) {
      throw new ExperimentValidationError(
        "missing-bound-value",
        'DataCell of kind "bound" requires numeric value.',
        "HistoricalDataset",
        `${path}.value`,
      );
    }
    return {
      kind: "bound",
      direction: o.direction,
      value: o.value,
      originalToken: (o.originalToken as string) || undefined,
    };
  } else {
    throw new ExperimentValidationError(
      "invalid-cell-kind",
      `Unknown cell kind "${kind}".`,
      "HistoricalDataset",
      `${path}.kind`,
    );
  }
}

export function validateHistoricalDataset(
  raw: unknown,
  path = "HistoricalDataset",
): HistoricalDataset {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "HistoricalDataset must be an object.",
      "HistoricalDataset",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError(
      "missing-id",
      "HistoricalDataset id is required.",
      "HistoricalDataset",
      `${path}.id`,
    );
  }
  if (typeof o.title !== "string" || !o.title.trim()) {
    throw new ExperimentValidationError(
      "missing-title",
      "HistoricalDataset title is required.",
      "HistoricalDataset",
      `${path}.title`,
    );
  }
  if (!DATASET_EVIDENCE_STATUSES.some((status) => status === o.evidenceStatus)) {
    throw new ExperimentValidationError(
      "invalid-evidence-status",
      `Invalid evidenceStatus "${o.evidenceStatus}".`,
      "HistoricalDataset",
      `${path}.evidenceStatus`,
    );
  }

  // Publications
  if (!Array.isArray(o.publications) || o.publications.length === 0) {
    throw new ExperimentValidationError(
      "missing-publications",
      "HistoricalDataset publications must be a non-empty array.",
      "HistoricalDataset",
      `${path}.publications`,
    );
  }
  const pubIds = new Set<string>();
  const publications: DatasetPublication[] = [];

  for (let i = 0; i < o.publications.length; i++) {
    const pRaw = o.publications[i] as Record<string, unknown>;
    const pPath = `${path}.publications[${i}]`;
    if (!pRaw || typeof pRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-publication",
        "Publication must be an object.",
        "HistoricalDataset",
        pPath,
      );
    }
    if (typeof pRaw.id !== "string" || !pRaw.id.trim()) {
      throw new ExperimentValidationError(
        "missing-publication-id",
        "Publication id is required.",
        "HistoricalDataset",
        `${pPath}.id`,
      );
    }
    pubIds.add(pRaw.id);

    if (
      !pRaw.citation ||
      (typeof pRaw.citation === "string" && !pRaw.citation.trim()) ||
      (typeof pRaw.citation !== "string" && typeof pRaw.citation !== "object")
    ) {
      throw new ExperimentValidationError(
        "missing-publication-citation",
        "Publication requires a full citation string or Citation object; uncited datasets are rejected.",
        "HistoricalDataset",
        `${pPath}.citation`,
      );
    }

    if (!pRaw.locator || typeof pRaw.locator !== "object") {
      throw new ExperimentValidationError(
        "missing-publication-locator",
        "Publication requires locator ({kind, number/page}).",
        "HistoricalDataset",
        `${pPath}.locator`,
      );
    }
    const loc = pRaw.locator as Record<string, unknown>;
    if (loc.kind === "table" || loc.kind === "figure") {
      if (loc.number === undefined || loc.number === null || loc.number === "") {
        throw new ExperimentValidationError(
          "missing-table-figure-number",
          `Publication locator of kind "${loc.kind}" requires a table/figure number.`,
          "HistoricalDataset",
          `${pPath}.locator.number`,
        );
      }
    } else if (loc.kind === "unnumbered-table") {
      if (typeof loc.page !== "number") {
        throw new ExperimentValidationError(
          "missing-unnumbered-table-page",
          "unnumbered-table locator requires page number.",
          "HistoricalDataset",
          `${pPath}.locator.page`,
        );
      }
    } else if (loc.kind === "text") {
      if (typeof loc.page !== "number" || loc.sentence === undefined) {
        throw new ExperimentValidationError(
          "missing-text-locator-fields",
          "text locator requires page and sentence.",
          "HistoricalDataset",
          `${pPath}.locator`,
        );
      }
    } else {
      throw new ExperimentValidationError(
        "invalid-locator-kind",
        `Invalid locator kind "${loc.kind}".`,
        "HistoricalDataset",
        `${pPath}.locator.kind`,
      );
    }

    const pubDate = validatePaperDate(
      pRaw.publicationDate,
      pRaw.id as string,
      `${pPath}.publicationDate`,
    );

    let locator: DatasetPublicationLocator;
    if (loc.kind === "table") {
      locator = { kind: "table", number: loc.number as number | string };
    } else if (loc.kind === "figure") {
      locator = { kind: "figure", number: loc.number as number | string };
    } else if (loc.kind === "unnumbered-table") {
      locator = {
        kind: "unnumbered-table",
        page: loc.page as number,
        caption: typeof loc.caption === "string" ? loc.caption : undefined,
      };
    } else {
      locator = {
        kind: "text",
        page: loc.page as number,
        sentence: loc.sentence as number | string,
      };
    }

    publications.push({
      id: pRaw.id as string,
      citation: pRaw.citation as Citation | string,
      locator,
      publicationDate: pubDate,
    });
  }

  if (typeof o.primaryPublicationId !== "string" || !pubIds.has(o.primaryPublicationId)) {
    throw new ExperimentValidationError(
      "invalid-primary-publication-id",
      `primaryPublicationId "${o.primaryPublicationId}" must resolve to one of publications[].id.`,
      "HistoricalDataset",
      `${path}.primaryPublicationId`,
    );
  }

  // Series
  const seriesList: DatasetSeries[] = [];
  const seriesIds = new Set<string>();
  if (Array.isArray(o.series)) {
    for (let i = 0; i < o.series.length; i++) {
      const sRaw = o.series[i] as Record<string, unknown>;
      const sPath = `${path}.series[${i}]`;
      if (!sRaw || typeof sRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-series",
          "Series must be an object.",
          "HistoricalDataset",
          sPath,
        );
      }
      if (typeof sRaw.id !== "string" || !sRaw.id.trim()) {
        throw new ExperimentValidationError(
          "missing-series-id",
          "Series id is required.",
          "HistoricalDataset",
          `${sPath}.id`,
        );
      }
      seriesIds.add(sRaw.id);
      if (typeof sRaw.publicationId !== "string" || !pubIds.has(sRaw.publicationId)) {
        throw new ExperimentValidationError(
          "series-unknown-publication-id",
          `Series "${sRaw.id}" references unknown publicationId "${sRaw.publicationId}".`,
          "HistoricalDataset",
          `${sPath}.publicationId`,
        );
      }
      let obsDate: PaperDate | undefined;
      if (sRaw.observationDate) {
        obsDate = validatePaperDate(
          sRaw.observationDate,
          sRaw.id as string,
          `${sPath}.observationDate`,
        );
        const pub = publications.find((p) => p.id === sRaw.publicationId);
        if (pub && obsDate.earliest > pub.publicationDate.latest) {
          throw new ExperimentValidationError(
            "observation-after-publication",
            `Series "${sRaw.id}" observationDate (${obsDate.earliest}) cannot be later than publicationDate (${pub.publicationDate.latest}).`,
            "HistoricalDataset",
            `${sPath}.observationDate`,
          );
        }
      }
      seriesList.push({
        id: sRaw.id,
        publicationId: sRaw.publicationId,
        observationDate: obsDate,
        description: (sRaw.description as string) || "",
      });
    }
  }

  // Digitizer
  if (!o.digitizer || typeof o.digitizer !== "object") {
    throw new ExperimentValidationError(
      "missing-digitizer",
      "digitizer block is required.",
      "HistoricalDataset",
      `${path}.digitizer`,
    );
  }
  const dig = o.digitizer as Record<string, unknown>;
  if (
    typeof dig.digitizationRevision !== "number" ||
    dig.digitizationRevision <= 0 ||
    !Number.isInteger(dig.digitizationRevision)
  ) {
    throw new ExperimentValidationError(
      "invalid-digitization-revision",
      "digitizationRevision must be a positive integer.",
      "HistoricalDataset",
      `${path}.digitizer.digitizationRevision`,
    );
  }

  // Columns
  if (!Array.isArray(o.columns) || o.columns.length === 0) {
    throw new ExperimentValidationError(
      "missing-columns",
      "columns must be a non-empty array.",
      "HistoricalDataset",
      `${path}.columns`,
    );
  }
  const columns: DatasetColumn[] = [];

  for (let i = 0; i < o.columns.length; i++) {
    const colRaw = o.columns[i] as Record<string, unknown>;
    const colPath = `${path}.columns[${i}]`;
    if (!colRaw || typeof colRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-column",
        "Column must be an object.",
        "HistoricalDataset",
        colPath,
      );
    }
    if ("derived" in colRaw && typeof colRaw.derived === "boolean") {
      throw new ExperimentValidationError(
        "retired-derived-boolean-flag",
        'Found retired boolean "derived" flag on column. Use role: "observed" | "controlled" | "derived" | "reported-fit".',
        "HistoricalDataset",
        colPath,
      );
    }
    if (!COLUMN_ROLES.includes(colRaw.role as ColumnRole)) {
      throw new ExperimentValidationError(
        "invalid-column-role",
        `Invalid column role "${colRaw.role}". Must be one of: observed, controlled, derived, reported-fit.`,
        "HistoricalDataset",
        `${colPath}.role`,
      );
    }
    if (colRaw.role === "reported-fit") {
      if (typeof colRaw.fitDescription !== "string" || !colRaw.fitDescription.trim()) {
        throw new ExperimentValidationError(
          "missing-fit-description",
          'Column with role "reported-fit" requires fitDescription naming what was fitted and by whom.',
          "HistoricalDataset",
          `${colPath}.fitDescription`,
        );
      }
    }
    columns.push({
      name: (colRaw.name as string) || `col-${i}`,
      quantityId: (colRaw.quantityId as string) || "",
      unit: (colRaw.unit as string) || "",
      role: colRaw.role as ColumnRole,
      fitDescription: (colRaw.fitDescription as string) || undefined,
    });
  }

  // Rows & Cells check
  const rows: DatasetRow[] = [];
  if (Array.isArray(o.rows)) {
    for (let r = 0; r < o.rows.length; r++) {
      const rRaw = o.rows[r] as Record<string, unknown>;
      const rPath = `${path}.rows[${r}]`;
      if (!rRaw || !Array.isArray(rRaw.cells)) {
        throw new ExperimentValidationError(
          "invalid-row",
          "Row must be an object with cells array.",
          "HistoricalDataset",
          rPath,
        );
      }
      if (rRaw.cells.length !== columns.length) {
        throw new ExperimentValidationError(
          "cell-count-mismatch",
          `Row ${r} has ${rRaw.cells.length} cells, but dataset declares ${columns.length} columns.`,
          "HistoricalDataset",
          rPath,
        );
      }
      const cells = rRaw.cells.map((c, cIdx) => validateDataCell(c, `${rPath}.cells[${cIdx}]`));
      rows.push({
        seriesId: (rRaw.seriesId as string) || undefined,
        cells,
      });
    }
  }

  // allowedInferenceModelIds is REQUIRED and may be empty
  if (!Array.isArray(o.allowedInferenceModelIds)) {
    throw new ExperimentValidationError(
      "missing-allowed-inference-models",
      "allowedInferenceModelIds is required (may be empty []). An absent list is rejected to prevent unvetted inferences.",
      "HistoricalDataset",
      `${path}.allowedInferenceModelIds`,
    );
  }

  // addressesResults check
  const addressesResults: DatasetAddressesResult[] = [];
  if (Array.isArray(o.addressesResults)) {
    for (let i = 0; i < o.addressesResults.length; i++) {
      const arRaw = o.addressesResults[i] as Record<string, unknown>;
      const arPath = `${path}.addressesResults[${i}]`;
      if (!DATASET_RESULT_RELATIONS.includes(arRaw.relation as DatasetResultRelation)) {
        throw new ExperimentValidationError(
          "invalid-result-relation",
          `Invalid addressesResults relation "${arRaw.relation}". Vocabulary is strictly: tested-a-prediction, measured-a-quantity-the-result-uses, reinterpreted, narrowed-the-domain, disputed ("confirmed" and "proved" are forbidden).`,
          "HistoricalDataset",
          `${arPath}.relation`,
        );
      }
      if (typeof arRaw.statement !== "string" || !arRaw.statement.trim()) {
        throw new ExperimentValidationError(
          "missing-result-statement",
          "addressesResults entry requires statement sentence.",
          "HistoricalDataset",
          `${arPath}.statement`,
        );
      }
      addressesResults.push({
        resultId: arRaw.resultId as string,
        relation: arRaw.relation as DatasetResultRelation,
        statement: arRaw.statement as string,
        openQuestion: (arRaw.openQuestion as string) || undefined,
      });
    }
  }

  // Fits
  const fitsList: DatasetFit[] = [];
  if (Array.isArray(o.fits)) {
    for (let f = 0; f < o.fits.length; f++) {
      const fRaw = o.fits[f] as Record<string, unknown>;
      const fPath = `${path}.fits[${f}]`;
      if (!fRaw || typeof fRaw !== "object") {
        throw new ExperimentValidationError(
          "invalid-fit",
          "Fit must be an object.",
          "HistoricalDataset",
          fPath,
        );
      }
      if (typeof fRaw.id !== "string" || !fRaw.id.trim()) {
        throw new ExperimentValidationError(
          "missing-fit-id",
          "Fit id is required.",
          "HistoricalDataset",
          `${fPath}.id`,
        );
      }
      if (typeof fRaw.label !== "string" || !fRaw.label.trim()) {
        throw new ExperimentValidationError(
          "missing-fit-label",
          "Fit label is required.",
          "HistoricalDataset",
          `${fPath}.label`,
        );
      }
      if (typeof fRaw.fitObjective !== "string" || !fRaw.fitObjective.trim()) {
        throw new ExperimentValidationError(
          "missing-fit-objective",
          "Fit fitObjective is required.",
          "HistoricalDataset",
          `${fPath}.fitObjective`,
        );
      }
      if (!fRaw.analysisDate) {
        throw new ExperimentValidationError(
          "missing-analysis-date",
          `Fit "${fRaw.id}" requires analysisDate.`,
          "HistoricalDataset",
          `${fPath}.analysisDate`,
        );
      }
      const analysisDate = validatePaperDate(
        fRaw.analysisDate,
        fRaw.id as string,
        `${fPath}.analysisDate`,
      );

      const seriesId = typeof fRaw.seriesId === "string" ? fRaw.seriesId : undefined;
      if (seriesId && !seriesIds.has(seriesId)) {
        throw new ExperimentValidationError(
          "fit-unknown-series-id",
          `Fit "${fRaw.id}" references unknown seriesId "${seriesId}".`,
          "HistoricalDataset",
          `${fPath}.seriesId`,
        );
      }

      // Determine series rows count to check partitioning
      const seriesRows = seriesId ? rows.filter((r) => r.seriesId === seriesId) : rows;
      const expectedRowCount = seriesRows.length;

      if (!Array.isArray(fRaw.rowsUsed)) {
        throw new ExperimentValidationError(
          "missing-rows-used",
          `Fit "${fRaw.id}" requires rowsUsed array.`,
          "HistoricalDataset",
          `${fPath}.rowsUsed`,
        );
      }
      if (!Array.isArray(fRaw.rowsExcluded)) {
        throw new ExperimentValidationError(
          "missing-rows-excluded",
          `Fit "${fRaw.id}" requires rowsExcluded array.`,
          "HistoricalDataset",
          `${fPath}.rowsExcluded`,
        );
      }

      const usedSet = new Set<number>();
      for (const u of fRaw.rowsUsed) {
        if (typeof u !== "number" || !Number.isInteger(u) || u < 0 || u >= expectedRowCount) {
          throw new ExperimentValidationError(
            "invalid-row-used-index",
            `Fit "${fRaw.id}" invalid rowsUsed index ${u} (expected 0..${expectedRowCount - 1}).`,
            "HistoricalDataset",
            `${fPath}.rowsUsed`,
          );
        }
        if (usedSet.has(u)) {
          throw new ExperimentValidationError(
            "duplicate-row-used",
            `Fit "${fRaw.id}" duplicate row ${u} in rowsUsed.`,
            "HistoricalDataset",
            `${fPath}.rowsUsed`,
          );
        }
        usedSet.add(u);
      }

      const excludedSet = new Set<number>();
      const exclusions: DatasetFitExclusion[] = [];
      for (let eIdx = 0; eIdx < fRaw.rowsExcluded.length; eIdx++) {
        const ex = fRaw.rowsExcluded[eIdx] as Record<string, unknown>;
        const exPath = `${fPath}.rowsExcluded[${eIdx}]`;
        if (!ex || typeof ex !== "object") {
          throw new ExperimentValidationError(
            "invalid-fit-exclusion",
            "Fit exclusion must be an object.",
            "HistoricalDataset",
            exPath,
          );
        }
        if (
          typeof ex.rowIndex !== "number" ||
          !Number.isInteger(ex.rowIndex) ||
          ex.rowIndex < 0 ||
          ex.rowIndex >= expectedRowCount
        ) {
          throw new ExperimentValidationError(
            "invalid-row-excluded-index",
            `Fit "${fRaw.id}" invalid rowsExcluded rowIndex ${ex.rowIndex}.`,
            "HistoricalDataset",
            `${exPath}.rowIndex`,
          );
        }
        if (typeof ex.reason !== "string" || !ex.reason.trim()) {
          throw new ExperimentValidationError(
            "empty-exclusion-reason",
            `Row ${ex.rowIndex} exclusion reason cannot be empty in fit "${fRaw.id}".`,
            "HistoricalDataset",
            `${exPath}.reason`,
          );
        }
        if (excludedSet.has(ex.rowIndex)) {
          throw new ExperimentValidationError(
            "duplicate-row-excluded",
            `Fit "${fRaw.id}" duplicate row ${ex.rowIndex} in rowsExcluded.`,
            "HistoricalDataset",
            exPath,
          );
        }
        if (usedSet.has(ex.rowIndex)) {
          throw new ExperimentValidationError(
            "row-in-both-used-and-excluded",
            `Row ${ex.rowIndex} of dataset "${o.id}" series "${seriesId ?? "default"}" appears in both rowsUsed and rowsExcluded in fit "${fRaw.id}".`,
            "HistoricalDataset",
            exPath,
          );
        }
        excludedSet.add(ex.rowIndex);
        exclusions.push({ rowIndex: ex.rowIndex, reason: ex.reason.trim() });
      }

      // Check that all rows in 0..expectedRowCount-1 are covered
      for (let i = 0; i < expectedRowCount; i++) {
        if (!usedSet.has(i) && !excludedSet.has(i)) {
          throw new ExperimentValidationError(
            "uncovered-fit-row",
            `Row ${i} of dataset "${o.id}" series "${seriesId ?? "default"}" is neither in rowsUsed nor in rowsExcluded in fit "${fRaw.id}".`,
            "HistoricalDataset",
            fPath,
          );
        }
      }

      // Parameters
      const parameters: DatasetFitParameter[] = [];
      if (!Array.isArray(fRaw.parameters) || fRaw.parameters.length === 0) {
        throw new ExperimentValidationError(
          "missing-fit-parameters",
          `Fit "${fRaw.id}" requires non-empty parameters array.`,
          "HistoricalDataset",
          `${fPath}.parameters`,
        );
      }
      for (let pIdx = 0; pIdx < fRaw.parameters.length; pIdx++) {
        const param = fRaw.parameters[pIdx] as Record<string, unknown>;
        const pSubPath = `${fPath}.parameters[${pIdx}]`;
        if (!param || typeof param !== "object") {
          throw new ExperimentValidationError(
            "invalid-fit-parameter",
            "Fit parameter must be an object.",
            "HistoricalDataset",
            pSubPath,
          );
        }
        if (typeof param.name !== "string" || !param.name.trim()) {
          throw new ExperimentValidationError(
            "missing-fit-parameter-name",
            "Fit parameter name required.",
            "HistoricalDataset",
            `${pSubPath}.name`,
          );
        }
        if (typeof param.quantityId !== "string" || !param.quantityId.trim()) {
          throw new ExperimentValidationError(
            "missing-fit-parameter-quantity-id",
            "Fit parameter quantityId required.",
            "HistoricalDataset",
            `${pSubPath}.quantityId`,
          );
        }
        if (typeof param.value !== "number" || Number.isNaN(param.value)) {
          throw new ExperimentValidationError(
            "missing-fit-parameter-value",
            "Fit parameter value required.",
            "HistoricalDataset",
            `${pSubPath}.value`,
          );
        }
        if (typeof param.unit !== "string") {
          throw new ExperimentValidationError(
            "missing-fit-parameter-unit",
            "Fit parameter unit required.",
            "HistoricalDataset",
            `${pSubPath}.unit`,
          );
        }
        if (param.source !== "fitted-here" && param.source !== "imported") {
          throw new ExperimentValidationError(
            "invalid-fit-parameter-source",
            `Fit parameter source must be "fitted-here" | "imported" (got "${param.source}").`,
            "HistoricalDataset",
            `${pSubPath}.source`,
          );
        }
        parameters.push({
          name: param.name as string,
          quantityId: param.quantityId as string,
          value: param.value as number,
          unit: param.unit as string,
          uncertainty: typeof param.uncertainty === "number" ? param.uncertainty : undefined,
          source: param.source as "fitted-here" | "imported",
          sourceCitation:
            typeof param.sourceCitation === "string" ? param.sourceCitation : undefined,
        });
      }

      fitsList.push({
        id: fRaw.id as string,
        seriesId,
        label: fRaw.label as string,
        fitObjective: fRaw.fitObjective as string,
        analysisDate,
        rowsUsed: [...fRaw.rowsUsed] as number[],
        rowsExcluded: exclusions,
        parameters,
        fitDescription: typeof fRaw.fitDescription === "string" ? fRaw.fitDescription : undefined,
      });
    }
  }

  return {
    id: o.id as string,
    title: o.title as string,
    ...validateDatasetWithdrawal(o, path),
    publications,
    primaryPublicationId: o.primaryPublicationId as string,
    series: seriesList.length > 0 ? seriesList : undefined,
    digitizer: {
      name: dig.name as string,
      method: dig.method as string,
      date: dig.date as string | PaperDate,
      sourcePageImage: dig.sourcePageImage as string,
      digitizationRevision: dig.digitizationRevision as number,
    },
    columns,
    rows,
    uncertainty: (o.uncertainty as HistoricalDataset["uncertainty"]) || {
      type: "none",
      description: "None reported",
    },
    notes: (o.notes as string) || "",
    rights: o.rights as SourceAssetRights,
    allowedInferenceModelIds: o.allowedInferenceModelIds as string[],
    calibrationIds: Array.isArray(o.calibrationIds) ? (o.calibrationIds as string[]) : undefined,
    sharedInputIds: Array.isArray(o.sharedInputIds) ? (o.sharedInputIds as string[]) : undefined,
    addressesResults: addressesResults.length > 0 ? addressesResults : undefined,
    fits: fitsList.length > 0 ? fitsList : undefined,
  };
}

// ============================================================================
// 4. TOUR
// ============================================================================

export const TOUR_BUDGETS = ["fifteen-minutes", "one-evening", "full-course"] as const;
export type TourBudget = (typeof TOUR_BUDGETS)[number];

export type TourStepPreset = Readonly<{
  instrumentId: string;
  tapeId?: string | undefined;
  presetId?: string | undefined;
  promptId?: string | undefined;
}>;

export type TourStep = Readonly<{
  anchorId: string;
  detail: 0 | 1 | 2;
  instrumentPreset?: TourStepPreset | undefined;
  tourPrediction?: string | undefined;
  estimatedMinutes: number;
  purpose: string;
}>;

export type Tour = Readonly<{
  id: string;
  title: string;
  budget: TourBudget;
  papers: readonly string[];
  completionStatement: string;
  steps: readonly TourStep[];
  requiresEquations: boolean;
  syllabus?: readonly TourSyllabusSession[] | undefined;
}>;

export type TourSyllabusSession = Readonly<{
  session: number;
  title: string;
  prerequisites?: readonly string[] | undefined;
  steps: readonly string[];
}>;

export function validateTour(raw: unknown, path = "Tour"): Tour {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError("invalid-record", "Tour must be an object.", "Tour", path);
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError("missing-id", "Tour id is required.", "Tour", `${path}.id`);
  }
  if (!TOUR_BUDGETS.includes(o.budget as TourBudget)) {
    throw new ExperimentValidationError(
      "invalid-tour-budget",
      `Invalid tour budget "${o.budget}".`,
      "Tour",
      `${path}.budget`,
    );
  }
  const budget = o.budget as TourBudget;

  const requiresEquations = Boolean(o.requiresEquations);
  if (budget === "fifteen-minutes" && requiresEquations) {
    throw new ExperimentValidationError(
      "fifteen-minutes-requires-equations-forbidden",
      'A "fifteen-minutes" tour must have requiresEquations: false.',
      "Tour",
      `${path}.requiresEquations`,
    );
  }

  if (typeof o.completionStatement !== "string" || !o.completionStatement.trim()) {
    throw new ExperimentValidationError(
      "missing-completion-statement",
      "completionStatement is required.",
      "Tour",
      `${path}.completionStatement`,
    );
  }

  if (!Array.isArray(o.steps) || o.steps.length === 0) {
    throw new ExperimentValidationError(
      "missing-tour-steps",
      "steps must be a non-empty array.",
      "Tour",
      `${path}.steps`,
    );
  }

  const steps: TourStep[] = [];
  for (let i = 0; i < o.steps.length; i++) {
    const sRaw = o.steps[i] as Record<string, unknown>;
    const sPath = `${path}.steps[${i}]`;
    if (!sRaw || typeof sRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-tour-step",
        "Tour step must be an object.",
        "Tour",
        sPath,
      );
    }
    if (typeof sRaw.anchorId !== "string" || !sRaw.anchorId.trim()) {
      throw new ExperimentValidationError(
        "missing-step-anchor-id",
        "Tour step requires anchorId.",
        "Tour",
        `${sPath}.anchorId`,
      );
    }

    let instPreset: TourStepPreset | undefined;
    if (sRaw.instrumentPreset && typeof sRaw.instrumentPreset === "object") {
      const ip = sRaw.instrumentPreset as Record<string, unknown>;
      if (ip.tapeId && ip.presetId) {
        throw new ExperimentValidationError(
          "tape-and-preset-both-present",
          "Tour step instrumentPreset cannot declare both tapeId and presetId.",
          "Tour",
          `${sPath}.instrumentPreset`,
        );
      }
      if (ip.presetId && typeof ip.presetId === "string") {
        const psParsed = parsePresetId(ip.presetId);
        if (!psParsed.ok) {
          throw new ExperimentValidationError(
            "invalid-preset-id",
            psParsed.error,
            "Tour",
            `${sPath}.instrumentPreset.presetId`,
          );
        }
      }
      if (ip.promptId && typeof ip.promptId === "string") {
        const prParsed = parsePredictPromptId(ip.promptId);
        if (!prParsed.ok) {
          throw new ExperimentValidationError(
            "invalid-prompt-id",
            prParsed.error,
            "Tour",
            `${sPath}.instrumentPreset.promptId`,
          );
        }
      }
      instPreset = {
        instrumentId: ip.instrumentId as string,
        tapeId: (ip.tapeId as string) || undefined,
        presetId: (ip.presetId as string) || undefined,
        promptId: (ip.promptId as string) || undefined,
      };
    }

    if (instPreset?.promptId && sRaw.tourPrediction) {
      throw new ExperimentValidationError(
        "prompt-id-and-tour-prediction-collision",
        "Tour step cannot declare both promptId and tourPrediction. Use registered promptId or custom tourPrediction, not both.",
        "Tour",
        sPath,
      );
    }

    steps.push({
      anchorId: sRaw.anchorId as string,
      detail: (sRaw.detail as 0 | 1 | 2) || 0,
      instrumentPreset: instPreset,
      tourPrediction: (sRaw.tourPrediction as string) || undefined,
      estimatedMinutes: typeof sRaw.estimatedMinutes === "number" ? sRaw.estimatedMinutes : 1,
      purpose: (sRaw.purpose as string) || "",
    });
  }

  return {
    id: o.id as string,
    title: (o.title as string) || (o.id as string),
    budget,
    papers: Array.isArray(o.papers) ? (o.papers as string[]) : [],
    completionStatement: o.completionStatement as string,
    steps,
    requiresEquations,
    syllabus: Array.isArray(o.syllabus)
      ? (o.syllabus as readonly TourSyllabusSession[])
      : undefined,
  };
}

// ============================================================================
// 5. CONSTANT SETS
// ============================================================================

export const CONSTANT_ENTRY_KINDS = [
  "exact-defined",
  "measured",
  "printed-historical",
  "declared-scenario",
] as const;
export type ConstantEntryKind = (typeof CONSTANT_ENTRY_KINDS)[number];

export const PRINTED_STATUSES = ["printed", "editorial-input", "printed-corrected"] as const;
export type PrintedStatus = (typeof PRINTED_STATUSES)[number];

export type ConstantSetEntry = Readonly<{
  quantityId: string;
  value: number;
  exactDecimal: string;
  kind: ConstantEntryKind;
  printedStatus?: PrintedStatus | undefined;
  printedReading?: string | undefined;
  reason?: string | undefined;
  sensitivity?: string | undefined;
  correctedValue?: number | undefined;
  correctionReason?: string | undefined;
  receiptRef?: string | undefined;
  era: string;
  provenance: string;
  precision: string;
  uncertainty?: number | string | undefined;
  dependsOn?: readonly string[] | undefined;
  transcriptionStatus: "transcribed-and-checked" | "pending-transcription";
  checkedBy?: string | undefined;
  checkedAt?: string | undefined;
}>;

export type ConstantSet = Readonly<{
  id: string;
  era: string;
  provenance: string;
  precisionNote: string;
  gasConstantProvenance: "defined" | "measured-without-counting-molecules" | "not-applicable";
  entries: readonly ConstantSetEntry[];
}>;

export function validateConstantSet(raw: unknown, path = "ConstantSet"): ConstantSet {
  if (!raw || typeof raw !== "object") {
    throw new ExperimentValidationError(
      "invalid-record",
      "ConstantSet must be an object.",
      "ConstantSet",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ExperimentValidationError(
      "missing-id",
      "ConstantSet id is required.",
      "ConstantSet",
      `${path}.id`,
    );
  }

  // Reject retired ids
  if (o.id === "einstein-1905-brownian") {
    throw new ExperimentValidationError(
      "retired-constant-set-id",
      'Found retired constant set id "einstein-1905-brownian". Use "einstein-1905-brownian-printed".',
      "ConstantSet",
      `${path}.id`,
    );
  }

  if (
    !["defined", "measured-without-counting-molecules", "not-applicable"].includes(
      o.gasConstantProvenance as string,
    )
  ) {
    throw new ExperimentValidationError(
      "invalid-gas-constant-provenance",
      `Invalid gasConstantProvenance "${o.gasConstantProvenance}".`,
      "ConstantSet",
      `${path}.gasConstantProvenance`,
    );
  }

  if (!Array.isArray(o.entries) || o.entries.length === 0) {
    throw new ExperimentValidationError(
      "missing-entries",
      "entries must be a non-empty array.",
      "ConstantSet",
      `${path}.entries`,
    );
  }

  const entries: ConstantSetEntry[] = [];
  const isPrintedSet = (o.id as string).endsWith("-printed");

  for (let i = 0; i < o.entries.length; i++) {
    const eRaw = o.entries[i] as Record<string, unknown>;
    const ePath = `${path}.entries[${i}]`;
    if (!eRaw || typeof eRaw !== "object") {
      throw new ExperimentValidationError(
        "invalid-entry",
        "Constant entry must be an object.",
        "ConstantSet",
        ePath,
      );
    }
    if (!CONSTANT_ENTRY_KINDS.includes(eRaw.kind as ConstantEntryKind)) {
      throw new ExperimentValidationError(
        "invalid-entry-kind",
        `Invalid entry kind "${eRaw.kind}".`,
        "ConstantSet",
        `${ePath}.kind`,
      );
    }
    const kind = eRaw.kind as ConstantEntryKind;

    if (kind === "exact-defined" && eRaw.uncertainty !== undefined) {
      throw new ExperimentValidationError(
        "exact-defined-has-uncertainty",
        'Entry of kind "exact-defined" must not carry uncertainty.',
        "ConstantSet",
        `${ePath}.uncertainty`,
      );
    }
    if (kind === "measured" && eRaw.uncertainty === undefined) {
      throw new ExperimentValidationError(
        "measured-missing-uncertainty",
        'Entry of kind "measured" requires uncertainty.',
        "ConstantSet",
        `${ePath}.uncertainty`,
      );
    }

    if (isPrintedSet || kind === "printed-historical") {
      if (!PRINTED_STATUSES.includes(eRaw.printedStatus as PrintedStatus)) {
        throw new ExperimentValidationError(
          "missing-printed-status",
          'Entry in printed-historical constant set requires printedStatus: "printed" | "editorial-input" | "printed-corrected".',
          "ConstantSet",
          `${ePath}.printedStatus`,
        );
      }
      const pStatus = eRaw.printedStatus as PrintedStatus;
      if (pStatus === "printed" && !eRaw.printedReading) {
        throw new ExperimentValidationError(
          "printed-missing-reading",
          'printedStatus "printed" requires printedReading.',
          "ConstantSet",
          `${ePath}.printedReading`,
        );
      }
      if (pStatus === "editorial-input") {
        if (!eRaw.reason || !eRaw.sensitivity) {
          throw new ExperimentValidationError(
            "editorial-input-missing-reason-sensitivity",
            'printedStatus "editorial-input" requires reason and sensitivity.',
            "ConstantSet",
            ePath,
          );
        }
      }
      if (pStatus === "printed-corrected") {
        if (!eRaw.receiptRef || !eRaw.printedReading || eRaw.correctedValue === undefined) {
          throw new ExperimentValidationError(
            "printed-corrected-missing-receipt-ref",
            'printedStatus "printed-corrected" requires receiptRef, printedReading, and correctedValue.',
            "ConstantSet",
            ePath,
          );
        }
      }
    }

    if (eRaw.transcriptionStatus === "transcribed-and-checked") {
      if (!eRaw.checkedBy || !eRaw.checkedAt) {
        throw new ExperimentValidationError(
          "checked-missing-checked-by-at",
          'transcriptionStatus "transcribed-and-checked" requires checkedBy and checkedAt.',
          "ConstantSet",
          ePath,
        );
      }
    }

    entries.push({
      quantityId: eRaw.quantityId as string,
      value: eRaw.value as number,
      exactDecimal: (eRaw.exactDecimal as string) || String(eRaw.value),
      kind,
      printedStatus:
        typeof eRaw.printedStatus === "string" ? (eRaw.printedStatus as PrintedStatus) : undefined,
      printedReading: (eRaw.printedReading as string) || undefined,
      reason: (eRaw.reason as string) || undefined,
      sensitivity: (eRaw.sensitivity as string) || undefined,
      correctedValue: typeof eRaw.correctedValue === "number" ? eRaw.correctedValue : undefined,
      correctionReason: (eRaw.correctionReason as string) || undefined,
      receiptRef: (eRaw.receiptRef as string) || undefined,
      era: (eRaw.era as string) || "",
      provenance: (eRaw.provenance as string) || "",
      precision: (eRaw.precision as string) || "",
      uncertainty:
        typeof eRaw.uncertainty === "number" || typeof eRaw.uncertainty === "string"
          ? eRaw.uncertainty
          : undefined,
      dependsOn: Array.isArray(eRaw.dependsOn) ? (eRaw.dependsOn as string[]) : undefined,
      transcriptionStatus:
        (eRaw.transcriptionStatus as "transcribed-and-checked" | "pending-transcription") ||
        "transcribed-and-checked",
      checkedBy: (eRaw.checkedBy as string) || undefined,
      checkedAt: (eRaw.checkedAt as string) || undefined,
    });
  }

  return {
    id: o.id as string,
    era: (o.era as string) || "",
    provenance: (o.provenance as string) || "",
    precisionNote: (o.precisionNote as string) || "",
    gasConstantProvenance: o.gasConstantProvenance as
      | "defined"
      | "measured-without-counting-molecules"
      | "not-applicable",
    entries,
  };
}

// ============================================================================
// HISTORICAL DATASET WITHDRAWAL
// Kept at the end of the file: the refusal tests above cite their sites by line.
// ============================================================================

/**
 * "withdrawn" keeps a record that can no longer be offered as evidence, with the reason, instead of
 * deleting it: a record whose values could not be traced to the printed source stays reviewable
 * beside the finding that withdrew it, and no view plots it.
 */
export const DATASET_EVIDENCE_STATUSES = [
  "historical-measurement",
  "modern-observation",
  "withdrawn",
] as const;
export type DatasetEvidenceStatus = (typeof DATASET_EVIDENCE_STATUSES)[number];

export type DatasetWithdrawal = Readonly<{
  date: string;
  reason: string;
}>;

export type HistoricalDataset = HistoricalDatasetFields &
  Readonly<{
    withdrawal?: DatasetWithdrawal | undefined;
  }>;

/**
 * Whether a view may show a HistoricalDataset's values (am-data-millikan-1916-zh2q).
 *
 * Only a standing measurement is shown. A withdrawn record keeps its rows on file for review, and
 * every view that plots, tabulates or cites a dataset as evidence asks this first. The Millikan 1916
 * sodium record was plotted on LQ-08 as measurements while its six rows sat on one straight line to
 * a fifth of a millivolt, and nothing between the record and the plot could say no.
 */
const SHOWN_EVIDENCE: ReadonlySet<DatasetEvidenceStatus> = new Set([
  "historical-measurement",
  "modern-observation",
]);

export function datasetValuesMayBeShown(
  dataset: Pick<HistoricalDataset, "evidenceStatus">,
): boolean {
  return SHOWN_EVIDENCE.has(dataset.evidenceStatus);
}

/** A withdrawn record says when and why; a standing one carries no withdrawal. */
function validateDatasetWithdrawal(
  o: Record<string, unknown>,
  path: string,
): Readonly<{ evidenceStatus: DatasetEvidenceStatus; withdrawal?: DatasetWithdrawal | undefined }> {
  const evidenceStatus = o.evidenceStatus as DatasetEvidenceStatus;
  const raw = o.withdrawal as Record<string, unknown> | undefined;
  if (evidenceStatus !== "withdrawn") {
    if (raw !== undefined) {
      throw new ExperimentValidationError(
        "unexpected-withdrawal",
        `A dataset with evidenceStatus "${evidenceStatus}" cannot carry a withdrawal.`,
        "HistoricalDataset",
        `${path}.withdrawal`,
      );
    }
    return { evidenceStatus };
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof raw.reason !== "string" ||
    !raw.reason.trim() ||
    typeof raw.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)
  ) {
    throw new ExperimentValidationError(
      "missing-withdrawal",
      "A withdrawn dataset must say when it was withdrawn (YYYY-MM-DD) and why.",
      "HistoricalDataset",
      `${path}.withdrawal`,
    );
  }
  return { evidenceStatus, withdrawal: { date: raw.date, reason: raw.reason } };
}

// ============================================================================
// PREDICT PROMPT: THE SUPPORTED CANDIDATE
// Kept at the end of the file: the refusal tests above cite their sites by line.
// ============================================================================

/**
 * A predict prompt names which of its candidates the laboratory's model supports
 * (am-inst-predict-mode-ti7m). PredictPanel needs it to reveal the chosen candidate's separating
 * assumption after the result; until 2026-09-24 no manifest carried it, so every adoption had to
 * copy the prompt into TypeScript by hand, as ME-02 did.
 */
export type PredictPrompt = PredictPromptFields &
  Readonly<{
    supportedCandidateId?: string | undefined;
    /**
     * Why the supported relation holds, shown after the reader answers. Five laboratories (LQ-06,
     * LQ-08, LQ-09, ME-01, ME-03) keep this sentence in their own TypeScript copy of the prompt; it
     * belongs with the prompt, so the panel drawn from the manifest can show it too.
     */
    explanation?: string | undefined;
  }>;

function promptCandidates(
  pr: Record<string, unknown>,
  candidates: readonly PredictCandidate[],
  prPath: string,
): Readonly<{
  candidates: readonly PredictCandidate[];
  supportedCandidateId?: string;
  explanation?: string;
}> {
  const explanation = pr.explanation;
  if (explanation !== undefined && (typeof explanation !== "string" || !explanation.trim())) {
    throw new ExperimentValidationError(
      "predict-explanation-invalid",
      `Predict prompt "${String(pr.promptId)}" has an explanation that is not a sentence: it must be non-empty text when present.`,
      "Experiment",
      `${prPath}.explanation`,
    );
  }
  const explained = typeof explanation === "string" ? { explanation } : {};
  const supported = pr.supportedCandidateId;
  if (supported === undefined) return { candidates, ...explained };
  if (typeof supported !== "string" || !candidates.some((c) => c.id === supported)) {
    throw new ExperimentValidationError(
      "predict-supported-candidate-unknown",
      `Predict prompt "${String(pr.promptId)}" names supportedCandidateId "${String(supported)}", which is not one of its candidates (${candidates.map((c) => c.id).join(", ")}).`,
      "Experiment",
      `${prPath}.supportedCandidateId`,
    );
  }
  return { candidates, supportedCandidateId: supported, ...explained };
}
