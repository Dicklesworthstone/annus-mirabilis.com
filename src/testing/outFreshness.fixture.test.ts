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
