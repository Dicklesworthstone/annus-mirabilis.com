import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseOwners } from "../../owners/parseOwners.ts";
import { type ReviewRecord, validateReviewRecord } from "../../schemas/review.ts";
import { validateReviewAuthorship } from "./authorship.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| rev-de-1 | Alice German | german-source-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-de-2 | Bob German | german-source-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| translator-alice | Alice German | translator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| editor-carol | Carol Editor | checking-editor | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| gloss-editor | Dave Gloss | glossator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| edition-ed-1 | Ed Edition | edition-editor | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| author-human-1 | Henry Author | editorial-owner | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

function getReview(reviewerId: string, recordId = "bm-unit-01"): ReviewRecord {
  return validateReviewRecord(
    {
      id: "rev-test-01",
      reviewType: "german-source",
      reviewer: reviewerId,
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId, translationRevision: 1 }],
    },
    { ownersRegistry: registry, skipOwnerRoleCheck: true },
  );
}

describe("authorship checks", () => {
  it("fails self-review when translator id equals reviewer id via authorshipOf", () => {
    const translationUnit = {
      id: "bm-s1-p1",
      translator: { id: "translator-alice", kind: "human" },
      editor: { id: "editor-carol", kind: "human" },
    };

    const review = getReview("translator-alice", "bm-s1-p1");
    const issues = validateReviewAuthorship(translationUnit, review, registry);
    assert.equal(
      issues.some((i) => i.code === "self-review"),
      true,
    );
  });

  it("fails self-review when gloss unit editor equals reviewer", () => {
    const glossUnit = {
      id: "bm-gloss-01",
      attribution: { id: "author-human-1", kind: "human" },
      editor: { id: "gloss-editor", kind: "human" },
    };

    const review = getReview("gloss-editor", "bm-gloss-01");
    const issues = validateReviewAuthorship(glossUnit, review, registry);
    assert.equal(
      issues.some((i) => i.code === "self-review"),
      true,
    );
  });

  it("fails model-reviewer when reviewer is an agent/model id", () => {
    const reading = {
      id: "reading-01",
      authorship: {
        draftedBy: [{ id: "agent-7", kind: "model", modelId: "gpt-4o" }],
      },
    };

    const review = getReview("agent-7", "reading-01");
    const issues = validateReviewAuthorship(reading, review, registry);
    assert.equal(
      issues.some((i) => i.code === "model-reviewer"),
      true,
    );
  });

  it("fails self-review when German source block reviewer is in edition.yaml editors, passes when removed", () => {
    const sourceBlock = {
      id: "bm-source-01",
      // German source block without explicit authorship field
    };

    // With edition-ed-1 in edition editors -> fails self-review
    const reviewSelf = getReview("edition-ed-1", "bm-source-01");
    const issuesSelf = validateReviewAuthorship(sourceBlock, reviewSelf, registry, [
      "edition-ed-1",
    ]);
    assert.equal(
      issuesSelf.some((i) => i.code === "self-review"),
      true,
    );

    // With unrelated reviewer rev-de-2 -> passes
    const reviewIndependent = getReview("rev-de-2", "bm-source-01");
    const issuesIndependent = validateReviewAuthorship(sourceBlock, reviewIndependent, registry, [
      "edition-ed-1",
    ]);
    assert.equal(issuesIndependent.length, 0);
  });

  it("fails authorship-unknown-contributor when human contributor is not in OWNERS.md", () => {
    const unitWithUnknown = {
      id: "bm-unit-unknown",
      authorship: {
        draftedBy: [{ id: "unknown-contributor-xyz", kind: "human" }],
      },
    };

    const review = getReview("rev-de-2", "bm-unit-unknown");
    const issues = validateReviewAuthorship(unitWithUnknown, review, registry);
    assert.equal(
      issues.some((i) => i.code === "authorship-unknown-contributor"),
      true,
    );
  });

  it("fails authorship-unresolved when record carries no resolvable authorship", () => {
    const unresolvable = {
      id: "unresolvable-01",
      // No authorship, no translator, no attribution, no edition editors
    };

    const review = getReview("rev-de-2", "unresolvable-01");
    const issues = validateReviewAuthorship(unresolvable, review, registry);
    assert.equal(
      issues.some((i) => i.code === "authorship-unresolved"),
      true,
    );
  });

  it("statically verifies draftedBy schema definitions exist only in src/content/schemas/authorship.ts", () => {
    const schemaDir = path.join(process.cwd(), "src", "content", "schemas");
    const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".ts"));

    for (const file of files) {
      if (file === "authorship.ts" || file.endsWith(".test.ts")) continue;
      const content = fs.readFileSync(path.join(schemaDir, file), "utf8");
      // Assert no second definition of draftedBy type or schema outside authorship.ts
      assert.equal(/export\s+type\s+AuthorshipBlock/.test(content), false);
      assert.equal(/draftedBy:\s*readonly\s+AuthorshipEntry\[\]/.test(content), false);
    }
  });

  // am-o44v, both halves. The genuine cases use the shapes this corpus really
  // writes: docs/PLAN_MINING_DECISIONS.md records a decider as
  // "agent:pane30 (BrightIsland)", and the owners registry holds human ids.
  it("a genuine agent: or model: prefixed reviewer is still refused, at the schema", () => {
    // Where the refusal actually happens, found by this control failing:
    // validateReviewRecord calls assertHumanReviewer, which THROWS on the two
    // namespace prefixes before validateReviewAuthorship is ever reached. So
    // the prefixed cases cannot be asserted through getReview - getReview is
    // what refuses them. That schema check uses the two prefixes and nothing
    // else, which means the vendor-substring arms removed from authorship.ts
    // were duplicating a correct check one layer up while misclassifying
    // people.
    for (const reviewerId of [
      "agent:pane30 (BrightIsland)",
      "agent:pane28",
      "model:gpt-4o",
      "model:claude-opus-5",
    ]) {
      assert.throws(
        () => getReview(reviewerId, "reading-ns"),
        (err: unknown) => {
          assert.equal((err as { code?: string }).code, "model-reviewer");
          return true;
        },
        `${reviewerId} must still be refused as a model reviewer`,
      );
    }
  });

  it("a human whose name merely contains a vendor word is not a model reviewer", () => {
    const reading = {
      id: "reading-human",
      authorship: { draftedBy: [{ id: "editor-carol", kind: "human" }] },
    };
    // Claude is an ordinary given name. Under the substring test this reviewer
    // was refused with code model-reviewer for having it.
    for (const reviewerId of ["Claude Bernard", "claudette-moreau", "e-gupta"]) {
      const issues = validateReviewAuthorship(
        reading,
        getReview(reviewerId, "reading-human"),
        registry,
      );
      assert.equal(
        issues.some((i) => i.code === "model-reviewer"),
        false,
        `${reviewerId} is a person, not a model`,
      );
    }
  });

  it("the structural path still refuses a model, so dropping the name sniff removes no coverage", () => {
    // The reviewer id carries no namespace and no vendor word. It is refused
    // because the authorship entry it matches declares kind "model" - the
    // category test that was always the right one.
    const reading = {
      id: "reading-structural",
      authorship: { draftedBy: [{ id: "reviewer-nine", kind: "model", modelId: "some-model" }] },
    };
    const issues = validateReviewAuthorship(
      reading,
      getReview("reviewer-nine", "reading-structural"),
      registry,
    );
    assert.equal(
      issues.some((i) => i.code === "model-reviewer"),
      true,
    );
  });
});
