import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import {
  appendLogLine,
  evidenceDirFor,
  logPathFor,
  newLogRunId,
  writeEvidenceFile,
} from "../scaffold/logLine.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SUITE = "initial-route-graph";
const BEAD_ID = "am-scaf-nextjs-app-bu2";

export const INITIAL_ROUTE_JS_BUDGET_BYTES = 204_800; // 200 KiB

// ---------------------------------------------------------------------------
// Pure functions over parsed inputs (the app-build-manifest.json shape Next
// emits: `{ pages: Record<string, string[]> }`, keyed by the raw entrypoint
// path such as "page" or "papers/[slug]/page"), plus chunk text and an
// optional module trace. No filesystem or process access below this line
// except inside the CLI section at the bottom of the file.
// ---------------------------------------------------------------------------

export type AppBuildManifest = { pages: Record<string, string[]> };

/**
 * Mirrors Next's own `normalizeAppPath`: drops empty segments, route groups
 * `(group)`, parallel segments `@slot`, and a trailing `page`/`route` leaf,
 * then ensures a leading slash. This is how Next itself resolves a raw
 * app-build-manifest.json key (e.g. "page", "about/page") back to a route
 * (e.g. "/", "/about") when computing page sizes.
 */
export function normalizeAppManifestKey(key: string): string {
  const segments = key.split("/");
  let pathname = "";
  segments.forEach((segment, index) => {
    if (!segment) return;
    if (segment.startsWith("(") && segment.endsWith(")")) return;
    if (segment.startsWith("@")) return;
    if ((segment === "page" || segment === "route") && index === segments.length - 1) return;
    pathname += `/${segment}`;
  });
  return pathname === "" ? "/" : pathname;
}

export function normalizeRoute(route: string): string {
  if (route === "") return "/";
  return route.startsWith("/") ? route : `/${route}`;
}

/**
 * The app-build-manifest entrypoints a browser loads on EVERY route, beside the route's own.
 *
 * Raw manifest keys, not normalized routes: `normalizeAppManifestKey` maps a page entrypoint back
 * to a reader-facing route and these three are not pages, so they never appear in the normalized
 * map the route lookup uses.
 */
const APP_SHELL_MANIFEST_KEYS = ["/layout", "/error", "/global-error"] as const;

/**
 * Every chunk a browser fetches for `route` before the `load` event: the route's own manifest
 * entry, plus the app shell above.
 *
 * ONE SOURCE, because there were two. `run-perf-budgets.ts` reads the chunk SIZES it feeds back
 * into `checkInitialRouteGraph`, and it resolved the route with its own copy of the same lookup --
 * so teaching this module about the shell left the reported bytes unchanged, since the sizes it is
 * GIVEN decide them. Both call this now.
 *
 * Returns undefined when the route is not in the manifest, and an empty array when its entry is
 * empty, so a caller can tell those two apart.
 */
export function effectiveRouteChunks(
  manifest: AppBuildManifest,
  route: string,
): readonly string[] | undefined {
  const wanted = normalizeRoute(route);
  let own: readonly string[] | undefined;
  for (const [key, value] of Object.entries(manifest.pages)) {
    if (normalizeAppManifestKey(key) === wanted) {
      own = value;
      break;
    }
  }
  if (own === undefined) return undefined;
  if (own.length === 0) return [];
  const shell = APP_SHELL_MANIFEST_KEYS.flatMap((key) => manifest.pages[key] ?? []);
  return [...new Set([...own, ...shell])];
}

const FORBIDDEN_SIGNATURES = [
  "WebGLRenderer",
  "GlobalWorkerOptions",
  "WebAssembly.instantiateStreaming",
  ".wasm",
] as const;

const FORBIDDEN_MODULE_SUBSTRINGS = ["node_modules/pdfjs-dist/", "node_modules/three/"] as const;

export type SignatureViolation = {
  kind: "chunk-signature";
  chunk: string;
  signature: string;
  excerpt: string;
};
export type ChunkFileViolation = { kind: "chunk-filename"; chunk: string; signature: string };
export type ModuleTraceViolation = { kind: "module-trace"; module: string; signature: string };
export type ByteBudgetViolation = {
  kind: "byte-budget";
  route: string;
  compressedBytes: number;
  budgetBytes: number;
  encoding: string;
};
export type RouteGraphViolation =
  | SignatureViolation
  | ChunkFileViolation
  | ModuleTraceViolation
  | ByteBudgetViolation;

export type ByteAccounting = {
  rawBytes: number;
  gzipBytes: number;
  brotliBytes: number;
  effectiveBytes: number;
  encoding: "brotli" | "gzip";
  budgetBytes: number;
  overBudget: boolean;
};

export type RouteGraphResult =
  | { ok: true; route: string; chunks: readonly string[]; byteAccounting?: ByteAccounting }
  | {
      ok: false;
      route: string;
      reason: string;
      violations: readonly RouteGraphViolation[];
      byteAccounting?: ByteAccounting;
    };

export type RouteGraphInput = {
  route: string;
  manifest: AppBuildManifest;
  /** chunk relative path -> emitted text content, for signature scanning */
  chunkContents?: Readonly<Record<string, string>>;
  /** optional list of module file paths pulled into the route's bundle */
  moduleTrace?: readonly string[];
  /** optional explicit chunk sizes in bytes */
  chunkSizes?: Readonly<Record<string, { raw?: number; gzip?: number; brotli?: number }>>;
  /** optional budget override in bytes (default: 204,800) */
  budgetBytes?: number;
  /** preferred encoding for budget accounting (default: "brotli") */
  preferredEncoding?: "brotli" | "gzip";
};

function excerptAround(text: string, index: number, length = 200): string {
  return text.slice(index, index + length);
}

/**
 * Fails a route argument that does not exist in the manifest, and fails a
 * route whose manifest lists no chunks, rather than passing vacuously.
 * Always scans emitted chunk text and filenames for the forbidden
 * signatures; additionally scans an optional module trace when the caller
 * supplies one (Next does not guarantee one across bundlers/versions).
 */
export function checkInitialRouteGraph(input: RouteGraphInput): RouteGraphResult {
  const route = normalizeRoute(input.route);
  const normalizedPages = new Map<string, readonly string[]>();
  for (const [key, chunks] of Object.entries(input.manifest.pages)) {
    normalizedPages.set(normalizeAppManifestKey(key), chunks);
  }

  const routeChunks = normalizedPages.get(route);
  if (routeChunks === undefined) {
    return {
      ok: false,
      route,
      reason: `route ${route} does not exist in the manifest (known routes: ${[...normalizedPages.keys()].join(", ") || "<none>"})`,
      violations: [],
    };
  }
  if (routeChunks.length === 0) {
    return {
      ok: false,
      route,
      reason: `route ${route} lists no chunks in the manifest`,
      violations: [],
    };
  }

  /**
   * THE APP SHELL EVERY ROUTE FETCHES, WHICH THE ROUTE'S OWN MANIFEST ENTRY OMITS
   * (am-rc1001-bridge-plan-pcjk.15).
   *
   * A route's `pages` entry lists the chunks webpack assigns to that entrypoint. It does NOT list
   * the root layout or the error boundaries, and a browser loads all three on every page, so the
   * first-route figure was computed over a population smaller than the one it describes.
   *
   * MEASURED IN CHROMIUM against the built out/, separating requests before the `load` event from
   * requests after it -- the distinction matters, because an earlier pass of this measurement
   * counted lazily-fetched islands and reported a 25% under-report that is not real:
   *
   *   /papers/special-relativity/   17 JS before load, 7 more ~11 ms after
   *     the route entry alone        14 JS
   *     union with the three keys    17 JS, EXACTLY the pre-load set: nothing missing, nothing extra
   *
   * So the omission is the shared layout and the two error boundaries, 10,594 brotli bytes at
   * q11, a 7.2% under-report for that route (147,718 -> 158,312 against a 204,800 budget). The
   * seven chunks that arrive 11 ms after `load` are lazy islands and are deliberately NOT counted
   * here; whether the budget's wording covers them is a question for the owner, not for this
   * function.
   *
   * The direction is safe: this can only raise the reported bytes, never lower them, so no release
   * that was refused becomes permitted.
   *
   * ONE KNOWN OVER-COUNT, stated rather than hidden. For `/` and `/papers/` the union includes the
   * route's own `page` chunk, which Chromium does not fetch on those two routes (they have no
   * client page component), so the union reports 8 where a browser fetches 7. Over-counting is the
   * conservative direction and the manifest is the build's own declaration of the route's graph.
   */
  const chunks = effectiveRouteChunks(input.manifest, route) ?? routeChunks;

  const violations: RouteGraphViolation[] = [];

  for (const chunk of chunks) {
    if (chunk.endsWith(".wasm")) {
      violations.push({ kind: "chunk-filename", chunk, signature: ".wasm" });
    }
  }

  const chunkContents = input.chunkContents ?? {};
  for (const chunk of chunks) {
    const content = chunkContents[chunk];
    if (content === undefined) continue;
    for (const signature of FORBIDDEN_SIGNATURES) {
      const index = content.indexOf(signature);
      if (index !== -1) {
        violations.push({
          kind: "chunk-signature",
          chunk,
          signature,
          excerpt: excerptAround(content, index),
        });
      }
    }
  }

  for (const modulePath of input.moduleTrace ?? []) {
    for (const signature of FORBIDDEN_MODULE_SUBSTRINGS) {
      if (modulePath.includes(signature)) {
        violations.push({ kind: "module-trace", module: modulePath, signature });
      }
    }
  }

  // Byte accounting (brotli and gzip) across chunks
  let totalRaw = 0;
  let totalGzip = 0;
  let totalBrotli = 0;
  let hasByteInfo = false;

  for (const chunk of chunks) {
    if (input.chunkSizes?.[chunk]) {
      hasByteInfo = true;
      const s = input.chunkSizes[chunk];
      const raw = s.raw ?? 0;
      const gz = s.gzip ?? raw;
      const br = s.brotli ?? gz;
      totalRaw += raw;
      totalGzip += gz;
      totalBrotli += br;
    } else if (input.chunkContents?.[chunk] !== undefined) {
      hasByteInfo = true;
      const content = input.chunkContents[chunk];
      const buf = Buffer.from(content, "utf8");
      totalRaw += buf.byteLength;
      totalGzip += gzipSync(buf).length;
      totalBrotli += brotliCompressSync(buf).length;
    }
  }

  let byteAccounting: ByteAccounting | undefined;
  if (hasByteInfo) {
    const budgetBytes = input.budgetBytes ?? INITIAL_ROUTE_JS_BUDGET_BYTES;
    const encoding = input.preferredEncoding ?? "brotli";
    const effectiveBytes = encoding === "brotli" ? totalBrotli : totalGzip;
    const overBudget = effectiveBytes > budgetBytes;

    byteAccounting = {
      rawBytes: totalRaw,
      gzipBytes: totalGzip,
      brotliBytes: totalBrotli,
      effectiveBytes,
      encoding,
      budgetBytes,
      overBudget,
    };

    if (overBudget) {
      violations.push({
        kind: "byte-budget",
        route,
        compressedBytes: effectiveBytes,
        budgetBytes,
        encoding,
      });
    }
  }

  if (violations.length > 0) {
    const reason = violations.some((v) => v.kind === "byte-budget")
      ? `route ${route} exceeds initial client JavaScript budget (${byteAccounting?.effectiveBytes} > ${byteAccounting?.budgetBytes} bytes)`
      : `route ${route} loads forbidden dependencies`;
    return {
      ok: false,
      route,
      reason,
      violations,
      ...(byteAccounting !== undefined ? { byteAccounting } : {}),
    };
  }
  return {
    ok: true,
    route,
    chunks,
    ...(byteAccounting !== undefined ? { byteAccounting } : {}),
  };
}

export function formatRouteGraphViolation(violation: RouteGraphViolation): string {
  if (violation.kind === "chunk-signature") {
    return `chunk ${violation.chunk} contains forbidden signature "${violation.signature}": ${JSON.stringify(violation.excerpt)}`;
  }
  if (violation.kind === "chunk-filename") {
    return `chunk ${violation.chunk} is itself a forbidden asset (${violation.signature})`;
  }
  if (violation.kind === "byte-budget") {
    return `route ${violation.route} emitted client JavaScript (${violation.compressedBytes} bytes ${violation.encoding}) exceeds the budget of ${violation.budgetBytes} bytes`;
  }
  return `module trace includes forbidden dependency "${violation.module}" (matched "${violation.signature}")`;
}

// ---------------------------------------------------------------------------
// Thin CLI: reads the real .next/app-build-manifest.json and the chunk files
// it references, then calls the pure function above.
//   bun scripts/perf/initialRouteGraph.ts --route /
// ---------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): { route: string } {
  const index = argv.indexOf("--route");
  const route = index !== -1 ? argv[index + 1] : "/";
  if (!route) throw new Error("--route requires a value");
  return { route };
}

async function loadRealManifest(root: string): Promise<AppBuildManifest> {
  const manifestPath = resolve(root, ".next/app-build-manifest.json");
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as AppBuildManifest;
}

async function loadChunkContents(
  root: string,
  chunks: readonly string[],
): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};
  for (const chunk of chunks) {
    try {
      contents[chunk] = await readFile(resolve(root, ".next", chunk), "utf8");
    } catch {
      // A chunk Next lists but this filesystem does not have readable text
      // for (a binary asset such as an actual .wasm file) is still caught
      // by the chunk-filename check above; skip content scanning for it.
    }
  }
  return contents;
}

async function main(): Promise<void> {
  const { route } = parseArgs(process.argv.slice(2));
  const logRunId = newLogRunId();
  const logPath = logPathFor(SUITE, logRunId, ROOT);

  const manifest = await loadRealManifest(ROOT);
  const normalizedPages = new Map<string, readonly string[]>();
  for (const [key, chunks] of Object.entries(manifest.pages)) {
    normalizedPages.set(normalizeAppManifestKey(key), chunks);
  }
  const chunksForRoute = normalizedPages.get(normalizeRoute(route)) ?? [];
  const chunkContents = await loadChunkContents(ROOT, chunksForRoute);

  const result = checkInitialRouteGraph({ route, manifest, chunkContents });

  if (result.ok) {
    appendLogLine(logPath, {
      suite: SUITE,
      logRunId,
      testId: "initial-route-graph",
      beadId: BEAD_ID,
      outcome: "pass",
      message: `route ${result.route} loads ${result.chunks.length} chunk(s) with no forbidden dependency`,
      extra: { route: result.route },
    });
    console.log(
      JSON.stringify({
        outcome: "pass",
        route: result.route,
        chunks: result.chunks.length,
        logPath,
      }),
    );
    return;
  }

  appendLogLine(logPath, {
    suite: SUITE,
    logRunId,
    testId: "initial-route-graph",
    beadId: BEAD_ID,
    outcome: "fail",
    message: result.reason,
    extra: { route: result.route },
  });
  if (result.violations.length > 0) {
    const evidenceDir = evidenceDirFor(SUITE, logRunId, ROOT);
    result.violations.forEach((violation, index) => {
      writeEvidenceFile(evidenceDir, `violation-${index}.json`, JSON.stringify(violation, null, 2));
    });
  }
  console.error(result.reason);
  for (const violation of result.violations) console.error(formatRouteGraphViolation(violation));
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
