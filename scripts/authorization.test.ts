/**
 * Unit and integration tests for scripts/authorization.ts
 * Quality gate / deployment verification module
 * Owner: am-rel-verified-deploy-qndt
 */

import { describe, expect, test } from "bun:test";
import {
  AUTHORIZATION_SCHEMA,
  CANONICAL_AUTHORIZED_BY,
  type DeployAuthorization,
  formatAuthorizationReference,
  parseAuthorizationContent,
  validateAuthorization,
} from "./authorization";

describe("scripts/authorization.ts deploy authorization validator", () => {
  const dummyCommit = "d43fb0e1234567890abcdef1234567890abcdef1";
  const now = new Date("2026-09-17T18:00:00.000Z");
  const validAuthorizedAt = "2026-09-17T12:00:00.000Z"; // 6 hours ago

  const validPayload: DeployAuthorization = {
    schema: AUTHORIZATION_SCHEMA,
    authorizedBy: CANONICAL_AUTHORIZED_BY,
    authorizedAt: validAuthorizedAt,
    commit: dummyCommit,
    profile: "preview",
    scope: "candidate-only",
    allowedHostnames: ["annus-mirabilis-seven.vercel.app"],
    verbatimText: "Authorized preview deployment for testing candidate checks.",
  };

  test("a complete valid payload passes and produces a valid record with reference", () => {
    const result = validateAuthorization(
      validPayload,
      {
        expectedCommit: dummyCommit,
        expectedProfile: "preview",
        expectedScope: "candidate-only",
        targetHostnames: ["annus-mirabilis-seven.vercel.app"],
        now,
      },
      "scripts/fixtures/authorization/preview.yaml",
    );

    expect(result.authorization.schema).toBe(AUTHORIZATION_SCHEMA);
    expect(result.authorization.authorizedBy).toBe(CANONICAL_AUTHORIZED_BY);
    expect(result.authorization.commit).toBe(dummyCommit);
    expect(result.reference).toBe("preview.yaml#d43fb0e1");
    expect(result.filePath).toBe("scripts/fixtures/authorization/preview.yaml");
  });

  test("a file for preview used with launch refuses", () => {
    expect(() =>
      validateAuthorization(
        validPayload,
        {
          expectedCommit: dummyCommit,
          expectedProfile: "launch",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "preview.yaml",
      ),
    ).toThrow(/profile mismatch/i);
  });

  test("a file naming only platform alias refuses a run that would move the apex", () => {
    expect(() =>
      validateAuthorization(
        validPayload, // allowedHostnames: ['annus-mirabilis-seven.vercel.app']
        {
          expectedCommit: dummyCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: [
            "annus-mirabilis.com",
            "www.annus-mirabilis.com",
            "annus-mirabilis-seven.vercel.app",
          ],
          now,
        },
        "preview.yaml",
      ),
    ).toThrow(/does not allow targeted hostnames: annus-mirabilis.com/i);
  });

  test("a file naming a different commit refuses", () => {
    const differentCommit = "1111222233334444555566667777888899990000";
    expect(() =>
      validateAuthorization(
        validPayload,
        {
          expectedCommit: differentCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "preview.yaml",
      ),
    ).toThrow(/commit mismatch/i);
  });

  test("a stale authorization older than 24 hours refuses", () => {
    const stalePayload = {
      ...validPayload,
      authorizedAt: "2026-09-15T00:00:00.000Z", // > 48h old relative to now
    };
    expect(() =>
      validateAuthorization(
        stalePayload,
        {
          expectedCommit: dummyCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "stale.yaml",
      ),
    ).toThrow(/authorization is stale/i);
  });

  test("an authorization timestamp in the future refuses", () => {
    const futurePayload = {
      ...validPayload,
      authorizedAt: "2026-09-18T12:00:00.000Z",
    };
    expect(() =>
      validateAuthorization(
        futurePayload,
        {
          expectedCommit: dummyCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "future.yaml",
      ),
    ).toThrow(/authorizedAt timestamp is in the future/i);
  });

  test("an unauthorized user refuses", () => {
    const roguePayload = {
      ...validPayload,
      authorizedBy: "imposter",
    };
    expect(() =>
      validateAuthorization(
        roguePayload,
        {
          expectedCommit: dummyCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "rogue.yaml",
      ),
    ).toThrow(/authorizedBy must be 'jemanuel'/i);
  });

  test("an invalid schema refuses", () => {
    const wrongSchemaPayload = {
      ...validPayload,
      schema: "wrong-schema-v0",
    };
    expect(() =>
      validateAuthorization(
        wrongSchemaPayload,
        {
          expectedCommit: dummyCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "bad-schema.yaml",
      ),
    ).toThrow(/invalid schema/i);
  });

  test("authorizing more hostnames than the run targets refuses", () => {
    const extraHostnamesPayload = {
      ...validPayload,
      allowedHostnames: ["annus-mirabilis-seven.vercel.app", "unrelated-domain.com"],
    };
    expect(() =>
      validateAuthorization(
        extraHostnamesPayload,
        {
          expectedCommit: dummyCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "extra.yaml",
      ),
    ).toThrow(/authorization specifies hostnames not targeted by this run/i);
  });

  test("an empty verbatim explanation refuses", () => {
    const emptyVerbatimPayload = {
      ...validPayload,
      verbatimText: "   ",
    };
    expect(() =>
      validateAuthorization(
        emptyVerbatimPayload,
        {
          expectedCommit: dummyCommit,
          expectedProfile: "preview",
          expectedScope: "candidate-only",
          targetHostnames: ["annus-mirabilis-seven.vercel.app"],
          now,
        },
        "empty-text.yaml",
      ),
    ).toThrow(/verbatimText explanation must be a non-empty string/i);
  });

  test("YAML and JSON parsing of authorization content", () => {
    const yamlContent = `
schema: annus-mirabilis-deploy-authorization.v1
authorizedBy: jemanuel
authorizedAt: "2026-09-17T12:00:00.000Z"
commit: "d43fb0e1234567890abcdef1234567890abcdef1"
profile: preview
scope: candidate-only
allowedHostnames:
  - annus-mirabilis-seven.vercel.app
verbatimText: "Testing YAML parse"
`;
    const parsed = parseAuthorizationContent(yamlContent, "test.yaml") as Record<string, unknown>;
    expect(parsed.schema).toBe(AUTHORIZATION_SCHEMA);
    expect(parsed.authorizedBy).toBe("jemanuel");

    const jsonContent = JSON.stringify(validPayload);
    const parsedJson = parseAuthorizationContent(jsonContent, "test.json") as Record<
      string,
      unknown
    >;
    expect(parsedJson.schema).toBe(AUTHORIZATION_SCHEMA);
    expect(parsedJson.authorizedBy).toBe("jemanuel");
  });

  test("formatAuthorizationReference helper format", () => {
    const ref = formatAuthorizationReference("path/to/deploy-auth.yaml", dummyCommit);
    expect(ref).toBe("deploy-auth.yaml#d43fb0e1");
  });
});
