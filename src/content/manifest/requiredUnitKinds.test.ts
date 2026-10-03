/**
 * THE GATE FOR AN ABSENT UNIT CLASS, and its own proof.
 *
 * The predicate's reasoning is in requiredUnitKinds.ts. What matters here is WHERE this reads from
 * and that it can fail. It parses the four manifests off disk with the real schema validator, so it
 * reads the inputs rather than a loader's output that may already have dropped a case, and it prints
 * the denominator it examined beside every verdict, because a sweep over zero manifests is
 * indistinguishable from a clean one.
 *
 * The plants below are the point. Four assertions about the corpus would stay green forever if the
 * predicate were vacuous, so each branch is driven with a synthetic manifest: an undeclared absence
 * must FAIL, the same absence declared must PASS, a declaration whose class is now represented must
 * be reported STALE, and a debt declaration naming no bead must be reported MALFORMED. A green
 * corpus sweep means something only because those four hold.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import {
  type AbsenceDeclarations,
  DECLARED_ABSENCES,
  malformedDeclarations,
  missingClasses,
  REQUIRED_UNIT_CLASSES,
  representedClasses,
  staleAbsenceDeclarations,
  undeclaredMissingClasses,
} from "./requiredUnitKinds.ts";
import { validateSourceManifest } from "./schema.ts";
import type { ManifestUnit, SourceManifest } from "./types.ts";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

function loadManifest(paper: string): SourceManifest {
  const path = join(process.cwd(), "content/source-blocks", paper, "manifest.yaml");
  return validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
}

/** A manifest holding exactly the unit kinds named, so a plant states its own population. */
function syntheticManifest(paper: string, kinds: readonly string[]): SourceManifest {
  const units: ManifestUnit[] = kinds.map((kind, index) => ({
    id: `${kind}-${index + 1}`,
    kind,
    locators: [{ page: 1 }],
  }));
  return {
    paper,
    document: "ap-00-000",
    status: "in-preparation",
    pageCount: 1,
    pageRange: [1, 1],
    units,
  };
}

/** Every class a complete inventory represents, so "complete" is spelled once. */
const ALL_CLASS_KINDS = REQUIRED_UNIT_CLASSES.map((required) => required.kinds[0] as string);

describe("required unit classes: the corpus", () => {
  it("examines all four manifests, and the requirement list is not empty", () => {
    // The denominator, asserted rather than assumed: a sweep over three papers, or over a
    // requirement list that had been emptied, would otherwise read exactly like a clean run.
    expect(REQUIRED_UNIT_CLASSES.length).toBeGreaterThan(0);
    const loaded = PAPERS.map((paper) => loadManifest(paper));
    expect(loaded.length).toBe(4);
    for (const manifest of loaded) {
      expect(manifest.units.length).toBeGreaterThan(0);
    }
  });

  it("every required unit class is either represented or declared absent, for each paper", () => {
    const offenders: string[] = [];
    for (const paper of PAPERS) {
      const manifest = loadManifest(paper);
      for (const missing of undeclaredMissingClasses(manifest)) {
        offenders.push(
          `${paper}: no unit of class '${missing.class.id}' (kinds ${missing.class.kinds.join("/")}) and no declaration. Requirements row: ${missing.class.requirement}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no declaration is stale: a class that is represented is not also declared absent", () => {
    const stale: string[] = [];
    for (const paper of PAPERS) {
      for (const id of staleAbsenceDeclarations(loadManifest(paper))) {
        stale.push(`${paper}: '${id}'`);
      }
    }
    expect(stale).toEqual([]);
  });

  it("every declaration is well formed: a debt names its bead, a structural absence names none", () => {
    expect(malformedDeclarations()).toEqual([]);
  });

  it("reports the outstanding debt, so the paid-down state is visible rather than asserted", () => {
    // A report, not an assertion. Numbers here would be a census and would break on correct work;
    // what is asserted is that every absence is accounted for, which the two tests above do.
    const lines: string[] = [];
    for (const paper of PAPERS) {
      const manifest = loadManifest(paper);
      for (const missing of missingClasses(manifest)) {
        const declaration = missing.declaration;
        lines.push(
          `${paper}: ${missing.class.id} absent (${declaration?.kind ?? "UNDECLARED"}${declaration?.bead ? `, owed by ${declaration.bead}` : ""})`,
        );
      }
      expect(representedClasses(manifest).size).toBeGreaterThan(0);
    }
    console.log(
      `required unit classes: ${REQUIRED_UNIT_CLASSES.length} classes over ${PAPERS.length} papers; ${lines.length} absences, all accounted for:\n  ${lines.join("\n  ")}`,
    );
    // Non-vacuity, stated on purpose: there IS outstanding debt today, so the loop above ran. When
    // the last debt is paid this flips, and the assertion is meant to be inverted by the same commit
    // that empties DECLARED_ABSENCES, not deleted.
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe("required unit classes: the predicate can fail (plants)", () => {
  const noDeclarations: AbsenceDeclarations = new Map();

  it("an undeclared absent class FAILS", () => {
    // Plant: a manifest with every class but `sentence`, and nothing declared for its paper.
    const planted = syntheticManifest(
      "planted-paper",
      ALL_CLASS_KINDS.filter((kind) => kind !== "sentence"),
    );
    expect(planted.units.some((unit) => unit.kind === "sentence")).toBe(false);
    const missing = undeclaredMissingClasses(planted, noDeclarations);
    expect(missing.map((entry) => entry.class.id)).toEqual(["sentence"]);
  });

  it("the SAME absence, declared, PASSES", () => {
    const planted = syntheticManifest(
      "planted-paper",
      ALL_CLASS_KINDS.filter((kind) => kind !== "sentence"),
    );
    const declared: AbsenceDeclarations = new Map([
      [
        "planted-paper",
        new Map([
          ["sentence", { kind: "debt" as const, reason: "planted", bead: "am-planted-0000" }],
        ]),
      ],
    ]);
    expect(undeclaredMissingClasses(planted, declared)).toEqual([]);
    // And it is still reported as outstanding debt rather than vanishing.
    expect(missingClasses(planted, declared).map((entry) => entry.class.id)).toEqual(["sentence"]);
  });

  it("a complete manifest has no absence at all, so the gate is not failing on everything", () => {
    const complete = syntheticManifest("planted-paper", ALL_CLASS_KINDS);
    expect(undeclaredMissingClasses(complete, noDeclarations)).toEqual([]);
    expect(missingClasses(complete, noDeclarations)).toEqual([]);
    expect(representedClasses(complete).size).toBe(REQUIRED_UNIT_CLASSES.length);
  });

  it("either spelling of the heading row satisfies it", () => {
    for (const spelling of ["heading", "section-heading"]) {
      const planted = syntheticManifest("planted-paper", [spelling]);
      expect(representedClasses(planted).has("section-heading")).toBe(true);
    }
  });

  it("a declaration for a class that IS represented is reported stale", () => {
    const complete = syntheticManifest("planted-paper", ALL_CLASS_KINDS);
    const declared: AbsenceDeclarations = new Map([
      [
        "planted-paper",
        new Map([
          ["sentence", { kind: "debt" as const, reason: "planted", bead: "am-planted-0000" }],
          ["not-a-real-class", { kind: "structural" as const, reason: "planted" }],
        ]),
      ],
    ]);
    expect(staleAbsenceDeclarations(complete, declared)).toEqual(["not-a-real-class", "sentence"]);
  });

  it("a debt declaration with no bead, and a structural one with a bead, are both malformed", () => {
    const declared: AbsenceDeclarations = new Map([
      [
        "planted-paper",
        new Map([
          ["sentence", { kind: "debt" as const, reason: "planted" }],
          [
            "inline-equation",
            { kind: "structural" as const, reason: "planted", bead: "am-planted-0000" },
          ],
          ["footnote", { kind: "debt" as const, reason: "   ", bead: "am-planted-0000" }],
        ]),
      ],
    ]);
    const problems = malformedDeclarations(declared);
    expect(problems.map((problem) => `${problem.class}:${problem.problem}`).sort()).toEqual([
      "footnote:reason is empty",
      "inline-equation:structural declaration names a bead, but no bead can close a structural absence",
      "sentence:debt declaration names no owning bead",
    ]);
  });

  it("the production declarations are the ones the corpus tests used", () => {
    // Guards against the plants silently becoming the only thing under test: the corpus tests above
    // call the predicates with no second argument, so they must be reading this map.
    expect(DECLARED_ABSENCES.size).toBeGreaterThan(0);
    for (const paper of DECLARED_ABSENCES.keys()) {
      expect(PAPERS as readonly string[]).toContain(paper);
    }
  });
});
