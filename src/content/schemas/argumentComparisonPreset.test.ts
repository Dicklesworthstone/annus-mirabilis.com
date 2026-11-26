import assert from "node:assert/strict";
import test from "node:test";
import { SchemaValidationError, validateArgumentComparison } from "./source.ts";

function comparison(firstFields: Record<string, unknown> = {}): unknown {
  return {
    questions: [{ id: "scope", label: "Which systems does the argument cover?" }],
    arguments: [
      {
        id: "first",
        label: "First argument",
        sourceNoteId: "note-first",
        instrumentRef: "me-03",
        cells: { scope: "An isolated system." },
        ...firstFields,
      },
      {
        id: "second",
        label: "Second argument",
        sourceNoteId: "note-second",
        instrumentRef: "me-01",
        cells: { scope: "A radiating body." },
      },
    ],
  };
}

function assertRefusal(raw: unknown, code: string, path: string) {
  assert.throws(
    () => validateArgumentComparison(raw, "fixture.comparison"),
    (error: unknown) => {
      assert.ok(error instanceof SchemaValidationError);
      assert.equal(error.code, code);
      assert.equal(error.path, path);
      return true;
    },
  );
}

test("argument comparison keeps existing records valid without a preset", () => {
  const raw = comparison();
  assert.deepEqual(validateArgumentComparison(raw), raw);
  assert.deepEqual(validateArgumentComparison(comparison({ presetId: undefined })), raw);
});

test("argument comparison preserves an optional preset on its own argument", () => {
  const raw = comparison({ presetId: "me-03-box-1906" });
  const parsed = validateArgumentComparison(raw);
  assert.deepEqual(parsed, raw);
  const [first, second] = parsed.arguments;
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.presetId, "me-03-box-1906");
  assert.equal(Object.hasOwn(second, "presetId"), false);
});

test("argument comparison refuses a supplied empty or non-string preset by field", () => {
  for (const presetId of [null, 7, false, [], {}, "", " \n"]) {
    assertRefusal(
      comparison({ presetId }),
      "comparison-argument-invalid",
      "fixture.comparison.arguments[0].presetId",
    );
  }
});

test("a comparison preset does not replace the required instrument address", () => {
  for (const instrumentRef of [undefined, ""]) {
    assertRefusal(
      comparison({ instrumentRef, presetId: "me-03-box-1906" }),
      "comparison-argument-invalid",
      "fixture.comparison.arguments[0].instrumentRef",
    );
  }
});

test("a comparison preset does not make unanswered questions valid", () => {
  assertRefusal(
    comparison({ presetId: "me-03-box-1906", cells: {} }),
    "comparison-cell-missing",
    "fixture.comparison.arguments[0].cells.scope",
  );
});
