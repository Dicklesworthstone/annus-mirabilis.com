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
 * WHAT ALSO RUNS, IN A BROWSER (dispatch 462). Two of the checks AGENTS.md requires by name cannot be
 * answered over HTTP at all. Measured across 718 built pages, NO registered refusal code is rendered
 * into served HTML, and an execution label in served HTML is always `static`, because both are earned
 * by a lab's worker executing on the page. So `accepted-wasm-result-per-capability` and
 * `deliberate-typed-refusal` are driven by an injected `CandidateBrowserProbe`
 * (scripts/candidateBrowserProbe.ts), which serves a real browser ENTIRELY from the `Fetcher` above,
 * so the bytes executed are still the deployment's bytes. A run with no probe reports both as
 * `not-available` and neither is declared, which keeps `candidateChecksPassed` false.
 *
 * EVERY CHECK IN THE CATALOGUE NOW RUNS (dispatch 474). `four-complete-paper-texts` was the last
 * silence, declared on the reading that "complete" meant editorially finished, which no candidate
 * check could ever assert. It asserts the reachable thing instead: the deployment serves every
 * source block the build compiled, 544 of them across the four papers when this was measured on 2026-09-28, anchored inside
 * `<main id="main">` where a reader without JavaScript receives them. What it does NOT claim is
 * stated in its own result, because the check's NAME invites the stronger claim.
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

/**
 * The same retry policy, as a Fetcher a caller can hand anywhere, because the browser probe had none.
 *
 * `servedAsBuilt` retries a status-0 request and reports which paths it retried. The browser probe
 * served every byte on a single attempt, so one failed `vercel curl` subprocess left a page missing
 * a chunk with nothing to say about it. Measured on 2026-09-28 against a complete export: planting a
 * single status 0 for `/_next/static/chunks/4269.3973e0a70b800eb3.js` made BM-01 report labels
 * `[static]` then `[static]`, 0 wasm requests, no FrankenSim wording AND no page error, which is
 * exactly what that evening's candidate reported for BM-01 while BM-05 and BM-06 passed. Driven by
 * hand and through this probe over the same export, BM-01 reaches "Ideal model, computed with
 * FrankenSim" at three press timings, so a missing byte and a lab that never calls its owner are
 * indistinguishable in the observation.
 *
 * A real HTTP status is the deployment's answer and is never retried.
 */
export function retryingFetcher(
  fetcher: Fetcher,
  attempts: number = REQUEST_ATTEMPTS,
  delayMs = 500,
): Fetcher {
  return async (path) => {
    let fetched = await fetcher(path);
    for (let attempt = 1; fetched.status === 0 && attempt < attempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      fetched = await fetcher(path);
    }
    return fetched;
  };
}

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

// ---------------------------------------------------------------------------
// FOUR COMPLETE PAPER TEXTS (am-rel-candidate-checks-kc7y, dispatch 474).
//
// WHAT "COMPLETE" MEANS HERE, because the name invites a claim this check does not make. It does NOT
// assert that an edition is editorially complete, reviewed, or translated; none of the four is
// finished and no candidate check could say so. It asserts that the text the DEPLOYMENT serves
// carries every source block the BUILD compiled: the declared id list for each paper is anchored, in
// full, inside `<main id="main">` on the page a reader without JavaScript receives.
//
// WHY THE DECLARED LIST IS THE RIGHT DENOMINATOR. `content/source-blocks/<paper>/
// manifest.ids.snapshot.txt` is asserted equal to the compiled manifest's unit ids, in order, by
// each paper's own manifest test, and those tests plant a removal and require it to fail. So the
// snapshot is the corpus the build compiled rather than a hand-kept list that could drift from it.
//
// WHY THE SECTION FLOOR IS NOT DECORATION. "Every declared id is present" is 100% of whatever the
// snapshot happens to hold, so a corpus that silently lost a whole section would still read as
// complete: the denominator shrinks with the numerator. AGENTS.md names the sections most likely to
// vanish behind the familiar headlines -- "paper 3, sections 6 to 10; paper 1, section 9" -- so
// those must still HAVE declared ids, which a shrunken corpus cannot satisfy.
//
// WHAT IS NOT ASSERTED, and why. Document ORDER is not. The snapshot is in manifest order, and the
// page renders a footnote apparatus at the end: measured on mass-energy, s0-fn1 and s0-fn2 are
// declared between the paragraphs that mark them and served after every paragraph, so 20 of 25 ids
// are "out of order" on a page that is correct. An order assertion would go red on correct work,
// which is the brittleness AGENTS.md warns about in "A Count Is For Reporting, Not For Asserting".
// ---------------------------------------------------------------------------

/** The four papers, by name, so a paper dropped from the corpus fails rather than shrinking the run. */
export const COMPLETE_TEXT_PAPERS: readonly string[] = Object.freeze([
  "mass-energy",
  "light-quanta",
  "brownian-motion",
  "special-relativity",
]);

/**
 * The sections AGENTS.md names as the ones that must never disappear: paper 3's 6 to 10 and paper
 * 1's 9. Each must still have declared ids, which is what stops a shrunken corpus reading as
 * complete.
 */
export const REQUIRED_SECTIONS: ReadonlyMap<string, readonly number[]> = new Map([
  ["special-relativity", Object.freeze([6, 7, 8, 9, 10])],
  ["light-quanta", Object.freeze([9])],
]);

/**
 * Which numbered section an id belongs to, or null for the masthead, part headings and closing
 * blocks. Anchored on purpose: a prefix test would read `s10-p1` as section 1, which would let
 * section 1 stand in for the section 10 the floor above is looking for.
 */
export function sectionOfId(id: string): number | null {
  const match = /^(?:eq-)?s(\d+)(?:-|$)/u.exec(id);
  return match ? Number(match[1]) : null;
}

/**
 * A REAL `id` ATTRIBUTE, not the substring.
 *
 * Measured on the built export: the bare substring `id="s0-p2"` occurs three times inside
 * `<main>` on mass-energy's German face, and only ONE of them is an anchor. The other two are
 * `data-block-id="s0-p2"`. A substring test would therefore be satisfied by the data attributes
 * alone, on a page where every anchor a reader's fragment link needs had been dropped.
 */
export function anchorsId(html: string, id: string): boolean {
  return new RegExp(`(?:^|[\\s"'])id="${id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`, "u").test(
    html,
  );
}

/** The contents of `<main id="main">`, or "" when the page has no such element. */
export function mainContents(html: string): string {
  const open = html.indexOf('<main id="main">');
  if (open < 0) return "";
  const close = html.indexOf("</main>", open);
  return html.slice(open, close < 0 ? undefined : close);
}

export function declaredSourceBlockIds(root: string, paper: string): string[] {
  const file = join(root, "content/source-blocks", paper, "manifest.ids.snapshot.txt");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

export async function fourCompletePaperTexts(
  fetcher: Fetcher,
  staticDir: string,
  root: string,
  papers: readonly string[] = COMPLETE_TEXT_PAPERS,
): Promise<CandidateCheckResult> {
  const name = "four-complete-paper-texts";
  if (papers.length !== 4)
    return {
      name,
      status: "failed",
      detail: `This check is named for four papers and was given ${papers.length}. A shorter list is a smaller denominator, not a passing candidate.`,
    };

  const lines: string[] = [];
  const failures: string[] = [];
  let anchored = 0;
  let declared = 0;
  for (const paper of papers) {
    const path = `/papers/${paper}/view/german/`;
    const ids = declaredSourceBlockIds(root, paper);
    if (ids.length === 0) {
      failures.push(
        `${paper}: no source-block ids are declared, so there is nothing to look for on ${path}`,
      );
      lines.push(`${paper}: 0 declared`);
      continue;
    }
    declared += ids.length;

    // The served bytes must be the uploaded bytes FIRST; only then is reading the local copy the
    // same thing as reading the response, which is what lets the id scan run against a local file.
    const report = await servedAsBuilt(fetcher, staticDir, [path]);
    if (report.problems.length > 0) {
      failures.push(`${paper}: ${report.problems.join("; ")}`);
      lines.push(`${paper}: ${ids.length} declared, page not served as built`);
      continue;
    }
    const main = mainContents(readFileSync(localFile(staticDir, path), "utf8"));
    if (main.length === 0) {
      failures.push(`${paper}: ${path} serves no <main id="main">, so no id can be anchored in it`);
      lines.push(`${paper}: ${ids.length} declared, no main element`);
      continue;
    }
    const missing = ids.filter((id) => !anchorsId(main, id));
    anchored += ids.length - missing.length;

    const sections = new Set(
      ids.map((id) => sectionOfId(id)).filter((section): section is number => section !== null),
    );
    const requiredSections = REQUIRED_SECTIONS.get(paper) ?? [];
    const absentSections = requiredSections.filter((section) => !sections.has(section));

    lines.push(
      `${paper}: ${ids.length - missing.length} of ${ids.length} declared ids anchored in <main> on ${path}; ${sections.size} numbered section(s)${
        requiredSections.length > 0
          ? `, of which the required ${requiredSections.join(", ")} are ${absentSections.length === 0 ? "all declared" : `MISSING ${absentSections.join(", ")}`}`
          : ""
      }`,
    );
    if (missing.length > 0)
      failures.push(
        `${paper}: ${missing.length} declared id(s) are not anchored on the served page, among them ${missing.slice(0, 6).join(", ")}`,
      );
    if (absentSections.length > 0)
      failures.push(
        `${paper}: the corpus declares no ids for section(s) ${absentSections.join(", ")}, which AGENTS.md names as sections that must never disappear`,
      );
  }

  const examined = `Examined ${papers.length} papers and ${declared} declared source-block ids, ${anchored} of them anchored: ${lines.join(" — ")}.`;
  if (declared === 0)
    return {
      name,
      status: "failed",
      detail: `No declared source-block id was found for any of the ${papers.length} papers, so this check examined nothing. ${examined}`,
    };
  if (failures.length > 0)
    return { name, status: "failed", detail: `${failures.join(" | ")}. ${examined}` };
  return {
    name,
    status: "passed",
    detail: `All ${declared} source blocks the build compiled for the four papers are anchored in the served text a reader without JavaScript receives. ${examined} "Complete" here means the deployment serves the whole compiled corpus; it is not a claim that any edition is editorially complete, translated or reviewed.`,
  };
}

// ---------------------------------------------------------------------------
// THE TWO CHECKS THAT NEED A BROWSER (am-rel-candidate-checks-kc7y, dispatch 462).
//
// AGENTS.md requires a candidate to include "one real accepted WASM result per numerical
// capability" and "one deliberate typed refusal". Both were `not-available` here until the browser
// probe existed, so every promotion so far has gone out without them. The probe is injected rather
// than imported (scripts/candidateBrowserProbe.ts) for two reasons: this module stays free of
// Playwright so its own tests can drive a fake probe, and a run WITHOUT a probe reports
// `not-available` and is UNDECLARED, which keeps `candidateChecksPassed` false instead of letting a
// silent browser failure read as clean.
// ---------------------------------------------------------------------------

/** One step a reader would take before pressing the apply control, as data rather than code. */
export type LabPreparation =
  | Readonly<{ kind: "open-settings-drawers" }>
  | Readonly<{ kind: "press"; name: string }>
  | Readonly<{ kind: "select"; field: string; value: string }>
  | Readonly<{ kind: "check"; labelMatches: string }>
  | Readonly<{ kind: "fill"; field: string; value: string }>;

/** Which laboratory earns a capability's label, and what a reader does to make it earn one. */
export type WasmCapabilityTarget = Readonly<{
  capabilityId: string;
  browserExport: string;
  lab: string;
  prepare: readonly LabPreparation[];
  apply: string;
  why: string;
}>;

export type AcceptedWasmObservation = Readonly<{
  capabilityId: string;
  lab: string;
  /** Every `data-execution-label` value on arrival, before the reader's action. */
  labelsBefore: readonly string[];
  labelsAfter: readonly string[];
  /** The public wordings rendered after the action, which is what a reader actually reads. */
  labelTexts: readonly string[];
  wasmRequests: readonly string[];
  pageErrors: readonly string[];
}>;

export type RefusalTarget = Readonly<{
  lab: string;
  prepare: readonly LabPreparation[];
  apply: string;
  expectedCode: string;
  /** Fragments the reader's own sentence must contain, so a bare code cannot pass for an explanation. */
  mustSay: readonly string[];
  why: string;
}>;

export type RefusalObservation = Readonly<{
  lab: string;
  codes: readonly string[];
  readerText: string;
  nonFiniteTokens: readonly string[];
  pageErrors: readonly string[];
}>;

export type CandidateBrowserProbe = Readonly<{
  observeAcceptedWasm: (target: WasmCapabilityTarget) => Promise<AcceptedWasmObservation>;
  provokeRefusal: (target: RefusalTarget) => Promise<RefusalObservation>;
  close: () => Promise<void>;
}>;

/**
 * One row per capability the artifact manifest declares, each naming the laboratory that binds it.
 *
 * MEASURED, NOT READ OFF THE PLAN. AGENTS.md's status section says `diffusion1d_frames` and
 * `philox_normals` are "built into the artifact and bound to no lab yet". That was true when it was
 * written and is not true now: driven against the built export on 2026-09-28, BM-05 under the
 * Gaussian step law and BM-06 with its optional grid enabled both reach
 * "Ideal model, computed with FrankenSim". All three capabilities therefore have a binding, and the
 * check below has no not-applicable row. When a future capability has none, its row states that
 * reason and the check reports `not-applicable` for it rather than passing over it.
 */
export const WASM_CAPABILITY_TARGETS: readonly WasmCapabilityTarget[] = Object.freeze([
  Object.freeze({
    capabilityId: "diffusion.brownian-frames",
    browserExport: "brownian_frames",
    lab: "bm-01",
    prepare: Object.freeze([Object.freeze({ kind: "open-settings-drawers" as const })]),
    apply: "Apply trial settings",
    why: "BM-01's tracer trajectories are recorded by brownian_frames; its apply control sits inside the settings drawer.",
  }),
  Object.freeze({
    capabilityId: "diffusion.philox-normals",
    browserExport: "philox_normals",
    lab: "bm-05",
    prepare: Object.freeze([
      Object.freeze({ kind: "select" as const, field: "kernel", value: "gaussian" }),
    ]),
    apply: "Apply walk settings",
    why: "Only a Gaussian step law draws normals, so the coin and uniform walks are host calculations by design and the step law has to be chosen first.",
  }),
  Object.freeze({
    capabilityId: "diffusion.ftcs-1d",
    browserExport: "diffusion1d_frames",
    lab: "bm-06",
    prepare: Object.freeze([
      Object.freeze({ kind: "open-settings-drawers" as const }),
      Object.freeze({ kind: "check" as const, labelMatches: "numerical grid" }),
    ]),
    apply: "Apply settings",
    why: "BM-06's primary output is the analytic density, always a host calculation; the optional grid beside it is stepped by diffusion1d_frames and carries its own label.",
  }),
]);

/**
 * The refusal this check provokes, through a reader's own control rather than a hand-built request.
 *
 * BM-06 offers a preset named "Try a step that is too large", so the deliberate refusal is two
 * presses a reader can make. The FTCS scheme is stable only to a diffusion number of 0.5 and refuses
 * above it; measured on the built export the refusal arrives as `ftcs-unstable` with a sentence
 * naming the number it reached, the limit, which stepper refused, and two repairs.
 */
export const DELIBERATE_REFUSAL_TARGET: RefusalTarget = Object.freeze({
  lab: "bm-06",
  prepare: Object.freeze([
    Object.freeze({ kind: "press" as const, name: "Try a step that is too large" }),
  ]),
  apply: "Apply settings",
  expectedCode: "ftcs-unstable",
  mustSay: Object.freeze(["not accepted", "diffusion number", "stable only up to"]),
  why: "The explicit diffusion scheme refuses above a diffusion number of 0.5 by design, so this is a real model boundary rather than an error injected for the check.",
});

type DeployedCapability = Readonly<{ capabilityId: string; browserExport: string }>;

/**
 * The capability list comes from the manifest THE DEPLOYMENT SERVES, not from the repository, so the
 * denominator belongs to the thing being checked. A manifest that is missing, unparseable or empty
 * is a failure of the check rather than an empty pass: zero capabilities examined reads exactly like
 * three examined and found good.
 */
export async function deployedWasmCapabilities(
  fetcher: Fetcher,
): Promise<{ capabilities: DeployedCapability[]; problem?: string }> {
  const fetched = await fetcher("/wasm/manifest.json");
  if (fetched.status !== 200)
    return { capabilities: [], problem: `/wasm/manifest.json answered ${fetched.status}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(fetched.body.toString("utf8"));
  } catch (error) {
    return { capabilities: [], problem: `/wasm/manifest.json is not JSON: ${String(error)}` };
  }
  const raw = (parsed as { capabilities?: unknown }).capabilities;
  if (!Array.isArray(raw))
    return { capabilities: [], problem: "/wasm/manifest.json declares no capabilities array" };
  const capabilities: DeployedCapability[] = [];
  for (const entry of raw) {
    const record = entry as { capabilityId?: unknown; browserExport?: unknown };
    if (typeof record.capabilityId !== "string" || typeof record.browserExport !== "string")
      return { capabilities: [], problem: "a manifest capability has no id or no browser export" };
    capabilities.push({ capabilityId: record.capabilityId, browserExport: record.browserExport });
  }
  if (capabilities.length === 0)
    return { capabilities: [], problem: "the served manifest declares zero capabilities" };
  return { capabilities };
}

/**
 * One real accepted result per numerical capability.
 *
 * WHAT IT ASSERTS, AND WHY IT IS NOT THE NETWORK REQUEST. For each capability the deployed manifest
 * declares: no `frankensim` label is present on arrival, and one appears after the reader's action,
 * with the public wording beside it. A fetched artifact that produces a host calculation therefore
 * FAILS, which is the measured negative: BM-05 on its default coin walk fetches the same artifact,
 * with a 200, and stays "Ideal model, host calculation".
 */
export async function acceptedWasmResultPerCapability(
  fetcher: Fetcher,
  probe: CandidateBrowserProbe | undefined,
  targets: readonly WasmCapabilityTarget[] = WASM_CAPABILITY_TARGETS,
): Promise<CandidateCheckResult> {
  const name = "accepted-wasm-result-per-capability";
  const { capabilities, problem } = await deployedWasmCapabilities(fetcher);
  if (problem !== undefined)
    return { name, status: "failed", detail: `No capability could be examined: ${problem}.` };
  if (probe === undefined)
    return notRun(
      name,
      `This run supplied no browser probe, so none of the ${capabilities.length} declared capabilities was driven. An accepted result is produced by a lab's worker, so nothing here can be concluded from the served bytes alone.`,
    );

  const byId = new Map(targets.map((target) => [target.capabilityId, target]));
  const unbound = capabilities.filter((capability) => !byId.has(capability.capabilityId));
  const stale = targets.filter(
    (target) => !capabilities.some((c) => c.capabilityId === target.capabilityId),
  );
  if (unbound.length > 0 || stale.length > 0) {
    const parts = [
      unbound.length > 0
        ? `${unbound.length} served capability(ies) have no target row: ${unbound.map((c) => c.capabilityId).join(", ")}`
        : "",
      stale.length > 0
        ? `${stale.length} target row(s) name a capability the deployment does not declare: ${stale.map((t) => t.capabilityId).join(", ")}`
        : "",
    ].filter((part) => part.length > 0);
    return {
      name,
      status: "failed",
      detail: `The capability list and the target rows disagree, so the denominator is unknown. ${parts.join("; ")}. Add or remove a row in WASM_CAPABILITY_TARGETS rather than letting a capability go unexamined.`,
    };
  }

  const lines: string[] = [];
  const failures: string[] = [];
  for (const capability of capabilities) {
    const target = byId.get(capability.capabilityId);
    if (target === undefined) continue;
    if (target.browserExport !== capability.browserExport) {
      failures.push(
        `${capability.capabilityId}: the deployment declares export ${capability.browserExport} where the target row names ${target.browserExport}`,
      );
      continue;
    }
    const observed = await probe.observeAcceptedWasm(target);
    const earnedBefore = observed.labelsBefore.filter((label) => label === "frankensim").length;
    const earnedAfter = observed.labelsAfter.filter((label) => label === "frankensim").length;
    const wording = observed.labelTexts.includes("Ideal model, computed with FrankenSim");
    lines.push(
      `${capability.capabilityId} (${capability.browserExport}) on ${target.lab}: labels on arrival [${[...new Set(observed.labelsBefore)].join(",") || "none"}] then [${[...new Set(observed.labelsAfter)].join(",") || "none"}]; ${observed.wasmRequests.length} wasm request(s); wording ${wording ? "present" : "absent"}`,
    );
    if (observed.pageErrors.length > 0)
      failures.push(`${capability.capabilityId}: ${observed.pageErrors.join(" | ")}`);
    else if (earnedBefore > 0)
      failures.push(
        `${capability.capabilityId}: a frankensim label was already present on arrival, so it was not earned by an accepted call`,
      );
    else if (earnedAfter === 0)
      failures.push(
        `${capability.capabilityId}: ${observed.wasmRequests.length} wasm request(s) were made and no frankensim label appeared, so no accepted result was produced`,
      );
    else if (!wording)
      failures.push(
        `${capability.capabilityId}: the label attribute says frankensim but no reader-facing wording says so`,
      );
  }

  const examined = `Examined ${capabilities.length} declared capability(ies): ${lines.join(" — ")}.`;
  if (failures.length > 0)
    return {
      name,
      status: "failed",
      detail: `${failures.length} of ${capabilities.length} capability(ies) produced no accepted FrankenSim result: ${failures.join(" | ")}. ${examined}`,
    };
  return {
    name,
    status: "passed",
    detail: `${capabilities.length} of ${capabilities.length} declared capability(ies) produced an accepted FrankenSim result on the deployed assets, each earned by a reader's action rather than by a loaded artifact. ${examined} This proves the owner answered, not that its physics is right.`,
  };
}

/**
 * One deliberate typed refusal a reader can read.
 *
 * Asserts the code arrived, that the reader's sentence explains it, and that nothing in the page
 * shows `NaN` or `Infinity` in its place. A refusal that produced no sentence, or a page that
 * quietly showed a number instead, both fail.
 */
export async function deliberateTypedRefusal(
  probe: CandidateBrowserProbe | undefined,
  target: RefusalTarget = DELIBERATE_REFUSAL_TARGET,
): Promise<CandidateCheckResult> {
  const name = "deliberate-typed-refusal";
  if (probe === undefined)
    return notRun(
      name,
      `This run supplied no browser probe, so no refusal was provoked. The intended one is ${target.lab}'s ${target.expectedCode}, reached through its own "${target.prepare.map((step) => (step.kind === "press" ? step.name : step.kind)).join(", ")}" control.`,
    );
  const observed = await probe.provokeRefusal(target);
  const missing = target.mustSay.filter(
    (fragment) => !observed.readerText.toLowerCase().includes(fragment.toLowerCase()),
  );
  const examined = `Drove ${target.lab} to its declared refusal: codes [${observed.codes.join(",") || "none"}]; reader sentence ${observed.readerText.length} characters; nonfinite tokens [${observed.nonFiniteTokens.join(",") || "none"}].`;
  const failures: string[] = [];
  if (observed.pageErrors.length > 0) failures.push(observed.pageErrors.join(" | "));
  if (!observed.codes.includes(target.expectedCode))
    failures.push(
      `no element carried data-refusal-code="${target.expectedCode}", so nothing typed refused`,
    );
  if (observed.readerText.length === 0)
    failures.push("the refusal carried no reader-facing sentence at all");
  else if (missing.length > 0)
    failures.push(
      `the reader's sentence does not say ${missing.map((fragment) => `"${fragment}"`).join(", ")}`,
    );
  if (observed.nonFiniteTokens.length > 0)
    failures.push(
      `the page shows ${observed.nonFiniteTokens.join(" and ")} where a value would be`,
    );
  if (failures.length > 0)
    return { name, status: "failed", detail: `${failures.join(" | ")}. ${examined}` };
  return {
    name,
    status: "passed",
    detail: `${target.lab} refused a deliberately illegal step as the typed ${target.expectedCode}, with a sentence a reader can read and no NaN, Infinity or silent clamp. ${examined} ${target.why}`,
  };
}

export type CandidateCheckOptions = Readonly<{
  fetcher: Fetcher;
  staticDir: string;
  /** Repository root, for the frozen manifest ids the no-JavaScript check looks for. */
  root?: string;
  /**
   * A browser driving the deployment's own bytes, for the two checks that cannot be answered over
   * HTTP. Omitting it does not excuse them: both report `not-available`, neither is declared, and
   * `allCandidateChecksPassed` is therefore false, so a release cannot promote on a silent browser.
   */
  probe?: CandidateBrowserProbe | undefined;
}>;

/** Runs every check once, in catalogue order. A check that cannot run says why; none passes by default. */
export async function runCandidateChecksAgainst(
  options: CandidateCheckOptions,
): Promise<CandidateCheckResult[]> {
  const { fetcher, staticDir } = options;
  const root = options.root ?? process.cwd();
  const routes = candidateRoutes(staticDir);
  const results: CandidateCheckResult[] = [];

  results.push(await fourCompletePaperTexts(fetcher, staticDir, root));

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

  results.push(await acceptedWasmResultPerCapability(fetcher, options.probe));
  results.push(await deliberateTypedRefusal(options.probe));
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
  // ANCHORED, because the bare substring is not the attribute. Measured on the built export:
  // `id="s0-p2"` occurs three times inside this page's <main> and only one is an anchor; the other
  // two are `data-block-id="s0-p2"`. Until dispatch 474 this line was `main.includes('id="' + id +
  // '"')`, which the data attributes alone satisfy, so it would have passed on a page that had lost
  // every anchor a no-script reader's fragment link needs. Same rule as AGENTS.md's "A Count Used
  // As Evidence Is Anchored": an unanchored pattern fails toward whatever text sits near the thing
  // being measured.
  const missing = ids.filter((id) => !anchorsId(main, id));
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
 * THE MAP IS NOW EMPTY, and it held three entries two dispatches ago. All three were implemented
 * rather than re-argued: `accepted-wasm-result-per-capability` and `deliberate-typed-refusal` by the
 * browser probe (dispatch 462), and `four-complete-paper-texts` by asking the deployment for the
 * compiled corpus instead of waiting for an editorially complete edition (dispatch 474). Each
 * declaration was removed in the same commit that implemented its check, which is what
 * `staleNotRunnableDeclarations` exists to force.
 *
 * AN EMPTY MAP IS NOT A DEAD MECHANISM. Every check in the catalogue runs today, so any
 * `not-available` result is now UNDECLARED and blocks a promotion, which is the strictest the
 * predicate has ever been. The three functions below take the declarations as a parameter so both
 * branches stay tested while nothing in production is declared.
 */
export const DECLARED_NOT_RUNNABLE: ReadonlyMap<string, { reason: string; bead: string }> = new Map(
  [],
);

/**
 * Checks that did not run and are not declared above: the ones that must block a promotion, because
 * nobody has said why they are silent.
 */
export type NotRunnableDeclarations = ReadonlyMap<string, { reason: string; bead: string }>;

/*
 * WHY THESE THREE TAKE THE DECLARATIONS AS AN ARGUMENT (dispatch 474). DECLARED_NOT_RUNNABLE is now
 * EMPTY, and a predicate that reads an empty module constant cannot be tested for the behaviour that
 * matters: that a DECLARED silence is tolerated and an UNDECLARED one is not. With the map empty,
 * every test of the declared branch would pass vacuously, and the machinery would quietly stop being
 * guarded at exactly the moment nothing in production exercises it -- which is AGENTS.md's "a gate's
 * own test must not live only in the lane that gate controls". Production callers pass nothing and
 * get the real map; the tests pass a synthetic one and keep both branches alive for the next check
 * that goes silent.
 */
export function undeclaredNotRunnable(
  results: readonly CandidateCheckResult[],
  declarations: NotRunnableDeclarations = DECLARED_NOT_RUNNABLE,
): CandidateCheckResult[] {
  return results.filter((r) => r.status === "not-available" && !declarations.has(r.name));
}

/** Declarations for checks that now pass, or that are not in the catalogue at all: remove them. */
export function staleNotRunnableDeclarations(
  results: readonly CandidateCheckResult[],
  declarations: NotRunnableDeclarations = DECLARED_NOT_RUNNABLE,
): string[] {
  const byName = new Map(results.map((r) => [r.name, r.status]));
  return [...declarations.keys()].filter((name) => byName.get(name) !== "not-available").sort();
}

/**
 * True when every check either passed or is a DECLARED not-runnable one. A failure is still a
 * failure, an undeclared silence is still a failure, and an empty result set is never a pass.
 */
export function allCandidateChecksPassed(
  results: readonly CandidateCheckResult[],
  declarations: NotRunnableDeclarations = DECLARED_NOT_RUNNABLE,
): boolean {
  if (results.length === 0) return false;
  if (results.some((r) => r.status === "failed")) return false;
  if (undeclaredNotRunnable(results, declarations).length > 0) return false;
  return results.some((r) => r.status === "passed");
}
