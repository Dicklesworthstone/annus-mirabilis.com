import { describe, expect, test } from "bun:test";
import { verifyBrownianPrediction } from "../../equations/derivations/brownianPredictionProof.ts";
import {
  enrichBrownianPrediction,
  reconstructBrownianPrediction,
} from "./predictionReconstruction.ts";

describe("Historical Brownian prediction reconstruction", () => {
  test("the historical reconstruction uses the radius and returns finite one- and sixty-second rows", () => {
    const reconstruction = reconstructBrownianPrediction();
    expect(reconstruction.status).toBe("value");
    if (reconstruction.status !== "value") throw new Error(reconstruction.reason);
    expect(reconstruction.constantSetId).toBe("einstein-1905-brownian-printed");
    expect(reconstruction.rows.map((row) => row.elapsedSeconds)).toEqual([1, 60]);
    const [oneSecond, sixtySeconds] = reconstruction.rows;
    if (!oneSecond || !sixtySeconds) throw new Error("Expected both observation intervals.");
    expect(oneSecond.rmsMicrometres).toBeCloseTo(0.7947833, 6);
    expect(sixtySeconds.rmsMicrometres).toBeCloseTo(6.156365, 5);
    expect(oneSecond.diffusionCoefficientM2PerS).toBe(sixtySeconds.diffusionCoefficientM2PerS);
    expect(
      reconstruction.rows.every(
        (row) =>
          Number.isFinite(row.rmsMetres) &&
          row.rmsMetres > 0 &&
          Number.isFinite(row.diffusionCoefficientM2PerS) &&
          row.diffusionCoefficientM2PerS > 0,
      ),
    ).toBe(true);
  });
  test("numerical rows are joined only after the independent algebra passes", () => {
    const algebra = verifyBrownianPrediction();
    expect(algebra.passed).toBe(true);
    expect(algebra.reconstruction).toBeUndefined();
    expect(enrichBrownianPrediction(algebra).reconstruction?.status).toBe("value");
    expect(enrichBrownianPrediction({ passed: false, rows: [] }).reconstruction).toBeUndefined();
  });
});
