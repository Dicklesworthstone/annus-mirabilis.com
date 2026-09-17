/**
 * Architecture Gate Test Suite (am-scaf-architecture-gate-l1p / AGENTS.md Rule 2).
 *
 * Enforces:
 * 1. Pure App Router architecture (zero tolerance for src/pages).
 * 2. Single src/app root (no secondary app/ roots or rogue layout.tsx outside src/app).
 * 3. No legacy Pages Router files (_app, _document, _error).
 * 4. Strict root allowlist (no unapproved scratch files in root).
 * 5. No scratch/temporary scripts in the source tree.
 */

import { describe, expect, it } from "bun:test";
import {
  checkArchitecture,
  loadAllowlist,
  type RepoEntry,
  runArchitectureGateCli,
  scanRepository,
} from "../../scripts/app-router-architecture.ts";

const BASE_ALLOWLIST = loadAllowlist("scripts/architecture-allowlist.json");

describe("App Router Architecture Gate (am-scaf-architecture-gate-l1p)", () => {
  describe("Planted Negatives (Fail-Closed Verification)", () => {
    it("Rule 1: Rejects planted src/pages directory and src/pages/.keep", () => {
      const entries: RepoEntry[] = [
        { path: "src/pages", kind: "directory" },
        { path: "src/pages/.keep", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations.some((v) => v.rule === "rule-1-pages-router")).toBe(true);
      expect(violations[0]?.message).toContain("Pages Router");
    });

    it("Rule 1: Rejects src/pages even when git ignore predicate returns true", () => {
      const entries: RepoEntry[] = [{ path: "src/pages/.keep", kind: "file" }];
      // Simulate gitignore returning true for src/pages
      const violations = checkArchitecture(entries, () => true, BASE_ALLOWLIST);
      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("rule-1-pages-router");
    });

    it("Rule 2: Rejects planted second app root (app/page.tsx) and rogue layout.tsx", () => {
      const entries: RepoEntry[] = [
        { path: "app/page.tsx", kind: "file" },
        { path: "src/reader/layout.tsx", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      expect(violations.length).toBe(2);
      expect(violations.every((v) => v.rule === "rule-2-second-app-root")).toBe(true);
    });

    it("Rule 3: Rejects planted legacy files (_document.tsx, _error.tsx, _app.tsx)", () => {
      const entries: RepoEntry[] = [
        { path: "src/components/_document.tsx", kind: "file" },
        { path: "src/app/_error.tsx", kind: "file" },
        { path: "src/_app.tsx", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      expect(violations.length).toBe(3);
      expect(violations.every((v) => v.rule === "rule-3-legacy-files")).toBe(true);
    });

    it("Rule 4: Rejects planted unallowlisted root files (e.g. scratch_test.py)", () => {
      const entries: RepoEntry[] = [
        { path: "scratch_test.py", kind: "file" },
        { path: "temp_fix.sh", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      expect(violations.length).toBe(2);
      expect(violations.every((v) => v.rule === "rule-4-root-allowlist")).toBe(true);
      expect(violations[0]?.repair).toContain("allowlist");
    });

    it("Rule 5: Rejects planted scratch files in source tree (src/physics/temp.py)", () => {
      const entries: RepoEntry[] = [
        { path: "src/physics/temp.py", kind: "file" },
        { path: "content/equations/scratch.tmp", kind: "file" },
        { path: "public/figures/test.orig", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      expect(violations.length).toBe(3);
      expect(violations.every((v) => v.rule === "rule-5-scratch-files")).toBe(true);
    });
  });

  describe("Clean Repository & Live Working Tree", () => {
    it("accepts valid route groups and component layouts inside and outside src/app", () => {
      const entries: RepoEntry[] = [
        { path: "src/app/(reader)/papers/page.tsx", kind: "file" },
        { path: "src/app/embed/lab/[experiment]/page.tsx", kind: "file" },
        { path: "src/reader/ReaderLayout.tsx", kind: "file" },
        { path: "src/components/layout/Header.tsx", kind: "file" },
      ];
      const violations = checkArchitecture(entries, () => false, BASE_ALLOWLIST);
      expect(violations.length).toBe(0);
    });

    it("passes cleanly on the live repository tree with zero violations via CLI", () => {
      const exitCode = runArchitectureGateCli(process.cwd());
      expect(exitCode).toBe(0);
    });
  });
});
