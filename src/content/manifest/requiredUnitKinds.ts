/**
 * WHETHER A MANIFEST REPRESENTS EVERY UNIT CLASS ITS INVENTORY BEAD REQUIRES.
 *
 * AGENTS.md: "The source manifest, not a hand-maintained percentage, determines completeness", and
 * non-negotiable outcome 1 asks that "every original paragraph, displayed equation, substantive
 * inline equation, footnote, qualification, date-line, acknowledgment, and reference has a place in
 * the edition".
 *
 * THE DEFECT THIS EXISTS TO CATCH, measured 2026-10-03. The four inventory beads each list the unit
 * kinds to inventory in a Requirements table. Across the four manifests, `inline-equation` units
 * numbered ZERO in all four papers, and `sentence` units existed only in brownian-motion (91):
 *
 *   light-quanta       128 units  sentence=0  inline-equation=0
 *   brownian-motion    178 units  sentence=91 inline-equation=0
 *   special-relativity 213 units  sentence=0  inline-equation=0
 *   mass-energy         25 units  sentence=0  inline-equation=0
 *
 * Two of those beads had been closed on the strength of their designated tests, which pass with
 * 3030 and 2385 expect() calls. Neither test could have failed, because both validate the units a
 * manifest CONTAINS: ids are grammar-valid, locators present, labels unique, pages reconcile. An
 * ABSENT population cannot fail a check that iterates it. This is the repository's "a tool's exit
 * code is not evidence until you know what it examined", in a shape its own examples do not cover:
 * not zero files examined, but zero members of one required class among thousands of assertions
 * about the others. Counting what is present is structurally unable to notice what is missing.
 *
 * SO THIS ASKS THE COMPLEMENTARY QUESTION, and it is the only one here that can go red on absence.
 * It is a property, not a census: "every required class is represented", which holds at any size and
 * does not break when a paper gains a sentence. Nothing here asserts 91, and nothing should: a count
 * is for reporting, and this file is for asserting.
 *
 * A DECLARATION, NOT AN EXEMPTION. A paper may honestly lack a class. Paper 4 has no numbered
 * sections at all, so demanding a section heading of it would be a false gate. Dropping the class
 * from the requirement list instead would let the NEXT silent absence through, which is the failure
 * this repository keeps finding. So an absent class passes only if it is DECLARED below with a
 * reason and, when it is debt rather than structure, the bead that owes it. An undeclared absence
 * fails. A declaration for a class that is now present is STALE and reported by
 * `staleAbsenceDeclarations`, so the entry is removed rather than left to rot.
 *
 * Reads a parsed manifest only, so it is pure and the tests can drive both branches with synthetic
 * input. The test beside it reads the four manifests from disk: a check on the inputs reads the
 * inputs, never a loader's output that may already have dropped a case.
 */
import type { SourceManifest } from "./types.ts";

/**
 * One row of an inventory bead's Requirements table, as a class of unit kinds.
 *
 * `kinds` holds alternatives because the papers spell one requirement two ways: brownian-motion
 * records its section headings as `heading` and the other papers as `section-heading`. Either
 * satisfies the row. Naming both here is a statement about the corpus as it is, not a licence to
 * invent a kind: every entry is already in MANIFEST_UNIT_KINDS.
 */
export type RequiredUnitClass = Readonly<{
  /** Stable name of the requirement, and the key a declaration uses. */
  id: string;
  /** Any ONE of these unit kinds satisfies the requirement. */
  kinds: readonly string[];
  /** The Requirements-table row this comes from, quoted closely enough to find it. */
  requirement: string;
}>;

/**
 * The classes every paper's inventory must represent.
 *
 * Deliberately NOT here: `closing-ack`, which only the relativity paper prints and whose row reads
 * "none expected" in the brownian bead, and `part-heading`, which only the relativity paper has.
 * A requirement that is conditional on the document is not a universal gate, and asserting one
 * would make this file fail on correct work.
 */
export const REQUIRED_UNIT_CLASSES: readonly RequiredUnitClass[] = Object.freeze([
  Object.freeze({
    id: "masthead-title",
    kinds: Object.freeze(["masthead-title"]),
    requirement: "Title and author line | `masthead-title`, `masthead-author` | As printed",
  }),
  Object.freeze({
    id: "masthead-author",
    kinds: Object.freeze(["masthead-author"]),
    requirement: "Title and author line | `masthead-title`, `masthead-author` | As printed",
  }),
  Object.freeze({
    id: "section-heading",
    kinds: Object.freeze(["heading", "section-heading"]),
    requirement: "Section headings | `s1` ... `s5` | The heading unit carries the section id",
  }),
  Object.freeze({
    id: "paragraph",
    kinds: Object.freeze(["paragraph"]),
    requirement: "Paragraphs | `s<n>-p<m>` | The unnumbered introduction is `s0`",
  }),
  Object.freeze({
    id: "sentence",
    kinds: Object.freeze(["sentence"]),
    requirement:
      "Sentences | `s<n>-p<m>-s<k>` | From page images, using the segmentation summary below",
  }),
  Object.freeze({
    id: "display-equation",
    kinds: Object.freeze(["display-equation", "equation"]),
    requirement: "Displayed equations | `eq-<printed>`; `eq-s<n>-<printed>`; `eq-s<n>-d<j>`",
  }),
  Object.freeze({
    id: "inline-equation",
    kinds: Object.freeze(["inline-equation"]),
    requirement:
      "Substantive inline equations and nontrivial symbol occurrences | `s<n>-p<m>-s<k>-m<i>`",
  }),
  Object.freeze({
    id: "footnote",
    kinds: Object.freeze(["footnote"]),
    requirement: "Footnotes | `s<n>-fn<k>` | Numbered within the section of the mark",
  }),
  Object.freeze({
    id: "closing-dateline",
    kinds: Object.freeze(["closing-dateline"]),
    requirement: "Date-line | `closing-dateline`",
  }),
  Object.freeze({
    id: "closing-received",
    kinds: Object.freeze(["closing-received"]),
    requirement: "Journal receipt line | `closing-received`",
  }),
]);

/**
 * Why a required class is absent from one paper.
 *
 * `structural` means the printed document has no such unit, so no work will ever add one.
 * `debt` means the document has them and the inventory has not recorded them yet; it names the bead
 * that owes the work, so the gate points at an owner instead of merely going quiet.
 */
export type AbsenceDeclaration = Readonly<{
  kind: "structural" | "debt";
  reason: string;
  /** Required for `debt`. Absent for `structural`, which no bead can close. */
  bead?: string;
}>;

export type AbsenceDeclarations = ReadonlyMap<string, ReadonlyMap<string, AbsenceDeclaration>>;

/**
 * The absences that are admitted today, by paper and then by class id.
 *
 * Every `debt` entry here is a real gap in outcome 1, recorded rather than hidden. The sentence and
 * inline-equation rows are the measurement in this file's header. They are declared so that this
 * gate can land green and still fail the moment a FIFTH absence appears, which is the strictest
 * useful setting: a gate that is red on arrival gets disabled, and one that forgives silently
 * teaches nothing.
 *
 * The data for the debt entries already exists and is reader-consumed, which is why these are debts
 * and not redesigns: every paragraph source block carries a `sentenceSpans` list with each
 * sentence's id, character span, blockRevision and textDigest, and the 821 translation units are
 * keyed by those same sentence ids.
 */
export const DECLARED_ABSENCES: AbsenceDeclarations = new Map([
  [
    "light-quanta",
    new Map<string, AbsenceDeclaration>([
      [
        // The `sentence` debt was PAID on 2026-10-03: the fifty paragraphs' 135 sentence ids are now
        // units of kind `sentence`, a set equal to the distinct sentenceIds of the paper's alignment
        // file. This entry went stale the moment they landed and was removed by the same change.
        "inline-equation",
        {
          kind: "debt",
          reason:
            "The paper prints inline mathematics the Requirements table asks for as units; none is inventoried.",
          bead: "am-edn-inventory-light-quanta-skp",
        },
      ],
    ]),
  ],
  // brownian-motion's `inline-equation` debt was PAID on 2026-10-09 and its entry removed by the
  // same change, as the `sentence` debts above were. 59 units now stand beside the sentences that
  // print them, a set equal to the regions the criterion in inlineEquationUnits.ts admits. The
  // reason text that sat here cited "220 inline math regions"; the real figure for this paper is
  // 134, because the 220 counted the bodies of display equations, which carry `equationId` and are
  // inventoried under `eq-*` ids. That miscount is recorded rather than quietly corrected, since it
  // is the same error the derivation's own first pass made across the corpus (914 against 714).
  [
    "special-relativity",
    new Map<string, AbsenceDeclaration>([
      // The `sentence` debt was PAID on 2026-10-03, completing owner ruling am-xz2d for the last of
      // the four inventories: 223 sentence units, a set equal to the distinct sentenceIds of this
      // paper's alignment file. The manifest's own `unfrozenRequiredUnitKinds` lost its sentence row
      // in the same change, along with the `blockedBy: am-cm-source-manifest-6qa` claim it had been
      // making for thirteen days after that bead closed.
      [
        "inline-equation",
        {
          kind: "debt",
          reason:
            "The last unit class this paper's `unfrozenRequiredUnitKinds` still names. Not blocked: `inline-equation` is in MANIFEST_UNIT_KINDS and its id grammar derives from a sentence id, which is now a unit here. What it needs is the editorial judgment of which inline regions are substantive, read against the plates.",
          bead: "am-edn-inventory-relativity-0u9",
        },
      ],
    ]),
  ],
  [
    "mass-energy",
    new Map<string, AbsenceDeclaration>([
      [
        "section-heading",
        {
          kind: "structural",
          reason:
            'AGENTS.md, naming conventions: "Paper 4 has no sections and uses `s0`". The printed paper has no numbered section headings, so no unit of this class can exist and no bead owes one.',
        },
      ],
      // The `sentence` debt was PAID on 2026-10-03, not forgiven: the twelve paragraphs' 28
      // sentence ids are now units of kind `sentence` in this paper's manifest, and this entry was
      // removed by the same change, which is what `staleAbsenceDeclarations` exists to force. It
      // reported "mass-energy: 'sentence'" the moment the units landed.
      [
        "inline-equation",
        {
          kind: "debt",
          reason:
            "The paper's three pages print inline mathematics; none is inventoried. Owed by the same closed bead that owed the sentence row.",
          bead: "am-edn-inventory-mass-energy-g2d",
        },
      ],
    ]),
  ],
]);

/** Classes of `manifest` that have at least one unit. */
export function representedClasses(manifest: SourceManifest): Set<string> {
  const kinds = new Set(manifest.units.map((unit) => unit.kind));
  const present = new Set<string>();
  for (const required of REQUIRED_UNIT_CLASSES) {
    if (required.kinds.some((kind) => kinds.has(kind))) present.add(required.id);
  }
  return present;
}

export type MissingUnitClass = Readonly<{
  paper: string;
  class: RequiredUnitClass;
  declaration?: AbsenceDeclaration | undefined;
}>;

/**
 * Required classes with no unit in `manifest` and no declaration: the ones that must fail.
 *
 * WHY THE DECLARATIONS ARE A PARAMETER. With the production map non-empty today, a predicate that
 * read the module constant directly could still be tested; but the map will shrink as the debts are
 * paid, and on the day it empties every test of the "declared absence is tolerated" branch would
 * pass vacuously and the machinery would stop being guarded exactly when nothing exercises it. That
 * is AGENTS.md's "a gate's own test must not live only in the lane that gate controls". Production
 * callers pass nothing and get the real map; tests pass a synthetic one and keep both branches
 * alive.
 */
export function undeclaredMissingClasses(
  manifest: SourceManifest,
  declarations: AbsenceDeclarations = DECLARED_ABSENCES,
): MissingUnitClass[] {
  const present = representedClasses(manifest);
  const declared = declarations.get(manifest.paper);
  return REQUIRED_UNIT_CLASSES.filter(
    (required) => !present.has(required.id) && !declared?.has(required.id),
  ).map((required) => ({ paper: manifest.paper, class: required }));
}

/** Every required class absent from `manifest`, declared or not, for reporting the debt. */
export function missingClasses(
  manifest: SourceManifest,
  declarations: AbsenceDeclarations = DECLARED_ABSENCES,
): MissingUnitClass[] {
  const present = representedClasses(manifest);
  const declared = declarations.get(manifest.paper);
  return REQUIRED_UNIT_CLASSES.filter((required) => !present.has(required.id)).map((required) => ({
    paper: manifest.paper,
    class: required,
    declaration: declared?.get(required.id),
  }));
}

/**
 * Declarations for classes that are now represented, or that name no required class at all: remove
 * them. A paid debt whose declaration stays behind is a gate that has quietly stopped asking.
 */
export function staleAbsenceDeclarations(
  manifest: SourceManifest,
  declarations: AbsenceDeclarations = DECLARED_ABSENCES,
): string[] {
  const present = representedClasses(manifest);
  const known = new Set(REQUIRED_UNIT_CLASSES.map((required) => required.id));
  const declared = declarations.get(manifest.paper);
  if (!declared) return [];
  return [...declared.keys()].filter((id) => present.has(id) || !known.has(id)).sort();
}

/**
 * A `debt` declaration without a bead, or a `structural` one carrying one: the declaration format
 * itself, checked, so an entry cannot be added that points at no owner.
 */
export function malformedDeclarations(declarations: AbsenceDeclarations = DECLARED_ABSENCES): {
  paper: string;
  class: string;
  problem: string;
}[] {
  const problems: { paper: string; class: string; problem: string }[] = [];
  for (const [paper, byClass] of declarations) {
    for (const [id, declaration] of byClass) {
      if (!declaration.reason.trim()) {
        problems.push({ paper, class: id, problem: "reason is empty" });
      }
      if (declaration.kind === "debt" && !declaration.bead) {
        problems.push({ paper, class: id, problem: "debt declaration names no owning bead" });
      }
      if (declaration.kind === "structural" && declaration.bead) {
        problems.push({
          paper,
          class: id,
          problem:
            "structural declaration names a bead, but no bead can close a structural absence",
        });
      }
    }
  }
  return problems;
}
