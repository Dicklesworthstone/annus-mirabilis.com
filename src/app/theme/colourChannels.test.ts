import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { colourRulesIn, scanColourRules } from "./colourChannels.ts";

/**
 * The colour-channel sweep names each rule at the line it occupies in the file as written
 * (am-i1zb). It used to delete comments before counting lines, so every reported line was short
 * by the comment lines above the rule, and it counted from the whitespace before the selector.
 */
const REPO = fileURLToPath(new URL("../../../", import.meta.url)).replace(/\/$/, "");

describe("colour-channel sweep line numbers", () => {
  test("a rule after a multi-line comment is reported at its own line, and a commented-out rule is not scanned", () => {
    const css = [
      "/* a comment",
      "   over three",
      "   lines */",
      ".a { color: var(--accent); }",
      "",
      "/* .b { color: var(--accent); } */",
      "",
      ".c,",
      ".d {",
      "  border-color: var(--accent);",
      "}",
    ].join("\n");
    // Deleting the comments instead would report .a at line 1 and .c at 5.
    expect(colourRulesIn(css, "plant.css").map((r) => [r.selector, r.line])).toEqual([
      [".a", 4],
      [".c, .d", 8],
    ]);
  });

  test("every rule found in the tree is reported at a line that holds its selector", () => {
    const rules = scanColourRules(`${REPO}/src`, REPO);
    const misplaced = rules.filter((r) => {
      const line = readFileSync(`${REPO}/${r.file}`, "utf8").split("\n")[r.line - 1] ?? "";
      const first = r.selector.split(",")[0]?.trim().split(" ")[0] ?? "";
      return !line.includes(first);
    });
    console.log(
      `[colour channels] ${rules.length} rules; ${misplaced.length} at a line without their selector`,
    );
    // Not vacuous: 53 meaning-bearing rules on 2026-09-24, when the old count got 2 right.
    expect(rules.length).toBeGreaterThan(20);
    expect(misplaced.map((r) => `${r.file}:${r.line} ${r.selector}`)).toEqual([]);
  });
});
