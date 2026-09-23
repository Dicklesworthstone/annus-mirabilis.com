/**
 * Xcode's output stays outside the repository. The failure this guards against
 * happened: DerivedData under ios/build/ put the edition's figures/plates/pages/
 * inside ios/, and the architecture gate refused every pane's commit.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DERIVED_DATA_PATH, isInsideRepository, xcodebuildArguments } from "./xcode.ts";

const REPO = "/Users/someone/projects/annus-mirabilis.com";

describe("isInsideRepository", () => {
  it("sees the old ios/build location, and the repository itself, as inside", () => {
    assert.equal(isInsideRepository(REPO, `${REPO}/ios/build/DerivedData`), true);
    assert.equal(isInsideRepository(REPO, REPO), true);
    assert.equal(isInsideRepository(REPO, `${REPO}/./ios/../ios/build`), true);
    assert.equal(isInsideRepository(REPO, `${REPO}/..hidden-but-inside`), true);
  });

  it("sees a sibling whose name only starts like the repository as outside", () => {
    assert.equal(isInsideRepository(REPO, `${REPO}-DerivedData`), false);
    assert.equal(
      isInsideRepository(
        REPO,
        "/Users/someone/Library/Developer/Xcode/DerivedData/AnnusMirabilis-am",
      ),
      false,
    );
    assert.equal(isInsideRepository(REPO, `${REPO}/../elsewhere`), false);
  });

  it("puts the real DerivedData path outside this repository", () => {
    assert.equal(isInsideRepository(process.cwd(), DERIVED_DATA_PATH), false);
  });
});

describe("xcodebuildArguments", () => {
  it("always names the derived data path and the simulator, and ends with the action", () => {
    const args = xcodebuildArguments({
      command: "build",
      device: "AM iPhone 17",
      derivedDataPath: "/tmp/dd",
    });
    assert.equal(args[args.indexOf("-derivedDataPath") + 1], "/tmp/dd");
    assert.equal(
      args[args.indexOf("-destination") + 1],
      "platform=iOS Simulator,name=AM iPhone 17",
    );
    assert.equal(args.at(-1), "build");
    assert.equal(args.includes("-resultBundlePath"), false);
  });

  it("gives a test run a result bundle", () => {
    const args = xcodebuildArguments({
      command: "test",
      device: "AM iPad",
      derivedDataPath: "/tmp/dd",
      resultBundlePath: "/tmp/dd/Results/run.xcresult",
    });
    assert.equal(args[args.indexOf("-resultBundlePath") + 1], "/tmp/dd/Results/run.xcresult");
    assert.equal(args.at(-1), "test");
  });
});
