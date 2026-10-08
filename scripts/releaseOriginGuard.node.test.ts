/**
 * THE COARSE, IMPORT-FREE HALF of the release origin guard's proof, in the node lane.
 *
 * am-rc1001-bridge-plan-pcjk.3 asks for "a test that builds a throwaway git fixture repository,
 * plus a coarse lane-independent test of the predicate". The predicate half exists in
 * scripts/verified-production-deploy.test.ts, which drives `originAncestryRefusal` and
 * `observeOriginAncestry` through an INJECTED spawn. This is the fixture half, and the split between
 * them is forced rather than chosen.
 *
 * WHY THIS FILE CANNOT IMPORT THE PREDICATE, which is the whole reason it checks git instead. It was
 * first written to do both, in the bun lane, so it could import `originAncestryRefusal` and feed it
 * a real observation. Bun cannot spawn git here: every git call failed with
 * `EBADF: bad file descriptor, posix_spawn '/usr/bin/git'` -- which is the documented reason
 * src/content/kernel/declaredPins.node.test.ts is node-only, and a lone probe that appeared to
 * succeed was misleading. In the node lane git spawns fine, but
 * scripts/verified-production-deploy.ts has six extensionless relative imports (`./authorization`,
 * `./candidate-checks`, and four more) and node's --experimental-strip-types resolves none of them,
 * so importing the predicate here fails at module load. Repairing those imports is a change to the
 * deploy path and belongs in its own commit.
 *
 * SO THIS FILE ASKS THE QUESTION THE PREDICATE RESTS ON, with no import at all: does
 * `git merge-base --is-ancestor` actually distinguish a commit on a remote branch from one that is
 * not, and with which exit codes? Every mapping in the mocked suite -- fetch exit 0 means fetched,
 * merge-base exit 0 means ancestor, non-zero means not -- is an ASSUMPTION ABOUT GIT. If
 * `--is-ancestor` returned 0 for a commit on another branch, the mocked suite would stay green while
 * the guard let an unreleasable commit through, and only a real repository can tell.
 *
 * It deliberately does NOT re-implement the predicate. Copying `originAncestryRefusal`'s logic here
 * would make this a test of a copy, the mistake mapToFace.ts made with SENTENCE_PATTERN. What is
 * checked here is git's behaviour; what the deploy script does with it is checked in the bun lane,
 * and AGENTS.md's rule is satisfied either way: the two halves are in different lanes, so if one
 * fails open the other still runs.
 *
 * A FIXTURE, NOT THIS CHECKOUT. The repository is built under the OS temp directory with its own
 * `origin` as a second local repository, so nothing reads or fetches the real remote, the result
 * cannot depend on what this checkout has pushed, and no network is needed.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function git(cwd: string, ...args: string[]): { status: number; stdout: string; stderr: string } {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: run.status ?? 1, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
}

/**
 * `git` with no working directory, for the two `init` calls that create the fixture.
 *
 * EVERY SPAWN GOES THROUGH A HELPER THAT PASSES OPTIONS, and that is not tidiness. A bare
 * `spawnSync("git", [...])` with no options object returns `status: undefined` under bun while
 * returning 0 under node, so the first version of this fixture -- written for the node lane and
 * then moved -- failed all three tests at `assert.equal(..., 0)` with "undefined !== 0" on a git
 * command that had in fact succeeded. A difference that makes the same code pass in one lane and
 * fail in the other is exactly what a two-lane proof is supposed to surface.
 */
function gitAt(...args: string[]): { status: number; stderr: string } {
  const run = spawnSync("git", args, { encoding: "utf8" });
  return { status: run.status ?? 1, stderr: (run.stderr ?? "").trim() };
}

function gitOk(cwd: string, ...args: string[]): string {
  const run = git(cwd, ...args);
  assert.equal(run.status, 0, `git ${args.join(" ")} failed in ${cwd}: ${run.stderr}`);
  return run.stdout.trim();
}

/** A repository with its own local `origin`: main has one commit, and `side` has one more. */
function fixture(): { work: string; onMain: string; offMain: string } {
  const root = mkdtempSync(join(tmpdir(), "am-origin-semantics-"));
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  const bare = gitAt("init", "--bare", "--initial-branch=main", origin);
  assert.equal(bare.status, 0, `git init --bare failed: ${bare.stderr}`);
  const plain = gitAt("init", "--initial-branch=main", work);
  assert.equal(plain.status, 0, `git init failed: ${plain.stderr}`);
  gitOk(work, "config", "user.email", "fixture@example.invalid");
  gitOk(work, "config", "user.name", "Fixture");
  gitOk(work, "remote", "add", "origin", origin);
  writeFileSync(join(work, "a.txt"), "one\n", "utf8");
  gitOk(work, "add", "a.txt");
  gitOk(work, "commit", "-m", "on main");
  const onMain = gitOk(work, "rev-parse", "HEAD");
  gitOk(work, "push", "--quiet", "origin", "main");
  gitOk(work, "checkout", "--quiet", "-b", "side");
  writeFileSync(join(work, "b.txt"), "two\n", "utf8");
  gitOk(work, "add", "b.txt");
  gitOk(work, "commit", "-m", "off main");
  const offMain = gitOk(work, "rev-parse", "HEAD");
  assert.notEqual(onMain, offMain);
  return { work, onMain, offMain };
}

test("git tells a commit on origin/main from one that is only local, with exit 0 and 1", (t) => {
  const { work, onMain, offMain } = fixture();
  assert.equal(git(work, "fetch", "--quiet", "origin", "main").status, 0);

  const pushed = git(work, "merge-base", "--is-ancestor", onMain, "origin/main");
  const local = git(work, "merge-base", "--is-ancestor", offMain, "origin/main");
  t.diagnostic(`on origin/main -> exit ${pushed.status}; local only -> exit ${local.status}`);

  // The positive control is first and is not optional: a merge-base that refused everything would
  // make the negative pass for the wrong reason, and the guard would then refuse every release.
  assert.equal(pushed.status, 0, `a pushed commit was not an ancestor: ${pushed.stderr}`);
  assert.equal(local.status, 1, `a local-only commit returned ${local.status}, not 1`);

  // And `git fetch` succeeding is what the guard reads as "fetched". A fetch of a remote that does
  // not exist must fail, or an unknown would be indistinguishable from a successful one -- the
  // distinction originAncestryRefusal refuses on ("an unknown is not a pass").
  const absent = git(work, "fetch", "--quiet", "no-such-remote", "main");
  assert.notEqual(absent.status, 0, "fetching a remote that does not exist succeeded");
});

test("git: a DETACHED commit off main is still off main, and a detached one ON main is releasable", (t) => {
  // The shape the bead was opened for: production had been built from "a line of 27 commits on no
  // branch and no remote". Being detached is NOT itself the problem, and the second half of this
  // test is what stops anyone 'fixing' the guard by refusing every detached HEAD.
  const { work, onMain, offMain } = fixture();
  assert.equal(git(work, "fetch", "--quiet", "origin", "main").status, 0);

  gitOk(work, "checkout", "--quiet", "--detach", offMain);
  assert.equal(gitOk(work, "rev-parse", "HEAD"), offMain);
  const onBranch = git(work, "symbolic-ref", "--quiet", "HEAD");
  assert.notEqual(
    onBranch.status,
    0,
    "HEAD is still on a branch, so this is not the detached case",
  );
  const detachedOff = git(work, "merge-base", "--is-ancestor", offMain, "origin/main");
  assert.equal(detachedOff.status, 1, `a detached off-main commit returned ${detachedOff.status}`);

  gitOk(work, "checkout", "--quiet", "--detach", onMain);
  const detachedOn = git(work, "merge-base", "--is-ancestor", onMain, "origin/main");
  t.diagnostic(
    `detached off main -> ${detachedOff.status}; detached on main -> ${detachedOn.status}`,
  );
  assert.equal(detachedOn.status, 0, "a detached commit that IS on origin/main was refused");
});

test("git: the remedy the refusal names works -- merged into main and pushed becomes an ancestor", (t) => {
  // The refusal text tells the operator to "push it (or merge it into main and push)". That is a
  // claim about git, and without checking it the guard could be unsatisfiable: a refusal whose
  // remedy does not work is a wall.
  const { work, offMain } = fixture();
  const before = git(work, "merge-base", "--is-ancestor", offMain, "origin/main");

  gitOk(work, "checkout", "--quiet", "main");
  gitOk(work, "merge", "--quiet", "--no-ff", "-m", "merge side", "side");
  gitOk(work, "push", "--quiet", "origin", "main");
  assert.equal(git(work, "fetch", "--quiet", "origin", "main").status, 0);
  const after = git(work, "merge-base", "--is-ancestor", offMain, "origin/main");

  t.diagnostic(`before the merge -> ${before.status}; after merge and push -> ${after.status}`);
  // Both directions, so this cannot pass by the commit having been an ancestor all along.
  assert.equal(before.status, 1, "the commit was already on origin/main before the merge");
  assert.equal(after.status, 0, "a commit merged into main and pushed is still not an ancestor");
});
