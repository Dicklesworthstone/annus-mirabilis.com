import assert from "node:assert/strict";
import test from "node:test";
import { scanBuildOutputListing } from "../fixtures/buildOutputScan.ts";
import { FIXTURE_APP_REGISTRY } from "../fixtures/fixtureApps.ts";
import { assertRuntimeRegistration } from "./fixtureRegistration.ts";

test("a clean build-output listing contains no runtime fixture module id or hook", () => {
  const entry = assertRuntimeRegistration(
    FIXTURE_APP_REGISTRY.find((item) => item.id === "runtime"),
  );
  const issues = scanBuildOutputListing(
    [entry],
    ["static/chunks/app/papers/page.js", "index.html"],
  );
  assert.deepEqual(issues, []);
});

test("a planted fixture import in an application module fails the scan", () => {
  const entry = assertRuntimeRegistration(
    FIXTURE_APP_REGISTRY.find((item) => item.id === "runtime"),
  );
  const issues = scanBuildOutputListing(
    [entry],
    ["static/chunks/app/papers/page.js", "src/testing/runtime-fixtures/app/index.ts"],
  );
  assert.ok(issues.some((issue) => issue.needle.includes("runtime-fixtures")));
});
