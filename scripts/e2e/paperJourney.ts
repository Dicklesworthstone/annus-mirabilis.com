import { type Browser, type BrowserContext, chromium, type Page } from "playwright";
import type { JourneyAction } from "./journeys/steps.ts";
import {
  PAPER_E2E_VIEWPORTS,
  type PaperE2EEvent,
  type PaperE2EJourney,
  type PaperE2EJourneyStepKind,
  type PaperE2EViewportName,
  validatePaperE2EJourney,
} from "./paper-e2e-contract.ts";

/*
 * DRIVES ONE PAPER'S CONTINUOUS JOURNEY AND REPORTS IT IN THE HARNESS'S OWN EVENTS (dispatch 441).
 *
 * The harness owns the run: the log run id, the JSONL file, the evidence directory and the summary.
 * This adds no second format and no second log. It takes a journey and its actions, drives each step
 * in order, and emits one event per step through the recorder it is handed.
 *
 * A STEP THAT CANNOT BE PERFORMED IS A FAILURE. There is no skip: an action throws, the step is
 * recorded `fail` with the error, evidence is retained, and the remaining steps still run so that one
 * missing control does not hide the state of the rest. The run's exit code is non-zero if any step
 * failed, which is the whole point of a continuous journey.
 */

export interface PaperJourneyRecorder {
  emit(event: Omit<PaperE2EEvent, "schemaVersion" | "sequence" | "timestamp">): PaperE2EEvent;
  registerDiagnostics(
    sliceId: string,
    viewport: PaperE2EViewportName,
    diagnostics: {
      consoleMessages: string[];
      consoleErrors: string[];
      pageErrors: string[];
      networkErrors: string[];
    },
  ): void;
  readonly runDirectory: string;
  readonly logRunId: string;
}

export interface RunPaperJourneyArgs {
  entry: Readonly<{
    journey: PaperE2EJourney;
    actions: Readonly<Record<PaperE2EJourneyStepKind, JourneyAction>>;
  }>;
  recorder: PaperJourneyRecorder;
  baseUrl: string;
  headed?: boolean | undefined;
  /** The harness's own evidence retention, passed in rather than reimplemented here. */
  captureEvidence?:
    | ((args: {
        page: Page;
        context: BrowserContext;
        recorder: never;
        scenario: { sliceId: string; route: string };
        viewport: PaperE2EViewportName;
        diagnostics: {
          consoleMessages: string[];
          consoleErrors: string[];
          pageErrors: string[];
          networkErrors: string[];
        };
      }) => Promise<string[]>)
    | undefined;
}

export interface PaperJourneyResult {
  sliceId: string;
  performedSteps: number;
  failedSteps: number;
}

export async function runPaperJourney(args: RunPaperJourneyArgs): Promise<PaperJourneyResult> {
  const { journey, actions } = args.entry;
  const shapeErrors = validatePaperE2EJourney(journey);
  if (shapeErrors.length > 0)
    throw new Error(`${journey.sliceId} is not a valid journey: ${shapeErrors.join("; ")}`);

  const viewport = PAPER_E2E_VIEWPORTS[journey.viewport];
  const browser: Browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({ viewport });
  // The journey declares a trace among its retained evidence, so tracing starts before the first
  // step: captureFailureEvidence stops it into the run directory, and a trace never started is a
  // declared evidence kind that silently never appears.
  await context.tracing.start({ screenshots: true, snapshots: true }).catch(() => undefined);
  const page = await context.newPage();
  const diagnostics = {
    consoleMessages: [] as string[],
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    networkErrors: [] as string[],
  };
  page.on("console", (message) => {
    diagnostics.consoleMessages.push(message.text());
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    diagnostics.networkErrors.push(`${request.method()} ${request.url()}`),
  );
  args.recorder.registerDiagnostics(journey.sliceId, journey.viewport, diagnostics);

  let performedSteps = 0;
  let failedSteps = 0;
  try {
    for (const step of journey.steps) {
      const action = actions[step.kind];
      const started = performance.now();
      try {
        const outcome = await action(page, args.baseUrl);
        performedSteps += 1;
        args.recorder.emit({
          logRunId: args.recorder.logRunId,
          sliceId: journey.sliceId,
          route: journey.route,
          viewport: journey.viewport,
          face: step.kind,
          action: step.description,
          status: "pass",
          durationMs: Math.round(performance.now() - started),
          expected: outcome.expected,
          actual: outcome.actual,
        } as never);
      } catch (error) {
        failedSteps += 1;
        const artifactPaths = args.captureEvidence
          ? await args
              .captureEvidence({
                page,
                context,
                recorder: args.recorder as never,
                scenario: { sliceId: journey.sliceId, route: journey.route },
                viewport: journey.viewport,
                diagnostics,
              })
              .catch(() => [] as string[])
          : [];
        args.recorder.emit({
          logRunId: args.recorder.logRunId,
          sliceId: journey.sliceId,
          route: journey.route,
          viewport: journey.viewport,
          face: step.kind,
          action: step.description,
          status: "fail",
          durationMs: Math.round(performance.now() - started),
          expected: step.readiness.description,
          actual: "the step could not be performed",
          errors: [error instanceof Error ? error.message : String(error)],
          artifactPaths,
        } as never);
      }
    }
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
  return { sliceId: journey.sliceId, performedSteps, failedSteps };
}
