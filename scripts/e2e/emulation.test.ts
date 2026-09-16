import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  isWasmRequestUrl,
  loadCpuThrottling,
  parseTextSpacingStylesheet,
  releaseOrder,
  resolveCpuThrottling,
  TEXT_SPACING_STYLESHEET,
  visionDeficiencyAvailability,
} from "./emulation.ts";

test("the text-spacing stylesheet declares exactly the four WCAG 1.4.12 values", () => {
  const declarations = parseTextSpacingStylesheet(TEXT_SPACING_STYLESHEET);
  assert.deepEqual(declarations, {
    lineHeight: "1.5",
    paragraphSpacing: "2em",
    letterSpacing: "0.12em",
    wordSpacing: "0.16em",
  });
});

test("the vision-deficiency helper reports not-available outside Chromium", () => {
  assert.equal(visionDeficiencyAvailability("chromium"), "available");
  assert.equal(visionDeficiencyAvailability("webkit"), "not-available");
  assert.equal(visionDeficiencyAvailability("firefox"), "not-available");
});

test("the interception helper blocks *.wasm URLs and passes others", () => {
  assert.equal(isWasmRequestUrl("https://example.com/wasm/frankensim.wasm"), true);
  assert.equal(isWasmRequestUrl("https://example.com/wasm/frankensim.wasm?v=2"), true);
  assert.equal(isWasmRequestUrl("/wasm/frankensim.wasm#fragment"), true);
  assert.equal(isWasmRequestUrl("https://example.com/_next/static/chunk.js"), false);
  assert.equal(isWasmRequestUrl("https://example.com/frankensim.wasm.map"), false);
});

test("the delay helper releases two responses in the configured order", () => {
  const order = releaseOrder([
    { id: "newer", delayMs: 50 },
    { id: "older", delayMs: 10 },
  ]);
  assert.deepEqual(order, ["older", "newer"]);
});

test("CPU throttling resolves a known profile and reports not-available for an unknown one", () => {
  const profiles = {
    profiles: [{ id: "mobile-low-cost", cpuSlowdown: { factor: 4, calibration: "provisional" } }],
  };
  assert.deepEqual(resolveCpuThrottling(profiles, "mobile-low-cost"), {
    status: "available",
    profileId: "mobile-low-cost",
    factor: 4,
    calibration: "provisional",
  });
  assert.deepEqual(resolveCpuThrottling(profiles, "desktop-capable"), {
    status: "not-available",
    profileId: "desktop-capable",
  });
  assert.deepEqual(resolveCpuThrottling(undefined, "mobile-low-cost"), {
    status: "not-available",
    profileId: "mobile-low-cost",
  });
});

test("CPU throttling reads a fixture perf/profiles.json and reports not-available when the file is absent", async () => {
  const dir = mkdtempSync(join(tmpdir(), "emulation-cpu-"));
  try {
    const fixturePath = join(dir, "profiles.json");
    writeFileSync(
      fixturePath,
      JSON.stringify({
        profiles: [
          { id: "mobile-low-cost", cpuSlowdown: { factor: 4, calibration: "provisional" } },
        ],
      }),
    );
    assert.deepEqual(await loadCpuThrottling("mobile-low-cost", fixturePath), {
      status: "available",
      profileId: "mobile-low-cost",
      factor: 4,
      calibration: "provisional",
    });
    assert.deepEqual(await loadCpuThrottling("mobile-low-cost", join(dir, "does-not-exist.json")), {
      status: "not-available",
      profileId: "mobile-low-cost",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
