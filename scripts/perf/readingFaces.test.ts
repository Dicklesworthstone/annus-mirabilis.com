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

const face = (name: string, gzipBytes: number): MeasuredFace => ({ name, gzipBytes, rawBytes: 0 });
const GERMAN = "out/papers/special-relativity/view/german/index.html";

describe("the reading faces the budget measures", () => {
  test("the default page, every /view/ face, and each section's gloss page; nothing else", () => {
    const root = outWith([
      "out/papers/special-relativity/index.html",
      "out/papers/special-relativity/view/german/index.html",
      "out/papers/special-relativity/view/gloss/index.html",
      "out/papers/special-relativity/s3/view/gloss/index.html",
      // A section's other pages serve the paper's own faces, and a section's document page is
      // not a face: neither is measured.
      "out/papers/special-relativity/s3/index.html",
      "out/papers/special-relativity/s3/view/german/index.html",
    ]);
    expect(builtReadingFacePaths(root)).toEqual([
      "out/papers/special-relativity/index.html",
      "out/papers/special-relativity/view/german/index.html",
      "out/papers/special-relativity/view/gloss/index.html",
      "out/papers/special-relativity/s3/view/gloss/index.html",
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
      expect(r.face).toMatch(/^out\/papers\/[a-z-]+\/(view\/[a-z]+\/)?index\.html$/);
      // A record is for a face the budget cannot hold; one within the budget would only loosen it.
      expect(r.gzipBytes).toBeGreaterThan(READING_FACE_BUDGET_BYTES);
      expect(r.reason.trim().length).toBeGreaterThan(20);
    }
  });
});
