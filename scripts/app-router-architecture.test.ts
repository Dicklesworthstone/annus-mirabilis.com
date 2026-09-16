/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/app-router-architecture.test.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Added comprehensive unit and integration tests for all 5 architecture rules.
 * - Added fixtures for clean repos, Pages Router, nested route groups, ignored entries, sources/ checks, and scratch files.
 * - Added allowlist validation tests and structured evidence logging tests.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  type Allowlist,
  checkArchitecture,
  generateLogRunId,
  loadAllowlist,
  matchesAllowlist,
  type RepoEntry,
  writeGateLog,
} from "./app-router-architecture.ts";

const BASE_ALLOWLIST: Allowlist = {
  "README.md": "Repository overview and reader entry point",
  "AGENTS.md": "Binding repository instructions and rules for AI coding agents",
  LICENSE: "Primary repository license (MIT License with OpenAI/Anthropic Rider)",
  "NOTICE.md": "Attribution and license notices for third-party and donor materials",
  "THIRD_PARTY_NOTICES.md": "Third-party software dependencies license notices",
  "COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md":
    "Authoritative project master plan (v2.0)",
  "COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md":
    "Authoritative native iPhone app master plan (v1.0)",
  "COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA.md": "Committed historical plan draft (ASTRA)",
  "COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA_V2.md":
    "Committed historical plan draft (ASTRA v2)",
  "COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_FABLE.md": "Committed historical plan draft (FABLE)",
  "package.json": "Package manifest and dependency configuration",
  "bun.lock": "Bun text lockfile pinning exact dependency revisions",
  "bunfig.toml": "Bun runtime and package manager configuration",
  "tsconfig.json": "TypeScript compiler strict configuration",
  "biome.json": "Biome linter and formatter configuration",
  "next.config.*": "Next.js framework build and runtime configuration",
  "next-env.d.ts": "Next.js auto-generated TypeScript declarations",
  "postcss.config.*": "PostCSS plugin configuration",
  "playwright.config.ts": "Playwright end-to-end testing configuration",
  "vercel.json": "Vercel platform deployment and headers configuration",
  ".vercelignore": "Vercel deployment upload ignore rules",
  ".gitignore": "Git version control file ignore rules",
  ".gitattributes": "Git repository path attributes",
  src: "Application source code (App Router, components, physics, reader)",
  content: "Declarative critical edition content records and metadata",
  public: "Static public assets, facsimiles, and self-hosted fonts",
  docs: "Documentation, architecture audit records, and specifications",
  scripts: "Build, verification, deployment, and test automation scripts",
  ios: "Native iOS Swift application project and assets",
  perf: "Performance benchmarks and telemetry scenarios",
  ".beads": "Beads task management tracking directory",
  ".github": "GitHub Actions CI/CD workflows and repository automation",
};

describe("App Router Architecture Gate", () => {
  describe("Clean repository fixture", () => {
    it("accepts a clean App Router repository with zero violations", () => {
      const cleanEntries: RepoEntry[] = [
        { path: "README.md", kind: "file" },
        { path: "package.json", kind: "file" },
        { path: "next.config.mjs", kind: "file" },
        { path: "src", kind: "directory" },
        { path: "src/app", kind: "directory" },
        { path: "src/app/page.tsx", kind: "file" },
        { path: "src/app/layout.tsx", kind: "file" },
        { path: "src/app/error.tsx", kind: "file" },
        { path: "src/app/not-found.tsx", kind: "file" },
        { path: "src/app/(reader)/papers/page.tsx", kind: "file" },
        { path: "src/app/embed/lab/[experiment]/page.tsx", kind: "file" },
        { path: "src/components/edition/Formula.tsx", kind: "file" },
        { path: "src/reader/ReaderLayout.tsx", kind: "file" },
        { path: "src/physics/reference/brownian.ts", kind: "file" },
        { path: "content/papers/brownian-motion.yaml", kind: "file" },
        { path: "public/figures/hero.svg", kind: "file" },
        { path: "docs/DONOR_AUDIT.md", kind: "file" },
        { path: "scripts/app-router-architecture.ts", kind: "file" },
      ];

      const violations = checkArchitecture(cleanEntries, () => false, BASE_ALLOWLIST);
      assert.deepEqual(violations, []);
    });
  });

  describe("Rule 1: Pages Router directory", () => {
    it("rejects src/pages directory alone", () => {
      const entries: RepoEntry[] = [{ path: "src/pages", kind: "directory" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-1-pages-router");
      assert.equal(violations[0].path, "src/pages");
      assert.match(violations[0].message, /All routes belong in 'src\/app\/'/);
      assert.match(violations[0].repair, /move route definitions to 'src\/app\/'/);
    });

    it("rejects src/pages/.keep", () => {
      const entries: RepoEntry[] = [{ path: "src/pages/.keep", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-1-pages-router");
      assert.equal(violations[0].path, "src/pages/.keep");
    });

    it("rejects src/pages/.keep even when ignore predicate returns true", () => {
      const entries: RepoEntry[] = [{ path: "src/pages/.keep", kind: "file" }];
      // Even if gitignore ignores src/pages, rule 1 MUST fail
      const violations = checkArchitecture(entries, () => true, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-1-pages-router");
    });

    it("rejects root pages/index.tsx", () => {
      const entries: RepoEntry[] = [{ path: "pages/index.tsx", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-1-pages-router");
      assert.equal(violations[0].path, "pages/index.tsx");
    });
  });

  describe("Rule 2: Second App Router root and special files", () => {
    it("rejects root-level app/page.tsx", () => {
      const entries: RepoEntry[] = [{ path: "app/page.tsx", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.ok(violations.length >= 1);
      assert.ok(
        violations.some((v) => v.rule === "rule-2-second-app-root" && v.path === "app/page.tsx"),
      );
    });

    it("rejects src/other/layout.tsx", () => {
      const entries: RepoEntry[] = [{ path: "src/other/layout.tsx", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-2-second-app-root");
      assert.equal(violations[0].path, "src/other/layout.tsx");
      assert.match(violations[0].repair, /ReaderLayout\.tsx/);
    });

    it("rejects src/reader/route.ts", () => {
      const entries: RepoEntry[] = [{ path: "src/reader/route.ts", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-2-second-app-root");
      assert.equal(violations[0].path, "src/reader/route.ts");
    });

    it("rejects docs/site/next.config.mjs", () => {
      const entries: RepoEntry[] = [{ path: "docs/site/next.config.mjs", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-2-second-app-root");
      assert.equal(violations[0].path, "docs/site/next.config.mjs");
    });

    it("accepts valid route groups and component names inside and outside src/app/", () => {
      const entries: RepoEntry[] = [
        { path: "src/app/(reader)/papers/page.tsx", kind: "file" },
        { path: "src/app/embed/lab/[experiment]/page.tsx", kind: "file" },
        { path: "src/reader/ReaderLayout.tsx", kind: "file" },
        { path: "next.config.mjs", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.deepEqual(violations, []);
    });

    it("rejects pages directory under ios/ (e.g. ios/App/pages/index.swift)", () => {
      const entries: RepoEntry[] = [{ path: "ios/App/pages/index.swift", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-2-second-app-root");
      assert.equal(violations[0].path, "ios/App/pages/index.swift");
    });
  });

  describe("Rule 3: Legacy file names", () => {
    it("rejects src/components/_document.tsx", () => {
      const entries: RepoEntry[] = [{ path: "src/components/_document.tsx", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-3-legacy-files");
      assert.equal(violations[0].path, "src/components/_document.tsx");
    });

    it("rejects src/app/_error.jsx", () => {
      const entries: RepoEntry[] = [{ path: "src/app/_error.jsx", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-3-legacy-files");
      assert.equal(violations[0].path, "src/app/_error.jsx");
    });

    it("rejects src/_app.tsx", () => {
      const entries: RepoEntry[] = [{ path: "src/_app.tsx", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-3-legacy-files");
      assert.equal(violations[0].path, "src/_app.tsx");
    });
  });

  describe("Rule 4: Root allowlist", () => {
    it("fails on unignored root scratch.ts", () => {
      const entries: RepoEntry[] = [{ path: "scratch.ts", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-4-root-allowlist");
      assert.equal(violations[0].path, "scratch.ts");
    });

    it("fails on unignored stray fix_script.py at root", () => {
      const entries: RepoEntry[] = [{ path: "fix_script.py", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-4-root-allowlist");
      assert.equal(violations[0].path, "fix_script.py");
    });

    it("passes ignored root entries (e.g. node_modules, artifacts, generated)", () => {
      const entries: RepoEntry[] = [
        { path: "node_modules", kind: "directory" },
        { path: "artifacts", kind: "directory" },
        { path: "generated", kind: "directory" },
      ];
      const ignoredSet = new Set(["node_modules", "artifacts", "generated"]);
      const violations = checkArchitecture(entries, (p) => ignoredSet.has(p), BASE_ALLOWLIST);
      assert.deepEqual(violations, []);
    });

    it("passes root COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA_V2.md", () => {
      const entries: RepoEntry[] = [
        { path: "COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA_V2.md", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.deepEqual(violations, []);
    });

    it("fails on root tailwind.config.ts until allowlist gains it with a reason", () => {
      const entries: RepoEntry[] = [{ path: "tailwind.config.ts", kind: "file" }];
      // Without tailwind in allowlist -> fails
      const violationsBefore = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violationsBefore.length, 1);
      assert.equal(violationsBefore[0].rule, "rule-4-root-allowlist");

      // With tailwind in allowlist -> passes
      const updatedAllowlist = {
        ...BASE_ALLOWLIST,
        "tailwind.config.ts": "Tailwind CSS styling configuration",
      };
      const violationsAfter = checkArchitecture(entries, () => false, updatedAllowlist);
      assert.deepEqual(violationsAfter, []);
    });

    it("handles root sources/ directory: passes when ignored, fails when not ignored", () => {
      const entries: RepoEntry[] = [{ path: "sources", kind: "directory" }];

      // Ignored: passes
      const violationsIgnored = checkArchitecture(
        entries,
        (p) => p === "sources" || p === "sources/",
        BASE_ALLOWLIST,
      );
      assert.deepEqual(violationsIgnored, []);

      // Not ignored: fails with explicit must-be-ignored message
      const violationsNotIgnored = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violationsNotIgnored.length, 1);
      assert.equal(violationsNotIgnored[0].rule, "rule-4-root-allowlist");
      assert.match(violationsNotIgnored[0].message, /must never be committed/);
    });

    it("passes source-layer paths inside allowlisted directories (scripts/sources, docs/)", () => {
      const entries: RepoEntry[] = [
        { path: "scripts/sources/facsimile-sources/ap-17-549.yaml", kind: "file" },
        { path: "scripts/sources/ocr-instructions/v1.md", kind: "file" },
        { path: "docs/provenance/survey/ap-17-549.md", kind: "file" },
        { path: "docs/rights-vocabulary.yaml", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.deepEqual(violations, []);
    });
  });

  describe("Rule 5: Scratch files in the source tree", () => {
    it("fails on src/physics/fix_units.py", () => {
      const entries: RepoEntry[] = [{ path: "src/physics/fix_units.py", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-5-scratch-files");
      assert.equal(violations[0].path, "src/physics/fix_units.py");
    });

    it("fails on content/equations/notes.wip.md", () => {
      const entries: RepoEntry[] = [{ path: "content/equations/notes.wip.md", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-5-scratch-files");
      assert.equal(violations[0].path, "content/equations/notes.wip.md");
    });

    it("fails on public/figures/diagram.orig", () => {
      const entries: RepoEntry[] = [{ path: "public/figures/diagram.orig", kind: "file" }];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "rule-5-scratch-files");
      assert.equal(violations[0].path, "public/figures/diagram.orig");
    });

    it("fails on scratch/tmp_/debug_ files in src/", () => {
      const entries: RepoEntry[] = [
        { path: "src/scratch_notes.ts", kind: "file" },
        { path: "src/components/tmp_button.tsx", kind: "file" },
        { path: "src/physics/debug_helpers.ts", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.equal(violations.length, 3);
      assert.ok(violations.every((v) => v.rule === "rule-5-scratch-files"));
    });

    it("passes scripts/ files (Rule 5 does not cover scripts/)", () => {
      const entries: RepoEntry[] = [
        { path: "scripts/digitize-datasets/README.md", kind: "file" },
        { path: "scripts/generate-lab.mjs", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      assert.deepEqual(violations, []);
    });
  });

  describe("Allowlist Loader & Validation", () => {
    it("loads valid allowlist from scripts/architecture-allowlist.json", () => {
      const allowlistPath = join(process.cwd(), "scripts", "architecture-allowlist.json");
      const loaded = loadAllowlist(allowlistPath);
      assert.ok(loaded["README.md"]);
      assert.ok(loaded["package.json"]);
      assert.ok(loaded["src"]);
    });

    it("rejects an allowlist entry missing a reason", () => {
      assert.throws(() => {
        loadAllowlist({
          "README.md": "",
        });
      }, /must have a valid non-empty reason/);

      assert.throws(() => {
        loadAllowlist({
          "README.md": "   ",
        });
      }, /must have a valid non-empty reason/);
    });

    it("supports wildcard matches", () => {
      assert.equal(matchesAllowlist("next.config.mjs", BASE_ALLOWLIST), true);
      assert.equal(matchesAllowlist("next.config.ts", BASE_ALLOWLIST), true);
      assert.equal(matchesAllowlist("postcss.config.mjs", BASE_ALLOWLIST), true);
      assert.equal(matchesAllowlist("unrelated.config.mjs", BASE_ALLOWLIST), false);
    });
  });

  describe("Structured Logging and Evidence", () => {
    it("generates logRunId matching YYYYMMDDTHHMMSSZ-<8 hex> format", () => {
      const id = generateLogRunId();
      assert.match(id, /^\d{8}T\d{6}Z-[0-9a-f]{8}$/);
    });

    it("writes JSONL logs and creates evidence files on violation", () => {
      const logRunId = generateLogRunId();
      const fakeArtifactsDir = join(process.cwd(), "artifacts");
      const fakeEntries: RepoEntry[] = [
        { path: "src/pages/.keep", kind: "file" },
        { path: "scratch.ts", kind: "file" },
      ];
      const fakeViolations = checkArchitecture(fakeEntries, () => false, BASE_ALLOWLIST);

      const { logPath, evidenceDir } = writeGateLog(
        fakeArtifactsDir,
        logRunId,
        fakeEntries,
        fakeViolations,
      );

      assert.ok(existsSync(logPath));
      const content = readFileSync(logPath, "utf8");
      const lines = content.trim().split("\n");
      assert.equal(lines.length, 3); // 2 violations + 1 summary

      const v1 = JSON.parse(lines[0]);
      assert.equal(v1.suite, "architecture");
      assert.equal(v1.logRunId, logRunId);
      assert.equal(v1.rule, "rule-1-pages-router");

      const summary = JSON.parse(lines[2]);
      assert.equal(summary.outcome, "failed");
      assert.equal(summary.violations, 2);
      assert.equal(summary.entriesScanned, 2);

      assert.ok(evidenceDir);
      assert.ok(existsSync(join(evidenceDir, "violations.json")));
      assert.ok(existsSync(join(evidenceDir, "scanned-entries.json")));
    });
  });
});
