import assert from "node:assert/strict";
import test from "node:test";
import {
  FIXTURE_APP_REGISTRY,
  type FixtureAppEntry,
  validateFixtureAppRegistry,
} from "./fixtureApps.ts";

const VALID_ENTRY: FixtureAppEntry = {
  id: "harness-selftest",
  entry: "src/testing/e2e/fixture-apps/selftest/",
  outDir: "artifacts/e2e-fixtures/harness-selftest/",
  owner: "am-test-e2e-harness-bqmh",
};

test("the committed FIXTURE_APP_REGISTRY is empty and passes validation, which is the harness's baseline", () => {
  assert.deepEqual(FIXTURE_APP_REGISTRY, []);
  assert.deepEqual(validateFixtureAppRegistry(FIXTURE_APP_REGISTRY), []);
});

test("registry validation rejects a duplicate id", () => {
  const issues = validateFixtureAppRegistry([VALID_ENTRY, { ...VALID_ENTRY }]);
  assert.ok(
    issues.some((issue) =>
      issue.message.includes('duplicate fixture application id "harness-selftest"'),
    ),
  );
});

test("registry validation rejects an entry outside src/testing/", () => {
  const issues = validateFixtureAppRegistry([{ ...VALID_ENTRY, entry: "src/app/inline-scripts/" }]);
  assert.ok(issues.some((issue) => issue.message.includes("entry directory outside src/testing/")));
});

test("registry validation rejects an outDir outside artifacts/e2e-fixtures/", () => {
  const issues = validateFixtureAppRegistry([
    { ...VALID_ENTRY, outDir: "artifacts/build/harness-selftest/" },
  ]);
  assert.ok(
    issues.some((issue) => issue.message.includes("outDir outside artifacts/e2e-fixtures/")),
  );
});

test("registry validation rejects an entry without an owner", () => {
  const issues = validateFixtureAppRegistry([{ ...VALID_ENTRY, owner: "" }]);
  assert.ok(issues.some((issue) => issue.message.includes("has no owner")));
});

test("every registered entry's owner is a real bead id, checked via an injected known-id predicate", () => {
  const knownBeadIds = new Set(["am-test-e2e-harness-bqmh"]);
  const isKnownBeadId = (id: string) => knownBeadIds.has(id);
  assert.deepEqual(validateFixtureAppRegistry([VALID_ENTRY], isKnownBeadId), []);
  const issues = validateFixtureAppRegistry(
    [{ ...VALID_ENTRY, owner: "am-does-not-exist-zzz" }],
    isKnownBeadId,
  );
  assert.ok(issues.some((issue) => issue.message.includes("not a known bead id")));
});

test("an owner that is not a well-formed bead id fails even with no known-id predicate supplied", () => {
  const issues = validateFixtureAppRegistry([{ ...VALID_ENTRY, owner: "Not A Bead Id!" }]);
  assert.ok(issues.some((issue) => issue.message.includes("not a well-formed bead id")));
});

test("staticInputs validation rejects a from outside the repository", () => {
  const entry: FixtureAppEntry = {
    ...VALID_ENTRY,
    staticInputs: [{ from: "../outside-repo/manifest.json", servedPath: "manifest.json" }],
  };
  const issues = validateFixtureAppRegistry([entry]);
  assert.ok(
    issues.some((issue) => issue.message.includes("staticInputs.from outside the repository")),
  );
});

test("staticInputs validation rejects a servedPath that is absolute or contains ..", () => {
  const absolute = validateFixtureAppRegistry([
    {
      ...VALID_ENTRY,
      staticInputs: [{ from: "public/wasm/manifest.json", servedPath: "/manifest.json" }],
    },
  ]);
  assert.ok(
    absolute.some((issue) => issue.message.includes("absolute or escapes its application root")),
  );

  const traversal = validateFixtureAppRegistry([
    {
      ...VALID_ENTRY,
      staticInputs: [{ from: "public/wasm/manifest.json", servedPath: "../manifest.json" }],
    },
  ]);
  assert.ok(
    traversal.some((issue) => issue.message.includes("absolute or escapes its application root")),
  );
});

test("staticInputs validation rejects a servedPath colliding with a bundle output name", () => {
  const issues = validateFixtureAppRegistry([
    {
      ...VALID_ENTRY,
      staticInputs: [{ from: "public/wasm/manifest.json", servedPath: "bundle.js" }],
    },
  ]);
  assert.ok(issues.some((issue) => issue.message.includes("collides with a bundle output name")));
});

test("staticInputs validation rejects a duplicate servedPath within one entry", () => {
  const entry: FixtureAppEntry = {
    ...VALID_ENTRY,
    staticInputs: [
      { from: "public/wasm/frankensim.wasm", servedPath: "frankensim.wasm" },
      { from: "public/wasm/frankensim-copy.wasm", servedPath: "frankensim.wasm" },
    ],
  };
  const issues = validateFixtureAppRegistry([entry]);
  assert.ok(
    issues.some((issue) =>
      issue.message.includes('staticInputs.servedPath "frankensim.wasm" more than once'),
    ),
  );
});

test("a well-formed entry with well-formed staticInputs produces no issues", () => {
  const entry: FixtureAppEntry = {
    ...VALID_ENTRY,
    staticInputs: [{ from: "public/wasm/manifest.json", servedPath: "wasm/manifest.json" }],
  };
  assert.deepEqual(validateFixtureAppRegistry([entry]), []);
});
