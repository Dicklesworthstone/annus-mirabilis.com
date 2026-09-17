import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { checkEvidenceLinksFile, checkEvidenceLinksInContent } from "./check-evidence-links.ts";

describe("Evidence Links Checker", () => {
  it("resolves Markdown links from the document directory and inline source paths from the repository", () => {
    const result = checkEvidenceLinksInContent(
      "[manifest](../../package.json) [missing](../../missing-evidence.json) `scripts/check-evidence-links.ts`",
      "docs/evidence/probe.md",
    );
    assert.deepEqual(
      result.links.map((link) => link.resolved),
      [true, false, true],
    );
  });

  it("decodes file URLs while rejecting missing and malformed targets", () => {
    const existing = pathToFileURL(path.resolve("package.json")).href.replace(
      "package.json",
      "%70ackage.json",
    );
    const missing = pathToFileURL(path.resolve("missing-evidence.json")).href;
    const result = checkEvidenceLinksInContent(
      `[existing](${existing}) [missing](${missing}) [malformed](file:///%ZZ)`,
      "probe.md",
    );
    assert.deepEqual(
      result.links.map((link) => link.resolved),
      [true, false, false],
    );
  });

  it("verifies all file references and bead IDs in docs/decisions/batch-b-retrospective.md resolve cleanly", () => {
    const docPath = "docs/decisions/batch-b-retrospective.md";
    const result = checkEvidenceLinksFile(docPath);

    assert.equal(result.totalLinks > 0, true, "Expected links in retrospective document");
    assert.equal(
      result.unresolvedLinks,
      0,
      `Unresolved links found: ${JSON.stringify(result.links.filter((l) => !l.resolved))}`,
    );
    assert.equal(result.resolvedLinks, result.totalLinks);
  });

  it("verifies all file references and bead IDs in docs/evidence/dod-brownian.md resolve cleanly", () => {
    const docPath = "docs/evidence/dod-brownian.md";
    const result = checkEvidenceLinksFile(docPath);

    assert.equal(result.totalLinks > 0, true, "Expected links in dod-brownian.md");
    assert.equal(
      result.unresolvedLinks,
      0,
      `Unresolved links found in dod-brownian.md: ${JSON.stringify(result.links.filter((l) => !l.resolved))}`,
    );
    assert.equal(result.resolvedLinks, result.totalLinks);
  });

  it("fails on broken file references and identifies the missing file", () => {
    const brokenContent = `
# Broken Doc
Referencing [missing file](file:///Users/jemanuel/projects/annus-mirabilis_com/nonexistent/file.ts).
Also \`src/nonexistent/code.ts\`.
`;

    const result = checkEvidenceLinksInContent(brokenContent, "test-broken.md");
    assert.equal(result.unresolvedLinks, 2);
    assert.equal(result.resolvedLinks, 0);
  });
});
