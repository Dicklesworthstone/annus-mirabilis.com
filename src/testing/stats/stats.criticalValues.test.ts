import { describe, expect, it } from "bun:test";
import {
  getChi2Quantile,
  getCriticalValuesDigest,
  getCriticalValuesProvenance,
  getNormalQuantile,
  getSpotChecks,
  getStudentTQuantile,
} from "./criticalValues.ts";

describe("Critical Values Table & Spot Checks (am-ver-statistical-policy-grj)", () => {
  it("carries generator text, tool version, and table digest", () => {
    const prov = getCriticalValuesProvenance();
    expect(prov.tool).toBe("mpmath");
    expect(prov.toolVersion).toContain("mpmath");
    expect(prov.generator).toContain("mpmath");
    expect(prov.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(getCriticalValuesDigest()).toBe(prov.sha256);
  });

  it("passes exact spot checks from acceptance criteria", () => {
    const spots = getSpotChecks();
    const { chi2_1_0975, chi2_10_0025, chi2_10_0975, chi2_100_0025, chi2_100_0975, z_09995 } =
      spots;
    if (
      chi2_1_0975 === undefined ||
      chi2_10_0025 === undefined ||
      chi2_10_0975 === undefined ||
      chi2_100_0025 === undefined ||
      chi2_100_0975 === undefined ||
      z_09995 === undefined
    ) {
      throw new Error("Missing spot checks in critical values table");
    }

    // chi2(1, 0.975) = 5.0239
    expect(chi2_1_0975.toFixed(4)).toBe("5.0239");
    expect(getChi2Quantile(1, 0.975).toFixed(4)).toBe("5.0239");

    // chi2(10, 0.025) = 3.2470
    expect(chi2_10_0025.toFixed(4)).toBe("3.2470");
    expect(getChi2Quantile(10, 0.025).toFixed(4)).toBe("3.2470");

    // chi2(10, 0.975) = 20.4832
    expect(chi2_10_0975.toFixed(4)).toBe("20.4832");
    expect(getChi2Quantile(10, 0.975).toFixed(4)).toBe("20.4832");

    // chi2(100, 0.025) = 74.2219
    expect(chi2_100_0025.toFixed(4)).toBe("74.2219");
    expect(getChi2Quantile(100, 0.025).toFixed(4)).toBe("74.2219");

    // chi2(100, 0.975) = 129.5612
    expect(chi2_100_0975.toFixed(4)).toBe("129.5612");
    expect(getChi2Quantile(100, 0.975).toFixed(4)).toBe("129.5612");

    // z(0.9995) = 3.2905
    expect(z_09995.toFixed(4)).toBe("3.2905");
    expect(getNormalQuantile(0.9995).toFixed(4)).toBe("3.2905");
  });

  it("evaluates standard normal quantiles correctly", () => {
    expect(getNormalQuantile(0.5)).toBe(0);
    expect(getNormalQuantile(0.975).toFixed(4)).toBe("1.9600");
    expect(getNormalQuantile(0.95).toFixed(4)).toBe("1.6449");
    expect(getNormalQuantile(0.99).toFixed(4)).toBe("2.3263");
    expect(getNormalQuantile(0.025).toFixed(4)).toBe("-1.9600");
  });

  it("evaluates Student-t quantiles correctly", () => {
    expect(getStudentTQuantile(10, 0.975).toFixed(4)).toBe("2.2281");
    expect(getStudentTQuantile(30, 0.975).toFixed(4)).toBe("2.0423");
    expect(getStudentTQuantile(100, 0.975).toFixed(4)).toBe("1.9840");
  });
});
