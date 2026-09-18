/**
 * Refusal throw site test suite for authorship.ts (am-muyh).
 *
 * Covers refusal throw site at line 122 in src/content/checks/review/authorship.ts
 * with an authentic accept/reject test pair, asserting explicit refusal code,
 * reviewer ID, and error message, with exact line citation.
 *
 * Zero mocks are used.
 */
import { describe, expect, test } from "bun:test";
import { loadOwnersRegistry } from "../../owners/parseOwners.ts";
import type { AuthorshipBlock } from "../../schemas/authorship.ts";
import type { ReviewRecord } from "../../schemas/review.ts";
import { validateReviewAuthorship } from "./authorship.ts";

const registry = loadOwnersRegistry();

describe("authorship.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 122 - model-reviewer
  // --------------------------------------------------------------------------
  test("rejects when reviewer matches a model authorship entry (authorship.ts:122)", () => {
    const blockWithModelAuthor: AuthorshipBlock = {
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
});
