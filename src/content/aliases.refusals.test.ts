/**
 * Comprehensive accept/reject tests for all refusal sites in aliases.ts (am-muyh).
 *
 * Governed by bead am-muyh, doctrine 8 (typed refusal states), and docs/CONTENT_IDS.md:
 * - Alias record schema validation, kind grammar, replacement cardinality, and ISO date checks.
 * - Alias resolution cycle detection, dangling leaf rejection, and invalid record propagation.
 * - Accept/reject pair per refusal site.
 * - Every test carries explicit line citation (aliases.ts:<line>) and literal code / rule string.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import { type AliasRecord, resolveAlias, validateAliasRecord } from "./aliases.ts";

const VALID_RECORD: AliasRecord = {
  retiredId: "s1-p1",
  kind: "retired",
  replacementIds: ["s1-p2"],
  reason: "Retired in favor of p2",
  date: "1905-05-11",
  editor: "ed-einstein",
};

describe("Content alias refusal throw/return sites (am-muyh)", () => {
  // ==========================================================================
  // Site 1: (aliases.ts:54) alias-schema - Non-object raw input
  // ==========================================================================
  test("site (aliases.ts:54) alias-schema: rejects non-object or null raw record, accepts valid object", () => {
    // Accept case: valid record object
    const accepted = validateAliasRecord(VALID_RECORD);
    assert.equal(accepted.ok, true);

    // Reject cases: null, primitives
    const nullRes = validateAliasRecord(null);
    assert.equal(nullRes.ok, false);
    if (!nullRes.ok) {
      assert.equal(nullRes.rule, "alias-schema");
      assert.ok(nullRes.error.includes("must be an object"));
    }

    const undefinedRes = validateAliasRecord(undefined);
    assert.equal(undefinedRes.ok, false);
    if (!undefinedRes.ok) {
      assert.equal(undefinedRes.rule, "alias-schema");
    }

    const stringRes = validateAliasRecord("invalid-raw-string");
    assert.equal(stringRes.ok, false);
    if (!stringRes.ok) {
      assert.equal(stringRes.rule, "alias-schema");
    }

    const numRes = validateAliasRecord(42);
    assert.equal(numRes.ok, false);
    if (!numRes.ok) {
      assert.equal(numRes.rule, "alias-schema");
    }
  });

  // ==========================================================================
  // Site 2: (aliases.ts:62) alias-schema - retiredId validation
  // ==========================================================================
  test("site (aliases.ts:62) alias-schema: rejects empty or non-string retiredId, accepts non-empty string", () => {
    // Accept case: non-empty trimmed retiredId
    const accepted = validateAliasRecord({ ...VALID_RECORD, retiredId: "s2-p3-s1" });
    assert.equal(accepted.ok, true);

    // Reject cases: empty string, whitespace only, non-string
    const emptyRes = validateAliasRecord({ ...VALID_RECORD, retiredId: "" });
    assert.equal(emptyRes.ok, false);
    if (!emptyRes.ok) {
      assert.equal(emptyRes.rule, "alias-schema");
      assert.ok(emptyRes.error.includes("retiredId"));
    }

    const whitespaceRes = validateAliasRecord({ ...VALID_RECORD, retiredId: "   " });
    assert.equal(whitespaceRes.ok, false);
    if (!whitespaceRes.ok) {
      assert.equal(whitespaceRes.rule, "alias-schema");
    }

    const nonStringRes = validateAliasRecord({
      ...VALID_RECORD,
      retiredId: 101 as unknown as string,
    });
    assert.equal(nonStringRes.ok, false);
    if (!nonStringRes.ok) {
      assert.equal(nonStringRes.rule, "alias-schema");
    }
  });

  // ==========================================================================
  // Site 3: (aliases.ts:71) alias-kind-grammar - Invalid alias kind
  // ==========================================================================
  test("site (aliases.ts:71) alias-kind-grammar: rejects kind not in (retired, split, merged), accepts valid kinds", () => {
    // Accept cases: retired, merged, split
    assert.equal(validateAliasRecord({ ...VALID_RECORD, kind: "retired" }).ok, true);
    assert.equal(validateAliasRecord({ ...VALID_RECORD, kind: "merged" }).ok, true);
    assert.equal(
      validateAliasRecord({
        ...VALID_RECORD,
        kind: "split",
        replacementIds: ["s1-p1a", "s1-p1b"],
      }).ok,
      true,
    );

    // Reject cases: unknown kind string, empty string, non-string
    const unknownRes = validateAliasRecord({
      ...VALID_RECORD,
      kind: "deprecated" as unknown as "retired",
    });
    assert.equal(unknownRes.ok, false);
    if (!unknownRes.ok) {
      assert.equal(unknownRes.rule, "alias-kind-grammar");
      assert.ok(unknownRes.error.includes("Invalid alias kind"));
    }

    const emptyKind = validateAliasRecord({ ...VALID_RECORD, kind: "" as unknown as "retired" });
    assert.equal(emptyKind.ok, false);
    if (!emptyKind.ok) {
      assert.equal(emptyKind.rule, "alias-kind-grammar");
    }
  });

  // ==========================================================================
  // Site 4: (aliases.ts:79) alias-schema - replacementIds is not an array
  // ==========================================================================
  test("site (aliases.ts:79) alias-schema: rejects non-array replacementIds, accepts valid array", () => {
    // Accept case: array of string IDs
    const accepted = validateAliasRecord({ ...VALID_RECORD, replacementIds: ["s1-p2"] });
    assert.equal(accepted.ok, true);

    // Reject cases: string primitive, null, object
    const strRes = validateAliasRecord({
      ...VALID_RECORD,
      replacementIds: "s1-p2" as unknown as string[],
    });
    assert.equal(strRes.ok, false);
    if (!strRes.ok) {
      assert.equal(strRes.rule, "alias-schema");
      assert.ok(strRes.error.includes("must be an array"));
    }

    const nullRes = validateAliasRecord({
      ...VALID_RECORD,
      replacementIds: null as unknown as string[],
    });
    assert.equal(nullRes.ok, false);
    if (!nullRes.ok) {
      assert.equal(nullRes.rule, "alias-schema");
    }
  });

  // ==========================================================================
  // Site 5: (aliases.ts:88) alias-schema - Non-empty string items in replacementIds
  // ==========================================================================
  test("site (aliases.ts:88) alias-schema: rejects empty or non-string replacementIds items, accepts valid string items", () => {
    // Accept case: trimmed string items
    const accepted = validateAliasRecord({ ...VALID_RECORD, replacementIds: ["  s1-p2  "] });
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.equal(accepted.value.replacementIds[0], "s1-p2");
    }

    // Reject cases: empty string item, whitespace item, non-string item
    const emptyItemRes = validateAliasRecord({ ...VALID_RECORD, replacementIds: [""] });
    assert.equal(emptyItemRes.ok, false);
    if (!emptyItemRes.ok) {
      assert.equal(emptyItemRes.rule, "alias-schema");
      assert.ok(emptyItemRes.error.includes("must be non-empty strings"));
    }

    const whitespaceItemRes = validateAliasRecord({ ...VALID_RECORD, replacementIds: ["   "] });
    assert.equal(whitespaceItemRes.ok, false);
    if (!whitespaceItemRes.ok) {
      assert.equal(whitespaceItemRes.rule, "alias-schema");
    }

    const nonStringItemRes = validateAliasRecord({
      ...VALID_RECORD,
      replacementIds: [42 as unknown as string],
    });
    assert.equal(nonStringItemRes.ok, false);
    if (!nonStringItemRes.ok) {
      assert.equal(nonStringItemRes.rule, "alias-schema");
    }
  });

  // ==========================================================================
  // Site 6: (aliases.ts:98) alias-replacement-count - Retired must have 1 replacement
  // ==========================================================================
  test("site (aliases.ts:98) alias-replacement-count: rejects retired alias with replacement count !== 1, accepts exactly 1", () => {
    // Accept case: exactly 1 replacement
    const accepted = validateAliasRecord({
      ...VALID_RECORD,
      kind: "retired",
      replacementIds: ["s1-p2"],
    });
    assert.equal(accepted.ok, true);

    // Reject cases: 0 replacements, 2 replacements
    const zeroRes = validateAliasRecord({ ...VALID_RECORD, kind: "retired", replacementIds: [] });
    assert.equal(zeroRes.ok, false);
    if (!zeroRes.ok) {
      assert.equal(zeroRes.rule, "alias-replacement-count");
      assert.ok(zeroRes.error.includes("must specify exactly one"));
    }

    const twoRes = validateAliasRecord({
      ...VALID_RECORD,
      kind: "retired",
      replacementIds: ["s1-p2", "s1-p3"],
    });
    assert.equal(twoRes.ok, false);
    if (!twoRes.ok) {
      assert.equal(twoRes.rule, "alias-replacement-count");
    }
  });

  // ==========================================================================
  // Site 7: (aliases.ts:106) alias-replacement-count - Merged must have 1 replacement
  // ==========================================================================
  test("site (aliases.ts:106) alias-replacement-count: rejects merged alias with replacement count !== 1, accepts exactly 1", () => {
    // Accept case: exactly 1 replacement
    const accepted = validateAliasRecord({
      ...VALID_RECORD,
      kind: "merged",
      replacementIds: ["s1-p_merged"],
    });
    assert.equal(accepted.ok, true);

    // Reject cases: 0 replacements, 2 replacements
    const zeroRes = validateAliasRecord({ ...VALID_RECORD, kind: "merged", replacementIds: [] });
    assert.equal(zeroRes.ok, false);
    if (!zeroRes.ok) {
      assert.equal(zeroRes.rule, "alias-replacement-count");
      assert.ok(zeroRes.error.includes("must specify exactly one"));
    }

    const twoRes = validateAliasRecord({
      ...VALID_RECORD,
      kind: "merged",
      replacementIds: ["s1-p2", "s1-p3"],
    });
    assert.equal(twoRes.ok, false);
    if (!twoRes.ok) {
      assert.equal(twoRes.rule, "alias-replacement-count");
    }
  });

  // ==========================================================================
  // Site 8: (aliases.ts:114) alias-replacement-count - Split must have >= 2 replacements
  // ==========================================================================
  test("site (aliases.ts:114) alias-replacement-count: rejects split alias with replacement count < 2, accepts >= 2", () => {
    // Accept case: 2 or more replacements
    const accepted2 = validateAliasRecord({
      ...VALID_RECORD,
      kind: "split",
      replacementIds: ["s1-p1a", "s1-p1b"],
    });
    assert.equal(accepted2.ok, true);

    const accepted3 = validateAliasRecord({
      ...VALID_RECORD,
      kind: "split",
      replacementIds: ["s1-p1a", "s1-p1b", "s1-p1c"],
    });
    assert.equal(accepted3.ok, true);

    // Reject cases: 0 replacements, 1 replacement
    const zeroRes = validateAliasRecord({ ...VALID_RECORD, kind: "split", replacementIds: [] });
    assert.equal(zeroRes.ok, false);
    if (!zeroRes.ok) {
      assert.equal(zeroRes.rule, "alias-replacement-count");
      assert.ok(zeroRes.error.includes("must specify at least two"));
    }

    const oneRes = validateAliasRecord({
      ...VALID_RECORD,
      kind: "split",
      replacementIds: ["s1-p1a"],
    });
    assert.equal(oneRes.ok, false);
    if (!oneRes.ok) {
      assert.equal(oneRes.rule, "alias-replacement-count");
    }
  });

  // ==========================================================================
  // Site 9: (aliases.ts:122) alias-date-format - Date must be ISO YYYY-MM-DD
  // ==========================================================================
  test("site (aliases.ts:122) alias-date-format: rejects non-ISO calendar date format, accepts YYYY-MM-DD", () => {
    // Accept case: ISO calendar date string
    const accepted = validateAliasRecord({ ...VALID_RECORD, date: "1905-09-26" });
    assert.equal(accepted.ok, true);

    // Reject cases: slash format, MM-DD-YYYY, timestamp, Date object
    const slashRes = validateAliasRecord({ ...VALID_RECORD, date: "1905/09/26" });
    assert.equal(slashRes.ok, false);
    if (!slashRes.ok) {
      assert.equal(slashRes.rule, "alias-date-format");
      assert.ok(slashRes.error.includes("YYYY-MM-DD format"));
    }

    const usRes = validateAliasRecord({ ...VALID_RECORD, date: "09-26-1905" });
    assert.equal(usRes.ok, false);
    if (!usRes.ok) {
      assert.equal(usRes.rule, "alias-date-format");
    }

    const dateObjRes = validateAliasRecord({
      ...VALID_RECORD,
      date: new Date("1905-09-26") as unknown as string,
    });
    assert.equal(dateObjRes.ok, false);
    if (!dateObjRes.ok) {
      assert.equal(dateObjRes.rule, "alias-date-format");
    }
  });

  // ==========================================================================
  // Site 10: (aliases.ts:130) alias-schema - reason validation
  // ==========================================================================
  test("site (aliases.ts:130) alias-schema: rejects empty or non-string reason, accepts non-empty string", () => {
    // Accept case: valid reason
    const accepted = validateAliasRecord({ ...VALID_RECORD, reason: "Editorial correction" });
    assert.equal(accepted.ok, true);

    // Reject cases: empty string, whitespace, non-string
    const emptyRes = validateAliasRecord({ ...VALID_RECORD, reason: "" });
    assert.equal(emptyRes.ok, false);
    if (!emptyRes.ok) {
      assert.equal(emptyRes.rule, "alias-schema");
      assert.ok(emptyRes.error.includes("reason"));
    }

    const whitespaceRes = validateAliasRecord({ ...VALID_RECORD, reason: "    " });
    assert.equal(whitespaceRes.ok, false);
    if (!whitespaceRes.ok) {
      assert.equal(whitespaceRes.rule, "alias-schema");
    }

    const nonStrRes = validateAliasRecord({ ...VALID_RECORD, reason: 999 as unknown as string });
    assert.equal(nonStrRes.ok, false);
    if (!nonStrRes.ok) {
      assert.equal(nonStrRes.rule, "alias-schema");
    }
  });

  // ==========================================================================
  // Site 11: (aliases.ts:138) alias-schema - editor validation
  // ==========================================================================
  test("site (aliases.ts:138) alias-schema: rejects empty or non-string editor, accepts non-empty string", () => {
    // Accept case: valid editor
    const accepted = validateAliasRecord({ ...VALID_RECORD, editor: "ed-planck" });
    assert.equal(accepted.ok, true);

    // Reject cases: empty string, whitespace, non-string
    const emptyRes = validateAliasRecord({ ...VALID_RECORD, editor: "" });
    assert.equal(emptyRes.ok, false);
    if (!emptyRes.ok) {
      assert.equal(emptyRes.rule, "alias-schema");
      assert.ok(emptyRes.error.includes("editor"));
    }

    const whitespaceRes = validateAliasRecord({ ...VALID_RECORD, editor: "  \t  " });
    assert.equal(whitespaceRes.ok, false);
    if (!whitespaceRes.ok) {
      assert.equal(whitespaceRes.rule, "alias-schema");
    }

    const nonStrRes = validateAliasRecord({ ...VALID_RECORD, editor: 12345 as unknown as string });
    assert.equal(nonStrRes.ok, false);
    if (!nonStrRes.ok) {
      assert.equal(nonStrRes.rule, "alias-schema");
    }
  });

  // ==========================================================================
  // Resolution Sites: (aliases.ts:171, 188, 199)
  // ==========================================================================
  test("site (aliases.ts:171) invalid: rejects invalid alias record during resolution, accepts valid records", () => {
    const validAliases: AliasRecord[] = [VALID_RECORD];
    const accepted = resolveAlias("s1-p1", validAliases);
    assert.equal(accepted.ok, true);

    const invalidAliases = [{ ...VALID_RECORD, kind: "invalid-kind" as unknown as "retired" }];
    const res = resolveAlias("s1-p1", invalidAliases);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, "invalid");
      assert.ok(res.error.includes("Invalid alias record"));
    }
  });

  test("site (aliases.ts:188) cycle: rejects cyclic alias reference chains, accepts acyclic chains", () => {
    const acyclic: AliasRecord[] = [
      {
        retiredId: "a",
        kind: "retired",
        replacementIds: ["b"],
        reason: "a -> b",
        date: "1905-05-11",
        editor: "ed-test",
      },
      {
        retiredId: "b",
        kind: "retired",
        replacementIds: ["c"],
        reason: "b -> c",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];
    const accepted = resolveAlias("a", acyclic);
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.deepEqual(accepted.targetIds, ["c"]);
    }

    const cyclic: AliasRecord[] = [
      {
        retiredId: "a",
        kind: "retired",
        replacementIds: ["b"],
        reason: "a -> b",
        date: "1905-05-11",
        editor: "ed-test",
      },
      {
        retiredId: "b",
        kind: "retired",
        replacementIds: ["a"],
        reason: "b -> a",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];
    const res = resolveAlias("a", cyclic);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, "cycle");
      assert.ok(res.error.includes("Alias cycle detected"));
    }
  });

  test("site (aliases.ts:199) dangling: rejects alias target missing from valid corpus IDs, accepts existing target", () => {
    const aliases: AliasRecord[] = [
      {
        retiredId: "a",
        kind: "retired",
        replacementIds: ["b"],
        reason: "a -> b",
        date: "1905-05-11",
        editor: "ed-test",
      },
    ];
    // Target "b" exists in corpus
    const accepted = resolveAlias("a", aliases, ["b"]);
    assert.equal(accepted.ok, true);

    // Target "b" missing from corpus
    const res = resolveAlias("a", aliases, ["c", "d"]);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, "dangling");
      assert.ok(res.error.includes("missing from the corpus"));
    }
  });
});

/**
 * am-r3qt. Every citation in this file was off by exactly 25 lines.
 *
 * All fourteen pointed at nothing, so all fourteen credited nothing, and thirteen sites
 * this file genuinely drives were reported untested. Each repointing was established by
 * planting one site and observing exactly one test redden; the uniform offset is what the
 * answer turned out to be, never how it was obtained.
 */

test("the fifteenth 'site' in aliases.ts is a TYPE, not a refusal, and no test can drive it", () => {
  // aliases.ts:157 is counted as a refusal throw site and is not one. It is the code
  // union on the failure branch of AliasResolutionResult:
  //
  //     | { readonly ok: false; readonly error: string; readonly code: "cycle" | ... }
  //
  // The scanner reads `code: "cycle"` in a string-literal position and records a site.
  // Renaming it changes no runtime behaviour at all - it is erased before anything runs -
  // so no test reddens and none ever could. This is a fourth category beside driven,
  // undriven and unreachable: NOT CODE. Six such sites exist across the owed set
  // (runtimeMapping.ts x3, reconciliation.ts, provenance.ts and this one), so the total
  // is that much higher than the work actually available.
  //
  // Recorded rather than papered over with a test that would assert nothing. The claim is
  // asserted so it stops being true loudly: the line must still be part of a type
  // declaration, and the codes it names must still be the ones the resolver returns.
  const source = readFileSync(join(process.cwd(), "src", "content", "aliases.ts"), "utf8");
  const lines = source.split("\n");
  const unionLine = lines.findIndex((line) => line.includes('readonly code: "cycle"'));
  assert.ok(unionLine > -1, "the union member this records must still exist");
  // A type member, not a statement: no `return`, no `throw`, and it sits under a `type`.
  const line = lines[unionLine] ?? "";
  assert.ok(!line.includes("return"), line);
  assert.ok(!line.includes("throw"), line);
  assert.match(
    lines.slice(Math.max(0, unionLine - 3), unionLine).join(" "),
    /export type AliasResolutionResult/,
  );
  // And the three codes it declares are each produced somewhere that IS a statement, so
  // the union is a description of real refusals rather than a dead enumeration.
  // Matched without a trailing comma: `invalid` is produced inline as
  // `{ ..., code: "invalid" };` while the other two sit in multi-line objects, and
  // requiring the comma made this arm fail on a code that IS produced.
  for (const code of ["cycle", "dangling", "invalid"]) {
    assert.ok(
      new RegExp(`code: "${code}"\\s*[,}]`).test(source),
      `${code} is declared in the union but never produced by a statement`,
    );
  }
});
