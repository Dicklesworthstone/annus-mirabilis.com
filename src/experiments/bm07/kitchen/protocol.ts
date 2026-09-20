import { getConstantSet } from "../../../physics/reference/constants.ts";
import { withinTolerance } from "../../../units/tolerance.ts";
import { decodeResultBatch } from "../../results/codec.ts";
import type { RequestToken } from "../../store/instanceStore.ts";
import { parseKitchenCsv } from "./csv.ts";
import { KITCHEN_OUTPUTS, type KitchenAnalysis, type KitchenOptions } from "./definition.ts";
import { KITCHEN_LIMITS, type KitchenDocument } from "./schema.ts";
import { kitchenInputBox } from "./uncertainty.ts";
export const KITCHEN_PROTOCOL = "kitchen-import-host-v1";
export type KitchenRequest = Readonly<{
  version: typeof KITCHEN_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
  csv: string;
}>;
export type KitchenResponse = Readonly<{
  version: typeof KITCHEN_PROTOCOL;
  sourceDigest: string;
  token: RequestToken;
  result: { kind: "accepted"; analysis: KitchenAnalysis } | { kind: "refused"; message: string };
}>;
export function closed(
  input: unknown,
  keys: readonly string[],
): asserts input is Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => {
      if (typeof k !== "string" || !keys.includes(k)) return true;
      const desc = Object.getOwnPropertyDescriptor(input, k);
      return !desc || !Object.hasOwn(desc, "value");
    })
  )
    throw new TypeError("Unrecognized data contract.");
}
export function checkCsvSize(csv: unknown): asserts csv is string {
  if (
    typeof csv !== "string" ||
    csv.length > KITCHEN_LIMITS.bytes ||
    new TextEncoder().encode(csv).byteLength > KITCHEN_LIMITS.bytes
  )
    throw new TypeError("The observation CSV must be at most 2 MiB.");
}
export async function textDigest(text: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
  return `sha256:${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export function validateKitchenOptions(raw: unknown): KitchenOptions {
  closed(raw, ["track", "axis", "coverage", "constantSet"]);
  if (
    typeof raw.track !== "string" ||
    raw.track.length > 256 ||
    !["x", "y"].includes(String(raw.axis)) ||
    typeof raw.coverage !== "number" ||
    !Number.isFinite(raw.coverage) ||
    raw.coverage < 0.5 ||
    raw.coverage > 0.999 ||
    !["metadata", "modern-si-2019", "scenario-gas-constant-measured"].includes(
      String(raw.constantSet),
    )
  )
    throw new TypeError("Choose a track, x or y, a registered constant set and 50–99.9% coverage.");
  return Object.freeze({ ...raw }) as KitchenOptions;
}
export function optionsFromToken(token: RequestToken): KitchenOptions {
  const { track, axis, coverage, constantSet } = token.parameters;
  return validateKitchenOptions({ track, axis, coverage, constantSet });
}
function source(digest: string) {
  if (!/^source:sha256:[a-f0-9]{64}$/.test(digest))
    throw new TypeError("Missing evaluator source identity.");
}
function tokenContract(input: unknown): asserts input is RequestToken {
  closed(input, [
    "instanceId",
    "experimentId",
    "runId",
    "parentRunId",
    "actionIndex",
    "revisions",
    "parameters",
  ]);
  if (
    input.experimentId !== "bm-07-kitchen" ||
    typeof input.instanceId !== "string" ||
    input.instanceId.length > 256 ||
    typeof input.runId !== "string" ||
    input.runId.length > 512 ||
    (input.parentRunId !== null && typeof input.parentRunId !== "string") ||
    !Number.isSafeInteger(input.actionIndex) ||
    Number(input.actionIndex) < 1
  )
    throw new TypeError("Wrong observation request identity.");
  closed(input.revisions, ["input", "observer", "measurement", "estimator"]);
  if (Object.values(input.revisions).some((v) => !Number.isSafeInteger(v) || Number(v) < 0))
    throw new TypeError("Invalid observation revision.");
  closed(input.parameters, [
    "sourceId",
    "documentDigest",
    "track",
    "axis",
    "coverage",
    "constantSet",
  ]);
  for (const key of ["sourceId", "documentDigest"])
    if (
      typeof input.parameters[key] !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(input.parameters[key])
    )
      throw new TypeError("Missing observation digest.");
  optionsFromToken(input as RequestToken);
}
export async function decodeKitchenRequest(
  input: unknown,
  expectedSource: string,
): Promise<KitchenRequest> {
  closed(input, ["version", "sourceDigest", "token", "csv"]);
  source(expectedSource);
  if (input.version !== KITCHEN_PROTOCOL || input.sourceDigest !== expectedSource)
    throw new TypeError("The page and observation worker have different source versions.");
  tokenContract(input.token);
  checkCsvSize(input.csv);
  if ((await textDigest(input.csv)) !== input.token.parameters.documentDigest)
    throw new TypeError("The observation content does not match this request.");
  return input as KitchenRequest;
}
export function decodeKitchenResponse(
  input: unknown,
  request: KitchenRequest,
): { message: KitchenResponse; document: KitchenDocument | null } {
  closed(input, ["version", "sourceDigest", "token", "result"]);
  source(request.sourceDigest);
  tokenContract(input.token);
  if (
    input.version !== KITCHEN_PROTOCOL ||
    input.sourceDigest !== request.sourceDigest ||
    JSON.stringify(input.token) !== JSON.stringify(request.token)
  )
    throw new TypeError("The observation response belongs to a different request.");
  const r = input.result as KitchenResponse["result"];
  if (r?.kind === "refused") {
    closed(r, ["kind", "message"]);
    if (typeof r.message !== "string" || r.message.length > 4096)
      throw new TypeError("Invalid refusal.");
    return { message: input as KitchenResponse, document: null };
  }
  closed(r, ["kind", "analysis"]);
  if (r.kind !== "accepted") throw new TypeError("Unknown observation response.");
  const a = r.analysis;
  closed(a, [
    "options",
    "tracks",
    "selectedTrack",
    "outputs",
    "warnings",
    "intervalReasons",
    "counts",
    "lostPairs",
    "scale",
    "scaleSource",
    "constantSetId",
    "gasConstantProvenance",
    "numberMeaning",
    "combinedIntervalReason",
    "uncertainty",
  ]);
  if (
    JSON.stringify(validateKitchenOptions(a.options)) !==
    JSON.stringify(optionsFromToken(request.token))
  )
    throw new TypeError("Wrong analysis options.");
  const document = parseKitchenCsv(request.csv);
  const u = a.uncertainty;
  closed(u, ["state", "scaleExponent", "inputCoverage", "cameraCoverage", "combinedCoverage"]);
  if (
    !["unavailable", "sensitivity", "combined"].includes(u.state) ||
    ![null, -2, -3].includes(u.scaleExponent) ||
    [u.inputCoverage, u.cameraCoverage, u.combinedCoverage].some(
      (p) => p !== null && (typeof p !== "number" || !Number.isFinite(p) || p <= 0 || p > 1),
    ) ||
    u.inputCoverage !==
      (document.metadata.physical_input_coverage
        ? Number(document.metadata.physical_input_coverage)
        : null)
  )
    throw new TypeError("Invalid input-uncertainty declaration.");
  if (
    u.state !== "unavailable" &&
    (u.scaleExponent === null ||
      a.scaleSource !== "measured" ||
      !["independent", a.options.axis].includes(document.metadata.radius_scale_axis) ||
      (document.metadata.radius_scale_axis !== "independent" &&
        (document.metadata.calibration_axes !== "both" || !document.metadata.pixel_aspect_ratio)) ||
      document.metadata.radius_provenance !== "independent" ||
      u.scaleExponent !== (document.metadata.radius_scale_axis === "independent" ? -2 : -3))
  )
    throw new TypeError("The radius/calibration dependence was not declared.");
  if (u.state !== "unavailable") {
    const setId =
      a.options.constantSet === "metadata"
        ? document.metadata.constant_set_id
        : a.options.constantSet;
    if (
      a.constantSetId !== setId ||
      a.scale === null ||
      a.scale !== 1e-6 / Number(document.metadata[`pixels_per_um_${a.options.axis}`]) ||
      kitchenInputBox(document, a.options.axis, a.scaleSource, a.scale, getConstantSet(setId))
        .kind !== "accepted"
    )
      throw new TypeError("The declared physical-input box does not support this result.");
  }
  if (u.state === "combined") {
    if (
      u.inputCoverage === null ||
      u.cameraCoverage === null ||
      u.combinedCoverage === null ||
      !document.metadata.physical_input_provenance ||
      u.combinedCoverage < a.options.coverage ||
      u.combinedCoverage > Math.min(u.inputCoverage, u.cameraCoverage) ||
      !withinTolerance(u.combinedCoverage, 1 - (1 - u.inputCoverage + (1 - u.cameraCoverage)), {
        absolute: 16 * Number.EPSILON,
      }).ok
    )
      throw new TypeError("Combined coverage is not supported by its declared error budget.");
  } else if (u.combinedCoverage !== null)
    throw new TypeError("An unavailable interval cannot claim combined coverage.");
  if (
    !Array.isArray(a.tracks) ||
    a.tracks.length > document.points.length ||
    !a.tracks.some((t) => t.key === a.selectedTrack)
  )
    throw new TypeError("Wrong selected track.");
  for (const t of a.tracks) {
    closed(t, ["key", "label", "indices"]);
    if (
      typeof t.key !== "string" ||
      t.key.length > 256 ||
      typeof t.label !== "string" ||
      t.label.length > 256 ||
      !Array.isArray(t.indices) ||
      t.indices.length > document.points.length ||
      t.indices.some((i) => !Number.isInteger(i) || i < 0 || i >= document.points.length)
    )
      throw new TypeError("Invalid track layout.");
  }
  for (const key of ["warnings", "intervalReasons"] as const)
    if (
      !Array.isArray(a[key]) ||
      a[key].length > 64 ||
      a[key].some((s) => typeof s !== "string" || s.length > 4096)
    )
      throw new TypeError("Invalid interval explanation.");
  closed(a.counts, [
    "measured",
    "interpolated",
    "excluded",
    "lost",
    "attemptedPairs",
    "retainedPairs",
    "stationary",
  ]);
  if (
    Object.values(a.counts).some((n) => !Number.isSafeInteger(n) || n < 0 || n > 20000) ||
    a.counts.retainedPairs > a.counts.attemptedPairs
  )
    throw new TypeError("Invalid observation counts.");
  if (
    !["measured", "derived", "unknown"].includes(a.scaleSource) ||
    (a.scale !== null && (!(a.scale > 0) || !Number.isFinite(a.scale))) ||
    !["synthetic-recovery", "independent-estimate", "consistency-check", "unavailable"].includes(
      a.numberMeaning,
    )
  )
    throw new TypeError("Invalid calibration or interpretation.");
  for (const key of ["constantSetId", "gasConstantProvenance", "combinedIntervalReason"] as const)
    if (typeof a[key] !== "string" || a[key].length > 4096)
      throw new TypeError("Invalid provenance.");
  if (
    !a.lostPairs ||
    typeof a.lostPairs !== "object" ||
    Object.keys(a.lostPairs).length > 16 ||
    Object.entries(a.lostPairs).some(
      ([k, v]) => k.length > 80 || !Number.isInteger(v) || v < 0 || v > 20000,
    )
  )
    throw new TypeError("Invalid lost-pair report.");
  const outputs = decodeResultBatch(
    { revisions: request.token.revisions, outputs: a.outputs },
    {
      expectedRevisions: request.token.revisions,
      allowPartial: true,
      statuses: Object.fromEntries(
        Object.entries(KITCHEN_OUTPUTS).map(([k, c]) => [k, c.statuses]),
      ),
    },
  ).outputs;
  for (const output of outputs) {
    const c = KITCHEN_OUTPUTS[output.quantityId as keyof typeof KITCHEN_OUTPUTS];
    if (
      output.ownerId !== c.ownerId ||
      output.unit !== c.unit ||
      output.semanticKind !== c.semanticKind
    )
      throw new TypeError("Mismatched observation quantity.", {
        cause: { code: "mismatched-observation-quantity" },
      });
    if (output.status !== "value") continue;
    const length = ["pairs", "pairTimes"].includes(output.quantityId)
      ? 2 * a.counts.retainedPairs
      : [
            "diffusionInterval",
            "molecularInterval",
            "molecularInputRange",
            "combinedMolecularInterval",
            "combinedSamplingInterval",
          ].includes(output.quantityId)
        ? 2
        : null;
    if (
      length === null
        ? typeof output.value !== "number"
        : !(output.value instanceof Float64Array) || output.value.length !== length
    )
      throw new TypeError("Malformed observation buffer.", {
        cause: { code: "malformed-observation-buffer" },
      });
    if (
      (output.quantityId === "pairCount" && output.value !== a.counts.retainedPairs) ||
      (output.quantityId === "pairDegrees" &&
        output.value !== Math.max(0, a.counts.retainedPairs - 1))
    )
      throw new TypeError("Wrong pair degrees of freedom.", {
        cause: { code: "wrong-pair-degrees-of-freedom" },
      });
    if (
      [
        "diffusionInterval",
        "molecularInterval",
        "molecularInputRange",
        "combinedMolecularInterval",
        "combinedSamplingInterval",
      ].includes(output.quantityId)
    ) {
      const b = output.value as Float64Array;
      const lower = b[0];
      const upper = b[1];
      if (
        lower === undefined ||
        upper === undefined ||
        a.intervalReasons.length ||
        lower < 0 ||
        lower > upper
      )
        throw new TypeError("Inadmissible confidence set.", {
          cause: { code: "inadmissible-confidence-set" },
        });
    }
    if (
      [
        "molecularNumber",
        "molecularInterval",
        "molecularInputRange",
        "combinedMolecularInterval",
      ].includes(output.quantityId) &&
      document.metadata.radius_provenance !== "independent"
    )
      throw new TypeError("Circular or undeclared radius.", {
        cause: { code: "circular-or-undeclared-radius" },
      });
  }
  if (u.state === "combined") {
    const camera = outputs.find((o) => o.quantityId === "combinedSamplingInterval");
    if (
      camera?.status !== "value" ||
      !(camera.value instanceof Float64Array) ||
      !(camera.value[0]! > 0)
    )
      throw new TypeError(
        "A zero-containing diffusion set has no finite upper molecular-number bound.",
        {
          cause: { code: "zero-containing-diffusion-set" },
        },
      );
  }
  const hasValue = (id: string) => outputs.some((o) => o.quantityId === id && o.status === "value");
  if (
    hasValue("combinedMolecularInterval") !== (u.state === "combined") ||
    hasValue("molecularInputRange") !== (u.state !== "unavailable") ||
    (hasValue("combinedSamplingInterval") && u.cameraCoverage === null) ||
    (u.state === "combined" &&
      (!hasValue("combinedSamplingInterval") || Object.keys(a.lostPairs).length > 0))
  )
    throw new TypeError("Uncertainty results and coverage report disagree.", {
      cause: { code: "uncertainty-coverage-disagreement" },
    });
  return {
    message: {
      ...input,
      result: { kind: "accepted", analysis: { ...a, outputs } },
    } as KitchenResponse,
    document,
  };
}
