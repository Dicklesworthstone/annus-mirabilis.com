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
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeSweep, sitemapRoutes, sweepAnchors } from "./anchorTargets.ts";
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

/**
 * A REFUSAL FROM THIS FILE SAYS WHICH ONE IT IS (am-rel-candidate-checks-kc7y, dispatch 387).
 *
 * The duplicate-id guard below threw a bare `Error`. That refused a deploy at the fast-gate
 * ratchets for a second reason than the one it was written for: `scripts/candidate-checks.ts` has
 * no refusal baseline, and the ratchet's own words are that "a file absent from the baseline was
 * never measured, and reporting it as an increase from zero invents a measurement nobody took".
 * So the bare throw was undeclared debt rather than a regression.
 *
 * It is paid rather than recorded, because the argument for paying it is the check's own purpose: a
 * candidate check that refuses a promotion should say WHICH check failed and why, and a bare Error
 * carries no code for a log, a scanner or a release manifest to name. `scripts/e2e-edition-pipeline.ts`
 * records the same lesson about EmptyCorpusError, which "threw with no arguments at all before, so
 * nothing naming the refusal reached a reader or the scanner".
 */
export class CandidateCheckRegistrationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CandidateCheckRegistrationError";
    this.code = code;
  }
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
      "An accepted result exists only after a reader presses Apply and a browser runs the lab's worker, and these checks are HTTP only. What IS checkable over HTTP is the artifact's identity on the candidate, and wasm-artifact-served-as-pinned now checks it.",
    ),
  );
  results.push(
    notRun(
      "deliberate-typed-refusal",
      "Measured 2026-09-28 across 718 built pages: NO registered refusal code is rendered into served HTML. Every occurrence of one sits inside a Show-the-code listing, which is source text a reader is shown rather than a refusal a reader received. A typed refusal reaches a reader only when a browser executes the page, so this needs a browser lane rather than a better HTTP probe.",
    ),
  );
  results.push(await wasmArtifactServedAsPinned(fetcher));
  results.push(await fragmentAnchorsResolve(fetcher));

  // ONE NAME, ONE CHECK. The bead's interface criterion is that registration "rejects a duplicate
  // id", and until now nothing did: two checks sharing a name would both appear, and
  // summarizeCandidateChecks would print the name twice while allCandidateChecksPassed silently
  // judged both. A duplicate is a programming error in this file, so it throws rather than
  // returning a result nobody would read.
  assertUniqueCheckNames(results);
  return results;
}

/**
 * The registration interface's own criterion: it "accepts checks from other beads and rejects a
 * duplicate id". Nothing enforced it until now. Two checks sharing a name would both appear,
 * `summarizeCandidateChecks` would print the name twice, and `allCandidateChecksPassed` would judge
 * both without anyone being able to tell which verdict belonged to which check.
 *
 * Exported so the refusal is reachable by a test rather than only by a mistake: a guard that can
 * only be exercised by breaking the catalogue is a guard nobody ever sees work.
 */
export function assertUniqueCheckNames(results: readonly CandidateCheckResult[]): void {
  const seen = new Set<string>();
  const duplicates = results.map((r) => r.name).filter((n) => (seen.has(n) ? true : !seen.add(n)));
  if (duplicates.length > 0) {
    throw new CandidateCheckRegistrationError(
      "duplicate-candidate-check-id",
      `Duplicate candidate check id(s): ${[...new Set(duplicates)].sort().join(", ")}. Every check registers one name.`,
    );
  }
}

/**
 * THE DEPLOYED WASM IS THE PINNED ARTIFACT, BYTE FOR BYTE (am-rel-candidate-checks-kc7y).
 *
 * AGENTS.md requires candidate checks to include "one real accepted WASM result per numerical
 * capability ... against the deployed assets rather than the build directory", and the bead sharpens
 * it: the check must "assert the manifest digest and the refusal semantics". An accepted RESULT
 * needs a browser to press Apply and run the worker, which this harness cannot do. The manifest
 * DIGEST does not: it is a claim about bytes, and bytes are what HTTP serves.
 *
 * So this checks the half that is checkable, under a name that claims only that half.
 * `verify-wasm-artifacts.ts` already checks digests in the LOCAL build; what was unchecked until now
 * is that the CANDIDATE serves those same bytes — a stale CDN object, a partial upload or a
 * mispinned directory would pass every local gate and still reach a reader.
 *
 * Every file the manifest declares is fetched and hashed, not only the .wasm, and the count is the
 * denominator: a manifest that declared nothing would otherwise report the cleanest result here.
 */
export async function wasmArtifactServedAsPinned(fetcher: Fetcher): Promise<CandidateCheckResult> {
  const name = "wasm-artifact-served-as-pinned";
  const res = await fetcher("/wasm/manifest.json");
  if (res.status !== 200) {
    return {
      name,
      status: "failed",
      detail: `${name}: /wasm/manifest.json returned ${res.status} on the candidate, so no artifact identity could be read and nothing was checked.`,
    };
  }
  let manifest: {
    bundleId?: string;
    bundleDir?: string;
    wasmDigest?: string;
    files?: Record<string, { sha256?: string; bytes?: number }>;
    capabilities?: unknown[];
  };
  try {
    manifest = JSON.parse(res.body.toString("utf8"));
  } catch (error) {
    return {
      name,
      status: "failed",
      detail: `${name}: the served manifest is not JSON (${String(error)}).`,
    };
  }
  const files = Object.entries(manifest.files ?? {});
  if (files.length === 0) {
    return {
      name,
      status: "failed",
      detail: `${name}: the served manifest declares 0 files, so nothing was checked.`,
    };
  }
  const dir = String(manifest.bundleDir ?? "").replace(/^public\//, "/");
  if (!dir.startsWith("/")) {
    return {
      name,
      status: "failed",
      detail: `${name}: the served manifest's bundleDir ${JSON.stringify(manifest.bundleDir)} does not resolve to a served path.`,
    };
  }
  const mismatches: string[] = [];
  let checked = 0;
  for (const [file, declared] of files) {
    const got = await fetcher(`${dir}/${file}`);
    if (got.status !== 200) {
      mismatches.push(`${file}: HTTP ${got.status}`);
      continue;
    }
    checked += 1;
    const digest = createHash("sha256").update(got.body).digest("hex");
    if (declared.sha256 && digest !== declared.sha256) {
      mismatches.push(
        `${file}: sha256 ${digest.slice(0, 16)}… served, ${String(declared.sha256).slice(0, 16)}… declared`,
      );
      continue;
    }
    if (typeof declared.bytes === "number" && got.body.length !== declared.bytes) {
      mismatches.push(`${file}: ${got.body.length} bytes served, ${declared.bytes} declared`);
    }
  }
  const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities.length : 0;
  const where = `${checked} of ${files.length} declared files fetched from ${dir}, ${capabilities} capabilities declared`;
  if (mismatches.length > 0) {
    return {
      name,
      status: "failed",
      detail: `${name}: ${where}; ${mismatches.length} did not match what the manifest pins (${mismatches.slice(0, 3).join("; ")}).`,
    };
  }
  return {
    name,
    status: "passed",
    detail: `${name}: ${where}, every one matching its declared sha256 and byte count. Bytes only: this proves the candidate serves the pinned artifact, NOT that a reader obtains an accepted result from it, which needs a browser.`,
  };
}

/**
 * EVERY FRAGMENT LINK ON THE CANDIDATE POINTS AT AN ID THAT EXISTS (am-rel-candidate-checks-kc7y).
 *
 * A link to `/papers/x/#arg-foo` on a page with no `arg-foo` is HTTP 200 and broken for the reader,
 * who lands at the top and never learns what they missed. Measured this morning on live: 8 of 8
 * fragment links on the mass-energy capstone were broken that way.
 *
 * Routes come from the candidate's own sitemap and every page is fetched, so this reads no local
 * build directory. The denominator is in the detail on every run, because a sweep that found
 * nothing and a sweep that examined nothing are the same sentence otherwise — which is why 0 pairs
 * FAILS here rather than passing.
 */
export async function fragmentAnchorsResolve(fetcher: Fetcher): Promise<CandidateCheckResult> {
  const name = "fragment-anchors-resolve";
  const sitemap = await fetcher("/sitemap.xml");
  if (sitemap.status !== 200) {
    return {
      name,
      status: "failed",
      detail: `${name}: /sitemap.xml returned ${sitemap.status}, so no route list could be read and nothing was checked.`,
    };
  }
  const routes = sitemapRoutes(sitemap.body.toString("utf8"));
  if (routes.length === 0) {
    return {
      name,
      status: "failed",
      detail: `${name}: the sitemap listed 0 routes, so nothing was checked.`,
    };
  }
  const sweep = await sweepAnchors(fetcher, routes);
  const described = describeSweep(sweep);
  // A FLOOR ON A MEASURED COUNT, AND DELIBERATELY FAR BELOW IT. Measured 2026-09-28 against the
  // built export: 20,069 fragment links, 1,937 distinct target#fragment, over 271 target pages from
  // 240 routes. The floor is 100 because a false refusal here blocks a deploy, and the case it has
  // to catch is not a slightly smaller site but an href pattern that collects almost nothing — a
  // sweep that examined nothing reports the cleanest result this check can produce.
  if (sweep.pairs < 100) {
    return {
      name,
      status: "failed",
      detail: `${name}: only ${sweep.pairs} fragment links were collected across ${routes.length} routes, far below the 989 measured on 2026-09-28. The sweep examined too little to be believed. ${described}`,
    };
  }
  if (sweep.broken.length > 0 || sweep.unreachable.length > 0) {
    return { name, status: "failed", detail: `${name}: ${described}` };
  }
  return {
    name,
    status: "passed",
    detail: `${name}: ${described}. Anchors only: this proves each fragment exists on the page it names, not that it is the right passage.`,
  };
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

/**
 * A check that cannot run here, why, and who owns closing the gap (am-qsm9).
 *
 * THE PROBLEM THIS SOLVES. `allCandidateChecksPassed` used to require every check to have PASSED,
 * and three of the seven call `notRun`, so it returned false on every candidate that has ever
 * existed and `validatePromotePreconditions` threw every time. The promote path AGENTS.md specifies,
 * and that am-launch-public-release-5nkq names, could not succeed for any input. A gate that is
 * always closed tells a reader as little as one that is always open: neither answers a question
 * about the candidate, and this one hid the fact that four real checks were passing.
 *
 * WHY A DECLARATION AND NOT AN EXEMPTION. Dropping the three from the predicate would let the NEXT
 * check that quietly stops running slip through, which is the failure this repository keeps finding.
 * So a `not-available` check passes the predicate only if it is named HERE, with a reason and an
 * owning bead. An undeclared `not-available` still fails, a declared check that FAILS still fails,
 * and a declared check that starts passing makes its declaration stale, which
 * `staleNotRunnableDeclarations` reports so the entry is removed rather than left to rot.
 *
 * These three are honest gaps, not excuses. Two need a browser to execute a page and this harness is
 * HTTP only; the third has no complete paper to load because no paper is complete.
 */
export const DECLARED_NOT_RUNNABLE: ReadonlyMap<string, { reason: string; bead: string }> = new Map(
  [
    [
      "four-complete-paper-texts",
      {
        reason:
          "No paper is complete, so there is no complete paper text to load. The paper pages that do exist are checked byte-for-byte by paper-pages-served-as-built, which runs.",
        bead: "am-definition-of-done-as-code-8w1c",
      },
    ],
    [
      "accepted-wasm-result-per-capability",
      {
        reason:
          "An accepted WASM result exists only when a browser runs a lab's worker, and these checks are HTTP only. The artifact's bytes and digest ARE checked, by verify-wasm-artifacts; what is unchecked here is that a reader gets a result from them.",
        bead: "am-frankensim-repin-and-bind-jvhg",
      },
    ],
    [
      "deliberate-typed-refusal",
      {
        reason:
          "A lab's typed refusal appears only when a browser executes the page. The refusal codes and their reader language are checked in the unit lane; what is unchecked here is that a reader can reach one on the deployed site.",
        bead: "am-nxbq",
      },
    ],
  ],
);

/**
 * Checks that did not run and are not declared above: the ones that must block a promotion, because
 * nobody has said why they are silent.
 */
export function undeclaredNotRunnable(
  results: readonly CandidateCheckResult[],
): CandidateCheckResult[] {
  return results.filter((r) => r.status === "not-available" && !DECLARED_NOT_RUNNABLE.has(r.name));
}

/** Declarations for checks that now pass, or that are not in the catalogue at all: remove them. */
export function staleNotRunnableDeclarations(results: readonly CandidateCheckResult[]): string[] {
  const byName = new Map(results.map((r) => [r.name, r.status]));
  return [...DECLARED_NOT_RUNNABLE.keys()]
    .filter((name) => byName.get(name) !== "not-available")
    .sort();
}

/**
 * True when every check either passed or is a DECLARED not-runnable one. A failure is still a
 * failure, an undeclared silence is still a failure, and an empty result set is never a pass.
 */
export function allCandidateChecksPassed(results: readonly CandidateCheckResult[]): boolean {
  if (results.length === 0) return false;
  if (results.some((r) => r.status === "failed")) return false;
  if (undeclaredNotRunnable(results).length > 0) return false;
  return results.some((r) => r.status === "passed");
}
