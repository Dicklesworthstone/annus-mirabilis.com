import { getLogger, type TestLogger } from "./logger.ts";
import type { EvidencePaths, Outcome } from "./schema.ts";

/**
 * Playwright integration. `@playwright/test` (the test runner, with its
 * `Reporter`/fixture types) is not yet a dependency of this repository — only
 * the browser-automation library `playwright` is installed — so this module
 * is deliberately framework-agnostic and duck-typed rather than importing
 * `@playwright/test`. am-test-e2e-harness-bqmh wires an actual
 * `@playwright/test` config; that harness reads the DOM for experiment
 * identities and captures evidence (screenshot/trace/dom/console/network),
 * both out of scope here, and passes the results into `logPlaywrightStep`.
 */
export interface PlaywrightStepMeta {
  suite: string;
  logRunId?: string;
  testId: string;
  beadId?: string;
  browser: string;
  viewport: string;
  reducedMotion: boolean;
  jsEnabled: boolean;
  lane?: string;
  journey?: string;
  step?: string;
  instanceId?: string;
  instrumentId?: string;
  runId?: string;
}

export interface PlaywrightStepOptions {
  durationMs?: number;
  message?: string;
  evidence?: EvidencePaths;
}

/** Logs one journey step with the browser lane fields required by AGENTS.md. */
export function logPlaywrightStep(
  meta: PlaywrightStepMeta,
  outcome: Outcome,
  options: PlaywrightStepOptions = {},
) {
  const logger = getLogger(meta.suite, meta.logRunId);
  return logger.log({
    testId: meta.testId,
    ...(meta.beadId !== undefined ? { beadId: meta.beadId } : {}),
    browser: meta.browser,
    viewport: meta.viewport,
    reducedMotion: meta.reducedMotion,
    jsEnabled: meta.jsEnabled,
    ...(meta.lane !== undefined ? { lane: meta.lane } : {}),
    ...(meta.journey !== undefined ? { journey: meta.journey } : {}),
    ...(meta.step !== undefined ? { step: meta.step } : {}),
    ...(meta.instanceId !== undefined ? { instanceId: meta.instanceId } : {}),
    ...(meta.instrumentId !== undefined ? { instrumentId: meta.instrumentId } : {}),
    ...(meta.runId !== undefined ? { runId: meta.runId } : {}),
    outcome,
    ...(options.durationMs !== undefined ? { durationMs: options.durationMs } : {}),
    ...(options.message !== undefined ? { message: options.message } : {}),
    ...(options.evidence !== undefined ? { evidence: options.evidence } : {}),
  });
}

export interface JourneyLoggingFixture {
  logStep(
    meta: Omit<PlaywrightStepMeta, "suite" | "logRunId">,
    outcome: Outcome,
    options?: PlaywrightStepOptions,
  ): ReturnType<typeof logPlaywrightStep>;
  flush(): ReturnType<TestLogger["flush"]>;
}

/** A fixture a Playwright test config can provide per-worker, bound to one suite/log-run id. */
export function createJourneyLoggingFixture(defaults: {
  suite: string;
  logRunId?: string;
}): JourneyLoggingFixture {
  const logger = getLogger(defaults.suite, defaults.logRunId);
  return {
    logStep(meta, outcome, options) {
      return logPlaywrightStep(
        { ...meta, suite: logger.suite, logRunId: logger.logRunId },
        outcome,
        options,
      );
    },
    flush() {
      return logger.flush();
    },
  };
}

/**
 * Duck-typed reporter shape matching `@playwright/test`'s `Reporter`
 * interface (`onTestEnd(test, result)`), without importing that package. A
 * harness that has `@playwright/test` installed can register an instance of
 * this class directly; its shape is structurally compatible.
 */
export interface MinimalPlaywrightTestResult {
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration: number;
  error?: { message?: string };
  attachments: readonly { name: string; path?: string }[];
}

export interface MinimalPlaywrightTestCase {
  title: string;
  parent?: {
    project?: () => {
      name?: string;
      use?: {
        viewport?: { width: number; height: number } | null;
        reducedMotion?: string;
        javaScriptEnabled?: boolean;
      };
    };
  };
}

function mapStatus(status: MinimalPlaywrightTestResult["status"]): Outcome {
  if (status === "passed") return "passed";
  if (status === "skipped") return "skipped";
  if (status === "interrupted") return "not-available";
  return "failed";
}

function attachmentPath(
  attachments: MinimalPlaywrightTestResult["attachments"],
  name: string,
): string | undefined {
  return attachments.find((a) => a.name === name)?.path;
}

export class TestLogReporter {
  private readonly suite: string;
  private readonly logRunId: string | undefined;

  constructor(options: { suite: string; logRunId?: string }) {
    this.suite = options.suite;
    this.logRunId = options.logRunId;
  }

  onTestEnd(test: MinimalPlaywrightTestCase, result: MinimalPlaywrightTestResult): void {
    const project = test.parent?.project?.();
    const outcome = mapStatus(result.status);
    const evidence: EvidencePaths = {};
    const screenshot = attachmentPath(result.attachments, "screenshot");
    const trace = attachmentPath(result.attachments, "trace");
    const dom = attachmentPath(result.attachments, "dom-snapshot");
    const consoleLog = attachmentPath(result.attachments, "console-log");
    if (screenshot !== undefined) evidence.screenshot = screenshot;
    if (trace !== undefined) evidence.trace = trace;
    if (dom !== undefined) evidence.dom = dom;
    if (consoleLog !== undefined) evidence.console = consoleLog;

    logPlaywrightStep(
      {
        suite: this.suite,
        ...(this.logRunId !== undefined ? { logRunId: this.logRunId } : {}),
        testId: test.title,
        browser: project?.name ?? "unknown",
        viewport: project?.use?.viewport
          ? `${project.use.viewport.width}x${project.use.viewport.height}`
          : "default",
        reducedMotion: project?.use?.reducedMotion === "reduce",
        jsEnabled: project?.use?.javaScriptEnabled !== false,
      },
      outcome,
      {
        durationMs: Math.round(result.duration),
        ...(result.error?.message !== undefined ? { message: result.error.message } : {}),
        ...(Object.keys(evidence).length > 0 ? { evidence } : {}),
      },
    );
  }
}
