/**
 * Tests for FrankenSim Refusal Envelope Mapping Table and Translation.
 * Specification: am-rt-worker-protocol-gaq acceptance criterion 4.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { parseYaml } from "../content/provenance/yaml.ts";
import { refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";
import {
  mapFrankenSimRefusalEnvelope,
  REFUSAL_MAPPING_ROWS,
} from "../workers/protocol/wasmRefusalMap.ts";

describe("protocol.refusalMapping", () => {
  const dummyIdentity = {
    instanceId: "inst-test",
    runId: "run-test",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
  };

  it("parses binding table in docs/FRANKENSIM_BINDING.md §5.4 and matches REFUSAL_MAPPING_ROWS exactly", () => {
    const docPath = resolve(process.cwd(), "docs/FRANKENSIM_BINDING.md");
    const docText = readFileSync(docPath, "utf8");

    // Extract refusal-mapping code block
    const match = docText.match(/```refusal-mapping\n([\s\S]*?)```/);
    assert.ok(match && match[1], "refusal-mapping block must exist in docs/FRANKENSIM_BINDING.md");

    const parsedYaml: any = parseYaml(match[1]);
    assert.ok(Array.isArray(parsedYaml.rows), "refusal-mapping YAML must contain rows array");

    assert.equal(
      parsedYaml.rows.length,
      REFUSAL_MAPPING_ROWS.length,
      `Table row count mismatch: markdown has ${parsedYaml.rows.length}, code has ${REFUSAL_MAPPING_ROWS.length}`,
    );

    for (let i = 0; i < parsedYaml.rows.length; i++) {
      const docRow = parsedYaml.rows[i];
      const codeRow = REFUSAL_MAPPING_ROWS[i]!;

      assert.equal(docRow.export, codeRow.export, `Row ${i} export mismatch`);
      assert.equal(docRow.upstreamCode, codeRow.upstreamCode, `Row ${i} upstreamCode mismatch`);
      assert.equal(docRow.target, codeRow.target, `Row ${i} target mismatch`);
      assert.equal(docRow.targetKind, codeRow.targetKind, `Row ${i} targetKind mismatch`);
    }
  });

  it("every target code in REFUSAL_MAPPING_ROWS with targetKind refusal-code exists in refusalCodeRegistry", () => {
    for (const row of REFUSAL_MAPPING_ROWS) {
      if (row.targetKind === "refusal-code") {
        const target = row.target;
        assert.ok(
          target in refusalCodeRegistry,
          `Target code "${target}" from row ${row.export}/${row.upstreamCode} is missing from refusalCodeRegistry.`,
        );

        const def = refusalCodeRegistry[target as keyof typeof refusalCodeRegistry];
        assert.ok(
          def.message && def.message.trim().length > 0,
          `Target "${target}" has empty message`,
        );
        assert.ok(
          def.repair && def.repair.trim().length > 0,
          `Target "${target}" has empty repair`,
        );
      } else {
        assert.equal(
          row.target,
          "budget-exhausted",
          `Only budget-exhausted is allowed as execution-outcome target, got "${row.target}"`,
        );
      }
    }
  });

  it("maps ftcs-unstable refusal with ratio, limit, and dtMax details", () => {
    const envelope = {
      refusal: {
        code: "ftcs-unstable",
        message: "r = 0.55 > 0.5 limit",
        ranked_repairs: ["use dt = dtMax", "increase dx"],
        details: {
          ratio: 0.55,
          limit: 0.5,
          dtMax: 0.001,
        },
      },
    };

    const res = mapFrankenSimRefusalEnvelope(envelope, dummyIdentity, "diffusion1d_frames");
    assert.equal(res.messageKind, "refusal");
    if (res.messageKind === "refusal") {
      assert.equal(res.refusal.code, "ftcs-unstable");
      assert.equal(res.refusal.domainKind, "numerical");
      // Reader text comes from registry
      assert.equal(res.refusal.message, refusalCodeRegistry["ftcs-unstable"].message);
      // Upstream details preserved
      const details = res.refusal.details as any;
      assert.ok(details);
      assert.equal(details.ratio, 0.55);
      assert.equal(details.limit, 0.5);
      assert.equal(details.dtMax, 0.001);
      assert.equal(details.upstreamCode, "ftcs-unstable");
      assert.equal(details.upstreamMessage, "r = 0.55 > 0.5 limit");
    }
  });

  it("maps stream-index-overflow refusal preserving startIndex and draws", () => {
    const envelope = {
      refusal: {
        code: "stream-index-overflow",
        message: "Draw counter overflow",
        ranked_repairs: ["reduce count"],
        details: {
          startIndex: "18446744073709551610",
          draws: "10",
          maxIndex: "18446744073709551615",
        },
      },
    };

    const res = mapFrankenSimRefusalEnvelope(envelope, dummyIdentity, "philox_normals");
    assert.equal(res.messageKind, "refusal");
    if (res.messageKind === "refusal") {
      assert.equal(res.refusal.code, "stream-index-overflow");
      assert.equal(res.refusal.domainKind, "input");
      assert.equal(res.refusal.message, refusalCodeRegistry["stream-index-overflow"].message);
      const details = res.refusal.details as any;
      assert.equal(details.startIndex, "18446744073709551610");
      assert.equal(details.draws, "10");
    }
  });

  it("maps budget row to budget-exhausted execution outcome", () => {
    const envelope = {
      refusal: {
        code: "output-len-overflow-or-budget",
        message: "Exceeded 2097152 values",
        ranked_repairs: ["reduce steps"],
        details: {
          requested: 5000000,
          allowed: 2097152,
          unit: "f64-values",
        },
      },
    };

    const res = mapFrankenSimRefusalEnvelope(envelope, dummyIdentity, "brownian_frames");
    assert.equal(res.messageKind, "outcome");
    if (res.messageKind === "outcome") {
      assert.equal(res.outcome.outcome, "budget-exhausted");
      assert.equal((res.outcome as any).requested.workUnits, 5000000);
      assert.equal((res.outcome as any).allowed.workUnits, 2097152);
    }
  });

  it("maps unmapped upstream code to malformed-response outcome", () => {
    const envelope = {
      refusal: {
        code: "strange-unmapped-code-99",
        message: "Unknown failure",
      },
    };

    const res = mapFrankenSimRefusalEnvelope(envelope, dummyIdentity);
    assert.equal(res.messageKind, "outcome");
    if (res.messageKind === "outcome") {
      assert.equal(res.outcome.outcome, "malformed-response");
      assert.ok(res.outcome.details);
      assert.equal((res.outcome.details as any).upstreamCode, "strange-unmapped-code-99");
    }
  });
});
