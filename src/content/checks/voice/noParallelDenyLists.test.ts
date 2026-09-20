import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
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

  // am-f6hr. This used to read `scanForParallelDenyLists({ roots: [] })`, which
  // scans NO FILE: the assertion held for MIN_MATCHING_TERMS of 1, 2, 3 or 99, so
  // the boundary the test is named after was never exercised. Both sides are now
  // pinned against real fixtures, one term below the threshold and one at it, so
  // moving MIN_MATCHING_TERMS in either direction turns one of them red.
  const FIXTURES = "src/content/checks/voice/__fixtures__/parallel";

  it("a list with only two matching terms does not fail", () => {
    for (const fixture of ["twoTermList.ts", "twoTermList.yaml"]) {
      const roots = [`${FIXTURES}/${fixture}`];
      // Reachability: the fixture has to be read at all, or 0 findings proves nothing.
      assert.notDeepEqual(
        scanForParallelDenyLists({ roots, excludeGlobs: [] }),
        undefined,
        `${fixture} was not readable`,
      );
      assert.deepEqual(
        scanForParallelDenyLists({ roots }),
        [],
        `${fixture} carries two vocabulary terms and must stay below MIN_MATCHING_TERMS`,
      );
    }
  });

  it("the same fixtures with a third term DO fail, so the threshold is pinned from both sides", () => {
    // Without this half the test above is satisfied by a scanner that finds nothing.
    for (const fixture of ["dangerousWords.ts", "dangerousWords.yaml"]) {
      const findings = scanForParallelDenyLists({ roots: [`${FIXTURES}/${fixture}`] });
      assert.ok(
        findings.length > 0,
        `${fixture} carries three vocabulary terms and must be found; if this passes while the ` +
          "two-term fixture also passes, the scanner is reading neither",
      );
    }
  });
});

describe("the gate's own directory is excluded by path, not by prefix (am-f6hr)", () => {
  it("a deny list at a sibling path that merely starts with the excluded string is FOUND", () => {
    // isExcluded had a third clause, `relativePath.startsWith(glob)`, with no
    // separator, so it subsumed the other two and excused any path beginning with
    // "src/content/checks/voice" - voiceRules.ts, voice2/, voiceOverrides/ - from
    // the gate whose own comment calls itself the only proof no second copy exists.
    // Built in a temp tree rather than the repo: a real 3-term deny list committed
    // under src/ would be a genuine violation of the rule being tested.
    const root = path.join(process.cwd(), "artifacts", "test-tmp", "parallel-denylist-prefix");
    const insideDir = path.join(root, "src/content/checks/voice");
    mkdirSync(insideDir, { recursive: true });
    const denyList = 'export const WORDS = ["streak", "badge", "score"];\n';
    writeFileSync(path.join(insideDir, "legitimate.ts"), denyList, "utf8");
    writeFileSync(path.join(root, "src/content/checks/voiceSmuggled.ts"), denyList, "utf8");

    const findings = scanForParallelDenyLists({
      roots: ["src"],
      excludeGlobs: ["content/editorial/voice-rules.yaml", "src/content/checks/voice"],
      cwd: root,
    });
    const files = findings.map((f) => f.file.split(path.sep).join("/"));

    // Reachability: with no exclusions both files are found, so a 0 below would
    // mean the scanner never read them rather than that the exclusion worked.
    const unexcluded = scanForParallelDenyLists({ roots: ["src"], cwd: root }).map((f) =>
      f.file.split(path.sep).join("/"),
    );
    assert.equal(
      unexcluded.length,
      2,
      `expected both planted lists to be readable, got ${unexcluded.join(", ")}`,
    );

    assert.ok(
      files.includes("src/content/checks/voiceSmuggled.ts"),
      `a sibling path beginning with the excluded string must still be scanned; found ${files.join(", ") || "nothing"}`,
    );
    assert.ok(
      !files.includes("src/content/checks/voice/legitimate.ts"),
      "the gate's own directory must still be excluded",
    );
  });
});
