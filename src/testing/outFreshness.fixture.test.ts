import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkOutFreshness } from "./outFreshness.ts";

/**
 * The real-git half of am-6v4k's evidence. outFreshness.test.ts asserts the same two facts in the
 * bun lane against a SCRIPTED git, because `bun test` cannot spawn a subprocess on this host; this
 * file builds an actual repository with an actual `git init` and an actual commit, so nothing about
 * git's output is taken on my word.
 *
 * It therefore lives in the node lane, which means it is gated by the very preflight it tests. That
 * circularity is why the scripted version exists beside it and is not redundant with it: if this
 * function ever becomes an off switch again, this file is among the first things to stop running,
 * and the bun-lane file is what will still be watching.
 *
 * Fixture directories under the system temp dir are retained, not cleaned up. AGENTS.md Rule 1 is
 * not suspended because a directory is temporary and mine.
 */

const DIGEST = "aaaaaaaaaaaabbbbbbbbbbbbccccccccccccdddddddddddd";

function makeRepoFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "out-freshness-real-"));
  // The fixture commit is backdated two minutes. out/ is then written "now", which is the real
  // ordering the preflight reasons about: a build made after the commit it was built from. Without
  // the backdating there is no commit before out/ mtime at all, `git log -1 --before` returns
  // nothing, and the committed-diff branch is skipped - a fixture that cannot reach the state the
  // last test in this file asserts.
  const twoMinutesAgo = new Date(Date.now() - 120_000).toISOString();
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: twoMinutesAgo,
        GIT_COMMITTER_DATE: twoMinutesAgo,
      },
    });

  git("init", "-q");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "Fixture");
  git("config", "commit.gpgsign", "false");

  mkdirSync(join(root, "src/app"), { recursive: true });
  mkdirSync(join(root, "src/components"), { recursive: true });
  mkdirSync(join(root, "content"), { recursive: true });
  writeFileSync(
    join(root, "src/app/page.tsx"),
    "export default function Page() { return null; }\n",
  );
  writeFileSync(join(root, "src/components/Reader.tsx"), "export const Reader = () => null;\n");
  writeFileSync(join(root, "content/papers.json"), '{"papers":[]}\n');
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");

  mkdirSync(join(root, "generated/content", DIGEST), { recursive: true });
  writeFileSync(
    join(root, "generated/content/index.json"),
    JSON.stringify({ buildDigest: DIGEST }),
  );
  mkdirSync(join(root, "out/search"), { recursive: true });
  writeFileSync(
    join(root, "out/search/index-manifest.json"),
    JSON.stringify({ buildDigest: DIGEST }),
  );
  writeFileSync(join(root, "out/index.html"), "<!doctype html><title>fixture</title>\n");
  return root;
}

test("THE CONTROL: a real clean repo is fresh", () => {
  const result = checkOutFreshness("out", makeRepoFixture());
  assert.equal(result.present, true);
  assert.equal(result.fresh, true);
  assert.deepEqual(result.dirtyStaticSources, []);
});

test("real uncommitted edits stay FRESH and are named, with real git diff output", () => {
  const root = makeRepoFixture();
  writeFileSync(join(root, "src/app/page.tsx"), "export default function Page() { return 1; }\n");
  writeFileSync(join(root, "src/components/Reader.tsx"), "export const Reader = () => 1;\n");
  writeFileSync(join(root, "content/papers.json"), '{"papers":[1]}\n');

  const result = checkOutFreshness("out", root);
  // The exact state of the shared tree on 2026-09-21, reproduced: three dirty static sources.
  // Before today this returned fresh:false and the node lane refused to start on it.
  assert.equal(result.fresh, true, `expected fresh, got stale: ${result.reason}`);
  assert.equal(result.reason, undefined);
  assert.deepEqual([...(result.dirtyStaticSources ?? [])].sort(), [
    "content/papers.json",
    "src/app/page.tsx",
    "src/components/Reader.tsx",
  ]);
});

test("THE PAWL: a real repo whose out/ records an unadmitted build is still STALE", () => {
  const root = makeRepoFixture();
  writeFileSync(
    join(root, "out/search/index-manifest.json"),
    JSON.stringify({ buildDigest: "ffffffffffffeeeeeeeeeeee0000000011111111deadbeef" }),
  );
  const result = checkOutFreshness("out", root);
  assert.equal(result.fresh, false);
  assert.match(result.reason ?? "", /is not present in generated\/content\//);
});

test("THE PAWL: a real commit touching src/app after the build makes out/ STALE", () => {
  const root = makeRepoFixture();
  const gitNow = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

  // out/ is aged sixty seconds so the commit below genuinely lands AFTER the build. Without this
  // the test passes vacuously and I nearly recorded it as one: checkOutFreshness looks for the
  // last commit before out/ mtime plus a five-second clock-skew tolerance, so a commit made
  // within five seconds of the build is attributed to the build and the whole committed-diff
  // branch is skipped. That tolerance is deliberate and errs toward not-stale; a fixture fast
  // enough to fall inside it was measuring nothing.
  const aged = new Date(Date.now() - 60_000);
  utimesSync(join(root, "out/index.html"), aged, aged);
  utimesSync(join(root, "out"), aged, aged);

  // Now the build commit really is behind HEAD and a static source differs between them. This is
  // the fault the preflight exists for, and it is satisfiable: rebuilding out/ clears it, which is
  // exactly what a dirty working tree could never do.
  writeFileSync(join(root, "src/app/page.tsx"), "export default function Page() { return 2; }\n");
  gitNow("add", "-A");
  gitNow("commit", "-q", "-m", "a committed change after the build");

  const result = checkOutFreshness("out", root);
  assert.equal(
    result.fresh,
    false,
    "a committed static-source change after the build is staleness",
  );
  assert.match(result.reason ?? "", /Static source files modified since out\/ build commit/);
  assert.match(result.reason ?? "", /src\/app\/page\.tsx/);
});

test("am-1bso: a staleness refusal reports HOW MANY static commits landed and over how long", () => {
  // A refusal that says only "stale" cannot distinguish a burst of commits from a window that
  // is never open, and the difference decides whether to rebuild now or wait. Measured over the
  // 24 hours to 2026-09-22: 68 of 404 commits touched a static source, 28% of the gaps between
  // them were under two minutes, and half fell inside two hours. The shape is the finding, so
  // the refusal carries it.
  const root = makeRepoFixture();
  const gitAt = (whenIso: string, ...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_COMMITTER_DATE: whenIso, GIT_AUTHOR_DATE: whenIso },
    });

  // out/ must sit AFTER the fixture's base commit, which makeRepoFixture backdates by two
  // minutes, or there is no commit before out/ at all and the committed-diff branch is skipped.
  // A first draft of this arm aged out/ by ten minutes, landing before the base commit, and the
  // gate reported FRESH - the fixture never reached the state it was asserting about.
  const aged = new Date(Date.now() - 90_000);
  utimesSync(join(root, "out/index.html"), aged, aged);
  utimesSync(join(root, "out"), aged, aged);

  // Two static-source commits 30s apart, both AFTER out/'s mtime. The offsets are computed
  // from that mtime rather than pinned to a wall-clock string: the build commit is whichever
  // commit last precedes out/, so a fixed date in the past is attributed TO the build and the
  // committed-diff branch never runs - the first draft of this arm did exactly that and
  // reported fresh. And the dates are controlled rather than taken from the clock because git
  // records %ct at one-second resolution, so two fixture commits in the same second would make
  // the span zero and the assertion vacuous.
  const first = new Date(aged.getTime() + 30_000).toISOString();
  const second = new Date(aged.getTime() + 60_000).toISOString();

  writeFileSync(join(root, "src/app/page.tsx"), "export default function Page() { return 2; }\n");
  gitAt(first, "add", "-A");
  gitAt(first, "commit", "-q", "-m", "first static change after the build");

  writeFileSync(join(root, "src/app/page.tsx"), "export default function Page() { return 3; }\n");
  gitAt(second, "add", "-A");
  gitAt(second, "commit", "-q", "-m", "second static change after the build");

  const result = checkOutFreshness("out", root);
  assert.equal(result.fresh, false, "two committed static changes after the build is staleness");
  assert.equal(
    result.staleCommitCount,
    2,
    "both static commits must be counted, not just the diff",
  );
  assert.equal(result.staleSpanMs, 30_000, "the span between the first and last must be reported");
  assert.match(result.reason ?? "", /2 such commits over 0\.5 min/);
});

test("am-wkod GREEN ARM: a real commit touching only a .test.tsx under src/app stays FRESH", () => {
  const root = makeRepoFixture();
  const gitNow = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

  // Aged for the same reason the arm above is aged: inside the five-second clock-skew tolerance
  // the committed-diff branch is never reached and the test would pass without exercising it.
  const aged = new Date(Date.now() - 60_000);
  utimesSync(join(root, "out/index.html"), aged, aged);
  utimesSync(join(root, "out"), aged, aged);

  // A test file cannot appear in a Next static export, so committing one says nothing about
  // whether out/ matches the site. Before am-wkod this refused: at a2295d72 the whole diff was
  // src/app/your-data/page.test.tsx and both browser gates failed in 65ms naming it.
  writeFileSync(join(root, "src/app/page.test.tsx"), "export const probe = 1;\n");
  gitNow("add", "-A");
  gitNow("commit", "-q", "-m", "a test file committed after the build");

  const result = checkOutFreshness("out", root);
  assert.equal(result.fresh, true, "a committed .test.tsx is not staleness; it cannot reach out/");
});

test("am-wkod RED ARM: the exclusion does not blind the guard to a real page beside a test", () => {
  const root = makeRepoFixture();
  const gitNow = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

  const aged = new Date(Date.now() - 60_000);
  utimesSync(join(root, "out/index.html"), aged, aged);
  utimesSync(join(root, "out"), aged, aged);

  // THE ARM THAT IS EASY TO SKIP. A fix satisfying only the green arm has disabled the guard, and
  // this guard is the only thing standing between a green browser run and a genuinely stale
  // build. Both files land in ONE commit so the test file cannot mask the page: if the exclusion
  // were written as a filter over the whole diff rather than as a pathspec subtraction, this is
  // the case that would wrongly pass.
  writeFileSync(join(root, "src/app/page.test.tsx"), "export const probe = 2;\n");
  writeFileSync(join(root, "src/app/page.tsx"), "export default function Page() { return 3; }\n");
  gitNow("add", "-A");
  gitNow("commit", "-q", "-m", "a page and a test committed together after the build");

  const result = checkOutFreshness("out", root);
  assert.equal(result.fresh, false, "a real page committed after the build is still staleness");
  assert.match(result.reason ?? "", /src\/app\/page\.tsx/);
  assert.doesNotMatch(
    result.reason ?? "",
    /page\.test\.tsx/,
    "the test file must not be named as a reason, or the message teaches the wrong lesson",
  );
});
