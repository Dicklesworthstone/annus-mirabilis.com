/**
 * WHAT A READING FACE'S BYTES ARE MADE OF (am-rc1001-bridge-plan-pcjk.52, step 1).
 *
 * D-2026-10-02-reading-faces-static-islands rules that the reading faces become static HTML with
 * separately hydrated islands. pcjk.52's first step is "measure the current per-face bytes and
 * hydration payload as the baseline", and its Tests and logging section asks for "a before and
 * after measurement script (scripts/perf/) per face, with JSONL output". This is that script.
 *
 * WHAT IT MEASURES, AND THE ONE THING IT FOUND. `perf/readingFaceRecords.json` attributes "about
 * 64% of the bytes to React's hydration payload", which is right, and the cause is narrower than
 * "hydration": measured 2026-10-10 over the built faces, the flight payload is 62 to 65% of a
 * face's bytes and RENDERED KATEX MARKUP IS ESSENTIALLY ALL OF IT -- 7,192,060 of 7,221,035 flight
 * bytes on special-relativity/view/parallel, 99.6%.
 *
 * So the duplication is specific: every formula's HTML appears once in the page markup and again
 * as a string prop crossing a client boundary, which React serialises as a `T` text row. That is
 * what "islands that receive only their own props" has to undo, and it is why this script reports
 * `katexFlightBytes` beside the totals rather than only a hydration percentage. A change that
 * moves the number is visible here; a change that only reorganises components is not.
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
  const gzipBytes = gzipSync(Buffer.from(html), { level: 9 }).length;
  return {
    face,
    htmlBytes,
    gzipBytes,
    flightBytes: flight.length,
    katexFlightBytes,
    flightShare: htmlBytes === 0 ? 0 : flight.length / htmlBytes,
    katexShareOfFlight: flight.length === 0 ? 0 : katexFlightBytes / flight.length,
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
