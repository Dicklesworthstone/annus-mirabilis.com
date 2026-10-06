/**
 * Refusal sites for authorship.ts (am-muyh, extended under am-r3qt).
 *
 * `model-reviewer` is raised at TWO sites and they catch different dishonesty:
 *
 *   :107  the reviewer id is in the `agent:` or `model:` namespace, so the record
 *         declares what it is and the check reads the NAME
 *   :137  the reviewer id matches an authorship entry whose own `kind` is "model",
 *         so the name says nothing and the check reads the AUTHORSHIP BLOCK
 *
 * They share a code, so each case asserts its own message. The pair is the whole of
 * what this check can do: a model recorded honestly is caught by its namespace or its
 * declared kind, and one recorded dishonestly was never going to be caught by its name.
 * The module's own comment says so, and the third case below holds that line by asserting
 * that an undeclared model reviewer passes, which is a LIMIT being recorded rather than a
 * bug being tolerated.
 *
 * The first citation here pointed at line 122 until 2026-10-06 and had drifted: line 122 is
 * `: undefined,` inside the authorship-unresolved block. It was repointed to :137 only after
 * planting, per this ratchet's own instruction - `if (false && entry.kind === "model" ...)`
 * reddened exactly this test, 0 pass 1 fail. The old number is written here WITHOUT the
 * parenthesised form on purpose: that form is itself a citation, so recording a retired one in
 * prose would add a third claim against a line that holds no site.
 *
 * NOR DOES THIS FILE IMPORT src/content/schemas/authorship.ts, which it did until the same day
 * for one type annotation. Citations match by BASENAME, two files in this repository are called
 * authorship.ts, and an imported file is a candidate for every citation here - so that one
 * `import type` made both citations below resolve against the schema module as well, where
 * neither line holds a refusal. `validateReviewAuthorship` takes `record: unknown`, so the
 * annotation bought nothing; a malformed fixture still fails loudly, as `resolveAuthorship`
 * returns null and the issue raised is `authorship-unresolved`, which every case here asserts
 * against by message.
 *
 * Zero mocks are used.
 */
import { describe, expect, test } from "bun:test";
import { loadOwnersRegistry } from "../../owners/parseOwners.ts";
import type { ReviewRecord } from "../../schemas/review.ts";
import { validateReviewAuthorship } from "./authorship.ts";

const registry = loadOwnersRegistry();

describe("authorship.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 137 - model-reviewer, by declared authorship kind
  // --------------------------------------------------------------------------
  test("rejects when reviewer matches a model authorship entry (authorship.ts:137)", () => {
    const blockWithModelAuthor = {
      draftedBy: [
        {
          id: "open-edition-editor-brownian-motion",
          name: "Human Editor",
          kind: "human",
        },
      ],
      translatedBy: [
        {
          id: "assistant-bot-9",
          name: "Assistant Bot",
          kind: "model",
          modelId: "model-version-9",
        },
      ],
    };

    const record = {
      id: "unit-1",
      authorship: blockWithModelAuthor,
    };

    // Reject: reviewer ID matches a model entry ID in authorship block
    const modelReviewRecord: ReviewRecord = {
      id: "rev-model-1",
      reviewType: "german-source",
      reviewer: "assistant-bot-9",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "unit-1" }],
    };

    const rejectIssues = validateReviewAuthorship(record, modelReviewRecord, registry);
    expect(
      rejectIssues.some(
        (i) =>
          i.code === "model-reviewer" &&
          i.message === 'Reviewer "assistant-bot-9" matches model authorship entry.' &&
          i.reviewerId === "assistant-bot-9",
      ),
    ).toBe(true);

    // Accept: reviewer is a human not matching any model entry
    const humanReviewRecord: ReviewRecord = {
      id: "rev-human-1",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "unit-1" }],
    };

    const acceptIssues = validateReviewAuthorship(record, humanReviewRecord, registry);
    expect(acceptIssues.some((i) => i.code === "model-reviewer")).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Site 2: line 107 - model-reviewer, by reviewer-id namespace
  // --------------------------------------------------------------------------
  test("rejects an agent: or model: reviewer id before authorship is resolved (authorship.ts:107)", () => {
    const humanOnly = {
      draftedBy: [
        { id: "open-edition-editor-brownian-motion", name: "Human Editor", kind: "human" },
      ],
    };
    const record = { id: "unit-2", authorship: humanOnly };

    for (const reviewer of ["agent:TanElk", "model:claude-opus-5"]) {
      const review: ReviewRecord = {
        id: `rev-ns-${reviewer}`,
        reviewType: "german-source",
        reviewer,
        date: "2026-10-06",
        result: "accepted",
        scope: [{ recordId: "unit-2" }],
      };
      const issues = validateReviewAuthorship(record, review, registry);
      expect(
        issues.some(
          (i) =>
            i.code === "model-reviewer" &&
            i.message ===
              `Reviewer "${reviewer}" is a model or agent. Independent human review is required.` &&
            i.reviewerId === reviewer,
        ),
      ).toBe(true);
      // NOT the authorship-entry message: that one belongs to :137, and this record's
      // authorship block holds no model entry at all, so the other site cannot fire.
      expect(issues.some((i) => i.message.includes("matches model authorship entry"))).toBe(false);
    }

    // Accept: the same block, reviewed by a human id in neither namespace.
    const human: ReviewRecord = {
      id: "rev-ns-human",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-10-06",
      result: "accepted",
      scope: [{ recordId: "unit-2" }],
    };
    expect(
      validateReviewAuthorship(record, human, registry).some((i) => i.code === "model-reviewer"),
    ).toBe(false);
  });

  test("a model reviewer that declares neither namespace nor kind is NOT caught here", () => {
    // The limit, asserted so it cannot quietly change. This check reads the reviewer's NAMESPACE
    // and the authorship block's declared KIND; a model recorded as a plain human id with no
    // model authorship entry passes both. The module's own comment says the third guard is the
    // owners registry, where crossProjection refuses a reviewer absent from docs/OWNERS.md.
    // Recording that here means a future author who deletes one of the three sites sees which
    // of them was carrying the weight, instead of a green suite.
    const record = {
      id: "unit-3",
      authorship: {
        draftedBy: [
          { id: "open-edition-editor-brownian-motion", name: "Human Editor", kind: "human" },
        ],
      },
    };
    const review: ReviewRecord = {
      id: "rev-undeclared",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-10-06",
      result: "accepted",
      scope: [{ recordId: "unit-3" }],
    };
    expect(
      validateReviewAuthorship(record, review, registry).some((i) => i.code === "model-reviewer"),
    ).toBe(false);
  });
});
