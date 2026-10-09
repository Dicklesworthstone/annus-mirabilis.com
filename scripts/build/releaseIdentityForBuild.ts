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

import { createHash } from "node:crypto";

export const RELEASE_IDENTITY_SCHEMA = "annus-mirabilis-release-identity.v1";

/** Who wrote the identity: a release through the deploy script, or a plain build. */
export type ReleaseIdentityWriter = "deploy" | "build";

export interface BuildReleaseIdentity {
  readonly schema: typeof RELEASE_IDENTITY_SCHEMA;
  readonly commit: string;
  readonly writtenBy: ReleaseIdentityWriter;
  readonly builtAt: string;
  /**
   * WHAT THE COMMIT ALONE DOES NOT PIN. A commit says which source built the page; it does not say
   * which WASM bundle or which compiled edition the page was served WITH, and those are separate
   * artifacts with their own digests. AGENTS.md asks a release manifest to bind exactly this set:
   * "the site source revision, content edition version, source-asset hashes, WASM artifact hashes".
   * Until these two were here, /release.json answered one of the three questions it exists for, and
   * the iPhone app -- which the bead says "cannot bind to a web release" -- had nothing to bind to
   * but a commit.
   *
   * Both are OPTIONAL and omitted rather than filled with a placeholder when their source file is
   * absent. That is this module's existing reasoning about unknowns, applied again: "writing an
   * 'unknown' would be worse than leaving whatever is there, because a reader cannot tell an unknown
   * from a real identity once it is serialized." An absent field is visibly absent; "unknown" is a
   * value that compares equal to itself across two unrelated builds.
   */
  readonly wasmManifestDigest?: string | undefined;
  readonly contentEditionVersion?: string | undefined;
}

/** The sha-256 of the WASM manifest's bytes, which is what binds a page to the bundle it loads. */
export function wasmManifestDigestOf(manifestBytes: string | undefined): string | undefined {
  if (manifestBytes === undefined || manifestBytes.trim() === "") return undefined;
  return createHash("sha256").update(manifestBytes, "utf8").digest("hex");
}

/**
 * The compiled edition's own build digest, read from the index the compiler emits. Taken from the
 * record rather than recomputed, because the compiler's digest is what the offline manifest and the
 * reading routes already compare against; a second derivation of it could disagree with all of them.
 */
export function contentEditionVersionOf(contentIndexBytes: string | undefined): string | undefined {
  if (contentIndexBytes === undefined) return undefined;
  try {
    const digest = (JSON.parse(contentIndexBytes) as { buildDigest?: unknown }).buildDigest;
    return typeof digest === "string" && digest.trim() !== "" ? digest : undefined;
  } catch {
    return undefined;
  }
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

/**
 * A CODED refusal, in the shape verified-production-deploy.ts's ReleaseRefusalError uses: the code
 * is the first argument and a standalone kebab string, which is what the throw-site census reads
 * (src/testing/refusals/throwSiteCensus.ts, KEBAB_CODE is anchored). The first version of this file
 * threw a TypeError with the code inside the message template, and the bare-throw ratchet refused
 * it -- correctly: a code embedded in prose cannot be matched on, and a reader of the census would
 * have seen one more uncoded throw with no way to name it.
 *
 * It is not imported from the deploy script, which would pull that module's six extensionless
 * relative imports into the build's prepare lane.
 */
export class ReleaseIdentityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ReleaseIdentityError";
  }
}

/** The bytes of the two files the identity binds, or undefined where one is absent. */
export type BoundArtifacts = Readonly<{
  wasmManifest?: string | undefined;
  contentIndex?: string | undefined;
}>;

export function buildIdentity(
  headCommit: string,
  now: Date,
  bound: BoundArtifacts = {},
): BuildReleaseIdentity {
  if (!isCommitSha(headCommit)) {
    throw new ReleaseIdentityError(
      "release-identity-commit",
      `A build identity needs a 40-character commit sha, got '${headCommit}'.`,
    );
  }
  const wasmManifestDigest = wasmManifestDigestOf(bound.wasmManifest);
  const contentEditionVersion = contentEditionVersionOf(bound.contentIndex);
  return {
    schema: RELEASE_IDENTITY_SCHEMA,
    commit: headCommit,
    writtenBy: "build",
    builtAt: now.toISOString(),
    // Spread so an absent artifact leaves the KEY OUT rather than setting it to undefined:
    // JSON.stringify drops an undefined value, but `"k" in obj` would still be true, and a
    // consumer testing presence rather than truthiness would read it as bound.
    ...(wasmManifestDigest === undefined ? {} : { wasmManifestDigest }),
    ...(contentEditionVersion === undefined ? {} : { contentEditionVersion }),
  };
}

export function serializeIdentity(identity: BuildReleaseIdentity): string {
  return `${JSON.stringify(identity, null, 2)}\n`;
}
