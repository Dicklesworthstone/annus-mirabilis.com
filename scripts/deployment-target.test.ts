/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/deployment-target.test.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Removed the "patent source route manifest" describe block; it exercised
 *   `buildPatentSourceRouteManifest`, which this repository does not port
 *   (see scripts/deployment-target.ts's header).
 * - Rewrote fixtures and assertions for the three annus-mirabilis hostnames
 *   and the placeholder project identity, which never matches a real
 *   `.vercel/project.json` until am-rel-vercel-setup-ituk fills it in.
 * - `fixtures/deployment-target/wrong-project.json`'s `projectName` was
 *   changed from the donor's `classic-patents.com` to a neutral
 *   `wrong-project`, since a donor identity string may not appear in this
 *   repository outside an attribution comment.
 * - Uses fixed fixture files; creates and deletes no temporary files
 *   (AGENTS.md Rule 1).
 */

import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCanonicalProjectIdentity,
  assertDeploymentReadyAndAliased,
  CANONICAL_PRODUCTION_PROJECT,
  PROMOTION_REQUIRED_DOMAINS,
  parseDeploymentInspect,
} from "./deployment-target";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

describe("deployment-target canonical project identity", () => {
  test("lists exactly the three annus-mirabilis hostnames", () => {
    expect(CANONICAL_PRODUCTION_PROJECT.customDomains).toEqual([
      "annus-mirabilis.com",
      "www.annus-mirabilis.com",
    ]);
    expect(CANONICAL_PRODUCTION_PROJECT.platformDomain).toBe("annus-mirabilis-seven.vercel.app");
    expect(PROMOTION_REQUIRED_DOMAINS).toEqual([
      "annus-mirabilis.com",
      "www.annus-mirabilis.com",
      "annus-mirabilis-seven.vercel.app",
    ]);
  });

  test("rejects any non-annus-mirabilis hostname", () => {
    for (const hostname of PROMOTION_REQUIRED_DOMAINS) {
      expect(
        hostname.endsWith("annus-mirabilis.com") ||
          hostname.endsWith("annus-mirabilis-seven.vercel.app"),
      ).toBe(true);
    }
  });

  test("refuses while the project identity placeholders are unfilled", () => {
    expect(CANONICAL_PRODUCTION_PROJECT.projectId).toContain("PLACEHOLDER");
    expect(CANONICAL_PRODUCTION_PROJECT.projectName).toContain("PLACEHOLDER");
    expect(CANONICAL_PRODUCTION_PROJECT.orgId).toContain("PLACEHOLDER");
  });

  test("refuses a plausible-real project config, because the identity is still a placeholder", () => {
    // No real `.vercel/project.json` can equal an unfillable placeholder, so
    // a workspace linked to the real annus-mirabilis project still refuses
    // until am-rel-vercel-setup-ituk replaces these three constants.
    const plausibleFile = path.join(
      currentDir,
      "fixtures/deployment-target/plausible-real-project.json",
    );
    expect(() => assertCanonicalProjectIdentity(plausibleFile)).toThrow(
      /Deployment target mismatch/,
    );
  });

  test("rejects missing configuration file with actionable message", () => {
    expect(() => assertCanonicalProjectIdentity("/nonexistent/path/project.json")).toThrow(
      /does not exist/,
    );
  });

  test("rejects configuration linked to a mismatched project", () => {
    const wrongFile = path.join(currentDir, "fixtures/deployment-target/wrong-project.json");
    expect(() => assertCanonicalProjectIdentity(wrongFile)).toThrow(/Deployment target mismatch/);
  });

  test("rejects corrupt JSON project file", () => {
    const corruptFile = path.join(currentDir, "fixtures/deployment-target/corrupt-project.txt");
    expect(() => assertCanonicalProjectIdentity(corruptFile)).toThrow(/invalid JSON/);
  });
});

describe("deployment inspect parsing & alias verification", () => {
  const SAMPLE_READY_INSPECT = `
Vercel CLI 59.10.0 (Node.js 25.9.0)
Fetching deployment "annus-mirabilis.com" in dicklesworthstones-projects
> Fetched deployment "annus-mirabilis-5yxsj0n8j-dicklesworthstones-projects.vercel.app" in dicklesworthstones-projects [340ms]

  General

    id		dpl_Gu19xujsrTgywGbTvsReLzm64DQE
    name	annus-mirabilis
    target	production
    status	● Ready
    url		https://annus-mirabilis-5yxsj0n8j-dicklesworthstones-projects.vercel.app
    created	Thu Sep 03 2026 19:20:59 GMT-0400 (Eastern Daylight Time)

  Aliases

    ╶ https://annus-mirabilis-seven.vercel.app
    ╶ https://annus-mirabilis.com
    ╶ https://www.annus-mirabilis.com

  Builds
`;

  const SAMPLE_PREVIEW_ONLY_INSPECT = `
Vercel CLI 59.10.0 (Node.js 25.9.0)
Fetching deployment "annus-mirabilis-5yxsj0n8j" in dicklesworthstones-projects

  General

    id		dpl_Gu19xujsrTgywGbTvsReLzm64DQE
    name	annus-mirabilis
    target	production
    status	● Ready
    url		https://annus-mirabilis-5yxsj0n8j-dicklesworthstones-projects.vercel.app
    created	Thu Sep 03 2026 19:20:59 GMT-0400 (Eastern Daylight Time)

  Aliases

    ╶ https://annus-mirabilis-5yxsj0n8j-dicklesworthstones-projects.vercel.app
`;

  const SAMPLE_BUILDING_INSPECT = `
  General

    id		dpl_Gu19xujsrTgywGbTvsReLzm64DQE
    name	annus-mirabilis
    target	production
    status	● Building
    url		https://annus-mirabilis-5yxsj0n8j-dicklesworthstones-projects.vercel.app
`;

  test("parses deployment inspect text correctly", () => {
    const parsed = parseDeploymentInspect(SAMPLE_READY_INSPECT);
    expect(parsed.id).toBe("dpl_Gu19xujsrTgywGbTvsReLzm64DQE");
    expect(parsed.name).toBe("annus-mirabilis");
    expect(parsed.target).toBe("production");
    expect(parsed.status).toContain("Ready");
    expect(parsed.url).toBe("annus-mirabilis-5yxsj0n8j-dicklesworthstones-projects.vercel.app");
    expect(parsed.aliases).toContain("annus-mirabilis.com");
    expect(parsed.aliases).toContain("www.annus-mirabilis.com");
  });

  test("accepts ready deployment with all required custom domain aliases", () => {
    const verified = assertDeploymentReadyAndAliased(SAMPLE_READY_INSPECT, [
      "annus-mirabilis.com",
      "www.annus-mirabilis.com",
    ]);
    expect(verified.id).toBe("dpl_Gu19xujsrTgywGbTvsReLzm64DQE");
  });

  test("fails closed when deployment is Ready but missing custom domain aliases", () => {
    expect(() =>
      assertDeploymentReadyAndAliased(SAMPLE_PREVIEW_ONLY_INSPECT, [
        "annus-mirabilis.com",
        "www.annus-mirabilis.com",
      ]),
    ).toThrow(/missing required production alias/);
  });

  // am-o44v: the readiness gate asked whether the status CONTAINS "ready". It is what stands
  // between a deployment and the alias move onto annus-mirabilis.com, and "already" contains
  // "ready", so ALREADY_PROMOTED passed it - as did the literal words NOT READY, because status
  // is parsed from free text by /^status\s+(.+)$/i and the whole rest of the line is matched.
  //
  // Each fixture below is SAMPLE_READY_INSPECT with one word changed, so every required alias is
  // present and the status is the only thing that can refuse it. A fixture missing an alias would
  // pass these tests for the wrong reason.
  const withStatus = (status: string): string =>
    SAMPLE_READY_INSPECT.replace("status\t● Ready", `status\t${status}`);

  test("am-o44v: a status that merely CONTAINS 'ready' is refused", () => {
    for (const status of ["ALREADY_PROMOTED", "● ALREADY_PROMOTED", "NOT READY", "● Not Ready"]) {
      const inspect = withStatus(status);
      expect(inspect).toContain(status);
      expect(() =>
        assertDeploymentReadyAndAliased(inspect, [
          "annus-mirabilis.com",
          "www.annus-mirabilis.com",
        ]),
      ).toThrow(/not Ready/);
    }
  });

  test("am-o44v: a genuine Ready still passes, decorated or bare", () => {
    // The other half. Without this, the equality could be tightened until it refuses everything -
    // which is exactly what ac0d401b did: it compared against "READY" while the Vercel CLI prints
    // "● Ready", so the gate refused every deployment including the ready ones, and the commit
    // reported a different test file as its evidence.
    for (const status of ["● Ready", "Ready", "READY", "ready"]) {
      const verified = assertDeploymentReadyAndAliased(withStatus(status), [
        "annus-mirabilis.com",
        "www.annus-mirabilis.com",
      ]);
      expect(verified.id).toBe("dpl_Gu19xujsrTgywGbTvsReLzm64DQE");
    }
  });

  test("fails closed when deployment is not in Ready state", () => {
    expect(() =>
      assertDeploymentReadyAndAliased(SAMPLE_BUILDING_INSPECT, ["annus-mirabilis.com"]),
    ).toThrow(/not Ready/);
  });
});
