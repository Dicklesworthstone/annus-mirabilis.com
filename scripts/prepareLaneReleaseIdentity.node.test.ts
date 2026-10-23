/**
 * THE I/O HALF OF THE RELEASE IDENTITY, OVER A REAL GIT FIXTURE.
 *
 * `scripts/build/releaseIdentityForBuild.test.ts` drives the decision and the backfill as pure
 * functions in the bun lane. This file drives `syncReleaseIdentity`, which is where the defect
 * actually lived: the pure function could have been perfect and the lane still shipped a release
 * identity without it, because the keep branch returned before the artifacts were read.
 *
 * WHY THE NODE LANE. `syncReleaseIdentity` spawns `git rev-parse HEAD` in the root it is given, and
 * bun cannot spawn git in this checkout -- it is the same split AGENTS.md records for the two test
 * lanes. That split is also what makes this a two-lane proof rather than a second copy of one:
 * neither lane alone can run both halves, so neither can go quiet and take the other with it.
 *
 * THE DEFECT, measured 2026-10-23 at 07cab0a31. The deploy script writes `public/release.json`
 * before `vercel build`, so it cannot name a digest of artifacts that build has not produced; its
 * `ReleaseIdentity` type declared neither field. The prepare lane then kept that file -- correctly,
 * so `profile` and `toolRunId` survive -- and returned, so the identity served at `/release.json`
 * in production bound the commit alone, while a plain local build's bound the commit, the WASM
 * bundle and the compiled edition. AGENTS.md asks a release manifest to bind all three.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncReleaseIdentity } from "./prepare-lane.ts";

function gitOk(cwd: string, ...args: string[]): string {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, `git ${args.join(" ")} failed in ${cwd}: ${run.stderr ?? ""}`);
  return (run.stdout ?? "").trim();
}

const MANIFEST = '{"bundleId":"fs-annus-diffusion","files":{"a.wasm":"deadbeef"}}';
const INDEX = '{"buildDigest":"5295751ce13398e2584251b510d350d018f2656ab081b178542df215798a24ef"}';

/**
 * A one-commit repository carrying the two artifacts the identity binds, plus whatever
 * `public/release.json` the caller wants.
 *
 * The artifacts are written for every fixture, so a test that gets no backfill gets none for the
 * reason it is testing rather than because the files were missing.
 */
function fixture(existingIdentity?: unknown): { root: string; head: string } {
  const root = mkdtempSync(join(tmpdir(), "am-prepare-identity-"));
  const init = spawnSync("git", ["init", "--initial-branch=main", root], { encoding: "utf8" });
  assert.equal(init.status ?? 1, 0, `git init failed: ${init.stderr ?? ""}`);
  gitOk(root, "config", "user.email", "fixture@example.invalid");
  gitOk(root, "config", "user.name", "Fixture");
  mkdirSync(join(root, "public", "wasm"), { recursive: true });
  mkdirSync(join(root, "generated", "content"), { recursive: true });
  writeFileSync(join(root, "public", "wasm", "manifest.json"), MANIFEST, "utf8");
  writeFileSync(join(root, "generated", "content", "index.json"), INDEX, "utf8");
  writeFileSync(join(root, "a.txt"), "one\n", "utf8");
  gitOk(root, "add", "a.txt");
  gitOk(root, "commit", "--quiet", "-m", "fixture");
  const head = gitOk(root, "rev-parse", "HEAD");
  if (existingIdentity !== undefined) {
    writeFileSync(
      join(root, "public", "release.json"),
      `${JSON.stringify(existingIdentity, null, 2)}\n`,
      "utf8",
    );
  }
  return { root, head };
}

/** The write calls `syncReleaseIdentity` made, so a test can assert it wrote nothing. */
function capture(): {
  write: (path: string, body: string, encoding: string) => void;
  calls: { path: string; body: string }[];
} {
  const calls: { path: string; body: string }[] = [];
  return {
    write: (path, body) => {
      calls.push({ path: String(path), body: String(body) });
    },
    calls,
  };
}

test("THE MEASURED DEFECT: a kept deploy identity gains both digests, and keeps every field", (t) => {
  const deployFields = {
    schema: "annus-mirabilis-release-identity.v1",
    writtenBy: "deploy",
    profile: "scaffold",
    toolRunId: "20261002T210830Z-8b3bf18a",
    builtAt: "2026-10-02T21:08:30.542Z",
    commitOnOrigin: true,
  };
  const { root, head } = fixture();
  // The commit has to be the fixture's HEAD for the decision to be `keep`, and HEAD is only known
  // after the commit exists, so the file is written here rather than threaded into fixture().
  writeFileSync(
    join(root, "public", "release.json"),
    `${JSON.stringify({ ...deployFields, commit: head }, null, 2)}\n`,
    "utf8",
  );

  const { write, calls } = capture();
  const message = syncReleaseIdentity(root, write as never);
  t.diagnostic(message);

  assert.match(
    message,
    /^release identity: kept/,
    "the deploy identity must be kept, not replaced",
  );
  assert.match(message, /bound wasmManifestDigest and contentEditionVersion/, message);
  assert.equal(calls.length, 1, "exactly one write");
  const written = JSON.parse(calls[0]?.body ?? "{}") as Record<string, unknown>;

  // The two fields the release could never carry.
  assert.match(String(written.wasmManifestDigest), /^[0-9a-f]{64}$/);
  assert.equal(
    written.contentEditionVersion,
    "5295751ce13398e2584251b510d350d018f2656ab081b178542df215798a24ef",
  );
  // And not one field of the deploy script's lost, which is the half that makes this a merge.
  for (const [key, value] of Object.entries({ ...deployFields, commit: head })) {
    assert.deepEqual(written[key], value, `the kept identity lost ${key}`);
  }
  assert.equal(
    written.writtenBy,
    "deploy",
    "a kept identity must not start claiming to be a build",
  );
});

/** HEAD of a root that may not be a repository yet; undefined rather than a throw. */
function head_(root: string): string | undefined {
  const run = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const out = (run.stdout ?? "").trim();
  return out.length === 40 ? out : undefined;
}

test("THE CONTROL: an identity naming another commit is still REPLACED, not merged", (t) => {
  const other = "6374a41350613fbcdaf66399c8bb93ad89056121";
  const { root, head } = fixture({
    schema: "annus-mirabilis-release-identity.v1",
    commit: other,
    writtenBy: "deploy",
    profile: "scaffold",
  });
  assert.notEqual(head, other);

  const { write, calls } = capture();
  const message = syncReleaseIdentity(root, write as never);
  t.diagnostic(message);

  // Without this control the backfill could have become "always merge", which would resurrect the
  // original defect exactly: a six-day-old commit kept because its other fields looked rich.
  assert.match(message, /^release identity: wrote/, message);
  const written = JSON.parse(calls[0]?.body ?? "{}") as Record<string, unknown>;
  assert.equal(written.commit, head);
  assert.equal(written.writtenBy, "build");
  assert.equal("profile" in written, false, "a replaced identity must not inherit the old profile");
});

test("a kept identity that already binds both artifacts is not rewritten at all", (t) => {
  const { root } = fixture();
  const head = head_(root);
  assert.ok(head);
  writeFileSync(
    join(root, "public", "release.json"),
    `${JSON.stringify(
      {
        schema: "annus-mirabilis-release-identity.v1",
        commit: head,
        writtenBy: "deploy",
        wasmManifestDigest: "f".repeat(64),
        contentEditionVersion: "already-here",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const before = readFileSync(join(root, "public", "release.json"), "utf8");

  const { write, calls } = capture();
  const message = syncReleaseIdentity(root, write as never);
  t.diagnostic(message);

  assert.equal(calls.length, 0, "a no-op backfill must not write");
  assert.match(message, /^release identity: kept/);
  assert.doesNotMatch(message, /bound/, message);
  // The values already there are untouched, including the deliberately wrong-looking digest: this
  // function does not adjudicate a field someone else wrote.
  assert.equal(readFileSync(join(root, "public", "release.json"), "utf8"), before);
});
