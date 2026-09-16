/**
 * Authorship and self-review compiler checks.
 * Specification: am-edit-review-records-hofz (§17.2, §17.7) and docs/OWNERS.md
 */

import { loadOwnersRegistry, type OwnersRegistry } from "../../owners/parseOwners.ts";
import {
  type AuthorshipBlock,
  type AuthorshipEntry,
  authorshipOf,
  validateAuthorshipBlock,
} from "../../schemas/authorship.ts";
import type { ReviewRecord } from "../../schemas/review.ts";

export type AuthorshipIssue = Readonly<{
  code:
    | "authorship-unresolved"
    | "authorship-unknown-contributor"
    | "self-review"
    | "model-reviewer";
  message: string;
  path?: string | undefined;
  recordId?: string | undefined;
  reviewerId?: string | undefined;
  contributorId?: string | undefined;
}>;

/**
 * Resolves an AuthorshipBlock from a content record, translation unit, gloss unit, or German source block.
 */
export function resolveAuthorship(
  record: unknown,
  editionEditors?: readonly string[],
): AuthorshipBlock | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const r = record as Record<string, unknown>;

  // 1. Explicit authorship field
  if (r.authorship) {
    try {
      return validateAuthorshipBlock(r.authorship);
    } catch {
      return null;
    }
  }

  // 2. Derive via authorshipOf (translation units, editorial notes, gloss units)
  try {
    return authorshipOf(record);
  } catch {
    // Continue to German source block fallback
  }

  // 3. German source block fallback from edition.yaml editors
  if (editionEditors && editionEditors.length > 0) {
    const editorEntries: AuthorshipEntry[] = editionEditors.map((ed) => ({
      id: ed,
      kind: "human",
    }));
    return {
      draftedBy: editorEntries,
      editedBy: editorEntries,
    };
  }

  return null;
}

/**
 * Validates a review against the authorship of records in its scope.
 */
export function validateReviewAuthorship(
  record: unknown,
  review: ReviewRecord,
  ownersRegistry: OwnersRegistry = loadOwnersRegistry(),
  editionEditors?: readonly string[],
): readonly AuthorshipIssue[] {
  const issues: AuthorshipIssue[] = [];
  const reviewerId = review.reviewer;

  // 1. Model reviewer check
  if (
    reviewerId.startsWith("agent:") ||
    reviewerId.startsWith("model:") ||
    reviewerId.toLowerCase().includes("gpt") ||
    reviewerId.toLowerCase().includes("claude")
  ) {
    issues.push({
      code: "model-reviewer",
      message: `Reviewer "${reviewerId}" is a model or agent. Independent human review is required.`,
      reviewerId,
    });
  }

  // 2. Resolve AuthorshipBlock
  const block = resolveAuthorship(record, editionEditors);
  if (!block || !Array.isArray(block.draftedBy) || block.draftedBy.length === 0) {
    issues.push({
      code: "authorship-unresolved",
      message: `Authorship could not be resolved for record in scope of review "${review.id}".`,
      recordId:
        typeof (record as Record<string, unknown>)?.id === "string"
          ? ((record as Record<string, unknown>).id as string)
          : undefined,
    });
    return issues;
  }

  // Check if reviewer matches any model entry ID
  const allEntries: AuthorshipEntry[] = [
    ...block.draftedBy,
    ...(block.translatedBy ?? []),
    ...(block.editedBy ?? []),
  ];

  for (const entry of allEntries) {
    if (entry.kind === "model" && entry.id === reviewerId) {
      issues.push({
        code: "model-reviewer",
        message: `Reviewer "${reviewerId}" matches model authorship entry.`,
        reviewerId,
      });
    }
  }

  // 3. Unknown contributor check for human entries
  for (const entry of allEntries) {
    if (entry.kind === "human") {
      const owner = ownersRegistry.getOwner(entry.id);
      if (!owner) {
        issues.push({
          code: "authorship-unknown-contributor",
          message: `Human contributor "${entry.id}" is not found in docs/OWNERS.md.`,
          contributorId: entry.id,
        });
      }
    }
  }

  // 4. Self-review check
  const isDraftAuthor = block.draftedBy.some((e) => e.id === reviewerId);
  const isTranslator = block.translatedBy?.some((e) => e.id === reviewerId) ?? false;
  const isEditor = block.editedBy?.some((e) => e.id === reviewerId) ?? false;

  if (isDraftAuthor || isTranslator || isEditor) {
    const roles: string[] = [];
    if (isDraftAuthor) roles.push("draft author");
    if (isTranslator) roles.push("translator");
    if (isEditor) roles.push("editor");

    issues.push({
      code: "self-review",
      message: `Reviewer "${reviewerId}" cannot review content they authored (${roles.join(", ")}).`,
      reviewerId,
    });
  }

  return issues;
}
