import { describe, expect, test } from "bun:test";
import { PAPERS_WAITING_ON_CLOUD_OCR } from "../src/content/editions/ledgerPresence.ts";
import { runEditionPipeline } from "./e2e-edition-pipeline.ts";

describe("edition pipeline", () => {
  test("papers 1, 3, 4, and 5 never report complete when no ledger is present", () => {
    for (const slug of PAPERS_WAITING_ON_CLOUD_OCR) {
      const result = runEditionPipeline({ slug });
      expect(result.exitCode).toBe(0);
      expect(result.slug).toBe(slug);
      expect(result.translationCompleteness).toBe("not-applicable-no-ledger");
      expect(result.translationCompleteness).not.toBe("complete");
      expect(result.stages.find((s) => s.stage === "ledger")?.outcome).toBe("not-available");
      expect(result.stages.find((s) => s.stage === "ledger")?.code).toBe("ledger-absent");
      expect(result.stages.find((s) => s.stage === "static-html")?.outcome).toBe("not-available");
      expect(result.stages.some((s) => s.outcome === "passed")).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/"complete"/);
    }
  });

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
    expect(result.translationCompleteness).not.toBe("complete");
  });

  test("--require-stage ledger exits non-zero for a paper with no ledger", () => {
    const result = runEditionPipeline({ slug: "light-quanta", requireStage: "ledger" });
    expect(result.exitCode).toBe(1);
    expect(result.translationCompleteness).toBe("not-applicable-no-ledger");
  });
});
