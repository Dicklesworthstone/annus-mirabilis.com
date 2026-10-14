import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { ContentError } from "../compiler/json.ts";
import { validateReadingRecord } from "./reading.ts";

describe("reading schema refusals (am-muyh)", () => {
  test("reading: (reading.ts:197) invalid-record raised when input is not a plain record or violates schema", () => {
    assert.throws(
      () => validateReadingRecord(null, "reading.yaml"),
      (err) => {
        assert.ok(err instanceof ContentError);
        assert.equal(err.code, "invalid-record");
        return true;
      },
    );

    // Accept valid citation reading record
    const validCitation = {
      schemaVersion: 1,
      id: "cite-1",
      kind: "citation",
      title: "A valid paper",
      role: "primary",
      verification: { state: "unverified", note: "A fixture; there is no source to check." },
      locator: "p. 1-10",
      url: "https://example.org/test",
    };
    const accepted = validateReadingRecord(validCitation, "reading.yaml");
    assert.equal(accepted.id, "cite-1");
  });
});
