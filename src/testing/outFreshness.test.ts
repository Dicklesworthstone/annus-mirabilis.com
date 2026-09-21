import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkOutFreshness, type GitRunner } from "./outFreshness.ts";

/**
 * am-6v4k, the 2026-09-21 correction. I wrote checkOutFreshness to treat a dirty working tree as
 * staleness, scripts/run-node-only-tests.ts refused to start on it, and because four agents in a
 * shared tree ALWAYS have uncommitted work the condition was permanently true. The node lane did
 * not run for 49 commits and 48 test files went unwatched, while the refusal text read like the
 * strictest thing in the repo.
 *
 * Two assertions of opposite sign, neither worth anything alone:
 *
 *   SATISFIABILITY  a dirty working tree must NOT make out/ stale, or the gate is an off switch.
 *   THE PAWL        out/ genuinely stale against its own build MUST still fail, or the repair is a
 *                   deletion of the check wearing a rationale.
 *
 * PROOF CLASS, stated rather than implied. The filesystem here is real - a real temp directory, a
 * real out/search/index-manifest.json, a real generated/content tree - and the code under test is
 * the real function. Git is SCRIPTED, because `bun test` cannot spawn a subprocess on this host
 * (EBADF; it is why bunfig.toml has a node lane) and a real-git fixture could therefore only run
 * in the very lane this function gates. The scripted answers are not invented: they are the
 * verbatim output of the same commands run against a real fixture repository. Calibrated
 * 2026-09-21 against `git init` plus one commit, and every shape below is what real git returned:
 *
 *   git log -1 --format=%ct HEAD                 -> 1790000973          (bare epoch seconds)
 *   git rev-parse HEAD                           -> f61c84c8102fb72…    (40 hex)
 *   git log -1 --before=<outMtime+5s> --format=%H -> the same sha       (so buildCommit == HEAD
 *                                                                        and the committed-diff
 *                                                                        branch is skipped)
 *   git diff --name-only HEAD -- src/app …       -> "src/app/page.tsx\nsrc/components/Reader.tsx\n"
 *   git rev-list --count HEAD..HEAD              -> "0"
 *
 * The real-git version of this file is outFreshness.fixture.test.ts, in the node lane.
 */

const DIGEST = "aaaaaaaaaaaabbbbbbbbbbbbccccccccccccdddddddddddd";
const UNADMITTED_DIGEST = "ffffffffffffeeeeeeeeeeee0000000011111111deadbeef";
const HEAD_SHA = "4f1c2d3e5a6b7c8d9e0f1a2b3c4d5e6f70819293";

/**
 * Answers copied from a real fixture repo, `git init` + one commit, observed 2026-09-21. The
 * shapes that matter: `%ct` is bare epoch seconds, `rev-parse` is a 40-hex sha, `log -1 --before`
 * returns HEAD when nothing has been committed since out/ was written, and `diff --name-only`
 * returns newline-separated repo-relative paths with no trailing newline after trimming.
 */
function scriptedGit(dirty: readonly string[], nowSec: number): GitRunner {
  return (args: readonly string[]): string => {
    const key = args.join(" ");
    if (key === "log -1 --format=%ct HEAD") return String(nowSec);
    if (key === "rev-parse HEAD") return HEAD_SHA;
    if (args[0] === "log" && args.includes("--format=%H")) return HEAD_SHA;
    if (args[0] === "diff" && args[1] === "--name-only") return dirty.join("\n");
    if (args[0] === "log") return "";
    if (args[0] === "rev-list") return "0";
    throw new Error(`fixture git was asked something it was not calibrated for: ${key}`);
  };
}

/** A real out/ and a real admitted content build on disk. Only git is scripted. */
function makeFixture(options: { manifestDigest?: string } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "out-freshness-"));
  mkdirSync(join(root, "generated/content", DIGEST), { recursive: true });
  writeFileSync(
    join(root, "generated/content/index.json"),
    JSON.stringify({ buildDigest: DIGEST }),
  );
  mkdirSync(join(root, "out/search"), { recursive: true });
  writeFileSync(
    join(root, "out/search/index-manifest.json"),
    JSON.stringify({ buildDigest: options.manifestDigest ?? DIGEST }),
  );
  writeFileSync(join(root, "out/index.html"), "<!doctype html><title>fixture</title>\n");
  return root;
}

const nowSec = () => Math.floor(Date.now() / 1000);

describe("a dirty working tree is reported, not called staleness", () => {
  test("THE CONTROL: a clean tree is fresh, so the fixture can tell the two states apart", () => {
    const result = checkOutFreshness("out", makeFixture(), scriptedGit([], nowSec()));
    expect(result.present).toBe(true);
    expect(result.fresh).toBe(true);
    expect(result.dirtyStaticSources).toEqual([]);
  });

  test("the case that switched the lane off: dirty static sources stay FRESH and are named", () => {
    const result = checkOutFreshness(
      "out",
      makeFixture(),
      scriptedGit(["src/app/lab/bm-01/page.tsx"], nowSec()),
    );
    // Before today this was fresh:false, reason "Uncommitted modifications in static source
    // files: ...", and that one boolean is what stopped 48 test files for 49 commits.
    expect(result.fresh).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.dirtyStaticSources).toEqual(["src/app/lab/bm-01/page.tsx"]);
  });

  test("every dirty file is named, not the first three", () => {
    const dirty = [
      "src/app/lab/avogadro-lab/page.tsx",
      "src/components/lab/DriftDiffusionLab.tsx",
      "src/components/discover/InvestigationTransfer.tsx",
      "src/components/lab/lq06/CoefficientMatchEntry.tsx",
      "content/experiments/bm-01.yaml",
    ];
    const result = checkOutFreshness("out", makeFixture(), scriptedGit(dirty, nowSec()));
    expect(result.fresh).toBe(true);
    // The old message sliced to three. A truncated list hides the file the reader came to find,
    // and a bare count cannot be acted on at all.
    expect(result.dirtyStaticSources).toEqual(dirty);
  });
});

describe("THE PAWL: the half that still fails", () => {
  /**
   * Without this, "repair the off switch" and "delete the check" would produce the same green. The
   * distinguishing fault is real: out/ recording a content build that is not on disk, which is what
   * a stale out/ against a rebuilt corpus looks like.
   */
  test("out/ recording an unadmitted buildDigest is still STALE, dirty tree or not", () => {
    const root = makeFixture({ manifestDigest: UNADMITTED_DIGEST });
    const clean = checkOutFreshness("out", root, scriptedGit([], nowSec()));
    expect(clean.present).toBe(true);
    expect(clean.fresh).toBe(false);
    expect(clean.reason).toContain("is not present in generated/content/");

    // and a dirty tree neither rescues nor worsens it: the two conditions are now independent
    const dirty = checkOutFreshness("out", root, scriptedGit(["src/app/page.tsx"], nowSec()));
    expect(dirty.fresh).toBe(false);
  });

  test("out/ built more than two hours before HEAD is still STALE with a clean tree", () => {
    const threeHoursOn = nowSec() + 3 * 60 * 60;
    const result = checkOutFreshness("out", makeFixture(), scriptedGit([], threeHoursOn));
    expect(result.fresh).toBe(false);
    expect(result.reason).toContain("more than 2 hours older");
  });

  test("an absent out/ is still present:false, so a clean checkout skips rather than fails", () => {
    const result = checkOutFreshness("out-never-built", makeFixture(), scriptedGit([], nowSec()));
    expect(result.present).toBe(false);
    expect(result.reason).toContain("Directory not found");
  });
});
