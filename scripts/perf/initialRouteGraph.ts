import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
export type RouteGraphViolation = SignatureViolation | ChunkFileViolation | ModuleTraceViolation;

export type RouteGraphResult =
  | { ok: true; route: string; chunks: readonly string[] }
  | { ok: false; route: string; reason: string; violations: readonly RouteGraphViolation[] };

export type RouteGraphInput = {
  route: string;
  manifest: AppBuildManifest;
  /** chunk relative path -> emitted text content, for signature scanning */
  chunkContents?: Readonly<Record<string, string>>;
  /** optional list of module file paths pulled into the route's bundle */
  moduleTrace?: readonly string[];
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

  const chunks = normalizedPages.get(route);
  if (chunks === undefined) {
    return {
      ok: false,
      route,
      reason: `route ${route} does not exist in the manifest (known routes: ${[...normalizedPages.keys()].join(", ") || "<none>"})`,
      violations: [],
    };
  }
  if (chunks.length === 0) {
    return {
      ok: false,
      route,
      reason: `route ${route} lists no chunks in the manifest`,
      violations: [],
    };
  }

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

  if (violations.length > 0) {
    return { ok: false, route, reason: `route ${route} loads forbidden dependencies`, violations };
  }
  return { ok: true, route, chunks };
}

export function formatRouteGraphViolation(violation: RouteGraphViolation): string {
  if (violation.kind === "chunk-signature") {
    return `chunk ${violation.chunk} contains forbidden signature "${violation.signature}": ${JSON.stringify(violation.excerpt)}`;
  }
  if (violation.kind === "chunk-filename") {
    return `chunk ${violation.chunk} is itself a forbidden asset (${violation.signature})`;
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
