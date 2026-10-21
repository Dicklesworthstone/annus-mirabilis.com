/**
 * WHAT A READING FACE'S BYTES ARE MADE OF (am-rc1001-bridge-plan-pcjk.52, step 1).
 *
 * D-2026-10-02-reading-faces-static-islands rules that the reading faces become static HTML with
 * separately hydrated islands. pcjk.52's first step is "measure the current per-face bytes and
 * hydration payload as the baseline", and its Tests and logging section asks for "a before and
 * after measurement script (scripts/perf/) per face, with JSONL output". This is that script.
 *
 * WHAT IT MEASURES. `perf/readingFaceRecords.json` attributes "about 64% of the bytes to React's
 * hydration payload", which holds: re-measured 2026-10-21 over 224 built faces, the flight payload
 * is 109,104,818 of 161,376,740 html bytes, 67.6%.
 *
 * THE PAYLOAD IS TWO THINGS, NOT ONE, and this paragraph said otherwise until 2026-10-21. It read
 * "RENDERED KATEX MARKUP IS ESSENTIALLY ALL OF IT -- 7,192,060 of 7,221,035 flight bytes on
 * special-relativity/view/parallel, 99.6%" -- the figure the comment on `ROW_ID` below already
 * retracted as a greedy match measuring the concatenation rather than the row. The headline of a
 * file is where its finding is read, so the retracted number was the one an author acted on while
 * the correction sat forty lines lower beside a regex.
 *
 * Row-precise, as THIS FILE's own two predicates compute it (a docblock that quotes a number its
 * code does not produce is the defect being repaired here, so these are `measureFaces`'s figures
 * and not a probe's):
 *
 *   face                               payload    math rows    element tree    accounted
 *   special-relativity/view/parallel  7,221,035        47.1%           41.3%        88.4%
 *   special-relativity/view/results   2,286,492        66.6%           32.9%        99.5%
 *   mass-energy/view/german             379,127        17.0%           80.0%        97.0%
 *   all 224 faces                   109,104,818        32.2%           55.4%        87.6%
 *
 * The unaccounted remainder is non-math text rows and module rows, which are small and are not
 * what a migration moves.
 *
 * So the duplicated mathematics is real and is a THIRD of the payload across the corpus, not all of
 * it: every formula's HTML appears once in the page markup and again as a string prop crossing a
 * client boundary, which React serialises as a `T` text row. The other large share is the
 * serialised ELEMENT TREE of the components that cross those boundaries, and no change to how math
 * is passed touches it. pcjk.52's step 2 has both halves -- "islands that receive only their own
 * props" is as much about how MANY boundaries there are as about what crosses them -- and a plan
 * aimed only at the math would leave 41% of relativity parallel's payload in place, and 80% of
 * mass-energy german's. Both columns are
 * reported for that reason, so a change that moves one and not the other is visible.
 *
 * NOT A TRANSFER MEASUREMENT. gzip here is `gzipSync(level 9)` over the file, which is a floor
 * rather than what a CDN serves -- the same caveat scripts/perf/routeStaticTransfer.ts carries and
 * for the same reason (am-rc1001-bridge-plan-pcjk.15 measured the served ratio at 0.313 against a
 * local 0.222). The 250,000-byte budget in AGENTS.md is stated on gzip, so the comparison is made
 * on this basis and labelled.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** AGENTS.md: "Reading-face HTML with all readings: 250 kB gzipped for the largest paper". */
export const READING_FACE_GZIP_BUDGET = 250_000;

export type FaceHydration = Readonly<{
  face: string;
  htmlBytes: number;
  gzipBytes: number;
  flightBytes: number;
  katexFlightBytes: number;
  /** flightBytes as a share of htmlBytes, which is the figure pcjk.52 quotes as "about 64%". */
  flightShare: number;
  /** katexFlightBytes as a share of flightBytes: how much of the payload is duplicated markup. */
  katexShareOfFlight: number;
  /**
   * The serialised React element tree: every row that is not a text row and not a module row. This
   * is the OTHER large share of the payload -- 41.3% of relativity parallel against math's 47.1%,
   * 80.0% of mass-energy german, and 55.4% across all 224 faces against math's 32.2% -- and it is
   * reported because nothing that changes how math
   * crosses a boundary reduces it. Only having fewer or smaller client boundaries does.
   */
  elementTreeBytes: number;
  overBudget: boolean;
}>;

const FLIGHT_PUSH = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
/** Where a flight ROW begins: `<id>:` at the start of a line inside the payload. */
const ROW_START = /(?=\\n?\d+:)/;
/**
 * A text row whose payload is rendered KaTeX: `<id>:T<len>,\\u003cspan class=\\"katex...`.
 *
 * ROW BY ROW, NOT BY A GREEDY RUN, and the first version over-reported by a factor of five.
 * `/\\u003cspan class=\\"katex(?:[^"\\\\]|\\\\.)*\u002f` runs to the end of the CONCATENATED payload rather
 * than to the end of the string value it started in, so it reported 99.6% of the payload as
 * mathematics on special-relativity/view/parallel and 91.5% on mass-energy/view/german. Counting
 * the rows that ARE math text rows gives 47.1% and 17.0%. A greedy match over a concatenation
 * measures the concatenation, and a synthetic case asserting katex < flight is what caught it.
 */
const ROW_ID = /^\d+:T[0-9a-f]+,/;
/** The escaped opening of a rendered KaTeX span, as it appears inside a flight string. */
const KATEX_OPEN = '\\u003cspan class=\\"katex';

/** Whether a flight row is a serialised element tree rather than a text or module row. */
export function isElementTreeRow(row: string): boolean {
  const body = row.startsWith("\\n") ? row.slice(2) : row;
  if (/^\d+:T[0-9a-f]+,/.test(body)) return false;
  if (/^\d+:I\[/.test(body)) return false;
  return /^\d+:[[{]/.test(body);
}

/** Whether a flight row is a text row whose payload is rendered KaTeX. */
export function isKatexTextRow(row: string): boolean {
  // A row may begin with the two characters backslash-n, which is how the chunk boundary appears
  // inside the payload string rather than as a real newline.
  const body = row.startsWith("\\n") ? row.slice(2) : row;
  const head = ROW_ID.exec(body);
  if (head === null) return false;
  return body.slice(head[0].length).startsWith(KATEX_OPEN);
}

export function faceHydration(face: string, html: string): FaceHydration {
  const htmlBytes = Buffer.byteLength(html);
  const flight = [...html.matchAll(FLIGHT_PUSH)].map((m) => m[1] ?? "").join("");
  const katexFlightBytes = flight
    .split(ROW_START)
    .filter(isKatexTextRow)
    .reduce((sum, row) => sum + row.length, 0);
  const elementTreeBytes = flight
    .split(ROW_START)
    .filter(isElementTreeRow)
    .reduce((sum, row) => sum + row.length, 0);
  const gzipBytes = gzipSync(Buffer.from(html), { level: 9 }).length;
  return {
    face,
    htmlBytes,
    gzipBytes,
    flightBytes: flight.length,
    katexFlightBytes,
    flightShare: htmlBytes === 0 ? 0 : flight.length / htmlBytes,
    katexShareOfFlight: flight.length === 0 ? 0 : katexFlightBytes / flight.length,
    elementTreeBytes,
    overBudget: gzipBytes > READING_FACE_GZIP_BUDGET,
  };
}

/** Every built reading face under `out/papers/<paper>/view/<face>/`, including per-section faces. */
export function builtFaces(outDir: string): readonly string[] {
  const papers = join(outDir, "papers");
  if (!existsSync(papers)) return [];
  const faces: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (!statSync(p).isDirectory()) continue;
      const r = `${rel}/${entry}`;
      if (existsSync(join(p, "index.html")) && /\/view\/[^/]+$/.test(r)) faces.push(r.slice(1));
      walk(p, r);
    }
  };
  walk(papers, "");
  return faces.sort();
}

export function measureFaces(outDir: string): readonly FaceHydration[] {
  return builtFaces(outDir).map((face) =>
    faceHydration(face, readFileSync(join(outDir, "papers", face, "index.html"), "utf8")),
  );
}
