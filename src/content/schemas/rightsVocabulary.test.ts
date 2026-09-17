import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  checkConstraints,
  entryFor,
  evaluateExpression,
  loadRightsVocabulary,
  RightsVocabularyError,
  requiredFieldsFor,
  valuesOf,
} from "./rightsVocabulary.ts";

const vocabulary = loadRightsVocabulary();

describe("loadRightsVocabulary parses the real docs/rights-vocabulary.yaml (am-cm-schemas-source-1en)", () => {
  test("every category has at least one entry and version is a number", () => {
    expect(vocabulary.version).toBe(1);
    expect(vocabulary.rightsStatus.length).toBeGreaterThan(0);
    expect(vocabulary.publicationDecision.length).toBeGreaterThan(0);
    expect(vocabulary.cloudProcessing.length).toBeGreaterThan(0);
    expect(vocabulary.reuseTerms.length).toBeGreaterThan(0);
    expect(vocabulary.constraints.length).toBeGreaterThan(0);
  });

  test("rightsStatus equals the file's exact value set", () => {
    expect(valuesOf(vocabulary, "rightsStatus")).toEqual([
      "public-domain-text",
      "public-domain-image",
      "scan-open-terms",
      "scan-terms-restrict-redistribution",
      "scan-terms-unknown",
      "site-original-code",
      "site-original-prose",
      "third-party-licensed",
      "in-copyright-witness-only",
      "cleared-image",
    ]);
  });

  test("publicationDecision, cloudProcessing, and reuseTerms equal the file's exact value sets", () => {
    expect(valuesOf(vocabulary, "publicationDecision")).toEqual([
      "publish",
      "pin-local-only",
      "reference-only",
    ]);
    expect(valuesOf(vocabulary, "cloudProcessing")).toEqual(["permitted", "forbidden", "unknown"]);
    expect(valuesOf(vocabulary, "reuseTerms")).toEqual([
      "pending-decision",
      "named-license",
      "source-terms",
      "no-reuse-offered",
    ]);
  });

  test("the retired draft values local-only and withheld are not present", () => {
    expect(valuesOf(vocabulary, "publicationDecision")).not.toContain("local-only");
    expect(valuesOf(vocabulary, "publicationDecision")).not.toContain("withheld");
  });

  test("public-domain-image requires rights.credit, and every reuseTerms value requires rights.statement", () => {
    expect(requiredFieldsFor(vocabulary, "rightsStatus", "public-domain-image")).toContain(
      "rights.credit",
    );
    for (const value of valuesOf(vocabulary, "reuseTerms")) {
      expect(requiredFieldsFor(vocabulary, "reuseTerms", value)).toContain("rights.statement");
    }
  });

  test("entryFor returns undefined for an unknown value rather than throwing", () => {
    expect(entryFor(vocabulary, "rightsStatus", "not-a-real-status")).toBeUndefined();
  });
});

describe("every vocabulary value appears in docs/RIGHTS.md (am-cm-schemas-source-1en)", () => {
  const rightsDoc = readFileSync(path.join(process.cwd(), "docs", "RIGHTS.md"), "utf8");

  test("every rightsStatus, publicationDecision, cloudProcessing, and reuseTerms value is documented", () => {
    const allValues = [
      ...valuesOf(vocabulary, "rightsStatus"),
      ...valuesOf(vocabulary, "publicationDecision"),
      ...valuesOf(vocabulary, "cloudProcessing"),
      ...valuesOf(vocabulary, "reuseTerms"),
    ];
    for (const value of allValues) {
      expect(rightsDoc.includes(value)).toBe(true);
    }
  });
});

describe("evaluateExpression: the constraint mini-language (am-cm-schemas-source-1en)", () => {
  test("== compares a dotted path to a quoted string", () => {
    expect(
      evaluateExpression("rights.status == 'publish'", { rights: { status: "publish" } }),
    ).toBe(true);
    expect(evaluateExpression("rights.status == 'publish'", { rights: { status: "other" } })).toBe(
      false,
    );
  });

  test("!= null is false for a missing or undefined field, true once set", () => {
    expect(evaluateExpression("rights.credit != null", { rights: {} })).toBe(false);
    expect(evaluateExpression("rights.credit != null", { rights: { credit: "" } })).toBe(true);
    expect(evaluateExpression("rights.credit != null", { rights: { credit: "Archive" } })).toBe(
      true,
    );
  });

  test("in [...] matches any listed quoted value", () => {
    const expr = "publicationDecision in ['pin-local-only', 'reference-only']";
    expect(evaluateExpression(expr, { publicationDecision: "pin-local-only" })).toBe(true);
    expect(evaluateExpression(expr, { publicationDecision: "publish" })).toBe(false);
  });

  test("&& conjoins clauses; a bare path is a truthy check", () => {
    const expr = "rights.status in ['site-original-code'] && licenseDecisionPending";
    expect(
      evaluateExpression(expr, {
        rights: { status: "site-original-code" },
        licenseDecisionPending: true,
      }),
    ).toBe(true);
    expect(
      evaluateExpression(expr, {
        rights: { status: "site-original-code" },
        licenseDecisionPending: false,
      }),
    ).toBe(false);
  });

  test("an unrecognized clause form throws rather than silently evaluating true or false", () => {
    expect(() => evaluateExpression("rights.status ~= 'x'", {})).toThrow(RightsVocabularyError);
  });
});

describe("checkConstraints: every constraint in the file, a violating context and a satisfying one (am-cm-schemas-source-1en)", () => {
  function violationIds(context: Record<string, unknown>): readonly string[] {
    return checkConstraints(vocabulary, context).map((v) => v.id);
  }

  test("scan-restrict-redistribution-non-publish", () => {
    const bad = {
      rights: { status: "scan-terms-restrict-redistribution" },
      publicationDecision: "publish",
    };
    const good = { ...bad, publicationDecision: "pin-local-only" };
    expect(violationIds(bad)).toContain("scan-restrict-redistribution-non-publish");
    expect(violationIds(good)).not.toContain("scan-restrict-redistribution-non-publish");
  });

  test("scan-terms-unknown-reference-and-unknown-cloud", () => {
    const bad = {
      rights: { status: "scan-terms-unknown" },
      publicationDecision: "reference-only",
      cloudProcessing: "permitted",
    };
    const good = { ...bad, cloudProcessing: "unknown" };
    expect(violationIds(bad)).toContain("scan-terms-unknown-reference-and-unknown-cloud");
    expect(violationIds(good)).not.toContain("scan-terms-unknown-reference-and-unknown-cloud");
  });

  test("in-copyright-witness-reference-only", () => {
    const bad = { rights: { status: "in-copyright-witness-only" }, publicationDecision: "publish" };
    const good = { ...bad, publicationDecision: "reference-only" };
    expect(violationIds(bad)).toContain("in-copyright-witness-reference-only");
    expect(violationIds(good)).not.toContain("in-copyright-witness-reference-only");
  });

  test("publish-requires-redistributable-status", () => {
    const bad = { publicationDecision: "publish", rights: { status: "scan-terms-unknown" } };
    const good = { publicationDecision: "publish", rights: { status: "public-domain-text" } };
    expect(violationIds(bad)).toContain("publish-requires-redistributable-status");
    expect(violationIds(good)).not.toContain("publish-requires-redistributable-status");
  });

  test("image-credit-required", () => {
    const bad = { rights: { status: "public-domain-image" } };
    const good = {
      rights: { status: "public-domain-image", credit: "Archive, photographer, 1905" },
    };
    expect(violationIds(bad)).toContain("image-credit-required");
    expect(violationIds(good)).not.toContain("image-credit-required");
  });

  test("cloud-permitted-not-unknown-terms", () => {
    const bad = { cloudProcessing: "permitted", rights: { status: "scan-terms-unknown" } };
    const good = { cloudProcessing: "permitted", rights: { status: "scan-open-terms" } };
    expect(violationIds(bad)).toContain("cloud-permitted-not-unknown-terms");
    expect(violationIds(good)).not.toContain("cloud-permitted-not-unknown-terms");
  });

  test("non-publish-no-reuse", () => {
    const bad = { publicationDecision: "pin-local-only", rights: { reuseTerms: "named-license" } };
    const good = {
      publicationDecision: "pin-local-only",
      rights: { reuseTerms: "no-reuse-offered" },
    };
    expect(violationIds(bad)).toContain("non-publish-no-reuse");
    expect(violationIds(good)).not.toContain("non-publish-no-reuse");
  });

  test("site-original-pending-decision only applies once licenseDecisionPending is true", () => {
    const bad = {
      rights: { status: "site-original-code", reuseTerms: "no-reuse-offered" },
      licenseDecisionPending: true,
    };
    const good = { ...bad, rights: { ...bad.rights, reuseTerms: "pending-decision" } };
    const notYetApplicable = { ...bad, licenseDecisionPending: false };
    expect(violationIds(bad)).toContain("site-original-pending-decision");
    expect(violationIds(good)).not.toContain("site-original-pending-decision");
    expect(violationIds(notYetApplicable)).not.toContain("site-original-pending-decision");
  });

  test("named-license-requires-source", () => {
    const bad = { rights: { reuseTerms: "named-license" } };
    const good = { rights: { reuseTerms: "named-license", source: "https://example.org/license" } };
    expect(violationIds(bad)).toContain("named-license-requires-source");
    expect(violationIds(good)).not.toContain("named-license-requires-source");
  });

  test("reuse-terms-requires-statement", () => {
    const bad = { rights: { reuseTerms: "no-reuse-offered" } };
    const good = { rights: { reuseTerms: "no-reuse-offered", statement: "Terms text." } };
    expect(violationIds(bad)).toContain("reuse-terms-requires-statement");
    expect(violationIds(good)).not.toContain("reuse-terms-requires-statement");
  });

  test("non-publish-requires-reason", () => {
    const bad = { publicationDecision: "reference-only" };
    const good = { publicationDecision: "reference-only", publicationReason: "Consulted only." };
    expect(violationIds(bad)).toContain("non-publish-requires-reason");
    expect(violationIds(good)).not.toContain("non-publish-requires-reason");
  });

  test("a fully compliant record produces no violations at all", () => {
    expect(
      violationIds({
        publicationDecision: "publish",
        cloudProcessing: "forbidden",
        cloudProcessingBasis: "Terms silent; treated as forbidden.",
        publicationReason: undefined,
        rights: {
          status: "public-domain-text",
          statement: "Public domain per life-plus-70.",
          reuseTerms: "no-reuse-offered",
        },
      }),
    ).toEqual([]);
  });
});

describe("loadRightsVocabulary rejects a malformed vocabulary file (am-cm-schemas-source-1en)", () => {
  test("a duplicate value within one category is rejected", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "am-rights-vocab-test-"));
    try {
      const file = path.join(dir, "vocab.yaml");
      await writeFile(
        file,
        [
          "version: 1",
          "rightsStatus:",
          "  - value: public-domain-text",
          "    definition: a",
          "    requiredFields: []",
          "  - value: public-domain-text",
          "    definition: b",
          "    requiredFields: []",
          "publicationDecision: []",
          "cloudProcessing: []",
          "reuseTerms: []",
          "constraints: []",
        ].join("\n"),
        "utf8",
      );
      expect(() => loadRightsVocabulary(file)).toThrow(/duplicate value/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a non-kebab-case value is rejected", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "am-rights-vocab-test-"));
    try {
      const file = path.join(dir, "vocab.yaml");
      await writeFile(
        file,
        [
          "version: 1",
          "rightsStatus:",
          "  - value: PublicDomainText",
          "    definition: a",
          "    requiredFields: []",
          "publicationDecision: []",
          "cloudProcessing: []",
          "reuseTerms: []",
          "constraints: []",
        ].join("\n"),
        "utf8",
      );
      expect(() => loadRightsVocabulary(file)).toThrow(RightsVocabularyError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a missing definition is rejected", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "am-rights-vocab-test-"));
    try {
      const file = path.join(dir, "vocab.yaml");
      await writeFile(
        file,
        [
          "version: 1",
          "rightsStatus:",
          "  - value: public-domain-text",
          "    requiredFields: []",
          "publicationDecision: []",
          "cloudProcessing: []",
          "reuseTerms: []",
          "constraints: []",
        ].join("\n"),
        "utf8",
      );
      expect(() => loadRightsVocabulary(file)).toThrow(/definition/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
