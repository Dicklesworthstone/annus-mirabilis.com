import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface OutFreshnessResult {
  readonly present: boolean;
  readonly fresh: boolean;
  readonly reason?: string | undefined;
  readonly buildDigest?: string | undefined;
  readonly expectedDigest?: string | undefined;
  readonly outMtimeMs?: number | undefined;
  readonly headCommitMs?: number | undefined;
  /**
   * Static sources modified in the WORKING TREE since the last commit, and therefore not in
   * out/. Reported, never a staleness verdict: see the note on the working-tree probe below for
   * why this stopped being a failure on 2026-09-21.
   */
  readonly dirtyStaticSources?: readonly string[] | undefined;
}

/**
 * Maximum admitted time lag (in milliseconds) between out/ build and HEAD commit
 * before out/ is considered stale by temporal backstop.
 * 2 hours = 7,200,000 ms. (The regression outage was 3 hours / 409 commits stale).
 */
const MAX_BUILD_AGE_VS_HEAD_MS = 2 * 60 * 60 * 1000;

/**
 * Maximum admitted commit count difference between the build commit and HEAD.
 * 50 commits. (The regression outage was 409 commits stale).
 */
const MAX_COMMITS_SINCE_BUILD = 50;

/**
 * How this module reaches git. Injectable for ONE reason, recorded because it looks like
 * over-engineering: the test that proves this file is not an off switch must not itself stop
 * running when this file switches something off. A fixture built with real `git` spawns a
 * subprocess, `bun test` cannot spawn on this host (EBADF, the reason bunfig has a node lane at
 * all), so that test can only live in the node lane - the lane whose preflight calls this
 * function. The scripted runner breaks the circle; the real-git fixture still exists beside it in
 * outFreshness.fixture.test.ts for the higher proof class.
 *
 * Returns trimmed stdout. Throws exactly as execFileSync does when git is absent or fails.
 */
export type GitRunner = (args: readonly string[]) => string;

function defaultGitRunner(baseDir: string): GitRunner {
  return (args: readonly string[]) =>
    execFileSync("git", [...args], {
      cwd: baseDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
}

/**
 * Checks whether the static export directory (typically `out/`) exists and is fresh
 * against the current repository state (HEAD commit and build digests).
 *
 * Requirements:
 * 1. If out/ is absent, reports present=false so tests can honestly skip.
 * 2. If out/ is present, checks whether it is fresh:
 *    a. Preferred: checks out/ recorded buildDigest (from search/index-manifest.json).
 *       - Must be present in generated/content/<buildDigest> (admitted content build).
 *       - If mismatched from generated/content/index.json, checks whether content/ or static sources
 *         changed in git since out/ build. If modified, out/ is stale.
 *    b. Fallback when no buildDigest is recorded: compares out/ mtime against git HEAD commit
 *       timestamp (mtime must not predate HEAD).
 *    c. Checks whether static-site sources (src/app, src/components, content) were COMMITTED
 *       since the commit out/ was built from. Working-tree modifications are a separate,
 *       reported state (`dirtyStaticSources`) and are NOT staleness; see the probe below.
 *    d. Temporal backstop: Even with a matching buildDigest, out/ cannot be older than 2 hours.
 * 3. Refuses stale builds so static tests never silently report green against an outdated site.
 */
export function checkOutFreshness(
  rootDir: string = "out",
  baseDir: string = process.cwd(),
  gitRunner?: GitRunner,
): OutFreshnessResult {
  const git = gitRunner ?? defaultGitRunner(baseDir);
  const targetDir = resolve(baseDir, rootDir);
  if (!existsSync(targetDir)) {
    return { present: false, fresh: false, reason: `Directory not found: ${rootDir}` };
  }

  try {
    const dirStat = statSync(targetDir);
    if (!dirStat.isDirectory()) {
      return { present: false, fresh: false, reason: `Target path is not a directory: ${rootDir}` };
    }
  } catch (err) {
    return {
      present: false,
      fresh: false,
      reason: `Cannot stat directory: ${rootDir} (${String(err)})`,
    };
  }

  // Determine out/ mtime
  let outMtimeMs = statSync(targetDir).mtimeMs;
  const indexPath = resolve(targetDir, "index.html");
  if (existsSync(indexPath)) {
    try {
      outMtimeMs = Math.max(outMtimeMs, statSync(indexPath).mtimeMs);
    } catch {
      // Ignore
    }
  }

  // Read git HEAD commit timestamp and hash
  let headCommitMs: number | undefined;
  let headCommitSha: string | undefined;
  try {
    const headCommitSec = parseInt(git(["log", "-1", "--format=%ct", "HEAD"]), 10);
    if (Number.isFinite(headCommitSec)) {
      headCommitMs = headCommitSec * 1000;
    }
    headCommitSha = git(["rev-parse", "HEAD"]);
  } catch {
    // Git not available in this environment
  }

  // 1. Check recorded buildDigest in out/ (preferred over mtime)
  let outBuildDigest: string | null = null;
  const searchManifestPath = resolve(targetDir, "search/index-manifest.json");
  if (existsSync(searchManifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(searchManifestPath, "utf8"));
      if (typeof manifest.buildDigest === "string" && manifest.buildDigest.length > 0) {
        outBuildDigest = manifest.buildDigest;
      }
    } catch {
      // Ignored: malformed or unreadable search manifest
    }
  }

  // Check expected buildDigest in current generated/content/index.json
  let currentBuildDigest: string | null = null;
  const contentIndexPath = resolve(baseDir, "generated/content/index.json");
  if (existsSync(contentIndexPath)) {
    try {
      const contentIndex = JSON.parse(readFileSync(contentIndexPath, "utf8"));
      if (typeof contentIndex.buildDigest === "string" && contentIndex.buildDigest.length > 0) {
        currentBuildDigest = contentIndex.buildDigest;
      }
    } catch {
      // Ignored: malformed or unreadable content index
    }
  }

  if (outBuildDigest !== null) {
    // a. The recorded buildDigest MUST exist as an admitted build in generated/content/
    const admittedContentDir = resolve(baseDir, "generated/content", outBuildDigest);
    if (!existsSync(admittedContentDir)) {
      return {
        present: true,
        fresh: false,
        buildDigest: outBuildDigest,
        expectedDigest: currentBuildDigest ?? undefined,
        reason: `Recorded buildDigest in ${rootDir}/search/index-manifest.json (${outBuildDigest.slice(0, 12)}…) is not present in generated/content/`,
      };
    }

    // b. If outBuildDigest !== currentBuildDigest, check if content changed since build
    if (currentBuildDigest !== null && outBuildDigest !== currentBuildDigest) {
      try {
        const outMtimeSec = Math.floor(outMtimeMs / 1000) - 2;
        const contentLog = git(["log", `--since=${outMtimeSec}`, "--oneline", "--", "content"]);
        if (contentLog.length > 0) {
          return {
            present: true,
            fresh: false,
            buildDigest: outBuildDigest,
            expectedDigest: currentBuildDigest,
            reason: `Recorded buildDigest in ${rootDir}/search/index-manifest.json (${outBuildDigest.slice(0, 12)}…) differs from current index (${currentBuildDigest.slice(0, 12)}…) and content/ has been committed since build: ${contentLog}`,
          };
        }
      } catch {
        // Fallback: strict digest mismatch if git cannot verify
        return {
          present: true,
          fresh: false,
          buildDigest: outBuildDigest,
          expectedDigest: currentBuildDigest,
          reason: `Recorded buildDigest in ${rootDir}/search/index-manifest.json (${outBuildDigest.slice(0, 12)}…) does not match current generated/content/index.json (${currentBuildDigest.slice(0, 12)}…)`,
        };
      }
    }
  } else {
    // Fallback when no buildDigest is available to prove content equality:
    // out/ mtime must not predate HEAD commit by more than 2 seconds (clock skew tolerance)
    if (headCommitMs !== undefined && outMtimeMs < headCommitMs - 2000) {
      return {
        present: true,
        fresh: false,
        outMtimeMs,
        headCommitMs,
        reason: `Directory ${rootDir} mtime (${new Date(outMtimeMs).toISOString()}) predates git HEAD commit (${new Date(headCommitMs).toISOString()}) without matching buildDigest`,
      };
    }
  }

  // 2. Check if static source files (src/app, src/components, content) changed in git since the build
  let dirtyStaticSources: readonly string[] = [];
  if (headCommitSha && headCommitMs !== undefined) {
    try {
      // Find commit at or immediately before out/ mtime
      const outMtimeIso = new Date(outMtimeMs + 5000).toISOString();
      const buildCommit = git(["log", "-1", `--before=${outMtimeIso}`, "--format=%H"]);

      if (buildCommit && buildCommit !== headCommitSha) {
        // Check commit count distance
        const commitCountStr = git(["rev-list", "--count", `${buildCommit}..HEAD`]);
        const commitCount = parseInt(commitCountStr, 10);
        if (Number.isFinite(commitCount) && commitCount > MAX_COMMITS_SINCE_BUILD) {
          return {
            present: true,
            fresh: false,
            buildDigest: outBuildDigest ?? undefined,
            expectedDigest: currentBuildDigest ?? undefined,
            outMtimeMs,
            headCommitMs,
            reason: `Static build in ${rootDir} is ${commitCount} commits behind HEAD (threshold: ${MAX_COMMITS_SINCE_BUILD})`,
          };
        }

        // Static site source files changed between the build commit and HEAD.
        //
        // TESTS ARE EXCLUDED BECAUSE THEY CANNOT REACH THE EXPORT (am-wkod). This pathspec
        // decided staleness on any change under src/app, src/components or content, and a
        // .test.tsx is none of the things a Next static export contains. The gate refused a build
        // that was functionally fresh: at a2295d72 the entire diff was one file,
        // src/app/your-data/page.test.tsx, and both browser gates failed in 65ms - too fast to be
        // a measurement - naming a test file as the reason out/ was stale.
        //
        // The cost was not one refused run. Four panes commit test files every few minutes and a
        // build takes about three and a half minutes, so the window in which out/ counted as
        // fresh was frequently zero, and a gate that cries stale on evidence that cannot bear on
        // staleness teaches everyone to route around it.
        //
        // The exclusion is SUBTRACTIVE and narrow on purpose. The tempting alternative - an
        // allowlist of extensions that "can be built" - is the denylist-for-allowlist trade this
        // repository has got wrong before, and here it would fail silently: a production file
        // whose extension nobody thought of would be dropped from the check and out/ would look
        // fresh when it was not. Subtracting two unambiguous patterns can only ever fail the
        // other way, by refusing too much.
        const diffFiles = git([
          "diff",
          "--name-only",
          `${buildCommit}..HEAD`,
          "--",
          "src/app",
          "src/components",
          "content",
          ":(exclude)**/*.test.*",
          ":(exclude)**/*.spec.*",
        ]);

        if (diffFiles.length > 0) {
          const files = diffFiles.split("\n").filter(Boolean);
          return {
            present: true,
            fresh: false,
            buildDigest: outBuildDigest ?? undefined,
            expectedDigest: currentBuildDigest ?? undefined,
            outMtimeMs,
            headCommitMs,
            reason: `Static source files modified since out/ build commit ${buildCommit.slice(0, 8)}: ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` (+${files.length - 3} more)` : ""}`,
          };
        }
      }

      // Static sources dirty in the WORKING TREE. Reported, not refused, and the distinction is
      // the whole of the 2026-09-21 correction to this file.
      //
      // I wrote this as a refusal and it became an off switch. In a four-pane shared tree four
      // agents always have uncommitted work, so this condition is permanently true, so
      // scripts/run-node-only-tests.ts refused to start for 49 commits and 48 test files stopped
      // running - while the refusal text read like diligence. A condition that cannot be false is
      // not a strict gate. It is the same error as a check that passes over an empty population,
      // one step further along: this one never executed at all.
      //
      // The two facts it used to conflate:
      //   out/ stale against the commit it was BUILT from -> a real fault, fixed by rebuilding,
      //                                                      and still a failure everywhere above.
      //   a peer has an unsaved edit to a page component  -> a fact about someone else's in-flight
      //                                                      work. It says nothing about whether
      //                                                      out/ matches its own build.
      //
      // The accepted residual risk, recorded by the orchestrator on am-6v4k rather than left for a
      // later reader to rediscover as a defect: a green now means "the built artefact passes", not
      // "the working tree passes". That is what a lane over a build directory can honestly claim
      // anyway. Callers report these names; they never suppress them.
      const uncommitted = git([
        "diff",
        "--name-only",
        "HEAD",
        "--",
        "src/app",
        "src/components",
        "content",
      ]);
      if (uncommitted.length > 0) {
        dirtyStaticSources = uncommitted.split("\n").filter(Boolean);
      }
    } catch {
      // Git command failed; fall through to temporal backstop
    }
  }

  // 3. Temporal backstop: Even with an admitted build digest, out/ cannot be older than MAX_BUILD_AGE_VS_HEAD_MS (2 hours)
  if (headCommitMs !== undefined && outMtimeMs < headCommitMs - MAX_BUILD_AGE_VS_HEAD_MS) {
    return {
      present: true,
      fresh: false,
      buildDigest: outBuildDigest ?? undefined,
      expectedDigest: currentBuildDigest ?? undefined,
      outMtimeMs,
      headCommitMs,
      reason: `Directory ${rootDir} mtime (${new Date(outMtimeMs).toISOString()}) is more than 2 hours older than git HEAD commit (${new Date(headCommitMs).toISOString()})`,
      dirtyStaticSources,
    };
  }

  return {
    present: true,
    fresh: true,
    buildDigest: outBuildDigest ?? undefined,
    expectedDigest: currentBuildDigest ?? undefined,
    outMtimeMs,
    headCommitMs,
    dirtyStaticSources,
  };
}

/**
 * Asserts that the target directory exists and is fresh.
 * Throws an AssertionError if stale or absent.
 */
export function assertOutFreshness(
  rootDir: string = "out",
  baseDir: string = process.cwd(),
): OutFreshnessResult {
  const result = checkOutFreshness(rootDir, baseDir);
  assert.ok(
    result.present,
    `Expected static build directory "${rootDir}" to be present: ${result.reason}`,
  );
  assert.ok(result.fresh, `Static build directory "${rootDir}" is STALE: ${result.reason}`);
  return result;
}
