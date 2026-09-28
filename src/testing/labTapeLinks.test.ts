/**
 * Every laboratory that has a recorded walkthrough links to it (am-2rl9).
 *
 * The teaching tapes became pages, were listed at /tapes/ and named on /instruments/, and the one
 * surface still silent about them was the laboratory each tape walks through. `LabTapes` renders
 * the link, and renders nothing for a laboratory with no tape, so it is safe on any page.
 *
 * THIS TEST IS THE REASON THE COMPONENT CAN BE TRUSTED ON 18 HAND-EDITED PAGES. "Did I miss one" is
 * not a question a diff answers: the pages are edited one at a time and a missing line looks
 * exactly like a page that never needed one. So the population is derived from the RECORDS, not
 * from the pages: every distinct experimentId among the authored tapes must have a laboratory page
 * that mounts LabTapes for that id.
 *
 * It reads source, not a render, and says so: it asserts the component is mounted with the right
 * id, not that a browser paints a link. tapePages.test.tsx and the browser lane own what is drawn.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTeachingTapes } from "../content/teachingTapes.ts";

const root = process.cwd();
const withTapes = [...new Set(loadTeachingTapes().tapes.map((t) => t.experimentId))].sort();

describe("a laboratory with a recorded walkthrough links to it", () => {
  test("the population comes from the records and is not empty", () => {
    console.log(`[lab tape links] ${withTapes.length} instruments have at least one authored tape`);
    expect(withTapes.length).toBeGreaterThan(10);
  });

  test("each of them has a page that mounts LabTapes with its own id", () => {
    const missing: string[] = [];
    for (const lab of withTapes) {
      const page = join(root, "src", "app", "lab", lab, "page.tsx");
      if (!existsSync(page)) {
        missing.push(`${lab}: no page.tsx`);
        continue;
      }
      const source = readFileSync(page, "utf8");
      if (!source.includes(`<LabTapes lab="${lab}"`))
        missing.push(`${lab}: page does not mount <LabTapes lab="${lab}">`);
    }
    expect(missing).toEqual([]);
  });

  test("no page mounts it for an instrument that is not its own", () => {
    // A copied line is the likeliest slip in an 18-page edit, and it would put bm-01's walkthrough
    // at the foot of bm-05.
    const wrong: string[] = [];
    for (const lab of withTapes) {
      const page = join(root, "src", "app", "lab", lab, "page.tsx");
      if (!existsSync(page)) continue;
      for (const m of readFileSync(page, "utf8").matchAll(/<LabTapes lab="([a-z0-9-]+)"/g))
        if (m[1] !== lab) wrong.push(`${lab}: mounts LabTapes for ${m[1]}`);
    }
    expect(wrong).toEqual([]);
  });
});
