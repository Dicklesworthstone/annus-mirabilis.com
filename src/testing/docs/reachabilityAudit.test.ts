import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  auditArgumentReachability,
  auditCorpusReachability,
} from "../../comprehension/reachability.ts";
import type { Argument } from "../../content/schemas/reading.ts";

function loadRealBrownianArguments(): Argument[] {
  const rootDir = process.cwd();
  const dir = join(rootDir, "content/arguments/brownian-motion");
  const files = readdirSync(dir).filter((f) => f.startsWith("arg-") && f.endsWith(".json"));
  return files.map((f) => {
    const content = readFileSync(join(dir, f), "utf8");
    return JSON.parse(content) as Argument;
  });
}

function loadRealFoundationIds(): Set<string> {
  const rootDir = process.cwd();
  const dir = join(rootDir, "content/foundations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  return new Set(files.map((f) => f.replace(/\.json$/, "")));
}

describe("reachabilityAudit (real compiler, real fixture corpus)", () => {
  const brownianNodes = loadRealBrownianArguments();
  const foundationIds = loadRealFoundationIds();

  it("all five reach-sets resolve for the Brownian §§4-5 nodes", () => {
    assert.ok(brownianNodes.length > 0, "Brownian arguments must exist in corpus");

    for (const node of brownianNodes) {
      const results = auditArgumentReachability(node, {
        knownFoundationIds: foundationIds,
      });

      assert.equal(results.length, 5, `Argument ${node.id} should test 5 reach-sets`);

      for (const res of results) {
        assert.equal(
          res.resolved,
          true,
          `Reach-set ${res.accomplishment} for argument ${node.id} should resolve, but failed: ${res.message}`,
        );
      }
    }
  });

  it("removing the node's limitations reports Critique reach-set missing target", () => {
    const baseNode = brownianNodes[0];
    assert.ok(baseNode, "Base node must exist");
    const mutatedNode: Argument = {
      ...baseNode,
      limitations: [],
    };

    const results = auditArgumentReachability(mutatedNode, {
      knownFoundationIds: foundationIds,
    });

    const critiqueResult = results.find((r) => r.accomplishment === "critique");
    assert.ok(critiqueResult, "Critique reach-set result must exist");
    assert.equal(critiqueResult.resolved, false);
    assert.equal(critiqueResult.missingTarget, "limitations");
  });

  it("removing the example action/help reports Appreciate reach-set missing target", () => {
    const baseNode = brownianNodes[0];
    assert.ok(baseNode, "Base node must exist");
    const mutatedNode: Argument = {
      ...baseNode,
      help: {
        ...baseNode.help,
        example: "",
      },
    };

    const results = auditArgumentReachability(mutatedNode, {
      knownFoundationIds: foundationIds,
    });

    const appreciateResult = results.find((r) => r.accomplishment === "appreciate");
    assert.ok(appreciateResult, "Appreciate reach-set result must exist");
    assert.equal(appreciateResult.resolved, false);
    assert.equal(appreciateResult.missingTarget, "example");
  });

  it("removing units from an instrument output reports Predict reach-set missing target", () => {
    const baseNode = brownianNodes[0];
    assert.ok(baseNode, "Base node must exist");
    const instrumentUnits = new Map<string, boolean>();
    // Seed instrument without units
    for (const exp of baseNode.experiments) {
      instrumentUnits.set(exp, false);
    }

    const results = auditArgumentReachability(baseNode, {
      knownFoundationIds: foundationIds,
      instrumentOutputsWithUnits: instrumentUnits,
    });

    const predictResult = results.find((r) => r.accomplishment === "predict");
    assert.ok(predictResult, "Predict reach-set result must exist");
    assert.equal(predictResult.resolved, false);
    assert.equal(predictResult.missingTarget, "instrument-output-units");
  });

  it("removing the only resolving FoundationLink reports Explain reach-set missing target", () => {
    const baseNode = brownianNodes[0];
    assert.ok(baseNode, "Base node must exist");
    // Mutate node so no foundations resolve
    const mutatedNode: Argument = {
      ...baseNode,
      help: {
        why: "nonexistent-foundation-id",
        missingStep: "nonexistent-foundation-id",
        example: "nonexistent-foundation-id",
      },
      prerequisites: [],
      readings: {
        ...baseNode.readings,
        full: baseNode.readings.full.filter((b) => b.kind !== "foundation"),
        steps: baseNode.readings.steps.filter((b) => b.kind !== "foundation"),
      },
    };

    const results = auditArgumentReachability(mutatedNode, {
      knownFoundationIds: foundationIds,
    });

    const explainResult = results.find((r) => r.accomplishment === "explain");
    assert.ok(explainResult, "Explain reach-set result must exist");
    assert.equal(explainResult.resolved, false);
    assert.equal(explainResult.missingTarget, "foundation-link");
  });

  it("removing a chain step's R1 reason reports Derive reach-set missing target", () => {
    const baseNode =
      brownianNodes.find((n) => n.id === "arg-bm-diffusion-equation") ?? brownianNodes[0];
    assert.ok(baseNode, "Base node must exist");
    const mutatedNode: Argument = {
      ...baseNode,
      readings: {
        ...baseNode.readings,
        steps: baseNode.readings.steps.map((b) => {
          if (b.kind === "steps") {
            // Remove R1 reason from first step (make it empty)
            return { kind: "steps", items: ["", ...b.items.slice(1)] };
          }
          return b;
        }),
      },
    };

    const results = auditArgumentReachability(mutatedNode, {
      knownFoundationIds: foundationIds,
    });

    const deriveResult = results.find((r) => r.accomplishment === "derive");
    assert.ok(deriveResult, "Derive reach-set result must exist");
    assert.equal(deriveResult.resolved, false);
    assert.equal(deriveResult.missingTarget, "r1-reason");
  });

  it("the audit report validates schema and never fails the build", () => {
    const report = auditCorpusReachability(brownianNodes, {
      knownFoundationIds: foundationIds,
    });

    assert.equal(report.schemaVersion, 1);
    assert.ok(report.totalNodes > 0);
    assert.ok(typeof report.toolRunId === "string");
    assert.ok(Array.isArray(report.results));
  });
});
