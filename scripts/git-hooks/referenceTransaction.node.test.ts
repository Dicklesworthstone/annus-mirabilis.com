/**
 * THE PROPOSED reference-transaction HOOK, DRIVEN AGAINST REAL GIT IN A THROWAWAY REPOSITORY.
 *
 * am-rc1001-bridge-plan-pcjk.46 names the four cases: "`git checkout -B main <older commit>` in a
 * scratch clone with the hook is refused and logged, while a commit, a merge, and a
 * `git pull --rebase` over unpushed local commits pass. Record all four."
 *
 * All four are here, and the three permits matter as much as the refusal: a hook that refused
 * everything would satisfy the refusal case and break the documented landing workflow. `git pull
 * --rebase` is the one that makes the hook subtle -- it is a NON-fast-forward transaction that
 * loses nothing, so the rebase-in-progress exemption is load-bearing rather than defensive.
 *
 * THE FIXTURE IS A FRESH REPOSITORY WITH ITS OWN LOCAL ORIGIN, under the OS temp directory. The
 * hook is installed INTO THE FIXTURE only; this repository's own .git/hooks is never touched, which
 * is what "the hook's test lives outside the lane it guards" means here. Nothing in this file can
 * affect refs/heads/main of the checkout it runs in.
 *
 * Node lane, not bun: bun cannot spawn git here (EBADF on posix_spawn '/usr/bin/git'), the same
 * reason src/content/kernel/declaredPins.node.test.ts is node-only.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), "reference-transaction");

/** Every spawn passes options: a bare spawnSync returns `status: undefined` under some runtimes. */
function git(cwd: string, ...args: string[]): { status: number; stdout: string; stderr: string } {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: run.status ?? 1, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
}

function gitOk(cwd: string, ...args: string[]): string {
  const r = git(cwd, ...args);
  assert.equal(r.status, 0, `git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}

function commit(work: string, name: string, body: string): string {
  writeFileSync(join(work, name), `${body}\n`, "utf8");
  gitOk(work, "add", name);
  gitOk(work, "commit", "-m", `add ${name}`);
  return gitOk(work, "rev-parse", "HEAD");
}

/** A repository with a local origin, two commits on main, and the hook installed. */
function fixture(): { work: string; origin: string; first: string; second: string; log: string } {
  const root = mkdtempSync(join(tmpdir(), "am-refhook-"));
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  assert.equal(
    spawnSync("git", ["init", "--bare", "--initial-branch=main", origin], { encoding: "utf8" })
      .status,
    0,
  );
  assert.equal(
    spawnSync("git", ["init", "--initial-branch=main", work], { encoding: "utf8" }).status,
    0,
  );
  gitOk(work, "config", "user.email", "fixture@example.invalid");
  gitOk(work, "config", "user.name", "Fixture");
  gitOk(work, "remote", "add", "origin", origin);
  const first = commit(work, "a.txt", "one");
  const second = commit(work, "b.txt", "two");
  gitOk(work, "push", "--quiet", "origin", "main");

  // Install into the FIXTURE only. A copy, not a symlink, so the test is unaffected by how the
  // real repository would choose to install it.
  const hooks = join(work, ".git", "hooks");
  mkdirSync(hooks, { recursive: true });
  const installed = join(hooks, "reference-transaction");
  copyFileSync(HOOK, installed);
  spawnSync("chmod", ["+x", installed], { encoding: "utf8" });
  assert.equal(existsSync(installed), true, "the hook was not installed into the fixture");

  return { work, origin, first, second, log: join(work, ".git", "ref-transaction-log") };
}

function logText(log: string): string {
  return existsSync(log) ? readFileSync(log, "utf8") : "";
}

test("CASE 1: `git checkout -B main <older>` is REFUSED and logged", (t) => {
  const { work, first, second, log } = fixture();
  const before = gitOk(work, "rev-parse", "refs/heads/main");
  assert.equal(before, second);

  const reset = git(work, "checkout", "-B", "main", first);
  t.diagnostic(`exit ${reset.status}; stderr: ${reset.stderr.trim().split("\n")[0] ?? ""}`);

  // The ref did not move, which is the only thing that really matters.
  assert.equal(
    gitOk(work, "rev-parse", "refs/heads/main"),
    second,
    "refs/heads/main moved backwards anyway",
  );
  assert.notEqual(reset.status, 0, "git reported success for a refused transaction");
  assert.match(reset.stderr, /may only move forward/);
  assert.match(reset.stderr, /1 commit\(s\) would leave the branch/);

  const text = logText(log);
  assert.match(text, /REFUSE:non-fast-forward:1-commits-would-leave-the-branch/);
  assert.match(text, /refs\/heads\/main/);
  // The ancestry is the reason the log exists: the actor has left no trace in any searchable log.
  assert.match(text, /\[\d+\]/, "the log records no process ancestry");
  t.diagnostic(`log line: ${text.trim().split("\n").at(-1)?.slice(0, 180) ?? ""}`);
});

test("CASE 2: an ordinary commit passes", (t) => {
  const { work, log } = fixture();
  const head = commit(work, "c.txt", "three");
  assert.equal(gitOk(work, "rev-parse", "refs/heads/main"), head);
  const text = logText(log);
  t.diagnostic(`verdict: ${/permit:[a-z-]+/.exec(text)?.[0] ?? "(none)"}`);
  assert.match(text, /permit:fast-forward/);
  assert.doesNotMatch(text, /REFUSE/);
});

test("CASE 3: a merge passes", (t) => {
  const { work, log } = fixture();
  gitOk(work, "checkout", "--quiet", "-b", "side");
  commit(work, "d.txt", "four");
  gitOk(work, "checkout", "--quiet", "main");
  const merge = git(work, "merge", "--no-ff", "-m", "merge side", "side");
  t.diagnostic(`merge exit ${merge.status}`);
  assert.equal(merge.status, 0, `the merge was refused: ${merge.stderr}`);
  assert.doesNotMatch(logText(log), /REFUSE/);
});

test("CASE 4: `git pull --rebase` over unpushed local commits passes", (t) => {
  const { work, origin, log } = fixture();

  // A second clone advances origin, so the pull has something to rebase onto.
  const other = mkdtempSync(join(tmpdir(), "am-refhook-other-"));
  assert.equal(
    spawnSync("git", ["clone", "--quiet", origin, other], { encoding: "utf8" }).status,
    0,
  );
  gitOk(other, "config", "user.email", "other@example.invalid");
  gitOk(other, "config", "user.name", "Other");
  commit(other, "remote.txt", "from the other clone");
  gitOk(other, "push", "--quiet", "origin", "main");

  // And the fixture has its own unpushed commit, which is the case the bead names: the rebase moves
  // main BACK to the upstream and replays, so the transaction is non-fast-forward.
  const localOnly = commit(work, "local.txt", "unpushed");
  const pull = git(work, "pull", "--rebase", "--quiet", "origin", "main");
  t.diagnostic(`pull exit ${pull.status}; stderr: ${pull.stderr.trim().split("\n")[0] ?? ""}`);
  assert.equal(pull.status, 0, `the rebase was refused: ${pull.stderr}`);

  // Both commits are present afterwards, so nothing was lost and nothing was refused.
  const subjects = gitOk(work, "log", "--format=%s", "-3");
  assert.match(subjects, /add local\.txt/);
  assert.match(subjects, /add remote\.txt/);
  assert.notEqual(
    gitOk(work, "rev-parse", "HEAD"),
    localOnly,
    "the rebase did not replay anything",
  );
  const text = logText(log);
  assert.doesNotMatch(text, /REFUSE/, `the rebase was refused in the log:\n${text}`);
  t.diagnostic(`verdicts seen: ${[...new Set(text.match(/permit:[a-z-]+/g) ?? [])].join(", ")}`);
});

test("the hook ignores every ref but refs/heads/main, so a side branch is unaffected", (t) => {
  const { work, first, log } = fixture();
  gitOk(work, "checkout", "--quiet", "-b", "side");
  // Moving a side branch backwards is exactly what the hook must NOT police: throwing away a
  // branch that is not main is ordinary work, and AGENTS.md's refusal is about main.
  const reset = git(work, "checkout", "-B", "side", first);
  t.diagnostic(`side reset exit ${reset.status}`);
  assert.equal(reset.status, 0, `moving a side branch backwards was refused: ${reset.stderr}`);
  assert.equal(gitOk(work, "rev-parse", "refs/heads/side"), first);
  assert.doesNotMatch(logText(log), /refs\/heads\/side/, "the hook logged a ref it should ignore");
});
