/**
 * Tracked-imports gate (am-zm52).
 *
 * Runs against the real index and disk, and against fixtures that drive the
 * states the live tree cannot be asked to hold on demand.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  describeUntrackedImports,
  findUntrackedImports,
  type TrackedImportProbe,
} from "./trackedImports.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

function gitTrackedFiles(root: string): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((line) => line.length > 0);
}

/**
 * Ignored status for a batch of paths, in one git call.
 *
 * `git check-ignore` exits 1 when nothing matches, which is a normal answer
 * here and not a failure, so the exit code is read rather than thrown on.
 */
function gitIgnored(root: string, paths: readonly string[]): Set<string> {
  if (paths.length === 0) return new Set();
  let stdout: string;
  try {
    stdout = execFileSync("git", ["check-ignore", "--stdin"], {
      cwd: root,
      encoding: "utf8",
      input: `${paths.join("\n")}\n`,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    // `git check-ignore` exits 1 when NOTHING matched. That is the ordinary
    // answer here, not a failure, and throwing on it would have turned "no
    // path is ignored" into a broken gate. Exit 128 is a real git error.
    const failure = err as { status?: number; stdout?: string; stderr?: string };
    if (failure.status !== 1) {
      throw new Error(
        `git check-ignore failed (status ${failure.status}): ${failure.stderr ?? ""}`,
      );
    }
    stdout = failure.stdout ?? "";
  }
  const trimmed = stdout.trim();
  return new Set(trimmed.length > 0 ? trimmed.split("\n") : []);
}

function diskProbe(root: string): TrackedImportProbe {
  const ignoredAnswers = new Map<string, boolean>();
  const pending: string[] = [];
  return {
    trackedFiles: gitTrackedFiles(root),
    readFile: (rel) => readFileSync(join(root, rel), "utf8"),
    // A regular file, not merely a path. `@/components` resolves its first
    // candidate to the DIRECTORY src/components, which exists; treating that as
    // the resolved module reported it untracked, since git tracks files only.
    exists: (rel) => {
      try {
        return statSync(join(root, rel)).isFile();
      } catch {
        return false;
      }
    },
    isIgnored: (rel) => {
      const known = ignoredAnswers.get(rel);
      if (known !== undefined) return known;
      pending.push(rel);
      const answered = gitIgnored(root, pending.splice(0, pending.length));
      for (const path of answered) ignoredAnswers.set(path, true);
      const verdict = answered.has(rel);
      ignoredAnswers.set(rel, verdict);
      return verdict;
    },
  };
}

describe("tracked imports (am-zm52)", () => {
  test("every module a tracked file imports is itself tracked", () => {
    const violations = findUntrackedImports(diskProbe(ROOT));
    assert.deepEqual(violations, [], describeUntrackedImports(violations));
  });

  // The defect's exact shape, which is the whole difficulty: the imported file
  // IS on disk, so every local check resolves it. A fixture that staged an
  // imaginary missing file would prove nothing, because that case fails
  // everywhere already and is not the invisible class.
  test("a tracked file importing a present but untracked sibling is a violation", () => {
    const probe: TrackedImportProbe = {
      trackedFiles: ["src/content/editions/editionContract.ts"],
      readFile: () => 'import { reconcile } from "./pageMapReconciliation.ts";\nreconcile();\n',
      exists: (rel) => rel === "src/content/editions/pageMapReconciliation.ts",
      isIgnored: () => false,
    };
    assert.deepEqual(findUntrackedImports(probe), [
      {
        from: "src/content/editions/editionContract.ts",
        specifier: "./pageMapReconciliation.ts",
        resolved: "src/content/editions/pageMapReconciliation.ts",
      },
    ]);
  });

  test("the same import is clean once the imported file is tracked", () => {
    const probe: TrackedImportProbe = {
      trackedFiles: [
        "src/content/editions/editionContract.ts",
        "src/content/editions/pageMapReconciliation.ts",
      ],
      readFile: () => 'import { reconcile } from "./pageMapReconciliation.ts";\nreconcile();\n',
      exists: () => true,
      isIgnored: () => false,
    };
    assert.deepEqual(findUntrackedImports(probe), []);
  });

  // The trap named in the bead. Generated output is untracked on purpose and a
  // clean checkout builds it, so firing here would make the gate noise and it
  // would be switched off. Ignored is benign; untracked and not ignored is not.
  test("a generated module that git ignores is not a violation, and the same path un-ignored is", () => {
    const base = {
      trackedFiles: ["src/content/generated/consumer.ts"],
      readFile: () => 'import { rows } from "./buildOutput.ts";\nrows();\n',
      exists: (rel: string) => rel === "src/content/generated/buildOutput.ts",
    };
    assert.deepEqual(
      findUntrackedImports({ ...base, isIgnored: () => true }),
      [],
      "gitignored build output is legitimately absent from a clean checkout",
    );
    assert.equal(
      findUntrackedImports({ ...base, isIgnored: () => false }).length,
      1,
      "the ignore answer, not the path, is what makes the difference",
    );
  });

  test("a specifier resolving to nothing at all is left to tsc, and external packages are ignored", () => {
    const probe: TrackedImportProbe = {
      trackedFiles: ["src/x/consumer.ts"],
      readFile: () =>
        'import { a } from "./nowhere.ts";\nimport { b } from "react";\nimport c from "node:fs";\n',
      exists: () => false,
      isIgnored: () => false,
    };
    assert.deepEqual(
      findUntrackedImports(probe),
      [],
      "an import nothing answers fails in every checkout alike; this gate is for the ones that do not",
    );
  });

  // Type-only imports are erased at runtime but TS2307 does not care, which is
  // why this gate asks for them and the client-boundary walker does not.
  test("a type-only import of an untracked module is a violation", () => {
    const probe: TrackedImportProbe = {
      trackedFiles: ["src/x/consumer.ts"],
      readFile: () => 'import type { Shape } from "./shapes.ts";\nexport type S = Shape;\n',
      exists: (rel) => rel === "src/x/shapes.ts",
      isIgnored: () => false,
    };
    assert.equal(findUntrackedImports(probe).length, 1);
  });

  // A specifier written inside a comment is not an import. The extractor strips
  // comments before matching, and this holds it to that.
  test("a specifier named only in a comment is not an import", () => {
    const probe: TrackedImportProbe = {
      trackedFiles: ["src/x/consumer.ts"],
      readFile: () => '// import { g } from "./ghost.ts";\nexport const value = 1;\n',
      exists: (rel) => rel === "src/x/ghost.ts",
      isIgnored: () => false,
    };
    assert.deepEqual(findUntrackedImports(probe), []);
  });

  // The full cycle against a REAL git index, because the fixtures above inject
  // their answers and an injected answer proves the rule, not the plumbing.
  // Here the imported file is genuinely on disk and genuinely in no commit,
  // which is 120c67e7's shape, and `git check-ignore` genuinely decides the
  // third arm.
  test("end to end against a real index: present-and-untracked is red, tracked is green, ignored is green", () => {
    const repo = join(
      "/Volumes/USBNVME16TB/temp_agent_space",
      `zm52-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    mkdirSync(join(repo, "src/editions"), { recursive: true });
    const git = (...args: string[]): void => {
      execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" });
    };
    git("init", "-q");
    git("config", "user.email", "gate@example.invalid");
    git("config", "user.name", "gate");

    writeFileSync(
      join(repo, "src/editions/editionContract.ts"),
      'import { reconcile } from "./pageMapReconciliation.ts";\nexport const run = () => reconcile();\n',
    );
    writeFileSync(
      join(repo, "src/editions/pageMapReconciliation.ts"),
      "export const reconcile = () => [];\n",
    );
    // Only the importer is committed. The imported file is on disk, so every
    // check that reads the disk resolves it; nothing but the index knows.
    git("add", "src/editions/editionContract.ts");
    git("commit", "-q", "-m", "commit the importer alone");

    assert.equal(
      statSync(join(repo, "src/editions/pageMapReconciliation.ts")).isFile(),
      true,
      "the imported file must be PRESENT, or this is the ordinary missing-file case",
    );

    const red = findUntrackedImports(diskProbe(repo));
    assert.deepEqual(red, [
      {
        from: "src/editions/editionContract.ts",
        specifier: "./pageMapReconciliation.ts",
        resolved: "src/editions/pageMapReconciliation.ts",
      },
    ]);

    git("add", "src/editions/pageMapReconciliation.ts");
    git("commit", "-q", "-m", "commit the imported module");
    assert.deepEqual(
      findUntrackedImports(diskProbe(repo)),
      [],
      "tracking the imported file is the repair, and the gate must accept it",
    );

    // Same shape, but the module is generated output git is told to ignore.
    // A clean checkout builds it, so this must NOT fire, and the decision is
    // made by real `git check-ignore` rather than by absence from the index.
    mkdirSync(join(repo, "src/generated"), { recursive: true });
    writeFileSync(
      join(repo, "src/editions/consumer.ts"),
      'import { rows } from "../generated/buildOutput.ts";\nexport const all = () => rows();\n',
    );
    writeFileSync(join(repo, "src/generated/buildOutput.ts"), "export const rows = () => [];\n");
    writeFileSync(join(repo, ".gitignore"), "src/generated/\n");
    git("add", "src/editions/consumer.ts", ".gitignore");
    git("commit", "-q", "-m", "commit a consumer of generated output");

    assert.deepEqual(
      findUntrackedImports(diskProbe(repo)),
      [],
      "gitignored build output is benign; firing here is what gets a gate switched off",
    );

    // And the control: the same file, same content, same place, with only the
    // ignore rule withdrawn. If this stayed green the arm above would prove
    // nothing about check-ignore.
    writeFileSync(join(repo, ".gitignore"), "# nothing ignored\n");
    const unignored = findUntrackedImports(diskProbe(repo));
    assert.deepEqual(
      unignored.map((v) => v.resolved),
      ["src/generated/buildOutput.ts"],
    );
  });
});
