/**
 * The nine refusal sites in schema.ts that no test distinguished from their own deletion (am-kd9h).
 *
 * METHOD, because "untested" is a claim. Each of the file's 46 `throw new ManifestSchemaError(...)`
 * statements was rewritten to `void new ManifestSchemaError(...)` one at a time, and every test file
 * that imports this module was run against the result. Thirty-seven sites turned red. These nine did
 * not.
 *
 * WHY A GREP WAS NOT ENOUGH, measured on this exact file: only THREE of its 43 refusal codes are
 * absent from every test file in the repository, yet NINE sites survive deletion. So six sites have
 * their code written down in a test that never drives them.
 *
 * The sharpest case is `invalid-ids-frozen-at`, which has two sites. schema.refusals.test.ts headed
 * itself with a single line-585 citation that claimed BOTH that site and the one above it, and only
 * one was real: the Date.parse site dies when deleted, the non-empty-string site does not, because
 * no test ever passed an empty or whitespace idsFrozenAt. (Those two line numbers are written out
 * rather than in citation form on purpose. A quotation of a wrong citation is still a citation to
 * the scanner, and this one outlived the file it quoted: both numbers had drifted by 2026-09-21,
 * when the whole file's citations were re-derived by planting and the real sites turned out to be
 * 639 and 648.)
 *
 * A comment that claims a gap is covered is worth less than no comment, and the pair below is
 * separated by message rather than by code for exactly that reason - the code cannot tell them
 * apart.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ManifestSchemaError, validateSourceManifest } from "./schema.ts";

function base(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    paper: "light-quanta",
    document: "ap-17-132",
    status: "in-preparation",
    pageCount: 2,
    pageRange: [132, 133],
    idsFrozenAt: "2026-09-16T00:00:00Z",
    frozenBy: "editor-albert",
    units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }],
    ...overrides,
  };
}

/**
 * Drives one site and proves it was that site. The code alone is not enough where a code is shared,
 * so the path and a fragment of the site's own message are asserted too.
 */
function refuses(
  input: unknown,
  expected: { code: string; path: string; message: string },
): ManifestSchemaError {
  let caught: unknown;
  try {
    validateSourceManifest(input);
  } catch (err) {
    caught = err;
  }
  if (!(caught instanceof ManifestSchemaError)) {
    assert.fail(`Expected ManifestSchemaError, got ${String(caught)}`);
  }
  assert.equal(caught.code, expected.code);
  assert.equal(caught.rule, expected.code);
  assert.ok(
    caught.path.endsWith(expected.path),
    `path ${caught.path} should end with ${expected.path}`,
  );
  assert.ok(
    caught.message.includes(expected.message),
    `message ${JSON.stringify(caught.message)} should contain ${JSON.stringify(expected.message)}`,
  );
  return caught;
}

describe("the nine schema.ts refusal sites that survived deletion", () => {
  it("THE CONTROL: the base manifest validates, so every refusal below is about its own delta", () => {
    const ok = validateSourceManifest(base());
    assert.equal(ok.paper, "light-quanta");
    assert.equal(ok.document, "ap-17-132");
  });

  // (schema.ts:81) missing-paper. Its neighbour at :85 is missing-document and fires on the very
  // next field, so a test that only asserted "something threw" would not separate them.
  it("(schema.ts:81) a blank paper slug is refused as missing-paper, not as missing-document", () => {
    refuses(base({ paper: "   " }), {
      code: "missing-paper",
      path: ".paper",
      message: "paper slug is required.",
    });
    // and the document field is untouched, so the neighbour is provably not what fired
    refuses(base({ document: "   " }), {
      code: "missing-document",
      path: ".document",
      message: "document bibKey is required.",
    });
  });

  // (schema.ts:101) invalid-document-bib-key, inside the optional `documents` array. Distinct from
  // invalid-bib-key at :94, which validates the single `document` field's grammar.
  it("(schema.ts:101) a blank entry in documents[] names its own index", () => {
    const err = refuses(base({ documents: ["ap-17-132", "  "] }), {
      code: "invalid-document-bib-key",
      path: ".documents[1]",
      message: "Invalid document bibKey at index 1",
    });
    // The index is computed, not hard-coded: the same fault at position 0 says 0.
    assert.ok(err.message.includes("index 1"));
    refuses(base({ documents: [""] }), {
      code: "invalid-document-bib-key",
      path: ".documents[0]",
      message: "Invalid document bibKey at index 0",
    });
    // A well-formed documents array passes, so the site is judging the entries.
    assert.ok(validateSourceManifest(base({ documents: ["ap-17-132", "ap-17-549"] })));
  });

  // (schema.ts:137) invalid-page-range. Four disjuncts reach this one throw; the ordering one is
  // the interesting one and the one a shape-only test would miss.
  it("(schema.ts:137) a reversed page range is refused, and so is a malformed one", () => {
    // firstPage > lastPage: correctly shaped, correctly typed, and still wrong.
    refuses(base({ pageRange: [133, 132] }), {
      code: "invalid-page-range",
      path: ".pageRange",
      message: "firstPage <= lastPage",
    });
    refuses(base({ pageRange: [132] }), {
      code: "invalid-page-range",
      path: ".pageRange",
      message: "2-element tuple",
    });
    refuses(base({ pageRange: ["132", "133"] }), {
      code: "invalid-page-range",
      path: ".pageRange",
      message: "2-element tuple",
    });
    // This site runs BEFORE page-count-mismatch at :148, so a bad range never reaches the count
    // check. Asserting that ordering is what stops a later edit from reordering them silently.
    refuses(base({ pageRange: [133, 132], pageCount: 99 }), {
      code: "invalid-page-range",
      path: ".pageRange",
      message: "firstPage <= lastPage",
    });
  });

  // (schema.ts:157) missing-units
  it("(schema.ts:157) units must be an array, and an empty array is not the same fault", () => {
    refuses(base({ units: "s1-p1" }), {
      code: "missing-units",
      path: ".units",
      message: "units must be an array.",
    });
    refuses(base({ units: undefined }), {
      code: "missing-units",
      path: ".units",
      message: "units must be an array.",
    });
    // An empty array IS an array and passes this site. The refusal is about the type, not about
    // emptiness, and conflating the two is how a gate starts rejecting legal input.
    assert.ok(validateSourceManifest(base({ units: [] })));
  });

  // (schema.ts:168) invalid-unit
  it("(schema.ts:168) a non-object unit is refused before its fields are read", () => {
    refuses(base({ units: [null] }), {
      code: "invalid-unit",
      path: ".units[0]",
      message: "Unit must be an object.",
    });
    // The index is the unit's own, so the path locates the bad entry rather than the array.
    refuses(
      base({ units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 132 }] }, "s1-p2"] }),
      {
        code: "invalid-unit",
        path: ".units[1]",
        message: "Unit must be an object.",
      },
    );
  });

  // (schema.ts:297) invalid-sentence-id
  it("(schema.ts:297) a sentence unit whose id is not a sentence id is refused with the grammar", () => {
    const err = refuses(
      base({
        units: [
          {
            id: "paragraph-one",
            kind: "sentence",
            containedIn: "s1-p1",
            locators: [{ page: 132 }],
          },
        ],
      }),
      { code: "invalid-sentence-id", path: ".units[0].id", message: "" },
    );
    // The repair states the grammar rather than only that the id was wrong.
    assert.ok(err.repair?.includes("s<n>-p<m>-s<k>"), `repair was ${String(err.repair)}`);
    // The SAME id on a paragraph unit is fine: this site is scoped to kind === "sentence", which
    // is the discrimination that makes it more than a general id check.
    assert.ok(
      validateSourceManifest(
        base({ units: [{ id: "paragraph-one", kind: "paragraph", locators: [{ page: 132 }] }] }),
      ),
    );
  });

  // (schema.ts:344) invalid-locator, distinct from invalid-locator-page at :353 which checks the
  // page number of a locator that IS an object.
  it("(schema.ts:344) a non-object locator is refused before its page is read", () => {
    refuses(base({ units: [{ id: "s1-p1", kind: "paragraph", locators: [132] }] }), {
      code: "invalid-locator",
      path: ".units[0].locators[0]",
      message: "Locator must be an object",
    });
    // Its neighbour fires on an object with a bad page, so the two are separable by input AND by
    // path: this site points at the locator, that one points at the locator's page.
    refuses(base({ units: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: "132" }] }] }), {
      code: "invalid-locator-page",
      path: ".units[0].locators[0].page",
      message: "",
    });
  });

  // (schema.ts:555) missing-export-id
  it("(schema.ts:555) an export with neither id nor resultId is refused", () => {
    refuses(base({ exports: [{ statement: "N = 6.17e23", printedForm: "N" }] }), {
      code: "missing-export-id",
      path: ".exports[0].id",
      message: "Export requires id or resultId.",
    });
    // EITHER key satisfies it, and both are checked, because a test that only ever supplied `id`
    // would leave the resultId half of this condition unexercised.
    assert.ok(
      validateSourceManifest(
        base({ exports: [{ id: "avogadro", statement: "N = 6.17e23", printedForm: "N" }] }),
      ),
    );
    assert.ok(
      validateSourceManifest(
        base({ exports: [{ resultId: "avogadro", statement: "N = 6.17e23", printedForm: "N" }] }),
      ),
    );
  });

  // (schema.ts:639) invalid-ids-frozen-at, the NON-EMPTY-STRING site. Its sibling at :648 shares the
  // code and is already covered; the two are told apart here by message, since the code cannot.
  it("(schema.ts:639) a blank idsFrozenAt is refused, and says so differently from an unparseable one", () => {
    const blank = refuses(base({ idsFrozenAt: "   " }), {
      code: "invalid-ids-frozen-at",
      path: ".idsFrozenAt",
      message: "must be a non-empty ISO date timestamp string",
    });
    const unparseable = refuses(base({ idsFrozenAt: "the day before yesterday" }), {
      code: "invalid-ids-frozen-at",
      path: ".idsFrozenAt",
      message: "must be a valid ISO date timestamp. Got:",
    });
    // Same code, same path, different site. If these two messages ever converge, this pair stops
    // being able to tell which line threw, and the coverage claim becomes the one it replaced.
    assert.notEqual(blank.message, unparseable.message);
    // A non-string reaches the same site as the blank one.
    refuses(base({ idsFrozenAt: 20260916 }), {
      code: "invalid-ids-frozen-at",
      path: ".idsFrozenAt",
      message: "must be a non-empty ISO date timestamp string",
    });
  });
});
