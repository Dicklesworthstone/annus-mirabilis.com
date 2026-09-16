import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scanForParallelDenyLists,
  scanRealTreeForParallelDenyLists,
} from "./noParallelDenyLists.ts";

describe("scanRealTreeForParallelDenyLists", () => {
  it("the real tree passes (no second copy of the theater/mockery/overclaim/independence-claim vocabulary)", () => {
    const findings = scanRealTreeForParallelDenyLists();
    assert.deepEqual(findings, []);
  });
});

describe("scanForParallelDenyLists on planted fixtures", () => {
  it('a fixture TS module exporting ["streak", "badge", "score"] fails, naming its path and line', () => {
    const findings = scanForParallelDenyLists({
      roots: ["src/content/checks/voice/__fixtures__/parallel/dangerousWords.ts"],
    });
    const first = findings[0];
    assert.ok(first, "Must produce a finding");
    assert.ok(first.file.endsWith("dangerousWords.ts"));
    assert.ok(first.line > 0);
    assert.deepEqual(new Set(first.matchedTerms), new Set(["streak", "badge", "score"]));
  });

  it("a fixture YAML list with foolish, silly, and absurd fails the same way", () => {
    const findings = scanForParallelDenyLists({
      roots: ["src/content/checks/voice/__fixtures__/parallel/dangerousWords.yaml"],
    });
    assert.ok(findings.length > 0);
    const first = findings[0];
    assert.ok(first, "Must produce a finding");
    assert.ok(first.file.endsWith("dangerousWords.yaml"));
    assert.deepEqual(new Set(first.matchedTerms), new Set(["foolish", "silly", "absurd"]));
  });

  it("a list with only two matching terms does not fail", () => {
    const findings = scanForParallelDenyLists({ roots: [] });
    assert.deepEqual(findings, []);
  });
});
