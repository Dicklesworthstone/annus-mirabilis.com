/**
 * `kind: "equation"` NAMES TWO DIFFERENT RECORD FAMILIES, AND THE INDEX MUST NOT CONFLATE THEM
 * (am-rc1001-bridge-plan-pcjk.10).
 *
 * A record under `content/equations/<paper>/` is an `EquationRecord` and carries a required
 * `notes` array. A source block under `content/source-blocks/<paper>/eq-*.yaml` is a
 * `SourceBlock`, has no `notes`, and its own `kind` is ALSO "equation". `buildContentIndexes`
 * admitted both to `indexes.equations` on the strength of that string, behind an unchecked
 * `record as EquationRecord`.
 *
 * It had never fired, for one reason only: `loadReadingFiles` skips every `.yaml`, so no source
 * block has ever reached the compiler. Measured on 2026-10-10 by feeding the 453 blocks in a
 * scratch probe, it dies on the first paper:
 *
 *   TypeError: undefined is not an object (evaluating 'note of eq.notes')
 *     at compileContent (src/content/compiler/compiler.ts:465:20)
 *
 * The discriminator was already present and unused: the record KEY. `recordKey.ts` keys paper,
 * argument, foundation, citation and equation by BARE ID because they are addressed by id across
 * papers, and everything else as `<routeKind>:<paper>:<id>`. So a namespaced key is never one of
 * the five, and `parseRecordKey` returning null is the whole test. That file's own docblock
 * records the same mistake costing the editorial-note checks all 8 of their records: they tested
 * `rec.kind === "editorial-note"` where `kind` is the NOTE's kind, and matched nothing.
 *
 * Both directions are asserted, because a guard that admitted nothing would make every index
 * empty and no caller would notice until a page was blank.
 */
import { describe, expect, test } from "bun:test";
import { buildContentIndexes } from "./indexes.ts";

/** A real `EquationRecord` shape, trimmed to what the index reads. */
const equationRecord = {
  kind: "equation",
  id: "eq-s3-d4",
  paper: "brownian-motion",
  notes: [{ foundation: "fnd-diffusion" }],
};

/** A real source block of kind "equation", trimmed. It has no `notes`, and should not. */
const sourceBlockEquation = {
  kind: "equation",
  id: "eq-s3-d4",
  paper: "brownian-motion",
  diplomaticText: "D = RT/N · 1/(6πkP)",
};

describe("buildContentIndexes keys the five bare-id families by key, not by kind", () => {
  test("a bare-keyed equation record is indexed", () => {
    const result = buildContentIndexes(new Map([["eq-s3-d4", equationRecord]]));
    expect(result.indexes.equations.size).toBe(1);
    expect(result.indexes.equations.get("eq-s3-d4")?.notes?.length).toBe(1);
  });

  test("a NAMESPACED record of the same kind is not, which is the defect", () => {
    const result = buildContentIndexes(
      new Map([["source-block:brownian-motion:eq-s3-d4", sourceBlockEquation]]),
    );
    expect(result.indexes.equations.size).toBe(0);
    // It is still reachable by every other route the index offers, so nothing is lost: the guard
    // decides which TYPED map a record joins, never whether it exists.
    expect(result.indexes.byKind.get("equation")?.length).toBe(1);
    expect(result.indexes.byPaper.get("brownian-motion")?.length).toBe(1);
    expect(result.indexes.byId.get("source-block:brownian-motion:eq-s3-d4")).toBe(
      sourceBlockEquation,
    );
  });

  test("both at once: the equation record survives beside 453 source blocks", () => {
    // The shape the widening actually produces. Without the guard the map holds two entries and
    // whichever landed last decides whether compiler.ts:465 crashes.
    const records = new Map<string, unknown>([
      ["eq-s3-d4", equationRecord],
      ["source-block:brownian-motion:eq-s3-d4", sourceBlockEquation],
    ]);
    const result = buildContentIndexes(records);
    expect(result.indexes.equations.size).toBe(1);
    expect(result.indexes.equations.get("eq-s3-d4")).toBe(equationRecord as never);
    expect(result.indexes.equations.get("eq-s3-d4")?.notes).toBeDefined();
  });

  test("the other four families are guarded the same way, so the rule is not equation-only", () => {
    const bare = new Map<string, unknown>([
      ["ap-17-549", { kind: "citation", id: "ap-17-549" }],
      [
        "fnd-diffusion",
        {
          kind: "foundation",
          id: "fnd-diffusion",
          prerequisites: [],
          explanation: [],
          example: [],
        },
      ],
    ]);
    const bareResult = buildContentIndexes(bare);
    expect(bareResult.indexes.citations.size).toBe(1);
    expect(bareResult.indexes.foundations.size).toBe(1);

    const namespaced = new Map<string, unknown>([
      ["editorial-note:brownian-motion:n1", { kind: "citation", id: "n1" }],
      [
        "source-block:brownian-motion:s1-p1",
        { kind: "foundation", id: "s1-p1", prerequisites: [], explanation: [], example: [] },
      ],
    ]);
    const namespacedResult = buildContentIndexes(namespaced);
    expect(namespacedResult.indexes.citations.size).toBe(0);
    expect(namespacedResult.indexes.foundations.size).toBe(0);
  });
});
