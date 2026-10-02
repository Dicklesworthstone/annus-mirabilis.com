/**
 * Unit and integration tests for scripts/verified-production-deploy.ts
 * Quality gate / deployment verification module
 * Owner: am-rel-verified-deploy-qndt
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __resetSpawnForTesting,
  __setSpawnForTesting,
  assertCompletePrebuiltArtifact,
  assertQualityGatesResult,
  type CommandResult,
  candidateRecordWithChecks,
  candidateRecordWithoutChecks,
  deploymentUrl,
  describeCommandFailure,
  determinePromotionHostnames,
  directPromotionRefusal,
  executePromotionStateMachine,
  FAILED_COMMAND_MAX_CHARS,
  FAILED_COMMAND_STDERR_LINES,
  filterTrackedWorkingTreeChanges,
  getReleaseRecordPath,
  loadReleaseCandidate,
  outputTail,
  parseCliArgs,
  parseConflictingBuilds,
  parseProtectedPreviewStatus,
  type ReleaseCandidateRecord,
  redactArgs,
  run,
  runPreflightQualityGates,
  type SpawnFn,
  toolRunArtifactDirectory,
  validatePromotePreconditions,
} from "./verified-production-deploy";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(currentDir, "fixtures", "verified-production-deploy");

describe("scripts/verified-production-deploy.ts pipeline safety tests", () => {
  test("1. ps and lsof fixture parsing detects conflicting builds and respects exclusions", () => {
    const psFixture = `
101 1 01:23 /bin/zsh
102 1 00:45 next build
103 1 00:10 Google Chrome --type=renderer
104 1 00:05 SkyComputerUseClient
105 1 00:20 bun run dev
106 1 00:15 /usr/bin/python3
107 1 00:30 bun scripts/build.ts
108 1 00:02 Antigravity IDE helper
`;
    // Mock workspace filter: 102 and 107 are in workspace, 105 is outside
    const isWorkspaceFn = (pid: string) => pid === "102" || pid === "107";
    const conflicts = parseConflictingBuilds(psFixture, "999", isWorkspaceFn);

    expect(conflicts.length).toBe(2);
    expect(conflicts.some((c) => c.includes("next build"))).toBe(true);
    expect(conflicts.some((c) => c.includes("bun scripts/build.ts"))).toBe(true);
    expect(conflicts.some((c) => c.includes("Google Chrome"))).toBe(false);
    expect(conflicts.some((c) => c.includes("SkyComputerUseClient"))).toBe(false);
    expect(conflicts.some((c) => c.includes("Antigravity"))).toBe(false);
    expect(conflicts.some((c) => c.includes("bun run dev"))).toBe(false); // filtered out by workspace check
  });

  test("1b. a shell whose command line names a build is not a build; the build it runs still is", () => {
    // The shell that launched a deploy is its ancestor, and its argv can read "bun run build && bun
    // scripts/verified-production-deploy.ts". On 2026-09-23 that made the preflight refuse its own
    // launcher. Every line below is in the workspace, so only the executable can tell them apart.
    const psFixture = `
201 1 03:26 /bin/zsh -c source snap.sh && bun run build > b.log && bun scripts/verified-production-deploy.ts
202 1 00:40 -zsh -c next build
203 1 00:12 bash -c "vercel build --prod"
204 201 00:30 bun run build
205 204 00:28 node /repo/node_modules/.bin/next build
`;
    const conflicts = parseConflictingBuilds(psFixture, "999", () => true);
    expect(conflicts.map((c) => c.trim().split(/\s+/)[0])).toEqual(["204", "205"]);
  });

  test("2. porcelain filtering with the allowlist filters build info, next-env, and .beads", () => {
    const porcelainInput = `
?? tsconfig.tsbuildinfo
?? next-env.d.ts
 M .beads/issues.jsonl
?? .beads/beads.db
 M src/components/edition/Formula.tsx
?? src/newComponent.tsx
`;
    const filtered = filterTrackedWorkingTreeChanges(porcelainInput);
    expect(filtered).not.toContain("tsconfig.tsbuildinfo");
    expect(filtered).not.toContain("next-env.d.ts");
    expect(filtered).not.toContain(".beads/");
    expect(filtered).toContain("src/components/edition/Formula.tsx");
    expect(filtered).toContain("src/newComponent.tsx");
  });

  test("3. deployment URL extraction handles mixed text, json, and trailing punctuation", () => {
    const outputWithPunctuation =
      "Deployment created: https://annus-mirabilis-candidate-seven.vercel.app. (inspect at https://vercel.com/project)";
    expect(deploymentUrl(outputWithPunctuation)).toBe(
      "https://annus-mirabilis-candidate-seven.vercel.app",
    );

    const outputWithParenthesis =
      "Created deployment (https://annus-mirabilis-cand-123-seven.vercel.app) successfully";
    expect(deploymentUrl(outputWithParenthesis)).toBe(
      "https://annus-mirabilis-cand-123-seven.vercel.app",
    );

    expect(() => deploymentUrl("No url returned here")).toThrow(
      /Vercel did not return a deployment URL/i,
    );
  });

  test("4. protected-preview status-marker parsing parses 2xx, 401, 404, and missing marker", () => {
    const marker = "__ANNUS_MIRABILIS_HTTP_STATUS__";

    const okOutput = `<html><body>OK</body></html>\n${marker}200\n`;
    const okParsed = parseProtectedPreviewStatus(okOutput, marker);
    expect(okParsed.status).toBe(200);
    expect(okParsed.body).toBe("<html><body>OK</body></html>");

    const unauthorizedOutput = `Unauthorized\n${marker}401\n`;
    const unauthParsed = parseProtectedPreviewStatus(unauthorizedOutput, marker);
    expect(unauthParsed.status).toBe(401);

    const notFoundOutput = `Not Found\n${marker}404\n`;
    const notFoundParsed = parseProtectedPreviewStatus(notFoundOutput, marker);
    expect(notFoundParsed.status).toBe(404);

    const missingMarkerOutput = "Some random error without marker";
    const missingParsed = parseProtectedPreviewStatus(missingMarkerOutput, marker);
    expect(missingParsed.status).toBe(0);
    expect(missingParsed.body).toBe(missingMarkerOutput);
  });

  test("5. artifact validation on fixture trees refuses missing config, version 2, stale mtime, too few files", () => {
    const v2Fixture = path.join(fixturesDir, "artifact-v2");
    expect(() => assertCompletePrebuiltArtifact(Date.now(), v2Fixture)).toThrow(
      /not a version 3 Build Output API artifact/i,
    );

    const missingConfigFixture = path.join(fixturesDir, "artifact-missing-config");
    expect(() => assertCompletePrebuiltArtifact(Date.now(), missingConfigFixture)).toThrow(
      /did not create .vercel\/output\/config.json/i,
    );

    const tooFewFilesFixture = path.join(fixturesDir, "artifact-too-few-files");
    // With 100 files required, a directory with only 2 files fails
    expect(() => assertCompletePrebuiltArtifact(0, tooFewFilesFixture, 100)).toThrow(
      /has only \d+ files; a valid Annus Mirabilis release has a full static site/i,
    );

    // Stale mtime: build started after file mtime + 1000ms
    const futureBuildTime = Date.now() + 10_000_000;
    expect(() => assertCompletePrebuiltArtifact(futureBuildTime, tooFewFilesFixture, 1)).toThrow(
      /predates this release attempt/i,
    );
  });

  test("6. gate runner exit code 2 and exit code 1 each refuse", () => {
    expect(() => assertQualityGatesResult(2, "preflight")).toThrow(
      /required quality gate step was unavailable \(exit 2\)/i,
    );
    expect(() => assertQualityGatesResult(1, "preflight")).toThrow(
      /quality gate check failed with exit code 1/i,
    );
    expect(() => assertQualityGatesResult(0, "preflight")).not.toThrow();
  });

  test("7. profile rules: scaffold defaults to platform domain, custom domains require flag, launch requires all", () => {
    const scaffoldDefault = determinePromotionHostnames("scaffold", false);
    expect(scaffoldDefault).toEqual(["annus-mirabilis-seven.vercel.app"]);

    const scaffoldCustom = determinePromotionHostnames("scaffold", true);
    expect(scaffoldCustom).toEqual([
      "annus-mirabilis.com",
      "www.annus-mirabilis.com",
      "annus-mirabilis-seven.vercel.app",
    ]);

    const previewDefault = determinePromotionHostnames("preview", false);
    expect(previewDefault).toEqual(["annus-mirabilis-seven.vercel.app"]);

    const launchDefault = determinePromotionHostnames("launch", false);
    expect(launchDefault).toEqual([
      "annus-mirabilis.com",
      "www.annus-mirabilis.com",
      "annus-mirabilis-seven.vercel.app",
    ]);
  });

  test("8. promotion state machine applies aliases in order, and rolls back previous aliases on partial failure", () => {
    const candidateUrl = "https://annus-mirabilis-candidate.vercel.app";
    const targetHostnames = [
      "annus-mirabilis-seven.vercel.app",
      "www.annus-mirabilis.com",
      "annus-mirabilis.com",
    ];

    // Case A: Happy path
    const appliedCommands: string[][] = [];
    const happyAliasRunner = (target: string, host: string): CommandResult => {
      appliedCommands.push(["alias", "set", target, host]);
      return { stdout: "Success", stderr: "", status: 0 };
    };
    const inspectRunner = (_host: string): string => {
      return `id dpl_prev\nurl https://annus-mirabilis-prev.vercel.app\nstatus Ready\n`;
    };

    const result = executePromotionStateMachine({
      candidateUrl,
      targetHostnames,
      aliasRunner: happyAliasRunner,
      inspectRunner,
    });

    expect(result.success).toBe(true);
    expect(result.promoted.length).toBe(3);
    expect(appliedCommands.length).toBe(3);

    // Case B: Failure on second hostname triggers rollback of first hostname
    appliedCommands.length = 0;
    const failingAliasRunner = (target: string, host: string): CommandResult => {
      appliedCommands.push(["alias", "set", target, host]);
      if (host === "www.annus-mirabilis.com") {
        throw new Error("Simulated network timeout aliasing custom domain");
      }
      return { stdout: "Success", stderr: "", status: 0 };
    };

    expect(() =>
      executePromotionStateMachine({
        candidateUrl,
        targetHostnames,
        aliasRunner: failingAliasRunner,
        inspectRunner,
      }),
    ).toThrow(
      /Promotion failed on hostname 'www.annus-mirabilis.com'.*Successfully rolled back 1 hostname/i,
    );

    // Verify that the rollback command was executed to restore the first hostname
    expect(appliedCommands.length).toBe(3);
    // 1: alias set candidate -> platform
    expect(appliedCommands[0]).toEqual([
      "alias",
      "set",
      candidateUrl,
      "annus-mirabilis-seven.vercel.app",
    ]);
    // 2: alias set candidate -> www (failed)
    expect(appliedCommands[1]).toEqual(["alias", "set", candidateUrl, "www.annus-mirabilis.com"]);
    // 3: rollback: alias set prev -> platform
    expect(appliedCommands[2]).toEqual([
      "alias",
      "set",
      "annus-mirabilis-prev.vercel.app",
      "annus-mirabilis-seven.vercel.app",
    ]);
  });

  test("9. cli argument parser extracts profile, dry-run, candidate-only, promote, and authorization", () => {
    const args = [
      "--profile",
      "preview",
      "--candidate-only",
      "--authorization",
      "auth.yaml",
      "--include-custom-domains",
    ];
    const parsed = parseCliArgs(args);
    expect(parsed.profile).toBe("preview");
    expect(parsed.candidateOnly).toBe(true);
    expect(parsed.authorization).toBe("auth.yaml");
    expect(parsed.includeCustomDomains).toBe(true);
    expect(parsed.promote).toBeUndefined();

    const promoteArgs = ["--profile", "launch", "--promote", "20260917T180000Z-abcd1234"];
    const parsedPromote = parseCliArgs(promoteArgs);
    expect(parsedPromote.profile).toBe("launch");
    expect(parsedPromote.promote).toBe("20260917T180000Z-abcd1234");
  });

  test("10. promote mode refuses on failed candidate checks, commit mismatch, and manifest digest mismatch", () => {
    const validRecord: ReleaseCandidateRecord = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, "candidate-record-passed.json"), "utf8"),
    );
    const failedRecord: ReleaseCandidateRecord = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, "candidate-record-failed.json"), "utf8"),
    );

    // Fails on failed checks
    expect(() =>
      validatePromotePreconditions({
        record: failedRecord,
        currentHeadCommit: failedRecord.commit,
      }),
    ).toThrow(/has failed candidate checks/i);

    // Fails on commit mismatch
    expect(() =>
      validatePromotePreconditions({
        record: validRecord,
        currentHeadCommit: "9999999999999999999999999999999999999999",
      }),
    ).toThrow(/commit mismatch/i);

    // Fails on manifest digest mismatch
    expect(() =>
      validatePromotePreconditions({
        record: validRecord,
        currentHeadCommit: validRecord.commit,
        currentManifestDigest: "sha256:different-manifest-digest",
      }),
    ).toThrow(/release manifest digest mismatch/i);

    // Passes when matching
    expect(() =>
      validatePromotePreconditions({
        record: validRecord,
        currentHeadCommit: validRecord.commit,
        currentManifestDigest: validRecord.manifestDigest,
      }),
    ).not.toThrow();
  });

  test("11. toolRunArtifactDirectory constructs proper artifacts directory without disk writes", () => {
    const dir = toolRunArtifactDirectory("test-tool-run-id");
    expect(dir).toContain(path.join("artifacts", "verified-production-deploy", "test-tool-run-id"));
  });

  test("12. promotion state machine rolls back on post-promotion smokeRunner failure", () => {
    const candidateUrl = "https://annus-mirabilis-candidate.vercel.app";
    const targetHostnames = ["annus-mirabilis-seven.vercel.app", "www.annus-mirabilis.com"];
    const appliedCommands: [string, string, string, string][] = [];
    const aliasRunner = (target: string, host: string): CommandResult => {
      appliedCommands.push(["alias", "set", target, host]);
      return { stdout: "Success", stderr: "", status: 0 };
    };
    const inspectRunner = (_host: string): string => {
      return `id dpl_prev\nurl https://annus-mirabilis-prev.vercel.app\nstatus Ready\n`;
    };
    const failingSmokeRunner = (): void => {
      throw new Error("Simulated smoke test failure: home page returned HTTP 500");
    };

    expect(() =>
      executePromotionStateMachine({
        candidateUrl,
        targetHostnames,
        aliasRunner,
        inspectRunner,
        smokeRunner: failingSmokeRunner,
      }),
    ).toThrow(/Promotion failed on smoke-test.*Successfully rolled back 2 hostname/i);

    // Both hostnames were aliased, then rolled back in reverse order
    expect(appliedCommands.length).toBe(4);
    expect(appliedCommands[0]).toEqual([
      "alias",
      "set",
      candidateUrl,
      "annus-mirabilis-seven.vercel.app",
    ]);
    expect(appliedCommands[1]).toEqual(["alias", "set", candidateUrl, "www.annus-mirabilis.com"]);
    expect(appliedCommands[2]).toEqual([
      "alias",
      "set",
      "annus-mirabilis-prev.vercel.app",
      "www.annus-mirabilis.com",
    ]);
    expect(appliedCommands[3]).toEqual([
      "alias",
      "set",
      "annus-mirabilis-prev.vercel.app",
      "annus-mirabilis-seven.vercel.app",
    ]);
  });

  test("13. candidate record path and loader resolve by path, toolRunId, deploymentId, and candidateUrl", () => {
    const commitPrefixedPath = getReleaseRecordPath("run-123", "/releases", "abc1234");
    expect(commitPrefixedPath).toBe(path.join("/releases", "abc1234-run-123.json"));

    const plainPath = getReleaseRecordPath("run-123", "/releases");
    expect(plainPath).toBe(path.join("/releases", "run-123.json"));

    // Lookup by file path
    const byPath = loadReleaseCandidate(path.join(fixturesDir, "candidate-record-passed.json"));
    expect(byPath.toolRunId).toBe("20260917T180000Z-abcd1234");

    // Lookup by deployment ID inside fixturesDir
    const byDeploymentId = loadReleaseCandidate("dpl_preview123", fixturesDir);
    expect(byDeploymentId.toolRunId).toBe("20260917T180000Z-abcd1234");

    // Lookup by candidate URL inside fixturesDir
    const byUrl = loadReleaseCandidate("https://annus-mirabilis-preview-1.vercel.app", fixturesDir);
    expect(byUrl.candidateDeploymentId).toBe("dpl_preview123");

    // Refusal when unknown
    expect(() => loadReleaseCandidate("nonexistent-deployment-id", fixturesDir)).toThrow(
      /Candidate release record not found for identifier 'nonexistent-deployment-id'/,
    );
  });

  test("a release record never claims candidate checks that did not run (am-release-records-claim-unrun-checks-xxri)", () => {
    const record = candidateRecordWithoutChecks({
      toolRunId: "20260924T000000Z-test",
      createdAt: "2026-09-24T00:00:00.000Z",
      commit: "0123456789012345678901234567890123456789",
      profile: "scaffold",
      candidateUrl: "https://example.invalid/candidate",
    });
    // No candidate check exists yet, so the record must say so rather than claim a pass.
    expect(record.candidateChecksPassed).toBe(false);
    expect(record.candidateCheckSummary ?? "").toMatch(/^not-implemented: /);
    // And a record nobody verified cannot be promoted through --promote.
    expect(() =>
      validatePromotePreconditions({ record, currentHeadCommit: record.commit }),
    ).toThrow(/has failed candidate checks/i);
  });
});

describe("a failed command says what went wrong (dispatch 476)", () => {
  /* The real seam: `run` spawns through activeSpawn, so a fake spawn exercises the actual failing
   * path rather than a reimplementation of it. A deploy of 44 commits was refused with the single
   * line "vercel exited with status 1", because the throw happened before stderr was read. */
  const fakeSpawn = (
    result: Partial<ReturnType<typeof import("node:child_process").spawnSync>>,
  ): SpawnFn => (() => ({ status: 1, stdout: "", stderr: "", ...result })) as unknown as SpawnFn;

  test("the thrown message carries the captured stderr, after the status", () => {
    __setSpawnForTesting(
      fakeSpawn({
        status: 1,
        stderr:
          "Error: You have reached your daily deployment limit.\nUpgrade your plan or wait 6 hours.",
      }),
    );
    try {
      expect(() => run("vercel", ["deploy", "--prebuilt", "--prod"], true)).toThrow(
        /exited with status 1/u,
      );
      let message = "";
      try {
        run("vercel", ["deploy", "--prebuilt", "--prod"], true);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      // The status first, because it is the first thing to know; then the reason.
      expect(message.indexOf("exited with status 1")).toBeLessThan(
        message.indexOf("daily deployment limit"),
      );
      expect(message).toContain("Upgrade your plan or wait 6 hours.");
      expect(message).toContain("It ran as: vercel deploy --prebuilt --prod");
    } finally {
      __resetSpawnForTesting();
    }
  });

  test("a command that failed with output only on stdout still explains itself", () => {
    __setSpawnForTesting(fakeSpawn({ status: 2, stdout: "gate failed: budgets.ts over budget" }));
    try {
      let message = "";
      try {
        run("bun", ["scripts/quality-gates.ts"], true);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain("exited with status 2");
      expect(message).toContain("gate failed: budgets.ts over budget");
    } finally {
      __resetSpawnForTesting();
    }
  });

  test("a silent failure says the status code is all there was, rather than nothing", () => {
    // Otherwise an empty stderr and a discarded stderr look identical to the operator, which is the
    // ambiguity that made the original defect survive.
    __setSpawnForTesting(fakeSpawn({ status: 1 }));
    try {
      let message = "";
      try {
        run("vercel", ["alias", "set", "x", "y"], true);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain("wrote nothing to stdout or stderr");
    } finally {
      __resetSpawnForTesting();
    }
  });

  test("an uncaptured command points at the terminal instead of implying silence", () => {
    // No captured output at all, which is what stdio: inherit leaves behind.
    __setSpawnForTesting(fakeSpawn({ status: 1 }));
    try {
      let message = "";
      try {
        run("bun", ["run", "build"], false);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain("went to this terminal");
      expect(message).toContain("the lines above");
    } finally {
      __resetSpawnForTesting();
    }
  });

  test("the output is bounded by lines and by characters, and keeps the END", () => {
    // A bound that kept the head would throw away the reason, which tools print last.
    const many = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join("\n");
    const tail = outputTail(many, FAILED_COMMAND_STDERR_LINES, FAILED_COMMAND_MAX_CHARS);
    expect(tail.split("\n")).toHaveLength(FAILED_COMMAND_STDERR_LINES);
    expect(tail.endsWith("line 500")).toBe(true);
    expect(tail).not.toContain("line 460\n");

    // One enormous line must not defeat the line bound.
    const wall = `${"x".repeat(50_000)}\nthe actual reason`;
    const capped = outputTail(wall, FAILED_COMMAND_STDERR_LINES, FAILED_COMMAND_MAX_CHARS);
    expect(capped.length).toBeLessThanOrEqual(FAILED_COMMAND_MAX_CHARS + 3);
    expect(capped.endsWith("the actual reason")).toBe(true);

    // And the two tails together stay within the one budget.
    const message = describeCommandFailure("vercel", ["deploy"], true, {
      status: 1,
      stdout: many,
      stderr: many,
    });
    expect(message.length).toBeLessThan(FAILED_COMMAND_MAX_CHARS + 600);
  });

  test("a value following a secret-named flag is replaced, and a path is not", () => {
    expect(
      redactArgs(["deploy", "--token", "abc123", "--authorization", "auth/deploy.json"]),
    ).toEqual(["deploy", "--token", "<redacted>", "--authorization", "auth/deploy.json"]);
    expect(redactArgs(["--api-key=sk-live-1", "--profile=launch"])).toEqual([
      "--api-key=<redacted>",
      "--profile=launch",
    ]);
    // The real guarantee is the negative: nothing here reads process.env, and the message is built
    // only from the command, its arguments and its own output.
    const message = describeCommandFailure("vercel", ["deploy", "--token", "abc123"], true, {
      status: 1,
      stderr: "nope",
    });
    expect(message).not.toContain("abc123");
    expect(message).toContain("<redacted>");
  });

  test("a refused gate chain carries the chain's own output, not just its exit code", () => {
    // MEASURED, not imagined: a candidate-only run refused at the gates produced a deploy log of
    // two lines for a chain that had printed the failing step and a formatter diagnostic naming the
    // file. The gates are spawned directly rather than through run(), with no stdio option, which
    // spawnSync defaults to "pipe", so everything was captured and dropped.
    let message = "";
    try {
      assertQualityGatesResult(1, "preflight-quality-gates", {
        stdout: "Checked 4307 files in 2s.\nFound 1 error.",
        stderr:
          "x [3/10] Biome linter check (lint) FAILED with exit code 1\ncontent/editorial-notes/brownian-motion/note-bm-k-is-viscosity.json format",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("exit code 1");
    expect(message).toContain("Biome linter check (lint) FAILED");
    expect(message).toContain("note-bm-k-is-viscosity.json");
    expect(message).toContain("Found 1 error.");
    // The exit code still comes first, and exit 2 keeps its own distinct wording.
    expect(message.indexOf("exit code 1")).toBeLessThan(message.indexOf("Biome"));
    expect(() => assertQualityGatesResult(2, "preflight-quality-gates", { stderr: "x" })).toThrow(
      /unavailable \(exit 2\)/u,
    );
    // A passing chain still throws nothing, and the old two-argument contract still holds.
    expect(() => assertQualityGatesResult(0, "preflight-quality-gates")).not.toThrow();
    expect(() => assertQualityGatesResult(1, "preflight-quality-gates")).toThrow(/exit code 1/u);
  });

  test("a gate chain that printed nothing says so rather than looking discarded", () => {
    let message = "";
    try {
      assertQualityGatesResult(1, "preflight-quality-gates", { stdout: "", stderr: "" });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("wrote nothing");
  });

  test("the gate STEP hands the chain's output to the refusal, not only the exit code", () => {
    // This is the test the first attempt did not have: a plant that stopped the call site passing
    // the output left every test green, because they reached assertQualityGatesResult and not the
    // line that feeds it. runPreflightQualityGates exists so this seam is reachable.
    __setSpawnForTesting(
      fakeSpawn({
        status: 1,
        stdout: "Steps Failed:  1",
        stderr: "x [3/10] Biome linter check (lint) FAILED with exit code 1",
      }),
    );
    try {
      let message = "";
      try {
        runPreflightQualityGates("scaffold");
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain("preflight-quality-gates");
      expect(message).toContain("Biome linter check (lint) FAILED");
      expect(message).toContain("Steps Failed:  1");
    } finally {
      __resetSpawnForTesting();
    }
  });

  test("a passing gate chain refuses nothing", () => {
    __setSpawnForTesting(fakeSpawn({ status: 0, stdout: "all green" }));
    try {
      expect(() => runPreflightQualityGates("scaffold")).not.toThrow();
    } finally {
      __resetSpawnForTesting();
    }
  });
});

describe("the direct path moves no alias unless every candidate check passed (am-rc1001-bridge-plan-pcjk.6)", () => {
  const passed = (name: string) => ({ name, status: "passed" as const, detail: "ok" });
  const unavailable = (name: string) => ({
    name,
    status: "not-available" as const,
    detail: "browser probe could not launch",
  });

  test("every check passed: the direct path may promote", () => {
    expect(directPromotionRefusal([passed("a"), passed("b")])).toBeUndefined();
  });

  test("a NOT-AVAILABLE check refuses, and is named with its status", () => {
    // The planted case. Until 2026-10-02 only `failed` blocked the direct path, so this exact
    // shape, the probe unable to launch, moved the aliases with two required checks unrun.
    const refusal = directPromotionRefusal([
      passed("paper-pages-served-as-built"),
      unavailable("accepted-wasm-result-per-capability"),
      unavailable("deliberate-typed-refusal"),
    ]);
    expect(refusal).toBeDefined();
    expect(refusal).toContain("accepted-wasm-result-per-capability (not-available)");
    expect(refusal).toContain("deliberate-typed-refusal (not-available)");
  });

  test("a failed check refuses too, and an empty result set is never a pass", () => {
    expect(
      directPromotionRefusal([passed("a"), { name: "b", status: "failed", detail: "x" }]),
    ).toContain("b (failed)");
    expect(directPromotionRefusal([])).toContain("no candidate check produced a result");
  });

  test("the direct path and --promote agree on the same results", () => {
    // Both read allCandidateChecksPassed: the direct path through directPromotionRefusal, --promote
    // through the record's candidateChecksPassed. A record built from not-available results is
    // refused by both.
    const results = [passed("a"), unavailable("b")];
    const record = candidateRecordWithChecks(
      candidateRecordWithoutChecks({
        toolRunId: "20261002T000000Z-test",
        createdAt: "2026-10-02T00:00:00.000Z",
        commit: "0123456789012345678901234567890123456789",
        profile: "scaffold",
        candidateUrl: "https://example.invalid/candidate",
      }),
      results,
    );
    expect(record.candidateChecksPassed).toBe(false);
    expect(directPromotionRefusal(results)).toBeDefined();
    expect(() =>
      validatePromotePreconditions({ record, currentHeadCommit: record.commit }),
    ).toThrow(/has failed candidate checks/i);
  });
});
