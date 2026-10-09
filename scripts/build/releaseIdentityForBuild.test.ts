/**
 * THE DEFECT THESE TESTS WERE WRITTEN AGAINST, measured rather than imagined. On 2026-10-08, after
 * a successful build at commit f766cdc1, `out/release.json` read:
 *
 *     { "schema": "annus-mirabilis-release-identity.v1",
 *       "commit": "6374a41350613fbcdaf66399c8bb93ad89056121",
 *       "profile": "scaffold", "toolRunId": "20261002T210830Z-8b3bf18a",
 *       "builtAt": "2026-10-02T21:08:30.542Z" }
 *
 * A six-day-old commit from an unrelated deploy, because `public/release.json` is gitignored and
 * written only by the deploy script, while `next build` copies `public/` into `out/` regardless.
 * The file whose entire purpose is to answer "which commit is this" answered with another one, in
 * perfectly valid JSON, so no reader could tell.
 *
 * The decision is tested here as a pure function. The I/O half lives in prepare-lane's
 * `syncReleaseIdentity`, and the case that matters most for a RELEASE is the keep-on-match one: if
 * a build overwrote the deploy script's identity, the shipped file would lose its `profile` and
 * `toolRunId` and the promotion's own commit check would be reading a build's file.
 */

import { describe, expect, test } from "bun:test";
import {
  buildIdentity,
  contentEditionVersionOf,
  identityDecision,
  isCommitSha,
  RELEASE_IDENTITY_SCHEMA,
  ReleaseIdentityError,
  serializeIdentity,
  wasmManifestDigestOf,
} from "./releaseIdentityForBuild.ts";

const HEAD = "f766cdc1f33d1d9d87030df2e9e72ec49fe3104c";
const OTHER = "6374a41350613fbcdaf66399c8bb93ad89056121";

describe("a build writes its own identity unless the file already names its commit", () => {
  test("THE MEASURED DEFECT: a file naming another commit is replaced", () => {
    const stale = {
      schema: RELEASE_IDENTITY_SCHEMA,
      commit: OTHER,
      profile: "scaffold",
      toolRunId: "20261002T210830Z-8b3bf18a",
      builtAt: "2026-10-02T21:08:30.542Z",
    };
    const decision = identityDecision(stale, HEAD);
    expect(decision.action).toBe("write");
    // The reason names both commits, because "stale" with no numbers is not a diagnosis.
    expect(decision.reason).toContain("6374a413");
    expect(decision.reason).toContain("f766cdc1");
  });

  test("THE DEPLOY HANDOFF: a file naming THIS commit is kept, profile and all", () => {
    // `vercel build` re-runs the prepare lane after the deploy script has written its identity, so
    // this is the live path for every release. Overwriting here would silently downgrade a release
    // file to a build file.
    const fromDeploy = {
      schema: RELEASE_IDENTITY_SCHEMA,
      commit: HEAD,
      writtenBy: "deploy",
      profile: "launch",
      toolRunId: "20261008T000000Z-aaaaaaaa",
      builtAt: "2026-10-08T00:00:00.000Z",
    };
    const decision = identityDecision(fromDeploy, HEAD);
    expect(decision.action).toBe("keep");
    expect(decision.reason).toContain("deploy script");
  });

  test("a build's own file for the same commit is kept too, so a rebuild is not a rewrite", () => {
    const decision = identityDecision(buildIdentity(HEAD, new Date()), HEAD);
    expect(decision.action).toBe("keep");
  });

  test("case does not decide it: a commit differing only in case is the same commit", () => {
    const upper = { schema: RELEASE_IDENTITY_SCHEMA, commit: HEAD.toUpperCase() };
    // isCommitSha requires lowercase, so an upper-case value is not a usable sha and the file is
    // replaced -- but the comparison itself must not be what rejects it, or a correct lowercase
    // file could be replaced on a system that reported HEAD differently.
    expect(isCommitSha(HEAD.toUpperCase())).toBe(false);
    expect(identityDecision(upper, HEAD).action).toBe("write");
    expect(identityDecision({ commit: HEAD }, HEAD.toUpperCase()).action).toBe("keep");
  });

  test("an absent, unparsed, or shapeless file is replaced", () => {
    for (const existing of [null, undefined, 42, "a string", [], {}]) {
      expect(identityDecision(existing, HEAD).action).toBe("write");
    }
  });

  test("a file with no commit sha is replaced, and the reason says what it carried", () => {
    const decision = identityDecision({ schema: RELEASE_IDENTITY_SCHEMA, commit: "HEAD" }, HEAD);
    expect(decision.action).toBe("write");
    expect(decision.reason).toContain("HEAD");
  });

  test("AN UNKNOWN HEAD KEEPS WHATEVER IS THERE, because an invented identity is worse", () => {
    // `git rev-parse HEAD` fails outside a repository, in a shallow export, or with no git. There
    // is nothing truthful to write then, and a written "unknown" would be indistinguishable from a
    // real identity once serialized -- the failure this whole file exists to prevent.
    for (const head of ["", "HEAD", "not-a-sha", "f766cdc1"]) {
      const decision = identityDecision({ commit: OTHER }, head);
      expect(decision.action).toBe("keep");
      expect(decision.reason).toContain("unknown");
    }
  });
});

describe("the identity a build writes", () => {
  test("carries the commit, the v1 schema, and says a build wrote it", () => {
    const identity = buildIdentity(HEAD, new Date("2026-10-08T23:07:16.098Z"));
    expect(identity).toEqual({
      schema: "annus-mirabilis-release-identity.v1",
      commit: HEAD,
      writtenBy: "build",
      builtAt: "2026-10-08T23:07:16.098Z",
    });
  });

  test("refuses a commit that is not a sha rather than writing a placeholder", () => {
    for (const bad of ["", "HEAD", "f766cdc1", `${HEAD}0`, "../../etc/passwd"]) {
      expect(() => buildIdentity(bad, new Date())).toThrow(ReleaseIdentityError);
    }
  });

  test("and the refusal carries its code as a code, not inside the message", () => {
    // The throw-site census reads a standalone kebab string in the thrown expression
    // (throwSiteCensus.ts, KEBAB_CODE is anchored). The first version of this module put the code
    // in the message template, so the census counted an uncoded throw with no way to name it.
    let caught: unknown;
    try {
      buildIdentity("HEAD", new Date());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ReleaseIdentityError);
    expect((caught as ReleaseIdentityError).code).toBe("release-identity-commit");
    // And the message says what was received, because a code alone does not diagnose.
    expect((caught as ReleaseIdentityError).message).toContain("HEAD");
  });

  test("serializes as pretty JSON with a trailing newline, as the deploy script's writer does", () => {
    const text = serializeIdentity(buildIdentity(HEAD, new Date("2026-01-01T00:00:00.000Z")));
    expect(text.endsWith("}\n")).toBe(true);
    expect(JSON.parse(text).commit).toBe(HEAD);
    // The only consumer, smoke-test-deployment's checkReleaseIdentity, reads `commit` and nothing
    // else, so `writtenBy` cannot break a promotion check. Asserted so that stays true.
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(typeof parsed.commit).toBe("string");
  });
});

/**
 * THE TWO ARTIFACTS A COMMIT DOES NOT PIN (am-rc1001-bridge-plan-pcjk.3, criterion 1).
 *
 * /release.json answered "which source built this" and not "which WASM bundle and which compiled
 * edition was it served with", which are separate artifacts with their own digests. Measured
 * 2026-10-09 before this landed: out/release.json carried exactly schema, commit, writtenBy and
 * builtAt, and the one release record on disk carries no commitOnOrigin, wasmManifestDigest or
 * contentEditionVersion either.
 *
 * The ABSENT case is the half worth testing. An omitted field is visibly omitted; a placeholder
 * "unknown" is a value that compares equal to itself across two unrelated builds, which is the same
 * reasoning this module already applies to an unknown commit.
 */
describe("the bound artifacts", () => {
  const MANIFEST = '{"bundleId":"fs-annus-diffusion","files":{"a.wasm":"deadbeef"}}';
  const INDEX =
    '{"buildDigest":"5295751ce13398e2584251b510d350d018f2656ab081b178542df215798a24ef"}';

  test("a manifest's digest is the sha-256 of its bytes, and differs when a byte does", () => {
    const a = wasmManifestDigestOf(MANIFEST);
    const b = wasmManifestDigestOf(MANIFEST.replace("deadbeef", "deadbeee"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).not.toBe(a);
  });

  test("the edition version is TAKEN from the compiler's index, not recomputed", () => {
    // Recomputing it could disagree with the offline manifest and the reading routes, which all
    // compare against the compiler's own digest.
    expect(contentEditionVersionOf(INDEX)).toBe(
      "5295751ce13398e2584251b510d350d018f2656ab081b178542df215798a24ef",
    );
  });

  test("an absent, empty or unparsable source yields undefined rather than a placeholder", () => {
    expect(wasmManifestDigestOf(undefined)).toBeUndefined();
    expect(wasmManifestDigestOf("   ")).toBeUndefined();
    expect(contentEditionVersionOf(undefined)).toBeUndefined();
    expect(contentEditionVersionOf("not json")).toBeUndefined();
    expect(contentEditionVersionOf("{}")).toBeUndefined();
    expect(contentEditionVersionOf('{"buildDigest":""}')).toBeUndefined();
  });

  test("both artifacts present: the identity carries both digests", () => {
    const id = buildIdentity(HEAD, new Date("2026-10-09T00:00:00Z"), {
      wasmManifest: MANIFEST,
      contentIndex: INDEX,
    });
    expect(id.wasmManifestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(id.contentEditionVersion).toBe(
      "5295751ce13398e2584251b510d350d018f2656ab081b178542df215798a24ef",
    );
  });

  test("neither present: the KEYS ARE ABSENT, not set to undefined", () => {
    const id = buildIdentity(HEAD, new Date("2026-10-09T00:00:00Z"), {});
    // `in` rather than a truthiness check: JSON.stringify drops an undefined value, so a reader of
    // the serialized file could not tell, but a reader of the object could -- and a consumer that
    // tests presence would read an undefined-valued key as bound.
    expect("wasmManifestDigest" in id).toBe(false);
    expect("contentEditionVersion" in id).toBe(false);
    expect(Object.keys(id).sort()).toEqual(["builtAt", "commit", "schema", "writtenBy"]);
  });

  test("the schema stays v1, because both fields are additive", () => {
    // smoke-test-deployment.ts's checkReleaseIdentity reads `commit` and nothing else, so an added
    // field cannot break a promotion check. A schema bump would have.
    const id = buildIdentity(HEAD, new Date(), { wasmManifest: MANIFEST, contentIndex: INDEX });
    expect(id.schema).toBe(RELEASE_IDENTITY_SCHEMA);
    expect(JSON.parse(serializeIdentity(id)).commit).toBe(HEAD);
  });
});
