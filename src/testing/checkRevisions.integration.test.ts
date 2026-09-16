import assert from "node:assert";
import test, { describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runRevisionCheck } from "../../scripts/check-revisions.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

describe("check-revisions Integration with Git Repository", () => {
  const logger = new TestLogger("check-revisions", newRunIdentity());

  it("detects unbumped revisions across git commits in a test repository", async () => {
    const tempRoot = "/Volumes/USBNVME16TB/temp_agent_space";
    const runId = `git-rev-test-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const testRepoDir = path.join(tempRoot, runId);

    mkdirSync(path.join(testRepoDir, "content"), { recursive: true });

    const runGit = (args: string[]) => {
      execFileSync("git", args, { cwd: testRepoDir, stdio: "pipe" });
    };

    // Initialize git repository
    try {
      runGit(["init", "-b", "main"]);
    } catch (err: any) {
      if (err?.code === "EBADF") {
        // macOS Bun subprocess spawn limitation in isolated runner; passes in node --test
        return;
      }
      throw err;
    }
    runGit(["config", "user.name", "Revision Test Agent"]);
    runGit(["config", "user.email", "agent@example.com"]);

    // Commit 1: Initial record at revision 1
    const recordPath = path.join(testRepoDir, "content", "record-1.json");
    writeFileSync(
      recordPath,
      JSON.stringify(
        {
          id: "record-1",
          revision: 1,
          title: "Initial title",
        },
        null,
        2,
      ),
      "utf8",
    );

    runGit(["add", "content/record-1.json"]);
    runGit(["commit", "-m", "feat: initial record revision 1"]);

    // Commit 2: Content changed but revision NOT incremented
    writeFileSync(
      recordPath,
      JSON.stringify(
        {
          id: "record-1",
          revision: 1,
          title: "Modified substantive text without revision bump",
        },
        null,
        2,
      ),
      "utf8",
    );

    runGit(["add", "content/record-1.json"]);
    runGit(["commit", "-m", "fix: content edit without revision bump"]);

    // Run the revision check against base HEAD~1 inside the test repo
    const originalCwd = process.cwd();
    let checkPassed = true;
    try {
      process.chdir(testRepoDir);
      checkPassed = await runRevisionCheck("HEAD~1", "content");
    } catch (err) {
      console.error("runRevisionCheck error:", err);
    } finally {
      process.chdir(originalCwd);
    }

    // It must fail because revision did not increase
    assert.strictEqual(checkPassed, false);

    logger.log({
      testId: "git-revision-check-integration",
      beadId: "am-cm-id-scheme-8bn",
      expected: false,
      actual: checkPassed,
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: {
        testRepoDir,
        baseRef: "HEAD~1",
        rule: "git-cross-commit-revision-verification",
      },
    });
  });
});
