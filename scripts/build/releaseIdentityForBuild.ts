/**
 * EVERY BUILD SAYS WHICH COMMIT IT IS, so `/release.json` is never stale
 * (am-rc1001-bridge-plan-pcjk.3, "At build time, emit out/release.json").
 *
 * THE DEFECT THIS FIXES, measured 2026-10-08. `public/release.json` is gitignored and written by
 * scripts/verified-production-deploy.ts before `vercel build`. An ordinary `bun run build` writes
 * nothing and `next build` copies whatever is sitting in `public/` into `out/`. So after build 14,
 * at commit f766cdc1, `out/release.json` still read:
 *
 *     { "commit": "6374a41350613fbcdaf66399c8bb93ad89056121",
 *       "profile": "scaffold", "builtAt": "2026-10-02T21:08:30.542Z" }
 *
 * -- a six-day-old commit from an unrelated deploy, served at `/release.json` by every local
 * build, with nothing saying so. A file whose whole purpose is to answer "which commit is this"
 * answered with someone else's, and the answer was well-formed, so no reader could tell.
 *
 * THE RULE, AND WHY IT NEEDS NO ENVIRONMENT VARIABLE. A build keeps an existing identity only when
 * that identity NAMES THE COMMIT BEING BUILT; otherwise it writes its own. Both cases then come out
 * right without the build having to know who invoked it:
 *
 *   - the deploy script wrote the file for this very commit a moment ago, so its richer identity
 *     (profile, toolRunId) survives and is what ships;
 *   - any other file is for a different commit and is replaced.
 *
 * Deciding by an env var would have been the obvious alternative and is worse: it asks the build
 * who its caller is, when the question it actually needs answered is about the file's contents, and
 * AGENTS.md forbids environment sniffing as a way of selecting behaviour.
 *
 * `writtenBy` is additive and the schema stays v1. The only consumer,
 * scripts/smoke-test-deployment.ts's `checkReleaseIdentity`, reads `commit` and nothing else, so an
 * added field cannot break a promotion check -- but a reader that sees `"build"` now knows it is
 * looking at a local build rather than a release, which is the distinction the stale file erased.
 */

export const RELEASE_IDENTITY_SCHEMA = "annus-mirabilis-release-identity.v1";

/** Who wrote the identity: a release through the deploy script, or a plain build. */
export type ReleaseIdentityWriter = "deploy" | "build";

export interface BuildReleaseIdentity {
  readonly schema: typeof RELEASE_IDENTITY_SCHEMA;
  readonly commit: string;
  readonly writtenBy: ReleaseIdentityWriter;
  readonly builtAt: string;
}

export type IdentityDecision =
  | Readonly<{ action: "keep"; reason: string }>
  | Readonly<{ action: "write"; reason: string }>;

/** A 40-character lowercase hex sha, which is the only shape a commit field may carry. */
const COMMIT = /^[0-9a-f]{40}$/;

export function isCommitSha(value: unknown): value is string {
  return typeof value === "string" && COMMIT.test(value);
}

/**
 * Whether a build should keep the identity already on disk, or write its own.
 *
 * `existing` is the parsed contents of public/release.json, or null when the file is absent or
 * unreadable. `headCommit` is the commit being built.
 */
export function identityDecision(existing: unknown, headCommit: string): IdentityDecision {
  if (!isCommitSha(headCommit)) {
    // Not a judgement call: without a commit there is nothing truthful to write, and writing an
    // "unknown" would be worse than leaving whatever is there, because a reader cannot tell an
    // unknown from a real identity once it is serialized.
    return {
      action: "keep",
      reason: "the build's own commit is unknown, so nothing can be written",
    };
  }
  if (existing === null || typeof existing !== "object") {
    return { action: "write", reason: "no readable identity on disk" };
  }
  const commit = (existing as { commit?: unknown }).commit;
  if (!isCommitSha(commit)) {
    return {
      action: "write",
      reason: `the identity on disk carries no commit sha (${String(commit)})`,
    };
  }
  if (commit.toLowerCase() !== headCommit.toLowerCase()) {
    return {
      action: "write",
      reason: `the identity on disk names ${commit.slice(0, 8)}, this build is ${headCommit.slice(0, 8)}`,
    };
  }
  const writer = (existing as { writtenBy?: unknown }).writtenBy;
  return {
    action: "keep",
    reason:
      writer === "deploy"
        ? `the deploy script wrote this identity for ${headCommit.slice(0, 8)}`
        : `the identity on disk already names ${headCommit.slice(0, 8)}`,
  };
}

export function buildIdentity(headCommit: string, now: Date): BuildReleaseIdentity {
  if (!isCommitSha(headCommit)) {
    throw new TypeError(
      `A build identity needs a 40-character commit sha, got '${headCommit}' (release-identity-commit).`,
    );
  }
  return {
    schema: RELEASE_IDENTITY_SCHEMA,
    commit: headCommit,
    writtenBy: "build",
    builtAt: now.toISOString(),
  };
}

export function serializeIdentity(identity: BuildReleaseIdentity): string {
  return `${JSON.stringify(identity, null, 2)}\n`;
}
