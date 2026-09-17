import { describe, expect, test } from "bun:test";
import { runEditionPipeline } from "./e2e-edition-pipeline.ts";

describe("edition pipeline", () => {
  test("happy path: missing ledger is not-available, exit 0, static-html not-available", () => {
    const result = runEditionPipeline({ slug: "mass-energy" });
    expect(result.exitCode).toBe(0);
    expect(result.stages.find((s) => s.stage === "ledger")?.outcome).toBe("not-available");
    expect(result.stages.find((s) => s.stage === "ledger")?.code).toBe("ledger-absent");
    expect(result.stages.find((s) => s.stage === "static-html")?.outcome).toBe("not-available");
    expect(result.stages.some((s) => s.outcome === "passed" && s.stage === "ledger")).toBe(false);
  });

  test("--require-stage static-html exits non-zero", () => {
    const result = runEditionPipeline({ slug: "mass-energy", requireStage: "static-html" });
    expect(result.exitCode).toBe(1);
  });
});
