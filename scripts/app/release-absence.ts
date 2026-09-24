/**
 * A reader's build carries none of the app's test-only code: bead am-app-bridge-protocol-ai2g,
 * "Release builds contain no test.log or test.snapshot handling", and am-app-test-harness-da6e,
 * "the release gate proves their absence". The Apple gate builds the Release configuration and
 * searches its executables for strings that only DEBUG-only code contains.
 *
 * A byte search cannot see every string. An optimized build may pack a string literal of 15 UTF-8
 * bytes or fewer into the instructions that use it, so "test.log" could be compiled in and still
 * read as absent. (The unoptimized DEBUG build stores it whole; measured 2026-09-24.) Each marker
 * here is either a literal longer than that, or a name the reflection metadata stores as a C string:
 * a type's, or a class's stored property's, which stripping symbols does not remove. And each must
 * first be FOUND in the DEBUG build's executables (the positive control), or its absence from the
 * Release build is not evidence of anything.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Strings only DEBUG-only code contains, each stored whole (see above). */
export const TEST_ONLY_MARKERS: readonly string[] = [
  // TestEvidence.bounded's header, and TestEvidence's type name.
  "am-test-evidence route=",
  "TestEvidence",
  // The lifecycle event and the setup record that EditionSession+TestEvidence writes.
  "web-process-terminated",
  "missing or not matching its digest",
  // BridgeRouter's properties that the test.log and test.snapshot handling calls.
  "onTestLog",
  "onTestSnapshot",
];

/**
 * Names every build carries, stored the same way as the markers: BridgeRouter's onStorageWrite is
 * declared beside onTestLog, and the scheme handler's type name beside TestEvidence's. Each must be
 * found in the Release build, or a search that sees nothing there (reflection metadata stripped, the
 * wrong file read) would pass every absence. Measured on 2026-09-24: both found, neither marker.
 */
export const RELEASE_CONTROLS: readonly string[] = ["onStorageWrite", "EditionSchemeHandler"];

/** The Mach-O files at the top of an .app: the executable, and in DEBUG its .debug.dylib. */
export function appExecutables(app: string): string[] {
  if (!existsSync(app)) return [];
  const name =
    app
      .replace(/\/$/, "")
      .split("/")
      .at(-1)
      ?.replace(/\.app$/, "") ?? "";
  return readdirSync(app)
    .filter((entry) => entry === name || entry.endsWith(".dylib"))
    .map((entry) => join(app, entry))
    .filter((path) => statSync(path).isFile());
}

/** Which markers occur, as bytes, in any of the files. */
export function markersIn(files: readonly string[], markers: readonly string[]): string[] {
  const contents = files.map((file) => readFileSync(file));
  return markers.filter((marker) =>
    contents.some((bytes) => bytes.includes(Buffer.from(marker, "utf8"))),
  );
}

export type AbsenceVerdict = {
  readonly outcome: "passed" | "failed";
  readonly message: string;
};

/**
 * Passes only when every marker is found in the DEBUG build and none in the Release build, and
 * both builds had executables to search.
 */
export function releaseAbsenceVerdict(input: {
  readonly markers: readonly string[];
  readonly debugFiles: readonly string[];
  readonly releaseFiles: readonly string[];
  readonly foundInDebug: readonly string[];
  readonly foundInRelease: readonly string[];
  /** Which of RELEASE_CONTROLS the Release build showed. */
  readonly controlsInRelease: readonly string[];
}): AbsenceVerdict {
  if (input.debugFiles.length === 0 || input.releaseFiles.length === 0) {
    return {
      outcome: "failed",
      message: `No executables to search (DEBUG ${input.debugFiles.length}, Release ${input.releaseFiles.length}). Nothing searched is not an absence.`,
    };
  }
  const unseen = input.markers.filter((marker) => !input.foundInDebug.includes(marker));
  if (unseen.length > 0) {
    return {
      outcome: "failed",
      message: `The DEBUG build does not contain ${unseen.map((m) => `"${m}"`).join(", ")}, so its absence from the Release build would prove nothing. Choose a marker the byte search can see.`,
    };
  }
  const blind = RELEASE_CONTROLS.filter((control) => !input.controlsInRelease.includes(control));
  if (blind.length > 0) {
    return {
      outcome: "failed",
      message: `The Release build does not show ${blind.map((c) => `"${c}"`).join(", ")}, which every build carries, so the search cannot see what it would need to find there.`,
    };
  }
  if (input.foundInRelease.length > 0) {
    return {
      outcome: "failed",
      message: `The Release build contains test-only code: ${input.foundInRelease.map((m) => `"${m}"`).join(", ")}.`,
    };
  }
  return {
    outcome: "passed",
    message: `All ${input.markers.length} test-only markers are in the DEBUG build (${input.debugFiles.length} executable(s)) and none is in the Release build (${input.releaseFiles.length}), which shows all ${RELEASE_CONTROLS.length} control names.`,
  };
}
