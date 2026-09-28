import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lastSegmentLooksLikeAFile, staticHostPath, tapePath } from "./sitePaths.ts";

/**
 * THE RULE, ASSERTED AGAINST LITERALS AND NOT AGAINST ITSELF (am-tpzn).
 *
 * Every expectation below is a written-out string. Calling the helper on both sides would pass for
 * any rule at all, including no rule, which is the shape AGENTS.md calls a tautological test.
 *
 * The corpus's two populations are named rather than counted, because both members are permanent:
 * AGENTS.md names `the-boost-to-0.6c` as one of the five teaching tapes, so it is not going to be
 * renamed out from under this file, and if it ever is, the identity assertion says so instead of
 * the dotted case going vacuously green. Measured 2026-09-28: 22 tapes, 1 of them dotted.
 */

const TAPES_DIR = join(process.cwd(), "content/experiments/tapes");
const tapeIds = readdirSync(TAPES_DIR)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => f.slice(0, -".yaml".length));

describe("the trailing-slash rule for a dotted path segment", () => {
  test("a dotted last segment is emitted without the slash, an undotted one with it", () => {
    expect(tapePath("the-boost-to-0.6c")).toBe("/tapes/the-boost-to-0.6c");
    expect(tapePath("the-locked-positions")).toBe("/tapes/the-locked-positions/");
    expect(tapePath("einstein-0-8-micron")).toBe("/tapes/einstein-0-8-micron/");
    // A dot anywhere in the LAST segment counts; a dot in an earlier one does not.
    expect(staticHostPath("/lab/sr-03/")).toBe("/lab/sr-03/");
    expect(staticHostPath("/share/home.png")).toBe("/share/home.png");
    expect(staticHostPath("/tapes/0.6c/detail/")).toBe("/tapes/0.6c/detail/");
    expect(lastSegmentLooksLikeAFile("/tapes/the-boost-to-0.6c/")).toBe(true);
    expect(lastSegmentLooksLikeAFile("/tapes/the-move/")).toBe(false);
  });

  test("the rule is idempotent, so a path that went through it can go through it again", () => {
    expect(staticHostPath(staticHostPath("/tapes/the-boost-to-0.6c/"))).toBe(
      "/tapes/the-boost-to-0.6c",
    );
    expect(staticHostPath(staticHostPath("/tapes/the-move/"))).toBe("/tapes/the-move/");
  });

  test("both populations exist in the corpus, so neither branch is vacuous", () => {
    // Not a count: the id itself, because it is frozen by AGENTS.md's naming section.
    expect(tapeIds).toContain("the-boost-to-0.6c");
    const dotted = tapeIds.filter((id) => id.includes("."));
    const plain = tapeIds.filter((id) => !id.includes("."));
    expect(dotted.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(5);
    for (const id of dotted) expect(tapePath(id).endsWith("/")).toBe(false);
    for (const id of plain) expect(tapePath(id).endsWith("/")).toBe(true);
  });

  test("no production file builds a tape URL by string template", () => {
    // The point of the helper is that the rule lives in ONE place. A second template would be
    // correct for 21 tapes and wrong for the twenty-second, which is exactly how this started.
    const offenders: string[] = [];
    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "testing" || entry.name === "generated") continue;
          walk(full);
          continue;
        }
        if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
        if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
        // The ONE file allowed to contain the template is the one that owns the rule; it is
        // named rather than pattern-matched, so a second helper elsewhere still fails.
        if (full === join(process.cwd(), "src/reader/sitePaths.ts")) continue;
        const source = readFileSync(full, "utf8");
        for (const [index, line] of source.split("\n").entries()) {
          // PROSE ABOUT THE TEMPLATE IS NOT THE TEMPLATE (AGENTS.md, "A gate that forbids a
          // construct must read code, not text"). The densest writing about this rule is the
          // comment explaining it, so a scanner over raw lines would fail on its own documentation.
          // This answers the LINE-COMMENT half only: a `//` line and a block-comment continuation
          // are skipped. It does not strip a trailing comment on a code line or a block comment
          // opened mid-line, and it does not need to, because a match on either of those still
          // sits beside real code on that line and is worth a look.
          const trimmed = line.trimStart();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
            continue;
          }
          if (/`\/tapes\/\$\{/.test(line)) offenders.push(`${full}:${index + 1}`);
        }
      }
    }
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});
