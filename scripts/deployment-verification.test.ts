/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/deployment-verification.test.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Removed the "getNonRedirectPatentIds" and "prohibited audit hold
 *   phrases" describe blocks; this repository does not port
 *   `getNonRedirectPatentIds` or `FORBIDDEN_AUDIT_HOLD_STRINGS` (see
 *   scripts/deployment-verification.ts's header).
 * - Removed "validates local workspace .vercel/project.json": the donor
 *   version asserted the *actual* checked-out donor workspace was linked to
 *   the donor's own canonical project. This repository is not linked to any
 *   Vercel project yet, and the placeholder identity constants are designed
 *   to never match a real `.vercel/project.json` (see
 *   scripts/deployment-target.ts's header), so the equivalent assertion here
 *   is that the placeholders never validate against a real-looking config.
 * - Replaced the "structured JSONL log contract" fixture (a donor source-
 *   reader sweep result) with a candidate-check JSONL fixture.
 * - Added a "candidate check registry" describe block asserting every entry
 *   reports `not-available`, never `passed` (this bead's acceptance
 *   criterion), and that the registry names the six checks AGENTS.md's
 *   "Vercel Deployment Standards" section requires.
 * - Uses fixed fixture data as inline JSON; creates and deletes no temporary
 *   files (AGENTS.md Rule 1).
 */

import { describe, expect, test } from "bun:test";
import {
  assertCanonicalVercelProject,
  assertDeploymentHasRequiredAliases,
  CANDIDATE_CHECK_REGISTRY,
  CANONICAL_PUBLIC_HOSTNAMES,
  CANONICAL_VERCEL_ORG_ID,
  CANONICAL_VERCEL_PROJECT_ID,
  CANONICAL_VERCEL_PROJECT_NAME,
  parseAndValidateVercelProjectConfig,
  runCandidateChecks,
} from "./deployment-verification";

describe("deployment verification contract", () => {
  describe("parseAndValidateVercelProjectConfig", () => {
    test("accepts configuration exactly matching the placeholder identity constants", () => {
      const validConfig = JSON.stringify({
        projectId: CANONICAL_VERCEL_PROJECT_ID,
        orgId: CANONICAL_VERCEL_ORG_ID,
        projectName: CANONICAL_VERCEL_PROJECT_NAME,
      });
      const parsed = parseAndValidateVercelProjectConfig(validConfig);
      expect(parsed.projectId).toBe(CANONICAL_VERCEL_PROJECT_ID);
      expect(parsed.orgId).toBe(CANONICAL_VERCEL_ORG_ID);
      expect(parsed.projectName).toBe(CANONICAL_VERCEL_PROJECT_NAME);
    });

    test("rejects a real-looking project config, because the identity is still a placeholder", () => {
      const realLooking = JSON.stringify({
        projectId: "prj_real0000000000000000000",
        orgId: "team_real00000000000000000",
        projectName: "annus-mirabilis",
      });
      expect(() => parseAndValidateVercelProjectConfig(realLooking)).toThrow(
        /Incorrect Vercel projectName/,
      );
    });

    test("strictly rejects non-canonical project ID", () => {
      const wrongId = JSON.stringify({
        projectId: "prj_wrong_id_9999",
        orgId: CANONICAL_VERCEL_ORG_ID,
        projectName: CANONICAL_VERCEL_PROJECT_NAME,
      });
      expect(() => parseAndValidateVercelProjectConfig(wrongId)).toThrow(
        /Incorrect Vercel projectId/,
      );
    });

    test("strictly rejects non-canonical org ID", () => {
      const wrongOrg = JSON.stringify({
        projectId: CANONICAL_VERCEL_PROJECT_ID,
        orgId: "team_wrong_org",
        projectName: CANONICAL_VERCEL_PROJECT_NAME,
      });
      expect(() => parseAndValidateVercelProjectConfig(wrongOrg)).toThrow(/Incorrect Vercel orgId/);
    });

    test("rejects malformed JSON or non-object content", () => {
      expect(() => parseAndValidateVercelProjectConfig("invalid json")).toThrow(/Invalid JSON/);
      expect(() => parseAndValidateVercelProjectConfig('"just a string"')).toThrow(
        /must be a JSON object/,
      );
    });
  });

  describe("assertCanonicalVercelProject", () => {
    test("throws error if custom path does not exist", () => {
      expect(() => assertCanonicalVercelProject("/tmp/non-existent-project.json")).toThrow(
        /Missing \.vercel\/project\.json/,
      );
    });
  });

  describe("assertDeploymentHasRequiredAliases", () => {
    test("accepts aliases that include canonical production domains", () => {
      const aliases = [
        "https://annus-mirabilis.com",
        "https://www.annus-mirabilis.com",
        "annus-mirabilis-seven.vercel.app",
      ];
      expect(() =>
        assertDeploymentHasRequiredAliases(aliases, CANONICAL_PUBLIC_HOSTNAMES),
      ).not.toThrow();
    });

    test("fails when deployment only has a temporary vercel.app alias", () => {
      const temporaryOnly = ["annus-mirabilis-xyz-git-main.vercel.app"];
      expect(() =>
        assertDeploymentHasRequiredAliases(temporaryOnly, CANONICAL_PUBLIC_HOSTNAMES),
      ).toThrow(/Deployment does not possess required domain aliases/);
    });

    test("fails when www subdomain alias is missing", () => {
      const missingWww = ["annus-mirabilis.com", "annus-mirabilis-seven.vercel.app"];
      expect(() =>
        assertDeploymentHasRequiredAliases(missingWww, CANONICAL_PUBLIC_HOSTNAMES),
      ).toThrow(/Deployment does not possess required domain aliases/);
    });
  });

  describe("candidate check registry", () => {
    test("names the six checks AGENTS.md's Vercel Deployment Standards require", () => {
      const names = CANDIDATE_CHECK_REGISTRY.map((check) => check.name);
      expect(names).toEqual([
        "four-complete-paper-texts",
        "representative-foundations",
        "every-instrument-bundle",
        "no-javascript-source-text",
        "accepted-wasm-result-per-capability",
        "deliberate-typed-refusal",
      ]);
    });

    test("every check definition names a nonempty description", () => {
      for (const check of CANDIDATE_CHECK_REGISTRY) {
        expect(check.description.length).toBeGreaterThan(0);
      }
    });

    test("every unimplemented check reports not-available, never passed or failed", async () => {
      const results = await runCandidateChecks("https://example.invalid");
      expect(results.length).toBe(CANDIDATE_CHECK_REGISTRY.length);
      for (const result of results) {
        expect(result.status).toBe("not-available");
        expect(result.status).not.toBe("passed");
        expect(result.detail.length).toBeGreaterThan(0);
      }
    });
  });

  describe("structured JSONL log contract", () => {
    test("writes valid bounded JSONL entries for candidate check results", () => {
      const sampleResult = {
        schema: "annus-mirabilis.candidate-check.v1",
        timestamp: new Date().toISOString(),
        name: "four-complete-paper-texts",
        status: "not-available",
        detail: "not implemented yet",
      };

      const jsonLine = `${JSON.stringify(sampleResult)}\n`;
      const parsed = JSON.parse(jsonLine.trim());

      expect(parsed.schema).toBe("annus-mirabilis.candidate-check.v1");
      expect(parsed.name).toBe("four-complete-paper-texts");
      expect(parsed.status).toBe("not-available");
    });
  });
});
