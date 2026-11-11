/**
 * Independent proof for the architecture gate's tracked-identity census.
 * Run with Node before the production build so a broken prebuild gate cannot hide its tests.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  type ArchitectureManifestRead,
  checkArchitecture,
  collectRepoEntries,
  inspectArchitecturePopulation,
  readArchitectureManifest,
  type RepoEntry,
  writeGateLog,
} from "./app-router-architecture.ts";

const TRACKED = [
  "package.json",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "content/paper.yaml",
  "public/site.svg",
  "docs/guide.md",
  "scripts/check.ts",
  "perf/scenario.json",
  "ios/App.swift",
  ".github/workflows/check.yml",
  ".beads/issues.jsonl",
  "sources/paper/source.txt",
] as const;

const ENTRIES: readonly RepoEntry[] = [
  { path: "package.json", kind: "file" },
  { path: "src", kind: "directory" },
  { path: "src/app", kind: "directory" },
  { path: "src/app/layout.tsx", kind: "file" },
  { path: "src/app/page.tsx", kind: "file" },
  { path: "content", kind: "directory" },
  { path: "content/paper.yaml", kind: "file" },
  { path: "public", kind: "directory" },
  { path: "public/site.svg", kind: "file" },
  { path: "docs", kind: "directory" },
  { path: "docs/guide.md", kind: "file" },
  { path: "scripts", kind: "directory" },
  { path: "scripts/check.ts", kind: "file" },
  { path: "perf", kind: "directory" },
  { path: "perf/scenario.json", kind: "file" },
  { path: "ios", kind: "directory" },
  { path: "ios/App.swift", kind: "file" },
  { path: ".github", kind: "directory" },
  { path: ".beads", kind: "directory" },
  { path: "sources", kind: "directory" },
];

function manifest(paths: readonly string[] = TRACKED): ArchitectureManifestRead {
  return { status: 0, stdout: `${paths.join("\0")}\0`, stderr: "", failure: null };
}

describe("architecture tracked-identity completeness", () => {
  it("accepts every tracked identity without depending on generated build files", () => {
    const result = inspectArchitecturePopulation(ENTRIES, manifest());
    assert.equal(result.complete, true);
    assert.equal(result.examined, ENTRIES.length);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(
      new Set(result.expected.map((entry) => `${entry.kind}:${entry.path}`)),
      new Set(ENTRIES.map((entry) => `${entry.kind}:${entry.path}`)),
    );
  });

  it("refuses a missing tracked file even when generated extras exceed the old floor", () => {
    const entries: RepoEntry[] = [
      ...ENTRIES.filter((entry) => entry.path !== "src/app/layout.tsx"),
      ...Array.from({ length: 10_001 }, (_, index): RepoEntry => ({
        path: `src/generated/payload-${index}.ts`,
        kind: "file",
      })),
    ];
    const result = inspectArchitecturePopulation(entries, manifest());
    assert.equal(result.complete, false);
    assert.equal(result.examined, ENTRIES.length - 1);
    assert.deepEqual(result.missing, [{ path: "src/app/layout.tsx", kind: "file" }]);
  });

  it("refuses an absent whole subtree", () => {
    const result = inspectArchitecturePopulation(
      ENTRIES.filter((entry) => entry.path !== "content" && !entry.path.startsWith("content/")),
      manifest(),
    );
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, [
      { path: "content", kind: "directory" },
      { path: "content/paper.yaml", kind: "file" },
    ]);
  });

  it("does not let duplicate observed entries compensate for a missing identity", () => {
    const partial = ENTRIES.filter((entry) => entry.path !== "src/app/layout.tsx");
    const result = inspectArchitecturePopulation([...partial, ...partial], manifest());
    assert.equal(result.complete, false);
    assert.equal(result.examined, ENTRIES.length - 1);
  });

  it("requires ancestor directories to have directory identity", () => {
    const result = inspectArchitecturePopulation(
      ENTRIES.map((entry): RepoEntry =>
        entry.path === "src" ? { path: "src", kind: "file" } : entry,
      ),
      manifest(),
    );
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, [{ path: "src", kind: "directory" }]);
  });

  it("requires tracked leaf files to have file identity", () => {
    const result = inspectArchitecturePopulation(
      ENTRIES.map((entry): RepoEntry =>
        entry.path === "public/site.svg" ? { path: entry.path, kind: "directory" } : entry,
      ),
      manifest(),
    );
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, [{ path: "public/site.svg", kind: "file" }]);
  });

  it("uses precisely the walker's recursive scope and exclusions", () => {
    const extraPaths = [
      ".git/config",
      "src/.git/config",
      "src/.next/server.js",
      "src/vendor/node_modules/package/index.js",
      "scripts/vendor/.git/config",
      "node_modules/package/index.js",
      ".next/server.js",
      "sources/another/archive.txt",
      ".github/deeper/unscanned.txt",
    ];
    const entries: RepoEntry[] = [
      ...ENTRIES,
      { path: "src/vendor", kind: "directory" },
      { path: "scripts/vendor", kind: "directory" },
      { path: "node_modules", kind: "directory" },
      { path: ".next", kind: "directory" },
    ];
    const result = inspectArchitecturePopulation(entries, manifest([...TRACKED, ...extraPaths]));
    assert.equal(result.complete, true);
    assert.equal(result.expected.length, entries.length);
    assert.equal(result.expected.some((entry) => entry.path.includes(".git/")), false);
    assert.equal(result.expected.some((entry) => entry.path.startsWith("sources/")), false);
    assert.equal(result.expected.some((entry) => entry.path.startsWith("node_modules/")), false);
  });

  it("refuses a required root represented only by excluded descendants", () => {
    const paths = TRACKED.filter((path) => !path.startsWith("content/"));
    const result = inspectArchitecturePopulation(
      ENTRIES,
      manifest([...paths, "content/node_modules/hidden.ts"]),
    );
    assert.equal(result.complete, false);
    assert.ok(result.problems.some((problem) => problem.includes("content/")));
  });

  it("refuses an otherwise populated manifest missing a required root", () => {
    const result = inspectArchitecturePopulation(
      ENTRIES,
      manifest(TRACKED.filter((path) => !path.startsWith("ios/"))),
    );
    assert.equal(result.complete, false);
    assert.ok(result.problems.some((problem) => problem.includes("ios/")));
  });

  it("includes optional legacy roots when present without admitting them architecturally", () => {
    const entries: RepoEntry[] = [
      ...ENTRIES,
      { path: "pages", kind: "directory" },
      { path: "pages/index.tsx", kind: "file" },
      { path: "app", kind: "directory" },
      { path: "app/page.tsx", kind: "file" },
    ];
    const result = inspectArchitecturePopulation(
      entries,
      manifest([...TRACKED, "pages/index.tsx", "app/page.tsx"]),
    );
    assert.equal(result.complete, true);
    assert.equal(result.expected.length, ENTRIES.length + 4);
    const violations = checkArchitecture(entries, () => false, {});
    assert.ok(violations.some((violation) => violation.rule === "rule-1-pages-router"));
    assert.ok(violations.some((violation) => violation.rule === "rule-2-second-app-root"));
  });

  it("still checks untracked forbidden files against the architectural rules", () => {
    const entries: RepoEntry[] = [
      ...ENTRIES,
      { path: "src/pages/index.tsx", kind: "file" },
      { path: "unapproved.txt", kind: "file" },
    ];
    assert.equal(inspectArchitecturePopulation(entries, manifest()).complete, true);
    const violations = checkArchitecture(entries, () => false, {});
    assert.ok(
      violations.some(
        (violation) =>
          violation.path === "src/pages/index.tsx" && violation.rule === "rule-1-pages-router",
      ),
    );
    assert.ok(
      violations.some(
        (violation) =>
          violation.path === "unapproved.txt" && violation.rule === "rule-4-root-allowlist",
      ),
    );
  });

  const unreadable: readonly [string, ArchitectureManifestRead][] = [
    ["missing Git", { status: null, stdout: "", stderr: "", failure: "spawn git ENOENT" }],
    ["Git error", { status: 128, stdout: "", stderr: "not a git repository", failure: null }],
    ["failed Git with partial output", { ...manifest(), status: 1, stderr: "read failed" }],
    ["empty manifest", { ...manifest(), stdout: "" }],
    ["unterminated manifest", { ...manifest(), stdout: TRACKED.join("\0") }],
    ["empty path", { ...manifest(), stdout: manifest().stdout + "\0" }],
    ["duplicate path", manifest([...TRACKED, "src/app/layout.tsx"])],
    ["absolute path", manifest([...TRACKED, "/outside.ts"])],
    ["parent traversal", manifest([...TRACKED, "src/../outside.ts"])],
    ["dot component", manifest([...TRACKED, "src/./outside.ts"])],
    ["empty component", manifest([...TRACKED, "src//outside.ts"])],
    ["backslash path", manifest([...TRACKED, "src\\outside.ts"])],
    ["conflicting file ancestor", manifest([...TRACKED, "src/app"])],
  ];
  for (const [name, input] of unreadable) {
    it(`fails closed for ${name}`, () => {
      const result = inspectArchitecturePopulation(ENTRIES, input);
      assert.equal(result.complete, false);
      assert.equal(result.examined, 0);
      assert.ok(result.problems.length > 0);
    });
  }

  it("records a refused census as failed even when no architectural rule was violated", () => {
    const entries = ENTRIES.filter((entry) => entry.path !== "src/app/layout.tsx");
    const population = inspectArchitecturePopulation(entries, manifest());
    const artifacts = mkdtempSync(join(tmpdir(), "annus-architecture-log-"));
    const { logPath, evidenceDir } = writeGateLog(
      artifacts,
      "missing-tracked-file",
      entries,
      [],
      population,
    );
    const rows = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(rows.at(-1)?.outcome, "failed");
    assert.equal(rows.at(-1)?.violations, 0);
    assert.ok(evidenceDir);
    assert.deepEqual(rows.find((row) => row.population)?.population.missing, [
      { path: "src/app/layout.tsx", kind: "file" },
    ]);
  });
});

describe("filesystem and Git manifest boundary", () => {
  it("collects tracked symlinks as leaf files without following their targets", () => {
    const root = mkdtempSync(join(tmpdir(), "annus-architecture-links-"));
    const target = mkdtempSync(join(tmpdir(), "annus-architecture-target-"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(target, "outside.ts"), "outside checkout");
    symlinkSync(target, join(root, "src", "linked"));
    const entries = collectRepoEntries(root);
    assert.ok(entries.some((entry) => entry.path === "src/linked" && entry.kind === "file"));
    assert.equal(entries.some((entry) => entry.path.includes("outside.ts")), false);
    const result = inspectArchitecturePopulation(
      [...ENTRIES, ...entries],
      manifest([...TRACKED, "src/linked"]),
    );
    assert.equal(result.complete, true);
  });

  it("refuses a root directory replaced by a symlink without walking outside the checkout", () => {
    const root = mkdtempSync(join(tmpdir(), "annus-architecture-root-link-"));
    const target = mkdtempSync(join(tmpdir(), "annus-architecture-root-target-"));
    writeFileSync(join(target, "outside.ts"), "outside checkout");
    symlinkSync(target, join(root, "src"));
    const entries = collectRepoEntries(root);
    assert.deepEqual(entries, [{ path: "src", kind: "file" }]);
    const result = inspectArchitecturePopulation(
      [
        ...ENTRIES.filter((entry) => entry.path !== "src" && !entry.path.startsWith("src/")),
        ...entries,
      ],
      manifest(),
    );
    assert.equal(result.complete, false);
    assert.ok(result.missing.some((entry) => entry.path === "src" && entry.kind === "directory"));
  });

  it("refuses when the working directory has no Git manifest", () => {
    const root = mkdtempSync(join(tmpdir(), "annus-architecture-no-git-"));
    const read = readArchitectureManifest(root);
    assert.notEqual(read.status, 0);
    assert.equal(inspectArchitecturePopulation(ENTRIES, read).complete, false);
  });

  it("matches every in-scope tracked identity in the actual checkout", () => {
    const result = inspectArchitecturePopulation(
      collectRepoEntries(process.cwd()),
      readArchitectureManifest(process.cwd()),
    );
    assert.ok(result.expected.length > 0, "the repository manifest must not be empty");
    assert.equal(
      result.complete,
      true,
      JSON.stringify({ missing: result.missing, problems: result.problems }),
    );
    assert.equal(result.examined, result.expected.length);
  });
});
