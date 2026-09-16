import assert from "node:assert/strict";
import test from "node:test";
import { parseE2ECliArgs } from "./cli.ts";

test("--paper, --fixtures, --smoke, --lane, and --journey parse", () => {
  assert.deepEqual(parseE2ECliArgs(["--paper", "brownian-motion"]), {
    mode: { kind: "paper", paperSlug: "brownian-motion" },
    lane: undefined,
    journey: undefined,
  });
  assert.deepEqual(parseE2ECliArgs(["--fixtures"]), { mode: { kind: "fixtures" }, lane: undefined, journey: undefined });
  assert.deepEqual(parseE2ECliArgs(["--smoke"]), { mode: { kind: "smoke" }, lane: undefined, journey: undefined });
  assert.deepEqual(parseE2ECliArgs(["--smoke", "--lane", "desktop"]), {
    mode: { kind: "smoke" },
    lane: "desktop",
    journey: undefined,
  });
  assert.deepEqual(parseE2ECliArgs(["--smoke", "--journey", "enter-source-passage"]), {
    mode: { kind: "smoke" },
    lane: undefined,
    journey: "enter-source-passage",
  });
  assert.deepEqual(parseE2ECliArgs(["--paper", "brownian-motion", "--lane", "touch-320", "--journey", "operate-instrument"]), {
    mode: { kind: "paper", paperSlug: "brownian-motion" },
    lane: "touch-320",
    journey: "operate-instrument",
  });
});

test("an unknown lane is rejected with the list of lanes", () => {
  assert.throws(() => parseE2ECliArgs(["--smoke", "--lane", "bogus-lane"]), /unknown lane "bogus-lane"; known lanes:/);
});

test("an unknown paper slug is rejected", () => {
  assert.throws(
    () => parseE2ECliArgs(["--paper", "light-quanta"], ["brownian-motion"]),
    /unknown paper slug "light-quanta"; known papers: brownian-motion/,
  );
  // With no known-slug list supplied, only the flag grammar is checked.
  assert.deepEqual(parseE2ECliArgs(["--paper", "light-quanta"]).mode, { kind: "paper", paperSlug: "light-quanta" });
});

test("selecting more than one of --paper, --fixtures, --smoke fails", () => {
  assert.throws(() => parseE2ECliArgs(["--fixtures", "--smoke"]), /select exactly one of/);
});

test("selecting none of --paper, --fixtures, --smoke fails", () => {
  assert.throws(() => parseE2ECliArgs(["--lane", "desktop"]), /select exactly one of/);
});

test("--paper without a value fails", () => {
  assert.throws(() => parseE2ECliArgs(["--paper"]), /--paper requires a value/);
});

test("an unrecognized option fails", () => {
  assert.throws(() => parseE2ECliArgs(["--bogus"]), /unknown option "--bogus"/);
});
