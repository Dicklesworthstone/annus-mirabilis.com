import { describe, expect, it } from "bun:test";
import { convertSensitivity, formatSensitivity } from "./sensitivity.ts";

describe("Sensitivity Analysis & Units (am-ver-precision-display-5e5)", () => {
  it("converts sensitivity derivative between metres and micrometres", () => {
    // dy/dx where x is in metres: e.g. 10 J/m
    // in micrometres (1 μm = 10^-6 m): 10 * 10^-6 = 10^-5 J/μm
    const sensInM = 10;
    const sensInMicrons = convertSensitivity(sensInM, "m", "μm");
    expect(sensInMicrons).toBeCloseTo(1e-5, 10);

    const reversed = convertSensitivity(sensInMicrons, "μm", "m");
    expect(reversed).toBeCloseTo(10, 10);
  });

  it("converts sensitivity derivative between seconds and milliseconds", () => {
    // dy/dt where t is in seconds: e.g. 5 V/s
    // in milliseconds (1 ms = 10^-3 s): 5 * 10^-3 = 0.005 V/ms
    const sensInS = 5;
    const sensInMs = convertSensitivity(sensInS, "s", "ms");
    expect(sensInMs).toBeCloseTo(0.005, 10);

    const reversed = convertSensitivity(sensInMs, "ms", "s");
    expect(reversed).toBeCloseTo(5, 10);
  });

  it("formats compound sensitivity units properly", () => {
    expect(formatSensitivity(2.5, "m", "s")).toBe("2.5 m/s");
    expect(formatSensitivity(0.005, "V", "ms", { sigFigs: 2 })).toBe("0.0050 V/ms");
    expect(formatSensitivity(1.2, "", "s")).toBe("1.2 1/s");
  });
});
