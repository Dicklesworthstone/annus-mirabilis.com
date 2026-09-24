/**
 * The Apple gate's decisions, without Xcode: toolchain comparison, disk floor,
 * and reading test results from real .xcresult summaries (fixtures cut from
 * two runs on AM iPhone 17 on 2026-09-23, one passing and one with a failure).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  APPLE_STEPS,
  diskVerdict,
  parseAppleToolchain,
  parseXcodegenVersion,
  parseXcodeVersion,
  summarizeXcresult,
  testVerdict,
  toolchainMismatches,
} from "./apple-quality.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const fixture = (name: string) => JSON.parse(readFileSync(join(HERE, "fixtures", name), "utf8"));

describe("the apple-toolchain decision", () => {
  const decided = parseAppleToolchain(readFileSync(join(REPO, "docs", "DECISIONS.md"), "utf8"));

  it("parses from docs/DECISIONS.md with every version and the disk floor", () => {
    assert.ok(decided !== null);
    assert.equal(decided.xcode, "26.1.1");
    assert.equal(decided.xcodeBuild, "17B100");
    assert.equal(typeof decided.diskFreeGigabytesMinimum, "number");
  });

  it("reports nothing when every tool matches", () => {
    assert.ok(decided !== null);
    const observed = {
      xcode: decided.xcode,
      xcodeBuild: decided.xcodeBuild,
      xcodegen: decided.xcodegen,
      swiftlint: decided.swiftlint,
      swiftFormat: decided.swiftFormat,
    };
    assert.deepEqual(toolchainMismatches(decided, observed), []);
  });

  it("names both versions and a repair for a mismatched Xcode build, and a missing tool", () => {
    assert.ok(decided !== null);
    const problems = toolchainMismatches(decided, {
      xcode: decided.xcode,
      xcodeBuild: "17C52",
      xcodegen: null,
      swiftlint: decided.swiftlint,
      swiftFormat: decided.swiftFormat,
    });
    assert.equal(problems.length, 2);
    assert.match(problems[0] ?? "", /Xcode build is 17C52, the decision records 17B100/);
    assert.match(problems[1] ?? "", /XcodeGen is not installed.*brew install xcodegen/);
  });

  it("refuses a decisions file without the block, rather than passing on nothing", () => {
    assert.equal(parseAppleToolchain("# Decisions\n\nno block here\n"), null);
  });
});

describe("tool version output", () => {
  it("reads xcodebuild -version and xcodegen --version as they print", () => {
    assert.deepEqual(parseXcodeVersion("Xcode 26.1.1\nBuild version 17B100\n"), {
      xcode: "26.1.1",
      xcodeBuild: "17B100",
    });
    assert.equal(parseXcodegenVersion("Version: 2.46.0\n"), "2.46.0");
    assert.deepEqual(parseXcodeVersion("xcode-select: error: tool 'xcodebuild' requires Xcode"), {
      xcode: null,
      xcodeBuild: null,
    });
  });
});

describe("disk floor", () => {
  it("passes at the floor and fails below it, telling the reader not to lower it", () => {
    assert.equal(diskVerdict(10, 10).outcome, "passed");
    const low = diskVerdict(6.3, 10);
    assert.equal(low.outcome, "failed");
    assert.match(low.message, /6\.3 GB free.*do not lower the floor/);
  });
});

describe("test results from .xcresult", () => {
  it("reads a passing run's counts and device", () => {
    const summary = summarizeXcresult(fixture("xcresult-summary-passed.json"));
    assert.ok(summary !== null);
    assert.equal(summary.result, "Passed");
    assert.equal(summary.total, 19);
    assert.equal(summary.failed, 0);
    assert.equal(summary.device, "AM iPhone 17");
    assert.equal(testVerdict("Unit tests", 0, summary).outcome, "passed");
  });

  it("fails a run with a failed test and names the test and its message", () => {
    const summary = summarizeXcresult(fixture("xcresult-summary-failed.json"));
    assert.ok(summary !== null);
    const verdict = testVerdict("UI tests", 65, summary);
    assert.equal(verdict.outcome, "failed");
    assert.match(verdict.message, /32 passed, 1 failed, 0 skipped of 33/);
    assert.match(verdict.message, /testPageActionsSharePrintAndFind.*the share sheet did not open/);
  });

  it("fails a run that executed nothing, and a nonzero exit even when the bundle says Passed", () => {
    const passed = summarizeXcresult(fixture("xcresult-summary-passed.json"));
    assert.ok(passed !== null);
    assert.equal(
      testVerdict("Unit tests", 0, { ...passed, total: 0, passed: 0 }).outcome,
      "failed",
    );
    assert.equal(testVerdict("Unit tests", 65, passed).outcome, "failed");
  });

  it("fails when there is no readable summary, as when the runner crashed before writing one", () => {
    assert.equal(summarizeXcresult({ error: "no test results" }), null);
    assert.equal(summarizeXcresult(null), null);
    assert.equal(testVerdict("UI tests", 65, null).outcome, "failed");
  });
});

describe("the step list", () => {
  it("has unique ids, all in the apple namespace, disk first and the tests last", () => {
    const ids = APPLE_STEPS.map((step) => step.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => id.startsWith("apple-")));
    assert.equal(ids[0], "apple-disk");
    assert.deepEqual(ids.slice(-3), ["apple-build", "apple-unit-tests", "apple-ui-tests"]);
    // Parity reads the same build freshness does, so it runs right after it.
    assert.equal(ids.indexOf("apple-edition-parity"), ids.indexOf("apple-edition-fresh") + 1);
  });
});
