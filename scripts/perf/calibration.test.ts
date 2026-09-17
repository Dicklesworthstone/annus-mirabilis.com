import { describe, expect, test } from "bun:test";
import { computeCalibration } from "./calibration.ts";

describe("CPU Calibration Computation", () => {
  test("with calibration record, factor is phone time over host time and state is measured", () => {
    const record = {
      phoneModel: "Test Phone 1",
      phoneBenchmarkMs: 1200,
      hostBenchmarkMs: 300,
      host: "darwin-arm64",
      testerId: "tester-1",
      date: "2026-09-17",
    };
    const result = computeCalibration(record);
    expect(result.factor).toBe(4);
    expect(result.calibration).toBe("measured");
    expect(result.phoneBenchmarkMs).toBe(1200);
    expect(result.hostBenchmarkMs).toBe(300);
  });

  test("with custom ratio phone/host, factor reflects division", () => {
    const record = {
      phoneBenchmarkMs: 1500,
      hostBenchmarkMs: 500,
    };
    const result = computeCalibration(record);
    expect(result.factor).toBe(3);
    expect(result.calibration).toBe("measured");
  });

  test("without calibration record, factor is 4 and calibration is provisional", () => {
    const result = computeCalibration(null);
    expect(result.factor).toBe(4);
    expect(result.calibration).toBe("provisional");
    expect(result.phoneBenchmarkMs).toBeNull();
    expect(result.hostBenchmarkMs).toBeNull();
  });

  test("with incomplete calibration record, falls back to provisional factor 4", () => {
    const result = computeCalibration({ phoneBenchmarkMs: 0, hostBenchmarkMs: 300 });
    expect(result.factor).toBe(4);
    expect(result.calibration).toBe("provisional");
  });
});
