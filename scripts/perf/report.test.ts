import { describe, expect, test } from "bun:test";
import { type PerfReport, validatePerfReport } from "./report.ts";

describe("Performance Report Validation", () => {
  const validReport: PerfReport = {
    toolRunId: "20260917T123000Z-abc12345",
    logRunId: "run-1789645884000",
    timestamp: "2026-09-17T12:30:00.000Z",
    conditions: {
      hardware: "Apple M-series (8 cores)",
      browser: "chromium",
      browserVersion: "153.0.8010.12",
      viewport: { width: 360, height: 800, deviceScaleFactor: 2 },
      networkProfile: "mobile-low-cost (1600/750 kbps, 150ms RTT)",
      cacheState: "cold",
      calibrationState: "provisional",
      buildRevision: "abc123def",
    },
    routes: [
      {
        route: "/",
        scriptTransferBytes: 124500,
        totalTransferBytes: 148200,
        encoding: "br",
      },
      {
        route: "/papers/brownian-motion",
        scriptTransferBytes: 182300,
        totalTransferBytes: 235100,
        encoding: "br",
      },
    ],
    metrics: {
      "initial-route-js": {
        id: "initial-route-js",
        budget: 204800,
        actual: 182300,
        unit: "bytes",
        passed: true,
      },
    },
    outcome: "pass",
  };

  test("valid report passes validation with required conditions, logRunId, and separate transfer", () => {
    expect(() => validatePerfReport(validReport)).not.toThrow();
  });

  test("refuses report missing logRunId", () => {
    const invalid = { ...validReport, logRunId: "" };
    expect(() => validatePerfReport(invalid)).toThrow("missing required logRunId");
  });

  test("refuses report missing any required condition", () => {
    const missingHardware = {
      ...validReport,
      conditions: { ...validReport.conditions, hardware: "" },
    };
    expect(() => validatePerfReport(missingHardware)).toThrow("missing hardware condition");

    const missingCalibration = {
      ...validReport,
      conditions: { ...validReport.conditions, calibrationState: "" as never },
    };
    expect(() => validatePerfReport(missingCalibration)).toThrow(
      "missing calibrationState condition",
    );
  });

  test("refuses report if route fails to report total transfer separately from JavaScript", () => {
    const missingSeparateTransfer = {
      ...validReport,
      routes: [
        {
          route: "/",
          scriptTransferBytes: 124500,
          totalTransferBytes: undefined as never,
        },
      ],
    };
    expect(() => validatePerfReport(missingSeparateTransfer)).toThrow(
      "must report total transfer separately from JavaScript",
    );
  });
});
