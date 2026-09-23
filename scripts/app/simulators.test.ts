/**
 * The named-simulator plan reuses what exists and creates what is missing. It
 * has no delete action to take: the plan's only two shapes are reuse and create.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { planSimulators, readSimulatorSpecs, type SimctlDevices } from "./simulators.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUNTIME = "com.apple.CoreSimulator.SimRuntime.iOS-26-1";

const SPECS = [
  {
    name: "AM iPhone 17",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPhone-17",
    runtime: RUNTIME,
  },
  {
    name: "AM iPad",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPad-Air-11-inch-M3",
    runtime: RUNTIME,
  },
];

describe("named simulators", () => {
  it("reads the three simulators from the apple-toolchain decision", () => {
    const specs = readSimulatorSpecs(readFileSync(join(REPO, "docs", "DECISIONS.md"), "utf8"));
    assert.ok(specs !== null);
    assert.deepEqual(
      specs.map((spec) => spec.name),
      ["AM iPhone 17", "AM iPhone 16e", "AM iPad"],
    );
  });

  it("reuses a present simulator by name and runtime, and creates a missing one", () => {
    const listed: SimctlDevices = {
      devices: {
        [RUNTIME]: [
          { name: "iPhone 17", udid: "SYSTEM-1", isAvailable: true },
          { name: "AM iPhone 17", udid: "AM-1", isAvailable: true },
        ],
      },
    };
    const plan = planSimulators(SPECS, listed);
    assert.deepEqual(plan[0], { action: "reuse", spec: SPECS[0], udid: "AM-1" });
    assert.deepEqual(plan[1], { action: "create", spec: SPECS[1] });
  });

  it("creates beside a same-named simulator on another runtime or one marked unavailable, never replacing it", () => {
    const listed: SimctlDevices = {
      devices: {
        "com.apple.CoreSimulator.SimRuntime.iOS-18-6": [
          { name: "AM iPhone 17", udid: "OLD", isAvailable: true },
        ],
        [RUNTIME]: [{ name: "AM iPad", udid: "BROKEN", isAvailable: false }],
      },
    };
    const plan = planSimulators(SPECS, listed);
    assert.deepEqual(
      plan.map((entry) => entry.action),
      ["create", "create"],
    );
  });
});
