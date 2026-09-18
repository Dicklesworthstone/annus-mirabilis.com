import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import {
  AuthorshipValidationError,
  authorshipOf,
  validateAuthorshipBlock,
  validateAuthorshipEntry,
} from "./authorship.ts";

describe("authorship schema refusal throw sites (am-muyh)", () => {
  test("authorship: (authorship.ts:42) invalid-authorship-entry raised when entry is not an object", () => {
    assert.throws(
      () => validateAuthorshipEntry(null),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "invalid-authorship-entry");
        return true;
      },
    );

    // Accept valid entry
    const accepted = validateAuthorshipEntry({ id: "jemanuel", kind: "human" });
    assert.equal(accepted.id, "jemanuel");
    assert.equal(accepted.kind, "human");
  });

  test("authorship: (authorship.ts:61) missing-contributor-id raised when contributor id is empty", () => {
    assert.throws(
      () => validateAuthorshipEntry({ kind: "human", id: "   " }),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "missing-contributor-id");
        return true;
      },
    );

    // Accept valid contributor id
    const accepted = validateAuthorshipEntry({ id: "einstein", kind: "human" });
    assert.equal(accepted.id, "einstein");
  });

  test("authorship: (authorship.ts:70) invalid-model-prefix raised when id starts with model:", () => {
    assert.throws(
      () => validateAuthorshipEntry({ id: "model:gpt-4", kind: "human" }),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "invalid-model-prefix");
        return true;
      },
    );
  });

  test("authorship: (authorship.ts:84) invalid-authorship-kind raised when kind is unrecognized", () => {
    assert.throws(
      () => validateAuthorshipEntry({ id: "contrib-1", kind: "alien" }),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "invalid-authorship-kind");
        return true;
      },
    );

    // Accept valid kind
    const accepted = validateAuthorshipEntry({ id: "contrib-1", kind: "human" });
    assert.equal(accepted.kind, "human");
  });

  test("authorship: (authorship.ts:95) missing-model-id raised when model kind lacks modelId", () => {
    assert.throws(
      () => validateAuthorshipEntry({ id: "agent:bot", kind: "model" }),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "missing-model-id");
        return true;
      },
    );

    // Accept valid model entry
    const accepted = validateAuthorshipEntry({
      id: "agent:bot",
      kind: "model",
      modelId: "claude-3-opus",
    });
    assert.equal(accepted.modelId, "claude-3-opus");
  });

  test("authorship: (authorship.ts:114) agent-as-reviewer raised when agent assigned reviewer role", () => {
    assert.throws(
      () =>
        validateAuthorshipEntry(
          { id: "agent:bot", kind: "model", modelId: "claude-3-opus", role: "reviewer" },
          "reviewer",
        ),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "agent-as-reviewer");
        return true;
      },
    );
  });

  test("authorship: (authorship.ts:130) invalid-authorship-block raised when block is not an object", () => {
    assert.throws(
      () => validateAuthorshipBlock(null),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "invalid-authorship-block");
        return true;
      },
    );

    // Accept valid block
    const accepted = validateAuthorshipBlock({
      draftedBy: [{ id: "jemanuel", kind: "human" }],
    });
    assert.equal(accepted.draftedBy.length, 1);
  });

  test("authorship: (authorship.ts:140) missing-drafted-by raised when draftedBy is missing or empty", () => {
    assert.throws(
      () => validateAuthorshipBlock({ draftedBy: [] }),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "missing-drafted-by");
        return true;
      },
    );

    // Accept non-empty draftedBy
    const accepted = validateAuthorshipBlock({
      draftedBy: [{ id: "author-1", kind: "human" }],
    });
    assert.equal(accepted.draftedBy[0]?.id, "author-1");
  });

  test("authorship: (authorship.ts:171) invalid-record raised when record is not an object in authorshipOf", () => {
    assert.throws(
      () => authorshipOf(null),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "invalid-record");
        return true;
      },
    );

    // Accept valid object with author
    const accepted = authorshipOf({ author: { id: "author-1", kind: "human" } });
    assert.equal(accepted.draftedBy[0]?.id, "author-1");
  });

  test("authorship: (authorship.ts:212) unrecognized-record raised when record lacks recognizable authorship fields", () => {
    assert.throws(
      () => authorshipOf({ unrelatedField: "abc" }),
      (err) => {
        assert.ok(err instanceof AuthorshipValidationError);
        assert.equal(err.code, "unrecognized-record");
        return true;
      },
    );

    // Accept valid translation record
    const accepted = authorshipOf({ translator: { id: "translator-1", kind: "human" } });
    assert.equal(accepted.draftedBy[0]?.id, "translator-1");
  });
});
