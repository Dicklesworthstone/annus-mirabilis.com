/**
 * Expression AST parser refusal throw site tests (am-muyh).
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { ContentError } from "../content/compiler/json.ts";
import { record } from "./ast.ts";

describe("ast refusal throw sites (am-muyh)", () => {
  test("refusal (ast.ts:142): equation-invalid rejects non-record input in record()", () => {
    // Accept: valid record
    const accepted = record({ a: 1, b: "ok" }, "test-path", ["a"], ["b"]);
    assert.equal(accepted.a, 1);
    assert.equal(accepted.b, "ok");

    // Reject: non-record input throws equation-invalid
    assert.throws(
      () => record("primitive-string", "test-path", ["a"]),
      (err: unknown) => {
        assert.ok(err instanceof ContentError, `Expected ContentError, got ${String(err)}`);
        assert.equal((err as ContentError).code, "equation-invalid");
        assert.equal((err as ContentError).path, "test-path");
        return true;
      },
    );
  });
});
