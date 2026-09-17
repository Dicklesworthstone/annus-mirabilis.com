/**
 * Verification Queue Schemas and Cross-Validators.
 *
 * Implements Rule 9 and verification queue data contracts for discovery shelves.
 *
 * Specification: am-disc-knowledge-cards-iw8j, am-ep-discovery-33u
 */

import type {
  CardRuleDiagnostic,
  KnowledgeCard,
  VerificationQueueFile,
  VerificationQueueItem,
} from "./types.ts";

export class VerificationQueueSchemaError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path: string) {
    super(message);
    this.name = "VerificationQueueSchemaError";
    this.code = code;
    this.path = path;
  }
}

/**
 * Validates a single verification queue item.
 */
export function validateVerificationQueueItem(
  raw: unknown,
  path = "VerificationQueueItem",
): VerificationQueueItem {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new VerificationQueueSchemaError(
      "invalid-item",
      "VerificationQueueItem must be an object.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new VerificationQueueSchemaError(
      "missing-id",
      "Queue item id is required.",
      `${path}.id`,
    );
  }

  if (typeof o.question !== "string" || !o.question.trim()) {
    throw new VerificationQueueSchemaError(
      "missing-question",
      "Queue item question is required.",
      `${path}.question`,
    );
  }

  if (!Array.isArray(o.cards)) {
    throw new VerificationQueueSchemaError(
      "invalid-cards",
      "cards must be an array of string card ids.",
      `${path}.cards`,
    );
  }
  const cards = o.cards.map((c, idx) => {
    if (typeof c !== "string" || !c.trim()) {
      throw new VerificationQueueSchemaError(
        "invalid-card-id",
        `Card id at index ${idx} must be a non-empty string.`,
        `${path}.cards[${idx}]`,
      );
    }
    return c.trim();
  });

  if (typeof o.sourceToConsult !== "string" || !o.sourceToConsult.trim()) {
    throw new VerificationQueueSchemaError(
      "missing-source-to-consult",
      "sourceToConsult is required.",
      `${path}.sourceToConsult`,
    );
  }

  if (typeof o.landsIn !== "string" || !o.landsIn.trim()) {
    throw new VerificationQueueSchemaError(
      "missing-lands-in",
      "landsIn field name or recipient bead is required.",
      `${path}.landsIn`,
    );
  }
  const landsIn = o.landsIn.trim();

  // If cards array is empty, landsIn must name a receiving bead (e.g. am-...)
  if (cards.length === 0 && !/^am-[a-z0-9-]+$/.test(landsIn)) {
    throw new VerificationQueueSchemaError(
      "empty-cards-missing-recipient-bead",
      `Queue item "${o.id}" has no cards, so landsIn must name a receiving bead (got "${landsIn}").`,
      `${path}.landsIn`,
    );
  }

  if (typeof o.status !== "string" || !["open", "resolved", "narrowed"].includes(o.status)) {
    throw new VerificationQueueSchemaError(
      "invalid-status",
      `Queue item status must be "open", "resolved", or "narrowed" (got "${o.status}").`,
      `${path}.status`,
    );
  }
  const status = o.status as "open" | "resolved" | "narrowed";

  const explanation = typeof o.explanation === "string" ? o.explanation.trim() : undefined;
  if (status === "narrowed" && (!explanation || explanation.length === 0)) {
    throw new VerificationQueueSchemaError(
      "card-queue-narrowed-missing-explanation",
      `Narrowed queue item "${o.id}" requires a non-empty explanation of what could not be established.`,
      `${path}.explanation`,
    );
  }

  return {
    id: o.id.trim(),
    question: o.question.trim(),
    cards,
    sourceToConsult: o.sourceToConsult.trim(),
    landsIn,
    status,
    ...(explanation ? { explanation } : {}),
  };
}

/**
 * Validates a verification queue file containing an array of items.
 */
export function validateVerificationQueueFile(
  raw: unknown,
  path = "VerificationQueueFile",
): VerificationQueueFile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new VerificationQueueSchemaError(
      "invalid-queue-file",
      "VerificationQueueFile must be an object.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  const group = typeof o.group === "string" && o.group.trim() ? o.group.trim() : "general";

  if (!Array.isArray(o.items)) {
    throw new VerificationQueueSchemaError(
      "missing-items",
      "items array is required in verification queue file.",
      `${path}.items`,
    );
  }

  const items = o.items.map((item, idx) =>
    validateVerificationQueueItem(item, `${path}.items[${idx}]`),
  );

  return {
    group,
    items,
  };
}

/**
 * Cross-validates a verification queue against a set of knowledge cards (Rule 9).
 */
export function crossValidateQueueWithCards(
  queueItems: readonly VerificationQueueItem[],
  cardsMap: ReadonlyMap<string, KnowledgeCard>,
): readonly CardRuleDiagnostic[] {
  const diagnostics: CardRuleDiagnostic[] = [];

  for (const item of queueItems) {
    for (const cardId of item.cards) {
      const card = cardsMap.get(cardId);
      if (!card) {
        diagnostics.push({
          severity: "error",
          rule: "card-queue-unknown-card",
          cardId,
          message: `Queue item "${item.id}" references card "${cardId}" which does not exist.`,
          repair: `Add card "${cardId}" or remove from queue item "${item.id}".`,
        });
        continue;
      }

      // Check if open queue item blocks verification record
      const isVerified = Boolean(card.verification || card.verifier);
      if (item.status === "open" && isVerified) {
        diagnostics.push({
          severity: "error",
          rule: "card-open-queue-blocks-verification",
          cardId,
          message: `Card "${cardId}" has an open verification queue item "${item.id}" and cannot carry a verification record.`,
          repair: `Settle question "${item.id}" (mark resolved or narrowed) before verifying "${cardId}".`,
        });
      }

      // Check if resolved / narrowed item has empty landsIn field on card
      if (item.status === "resolved" || item.status === "narrowed") {
        const fieldName = item.landsIn;
        if (!fieldName.startsWith("am-")) {
          // It targets a card field
          const fieldValue = (card as unknown as Record<string, unknown>)[fieldName];
          const isEmpty =
            fieldValue === undefined ||
            fieldValue === null ||
            (typeof fieldValue === "string" && fieldValue.trim() === "") ||
            (Array.isArray(fieldValue) && fieldValue.length === 0);

          if (isEmpty) {
            diagnostics.push({
              severity: "warning",
              rule: "card-queue-lands-in-empty-field",
              cardId,
              message: `Queue item "${item.id}" is marked "${item.status}" with landsIn "${fieldName}", but card "${cardId}" leaves "${fieldName}" empty.`,
              repair: `Populate field "${fieldName}" on card "${cardId}".`,
            });
          }
        }
      }
    }
  }

  return diagnostics;
}
