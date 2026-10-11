/**
 * The reading-face budget over every face (dispatch 254): scripts/perf/readingFaces.ts. The gate it
 * feeds runs in the release profile (scripts/run-perf-budgets.ts, row 2); this proof runs in the bun
 * lane, so a gate that stops reaching a verdict is still seen here.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { READING_FACE_BUDGET_BYTES } from "../measure-reading-face.ts";
import {
  builtReadingFacePaths,
  loadReadingFaceRecords,
  type MeasuredFace,
  measureBuiltReadingFaces,
  RECORDED_FACE_ALLOWANCE_BYTES,
  readingFaceVerdict,
  withoutBuildId,
} from "./readingFaces.ts";

function outWith(paths: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "reading-faces-"));
  for (const path of paths) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), "<html></html>");
  }
  return root;
}

/**
 * A built page whose gzipped size is near a target, for an end-to-end plant.
 *
 * INCOMPRESSIBLE BYTES, FROM A SEEDED XORSHIFT, and the reason is a fixture of mine that passed for
 * the wrong reason. `String.fromCharCode(32 + ((i * 7919) % 90))` looks random and has period 90, so
 * it gzips to almost nothing and an "over-budget" page built from it lands comfortably under the
 * budget. The size a fixture ASKS for is not the size gzip gives it, so the tests below read the
 * measured size rather than assuming the target was met.
 */
function outWithSized(entries: readonly (readonly [string, number])[]): string {
  const root = mkdtempSync(join(tmpdir(), "reading-faces-sized-"));
  for (const [path, targetGzipBytes] of entries) {
    let state = 0x2545f491;
    const chars: string[] = [];
    for (let i = 0; i < Math.round(targetGzipBytes * 1.1); i += 1) {
      state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) >>> 0;
      state = Math.imul(state ^ (state >>> 12), 0x297a2d39) >>> 0;
      chars.push(String.fromCharCode(32 + (state % 94)));
    }
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `<html><body>${chars.join("")}</body></html>`);
  }
  return root;
}

const face = (name: string, gzipBytes: number): MeasuredFace => ({ name, gzipBytes, rawBytes: 0 });
const GERMAN = "out/papers/special-relativity/view/german/index.html";

describe("the reading faces the budget measures", () => {
  test("every page a reader can reach under out/papers, at any depth, and nothing outside it", () => {
    // THIS TEST ENCODED THE OLD POPULATION (dispatch 469). It read "the default page, every /view/
    // face, and each section's gloss page; nothing else", and its own fixture listed a section's
    // document page and a section's German face under the comment "neither is measured" - which was
    // true of the walk and false of the reader, who can open both. Those two pages were 299.2 kB
    // and 352.8 kB gzipped on the 21:22 build while the row reported a pass, because the row never
    // opened them. The assertion is now the property rather than the shape list: what the build
    // writes under out/papers is what gets measured, so a route added later cannot escape by not
    // matching a pattern nobody remembered to widen.
    const root = outWith([
      "out/papers/special-relativity/index.html",
      "out/papers/special-relativity/view/german/index.html",
      "out/papers/special-relativity/view/gloss/index.html",
      "out/papers/special-relativity/s3/view/gloss/index.html",
      "out/papers/special-relativity/s3/index.html",
      "out/papers/special-relativity/s3/view/german/index.html",
      // Outside out/papers, so still not measured by this row.
      "out/lab/bm-01/index.html",
      "out/index.html",
    ]);
    expect(builtReadingFacePaths(root)).toEqual([
      "out/papers/special-relativity/index.html",
      "out/papers/special-relativity/s3/index.html",
      "out/papers/special-relativity/s3/view/german/index.html",
      "out/papers/special-relativity/s3/view/gloss/index.html",
      "out/papers/special-relativity/view/german/index.html",
      "out/papers/special-relativity/view/gloss/index.html",
    ]);
    expect(builtReadingFacePaths(outWith([]))).toEqual([]);
  });
});

describe("a rebuild of the same page measures the same", () => {
  test("two builds that differ only in their random build id measure alike", () => {
    const body = "<p>Zur Elektrodynamik bewegter Körper</p>".repeat(400);
    const page = (id: string) => `<html>${body}<script>"buildId":"${id}"</script>${body}</html>`;
    const measured = (id: string) => {
      const root = outWith([]);
      mkdirSync(join(root, ".next"), { recursive: true });
      writeFileSync(join(root, ".next/BUILD_ID"), id);
      mkdirSync(join(root, "out/papers/p"), { recursive: true });
      writeFileSync(join(root, "out/papers/p/index.html"), page(id));
      return measureBuiltReadingFaces(root)[0]?.gzipBytes;
    };
    expect(measured("ArNBK7DGnLhQX-EZDpDpO")).toBe(measured("zz9Qq_0aB1cD2eF3gH4iJ"));
    expect(withoutBuildId("a ArNB b ArNB", "ArNB")).toBe("a 0000 b 0000");
    expect(withoutBuildId("unchanged", undefined)).toBe("unchanged");
  });
});

describe("the verdict", () => {
  const records = [{ face: GERMAN, gzipBytes: 305_000, reason: "fixture" }];

  test("a recorded face at its recorded size passes, and so does any face within the budget", () => {
    const v = readingFaceVerdict(
      [face(GERMAN, 305_000), face("out/papers/x/index.html", 200_000)],
      records,
    );
    expect(v.failures).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.largest?.name).toBe(GERMAN);
    // The row reports a face the budget itself holds, so "within budget" is true of what it shows.
    expect(v.heldToBudget?.name).toBe("out/papers/x/index.html");
    expect(v.worstFailure).toBeUndefined();
  });

  test("the plant: a recorded face 10 kB heavier goes red, naming it", () => {
    const v = readingFaceVerdict([face(GERMAN, 315_000)], records);
    expect(v.ok).toBe(false);
    expect(v.failures).toEqual([
      `${GERMAN}: 315000 bytes gzipped, grown past its recorded 305000 by more than ${RECORDED_FACE_ALLOWANCE_BYTES} (perf/readingFaceRecords.json)`,
    ]);
    expect(v.worstFailure?.name).toBe(GERMAN);
  });

  test("a recorded face passes within the allowance for build noise, and fails one byte beyond it", () => {
    // The noise that refused cd1a54af's deploy: relativity's English face measured 174 bytes over
    // its record on a build whose only change was a test file.
    expect(readingFaceVerdict([face(GERMAN, 305_000 + 174)], records).ok).toBe(true);
    expect(
      readingFaceVerdict([face(GERMAN, 305_000 + RECORDED_FACE_ALLOWANCE_BYTES)], records).ok,
    ).toBe(true);
    const over = readingFaceVerdict(
      [face(GERMAN, 305_000 + RECORDED_FACE_ALLOWANCE_BYTES + 1)],
      records,
    );
    expect(over.ok).toBe(false);
    expect(over.worstFailure?.name).toBe(GERMAN);
  });

  test("a face over the budget that is not recorded goes red; a record never covers another face", () => {
    const other = "out/papers/special-relativity/view/english/index.html";
    const v = readingFaceVerdict(
      [face(GERMAN, 300_000), face(other, READING_FACE_BUDGET_BYTES + 1)],
      records,
    );
    expect(v.ok).toBe(false);
    expect(v.failures).toEqual([
      `${other}: ${READING_FACE_BUDGET_BYTES + 1} bytes gzipped, over the ${READING_FACE_BUDGET_BYTES} byte budget and not recorded`,
    ]);
  });

  test("measuring nothing is not passing", () => {
    expect(readingFaceVerdict([], records).ok).toBe(false);
  });

  test("the repository's records name real face paths, over the budget, each with its reason", () => {
    const real = loadReadingFaceRecords(process.cwd());
    expect(real.length).toBeGreaterThan(0);
    for (const r of real) {
      // A section segment is allowed since dispatch 469: 23 of the recorded faces are a section's
      // own page or one of its faces, which the row could not see until its population was widened.
      expect(r.face).toMatch(/^out\/papers\/[a-z-]+\/(s\d+\/)?(view\/[a-z]+\/)?index\.html$/);
      // A record is for a face the budget cannot hold; one within the budget would only loosen it.
      expect(r.gzipBytes).toBeGreaterThan(READING_FACE_BUDGET_BYTES);
      expect(r.reason.trim().length).toBeGreaterThan(20);
    }
  });
});

describe("the walk and the verdict, composed (am-snn0 criterion 4)", () => {
  /**
   * THE TWO HALVES WERE EACH TESTED AND NEVER COMPOSED, WHICH IS HOW THE DEFECT SURVIVED.
   *
   * The population test at the top of this file proves the walk reaches a section's own page. "A
   * face over the budget that is not recorded goes red" proves the verdict refuses one. Both passed
   * while `/papers/brownian-motion/s4/` sat at 299.2 kB gzipped -- over the 250,000-byte budget, in
   * no record and in no population -- because a walk that was too narrow and a verdict that was
   * correct were checked on different fixtures, and nothing asked them the question together.
   *
   * am-snn0's fourth criterion names exactly this: "add a page over budget and confirm the walk
   * finds it. The current walk does not, which is the proof it needs widening." So this drives the
   * real chain, `builtReadingFacePaths` then `measureBuiltReadingFaces` then `readingFaceVerdict`,
   * over a page at a depth the OLD shape list could not reach, and asserts the gate goes red naming
   * it.
   */
  const SECTION_PAGE = "out/papers/brownian-motion/s4/index.html";

  test("an over-budget page at a section depth is found, measured, and turns the verdict red", () => {
    const root = outWithSized([
      [SECTION_PAGE, READING_FACE_BUDGET_BYTES + 40_000],
      // A page the old walk DID reach, comfortably inside, so the red below is attributable.
      ["out/papers/brownian-motion/index.html", 20_000],
    ]);

    // 1. The walk finds it. The old shape list was <paper>/index.html, <paper>/view/<face>/ and
    //    <paper>/<section>/view/gloss/; a section's own page matched none of those three.
    const found = builtReadingFacePaths(root);
    expect(found).toContain(SECTION_PAGE);
    expect(found).toContain("out/papers/brownian-motion/index.html");

    // 2. It is measured, and over the budget. Read rather than assumed.
    const measured = measureBuiltReadingFaces(root);
    const section = measured.find((m) => m.name === SECTION_PAGE);
    expect(section).toBeDefined();
    expect(section?.gzipBytes).toBeGreaterThan(READING_FACE_BUDGET_BYTES);

    // 3. The verdict refuses it by name, with no record covering it.
    const verdict = readingFaceVerdict(measured, []);
    expect(verdict.ok).toBe(false);
    expect(verdict.worstFailure?.name).toBe(SECTION_PAGE);
    expect(verdict.failures.join("\n")).toContain(SECTION_PAGE);
    expect(verdict.failures.join("\n")).toContain("not recorded");
  });

  test("the control: the same page under budget passes, so the red is its SIZE and not its depth", () => {
    // Without this, the test above would also pass if the walk or the verdict refused every section
    // page outright, which would be a different gate than the one being claimed.
    const root = outWithSized([[SECTION_PAGE, 60_000]]);
    const measured = measureBuiltReadingFaces(root);
    expect(measured.map((m) => m.name)).toEqual([SECTION_PAGE]);
    expect(measured[0]?.gzipBytes).toBeLessThan(READING_FACE_BUDGET_BYTES);
    const verdict = readingFaceVerdict(measured, []);
    expect(verdict.ok).toBe(true);
    expect(verdict.failures).toEqual([]);
  });

  test("the fixture is incompressible, so an over-budget plant cannot pass by compressing away", () => {
    // The guard on the instrument rather than on the gate. A periodic filler gzips to almost
    // nothing, and the two tests above would then be making claims about a page that is not the size
    // they say it is.
    const root = outWithSized([[SECTION_PAGE, 300_000]]);
    const [measured] = measureBuiltReadingFaces(root);
    expect(measured).toBeDefined();
    expect(measured?.gzipBytes ?? 0).toBeGreaterThan(150_000);
  });
});
