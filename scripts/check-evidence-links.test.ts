import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import {
  checkEvidenceLinksFile,
  checkEvidenceLinksInContent,
  defaultEvidenceDocuments,
  resolveReference,
} from "./check-evidence-links.ts";

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
Referencing [missing file](file:///home/agent/projects/annus-mirabilis.com/nonexistent/file.ts).
Also \`src/nonexistent/code.ts\`.
`;

    const result = checkEvidenceLinksInContent(brokenContent, "test-broken.md");
    assert.equal(result.unresolvedLinks, 2);
    assert.equal(result.resolvedLinks, 0);
  });

  /**
   * A GLOB IS A REFERENCE, AND IT STILL HAS TO POINT AT SOMETHING.
   *
   * docs/decisions/foundation-library-scope.md line 61 reads "reading every file under
   * `content/foundations/*.json`", a true sentence about 45 files that exist. The checker had no
   * glob handling, resolved the literal string as a path, and reported that one accurate sentence as
   * the only broken reference in any evidence document. All three directions are asserted here,
   * because a fix that made every glob resolve would be worse than the false positive it replaced.
   */
  it("resolves a glob that matches, and says how many files it matched", () => {
    const outcome = resolveReference("content/foundations/*.json", process.cwd());
    assert.equal(outcome.resolved, true);
    assert.match(outcome.message, /Glob matches \d+ file\(s\)/);
    // The count is the anchoring half: a glob matching nothing must not read like this one.
    const matched = Number(/Glob matches (\d+)/.exec(outcome.message)?.[1] ?? "0");
    assert.ok(matched > 1, `expected more than one match, got ${matched}`);
  });

  it("REFUSES a glob that matches no file, even though its directory exists", () => {
    const outcome = resolveReference("content/foundations/*.no-such-extension", process.cwd());
    assert.equal(outcome.resolved, false);
    assert.match(outcome.message, /Glob matches no file under/);
  });

  it("REFUSES a glob whose directory does not exist, and names the directory", () => {
    const outcome = resolveReference("content/no-such-directory/*.json", process.cwd());
    assert.equal(outcome.resolved, false);
    assert.match(outcome.message, /Glob's directory does not exist/);
  });

  it("a plain path with no metacharacter is still resolved as a path, both ways", () => {
    assert.equal(resolveReference("package.json", process.cwd()).resolved, true);
    assert.equal(resolveReference("no-such-file.json", process.cwd()).resolved, false);
  });

  /**
   * THE DEFAULT POPULATION, ASSERTED, because the default used to be one hard-coded document.
   *
   * It checked docs/decisions/batch-b-retrospective.md, which resolves 92/92, so the shipped default
   * was green while the corpus's one broken reference sat in a document it never opened. Asserting
   * the population separately from the verdict is the whole lesson: "0 unresolved" over one document
   * and over five read identically.
   */
  it("the default population covers both evidence directories and is not empty", () => {
    const documents = defaultEvidenceDocuments();
    assert.ok(documents.length >= 5, `expected at least 5 documents, got ${documents.length}`);
    assert.ok(
      documents.some((d) => d.startsWith("docs/evidence")),
      "docs/evidence must be in the default population",
    );
    assert.ok(
      documents.some((d) => d.startsWith("docs/decisions")),
      "docs/decisions must be in the default population",
    );
  });

  it("every document in the default population resolves cleanly", () => {
    const documents = defaultEvidenceDocuments();
    assert.ok(documents.length > 0, "the population must not be empty");
    for (const name of documents) {
      const result = checkEvidenceLinksFile(name);
      assert.ok(result.totalLinks > 0, `${name} contributed no links`);
      assert.equal(
        result.unresolvedLinks,
        0,
        `${name}: ${result.links
          .filter((l) => !l.resolved)
          .map((l) => `line ${l.line} ${l.ref}`)
          .join("; ")}`,
      );
    }
  });
});
