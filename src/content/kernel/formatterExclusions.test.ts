/**
 * biome.json's formatter exclusions are exactly the files the pins depend on.
 *
 * WHY THE LIST EXISTS. A closure digest hashes raw bytes, so any reformatting of a file
 * inside a pinned closure invalidates the pin that certifies what show-the-code displays.
 * d373e025 ("style(repo): apply biome's format and safe fixes", 372 files) reformatted
 * two of them and took three of six closure pins red; one of the three, walks.ts, was
 * never touched and drifted transitively through its import of walkLaws.ts.
 *
 * WHY IT IS FORMAT-ONLY. The exclusion sits under `formatter.includes`, not `files` and
 * not `linter`, so a real lint error in pinned physics code still surfaces. Both
 * directions are exercised below.
 *
 * WHY THIS TEST IS SHAPED LIKE THIS. A hand-maintained exclusion list rots in two ways,
 * and a stale entry has to FAIL rather than be tolerated:
 *   - a listed path that no pin depends on any more freezes a file's formatting for no
 *     reason, and nobody would notice;
 *   - a pinned path missing from the list is unprotected, which is the defect that put
 *     the pins red in the first place.
 * The truth is computed from pins.json and its real import graph, never from the list
 * being checked.
 *
 * Bead: am-inst-show-the-code-4brv.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluatorSources } from "./sourceDigest.ts";

const ROOT = process.cwd();

/** Every file any pin depends on: the closures' whole import graphs plus the function-pin files. */
function pinnedFiles(): string[] {
  const pins = JSON.parse(readFileSync(join(ROOT, "src/content/kernel/pins.json"), "utf8")) as {
    functions: Record<string, string>;
    closures: Record<string, string>;
  };
  const union = new Set<string>();
  for (const entry of Object.keys(pins.closures)) {
    for (const [path] of evaluatorSources(ROOT, [entry])) union.add(path);
  }
  for (const key of Object.keys(pins.functions)) {
    const file = key.split("@")[1];
    if (file) union.add(file);
  }
  return [...union].sort();
}

function formatterExclusions(): string[] {
  const biome = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as {
    formatter?: { includes?: string[] };
    linter?: { includes?: string[] };
    files?: { includes?: string[] };
  };
  const includes = biome.formatter?.includes ?? [];
  return includes
    .filter((entry) => entry.startsWith("!"))
    .map((entry) => entry.slice(1))
    .sort();
}

describe("formatter exclusions for pinned kernel sources (am-inst-show-the-code-4brv)", () => {
  test("every file a pin depends on is excluded from formatting", () => {
    const missing = pinnedFiles().filter((file) => !formatterExclusions().includes(file));
    // A pinned file the formatter may still touch is one repo-wide format away from
    // drifting its pin, which is exactly how d373e025 broke three of them.
    expect(missing).toEqual([]);
  });

  test("a stale exclusion fails: nothing is excluded that no pin depends on", () => {
    const pinned = pinnedFiles();
    const stale = formatterExclusions().filter((file) => !pinned.includes(file));
    expect(stale).toEqual([]);
  });

  test("the exclusion is formatter-only, so lint still reaches pinned code", () => {
    const biome = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as {
      linter?: { includes?: string[] };
      files?: { includes?: string[] };
    };
    const pinned = pinnedFiles();
    // Neither the linter's own scope nor the global file scope may exclude a pinned path.
    for (const scope of [biome.linter?.includes ?? [], biome.files?.includes ?? []]) {
      const excluded = scope
        .filter((entry) => entry.startsWith("!"))
        .map((entry) => entry.slice(1));
      for (const file of pinned) {
        expect(excluded).not.toContain(file);
      }
    }
  });

  test("the list is not empty, so a deleted section cannot pass as a clean one", () => {
    expect(pinnedFiles().length).toBeGreaterThan(0);
    expect(formatterExclusions().length).toBe(pinnedFiles().length);
  });
});
