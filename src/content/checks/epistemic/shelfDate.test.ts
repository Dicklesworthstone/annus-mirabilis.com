import { afterAll, describe, expect, test } from "bun:test";
import { getLogger } from "../../../testing/log/logger.ts";
import { evaluateShelfDate } from "./shelfDate.ts";

const logger = getLogger("content-epistemic-tests");
const BEAD = "am-cm-checks-epistemic-o7n";

const chain = { id: "stage-chain", kind: "chain" as const };
const journeyI = { id: "journey-i", admittedImports: [] as string[] };
const journeyIv = {
  id: "journey-iv",
  admittedImports: ["sr-s8-light-energy"],
  sourcePaperExportedResults: ["sr-s8-light-energy"],
};
const journeyIi = { id: "journey-ii", admittedImports: [] as string[] };

describe("evaluateShelfDate (the one shelf-date implementation)", () => {
  test("Jeans 1905 available as a chain premise fails; Rayleigh 1900 passes", () => {
    const jeans = evaluateShelfDate(
      chain,
      { id: "jeans-1905-correction", status: "available", latestYear: 1905 },
      journeyI,
    );
    expect(jeans.ok).toBe(false);
    if (!jeans.ok) expect(jeans.code).toBe("shelf-date-violation");
    if (!jeans.ok) expect(jeans.reason).toBe("available-after-cutoff");

    const rayleigh = evaluateShelfDate(
      chain,
      { id: "rayleigh-1900-june", status: "available", latestYear: 1900 },
      journeyI,
    );
    expect(rayleigh.ok).toBe(true);
    if (rayleigh.ok) expect(rayleigh.reason).toBe("available-by-1904");
    logger.log({
      testId: "shelf-jeans-vs-rayleigh",
      beadId: BEAD,
      extra: { family: "epistemic", rule: "shelf-date-violation" },
      outcome: "passed",
      message: "1905 available fails; 1900 available passes",
    });
  });

  test("parallel-work passes only with the stage flag", () => {
    const card = { id: "jeans-1905-parallel", status: "parallel-work" as const, latestYear: 1905 };
    const without = evaluateShelfDate(chain, card, journeyI);
    expect(without.ok).toBe(false);
    if (!without.ok) expect(without.reason).toBe("parallel-work-unacknowledged");
    const withFlag = evaluateShelfDate(
      { ...chain, parallelWorkAcknowledged: true },
      card,
      journeyI,
    );
    expect(withFlag.ok).toBe(true);
    if (withFlag.ok) expect(withFlag.reason).toBe("parallel-work");
  });

  test("admittedImport of paper 3 §8 passes on Journey IV and fails on Journey II", () => {
    const card = {
      id: "sr-s8-light-energy",
      status: "available" as const,
      latestYear: 1905,
      admittedImport: { resultId: "sr-s8-light-energy", declaringJourney: "journey-iv" },
    };
    const onIv = evaluateShelfDate(chain, card, journeyIv);
    expect(onIv.ok).toBe(true);
    if (onIv.ok) expect(onIv.reason).toBe("admitted-import");
    const onIi = evaluateShelfDate(chain, card, journeyIi);
    expect(onIi.ok).toBe(false);
    if (!onIi.ok) expect(onIi.reason).toBe("admitted-import-undeclared");
  });

  test("Perrin 1909 later as a chain premise fails; status available alone never admits 1905", () => {
    const perrin = evaluateShelfDate(
      chain,
      { id: "perrin-1909", status: "later", latestYear: 1909 },
      journeyI,
    );
    expect(perrin.ok).toBe(false);
    if (!perrin.ok) expect(perrin.reason).toBe("later-card");
    const available1905 = evaluateShelfDate(
      chain,
      { id: "something-1905", status: "available", latestYear: 1905 },
      journeyI,
    );
    expect(available1905.ok).toBe(false);
    if (!available1905.ok) expect(available1905.reason).toBe("available-after-cutoff");
  });
});

afterAll(async () => {
  await logger.flush();
});
