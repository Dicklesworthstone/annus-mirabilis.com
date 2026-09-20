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
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/**
 * JSON data files that content-address themselves.
 *
 * philox.vectors.json carries `provenance.sha256`, a digest of its own text with the
 * recorded hash replaced by a placeholder, and philox.vectorsProvenance.test.ts
 * recomputes it. d373e025 reformatted the file - biome formats JSON too - and the digest
 * stopped matching: bytes differ, whitespace-stripped identical. The kernel pins were the
 * first customer of this exclusion list and this is the second, which nobody anticipated
 * because the first thought was about hashed SOURCE and this is hashed DATA.
 *
 * Derived by reading the files rather than listing them, so the next data file that
 * starts hashing itself is protected the day it lands instead of the day CI notices.
 */
function contentAddressedData(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "generated") continue;
        walk(rel);
      } else if (entry.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as {
            provenance?: { sha256?: unknown };
          };
          if (typeof parsed.provenance?.sha256 === "string") found.push(rel);
        } catch {
          // Not our business here: a malformed JSON file is the content compiler's to refuse.
        }
      }
    }
  };
  walk("src");
  return found.sort();
}

/** Everything the formatter must not touch, from both sources. */
function mustNotBeFormatted(): string[] {
  return [...new Set([...pinnedFiles(), ...contentAddressedData()])].sort();
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
    const missing = mustNotBeFormatted().filter((f) => !formatterExclusions().includes(f));
    // A pinned file the formatter may still touch is one repo-wide format away from
    // drifting its pin, which is exactly how d373e025 broke three of them.
    expect(missing).toEqual([]);
  });

  test("a stale exclusion fails: nothing is excluded that no pin depends on", () => {
    const protectedFiles = mustNotBeFormatted();
    const stale = formatterExclusions().filter((file) => !protectedFiles.includes(file));
    expect(stale).toEqual([]);
  });

  test("the exclusion is formatter-only, so lint still reaches pinned code", () => {
    const biome = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as {
      linter?: { includes?: string[] };
      files?: { includes?: string[] };
    };
    const pinned = mustNotBeFormatted();
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

  test("a JSON file that hashes its own text is excluded, and it is found by reading not by listing", () => {
    const addressed = contentAddressedData();
    // If this ever reaches zero the derivation has stopped working, and the assertions
    // above would pass over an empty set without noticing.
    expect(addressed.length).toBeGreaterThan(0);
    expect(addressed).toContain("src/physics/reference/philox.vectors.json");
    for (const file of addressed) {
      expect(formatterExclusions()).toContain(file);
    }
  });

  /**
   * The pawl for LINT overrides, which are a different animal from the formatter ones.
   *
   * A formatter exclusion is justified by a pin that exists; a lint override is justified
   * by a finding that exists. The failure mode is the same either way: the code moves on,
   * the entry stays, and the rule is quietly off over something nobody checked. So every
   * override must still be needed - the file present, and the thing the rule objects to
   * still in it.
   *
   * scripts/e2e/controlledComparison.mjs is the one entry today. Its two assertions read
   * `0.70711`, which is 1/sqrt(2) at the five significant figures the interface renders
   * (src/experiments/compare/comparisonStatement.ts formats it with toPrecision(5)), used
   * as the expected value in an equality assertion. noApproximativeNumericConstant wants
   * Math.SQRT1_2, which would assert a full-precision float the reader never sees. If
   * those assertions are ever rewritten, this fails and the override goes.
   */
  test("every lint override still has a real finding under it", () => {
    const biome = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as {
      overrides?: { includes?: string[]; linter?: { rules?: Record<string, unknown> } }[];
    };
    const lintOverrides = (biome.overrides ?? []).filter((o) => o.linter?.rules);
    expect(lintOverrides.length).toBeGreaterThan(0);

    // What each override is justified by. Adding an override means adding its evidence
    // here, which is the point: an override with no recorded reason fails this test.
    //
    // Two kinds. A FILE override is justified by the finding still being in that file. A
    // GLOB override covering a whole class of files cannot be checked that way, so it is
    // justified by its scope instead: the only class relaxation this repository allows is
    // over test code, where `any` is how a test hands a decoder something its types
    // forbid in order to exercise a refusal path. If those globs ever widen to product
    // code, this fails.
    const fileEvidence: Record<string, { rule: string; mustContain: string }> = {
      "scripts/e2e/controlledComparison.mjs": {
        rule: "noApproximativeNumericConstant",
        mustContain: "0.70711",
      },
      "src/reader/entrances/LightQuantaFirstEncounter.tsx": {
        rule: "noArrayIndexKey",
        mustContain: "<g key={token}>",
      },
    };
    const isTestScope = (glob: string) =>
      glob.includes(".test.") || glob.includes("__fixtures__") || glob.startsWith("src/testing/");

    for (const override of lintOverrides) {
      for (const file of override.includes ?? []) {
        if (file.includes("*")) {
          // A class relaxation: allowed only over test code, and it must say which rule.
          expect(isTestScope(file), `Class-wide lint override reaches product code: ${file}`).toBe(
            true,
          );
          expect(JSON.stringify(override.linter?.rules)).toContain("noExplicitAny");
          continue;
        }
        const known = fileEvidence[file];
        expect(known, `No recorded justification for the lint override on ${file}`).toBeDefined();
        if (!known) continue;
        expect(existsSync(join(ROOT, file))).toBe(true);
        // The finding must still be there. If the assertion was rewritten, the override is
        // stale and this is where that surfaces. Asserted as a boolean so a stale override
        // reports the file and the missing evidence instead of dumping the whole source.
        expect(
          readFileSync(join(ROOT, file), "utf8").includes(known.mustContain),
          `The lint override on ${file} is stale: ${known.rule} was suppressed because of ${known.mustContain}, which is no longer in the file.`,
        ).toBe(true);
        expect(JSON.stringify(override.linter?.rules)).toContain(known.rule);
      }
    }
  });

  test("the list is not empty, so a deleted section cannot pass as a clean one", () => {
    expect(mustNotBeFormatted().length).toBeGreaterThan(0);
    expect(formatterExclusions().length).toBe(mustNotBeFormatted().length);
  });
});
