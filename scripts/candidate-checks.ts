/**
 * Candidate checks: what the deployed, unpromoted candidate actually serves, compared with the
 * build that passed the gates, before any alias moves (am-rel-candidate-checks-kc7y).
 *
 * WHY. Until 2026-09-24 every release record said `candidateChecksPassed: true`, and no check had
 * run (am-release-records-claim-unrun-checks-xxri). The only post-deploy check was `/` answering
 * 200 with 1000 bytes, after the aliases had already moved. A green local build proves the code
 * compiled; it does not prove that the bytes Vercel serves are the bytes the gates examined.
 *
 * WHAT RUNS. HTTP only, through `vercel curl --deployment <candidate>`, which passes the
 * deployment protection with the CLI's own credentials (the candidate is behind Vercel SSO; a plain
 * request gets a 302 to vercel.com/sso-api). Each served page and script is compared byte for byte
 * with the file `vercel build` wrote to `.vercel/output/static`, which is what was uploaded.
 *
 * WHAT DOES NOT RUN, and says so in its result rather than passing:
 * - `four-complete-paper-texts`: no paper is complete yet (plan §17.7), so there is nothing to load
 *   under that name. `paper-pages-served-as-built` checks the paper pages that do exist.
 * - `accepted-wasm-result-per-capability`: BM-01 binds FrankenSim's brownian_frames, but an
 *   accepted result exists only when a browser runs the lab's worker, and no browser runs here.
 * - `deliberate-typed-refusal`: a lab's refusal needs a browser executing the page, and no browser
 *   runs here. The HTTP checks cannot see page errors or execution labels either.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CandidateCheckResult } from "./deployment-verification.ts";

export type Fetched = Readonly<{ status: number; body: Buffer }>;
/** Resolves with the HTTP status and body, or with status 0 when the request itself failed. */
export type Fetcher = (path: string) => Promise<Fetched>;

/** Fetches a path from a protected candidate through `vercel curl`, which supplies the bypass. */
export function vercelCurlFetcher(deploymentUrl: string, cwd: string = process.cwd()): Fetcher {
  const dir = mkdtempSync(join(tmpdir(), "am-candidate-checks-"));
  let n = 0;
  return (path) =>
    new Promise((resolve) => {
      const out = join(dir, `${n++}.bin`);
      const child = spawn(
        "vercel",
        ["curl", path, "--deployment", deploymentUrl, "--", "-s", "-o", out, "-w", "%{http_code}"],
        { cwd, stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.on("error", () => resolve({ status: 0, body: Buffer.alloc(0) }));
      child.on("close", () => {
        const code = /(\d{3})\s*$/.exec(stdout);
        const status = code ? Number(code[1]) : 0;
        resolve({ status, body: existsSync(out) ? readFileSync(out) : Buffer.alloc(0) });
      });
    });
}

export type CandidateRoutes = Readonly<{
  paperPages: readonly string[];
  labPages: readonly string[];
  foundationPages: readonly string[];
}>;

function pagesUnder(staticDir: string, prefix: string): string[] {
  const root = join(staticDir, prefix);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, "index.html")))
    .sort()
    .map((name) => `/${prefix}/${name}/`);
}

/**
 * The pages the checks compare, read from the uploaded static tree, so the population is what
 * shipped rather than a list typed here: every paper's reading page and every face under its
 * `view/`, every lab, and every foundation.
 */
export function candidateRoutes(staticDir: string): CandidateRoutes {
  const paperPages: string[] = [];
  for (const paper of pagesUnder(staticDir, "papers")) {
    paperPages.push(paper);
    const view = join(staticDir, paper, "view");
    if (!existsSync(view)) continue;
    for (const face of readdirSync(view).sort()) {
      if (existsSync(join(view, face, "index.html"))) paperPages.push(`${paper}view/${face}/`);
    }
  }
  return {
    paperPages,
    labPages: pagesUnder(staticDir, "lab"),
    foundationPages: pagesUnder(staticDir, "foundations"),
  };
}

function localFile(staticDir: string, path: string): string {
  return path.endsWith("/") ? join(staticDir, path, "index.html") : join(staticDir, path);
}

/** The script chunks a page loads, read from its built HTML. */
export function scriptChunks(html: string): string[] {
  return [...html.matchAll(/<script[^>]*\ssrc="(\/_next\/static\/[^"?#]+\.js)"/g)].map(
    (m) => m[1] as string,
  );
}

/**
 * Vercel appends its toolbar loader to the webpack runtime chunk on every deployment, production
 * included (measured 2026-09-24: /_next/static/chunks/webpack-*.js served 11,638 bytes against the
 * built 11,199, and the difference is exactly this). It loads https://vercel.live/... only when a
 * `__vercel_toolbar=1` cookie is set, and the site's CSP (`script-src 'self'`) refuses that origin
 * anyway. It is Vercel's own addition, not a change to the build, so it is matched here character
 * for character, with only the deployment id free, and reported by name rather than passed
 * silently. Any other difference, including any other appended text, still fails. Turning off the
 * Vercel Toolbar in the project settings removes it, and this match then finds nothing.
 */
const VERCEL_TOOLBAR_SUFFIX =
  /^\n;\(function\(\)\{if\(typeof document==="undefined"\|\|!\/\(\?:\^\|;\\s\)__vercel_toolbar=1\(\?:;\|\$\)\/\.test\(document\.cookie\)\)return;var s=document\.createElement\('script'\);s\.src='https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js';s\.setAttribute\("data-explicit-opt-in","true"\);s\.setAttribute\("data-cookie-opt-in","true"\);s\.setAttribute\("data-deployment-id","dpl_[A-Za-z0-9]{8,64}"\);\(\(document\.head\|\|document\.documentElement\)\.appendChild\(s\)\)\}\)\(\);$/;

/** True when `served` is exactly `built` followed by Vercel's toolbar loader. */
export function isBuiltPlusVercelToolbar(served: Buffer, built: Buffer): boolean {
  if (served.length <= built.length || !served.subarray(0, built.length).equals(built))
    return false;
  return VERCEL_TOOLBAR_SUFFIX.test(served.subarray(built.length).toString("utf8"));
}

export type IdentityReport = Readonly<{
  checked: number;
  problems: readonly string[];
  /** Paths served as built plus Vercel's toolbar loader, and nothing else. */
  toolbarAppended?: readonly string[];
  /** Paths whose first request got no HTTP response at all and were asked again. */
  retried?: readonly string[];
}>;

/**
 * Times a path is asked for when a request gets NO HTTP response (status 0: the vercel curl
 * process failed, or the connection did). Such a failure says nothing about the served bytes; on
 * 2026-09-24 it refused 7cd223c4 over /lab/sr-04/ and /lab/sr-08/, both then served identical to
 * the build. A real HTTP status (404, 500) and a byte difference are never retried.
 */
export const REQUEST_ATTEMPTS = 3;

/** Fetches each path and compares its bytes with the uploaded file, a few requests at a time. */
export async function servedAsBuilt(
  fetcher: Fetcher,
  staticDir: string,
  paths: readonly string[],
  concurrency = 6,
  retryDelayMs = 500,
): Promise<IdentityReport> {
  const problems: string[] = [];
  const toolbarAppended: string[] = [];
  const retried: string[] = [];
  let checked = 0;
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const path = paths[next++] as string;
      const file = localFile(staticDir, path);
      if (!existsSync(file) || !statSync(file).isFile()) {
        problems.push(`${path}: no built file at ${file}`);
        continue;
      }
      let served = await fetcher(path);
      let attempts = 1;
      while (served.status === 0 && attempts < REQUEST_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, retryDelayMs * attempts));
        attempts += 1;
        served = await fetcher(path);
      }
      if (attempts > 1) retried.push(`${path} (${attempts} requests)`);
      checked += 1;
      if (served.status !== 200) {
        problems.push(`${path}: HTTP ${served.status || "request failed"}`);
      } else {
        const built = readFileSync(file);
        if (served.body.equals(built)) continue;
        if (isBuiltPlusVercelToolbar(served.body, built)) {
          toolbarAppended.push(path);
          continue;
        }
        problems.push(
          `${path}: served ${served.body.length} bytes differ from the built ${built.length}`,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
  return { checked, problems, toolbarAppended: toolbarAppended.sort(), retried: retried.sort() };
}

function identityResult(
  name: string,
  what: string,
  report: IdentityReport,
  expected: number,
  scope: string,
): CandidateCheckResult {
  if (expected === 0) {
    return {
      name,
      status: "failed",
      detail: `${name}: 0 ${what} found in the build; nothing was checked.`,
    };
  }
  if (report.problems.length > 0) {
    return {
      name,
      status: "failed",
      detail: `${report.problems.length} of ${expected} ${what} not served as built: ${report.problems.slice(0, 5).join("; ")}`,
    };
  }
  const toolbar = report.toolbarAppended ?? [];
  const finding =
    toolbar.length > 0
      ? ` Finding: ${toolbar.length} served as built plus Vercel's toolbar loader, a script tag for https://vercel.live that runs only with a __vercel_toolbar cookie and that the CSP refuses (${toolbar.join(", ")}). Turning off the Vercel Toolbar in the project settings removes it.`
      : "";
  const retried = report.retried ?? [];
  const retry =
    retried.length > 0
      ? ` ${retried.length} got no HTTP response on the first request and were asked again: ${retried.slice(0, 5).join("; ")}.`
      : "";
  return {
    name,
    status: "passed",
    detail: `${report.checked - toolbar.length} of ${expected} ${what} served byte-identical to the build.${finding}${retry} ${scope}`,
  };
}

function notRun(name: string, why: string): CandidateCheckResult {
  return { name, status: "not-available", detail: why };
}

export type CandidateCheckOptions = Readonly<{
  fetcher: Fetcher;
  staticDir: string;
  /** Repository root, for the frozen manifest ids the no-JavaScript check looks for. */
  root?: string;
}>;

/** Runs every check once, in catalogue order. A check that cannot run says why; none passes by default. */
export async function runCandidateChecksAgainst(
  options: CandidateCheckOptions,
): Promise<CandidateCheckResult[]> {
  const { fetcher, staticDir } = options;
  const root = options.root ?? process.cwd();
  const routes = candidateRoutes(staticDir);
  const results: CandidateCheckResult[] = [];

  results.push(
    notRun(
      "four-complete-paper-texts",
      "0 of 4 papers are complete (plan §17.7), so there is no complete paper text to load. The paper pages that exist are checked by paper-pages-served-as-built.",
    ),
  );

  results.push(
    identityResult(
      "paper-pages-served-as-built",
      "paper pages",
      await servedAsBuilt(fetcher, staticDir, routes.paperPages),
      routes.paperPages.length,
      "HTTP only: this proves the served bytes, not that any text is complete or reviewed.",
    ),
  );

  results.push(
    identityResult(
      "representative-foundations",
      "foundation pages",
      await servedAsBuilt(fetcher, staticDir, routes.foundationPages),
      routes.foundationPages.length,
      "HTTP only.",
    ),
  );

  const chunks = [
    ...new Set(
      routes.labPages.flatMap((page) => {
        const file = localFile(staticDir, page);
        return existsSync(file) ? scriptChunks(readFileSync(file, "utf8")) : [];
      }),
    ),
  ].sort();
  const labReport = await servedAsBuilt(fetcher, staticDir, [...routes.labPages, ...chunks]);
  results.push(
    identityResult(
      "every-instrument-bundle",
      `lab pages and script chunks (${routes.labPages.length} pages, ${chunks.length} chunks)`,
      labReport,
      routes.labPages.length + chunks.length,
      "HTTP only: no browser executed them, so page errors and execution labels are not checked.",
    ),
  );

  results.push(await noJavaScriptSourceText(fetcher, staticDir, root));

  results.push(
    notRun(
      "accepted-wasm-result-per-capability",
      "FrankenSim's brownian_frames is bound for BM-01 (am-frankensim-repin-and-bind-jvhg), but an accepted result exists only when a browser runs the lab's worker, and these checks are HTTP only.",
    ),
  );
  results.push(
    notRun(
      "deliberate-typed-refusal",
      "A lab's typed refusal appears only when a browser executes the page; these checks are HTTP only.",
    ),
  );
  return results;
}

/**
 * The German source face of mass-energy, fetched as a no-JavaScript reader receives it: served as
 * built, and carrying an anchor for every frozen manifest id, so the text is in the HTML and
 * addressable without hydration.
 */
async function noJavaScriptSourceText(
  fetcher: Fetcher,
  staticDir: string,
  root: string,
): Promise<CandidateCheckResult> {
  const name = "no-javascript-source-text";
  const path = "/papers/mass-energy/view/german/";
  const idsFile = join(root, "content/source-blocks/mass-energy/manifest.ids.snapshot.txt");
  if (!existsSync(idsFile)) {
    return {
      name,
      status: "failed",
      detail: `${idsFile} is missing, so there is nothing to look for.`,
    };
  }
  const ids = readFileSync(idsFile, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  const report = await servedAsBuilt(fetcher, staticDir, [path]);
  if (report.problems.length > 0) {
    return { name, status: "failed", detail: report.problems.join("; ") };
  }
  const html = readFileSync(localFile(staticDir, path), "utf8");
  // Inside <main>, not merely somewhere in the file. From 2026-09-24 to 2026-09-25 every anchor
  // was in the HTML, but in a hidden late Suspense segment after </main>, and this check passed
  // while a reader without JavaScript saw an empty page.
  const open = html.indexOf('<main id="main">');
  const close = open < 0 ? -1 : html.indexOf("</main>", open);
  const main = open < 0 ? "" : html.slice(open, close < 0 ? undefined : close);
  const missing = ids.filter((id) => !main.includes(`id="${id}"`));
  if (ids.length === 0 || missing.length > 0) {
    return {
      name,
      status: "failed",
      detail: `${path}: ${ids.length - missing.length} of ${ids.length} frozen ids anchored inside <main id="main">; missing ${missing.slice(0, 8).join(", ")}`,
    };
  }
  return {
    name,
    status: "passed",
    detail: `${path} served as built, with all ${ids.length} of ${ids.length} frozen manifest ids anchored inside <main id="main"> (no JavaScript executed).`,
  };
}

/** The one-line summary a release record carries: every check by status, nothing folded away. */
export function summarizeCandidateChecks(results: readonly CandidateCheckResult[]): string {
  const count = (status: CandidateCheckResult["status"]) =>
    results.filter((r) => r.status === status).map((r) => r.name);
  const passed = count("passed");
  const failed = count("failed");
  const notAvailable = count("not-available");
  return [
    `${passed.length} passed${passed.length ? ` (${passed.join(", ")})` : ""}`,
    `${failed.length} failed${failed.length ? ` (${failed.join(", ")})` : ""}`,
    `${notAvailable.length} not run${notAvailable.length ? ` (${notAvailable.join(", ")})` : ""}`,
  ].join("; ");
}

/** True only when every check in the catalogue ran and passed. A check that did not run is not a pass. */
export function allCandidateChecksPassed(results: readonly CandidateCheckResult[]): boolean {
  return results.length > 0 && results.every((r) => r.status === "passed");
}
