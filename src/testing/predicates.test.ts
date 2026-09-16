import { describe, expect, test } from "bun:test";
import {
  evaluateResultClauses,
  globalResultClauseRegistry,
  ResultClauseRegistry,
  ResultPredicateClause,
} from "../reader/weave/predicates.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("Result Predicates Weave Mechanism", () => {
  test("evaluates registered predicate clauses and returns active/broken/held statuses", () => {
    const start = performance.now();
    const registry = new ResultClauseRegistry();

    registry.register("bm-01-diffusion", (params) => {
      const temp = Number(params["temperatureK"] ?? 293.15);
      const isWarm = temp >= 273.15;
      return [
        {
          id: "thermal-motion-active",
          phrase: "molecular agitation increases with absolute temperature",
          active: isWarm,
          tone: isWarm ? "live" : "broken",
          caption: isWarm
            ? `At ${temp} K, kinetic energy drives Brownian diffusion.`
            : `Below freezing threshold (${temp} K).`,
        },
      ];
    });

    const warmClauses = registry.evaluate("bm-01-diffusion", { temperatureK: 300 });
    expect(warmClauses).toHaveLength(1);
    expect(warmClauses[0]!.active).toBe(true);
    expect(warmClauses[0]!.tone).toBe("live");

    const coldClauses = registry.evaluate("bm-01-diffusion", { temperatureK: 250 });
    expect(coldClauses).toHaveLength(1);
    expect(coldClauses[0]!.active).toBe(false);
    expect(coldClauses[0]!.tone).toBe("broken");

    const unknownClauses = registry.evaluate("unknown-experiment", {});
    expect(unknownClauses).toEqual([]);

    appendExtractionLog({
      logRunId,
      testId: "predicates-registry-evaluation",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "ResultClauseRegistry evaluates predicate clauses and returns structured clause objects",
    });
  });
});
