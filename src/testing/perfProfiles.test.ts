import { describe, expect, test } from "bun:test";
import {
  appendPerfProfilesLog,
  BUDGET_IDS,
  cdpDownloadBytesPerSecond,
  frameRatePasses,
  loadCommittedProfiles,
  nearestRankPercentile,
  newLogRunId,
  type ProfilesFile,
  validateDomain,
  validateProfilesFile,
} from "./perfProfiles";

const logRunId = newLogRunId();

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("committed perf/profiles.json", () => {
  test("validates against its schema and domain rules", () => {
    const { data, schema, issues } = loadCommittedProfiles();
    appendPerfProfilesLog({
      logRunId,
      testId: "committed-profiles-validate",
      outcome: issues.length === 0 ? "pass" : "fail",
      message:
        issues.length === 0
          ? `validated ${data.profiles.length} profiles`
          : issues.map((i) => `${i.path}: ${i.message}`).join("; "),
    });
    expect(issues).toEqual([]);
    expect(validateProfilesFile(data, schema)).toEqual([]);
    const mobile = data.profiles.find((p) => p.id === "mobile-low-cost");
    expect(mobile).toBeDefined();
    expect(mobile?.cpuSlowdown.calibration).toBe("provisional");
    expect(mobile?.cpuSlowdown.factor).toBe(4);
    expect(mobile?.cpuSlowdown.testerId).toBe("");
    expect(mobile?.cpuSlowdown.date).toBe("");
    expect(mobile?.cpuSlowdown.phoneModel).toBe("");
    expect(mobile?.cpuSlowdown.host).toBe("");
    expect(mobile?.cpuSlowdown.benchmarkMsHost).toBeNull();
    expect(mobile?.cpuSlowdown.benchmarkMsPhone).toBeNull();
    expect(mobile?.viewports.some((v) => v.width === 320 && v.height === 800 && v.hasTouch)).toBe(true);
    expect(mobile?.network.downKbps).toBe(1600);
    expect(mobile?.network.upKbps).toBe(750);
    expect(mobile?.network.rttMs).toBe(150);
    expect(mobile?.cpuSlowdown.webkitCpuThrottling).toBe("unavailable");
    expect(mobile?.cpuSlowdown.chromiumCdpCommand).toBe("Emulation.setCPUThrottlingRate");
    for (const profile of data.profiles) {
      expect(profile.cpuSlowdown.webkitCpuThrottling).toBe("unavailable");
    }
  });
});

describe("negative fixtures", () => {
  const { data, schema } = loadCommittedProfiles();

  test("missing network field", () => {
    const broken = clone(data);
    delete (broken.profiles[0] as { network?: unknown }).network;
    const issues = validateProfilesFile(broken, schema);
    expect(issues.some((i) => i.message.includes("missing required field") && i.path.includes("network"))).toBe(true);
  });

  test("unknown budget id", () => {
    const broken = clone(data);
    const profile = broken.profiles[0];
    if (!profile) throw new Error("fixture expects at least one profile");
    profile.budgets.push("made-up-budget" as never);
    const issues = validateProfilesFile(broken, schema);
    expect(issues.some((i) => i.message.includes("unknown budget id") || i.message.includes("expected one of"))).toBe(
      true,
    );
  });

  test("CPU factor below 1", () => {
    const broken = clone(data);
    const profile = broken.profiles[0];
    if (!profile) throw new Error("fixture expects at least one profile");
    profile.cpuSlowdown.factor = 0.5;
    const issues = validateProfilesFile(broken, schema);
    expect(issues.some((i) => i.message.includes("below 1") || i.message.includes("expected >= 1"))).toBe(true);
  });

  test("viewport narrower than 320 px", () => {
    const broken = clone(data);
    const profile = broken.profiles[0];
    const viewport = profile?.viewports[0];
    if (!viewport) throw new Error("fixture expects at least one profile with a viewport");
    viewport.width = 319;
    const issues = validateProfilesFile(broken, schema);
    expect(issues.some((i) => i.message.includes("narrower than 320") || i.message.includes("expected >= 320"))).toBe(
      true,
    );
  });

  test("mobile-low-cost without a 320-pixel viewport", () => {
    const broken = clone(data);
    const mobile = broken.profiles.find((p) => p.id === "mobile-low-cost");
    expect(mobile).toBeDefined();
    mobile!.viewports = mobile!.viewports.filter((v) => v.width !== 320);
    const issues = validateDomain(broken);
    expect(issues.some((i) => i.message.includes("320-pixel viewport"))).toBe(true);
  });

  test("measured calibration missing host, phone model, or tester id", () => {
    const broken = clone(data);
    const mobile = broken.profiles.find((p) => p.id === "mobile-low-cost")!;
    mobile.cpuSlowdown.calibration = "measured";
    mobile.cpuSlowdown.phoneModel = "";
    mobile.cpuSlowdown.host = "";
    mobile.cpuSlowdown.testerId = "";
    mobile.cpuSlowdown.date = "";
    const issues = validateDomain(broken);
    expect(issues.some((i) => i.message.includes("missing host"))).toBe(true);
    expect(issues.some((i) => i.message.includes("missing phone model"))).toBe(true);
    expect(issues.some((i) => i.message.includes("missing tester id"))).toBe(true);
  });
});

describe("p75 helper", () => {
  test("20 sorted samples select the 15th value", () => {
    const samples = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(nearestRankPercentile(samples, 0.75, 20)).toBe(15);
  });

  test("fewer than 20 samples is rejected", () => {
    expect(() => nearestRankPercentile([1, 2, 3], 0.75, 20)).toThrow("need at least 20 samples");
  });
});

describe("frame-rate helper", () => {
  const desktop = {
    medianMaxMs: 16.7,
    longMaxMs: 33.4,
    longMaxFraction: 0.05,
  };

  test("median interval of 16.7 ms passes the desktop threshold", () => {
    const result = frameRatePasses({ intervalsMs: Array(20).fill(16.7), ...desktop });
    expect(result.ok).toBe(true);
    expect(result.medianMs).toBe(16.7);
  });

  test("median interval of 20.0 ms fails the desktop threshold", () => {
    const result = frameRatePasses({ intervalsMs: Array(20).fill(20.0), ...desktop });
    expect(result.ok).toBe(false);
    expect(result.medianMs).toBe(20.0);
  });
});

describe("budget catalog", () => {
  test("every catalog id is a known budget id", () => {
    const { data } = loadCommittedProfiles();
    expect(Object.keys(data.budgetCatalog).sort()).toEqual([...BUDGET_IDS].sort());
  });

  test("CDP bytes/sec conversion uses SI kilobits", () => {
    expect(cdpDownloadBytesPerSecond(10000)).toBe(1_250_000);
    expect(cdpDownloadBytesPerSecond(1600)).toBe(200_000);
    expect(cdpDownloadBytesPerSecond(750)).toBe(93_750);
  });
});

describe("provisional calibration stays empty", () => {
  test("filling testerId while calibration is provisional fails", () => {
    const { data } = loadCommittedProfiles();
    const broken: ProfilesFile = clone(data);
    const mobile = broken.profiles.find((p) => p.id === "mobile-low-cost")!;
    mobile.cpuSlowdown.testerId = "someone";
    const issues = validateDomain(broken);
    expect(issues.some((i) => i.message.includes("testerId must stay empty"))).toBe(true);
  });
});
