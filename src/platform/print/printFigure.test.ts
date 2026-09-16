import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { renderPrintFigure } from "./printFigure.ts";

function makeAcceptedSnapshot(overrides: Partial<AcceptedSnapshot> = {}): AcceptedSnapshot {
  return {
    experimentId: "bm-01",
    instanceId: "inst-bm01-test",
    runId: "run-2026-bm01-alpha",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { temperature: 293.15, viscosity: 0.001, particleRadius: 1e-6 },
    stepIndex: 100,
    simulationTime: 10.0,
    final: true,
    snapshotVersion: 42,
    outputs: [],
    ...overrides,
  };
}

describe("printFigure: Snapshot States & Captions", () => {
  it("renders accepted snapshot with complete caption fields", () => {
    const snapshot = makeAcceptedSnapshot();
    const result = renderPrintFigure({
      instrumentId: "bm-01",
      question: "How does Brownian motion verify the molecular-kinetic theory of heat?",
      snapshot,
      status: "accepted",
      parameters: { T: "293.15 K", eta: "0.001 Pa·s", a: "1.0 μm" },
      constants: { kB: "1.380649e-23 J/K", NA: "6.02214076e23 mol^-1" },
      seed: "19050511",
      streamVersion: 1,
      executionLabel: "verified-host-run",
      svgContent: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10"/></svg>',
    });

    assert.equal(result.isAccepted, true);
    assert.ok(result.html.includes('data-print-figure="true"'));
    assert.ok(result.html.includes('data-instrument-id="bm-01"'));
    assert.ok(result.html.includes('data-run-id="run-2026-bm01-alpha"'));
    assert.ok(result.html.includes('data-snapshot-version="42"'));
    assert.ok(result.html.includes("How does Brownian motion verify"));
    assert.ok(result.html.includes("T=293.15 K"));
    assert.ok(result.html.includes("kB=1.380649e-23 J/K"));
    assert.ok(result.html.includes("Seed: 19050511 (stream v1)"));
    assert.ok(result.html.includes("Snapshot v42"));
    assert.ok(result.html.includes("verified-host-run"));
    assert.ok(result.html.includes("static representation of an interactive state"));
  });

  it("pending state renders static worked example and is NEVER captioned as accepted", () => {
    const result = renderPrintFigure({
      instrumentId: "bm-01",
      question: "How does Brownian motion verify the molecular-kinetic theory of heat?",
      snapshot: null,
      status: "pending",
      fallbackWorkedExample: {
        label: "Theoretical worked curve",
        reason: "Simulation in progress (waiting for worker thread)",
        svgContent: '<svg><path d="M0,0 L10,10"/></svg>',
      },
    });

    assert.equal(result.isAccepted, false);
    assert.ok(result.html.includes('data-status="pending"'));
    assert.ok(result.html.includes('data-print-worked-example="true"'));
    assert.ok(result.html.includes("Theoretical worked curve"));
    assert.ok(result.html.includes("Simulation in progress"));
    assert.ok(result.html.includes("static representation of an interactive state"));
    // Must NOT carry accepted runId or snapshotVersion
    assert.equal(result.html.includes('data-run-id="'), false);
    assert.equal(result.html.includes("Snapshot v"), false);
  });

  it("refused and unavailable states fall back to static worked example with refusal reason", () => {
    const refusedResult = renderPrintFigure({
      instrumentId: "bm-05",
      question: "What happens when diffusion timestep exceeds the CFL limit?",
      snapshot: null,
      status: "refused",
      refusalReason: "Refusal: ftcs-unstable (CFL stability condition violated)",
    });

    assert.equal(refusedResult.isAccepted, false);
    assert.ok(refusedResult.html.includes('data-status="refused"'));
    assert.ok(refusedResult.html.includes("ftcs-unstable"));

    const unavailResult = renderPrintFigure({
      instrumentId: "bm-06",
      question: "Drift velocity in viscous liquid",
      snapshot: null,
      status: "unavailable",
      refusalReason: "WASM simulation unavailable",
    });

    assert.equal(unavailResult.isAccepted, false);
    assert.ok(unavailResult.html.includes('data-status="unavailable"'));
    assert.ok(unavailResult.html.includes("unavailable"));
  });

  it("beforeprint refresh does not modify snapshot or run identity", () => {
    const snapshot = makeAcceptedSnapshot({ runId: "run-stable-ident", snapshotVersion: 5 });
    const originalRunId = snapshot.runId;
    const originalVersion = snapshot.snapshotVersion;

    const res1 = renderPrintFigure({
      instrumentId: "bm-01",
      question: "Test question",
      snapshot,
      status: "accepted",
    });

    // Simulating beforeprint invocation
    const res2 = renderPrintFigure({
      instrumentId: "bm-01",
      question: "Test question",
      snapshot,
      status: "accepted",
    });

    assert.equal(snapshot.runId, originalRunId);
    assert.equal(snapshot.snapshotVersion, originalVersion);
    assert.equal(res1.html, res2.html);
  });
});
