/**
 * The Release build's absence check, on fixture .app folders: it passes only when every marker is
 * seen in the DEBUG build and none in the Release build, and never on nothing searched.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  appExecutables,
  markersIn,
  RELEASE_CONTROLS,
  releaseAbsenceVerdict,
  TEST_ONLY_MARKERS,
} from "./release-absence.ts";

/** An .app holding an executable and a debug dylib with the given contents, plus a resource. */
function app(executable: string, dylib?: string): string {
  const root = join(mkdtempSync(join(tmpdir(), "release-absence-")), "AnnusMirabilis.app");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "AnnusMirabilis"), `\u0000\u0001${executable}\u0000`);
  if (dylib !== undefined) writeFileSync(join(root, "AnnusMirabilis.debug.dylib"), dylib);
  // A resource is not code: the test console's text ships inert and is never searched.
  writeFileSync(join(root, "test-console.js"), "am-test-evidence route= TestEvidence");
  mkdirSync(join(root, "Edition"));
  return root;
}

const all = TEST_ONLY_MARKERS.join("\u0000");
/** What every build carries (the Release side's control). */
const shipped = RELEASE_CONTROLS.join("\u0000");

function verdict(debug: string, release: string) {
  const debugFiles = appExecutables(debug);
  const releaseFiles = appExecutables(release);
  return releaseAbsenceVerdict({
    markers: TEST_ONLY_MARKERS,
    debugFiles,
    releaseFiles,
    foundInDebug: markersIn(debugFiles, TEST_ONLY_MARKERS),
    foundInRelease: markersIn(releaseFiles, TEST_ONLY_MARKERS),
    controlsInRelease: markersIn(releaseFiles, RELEASE_CONTROLS),
  });
}

describe("the Release build's absence check", () => {
  it("searches the executable and its dylibs, never a resource", () => {
    const debug = app("code", all);
    assert.deepEqual(
      appExecutables(debug).map((file) => file.split("/").at(-1)),
      ["AnnusMirabilis", "AnnusMirabilis.debug.dylib"],
    );
    assert.deepEqual(markersIn(appExecutables(app("code")), TEST_ONLY_MARKERS), []);
  });

  it("passes when the DEBUG build has every marker and the Release build none", () => {
    const result = verdict(app(`code ${shipped}`, all), app(`code ${shipped}`));
    assert.equal(result.outcome, "passed", result.message);
  });

  it("fails when the Release build carries any marker", () => {
    const result = verdict(app("code", all), app(`code ${shipped} onTestSnapshot`));
    assert.equal(result.outcome, "failed");
    assert.match(result.message, /"onTestSnapshot"/);
  });

  it("refuses a marker the DEBUG build does not show, since its absence would prove nothing", () => {
    const partial = TEST_ONLY_MARKERS.slice(1).join("\u0000");
    const result = verdict(app("code", partial), app(`code ${shipped}`));
    assert.equal(result.outcome, "failed");
    assert.match(result.message, /does not contain "am-test-evidence route="/);
  });

  it("fails when the Release build does not show the names every build carries", () => {
    const result = verdict(app("code", all), app("code, and no names at all"));
    assert.equal(result.outcome, "failed");
    assert.match(result.message, /does not show "onStorageWrite", "EditionSchemeHandler"/);
  });

  it("fails when either build has no executable to search", () => {
    const empty = join(mkdtempSync(join(tmpdir(), "release-absence-empty-")), "AnnusMirabilis.app");
    assert.equal(verdict(app("code", all), empty).outcome, "failed");
    assert.equal(verdict(empty, app(`code ${shipped}`)).outcome, "failed");
  });
});
