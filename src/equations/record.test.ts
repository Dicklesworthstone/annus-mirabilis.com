/**
 * Equation record parser refusal throw site tests (am-muyh).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { describe } from "node:test";
import { ContentError } from "../content/compiler/json.ts";
import { parseEquationRecord } from "./record.ts";

describe("record refusal throw sites (am-muyh)", () => {
  const fixturePath = resolve(
    process.cwd(),
    "content/equations/brownian-motion/eq-model-bm-rms.json",
  );
  const validRecord = JSON.parse(readFileSync(fixturePath, "utf8"));

  test("refusal (record.ts:38): equation-invalid rejects invalid equation records", () => {
    // Accept: valid brownian equation record
    const accepted = parseEquationRecord(
      validRecord,
      "content/equations/brownian-motion/eq-model-bm-rms.json",
    );
    assert.equal(accepted.id, "eq-model-bm-rms");
    assert.equal(accepted.paper, "brownian-motion");

    // Reject: non-record input
    assert.throws(
      () => parseEquationRecord("not-a-record", "invalid-path"),
      (err: unknown) => {
        assert.ok(err instanceof ContentError, `Expected ContentError, got ${String(err)}`);
        assert.equal((err as ContentError).code, "equation-invalid");
        return true;
      },
    );
  });
});
