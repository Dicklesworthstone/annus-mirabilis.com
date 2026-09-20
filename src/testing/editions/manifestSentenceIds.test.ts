/**
 * RED BY INSTRUCTION. These three tests fail today and are meant to.
 *
 * They encode an unimplemented clause of a CLOSED bead, am-cm-source-manifest-6qa,
 * whose requirement 2 reads:
 *
 *   - `paragraph` (`s<n>-p<m>`, with its sentence ids listed);
 *   - `footnote` (`s<n>-fn<k>`, a block-level unit without sentence ids);
 *   ... the validator rejects "a paragraph sequence gap (`s2-p1`, `s2-p3` without `s2-p2`),
 *   and likewise for sentences within a paragraph";
 *   ... and rejects a draft form including "footnote or acknowledgment sentence ids".
 *
 * WHAT IS ACTUALLY IN THE TREE, measured on 2026-09-19 rather than argued:
 *   - `ManifestUnit` (src/content/manifest/types.ts) has no sentence carrier: no
 *     `sentence` kind in MANIFEST_UNIT_KINDS and no `sentenceIds` field.
 *   - `validateSourceManifest` does not refuse a unit that carries `sentenceIds`. It
 *     copies a fixed list of keys, so the field is SILENTLY DROPPED. An editor can
 *     author sentence ids, the manifest can be committed, and the ids are gone with
 *     no diagnostic anywhere.
 *   - `validateManifest` therefore emits no sentence-gap diagnostic, because it never
 *     sees a sentence id to find a gap in. Its only gap rules are paragraph and
 *     footnote.
 *
 * WHY THESE ARE LEFT RED INSTEAD OF FIXED. The repair is one optional field on
 * ManifestUnit plus the rules that read it, and that is a change to a format owned by
 * am-cm-source-manifest-6qa. Adding it here would be an agent editing a closed bead's
 * format on its own authority. The decision sits on am-xz2d (decision 1) with the
 * owner, and every downstream bead - the sentence-level half of the edition pipeline's
 * reconcile stage, the mini-paper fixture corpus, the gloss units that address a
 * sentence, the many-to-many alignment that is DEFINED between sentence units - is
 * waiting on it.
 *
 * WHAT MAKES EACH ONE GO GREEN is stated in its own name. Nothing here is skipped,
 * marked todo, or loosened: a skipped test reports nothing, and a green suite over
 * this gap is how the gap stayed invisible long enough for four papers to be
 * inventoried without it.
 *
 * Bead: am-edn-alignment-tooling-do1 (the blocked consumer). Owner of the repair:
 * am-cm-source-manifest-6qa via am-xz2d.
 */

import { describe, expect, test } from "bun:test";
import { validateSourceManifest } from "../../content/manifest/schema.ts";
import type { SourceManifest } from "../../content/manifest/types.ts";
import { validateManifest } from "../../content/manifest/validator.ts";

const BEAD = "am-cm-source-manifest-6qa requirement 2, escalated on am-xz2d decision 1";

const manifestWith = (units: readonly Record<string, unknown>[]): unknown => ({
  paper: "brownian-motion",
  document: "ap-17-549",
  scope: "full-document",
  status: "in-preparation",
  pageCount: 12,
  pageRange: [549, 560],
  units,
});

const diagnose = (manifest: SourceManifest) =>
  validateManifest(manifest, { manifests: new Map([[manifest.paper, manifest]]) });

describe(`RED BY INSTRUCTION: the manifest has no carrier for sentence ids (${BEAD})`, () => {
  test("goes green when ManifestUnit keeps a paragraph's authored sentenceIds instead of dropping them", () => {
    const manifest = validateSourceManifest(
      manifestWith([
        {
          id: "s1-p1",
          kind: "paragraph",
          section: "s1",
          locators: [{ page: 549 }],
          sentenceIds: ["s1-p1-s1", "s1-p1-s2"],
        },
      ]),
      "sentence-id-carrier.yaml",
    );
    const unit = manifest.units[0] as unknown as Record<string, unknown>;
    // Today: undefined. The schema accepts the manifest and discards the field, so the
    // ids an editor authored leave no trace and no diagnostic.
    expect(unit.sentenceIds).toEqual(["s1-p1-s1", "s1-p1-s2"]);
  });

  test("goes green when a gap in a paragraph's sentence ids is refused, as a paragraph gap already is", () => {
    const manifest = validateSourceManifest(
      manifestWith([
        {
          id: "s1-p1",
          kind: "paragraph",
          section: "s1",
          locators: [{ page: 549 }],
          sentenceIds: ["s1-p1-s1", "s1-p1-s3"],
        },
      ]),
      "sentence-gap.yaml",
    );
    const gaps = diagnose(manifest).filter((d) => d.rule === "sequence-gap");
    // The same shape one paragraph down: s1-p1 and s1-p3 without s1-p2 is refused today,
    // s1-p1-s1 and s1-p1-s3 without s1-p1-s2 is not, because the ids never arrive.
    expect(gaps.map((d) => d.unitId)).toContain("s1-p1-s2");
  });

  test("goes green when sentence ids on a footnote unit are refused as the draft form they are", () => {
    const raw = manifestWith([
      {
        id: "s1-fn1",
        kind: "footnote",
        section: "s1",
        locators: [{ page: 549 }],
        footnoteMark: "1)",
        sentenceIds: ["s1-fn1-s1"],
      },
    ]);
    // A footnote is a block-level unit without sentence ids. Today this manifest
    // validates cleanly: the field is dropped and nothing objects. Refusal may come
    // from the schema or from the validator; this asserts that it comes from one of
    // them rather than dictating which, so an implementation that reports it as a
    // diagnostic satisfies the requirement too.
    let refused = false;
    try {
      const manifest = validateSourceManifest(raw, "footnote-sentence-ids.yaml");
      refused = diagnose(manifest).some(
        (d) => d.severity === "error" && (d.unitId === "s1-fn1" || d.message.includes("s1-fn1")),
      );
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
  });
});
