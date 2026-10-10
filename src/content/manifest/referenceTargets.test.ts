/**
 * EVERY REFERENCE TARGET IN A SOURCE MANIFEST POINTS AT SOMETHING THAT EXISTS
 * (am-edn-german-edition-mass-energy-srv).
 *
 * Nothing asked this until now. `validator.ts:468` resolves a reference's `target.citationId`
 * against the citation set, and for `target.id` it checks PRESENCE only (:479), so a target that
 * is merely SPELLED is indistinguishable from one that points somewhere. The defect that found
 * the gap: mass-energy's two references into the relativity paper, "l. c. s 8" and "l. c. s 10",
 * named `ap-17-891-s8` and `ap-17-891-s10`. No id in that manifest, or in any other record in
 * the tree, has ever been spelled with the bibliographic key. Both were dangling for as long as
 * they existed, in a paper AGENTS.md calls the first planned for completion.
 *
 * Measured over all four manifests at the time this was written: 49 references carry a target id,
 * 47 internal and 2 cross-paper. The two cross-paper ones were the only unresolved pair.
 *
 * WHAT COUNTS AS RESOLVING, and the third clause is the one that took a measurement to find:
 *
 *   1. a unit id in the target paper's manifest;
 *   2. an id the target paper EXPORTS (`exportedResults[].id` or `.resultId`), since a
 *      cross-paper reference may name a result rather than a place;
 *   3. a SECTION id that the target paper's units declare in their `section` field.
 *
 * Without the third, relativity's own `s6-p8-r1`, whose printed text is "Einleitung" and whose
 * target is `s0`, would be reported dangling -- and it is not. An unnumbered introduction prints
 * no section heading, so there is nothing to inventory as a `section-heading` unit, and `s0` is
 * therefore a real section with no unit of its own. AGENTS.md says so in the id grammar: "the
 * unnumbered introductions of papers 1-3 also use `s0`". A rule written from the two broken
 * records alone would have reddened that correct one, which is why the whole population was
 * measured before the rule was chosen.
 *
 * A target naming a paper with no manifest is a finding rather than a skip. Skipping it is how a
 * reference to a paper that does not exist would read as clean.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { validateSourceManifest } from "./schema.ts";
import type { ManifestUnitReference, SourceManifest } from "./types.ts";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

function manifestOf(root: string, paper: string): SourceManifest {
  const path = join(root, "content", "source-blocks", paper, "manifest.yaml");
  return validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
}

/** Every id a reference may legitimately name in one paper: units, exports, and sections. */
export function addressableIds(manifest: SourceManifest): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const unit of manifest.units) {
    ids.add(unit.id);
    if (unit.section !== undefined && unit.section !== "") ids.add(unit.section);
  }
  // BOTH export keys, because the type declares both and only one is in use. Reading only
  // `exportedResults` would make a manifest that chose `exports` report its own results as
  // unreachable, which is the kind of false finding a rule written from one sample produces.
  for (const result of [...(manifest.exportedResults ?? []), ...(manifest.exports ?? [])]) {
    if (result.id !== undefined) ids.add(result.id);
    if (result.resultId !== undefined) ids.add(result.resultId);
  }
  return ids;
}

export type TargetFinding = Readonly<{ paper: string; refId: string; target: string; why: string }>;

/** Unresolved targets across a set of manifests, keyed by paper. One finding per reference. */
export function unresolvedTargets(
  manifests: ReadonlyMap<string, SourceManifest>,
): readonly TargetFinding[] {
  const pools = new Map<string, ReadonlySet<string>>();
  for (const [paper, manifest] of manifests) pools.set(paper, addressableIds(manifest));

  const findings: TargetFinding[] = [];
  for (const [paper, manifest] of manifests) {
    for (const unit of manifest.units) {
      const refs: readonly ManifestUnitReference[] = unit.references ?? [];
      for (const ref of refs) {
        const id = ref.target?.id;
        if (id === undefined || id === "") continue;
        const home = ref.target?.paper ?? paper;
        const pool = pools.get(home);
        const refId = ref.id;
        if (pool === undefined) {
          findings.push({
            paper,
            refId,
            target: `${home}#${id}`,
            why: `no manifest was loaded for paper "${home}", so this target cannot be resolved`,
          });
          continue;
        }
        if (!pool.has(id)) {
          findings.push({
            paper,
            refId,
            target: `${home}#${id}`,
            why: `"${id}" is not a unit, section or exported result of ${home}`,
          });
        }
      }
    }
  }
  return findings;
}

/** The smallest manifest shape these tests need, cast once so the fixtures stay readable. */
function fixture(
  units: readonly Record<string, unknown>[],
  exported?: readonly Record<string, unknown>[],
) {
  return { units, ...(exported ? { exportedResults: exported } : {}) } as unknown as SourceManifest;
}

describe("a source manifest's reference targets resolve", () => {
  test("the three ways a target resolves, and the two ways it does not", () => {
    // Fixtures first, because the sweep below is only worth its green if the predicate can go red,
    // and each of the three resolving clauses is separable here. A predicate that dropped the
    // section clause would pass the unit case and fail this one.
    const target = fixture(
      [
        { id: "s1", kind: "section-heading" },
        { id: "s0-p1", kind: "paragraph", section: "s0" },
        { id: "s8-p1", kind: "paragraph", section: "s8" },
      ],
      [{ id: "eq-s8-d4", resultId: "eq-s8-d4" }],
    );

    const ref = (id: string, paper?: string) =>
      fixture([
        {
          id: "s0-p4",
          kind: "paragraph",
          references: [{ id: "s0-p4-r1", target: paper ? { id, paper } : { id } }],
        },
      ]);

    const withTarget = (id: string) =>
      unresolvedTargets(
        new Map([
          ["mass-energy", ref(id, "special-relativity")],
          ["special-relativity", target],
        ]),
      );

    expect(withTarget("s0-p1")).toEqual([]); // 1. a unit id
    expect(withTarget("eq-s8-d4")).toEqual([]); // 2. an exported result
    expect(withTarget("s8")).toEqual([]); // 3. a section only its units declare
    expect(withTarget("s0")).toEqual([]); // 3 again, the unnumbered introduction

    // The real defect, in its original spelling.
    const dangling = withTarget("ap-17-891-s8");
    expect(dangling.length).toBe(1);
    expect(dangling[0]?.target).toBe("special-relativity#ap-17-891-s8");
    expect(dangling[0]?.why).toMatch(/not a unit, section or exported result/);

    // A target naming a paper nobody loaded is a finding, never a skip.
    const unknownPaper = unresolvedTargets(new Map([["mass-energy", ref("s1", "no-such-paper")]]));
    expect(unknownPaper.length).toBe(1);
    expect(unknownPaper[0]?.why).toMatch(/no manifest was loaded/);

    // And the boundaries. A reference with no target id is not this check's business (the
    // validator flags it as citation-target-missing), and a bare id resolves in its OWN paper.
    expect(
      unresolvedTargets(
        new Map([
          [
            "special-relativity",
            fixture([
              {
                id: "s6-p8",
                kind: "paragraph",
                references: [{ id: "s6-p8-r1", target: { citationId: "ap-17-891" } }],
              },
            ]),
          ],
        ]),
      ),
    ).toEqual([]);
    expect(
      unresolvedTargets(
        new Map([
          [
            "special-relativity",
            fixture([
              { id: "s1", kind: "section-heading" },
              {
                id: "s6-p8",
                kind: "paragraph",
                references: [{ id: "s6-p8-r1", target: { id: "s1" } }],
              },
            ]),
          ],
        ]),
      ),
    ).toEqual([]);
  });

  test("0 of the committed targets dangles, over all four papers at once", () => {
    // All four together, because a cross-paper target cannot be checked by a per-paper test:
    // it is resolved against a manifest that test would never load. That is the reason these two
    // stayed dangling while every paper had its own manifest suite.
    const manifests = new Map<string, SourceManifest>();
    for (const paper of PAPERS) manifests.set(paper, manifestOf(ROOT, paper));
    expect(manifests.size).toBe(PAPERS.length);

    const byKind = new Map<string, number>();
    let withTargetId = 0;
    for (const [, manifest] of manifests) {
      for (const unit of manifest.units) {
        for (const ref of unit.references ?? []) {
          const id = ref.target?.id;
          if (id === undefined || id === "") continue;
          withTargetId += 1;
          const kind = ref.kind ?? "(no kind)";
          byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
        }
      }
    }
    const findings = unresolvedTargets(manifests);
    console.log(
      `[reference targets] ${withTargetId} reference(s) carry a target id across ` +
        `${manifests.size} manifests (${[...byKind].map(([k, n]) => `${k} ${n}`).join(", ")}); ` +
        `${findings.length} unresolved`,
    );
    expect(findings).toEqual([]);
    // Non-vacuity with its reason stated: four manifests that declared no references at all would
    // iterate nothing and report a clean sweep. 49 is the committed population on 2026-10-10.
    expect(withTargetId).toBeGreaterThanOrEqual(49);
    expect(byKind.get("cross-paper") ?? 0).toBeGreaterThan(0);
  });
});
