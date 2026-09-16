/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/patent-e2e-contract.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Renamed every `patentId` field and parameter to `sliceId`, and the
 *   `PatentE2E*` type/function prefix to `PaperE2E*`, throughout.
 * - Renamed the donor's `runId` field (event, summary, and CLI) to
 *   `logRunId`. AGENTS.md "Structured logs" reserves `runId` for an
 *   experiment realization under the runtime contract; this browser
 *   acceptance harness is a test suite, and `logRunId` identifies one
 *   execution of it. `createRunId` is dropped in favor of the shared
 *   `newLogRunId` in scripts/runIds.ts, which uses the same
 *   timestamp-plus-hex format as `newLogRunId` in src/testing/perfProfiles.ts.
 * - Removed `PatentE2EScenario`, `ScenarioFacts`, `buildPatentE2EScenarios`,
 *   `selectPatentE2EScenarios`, `resolveChangedPatentIds`,
 *   `isSharedPatentSurface`, `figurePreviewUrlsForPatent`,
 *   `assertPatentSourceIdentity`, and `assertSourceHeldVisual`. Those built
 *   scenario rows from the donor's live archival-edition data model
 *   (`allPatents`, `patentSourceIdentity`, `patentVisualAvailability`,
 *   `ArchivalPublicationDiagnostics`), which has no equivalent here.
 * - Added `PaperE2EJourneyStepKind`, `PaperE2EReadiness`,
 *   `PaperE2EJourneyStep`, `PaperE2EEvidenceKind`, `PaperE2EJourney`, and
 *   `validatePaperE2EJourney`: a readiness-and-evidence contract shaped
 *   around AGENTS.md's "Testing and Logging Standards" vertical-slice
 *   journey (enter through a deep source passage, switch face, open a
 *   foundation, return to the exact argument, operate an instrument, select
 *   a linked term, return to the source) instead of the donor's
 *   patent-detail scenario shape. The concrete DOM readiness contract, the
 *   fixture bundler, and the real paper lanes are am-test-e2e-harness-bqmh's
 *   scope, not this bead's; this validator only enforces the journey's
 *   *shape* (every canonical step present in order, each with a named
 *   semantic readiness condition, and every failure-evidence kind retained).
 * - `--patent <id>` became `--paper <slug>` in the CLI options; `patentIds`
 *   became `sliceIds`.
 * - `classifyPatentE2EDiagnostic`, `redactPatentE2ESecrets`,
 *   `safeArtifactSegment`, `stableFailureStem`, `finiteDuration`,
 *   `uniqueStrings`, the viewport table, and the event/summary JSONL
 *   contract are otherwise unchanged: they carry no patent-specific
 *   assumption.
 */

import { newLogRunId } from "../runIds";

export const PAPER_E2E_LOG_SCHEMA = "annus-mirabilis.e2e-event.v1" as const;
export const PAPER_E2E_SUMMARY_SCHEMA = "annus-mirabilis.e2e-summary.v1" as const;

export const PAPER_E2E_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 320, height: 800 },
} as const;

export type PaperE2EViewportName = keyof typeof PAPER_E2E_VIEWPORTS;
export type PaperE2EEventStatus = "info" | "pass" | "fail";

export interface PaperE2EEvent {
  schemaVersion: typeof PAPER_E2E_LOG_SCHEMA;
  logRunId: string;
  sequence: number;
  timestamp: string;
  sliceId: string;
  route: string;
  viewport: PaperE2EViewportName | "run";
  face: string;
  action: string;
  status: PaperE2EEventStatus;
  durationMs: number;
  expected?: unknown;
  actual?: unknown;
  responseStatus?: number | undefined;
  controls?: Record<string, string | number | boolean> | undefined;
  kernelSource?: string | undefined;
  telemetry?: string | undefined;
  refusal?: string | undefined;
  digest?: string | undefined;
  errors?: readonly string[] | undefined;
  consoleErrors?: readonly string[] | undefined;
  pageErrors?: readonly string[] | undefined;
  networkErrors?: readonly string[] | undefined;
  artifactPaths?: readonly string[] | undefined;
}

export interface PaperE2ESummary {
  schemaVersion: typeof PAPER_E2E_SUMMARY_SCHEMA;
  logRunId: string;
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  selectedSlices: readonly string[];
  selectedViewports: readonly PaperE2EViewportName[];
  eventCount: number;
  passedActions: number;
  failedActions: number;
  failureEvidenceEvents: number;
  failedSlices: readonly string[];
  artifactDirectory: string;
  actionGroups: readonly PaperE2EActionGroup[];
}

export interface PaperE2EActionGroup {
  sliceId: string;
  viewport: PaperE2EViewportName | "run";
  face: string;
  action: string;
  eventCount: number;
  passedActions: number;
  failedActions: number;
  artifactPaths: readonly string[];
  kernelSources: readonly string[];
  refusalReasons: readonly string[];
}

export interface PaperE2EOptions {
  baseUrl: string;
  outputRoot: string;
  sliceIds: string[];
  all: boolean;
  changed: boolean;
  headed: boolean;
  failFast: boolean;
  selfTestFailure: boolean;
  viewports: PaperE2EViewportName[];
}

const DEFAULT_OPTIONS: PaperE2EOptions = {
  baseUrl: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3088",
  outputRoot: process.env.E2E_OUTPUT_DIR ?? "artifacts/e2e-paper-vertical-slices",
  sliceIds: [],
  all: false,
  changed: false,
  headed: false,
  failFast: false,
  selfTestFailure: false,
  viewports: ["desktop", "tablet", "phone"],
};

export function parsePaperE2EArgs(argv: readonly string[]): PaperE2EOptions {
  const options: PaperE2EOptions = {
    ...DEFAULT_OPTIONS,
    sliceIds: [],
    viewports: [...DEFAULT_OPTIONS.viewports],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--all") options.all = true;
    else if (argument === "--changed") options.changed = true;
    else if (argument === "--headed") options.headed = true;
    else if (argument === "--fail-fast") options.failFast = true;
    else if (argument === "--self-test-failure") options.selfTestFailure = true;
    else if (argument === "--paper") {
      options.sliceIds.push(requireOptionValue(argument, value));
      index += 1;
    } else if (argument === "--base-url") {
      options.baseUrl = requireOptionValue(argument, value);
      index += 1;
    } else if (argument === "--output-dir") {
      options.outputRoot = requireOptionValue(argument, value);
      index += 1;
    } else if (argument === "--viewports") {
      options.viewports = parseViewports(requireOptionValue(argument, value));
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      throw new PaperE2EHelpRequested();
    } else {
      throw new Error(`Unknown paper E2E option: ${argument}`);
    }
  }

  const selectorCount =
    Number(options.all) + Number(options.changed) + Number(options.sliceIds.length > 0);
  if (!options.selfTestFailure && selectorCount !== 1) {
    throw new Error("Select exactly one of --all, --changed, or one or more --paper <slug> arguments.");
  }
  if (options.viewports.length === 0) {
    throw new Error("At least one E2E viewport is required.");
  }
  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  return options;
}

export class PaperE2EHelpRequested extends Error {
  constructor() {
    super("Paper E2E help requested");
    this.name = "PaperE2EHelpRequested";
  }
}

export function paperE2EUsage(): string {
  return [
    "Usage:",
    "  bun scripts/e2e-paper-vertical-slices.ts --paper <slug> [--paper <slug>...]",
    "  bun scripts/e2e-paper-vertical-slices.ts --changed",
    "  bun scripts/e2e-paper-vertical-slices.ts --all",
    "  bun scripts/e2e-paper-vertical-slices.ts --self-test-failure",
    "",
    "Options:",
    "  --base-url <url>       Existing server target (default E2E_BASE_URL or http://127.0.0.1:3088)",
    "  --output-dir <path>    Artifact root; existing evidence is never removed",
    "  --viewports <names>    Comma-separated desktop,tablet,phone (phone is exactly 320px)",
    "  --headed               Show Chromium",
    "  --fail-fast            Stop after the first failed slice/viewport scenario",
    "  --self-test-failure    Emit a synthetic failed event and exit nonzero",
  ].join("\n");
}

export function createPaperE2EEvent(
  event: Omit<PaperE2EEvent, "schemaVersion" | "timestamp"> & { timestamp?: string },
): PaperE2EEvent {
  return {
    ...event,
    schemaVersion: PAPER_E2E_LOG_SCHEMA,
    timestamp: event.timestamp ?? new Date().toISOString(),
    durationMs: finiteDuration(event.durationMs),
    errors: event.errors?.map(redactPaperE2ESecrets),
    consoleErrors: event.consoleErrors?.map(redactPaperE2ESecrets),
    pageErrors: event.pageErrors?.map(redactPaperE2ESecrets),
    networkErrors: event.networkErrors?.map(redactPaperE2ESecrets),
  };
}

export function serializePaperE2EEvent(event: PaperE2EEvent): string {
  validatePaperE2EEvent(event);
  return JSON.stringify(event);
}

export function summarizePaperE2EEvents(args: {
  logRunId: string;
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  selectedSlices: readonly string[];
  selectedViewports: readonly PaperE2EViewportName[];
  artifactDirectory: string;
  events: readonly PaperE2EEvent[];
}): PaperE2ESummary {
  const isFailedAction = (event: PaperE2EEvent) =>
    event.status === "fail" &&
    (event.action !== "failure-evidence" ||
      !args.events.some(
        (other) =>
          other.status === "fail" &&
          other.action !== "failure-evidence" &&
          other.sliceId === event.sliceId &&
          other.viewport === event.viewport,
      ));
  const failed = args.events.filter(isFailedAction);
  const grouped = new Map<string, PaperE2EEvent[]>();
  for (const event of args.events) {
    const key = [event.sliceId, event.viewport, event.face, event.action].join(" ");
    const events = grouped.get(key) ?? [];
    events.push(event);
    grouped.set(key, events);
  }
  const actionGroups: PaperE2EActionGroup[] = [...grouped.values()]
    .map((events) => {
      const [first] = events;
      return {
        sliceId: first.sliceId,
        viewport: first.viewport,
        face: first.face,
        action: first.action,
        eventCount: events.length,
        passedActions: events.filter((event) => event.status === "pass").length,
        failedActions: events.filter(isFailedAction).length,
        artifactPaths: uniqueStrings(events.flatMap((event) => event.artifactPaths ?? [])),
        kernelSources: uniqueStrings(
          events.flatMap((event) => (event.kernelSource ? [event.kernelSource] : [])),
        ),
        refusalReasons: uniqueStrings(
          events.flatMap((event) => (event.refusal ? [event.refusal] : [])),
        ),
      };
    })
    .sort((left, right) =>
      [left.sliceId, left.viewport, left.face, left.action]
        .join(" ")
        .localeCompare([right.sliceId, right.viewport, right.face, right.action].join(" ")),
    );
  return {
    schemaVersion: PAPER_E2E_SUMMARY_SCHEMA,
    logRunId: args.logRunId,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    baseUrl: args.baseUrl,
    selectedSlices: [...args.selectedSlices],
    selectedViewports: [...args.selectedViewports],
    eventCount: args.events.length,
    passedActions: args.events.filter((event) => event.status === "pass").length,
    failedActions: failed.length,
    failureEvidenceEvents: args.events.filter((event) => event.action === "failure-evidence").length,
    failedSlices: [...new Set(failed.map((event) => event.sliceId))].sort(),
    artifactDirectory: args.artifactDirectory,
    actionGroups,
  };
}

export function paperE2EExitCode(summary: PaperE2ESummary): number {
  return summary.failedActions === 0 ? 0 : 1;
}

export function safeArtifactSegment(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return normalized || "unknown";
}

export function stableFailureStem(
  sliceId: string,
  viewport: PaperE2EViewportName,
  face: string,
  action: string,
): string {
  return [sliceId, viewport, face, action].map(safeArtifactSegment).join("__");
}

function validatePaperE2EEvent(event: PaperE2EEvent): void {
  if (event.schemaVersion !== PAPER_E2E_LOG_SCHEMA) throw new Error("Invalid E2E event schema.");
  for (const [field, value] of Object.entries({
    logRunId: event.logRunId,
    sliceId: event.sliceId,
    route: event.route,
    viewport: event.viewport,
    face: event.face,
    action: event.action,
    status: event.status,
    timestamp: event.timestamp,
  })) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`E2E event ${field} must be a non-empty string.`);
    }
  }
  if (!Number.isFinite(event.durationMs) || event.durationMs < 0) {
    throw new Error("E2E event durationMs must be finite and non-negative.");
  }
  if (!Number.isInteger(event.sequence) || event.sequence < 1) {
    throw new Error("E2E event sequence must be a positive integer.");
  }
}

export function validatePaperE2EEventOrder(events: readonly PaperE2EEvent[]): readonly string[] {
  const errors: string[] = [];
  for (const [index, event] of events.entries()) {
    const expected = index + 1;
    if (event.sequence !== expected) {
      errors.push(`event index ${index} has sequence ${event.sequence}; expected ${expected}`);
    }
  }
  return errors;
}

export function classifyPaperE2EDiagnostic(message: string): {
  allowed: boolean;
  reason?: string;
} {
  if (/favicon\.ico/i.test(message)) {
    return { allowed: true, reason: "optional browser favicon request" };
  }
  if (
    /requestfailed/i.test(message) &&
    /net::ERR_ABORTED/i.test(message) &&
    /(?:\.pdf|_next\/static)/i.test(message)
  ) {
    return { allowed: true, reason: "navigation canceled an in-flight immutable asset request" };
  }
  return { allowed: false };
}

export function redactPaperE2ESecrets(value: string): string {
  return value
    .replace(/(authorization|token|cookie|password)=([^\s&]+)/gi, "$1=[redacted]")
    .replace(/(bearer\s+)[a-z0-9._~-]+/gi, "$1[redacted]");
}

/**
 * The seven-step vertical-slice journey AGENTS.md's "Testing and Logging
 * Standards" section requires of every paper: "enter through a deep source
 * passage, switch face, open a foundation, return to the exact argument,
 * operate an instrument, select a linked term, return to the source."
 */
export const PAPER_E2E_JOURNEY_STEP_KINDS = [
  "enter-source-passage",
  "switch-face",
  "open-foundation",
  "return-to-argument",
  "operate-instrument",
  "select-linked-term",
  "return-to-source",
] as const;

export type PaperE2EJourneyStepKind = (typeof PAPER_E2E_JOURNEY_STEP_KINDS)[number];

export interface PaperE2EReadiness {
  /** What the runner waits for, in ordinary language. */
  description: string;
  /** A semantic Playwright locator, URL predicate, or DOM-attribute state. Never a fixed sleep. */
  selector: string;
}

export interface PaperE2EJourneyStep {
  kind: PaperE2EJourneyStepKind;
  description: string;
  readiness: PaperE2EReadiness;
}

export const PAPER_E2E_EVIDENCE_KINDS = ["screenshot", "trace", "dom", "console"] as const;
export type PaperE2EEvidenceKind = (typeof PAPER_E2E_EVIDENCE_KINDS)[number];

export interface PaperE2EJourney {
  sliceId: string;
  paperSlug: string;
  route: string;
  viewport: PaperE2EViewportName;
  steps: readonly PaperE2EJourneyStep[];
  retainedEvidenceOnFailure: readonly PaperE2EEvidenceKind[];
}

/**
 * Validates a journey's *shape*: every canonical step present in the
 * required order, each with a named semantic readiness condition, and every
 * failure-evidence kind retained. It says nothing about a real paper's DOM
 * (am-test-e2e-harness-bqmh owns that), only about the contract a real
 * journey must satisfy.
 */
export function validatePaperE2EJourney(journey: PaperE2EJourney): string[] {
  const errors: string[] = [];

  if (journey.route.length === 0) {
    errors.push(`journey ${journey.sliceId} has no route.`);
  }

  const actualKinds = journey.steps.map((step) => step.kind);
  const expectedKinds: readonly PaperE2EJourneyStepKind[] = PAPER_E2E_JOURNEY_STEP_KINDS;
  const stepsMatch =
    actualKinds.length === expectedKinds.length &&
    actualKinds.every((kind, index) => kind === expectedKinds[index]);
  if (!stepsMatch) {
    errors.push(
      `journey ${journey.sliceId} must contain exactly the ${expectedKinds.length} canonical steps in order (${expectedKinds.join(" -> ")}); received (${actualKinds.join(" -> ") || "none"}).`,
    );
  }

  for (const step of journey.steps) {
    if (!step.readiness || step.readiness.description.trim().length === 0) {
      errors.push(`journey ${journey.sliceId} step "${step.kind}" is missing a readiness description.`);
    } else if (step.readiness.selector.trim().length === 0) {
      errors.push(`journey ${journey.sliceId} step "${step.kind}" is missing a readiness selector.`);
    }
  }

  const missingEvidence = PAPER_E2E_EVIDENCE_KINDS.filter(
    (kind) => !journey.retainedEvidenceOnFailure.includes(kind),
  );
  if (missingEvidence.length > 0) {
    errors.push(
      `journey ${journey.sliceId} does not retain failure evidence for: ${missingEvidence.join(", ")}.`,
    );
  }

  return errors;
}

function parseViewports(value: string): PaperE2EViewportName[] {
  const names = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  for (const name of names) {
    if (!(name in PAPER_E2E_VIEWPORTS)) {
      throw new Error(`Unknown E2E viewport '${name}'. Use desktop, tablet, or phone.`);
    }
  }
  return names as PaperE2EViewportName[];
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`E2E base URL must use http or https: ${value}`);
  }
  return url.toString().replace(/\/$/, "");
}

function requireOptionValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function finiteDuration(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export { newLogRunId };
