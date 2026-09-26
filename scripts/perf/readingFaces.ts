/**
 * THE READING-FACE BUDGET, OVER EVERY FACE (dispatch 254, TanElk's ruling 3).
 *
 * The `reading-face-html` row used to measure only out/papers/<paper>/index.html, the four default
 * pages, so no /view/ face was ever measured: on live 2026-09-26, relativity's German face was
 * 305,480 bytes gzipped and its gloss 789,888 while the row passed. This measures every built face:
 *   - the default page, out/papers/<paper>/index.html;
 *   - each face, out/papers/<paper>/view/<face>/index.html;
 *   - each section's gloss, out/papers/<paper>/<section>/view/gloss/index.html, since the gloss is
 *     printed one section per page (src/reader/faces/glossSections.ts).
 *
 * THE VERDICT. The budget stays 250,000 bytes (READING_FACE_BUDGET_BYTES). A face over it that is
 * recorded in perf/readingFaceRecords.json, with its measured size and the reason, fails when it
 * grows past that size. Any face over the budget that is not recorded fails. A record never raises
 * the budget for another face, and a recorded face that falls under the budget simply passes.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { measureReadingFace, READING_FACE_BUDGET_BYTES } from "../measure-reading-face.ts";

export const READING_FACE_RECORDS_PATH = "perf/readingFaceRecords.json";

export type ReadingFaceRecord = Readonly<{ face: string; gzipBytes: number; reason: string }>;
export type MeasuredFace = Readonly<{ name: string; gzipBytes: number; rawBytes: number }>;

const dirs = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];

/** Every built reading face under out/papers, as repository-relative paths, in a stable order. */
export function builtReadingFacePaths(root: string): string[] {
  const papersDir = resolve(root, "out/papers");
  const out: string[] = [];
  const add = (path: string) => {
    if (existsSync(path)) out.push(relative(root, path));
  };
  for (const paper of dirs(papersDir)) {
    const paperDir = join(papersDir, paper);
    add(join(paperDir, "index.html"));
    for (const face of dirs(join(paperDir, "view")))
      add(join(paperDir, "view", face, "index.html"));
    for (const section of dirs(paperDir)) {
      if (section === "view") continue;
      add(join(paperDir, section, "view", "gloss", "index.html"));
    }
  }
  return out;
}

/**
 * A page with its build id blanked. Next writes a random 21-character build id into every page
 * (next.config sets no generateBuildId), and those random characters alone moved relativity's
 * parallel face by up to 6 gzipped bytes across 13 ids, measured 2026-09-26. A record held to the
 * byte would then fail on a rebuild of the same commit. The id is replaced by a fixed token of the
 * same length, so equal content measures equal.
 */
export function withoutBuildId(html: string, buildId: string | undefined): string {
  return buildId ? html.split(buildId).join("0".repeat(buildId.length)) : html;
}

/** Each built face, measured as the budget measures it (gzip level 9), its build id blanked. */
export function measureBuiltReadingFaces(root: string): MeasuredFace[] {
  const idPath = resolve(root, ".next/BUILD_ID");
  const buildId = existsSync(idPath) ? readFileSync(idPath, "utf8").trim() : undefined;
  return builtReadingFacePaths(root).map((name) => {
    const html = withoutBuildId(readFileSync(resolve(root, name), "utf8"), buildId);
    const m = measureReadingFace(html);
    return { name, gzipBytes: m.gzipBytes, rawBytes: m.rawBytes };
  });
}

export function loadReadingFaceRecords(root: string): readonly ReadingFaceRecord[] {
  const path = resolve(root, READING_FACE_RECORDS_PATH);
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8")) as { faces?: unknown };
  return Array.isArray(raw.faces) ? (raw.faces as ReadingFaceRecord[]) : [];
}

export type ReadingFaceVerdict = Readonly<{
  ok: boolean;
  /** One line per failing face, naming it, its size and what it was held to. */
  failures: readonly string[];
  largest: MeasuredFace | undefined;
  /** The largest face held to the budget itself, that is, not recorded: the row's value on a pass. */
  heldToBudget: MeasuredFace | undefined;
  /** The largest face that fails: the row's value on a failure. */
  worstFailure: MeasuredFace | undefined;
  measured: number;
}>;

/**
 * How far a recorded face may measure above its recorded size before it fails. Two builds of the
 * same content differ by a few hundred bytes gzipped: chunk hashes and the flight data's chunk paths
 * change whenever any source file does. On 2026-09-26 relativity's English face measured 315,661
 * bytes on a build of f104a9a8 against the 315,487 recorded from 54c8cbf4, and the only change
 * between them was a renamed helper in a test file, which ships nothing. At an allowance of zero,
 * that noise refused the deploy of cd1a54af. 2,048 bytes admits it, and still fails the 10 kB plant
 * below, and any real growth, which is how a face gets heavier: a section of text, or a set of
 * displays.
 */
export const RECORDED_FACE_ALLOWANCE_BYTES = 2048;

export function readingFaceVerdict(
  measured: readonly MeasuredFace[],
  records: readonly ReadingFaceRecord[],
  budgetBytes: number = READING_FACE_BUDGET_BYTES,
): ReadingFaceVerdict {
  const recorded = new Map(records.map((r) => [r.face, r]));
  const failures: string[] = [];
  const failing: MeasuredFace[] = [];
  for (const face of measured) {
    const record = recorded.get(face.name);
    if (record) {
      if (face.gzipBytes > record.gzipBytes + RECORDED_FACE_ALLOWANCE_BYTES) {
        failing.push(face);
        failures.push(
          `${face.name}: ${face.gzipBytes} bytes gzipped, grown past its recorded ${record.gzipBytes} by more than ${RECORDED_FACE_ALLOWANCE_BYTES} (${READING_FACE_RECORDS_PATH})`,
        );
      }
    } else if (face.gzipBytes > budgetBytes) {
      failing.push(face);
      failures.push(
        `${face.name}: ${face.gzipBytes} bytes gzipped, over the ${budgetBytes} byte budget and not recorded`,
      );
    }
  }
  const bySize = (faces: readonly MeasuredFace[]) =>
    [...faces].sort((a, b) => b.gzipBytes - a.gzipBytes)[0];
  return {
    ok: measured.length > 0 && failures.length === 0,
    failures,
    largest: bySize(measured),
    heldToBudget: bySize(measured.filter((f) => !recorded.has(f.name))),
    worstFailure: bySize(failing),
    measured: measured.length,
  };
}
