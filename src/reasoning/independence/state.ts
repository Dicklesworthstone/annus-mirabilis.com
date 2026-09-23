import {
  compareOccupancyModels, compareOccupancyEvidence, distinguishOccupancy,
  validateOccupancySettings, OccupancyModelError, OCCUPANCY_CHECKS,
  type OccupancyCheck, type OccupancyComparison, type OccupancyEvidence, type OccupancySettings,
} from "../../physics/reference/configurationCountermodels.ts";

// The workbench reads the owner's check ids, point limit and two types through this module, so the
// component never imports the physics owner itself (the no-physics-in-components boundary).
export { MAX_OCCUPANCY_POINTS, OCCUPANCY_CHECKS, type OccupancyCheck, type OccupancyLikelihood } from "../../physics/reference/configurationCountermodels.ts";

/** A refusal of what a reader entered or linked. The code is first so the refusal scanners read it
 * at the throw; the message is what the reader sees, unchanged. */
export class OccupancyInputError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OccupancyInputError";
    this.code = code;
  }
}

export const DEFAULT_OCCUPANCY_SETTINGS = Object.freeze({ n: 4, quarters: 2 });
export const DEFAULT_OCCUPANCY_CHECKS: readonly OccupancyCheck[] = Object.freeze(["mean-count"]);
export const OCCUPANCY_TEXT_LIMIT = 1024;
export const OCCUPANCY_LINK_LIMIT = 1024;
export const CHECK_LABELS: Readonly<Record<OccupancyCheck, string>> = Object.freeze({
  "one-point": "Probability that one specified point is inside",
  "mean-count": "Mean number of points inside",
  "all-inside": "Probability that all points are inside",
  "count-variance": "Variance of the number inside",
});
export type OccupancyState = Readonly<{
  comparison: OccupancyComparison;
  checks: readonly OccupancyCheck[];
  distinction: ReturnType<typeof distinguishOccupancy>;
  evidence: OccupancyEvidence | null;
  evidenceSource: "reader-entered" | "illustrative" | null;
}>;

export function createOccupancyState(input: unknown = DEFAULT_OCCUPANCY_SETTINGS, checks = DEFAULT_OCCUPANCY_CHECKS): OccupancyState {
  const comparison = compareOccupancyModels(input);
  const distinction = distinguishOccupancy(comparison.settings, checks);
  return Object.freeze({ comparison, checks: Object.freeze([...checks]), distinction, evidence: null, evidenceSource: null });
}

export function applyOccupancySettings(current: OccupancyState, input: unknown, checks = current.checks): OccupancyState {
  const next = createOccupancyState(input, checks);
  const same = next.comparison.settings.n === current.comparison.settings.n &&
    next.comparison.settings.quarters === current.comparison.settings.quarters;
  // Evidence belongs to n AND f. A different experiment cannot inherit it.
  return same ? Object.freeze({ ...next, evidence: current.evidence, evidenceSource: current.evidenceSource }) : next;
}

export function selectOccupancyChecks(current: OccupancyState, checks: readonly OccupancyCheck[]): OccupancyState {
  return applyOccupancySettings(current, current.comparison.settings, checks);
}

export function parseOccupancyHistogram(text: string, n: number): readonly number[] {
  validateOccupancySettings({ n, quarters: 2 });
  if (typeof text !== "string" || text.length > OCCUPANCY_TEXT_LIMIT || !text.trim())
    throw new OccupancyInputError("record-text-invalid", `Enter a frequency record of at most ${OCCUPANCY_TEXT_LIMIT} characters.`);
  const tokens = text.includes(",") ? text.split(",").map((token) => token.trim()) : text.trim().split(/\s+/u);
  if (tokens.length !== n + 1 || tokens.some((token) => !/^(0|[1-9][0-9]*)$/u.test(token)))
    throw new OccupancyInputError("record-frequency-count-mismatch", `Enter exactly ${n + 1} nonnegative whole-number frequencies, in order from zero inside to ${n} inside. Use commas or spaces; do not omit empty bins.`);
  return Object.freeze(tokens.map(Number));
}

export function analyzeOccupancyRecord(current: OccupancyState, text: string): OccupancyState {
  const evidence = compareOccupancyEvidence(current.comparison.settings, parseOccupancyHistogram(text, current.comparison.settings.n));
  return Object.freeze({ ...current, evidence, evidenceSource: "reader-entered" });
}

export function clearOccupancyRecord(current: OccupancyState): OccupancyState {
  return Object.freeze({ ...current, evidence: null, evidenceSource: null });
}

/** Constructed frequencies, NOT random samples or transcriptions of an experiment. */
export function illustrativeOccupancyRecord(kind: "mixed" | "all-or-none"): OccupancyState {
  if (kind !== "mixed" && kind !== "all-or-none") throw new OccupancyInputError("illustrative-record-unknown", "Unknown illustrative record.");
  const state = createOccupancyState(DEFAULT_OCCUPANCY_SETTINGS, ["mean-count", "all-inside", "count-variance"]);
  const counts = kind === "mixed" ? [1, 4, 6, 4, 1] : [8, 0, 0, 0, 8];
  return Object.freeze({ ...state, evidence: compareOccupancyEvidence(state.comparison.settings, counts), evidenceSource: "illustrative" });
}

/** Public links carry only the experimental question, never evidence, predictions or notes. */
export function encodeOccupancyLink(input: unknown, checks: readonly OccupancyCheck[]): string {
  const state = createOccupancyState(input, checks);
  return new URLSearchParams({ occupancy: "1", n: String(state.comparison.settings.n), q: String(state.comparison.settings.quarters), checks: state.checks.join(",") }).toString();
}

export type DecodedOccupancyLink =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "invalid"; message: string; code: string }>
  | Readonly<{ kind: "settings"; settings: OccupancySettings; checks: readonly OccupancyCheck[] }>;
export function decodeOccupancyLink(search: string): DecodedOccupancyLink {
  try {
    if (typeof search !== "string" || search.length > OCCUPANCY_LINK_LIMIT) throw new OccupancyInputError("link-too-long", "The occupancy link is too long.");
    const query = new URLSearchParams(search);
    const keys = ["occupancy", "n", "q", "checks"];
    if (!keys.some((key) => query.has(key))) return { kind: "absent" };
    if (keys.some((key) => query.getAll(key).length !== 1) || query.get("occupancy") !== "1")
      throw new OccupancyInputError("link-fields-invalid", "The occupancy link has missing, repeated or unsupported version fields.");
    if (!/^[1-9][0-9]?$/u.test(query.get("n") ?? "") || !/^[0-4]$/u.test(query.get("q") ?? ""))
      throw new OccupancyInputError("link-settings-invalid", "The occupancy link has invalid point-count or volume fields.");
    const rawChecks = query.get("checks") ?? "";
    const checks = rawChecks === "" ? [] : rawChecks.split(",");
    if (checks.some((check) => !(OCCUPANCY_CHECKS as readonly string[]).includes(check)))
      throw new OccupancyInputError("link-check-unknown", "The occupancy link names an unknown measurement.");
    const state = createOccupancyState({ n: Number(query.get("n")), quarters: Number(query.get("q")) }, checks as OccupancyCheck[]);
    return { kind: "settings", settings: state.comparison.settings, checks: state.checks };
  } catch (error) {
    const code = error instanceof OccupancyInputError || error instanceof OccupancyModelError ? error.code : "link-unreadable";
    return { kind: "invalid", message: error instanceof Error ? error.message : "The occupancy link could not be read.", code };
  }
}
