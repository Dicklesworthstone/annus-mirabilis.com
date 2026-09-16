import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkEvidenceLinksFile, checkEvidenceLinksInContent } from "./check-evidence-links.ts";

describe("Evidence Links Checker", () => {
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
