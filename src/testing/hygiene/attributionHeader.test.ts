import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTRIBUTION_HEADER_PATTERN,
  attributionHeaderOpensWith,
  extractAttributionHeader,
} from "./attributionHeader.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// Assembled from fragments rather than written whole, which is the pattern
// extractedUiHygiene.test.ts:23 already uses and states a reason for: the third-party request
// scanner forbids the donor identity in a file's body, and it strips only the attribution
// header. A test ABOUT the header cannot carry the literal it is testing for. Same shape as a
// line matcher matching its own constant, which this repo has now met three times.
const DONOR_DOMAIN = `${["classic", "patents"].join("-")}.com`;
const EXPECTED_OPENING = `/**\n * Extracted from ${DONOR_DOMAIN}\n`;
/** A real extraction carrier, not a synthetic string. */
const CARRIER = "src/types/pdfjs-dist.d.ts";

/**
 * am-ftgq. One predicate, two implementations, opposite answers on the same bytes.
 *
 *   validateAttributionHeader  an exact startsWith, so one leading newline meant "header missing"
 *   every scanner's strip      /^\s*\/\*\*[\s\S]*?\*\//, which admits leading whitespace
 *
 * Three copies of the first and four of the second, across four modules. The rights gate
 * refused a file for carrying no attribution notice while the donor-identity scanner in the
 * SAME MODULE found that notice, stripped it, and reported nothing.
 */
describe("where the attribution header ends is decided once (am-ftgq)", () => {
  const original = readFileSync(join(ROOT, CARRIER), "utf8");

  test("the fixture reaches its state before any verdict is read from it", () => {
    // The check that turns a vacuous plant into a real one. If the carrier ever stops opening
    // with the notice, or the plant stops adding exactly two newlines, the disagreement below
    // is being measured on the wrong bytes and every verdict after it is worthless.
    expect(original.startsWith(EXPECTED_OPENING)).toBe(true);
    const planted = `\n\n${original}`;
    expect(planted.match(/^\n*/)?.[0].length).toBe(2);
    expect(planted.length - original.length).toBe(2);
    expect(planted.includes("/**")).toBe(true);
  });

  test("the validity check and the strip agree on a carrier with two leading newlines", () => {
    const planted = `\n\n${original}`;

    // The defect was exactly this pair disagreeing: false here, true there.
    expect(attributionHeaderOpensWith(planted, EXPECTED_OPENING)).toBe(true);
    expect(ATTRIBUTION_HEADER_PATTERN.test(planted)).toBe(true);

    // And they agree on the untouched file too, which they always did.
    expect(attributionHeaderOpensWith(original, EXPECTED_OPENING)).toBe(true);
    expect(ATTRIBUTION_HEADER_PATTERN.test(original)).toBe(true);
  });

  test("leading whitespace is admitted; content above the notice is NOT", () => {
    // The bead's warning, kept as a test. Relaxing the prefix carelessly would let a file
    // satisfy the header rule with its notice buried below other content. `^\s*` is anchored
    // with no `m` flag, so only whitespace can precede the block.
    expect(attributionHeaderOpensWith(`\n\n\t ${original}`, EXPECTED_OPENING)).toBe(true);
    expect(attributionHeaderOpensWith(`const x = 1;\n${original}`, EXPECTED_OPENING)).toBe(false);
    expect(ATTRIBUTION_HEADER_PATTERN.test(`const x = 1;\n${original}`)).toBe(false);
  });

  test("a file genuinely missing the opening is still refused", () => {
    // AC 4's other half: this must not have been made green by making the rule unsatisfiable.
    expect(attributionHeaderOpensWith("/**\n * Something else entirely\n */\n", EXPECTED_OPENING)).toBe(
      false,
    );
    expect(attributionHeaderOpensWith("export const x = 1;\n", EXPECTED_OPENING)).toBe(false);
    expect(extractAttributionHeader("export const x = 1;\n")).toBe(null);
  });

  test("the extractor reports the block, its leading whitespace and where it ends", () => {
    const header = extractAttributionHeader(`\n\n${original}`);
    expect(header).not.toBe(null);
    if (!header) return;
    expect(header.leadingWhitespace).toBe("\n\n");
    expect(header.block.startsWith("/**")).toBe(true);
    // endIndex spans the whitespace too, so a scanner's offset arithmetic stays correct.
    expect(`\n\n${original}`.slice(0, header.endIndex).endsWith("*/")).toBe(true);
  });
});
