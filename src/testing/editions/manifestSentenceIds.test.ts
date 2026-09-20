/**
 * The sentence carrier, no longer red.
 *
 * These tests were RED BY INSTRUCTION from 935069b6 until the owner ruled on am-xz2d
 * decision 1 on 2026-09-20. The ruling, verbatim: **"Add a sentence kind"**, described
 * as "the manifest format gains a sentence kind and the four inventories are extended to
 * carry s<n>-p<m>-s<k>", and recorded with the reason that "alignment and gloss are
 * DEFINED between sentence units, so any other answer would have required rewriting the
 * product promise rather than the schema."
 *
 * THE CARRIER CHANGED, AND THIS FILE CHANGED WITH IT. SAY SO PLAINLY. The red trio
 * pinned the other candidate shape - a `sentenceIds` list on the paragraph - because
 * that is how am-cm-source-manifest-6qa requirement 2 words it: "`paragraph`
 * (`s<n>-p<m>`, with its sentence ids listed)". The owner ruled for units instead. Two
 * of the three tests were therefore pinned to a shape nobody chose, and rewriting them
 * to match what I then built would be indistinguishable from regenerating a golden, so
 * the change is stated here rather than performed quietly. Corroboration that "kind" is
 * meant literally, and not my reading of an ambiguous word: the special-relativity
 * manifest already carries
 *
 *     unfrozenRequiredUnitKinds:
 *       - kind: sentence
 *         idGrammar: s<n>-p<m>-s<k>
 *         blockedBy: am-cm-source-manifest-6qa
 *         reason: MANIFEST_UNIT_KINDS has no sentence kind and locators are page-scoped.
 *
 * written by its inventory author under the header line "No sentence kind was invented
 * here", and blocks `inline-equation` beside it because "The mandated id grammar is
 * derived from a sentence id, which cannot be expressed" - which is only coherent if a
 * sentence has a unit id of its own.
 *
 * THE ORIGINAL FINDING SURVIVES THE CHANGE OF CARRIER, and is pinned below. The defect
 * was never "the field is missing"; it was that `validateSourceManifest` copies a fixed
 * key list, so an authored `sentenceIds` was SILENTLY DISCARDED - committed, then gone,
 * with no diagnostic anywhere. Under the ruling that field is the draft form, and a
 * draft form must be refused rather than dropped.
 *
 * A SECOND MEASURED DEFECT, found while implementing the ruling. The inventories name
 * their blocker as "MANIFEST_UNIT_KINDS has no sentence kind", but on 2026-09-20 that
 * constant had no consumer outside its own type alias and the barrel export: nothing
 * validated a unit's kind against it, so `kind: sentence` would have been accepted all
 * along and adding the entry alone would have changed no behaviour. The list is now a
 * gate. Across the four manifests 11 distinct kinds are in use and all 11 were already
 * in the list, so the gate refuses nothing that exists today.
 *
 * Bead: am-edn-alignment-tooling-do1. Ruling: am-xz2d decision 1. Format owner:
 * am-cm-source-manifest-6qa (closed; the ruling directs implementations to land in open
 * beads, which is why this lands here).
 */

import { describe, expect, test } from "bun:test";
import { ManifestSchemaError, validateSourceManifest } from "../../content/manifest/schema.ts";
import type { SourceManifest } from "../../content/manifest/types.ts";
import { validateManifest } from "../../content/manifest/validator.ts";

const RULING = "am-xz2d decision 1, owner ruling 2026-09-20: 'Add a sentence kind'";

const manifestWith = (units: readonly Record<string, unknown>[]): unknown => ({
  paper: "brownian-motion",
  document: "ap-17-549",
  scope: "full-document",
  status: "in-preparation",
  pageCount: 12,
  pageRange: [549, 560],
  units,
});

const paragraph = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: "paragraph",
  section: id.split("-")[0],
  locators: [{ page: 549 }],
  ...extra,
});

const sentence = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: "sentence",
  section: id.split("-")[0],
  locators: [{ page: 549 }],
  containedIn: id.replace(/-s\d+$/, ""),
  ...extra,
});

const diagnose = (manifest: SourceManifest) =>
  validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });

/** The code of the refusal a manifest produces, or null if it validates. */
const refusalCode = (raw: unknown, file: string): string | null => {
  try {
    validateSourceManifest(raw, file);
    return null;
  } catch (error) {
    if (error instanceof ManifestSchemaError) return error.code;
    throw error;
  }
};

describe(`the manifest carries sentences as units (${RULING})`, () => {
  test("a sentence unit keeps its id, kind and paragraph link instead of being discarded", () => {
    const manifest = validateSourceManifest(
      manifestWith([paragraph("s1-p1"), sentence("s1-p1-s1"), sentence("s1-p1-s2")]),
      "sentence-units.yaml",
    );

    const sentences = manifest.units.filter((u) => u.kind === "sentence");
    expect(sentences.map((u) => u.id)).toEqual(["s1-p1-s1", "s1-p1-s2"]);
    expect(sentences.map((u) => u.containedIn)).toEqual(["s1-p1", "s1-p1"]);
    // The accept half of the pair. The reject halves are the four refusals below; a
    // schema that refused everything would pass those and fail this one.
    expect(diagnose(manifest).filter((d) => d.unitId?.startsWith("s1-p1-s"))).toEqual([]);
  });

  test("a gap in a paragraph's sentences is refused, exactly as a paragraph gap already is", () => {
    const manifest = validateSourceManifest(
      manifestWith([paragraph("s1-p1"), sentence("s1-p1-s1"), sentence("s1-p1-s3")]),
      "sentence-gap.yaml",
    );

    const gaps = diagnose(manifest).filter((d) => d.rule === "sequence-gap");
    expect(gaps.map((d) => d.unitId)).toContain("s1-p1-s2");
    // The same manifest with s1-p1-s2 present must produce no gap at all, or the rule
    // above is reporting a constant rather than reading the units.
    const complete = validateSourceManifest(
      manifestWith([
        paragraph("s1-p1"),
        sentence("s1-p1-s1"),
        sentence("s1-p1-s2"),
        sentence("s1-p1-s3"),
      ]),
      "sentence-complete.yaml",
    );
    expect(diagnose(complete).filter((d) => d.rule === "sequence-gap")).toEqual([]);
  });

  test("sentence ids authored as a list on another unit are refused, not silently dropped", () => {
    // This is the original finding of 935069b6, carried across the change of carrier.
    // Before the ruling both of these validated cleanly and lost the field.
    expect(
      refusalCode(
        manifestWith([paragraph("s1-p1", { sentenceIds: ["s1-p1-s1", "s1-p1-s2"] })]),
        "paragraph-sentence-ids.yaml",
      ),
    ).toBe("draft-sentence-ids");

    expect(
      refusalCode(
        manifestWith([
          {
            id: "s1-fn1",
            kind: "footnote",
            section: "s1",
            locators: [{ page: 549 }],
            footnoteMark: "1)",
            sentenceIds: ["s1-fn1-s1"],
          },
        ]),
        "footnote-sentence-ids.yaml",
      ),
    ).toBe("draft-sentence-ids");
  });

  test("a footnote cannot be cut into sentences, because the id grammar has no such form", () => {
    // A footnote is a block-level unit without sentence ids. I expected this to be
    // caught by the `invalid-sentence-id` rule added for the ruling; it is caught
    // earlier and better by `draft-sentence-id-format`, which predates this work at
    // schema.ts:203, fires for any kind, and names the reason rather than the grammar.
    // The expectation is corrected to the older rule rather than the older rule moved
    // out of the way of mine.
    const footnoteSentence = manifestWith([
      {
        id: "s1-fn1-s1",
        kind: "sentence",
        section: "s1",
        locators: [{ page: 549 }],
        containedIn: "s1-fn1",
      },
    ]);
    expect(refusalCode(footnoteSentence, "footnote-sentence-unit.yaml")).toBe(
      "draft-sentence-id-format",
    );
    // Pin the reason, not just the code: a code can be reused, and what this must keep
    // saying is why a footnote has no sentences.
    let message = "";
    try {
      validateSourceManifest(footnoteSentence, "footnote-sentence-unit.yaml");
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("block-level units without sentence ids");

    // The same shape one level up is legal, so the rule is about footnotes and closings
    // rather than about the string "-s" appearing in an id.
    expect(
      refusalCode(
        manifestWith([paragraph("s1-p1"), sentence("s1-p1-s1")]),
        "paragraph-sentence-unit.yaml",
      ),
    ).toBeNull();
  });

  test("a sentence whose containedIn disagrees with its own id is refused", () => {
    expect(
      refusalCode(
        manifestWith([paragraph("s1-p1"), sentence("s1-p1-s1", { containedIn: "s1-p2" })]),
        "sentence-wrong-parent.yaml",
      ),
    ).toBe("sentence-containedin-mismatch");

    expect(
      refusalCode(
        manifestWith([paragraph("s1-p1"), { ...sentence("s1-p1-s1"), containedIn: undefined }]),
        "sentence-no-parent.yaml",
      ),
    ).toBe("sentence-missing-containedin");
  });

  test("an invented unit kind is refused, so the kind list is a gate rather than a note", () => {
    expect(
      refusalCode(
        manifestWith([{ id: "s1-x1", kind: "stanza", section: "s1", locators: [{ page: 549 }] }]),
        "invented-kind.yaml",
      ),
    ).toBe("unknown-unit-kind");
    // And the ruled kind passes that same gate, which is the half that would break if
    // "sentence" were removed from MANIFEST_UNIT_KINDS again.
    expect(
      refusalCode(manifestWith([paragraph("s1-p1"), sentence("s1-p1-s1")]), "ruled-kind.yaml"),
    ).toBeNull();
  });
});
