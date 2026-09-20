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
 * WHICH LANE THIS RUNS IN. The override pawl below spawns biome to measure whether a
 * suppressed rule still fires, and a subprocess-spawning test cannot run under `bun test`
 * on this host. The file is therefore listed in bunfig.toml pathIgnorePatterns and runs
 * under `bun run test:node`, which is why it uses node:test and assert rather than
 * bun:test and expect. Run it alone with:
 *   node --experimental-strip-types --test src/content/kernel/formatterExclusions.test.ts
 *
 * The truth is computed from pins.json and its real import graph, never from the list
 * being checked.
 *
 * Bead: am-inst-show-the-code-4brv.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
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
    assert.deepEqual(
      missing,
      [],
      `Pinned files the formatter may still touch: ${missing.join(", ")}`,
    );
  });

  test("a stale exclusion fails: nothing is excluded that no pin depends on", () => {
    const protectedFiles = mustNotBeFormatted();
    const stale = formatterExclusions().filter((file) => !protectedFiles.includes(file));
    assert.deepEqual(
      stale,
      [],
      `Excluded from formatting but no pin depends on them: ${stale.join(", ")}`,
    );
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
        assert.ok(
          !excluded.includes(file),
          `${file} is a pinned path but is excluded from lint scope, not only from formatting.`,
        );
      }
    }
  });

  test("a JSON file that hashes its own text is excluded, and it is found by reading not by listing", () => {
    const addressed = contentAddressedData();
    // If this ever reaches zero the derivation has stopped working, and the assertions
    // above would pass over an empty set without noticing.
    assert.ok(
      addressed.length > 0,
      "No content-addressed JSON found: the derivation has stopped working.",
    );
    assert.ok(
      addressed.includes("src/physics/reference/philox.vectors.json"),
      "philox.vectors.json is no longer detected as content-addressed.",
    );
    for (const file of addressed) {
      assert.ok(
        formatterExclusions().includes(file),
        `${file} hashes its own text but the formatter may still reformat it.`,
      );
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
    assert.ok(
      lintOverrides.length > 0,
      "No lint overrides found, so this pawl would pass vacuously.",
    );

    // What each override is justified by. Adding an override means adding its evidence
    // here, which is the point: an override with no recorded reason fails this test.
    //
    // Two kinds. A FILE override is justified by the finding still being in that file. A
    // GLOB override covering a whole class of files cannot be checked that way, so it is
    // justified by its scope instead, against a written-out allowlist of permitted class
    // globs: the only class relaxation this repository allows is over test code, where
    // `any` is how a test hands a decoder something its types forbid in order to exercise
    // a refusal path. A glob that is not on that allowlist fails.
    //
    // The `why` lines are documentation and are not asserted. The ASSERTION is the
    // measurement below: biome is re-run over the file with the rule forced back on, and
    // the override is only justified while the rule still fires there. An earlier version
    // asserted a hand-written `mustContain` string instead, and it was vacuous - taking
    // biome's own suggested fix turned "disp=0.707" into "disp=0.7071067811865476", which
    // still CONTAINS the recorded evidence, so the stale override passed. Do not put a
    // substring back here.
    const fileEvidence: Record<string, { group: string; rule: string; why: string }> = {
      "scripts/e2e/controlledComparison.mjs": {
        group: "suspicious",
        rule: "noApproximativeNumericConstant",
        why: "The adversarial fixture must compare the site's printed 0.70711 against a pinned expected number; Math.SQRT1_2 would test arithmetic instead of the site.",
      },
      "src/reader/entrances/LightQuantaFirstEncounter.tsx": {
        group: "suspicious",
        rule: "noArrayIndexKey",
        why: "The index is the token's identity: the circle renders token + 1, the aria-label says Token n, and the caption says the labels are what distinguish tokens.",
      },
      // The four a11y overrides (am-6iz4, authorised by TanElk 2026-09-20). Each element
      // is a scrolling region whose tabIndex is the keyboard's only route into the hidden
      // content, which WCAG 2.1.1 and src/testing/a11y/scrollableRegions.test.ts both
      // require; the lint rule forbids that same attribute. THE RULE'S OWN REMEDY WAS
      // MEASURED AND IS UNAVAILABLE, so nobody needs to redo the table: on one real site,
      //   <section ... tabIndex={0}>                1 error   noNoninteractiveTabindex
      //   <div role="region" ... tabIndex={0}>      2 errors  + useSemanticElements
      //   <section role="region" ... tabIndex={0}>  3 errors  + noRedundantRoles
      // noNoninteractiveTabindex fires with role="region" present, and useSemanticElements
      // sends the div form back to <section>, which is where it started. A role on a
      // <table> fares no better: role="grid" trades it for
      // noNoninteractiveElementToInteractiveRole.
      //
      // The pawl below is what keeps these honest. If one of these elements is ever made
      // to fit, its tabIndex goes and biome stops reporting the rule there, and the probe
      // then fails the override as dead config rather than letting it linger.
      "src/components/lab/RodSimultaneityLab.tsx": {
        group: "a11y",
        rule: "noNoninteractiveTabindex",
        why: "The spacetime coordinates table at :688 measures 325/216 at 320px - 109 pixels hidden - driven by its Simultaneity column, 105 of the 325, holding the unbreakable words Simultaneous and Ordered (-). SAID OUT LOUD SO THIS IS NEVER READ AS COVERING THE FILE: the telemetry table at :749 in the same file FITS, at 216/216, and keeps its tabIndex only because dropping it would need a RECORDED_NON_OVERFLOWING entry keyed by file and class, which would also cover :688, which does not fit.",
      },
      "src/equations/missingStep/MissingStepPanel.tsx": {
        group: "a11y",
        rule: "noNoninteractiveTabindex",
        why: "One JSX site rendering many expressions: 2 of the 8 instances on /papers/brownian-motion/ overflow at both viewports, 285/254 and 283/254 at 320px, 317/295 and 315/295 at 1280px. The other 6 fit, so this is not a whole-site claim, and the site has to serve the widest.",
      },
      "src/reader/entrances/MassEnergyFirstEncounter.tsx": {
        group: "a11y",
        rule: "noNoninteractiveTabindex",
        why: "The me-table measures 480/262 at 320px on both pages that render it - 218 pixels hidden - and 730/730 at 1280px.",
      },
      "src/visuals/overlays/DatasetTable.tsx": {
        group: "a11y",
        rule: "noNoninteractiveTabindex",
        why: "NOT MEASURED, and that is the honest word for it: DatasetOverlay is mounted by no route and its showTable prop defaults to false, so this element renders nowhere in the built site and cannot be measured there. It is a scroll container by construction - inline overflowX: auto around a historical dataset whose column count comes from the record - and it carries no className, so no class-keyed gate can see it either. When a route mounts it, measure it and revisit this entry.",
      },
      "src/components/lab/PredictOverlay.test.tsx": {
        group: "suspicious",
        rule: "noApproximativeNumericConstant",
        why: "0.707 is a reader's typed prediction and the assertion pins the rendered string disp=0.707; Math.SQRT1_2 renders 0.7071067811865476 and breaks it.",
      },
    };
    // The class relaxations this repository allows, written out in full, with the rule each
    // one is allowed to relax. This is a MEMBERSHIP test, not a pattern test. The first
    // version asked `glob.includes(".test.")`, which would have admitted
    // `src/reader/notes.test.helpers/**` - product code carrying a substring that looks
    // like test code. Widening a class relaxation now means adding its exact glob here,
    // which is a reviewable decision rather than something a directory name can arrange
    // on its own.
    const classEvidence: Record<string, { rule: string }> = {
      "**/*.test.ts": { rule: "noExplicitAny" },
      "**/*.test.tsx": { rule: "noExplicitAny" },
      "**/*.test.mjs": { rule: "noExplicitAny" },
      "**/__fixtures__/**": { rule: "noExplicitAny" },
      "src/testing/**": { rule: "noExplicitAny" },
    };

    for (const override of lintOverrides) {
      for (const file of override.includes ?? []) {
        if (file.includes("*")) {
          const scope = classEvidence[file];
          assert.ok(
            scope !== undefined,
            `Class-wide lint override is not on the allowlist, so it may reach product code: ${file}`,
          );
          if (!scope) continue;
          assert.ok(
            JSON.stringify(override.linter?.rules).includes(scope.rule),
            `The class override on ${file} does not relax ${scope.rule}.`,
          );
          continue;
        }
        const known = fileEvidence[file];
        assert.ok(
          known !== undefined,
          `No recorded justification for the lint override on ${file}`,
        );
        if (!known) continue;
        assert.ok(
          existsSync(join(ROOT, file)),
          `The lint override names a file that does not exist: ${file}`,
        );
        assert.ok(
          JSON.stringify(override.linter?.rules).includes(known.rule),
          `The override on ${file} does not relax ${known.rule}.`,
        );
        // Ask biome whether the rule still fires here, with `--only` forcing it back on
        // over this very override. A suppression that no longer suppresses anything is
        // dead config, and dead config is how a rule gets turned off for a file that has
        // since grown a real defect.
        const probe = spawnSync(
          join(ROOT, "node_modules/.bin/biome"),
          ["check", `--only=${known.group}/${known.rule}`, file],
          { cwd: ROOT, encoding: "utf8" },
        );
        assert.ok(
          probe.error === undefined,
          `Could not run biome to check the override on ${file}`,
        );
        assert.ok(
          `${probe.stdout}${probe.stderr}`.includes(`lint/${known.group}/${known.rule}`),
          `The lint override on ${file} is stale: biome no longer reports ${known.rule} there, so the suppression is dead config.`,
        );
      }
    }
  });

  test("the list is not empty, so a deleted section cannot pass as a clean one", () => {
    assert.ok(
      mustNotBeFormatted().length > 0,
      "The protected set is empty, so every assertion above is vacuous.",
    );
    assert.equal(formatterExclusions().length, mustNotBeFormatted().length);
  });
});
