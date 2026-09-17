import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * A ratchet against nested value-bearing form controls (am-qt1j).
 *
 * A <select>, <textarea> or value-bearing <input> placed INSIDE its own <label>
 * contributes its value to the control's accessible name. Measured at
 * /lab/brownian-data/ before the first fix:
 *
 *   label for timeUnit -> "Time unitChoose explicitlySecondsMilliseconds"
 *   label for csv      -> "Or paste CSV text" followed by the reader's pasted CSV
 *
 * A screen reader announces every option, and the paste box announces the reader's
 * own data, as the field's name. AGENTS.md requires each control to carry a correct
 * accessible name and forbids duplicate announcements.
 *
 * WHY A RATCHET AND NOT ZERO. 106 occurrences existed across 29 files when this was
 * found, and the orchestrator measured the count holding at 106 while individual
 * files were being fixed - the pattern was being reintroduced in new lab components
 * as fast as it was removed. Asserting zero today would fail the lint/test gate on
 * pre-existing debt and would be reverted; asserting nothing lets the debt grow. So
 * this baseline may only SHRINK: a file over its recorded count fails, and a file
 * not in the baseline fails at the first occurrence. Lower a number when you fix a
 * file; never raise one. Delete the entry when the file reaches zero, and delete this
 * test when the map is empty.
 *
 * Nested <input type="checkbox"> and type="radio" are deliberately NOT counted: they
 * carry no text value, so nesting them is harmless and idiomatic.
 */

const CONTROL_IN_LABEL = /<label\b[^>]*>([\s\S]*?)<\/label>/g;
const VALUE_BEARING =
  /<(?:select|textarea)\b|<input\b[^>]*type="(?:text|number|file|search|email|url|tel|password)"/;

/** Recorded 2026-09-17. May only shrink. */
const BASELINE = new Map<string, number>([
  ["src/components/discover/BrownianInvestigation.tsx", 2],
  ["src/components/lab/BrownianLab.tsx", 3],
  ["src/components/lab/CameraLab.tsx", 4],
  ["src/components/lab/CoefficientLab.tsx", 3],
  ["src/components/lab/DriftDiffusionLab.tsx", 2],
  ["src/components/lab/InferenceLab.tsx", 5],
  ["src/components/lab/MagnetConductorLab.tsx", 3],
  ["src/components/lab/MeasuredTrajectoryLab.tsx", 1],
  ["src/components/lab/OsmoticPartitionLab.tsx", 5],
  ["src/components/lab/TracerLab.tsx", 6],
  ["src/components/lab/TrajectoryInspection.tsx", 2],
  ["src/components/lab/WalkLab.tsx", 6],
  ["src/components/lab/bm03/ConfigurationLab.tsx", 5],
  ["src/components/lab/kitchen/KitchenControls.tsx", 5],
  ["src/components/lab/kitchen/KitchenLab.tsx", 2],
  ["src/components/lab/lq03/SpectrumLab.tsx", 8],
  ["src/components/lab/sr04/LorentzMapLab.tsx", 7],
  ["src/components/lab/sr06/VelocityCompositionLab.tsx", 5],
  ["src/components/lab/sr07/FieldEquationsLab.tsx", 4],
  ["src/components/lab/sr08/FieldFrameChangeLab.tsx", 3],
  ["src/components/lab/sr09/DopplerAberrationLab.tsx", 3],
  ["src/components/lab/sr10/LightComplexLab.tsx", 4],
  ["src/components/lab/sr11/MovingMirrorLab.tsx", 5],
  ["src/components/lab/sr12/ChargeCurrentLab.tsx", 3],
  ["src/components/lab/sr13/ElectronDynamicsLab.tsx", 6],
  ["src/reader/PaperPage.tsx", 1],
  ["src/reader/PaperReader.tsx", 1],
  ["src/reader/ReaderController.tsx", 1],
  ["src/reader/actions/PassageActions.tsx", 1],
]);

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsxFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

function countNested(source: string): number {
  let n = 0;
  for (const match of source.matchAll(CONTROL_IN_LABEL)) {
    if (VALUE_BEARING.test(match[1] ?? "")) n += 1;
  }
  return n;
}

describe("nested value-bearing form controls (am-qt1j)", () => {
  test("no file exceeds its recorded baseline, and no new file introduces the pattern", () => {
    const regressions: string[] = [];
    const improvements: string[] = [];
    for (const file of tsxFiles(join(ROOT, "src"))) {
      const rel = relative(ROOT, file);
      const count = countNested(readFileSync(file, "utf8"));
      const allowed = BASELINE.get(rel) ?? 0;
      if (count > allowed) {
        regressions.push(
          `${rel}: ${count} nested value-bearing control(s), baseline ${allowed}. ` +
            "Make the control a sibling of its label and keep htmlFor/id.",
        );
      } else if (count < allowed) {
        improvements.push(`${rel}: ${count} < ${allowed}`);
      }
    }
    assert.deepEqual(
      regressions,
      [],
      `Nested value-bearing controls increased:\n${regressions.join("\n")}\n` +
        "The control's own value becomes part of its accessible name. See am-qt1j.",
    );
    // Improvements are reported, not failed: lower the baseline in the same commit.
    if (improvements.length > 0) {
      console.log(
        `[am-qt1j] baseline can be lowered for ${improvements.length} file(s): ${improvements.join(", ")}`,
      );
    }
  });

  test("the detector actually fires on a nested select", () => {
    const planted = '<label htmlFor="x">Unit<select id="x"><option>s</option></select></label>';
    assert.equal(countNested(planted), 1);
    const sibling = '<label htmlFor="x">Unit</label><select id="x"><option>s</option></select>';
    assert.equal(countNested(sibling), 0);
    const checkbox = '<label><input type="checkbox" />Agree</label>';
    assert.equal(countNested(checkbox), 0);
  });
});
