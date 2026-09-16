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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
} from "./paper-e2e-contract.ts";

describe("paper E2E CLI contract", () => {
  it("requires one explicit selection mode and preserves the exact 320px phone viewport", () => {
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
    assert.deepEqual(options.sliceIds, ["brownian-motion", "light-quanta"]);
    assert.deepEqual(options.viewports, ["desktop", "phone"]);
    assert.equal(options.baseUrl, "http://127.0.0.1:3000");
    assert.equal(parsePaperE2EArgs(["--self-test-failure"]).selfTestFailure, true);
    assert.throws(() => parsePaperE2EArgs([]), /Select exactly one/);
    assert.throws(() => parsePaperE2EArgs(["--all", "--changed"]), /Select exactly one/);
    assert.throws(
      () => parsePaperE2EArgs(["--all", "--viewports", "wide"]),
      /Unknown E2E viewport/,
    );
  });
});

describe("structured E2E diagnostics", () => {
  it("serializes validated JSONL events and redacts common secret shapes", () => {
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
    assert.ok(!line.includes("secret"));
    const parsed = JSON.parse(line);
    assert.equal(parsed.schemaVersion, "annus-mirabilis.e2e-event.v1");
    assert.equal(parsed.durationMs, 0);
    assert.equal(parsed.viewport, "phone");
  });

  it("summarizes failures deterministically and produces a nonzero exit code", () => {
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
    assert.equal(summary.eventCount, 2);
    assert.equal(summary.passedActions, 1);
    assert.equal(summary.failedActions, 1);
    assert.deepEqual(summary.failedSlices, ["light-quanta"]);
    assert.equal(summary.actionGroups.length, 2);
    assert.equal(summary.actionGroups[0]?.sliceId, "brownian-motion");
    assert.equal(summary.actionGroups[0]?.viewport, "desktop");
    assert.equal(summary.actionGroups[0]?.face, "route");
    assert.equal(summary.actionGroups[0]?.action, "http-200");
    assert.equal(summary.actionGroups[0]?.passedActions, 1);
    assert.equal(summary.actionGroups[0]?.failedActions, 0);
    assert.equal(summary.actionGroups[1]?.sliceId, "light-quanta");
    assert.equal(summary.actionGroups[1]?.viewport, "phone");
    assert.equal(summary.actionGroups[1]?.face, "source");
    assert.equal(summary.actionGroups[1]?.action, "publication-state");
    assert.equal(summary.actionGroups[1]?.passedActions, 0);
    assert.equal(summary.actionGroups[1]?.failedActions, 1);
    assert.equal(paperE2EExitCode(summary), 1);
  });

  it("creates stable, filesystem-safe failure names", () => {
    assert.equal(safeArtifactSegment("Face 1 / source:state"), "face-1-source-state");
    assert.equal(
      stableFailureStem("brownian-motion", "phone", "Instrument Face", "Run BM-01"),
      "brownian-motion__phone__instrument-face__run-bm-01",
    );
  });

  it("capture events do not double-count a failure or hide an uncaught scenario failure", () => {
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
    assert.equal(paired.eventCount, 2);
    assert.equal(paired.failedActions, 1);
    assert.equal(paired.failureEvidenceEvents, 1);
    assert.deepEqual(
      paired.actionGroups.find((group) => group.action === "failure-evidence")?.artifactPaths,
      ["failure.png"],
    );
    assert.equal(paperE2EExitCode(paired), 1);
    const unpaired = summarize([createPaperE2EEvent(evidence)]);
    assert.equal(unpaired.failedActions, 1);
    assert.equal(paperE2EExitCode(unpaired), 1);
  });

  it("validates deterministic event order and rejects missing or repeated sequence numbers", () => {
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
    assert.deepEqual(validatePaperE2EEventOrder([first, second]), []);
    assert.deepEqual(validatePaperE2EEventOrder([second, first]), [
      "event index 0 has sequence 2; expected 1",
      "event index 1 has sequence 1; expected 2",
    ]);
    assert.throws(
      () => serializePaperE2EEvent({ ...first, sequence: 0 }),
      /sequence must be a positive integer/,
    );
  });

  it("allows only documented cancellation noise and rejects actionable browser failures", () => {
    assert.equal(classifyPaperE2EDiagnostic("[http 404] /favicon.ico").allowed, true);
    assert.equal(
      classifyPaperE2EDiagnostic(
        "[requestfailed] GET http://localhost/_next/static/chunk.js net::ERR_ABORTED",
      ).allowed,
      true,
    );
    assert.equal(classifyPaperE2EDiagnostic("[http 500] /papers/brownian-motion").allowed, false);
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

  it("accepts a well-formed fixture journey", () => {
    assert.deepEqual(validatePaperE2EJourney(wellFormedJourney), []);
  });

  it("rejects a journey with a missing canonical step", () => {
    const missingStep = { ...wellFormedJourney, steps: wellFormedJourney.steps.slice(0, 6) };
    const errors = validatePaperE2EJourney(missingStep);
    assert.ok(errors.length > 0);
    assert.ok(errors[0]?.includes("exactly the 7 canonical steps in order"));
  });

  it("rejects a journey with steps out of order", () => {
    const reordered = { ...wellFormedJourney, steps: [...wellFormedJourney.steps].reverse() };
    const errors = validatePaperE2EJourney(reordered);
    assert.ok(errors[0]?.includes("exactly the 7 canonical steps in order"));
  });

  it("rejects a journey step missing a readiness condition (never a sleep-based wait)", () => {
    const steps = wellFormedJourney.steps.map((step, index) =>
      index === 2 ? { ...step, readiness: { description: "", selector: "" } } : step,
    );
    const errors = validatePaperE2EJourney({ ...wellFormedJourney, steps });
    assert.ok(errors.some((message) => message.includes('step "open-foundation"')));
    assert.ok(errors.some((message) => message.includes("readiness description")));
  });

  it("rejects a journey that does not retain every failure-evidence kind", () => {
    const errors = validatePaperE2EJourney({
      ...wellFormedJourney,
      retainedEvidenceOnFailure: ["screenshot", "console"],
    });
    assert.ok(
      errors.some((message) =>
        message.includes("does not retain failure evidence for: trace, dom"),
      ),
    );
  });

  it("rejects a journey with no route", () => {
    const errors = validatePaperE2EJourney({ ...wellFormedJourney, route: "" });
    assert.ok(errors.some((message) => message.includes("has no route")));
  });
});
