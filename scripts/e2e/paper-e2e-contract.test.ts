/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/patent-e2e-contract.test.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Removed the "patent E2E scenario contract" describe block entirely (source
 *   identity mismatch detection, held-model visual checks, scenario building
 *   from the live catalogue, duplicate-id and asset-existence rejection,
 *   scenario selection). All of it exercised `buildPatentE2EScenarios` and
 *   the donor's live archival-edition data model, which this repository does
 *   not port (see scripts/e2e/paper-e2e-contract.ts's header).
 * - Removed "maps patent-local changes exactly and expands shared-surface
 *   changes to the catalogue"; it exercised `resolveChangedPatentIds`, also
 *   not ported.
 * - Renamed `runId` to `logRunId` and `patentId` to `sliceId` everywhere,
 *   and `--patent` to `--paper` in the CLI contract test, matching
 *   scripts/e2e/paper-e2e-contract.ts.
 * - Added a "vertical-slice journey contract" describe block: this bead's
 *   Test Plan requires "contract validation accepts a well-formed fixture
 *   journey (enter at a deep anchor, switch face, open a foundation,
 *   return, operate an instrument, select a term, return to source) and
 *   rejects journeys missing a readiness condition or evidence retention."
 * - "requires one explicit selection mode and preserves the exact 320px
 *   phone viewport", "serializes validated JSONL events and redacts common
 *   secret shapes", "summarizes failures deterministically and produces a
 *   nonzero exit code", "creates stable, filesystem-safe failure names",
 *   "capture events do not double-count a failure or hide an uncaught
 *   scenario failure", "validates deterministic event order and rejects
 *   missing or repeated sequence numbers", and "allows only documented
 *   cancellation noise and rejects actionable browser failures" are
 *   otherwise unchanged in intent: they carry no patent-specific
 *   assumption, only renamed fields and schema strings.
 */

import { describe, expect, test } from "bun:test";
import {
  classifyPaperE2EDiagnostic,
  createPaperE2EEvent,
  PAPER_E2E_EVIDENCE_KINDS,
  type PaperE2EEvent,
  paperE2EExitCode,
  parsePaperE2EArgs,
  safeArtifactSegment,
  serializePaperE2EEvent,
  stableFailureStem,
  summarizePaperE2EEvents,
  validatePaperE2EEventOrder,
  validatePaperE2EJourney,
} from "./paper-e2e-contract";

describe("paper E2E CLI contract", () => {
  test("requires one explicit selection mode and preserves the exact 320px phone viewport", () => {
    const options = parsePaperE2EArgs([
      "--paper",
      "brownian-motion",
      "--paper",
      "light-quanta",
      "--viewports",
      "desktop,phone",
      "--base-url",
      "http://127.0.0.1:3000/",
    ]);
    expect(options.sliceIds).toEqual(["brownian-motion", "light-quanta"]);
    expect(options.viewports).toEqual(["desktop", "phone"]);
    expect(options.baseUrl).toBe("http://127.0.0.1:3000");
    expect(parsePaperE2EArgs(["--self-test-failure"]).selfTestFailure).toBe(true);
    expect(() => parsePaperE2EArgs([])).toThrow("Select exactly one");
    expect(() => parsePaperE2EArgs(["--all", "--changed"])).toThrow("Select exactly one");
    expect(() => parsePaperE2EArgs(["--all", "--viewports", "wide"])).toThrow(
      "Unknown E2E viewport",
    );
  });
});

describe("structured E2E diagnostics", () => {
  test("serializes validated JSONL events and redacts common secret shapes", () => {
    const event = createPaperE2EEvent({
      logRunId: "log-run-1",
      sequence: 1,
      sliceId: "brownian-motion",
      route: "/papers/brownian-motion",
      viewport: "phone",
      face: "instrument",
      action: "shared-control",
      status: "fail",
      durationMs: Number.NaN,
      errors: ["authorization=secret bearer abc.def token=also-secret"],
      consoleErrors: ["cookie=console-secret"],
      pageErrors: ["password=page-secret"],
      networkErrors: ["token=network-secret"],
      artifactPaths: ["artifacts/run/brownian-motion.png"],
      timestamp: "2026-09-01T00:00:00.000Z",
    });
    const line = serializePaperE2EEvent(event);
    expect(line).not.toContain("secret");
    expect(JSON.parse(line)).toMatchObject({
      schemaVersion: "annus-mirabilis.e2e-event.v1",
      durationMs: 0,
      viewport: "phone",
    });
  });

  test("summarizes failures deterministically and produces a nonzero exit code", () => {
    const pass = createPaperE2EEvent({
      logRunId: "log-run-1",
      sequence: 1,
      sliceId: "brownian-motion",
      route: "/papers/brownian-motion",
      viewport: "desktop",
      face: "route",
      action: "http-200",
      status: "pass",
      durationMs: 12,
    });
    const fail = createPaperE2EEvent({
      logRunId: "log-run-1",
      sequence: 2,
      sliceId: "light-quanta",
      viewport: "phone",
      route: "/papers/light-quanta",
      face: "source",
      action: "publication-state",
      status: "fail",
      durationMs: 8,
    });
    const summary = summarizePaperE2EEvents({
      logRunId: "log-run-1",
      startedAt: "2026-09-01T00:00:00.000Z",
      finishedAt: "2026-09-01T00:01:00.000Z",
      baseUrl: "http://127.0.0.1:3088",
      selectedSlices: ["brownian-motion", "light-quanta"],
      selectedViewports: ["desktop", "phone"],
      artifactDirectory: "artifacts/log-run-1",
      events: [pass, fail],
    });
    expect(summary).toMatchObject({ eventCount: 2, passedActions: 1, failedActions: 1 });
    expect(summary.failedSlices).toEqual(["light-quanta"]);
    expect(summary.actionGroups).toEqual([
      expect.objectContaining({
        sliceId: "brownian-motion",
        viewport: "desktop",
        face: "route",
        action: "http-200",
        passedActions: 1,
        failedActions: 0,
      }),
      expect.objectContaining({
        sliceId: "light-quanta",
        viewport: "phone",
        face: "source",
        action: "publication-state",
        passedActions: 0,
        failedActions: 1,
      }),
    ]);
    expect(paperE2EExitCode(summary)).toBe(1);
  });

  test("creates stable, filesystem-safe failure names", () => {
    expect(safeArtifactSegment("Face 1 / source:state")).toBe("face-1-source-state");
    expect(stableFailureStem("brownian-motion", "phone", "Instrument Face", "Run BM-01")).toBe(
      "brownian-motion__phone__instrument-face__run-bm-01",
    );
  });

  test("capture events do not double-count a failure or hide an uncaught scenario failure", () => {
    const event = createPaperE2EEvent({
      logRunId: "log-run-1",
      sequence: 1,
      sliceId: "brownian-motion",
      route: "/papers/brownian-motion",
      viewport: "phone",
      face: "route",
      action: "source-identity",
      status: "fail",
      durationMs: 1,
    });
    const evidence: Omit<PaperE2EEvent, "schemaVersion" | "timestamp"> = {
      ...event,
      sequence: 2,
      action: "failure-evidence",
      artifactPaths: ["failure.png"],
    };
    const summarize = (events: PaperE2EEvent[]) =>
      summarizePaperE2EEvents({
        logRunId: "log-run-1",
        startedAt: "2026-09-05T00:00:00Z",
        finishedAt: "2026-09-05T00:01:00Z",
        baseUrl: "http://127.0.0.1:4245",
        selectedSlices: ["brownian-motion"],
        selectedViewports: ["phone"],
        artifactDirectory: "/fixture",
        events,
      });
    const paired = summarize([event, createPaperE2EEvent(evidence)]);
    expect(paired).toMatchObject({ eventCount: 2, failedActions: 1, failureEvidenceEvents: 1 });
    expect(
      paired.actionGroups.find((group) => group.action === "failure-evidence")?.artifactPaths,
    ).toEqual(["failure.png"]);
    expect(paperE2EExitCode(paired)).toBe(1);
    const unpaired = summarize([createPaperE2EEvent(evidence)]);
    expect(unpaired.failedActions).toBe(1);
    expect(paperE2EExitCode(unpaired)).toBe(1);
  });

  test("validates deterministic event order and rejects missing or repeated sequence numbers", () => {
    const first = createPaperE2EEvent({
      logRunId: "log-run-1",
      sequence: 1,
      sliceId: "brownian-motion",
      route: "/papers/brownian-motion",
      viewport: "desktop",
      face: "route",
      action: "http-200",
      status: "pass",
      durationMs: 1,
    });
    const second = createPaperE2EEvent({
      logRunId: "log-run-1",
      sequence: 2,
      sliceId: "brownian-motion",
      route: "/papers/brownian-motion",
      viewport: "desktop",
      face: "route",
      action: "identity",
      status: "pass",
      durationMs: 1,
    });
    expect(validatePaperE2EEventOrder([first, second])).toEqual([]);
    expect(validatePaperE2EEventOrder([second, first])).toEqual([
      "event index 0 has sequence 2; expected 1",
      "event index 1 has sequence 1; expected 2",
    ]);
    expect(() => serializePaperE2EEvent({ ...first, sequence: 0 })).toThrow(
      "sequence must be a positive integer",
    );
  });

  test("allows only documented cancellation noise and rejects actionable browser failures", () => {
    expect(classifyPaperE2EDiagnostic("[http 404] /favicon.ico")).toMatchObject({ allowed: true });
    expect(
      classifyPaperE2EDiagnostic(
        "[requestfailed] GET http://localhost/_next/static/chunk.js net::ERR_ABORTED",
      ),
    ).toMatchObject({ allowed: true });
    expect(classifyPaperE2EDiagnostic("[http 500] /papers/brownian-motion").allowed).toBe(false);
  });
});

describe("vertical-slice journey contract", () => {
  const wellFormedJourney = {
    sliceId: "brownian-motion",
    paperSlug: "brownian-motion",
    route: "/papers/brownian-motion#s4-p2-s1",
    viewport: "desktop" as const,
    steps: [
      {
        kind: "enter-source-passage" as const,
        description: "Land on section 4, paragraph 2, sentence 1 from a deep link.",
        readiness: {
          description: "the source paragraph is visible",
          selector: '[data-anchor="s4-p2-s1"]',
        },
      },
      {
        kind: "switch-face" as const,
        description: "Switch from the source face to the explanation face.",
        readiness: {
          description: "the explanation face reports hydrated",
          selector: '[data-face="explanation"][data-hydrated="true"]',
        },
      },
      {
        kind: "open-foundation" as const,
        description: "Open the diffusion-coefficient foundation lesson.",
        readiness: {
          description: "the foundation panel is expanded",
          selector: '[data-foundation-open="true"]',
        },
      },
      {
        kind: "return-to-argument" as const,
        description: "Return to the exact interrupted argument step.",
        readiness: {
          description: "the argument node is back in view",
          selector: '[data-anchor="s4-p2-s1"]',
        },
      },
      {
        kind: "operate-instrument" as const,
        description: "Operate the BM-01 tracer lab's viscosity control.",
        readiness: {
          description: "the instrument reports an accepted snapshot",
          selector: '[data-instrument-status="accepted"]',
        },
      },
      {
        kind: "select-linked-term" as const,
        description: "Select the diffusivity term in the displayed equation.",
        readiness: {
          description: "the term's highlight state is active",
          selector: '[data-term="diffusivity"][aria-pressed="true"]',
        },
      },
      {
        kind: "return-to-source" as const,
        description: "Return to the source passage the argument was built on.",
        readiness: {
          description: "the source face is visible again",
          selector: '[data-face="source"]',
        },
      },
    ],
    retainedEvidenceOnFailure: [...PAPER_E2E_EVIDENCE_KINDS],
  };

  test("accepts a well-formed fixture journey", () => {
    expect(validatePaperE2EJourney(wellFormedJourney)).toEqual([]);
  });

  test("rejects a journey with a missing canonical step", () => {
    const missingStep = { ...wellFormedJourney, steps: wellFormedJourney.steps.slice(0, 6) };
    const errors = validatePaperE2EJourney(missingStep);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("exactly the 7 canonical steps in order");
  });

  test("rejects a journey with steps out of order", () => {
    const reordered = { ...wellFormedJourney, steps: [...wellFormedJourney.steps].reverse() };
    const errors = validatePaperE2EJourney(reordered);
    expect(errors[0]).toContain("exactly the 7 canonical steps in order");
  });

  test("rejects a journey step missing a readiness condition (never a sleep-based wait)", () => {
    const steps = wellFormedJourney.steps.map((step, index) =>
      index === 2 ? { ...step, readiness: { description: "", selector: "" } } : step,
    );
    const errors = validatePaperE2EJourney({ ...wellFormedJourney, steps });
    expect(errors.some((message) => message.includes('step "open-foundation"'))).toBe(true);
    expect(errors.some((message) => message.includes("readiness description"))).toBe(true);
  });

  test("rejects a journey that does not retain every failure-evidence kind", () => {
    const errors = validatePaperE2EJourney({
      ...wellFormedJourney,
      retainedEvidenceOnFailure: ["screenshot", "console"],
    });
    expect(
      errors.some((message) =>
        message.includes("does not retain failure evidence for: trace, dom"),
      ),
    ).toBe(true);
  });

  test("rejects a journey with no route", () => {
    const errors = validatePaperE2EJourney({ ...wellFormedJourney, route: "" });
    expect(errors.some((message) => message.includes("has no route"))).toBe(true);
  });
});
