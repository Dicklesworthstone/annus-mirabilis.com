import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeOutcome, decodeRefusal, decodeResult } from "../experiments/results/codec.ts";
import {
  budgetExhaustedOutcomeExample,
  ftcsUnstableRefusalExample,
  lq02DivergentExample,
  missingArtifactOutcomeExample,
  notApplicableExample,
  outsideDomainExample,
  underdeterminedExample,
} from "../experiments/results/planExamples.ts";
import type { DomainKind, OutputStatus } from "../experiments/results/types.ts";

type Channel =
  | Readonly<{ channel: "output-status"; status: OutputStatus }>
  | Readonly<{ channel: "refusal"; code: string; domainKind: DomainKind }>
  | Readonly<{ channel: "execution-outcome"; outcome: string }>;

function classify(payload: unknown): Channel {
  if (payload !== null && typeof payload === "object") {
    const record = payload as { status?: unknown; code?: unknown; outcome?: unknown };
    if (typeof record.status === "string") {
      const decoded = decodeResult(payload);
      return { channel: "output-status", status: decoded.status };
    }
    if (typeof record.code === "string") {
      const decoded = decodeRefusal(payload);
      return { channel: "refusal", code: decoded.code, domainKind: decoded.domainKind };
    }
    if (typeof record.outcome === "string") {
      const decoded = decodeOutcome(payload);
      return { channel: "execution-outcome", outcome: decoded.outcome };
    }
  }
  throw new TypeError("payload is not a typed result, refusal, or execution outcome");
}

const TABLE: readonly Readonly<{ id: string; payload: unknown; expected: Channel }>[] = [
  {
    id: "unbounded classical integral",
    payload: lq02DivergentExample,
    expected: { channel: "output-status", status: "divergent" },
  },
  {
    id: "FTCS ratio above 0.5",
    payload: ftcsUnstableRefusalExample,
    expected: { channel: "refusal", code: "ftcs-unstable", domainKind: "numerical" },
  },
  {
    id: "exhausted work budget",
    payload: budgetExhaustedOutcomeExample,
    expected: { channel: "execution-outcome", outcome: "budget-exhausted" },
  },
  {
    id: "missing artifact",
    payload: missingArtifactOutcomeExample,
    expected: { channel: "execution-outcome", outcome: "missing-artifact" },
  },
  {
    id: "nonfinite input",
    payload: {
      code: "nonfinite-input",
      domainKind: "input",
      affected: { parameterIds: ["temperature"] },
      message: "One of the inputs is not a finite number.",
      rankedRepairs: [{ label: "Enter a finite number in the stated units." }],
    },
    expected: { channel: "refusal", code: "nonfinite-input", domainKind: "input" },
  },
  {
    id: "Wien formula in a dense state",
    payload: outsideDomainExample,
    expected: { channel: "output-status", status: "outside-domain" },
  },
  {
    id: "stopping potential below threshold",
    payload: notApplicableExample,
    expected: { channel: "output-status", status: "not-applicable" },
  },
  {
    id: "radius and molecular number from diffusivity alone",
    payload: underdeterminedExample,
    expected: { channel: "output-status", status: "underdetermined" },
  },
];

describe("results.divergentVsOutcome: eight conditions map to exactly one channel", () => {
  for (const row of TABLE) {
    it(`${row.id} maps to ${row.expected.channel}`, () => {
      assert.deepEqual(classify(row.payload), row.expected);
    });
  }

  it("encoding a divergence as budget-exhausted, outside-domain, or a refusal names divergent", () => {
    assert.throws(
      () => decodeOutcome(lq02DivergentExample),
      /divergent output status, not an execution outcome/,
    );
    assert.throws(
      () => decodeRefusal(lq02DivergentExample),
      /divergent output status, not a request refusal/,
    );
    assert.notEqual(decodeResult(lq02DivergentExample).status, "outside-domain");
    assert.throws(
      () =>
        decodeOutcome({
          outcome: "budget-exhausted",
          message: "This calculation exceeds the declared work or memory budget.",
          retry: "new-run",
          requested: { workUnits: 2, allocationBytes: 8 },
          allowed: { workUnits: 1, allocationBytes: 8 },
          status: "divergent",
        }),
      /divergent output status/,
    );
  });
});
