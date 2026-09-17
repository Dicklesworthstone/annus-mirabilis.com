export interface CalibrationRecord {
  phoneModel: string;
  phoneBenchmarkMs: number;
  hostBenchmarkMs: number;
  host: string;
  testerId: string;
  date: string;
}

export interface CalibrationResult {
  factor: number;
  calibration: "provisional" | "measured" | "none";
  phoneBenchmarkMs: number | null;
  hostBenchmarkMs: number | null;
  host: string;
  phoneModel: string;
  testerId: string;
  date: string;
}

/**
 * Computes the CPU calibration factor.
 * With a calibration record, the factor is the phone time divided by the host time.
 * Otherwise, the factor is 4 and calibration is labeled "provisional".
 */
export function computeCalibration(
  record?: Partial<CalibrationRecord> | null,
): CalibrationResult {
  if (
    record &&
    typeof record.phoneBenchmarkMs === "number" &&
    typeof record.hostBenchmarkMs === "number" &&
    record.phoneBenchmarkMs > 0 &&
    record.hostBenchmarkMs > 0
  ) {
    const factor = Number((record.phoneBenchmarkMs / record.hostBenchmarkMs).toFixed(2));
    return {
      factor,
      calibration: "measured",
      phoneBenchmarkMs: record.phoneBenchmarkMs,
      hostBenchmarkMs: record.hostBenchmarkMs,
      host: record.host ?? "",
      phoneModel: record.phoneModel ?? "",
      testerId: record.testerId ?? "",
      date: record.date ?? "",
    };
  }

  return {
    factor: 4,
    calibration: "provisional",
    phoneBenchmarkMs: null,
    hostBenchmarkMs: null,
    host: "",
    phoneModel: "",
    testerId: "",
    date: "",
  };
}
