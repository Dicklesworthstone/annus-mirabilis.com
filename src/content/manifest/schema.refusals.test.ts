/**
 * Refusal throw site coverage for src/content/manifest/schema.ts (am-muyh).
 *
 * Provides dedicated accept/reject test pairs for all 20 refusal throw sites in schema.ts:
 * 1.  (schema.ts:48)  invalid-manifest-object
 * 2.  (schema.ts:85)  missing-document
 * 3.  (schema.ts:94)  invalid-bib-key
 * 4.  (schema.ts:114) invalid-status
 * 5.  (schema.ts:123) invalid-page-count
 * 6.  (schema.ts:148) page-count-mismatch
 * 7.  (schema.ts:221) invalid-mark-page
 * 8.  (schema.ts:243) missing-unit-id
 * 9.  (schema.ts:260) missing-unit-kind
 * 10. (schema.ts:331) missing-unit-locators
 * 11. (schema.ts:353) invalid-locator-page
 * 12. (schema.ts:422) invalid-reference
 * 13. (schema.ts:549) invalid-export
 * 14. (schema.ts:562) missing-export-statement
 * 15. (schema.ts:569) missing-export-printedform
 * 16. (schema.ts:594) invalid-import
 * 17. (schema.ts:604) missing-import-paper
 * 18. (schema.ts:611) missing-import-resultid
 * 19. (schema.ts:618) import-use-missing
 * 20. (schema.ts:648) invalid-ids-frozen-at (and schema.ts:639)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ManifestSchemaError, validateSourceManifest } from "./schema.ts";

function assertManifestError(
  err: unknown,
  expectedCode: string,
): asserts err is ManifestSchemaError {
  if (!(err instanceof ManifestSchemaError)) {
    assert.fail(`Expected ManifestSchemaError, got ${String(err)}`);
  }
  assert.equal(err.code, expectedCode);
  assert.equal(err.rule, expectedCode);
}

function createValidManifest(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    paper: "light-quanta",
    document: "ap-17-132",
    status: "in-preparation",
    pageCount: 2,
    pageRange: [132, 133],
    idsFrozenAt: "2026-09-16T00:00:00Z",
    frozenBy: "editor-albert",
    units: [
      {
        id: "s1-p1",
        kind: "paragraph",
        locators: [{ page: 132 }],
      },
    ],
    ...overrides,
  };
}

describe("Manifest Schema Refusals (schema.ts)", () => {
  // 1. (schema.ts:48) invalid-manifest-object
  describe("Site (schema.ts:48): invalid-manifest-object", () => {
    it("rejects non-object or null input with code invalid-manifest-object (schema.ts:48)", () => {
      assert.throws(
        () => validateSourceManifest(null),
        (err: unknown) => {
          assertManifestError(err, "invalid-manifest-object");
          return true;
        },
      );
      assert.throws(
        () => validateSourceManifest(["not-an-object"]),
        (err: unknown) => {
          assertManifestError(err, "invalid-manifest-object");
          return true;
        },
      );
    });

    it("accepts a well-formed manifest object: no invalid-manifest-object (schema.ts:48)", () => {
      const result = validateSourceManifest(createValidManifest());
      assert.equal(result.paper, "light-quanta");
      assert.equal(result.document, "ap-17-132");
    });
  });

  // 2. (schema.ts:85) missing-document
  describe("Site (schema.ts:85): missing-document", () => {
    it("rejects missing or empty document with code missing-document (schema.ts:85)", () => {
      assert.throws(
        () => validateSourceManifest(createValidManifest({ document: "   " })),
        (err: unknown) => {
          assertManifestError(err, "missing-document");
          return true;
        },
      );
    });

    it("accepts a non-empty document bibKey string: no missing-document (schema.ts:85)", () => {
      const result = validateSourceManifest(createValidManifest({ document: "ap-17-132" }));
      assert.equal(result.document, "ap-17-132");
    });
  });

  // 3. (schema.ts:94) invalid-bib-key
  describe("Site (schema.ts:94): invalid-bib-key", () => {
    it("rejects malformed bibKey with code invalid-bib-key (schema.ts:94)", () => {
      assert.throws(
        () => validateSourceManifest(createValidManifest({ document: "invalid-bibkey-syntax" })),
        (err: unknown) => {
          assertManifestError(err, "invalid-bib-key");
          return true;
        },
      );
    });

    it("accepts valid bibKey: no invalid-bib-key (schema.ts:94)", () => {
      const result = validateSourceManifest(createValidManifest({ document: "ap-17-549" }));
      assert.equal(result.document, "ap-17-549");
    });
  });

  // 4. (schema.ts:114) invalid-status
  describe("Site (schema.ts:114): invalid-status", () => {
    it("rejects unknown status with code invalid-status (schema.ts:114)", () => {
      assert.throws(
        () => validateSourceManifest(createValidManifest({ status: "unapproved-status" })),
        (err: unknown) => {
          assertManifestError(err, "invalid-status");
          return true;
        },
      );
    });

    it("accepts recognized status values complete, in-preparation, and scoped: no invalid-status (schema.ts:114)", () => {
      const complete = validateSourceManifest(createValidManifest({ status: "complete" }));
      assert.equal(complete.status, "complete");
      const inPrep = validateSourceManifest(createValidManifest({ status: "in-preparation" }));
      assert.equal(inPrep.status, "in-preparation");
      const scoped = validateSourceManifest(createValidManifest({ status: "scoped" }));
      assert.equal(scoped.status, "scoped");
    });
  });

  // 5. (schema.ts:123) invalid-page-count
  describe("Site (schema.ts:123): invalid-page-count", () => {
    it("rejects non-positive integer pageCount with code invalid-page-count (schema.ts:123)", () => {
      assert.throws(
        () => validateSourceManifest(createValidManifest({ pageCount: 0 })),
        (err: unknown) => {
          assertManifestError(err, "invalid-page-count");
          return true;
        },
      );
      assert.throws(
        () => validateSourceManifest(createValidManifest({ pageCount: -1 })),
        (err: unknown) => {
          assertManifestError(err, "invalid-page-count");
          return true;
        },
      );
      assert.throws(
        () => validateSourceManifest(createValidManifest({ pageCount: 1.5 })),
        (err: unknown) => {
          assertManifestError(err, "invalid-page-count");
          return true;
        },
      );
    });

    it("accepts positive integer pageCount matching pageRange: no invalid-page-count (schema.ts:123)", () => {
      const result = validateSourceManifest(
        createValidManifest({ pageCount: 2, pageRange: [132, 133] }),
      );
      assert.equal(result.pageCount, 2);
    });
  });

  // 6. (schema.ts:148) page-count-mismatch
  describe("Site (schema.ts:148): page-count-mismatch", () => {
    it("rejects pageCount not matching pageRange span with code page-count-mismatch (schema.ts:148)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              pageCount: 5,
              pageRange: [132, 133],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "page-count-mismatch");
          return true;
        },
      );
    });

    it("accepts pageCount exactly matching endPage - startPage + 1: no page-count-mismatch (schema.ts:148)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          pageCount: 3,
          pageRange: [132, 134],
        }),
      );
      assert.equal(result.pageCount, 3);
      assert.deepEqual(result.pageRange, [132, 134]);
    });
  });

  // 7. (schema.ts:221) invalid-mark-page
  describe("Site (schema.ts:221): invalid-mark-page", () => {
    it("rejects non-positive or non-integer markPage with code invalid-mark-page (schema.ts:221)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-fn1",
                  kind: "footnote",
                  markPage: 0,
                  locators: [{ page: 132 }],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-mark-page");
          return true;
        },
      );
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-fn1",
                  kind: "footnote",
                  markPage: -3,
                  locators: [{ page: 132 }],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-mark-page");
          return true;
        },
      );
    });

    it("accepts positive integer markPage on unit: no invalid-mark-page (schema.ts:221)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          units: [
            {
              id: "s1-fn1",
              kind: "footnote",
              markPage: 132,
              locators: [{ page: 132 }],
            },
          ],
        }),
      );
      assert.equal(result.units[0]?.markPage, 132);
    });
  });

  // 8. (schema.ts:243) missing-unit-id
  describe("Site (schema.ts:243): missing-unit-id", () => {
    it("rejects unit with missing or empty string id with code missing-unit-id (schema.ts:243)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "   ",
                  kind: "paragraph",
                  locators: [{ page: 132 }],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "missing-unit-id");
          return true;
        },
      );
    });

    it("accepts unit with valid id string: no missing-unit-id (schema.ts:243)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          units: [
            {
              id: "s1-p1",
              kind: "paragraph",
              locators: [{ page: 132 }],
            },
          ],
        }),
      );
      assert.equal(result.units[0]?.id, "s1-p1");
    });
  });

  // 9. (schema.ts:260) missing-unit-kind
  describe("Site (schema.ts:260): missing-unit-kind", () => {
    it("rejects unit with missing or empty kind with code missing-unit-kind (schema.ts:260)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-p1",
                  kind: "",
                  locators: [{ page: 132 }],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "missing-unit-kind");
          return true;
        },
      );
    });

    it("accepts unit with non-empty kind string: no missing-unit-kind (schema.ts:260)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          units: [
            {
              id: "s1-p1",
              kind: "paragraph",
              locators: [{ page: 132 }],
            },
          ],
        }),
      );
      assert.equal(result.units[0]?.kind, "paragraph");
    });
  });

  // 10. (schema.ts:331) missing-unit-locators
  describe("Site (schema.ts:331): missing-unit-locators", () => {
    it("rejects unit with empty locators array with code missing-unit-locators (schema.ts:331)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-p1",
                  kind: "paragraph",
                  locators: [],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "missing-unit-locators");
          return true;
        },
      );
    });

    it("accepts unit with at least one locator: no missing-unit-locators (schema.ts:331)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          units: [
            {
              id: "s1-p1",
              kind: "paragraph",
              locators: [{ page: 132 }],
            },
          ],
        }),
      );
      assert.equal(result.units[0]?.locators.length, 1);
    });
  });

  // 11. (schema.ts:353) invalid-locator-page
  describe("Site (schema.ts:353): invalid-locator-page", () => {
    it("rejects locator with non-positive or non-integer page with code invalid-locator-page (schema.ts:353)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-p1",
                  kind: "paragraph",
                  locators: [{ page: -1 }],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-locator-page");
          return true;
        },
      );
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-p1",
                  kind: "paragraph",
                  locators: [{ page: 0 }],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-locator-page");
          return true;
        },
      );
    });

    it("accepts locator with positive integer page: no invalid-locator-page (schema.ts:353)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          units: [
            {
              id: "s1-p1",
              kind: "paragraph",
              locators: [{ page: 132 }],
            },
          ],
        }),
      );
      assert.equal(result.units[0]?.locators[0]?.page, 132);
    });
  });

  // 12. (schema.ts:422) invalid-reference
  describe("Site (schema.ts:422): invalid-reference", () => {
    it("rejects non-object reference entry with code invalid-reference (schema.ts:422)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-p1",
                  kind: "paragraph",
                  locators: [{ page: 132 }],
                  references: [null],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-reference");
          return true;
        },
      );
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              units: [
                {
                  id: "s1-p1",
                  kind: "paragraph",
                  locators: [{ page: 132 }],
                  references: [12345],
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-reference");
          return true;
        },
      );
    });

    it("accepts valid reference object entry: no invalid-reference (schema.ts:422)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          units: [
            {
              id: "s1-p1",
              kind: "paragraph",
              locators: [{ page: 132 }],
              references: [
                {
                  id: "s1-p1-r1",
                  occurrenceId: "s1-p1-r1",
                  targetCitationId: "planck-1900",
                },
              ],
            },
          ],
        }),
      );
      assert.equal(result.units[0]?.references?.length, 1);
      assert.equal(result.units[0]?.references?.[0]?.id, "s1-p1-r1");
    });
  });

  // 13. (schema.ts:549) invalid-export
  describe("Site (schema.ts:549): invalid-export", () => {
    it("rejects non-object export entry with code invalid-export (schema.ts:549)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              exports: [null],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-export");
          return true;
        },
      );
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              exports: ["not-an-object"],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-export");
          return true;
        },
      );
    });

    it("accepts valid export object: no invalid-export (schema.ts:549)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          exports: [
            {
              id: "light-quantum-hypothesis",
              statement: "Monochromatic radiation behaves as if composed of energy quanta.",
              printedForm: "E = R * beta * nu / N",
            },
          ],
        }),
      );
      assert.equal(result.exports?.length, 1);
      assert.equal(result.exports?.[0]?.id, "light-quantum-hypothesis");
    });
  });

  // 14. (schema.ts:562) missing-export-statement
  describe("Site (schema.ts:562): missing-export-statement", () => {
    it("rejects export with missing or empty statement with code missing-export-statement (schema.ts:562)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              exports: [
                {
                  id: "light-quantum-hypothesis",
                  statement: "   ",
                  printedForm: "E = R * beta * nu / N",
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "missing-export-statement");
          return true;
        },
      );
    });

    it("accepts export with non-empty statement: no missing-export-statement (schema.ts:562)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          exports: [
            {
              id: "light-quantum-hypothesis",
              statement: "Energy quanta statement",
              printedForm: "E = h * nu",
            },
          ],
        }),
      );
      assert.equal(result.exports?.[0]?.statement, "Energy quanta statement");
    });
  });

  // 15. (schema.ts:569) missing-export-printedform
  describe("Site (schema.ts:569): missing-export-printedform", () => {
    it("rejects export with missing or empty printedForm with code missing-export-printedform (schema.ts:569)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              exports: [
                {
                  id: "light-quantum-hypothesis",
                  statement: "Energy quanta statement",
                  printedForm: "",
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "missing-export-printedform");
          return true;
        },
      );
    });

    it("accepts export with non-empty printedForm: no missing-export-printedform (schema.ts:569)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          exports: [
            {
              id: "light-quantum-hypothesis",
              statement: "Energy quanta statement",
              printedForm: "E = h * nu",
            },
          ],
        }),
      );
      assert.equal(result.exports?.[0]?.printedForm, "E = h * nu");
    });
  });

  // 16. (schema.ts:594) invalid-import
  describe("Site (schema.ts:594): invalid-import", () => {
    it("rejects non-object import entry with code invalid-import (schema.ts:594)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              importedResults: [null],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-import");
          return true;
        },
      );
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              importedResults: ["not-an-import-object"],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-import");
          return true;
        },
      );
    });

    it("accepts valid import object: no invalid-import (schema.ts:594)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          importedResults: [
            {
              paper: "special-relativity",
              resultId: "lorentz-transformation",
              use: "premise",
            },
          ],
        }),
      );
      assert.equal(result.importedResults?.length, 1);
      assert.equal(result.importedResults?.[0]?.paper, "special-relativity");
    });
  });

  // 17. (schema.ts:604) missing-import-paper
  describe("Site (schema.ts:604): missing-import-paper", () => {
    it("rejects import with missing paper with code missing-import-paper (schema.ts:604)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              importedResults: [
                {
                  paper: "   ",
                  resultId: "lorentz-transformation",
                  use: "premise",
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "missing-import-paper");
          return true;
        },
      );
    });

    it("accepts import with valid paper identifier: no missing-import-paper (schema.ts:604)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          importedResults: [
            {
              paper: "brownian-motion",
              resultId: "diffusion-coefficient",
              use: "comparison",
            },
          ],
        }),
      );
      assert.equal(result.importedResults?.[0]?.paper, "brownian-motion");
    });
  });

  // 18. (schema.ts:611) missing-import-resultid
  describe("Site (schema.ts:611): missing-import-resultid", () => {
    it("rejects import with missing resultId with code missing-import-resultid (schema.ts:611)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              importedResults: [
                {
                  paper: "special-relativity",
                  resultId: "   ",
                  use: "premise",
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "missing-import-resultid");
          return true;
        },
      );
    });

    it("accepts import with valid resultId: no missing-import-resultid (schema.ts:611)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          importedResults: [
            {
              paper: "special-relativity",
              resultId: "lorentz-transformation",
              use: "premise",
            },
          ],
        }),
      );
      assert.equal(result.importedResults?.[0]?.resultId, "lorentz-transformation");
    });
  });

  // 19. (schema.ts:618) import-use-missing
  describe("Site (schema.ts:618): import-use-missing", () => {
    it("rejects import with unrecognized or missing use with code import-use-missing (schema.ts:618)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              importedResults: [
                {
                  paper: "special-relativity",
                  resultId: "lorentz-transformation",
                  use: "invalid-use-value",
                },
              ],
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "import-use-missing");
          return true;
        },
      );
    });

    it("accepts import with use: premise or use: comparison: no import-use-missing (schema.ts:618)", () => {
      const resPremise = validateSourceManifest(
        createValidManifest({
          importedResults: [
            {
              paper: "special-relativity",
              resultId: "lorentz-transformation",
              use: "premise",
            },
          ],
        }),
      );
      assert.equal(resPremise.importedResults?.[0]?.use, "premise");

      const resComparison = validateSourceManifest(
        createValidManifest({
          importedResults: [
            {
              paper: "brownian-motion",
              resultId: "diffusion-coefficient",
              use: "comparison",
            },
          ],
        }),
      );
      assert.equal(resComparison.importedResults?.[0]?.use, "comparison");
    });
  });

  // 20. (schema.ts:648) invalid-ids-frozen-at (and schema.ts:639)
  describe("Site (schema.ts:648): invalid-ids-frozen-at", () => {
    it("rejects non-ISO timestamp idsFrozenAt with code invalid-ids-frozen-at (schema.ts:648)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              idsFrozenAt: "definitely-not-a-valid-date",
              frozenBy: "editor-albert",
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-ids-frozen-at");
          assert.ok(err.repair?.includes("idsFrozenAt"));
          return true;
        },
      );
    });

    it("rejects empty string idsFrozenAt with code invalid-ids-frozen-at (schema.ts:639)", () => {
      assert.throws(
        () =>
          validateSourceManifest(
            createValidManifest({
              idsFrozenAt: "   ",
              frozenBy: "editor-albert",
            }),
          ),
        (err: unknown) => {
          assertManifestError(err, "invalid-ids-frozen-at");
          return true;
        },
      );
    });

    it("accepts valid ISO date timestamp for idsFrozenAt: no invalid-ids-frozen-at (schema.ts:648)", () => {
      const result = validateSourceManifest(
        createValidManifest({
          idsFrozenAt: "2026-09-16T12:34:56Z",
          frozenBy: "editor-albert",
        }),
      );
      assert.equal(result.idsFrozenAt, "2026-09-16T12:34:56Z");
      assert.equal(result.frozenBy, "editor-albert");
    });
  });
});
