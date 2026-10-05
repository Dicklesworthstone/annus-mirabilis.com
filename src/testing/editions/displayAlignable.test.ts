/**
 * A DISPLAY EQUATION IS AN ALIGNABLE GERMAN UNIT (am-edn-alignment-tooling-do1).
 *
 * The population this is about, measured over the four papers' alignment records and manifests on
 * 2026-10-05, with the commands in the bead comment:
 *
 *   paper                authored edges   display-equation units   edges refused before this fix
 *   mass-energy                     43                        7                             7
 *   light-quanta                   235                       52                            52
 *   brownian-motion                162                       43                            43
 *   special-relativity             381                       98                            98
 *
 * 200 refused edges and 200 declared display units: every display equation carries exactly one
 * edge, every one of the 200 sources is present in its own manifest, and `isPermanentGermanId`
 * could not describe any of them. Each refusal also cost its English unit an `unaligned-target`,
 * so the issue counts arrived in matched pairs (7+7, 52+52, 43+43, 98+98).
 *
 * The tests below read the real corpus rather than a fixture, because the defect was that the
 * predicate and the corpus disagreed; a fixture written to the predicate could not have shown it.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import {
  classifyAlignableUnit,
  isPermanentEquationAnchor,
  isPermanentGermanId,
} from "../../content/editions/alignableIds.ts";
import { edgesFromAlignment } from "../../content/editions/alignment.ts";
import { validateAlignment } from "../../content/schemas/source.ts";

// `process.cwd()`, as the sibling contract test does: this repository does not declare Bun's
// `import.meta.dir` on ImportMeta, so using it typechecks nowhere but in the runner.
const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

function edgesOf(slug: string) {
  const path = join(ROOT, `content/alignments/${slug}.yaml`);
  return edgesFromAlignment(validateAlignment(parseYaml(readFileSync(path, "utf8")), path));
}

function displayUnitIds(slug: string): string[] {
  const path = join(ROOT, `content/source-blocks/${slug}/manifest.yaml`);
  const manifest = parseYaml(readFileSync(path, "utf8")) as {
    units?: { id?: string; kind?: string }[];
  };
  return (manifest.units ?? [])
    .filter((u) => u.kind === "display-equation" && typeof u.id === "string")
    .map((u) => u.id as string);
}

describe("a display-equation anchor is a permanent German alignable id", () => {
  it("accepts a 1-indexed display anchor, and still refuses index zero", () => {
    expect(isPermanentGermanId("eq-s3-d1")).toBe(true);
    expect(isPermanentGermanId("eq-s0-d7")).toBe(true);
    // The rejection this fix must NOT have swallowed: display indices are 1-indexed.
    expect(isPermanentGermanId("eq-s3-d0")).toBe(false);
    expect(isPermanentEquationAnchor("eq-s3-d0")).toBe(false);
  });

  it("classifies it as a block-aligned display, where it used to classify as nothing", () => {
    const classified = classifyAlignableUnit("eq-s3-d1");
    expect(classified).not.toBeNull();
    expect(classified?.kind).toBe("display");
    expect(classified?.alignsAt).toBe("block");
    // A sentence still aligns at the sentence, so the new branch did not capture its neighbours.
    expect(classifyAlignableUnit("s1-p1-s1")?.alignsAt).toBe("sentence");
    expect(classifyAlignableUnit("eq-s3-d0")).toBeNull();
  });

  it("every display unit each manifest declares is now an acceptable alignment source", () => {
    const refused: string[] = [];
    let examined = 0;
    for (const slug of PAPERS)
      for (const id of displayUnitIds(slug)) {
        examined += 1;
        if (!isPermanentGermanId(id)) refused.push(`${slug}/${id}`);
      }
    // The denominator, so a corpus that stopped declaring display units cannot pass this quietly.
    expect(examined).toBeGreaterThanOrEqual(200);
    // `eq-A` is Einstein's printed equation (A), a LETTER label the anchor grammar does not admit.
    // It is named rather than counted, because it is one permanent record and not an arithmetic
    // coincidence, and the grammar belongs to am-cm-id-scheme-8bn.
    expect(refused).toEqual(["special-relativity/eq-A"]);
  });

  it("the authored edges from those units are accepted, which is what had emptied the alignment", () => {
    const perPaper: string[] = [];
    for (const slug of PAPERS) {
      const edges = edgesOf(slug);
      const displays = new Set(displayUnitIds(slug));
      const fromDisplay = edges.filter((e) => displays.has(e.sourceId));
      const refused = fromDisplay.filter((e) => !isPermanentGermanId(e.sourceId));
      // Non-vacuity: this paper really does align its displays, so "none refused" is a result.
      expect(fromDisplay.length).toBeGreaterThan(0);
      perPaper.push(`${slug}: ${fromDisplay.length} display edge(s), ${refused.length} refused`);
      expect(refused.map((e) => e.sourceId)).toEqual(slug === "special-relativity" ? ["eq-A"] : []);
    }
    console.log(`[display alignment] ${perPaper.join(" | ")}`);
  });
});
