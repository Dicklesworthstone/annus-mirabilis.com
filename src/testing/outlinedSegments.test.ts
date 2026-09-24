/**
 * The detector's own proof, in the bun lane. The gate that uses it
 * (scripts/e2e/noOutlinedSegments.e2e.test.ts) runs in the node lane and only over a built out/,
 * so if that lane stopped running, or out/ were absent, this is what still says the detector
 * can see an outlined segment at all.
 */
import { describe, expect, test } from "bun:test";
import { outlinedSegments } from "./outlinedSegments.ts";

// The shape React wrote into the 7b2ba7b1 build: the fallback in place, the content later, and
// the script that swaps them.
const OUTLINED = `<main><!--$?--><template id="B:0"></template><!--/$--><p>after</p></main>
<div hidden id="S:0"><section id="entry-light-quanta"><h2>How often</h2></section></div>
<script>$RC("B:0","S:0")</script>`;

describe("outlinedSegments", () => {
  test("finds a segment React wrote out of line", () => {
    expect(outlinedSegments(OUTLINED)).toEqual(["S:0"]);
  });

  test("finds every one, in order", () => {
    const two = `${OUTLINED}<div hidden id="S:1"><p>explorer</p></div><div hidden id="S:a"></div>`;
    expect(outlinedSegments(two)).toEqual(["S:0", "S:1", "S:a"]);
  });

  test("a boundary finished inline is not a finding", () => {
    const inline = `<main><!--$--><section id="entry-light-quanta"><h2>How often</h2></section><!--/$--></main>`;
    expect(outlinedSegments(inline)).toEqual([]);
  });

  test("other hidden elements are not findings", () => {
    const others = `<div data-face-source="true" hidden=""><p class="notice">…</p></div>
<div hidden id="s1-notice"></div><div hidden id="S"></div><section hidden id="S:0"></section>`;
    expect(outlinedSegments(others)).toEqual([]);
  });
});
