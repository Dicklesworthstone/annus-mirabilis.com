import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { globalKnowledgeCardsLogger } from "./knowledgeCardsLogger.ts";
import type { KnowledgeCard, VerificationQueueItem } from "./types.ts";
import {
  crossValidateQueueWithCards,
  VerificationQueueSchemaError,
  validateVerificationQueueFile,
  validateVerificationQueueItem,
} from "./verificationQueue.ts";

describe("am-disc-knowledge-cards-iw8j: verification queue validation", () => {
  test("validates a well-formed queue item and file", () => {
    const start = Date.now();
    const rawFile = {
      group: "brownian",
      items: [
        {
          id: "q-sutherland-dunedin",
          question: "What exact formula was recorded in the Dunedin meeting proceedings?",
          cards: ["sutherland-1904-dunedin"],
          sourceToConsult: "AAAS Dunedin 1904 Meeting Report",
          landsIn: "proposition",
          status: "open",
        },
      ],
    };

    const parsed = validateVerificationQueueFile(rawFile);
    assert.equal(parsed.group, "brownian");
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.id, "q-sutherland-dunedin");

    globalKnowledgeCardsLogger.log({
      testId: "queue-schema-well-formed-file",
      queueId: "q-sutherland-dunedin",
      queueStatus: "open",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Well-formed verification queue YAML file validated.",
    });
  });

  test("Rule 9: card with an open queue item cannot carry a verification record", () => {
    const start = Date.now();
    const verifiedCard: KnowledgeCard = {
      id: "sutherland-1904-dunedin",
      proposition: "Diffusion formula presented at Dunedin.",
      status: "available",
      sources: ["Report"],
      date: {
        earliest: "1904",
        latest: "1904",
        precision: "year",
        latestYear: 1904,
        eventKind: "presented",
      },
      verification: {
        verifiedBy: "Agent",
        verifierKind: "agent",
        date: "2026-09-01",
        method: "library scan",
        evidenceLocator: "https://example.com/scan",
      },
    };

    const openQueueItem: VerificationQueueItem = {
      id: "q-sutherland-formula",
      question: "Was the slip correction included in the presentation?",
      cards: ["sutherland-1904-dunedin"],
      sourceToConsult: "Dunedin proceedings",
      landsIn: "proposition",
      status: "open",
    };

    const diags = crossValidateQueueWithCards(
      [openQueueItem],
      new Map([[verifiedCard.id, verifiedCard]]),
    );
    assert.ok(
      diags.some((d) => d.rule === "card-open-queue-blocks-verification"),
      "Card with verification and open queue item must produce error",
    );

    globalKnowledgeCardsLogger.log({
      testId: "rule-9-open-queue-blocks-verification",
      cardId: verifiedCard.id,
      queueId: openQueueItem.id,
      queueStatus: "open",
      rule: "card-open-queue-blocks-verification",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Open verification queue item blocked card verification record.",
    });
  });

  test("narrowed queue item without explanation is rejected", () => {
    const start = Date.now();
    const rawNarrowed = {
      id: "q-narrowed-test",
      question: "Could we locate the original manuscript?",
      cards: ["card-1"],
      sourceToConsult: "Archive",
      landsIn: "limits",
      status: "narrowed",
    };

    assert.throws(
      () => validateVerificationQueueItem(rawNarrowed),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "card-queue-narrowed-missing-explanation");
        return true;
      },
    );

    globalKnowledgeCardsLogger.log({
      testId: "queue-narrowed-requires-explanation",
      queueId: "q-narrowed-test",
      queueStatus: "narrowed",
      rule: "card-queue-narrowed-missing-explanation",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Narrowed queue item without explanation rejected.",
    });
  });

  test("queue item naming an unknown card is reported as error", () => {
    const start = Date.now();
    const queueItem: VerificationQueueItem = {
      id: "q-unknown-card",
      question: "Did author check the data?",
      cards: ["nonexistent-card-id"],
      sourceToConsult: "Book",
      landsIn: "proposition",
      status: "open",
    };

    const diags = crossValidateQueueWithCards([queueItem], new Map());
    assert.ok(
      diags.some((d) => d.rule === "card-queue-unknown-card"),
      "Queue item naming unknown card must produce card-queue-unknown-card",
    );

    globalKnowledgeCardsLogger.log({
      testId: "queue-unknown-card-fails",
      queueId: queueItem.id,
      cardId: "nonexistent-card-id",
      rule: "card-queue-unknown-card",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Queue item naming nonexistent card reported as error.",
    });
  });

  test("queue item with no cards is accepted when landsIn names a receiving bead", () => {
    const start = Date.now();
    const beadRecipientItem = {
      id: "q-timeline-question",
      question: "Was the appointment letter received before or after publication?",
      cards: [],
      sourceToConsult: "University Archives",
      landsIn: "am-disc-timeline-xzef",
      status: "open",
    };

    const valid = validateVerificationQueueItem(beadRecipientItem);
    assert.equal(valid.landsIn, "am-disc-timeline-xzef");

    // Fails if cards is empty and landsIn is not a bead
    assert.throws(
      () =>
        validateVerificationQueueItem({
          ...beadRecipientItem,
          landsIn: "proposition",
        }),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "empty-cards-missing-recipient-bead");
        return true;
      },
    );

    globalKnowledgeCardsLogger.log({
      testId: "queue-empty-cards-requires-recipient-bead",
      queueId: beadRecipientItem.id,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Empty cards array accepted only when landsIn targets a receiving bead ID.",
    });
  });

  test("resolved entry targeting empty card field yields warning; targeting populated priorEvent passes", () => {
    const start = Date.now();
    const cardWithoutLimits: KnowledgeCard = {
      id: "card-limits-test",
      proposition: "Some proposition.",
      status: "available",
      sources: ["Book"],
      date: {
        earliest: "1900",
        latest: "1900",
        precision: "year",
        latestYear: 1900,
        eventKind: "published",
      },
    };

    const itemForLimits: VerificationQueueItem = {
      id: "q-limits",
      question: "What are the temperature limits?",
      cards: ["card-limits-test"],
      sourceToConsult: "Table 1",
      landsIn: "limits",
      status: "resolved",
    };

    const diags = crossValidateQueueWithCards(
      [itemForLimits],
      new Map([[cardWithoutLimits.id, cardWithoutLimits]]),
    );
    assert.ok(
      diags.some((d) => d.rule === "card-queue-lands-in-empty-field"),
      "Resolved item targeting empty field must produce warning",
    );

    // Siedentopf Q6 landsIn priorEvent which is populated
    const siedentopfCard: KnowledgeCard = {
      id: "siedentopf-1903-ultramicroscope",
      proposition: "Ultramicroscope.",
      status: "available",
      sources: ["Ann. Phys."],
      date: {
        earliest: "1903",
        latest: "1903",
        precision: "year",
        latestYear: 1903,
        eventKind: "published",
      },
      priorEvent: {
        eventKind: "performed",
        earliest: "1902",
        latest: "1902",
        precision: "year",
      },
    };
    const siedentopfQ6: VerificationQueueItem = {
      id: "q6-siedentopf-performed",
      question: "When was the ultramicroscope demonstration performed?",
      cards: ["siedentopf-1903-ultramicroscope"],
      sourceToConsult: "Ann. Phys. 1903",
      landsIn: "priorEvent",
      status: "resolved",
    };

    const siedeDiags = crossValidateQueueWithCards(
      [siedentopfQ6],
      new Map([[siedentopfCard.id, siedentopfCard]]),
    );
    assert.equal(siedeDiags.length, 0, "Resolved item with populated priorEvent passes cleanly");

    globalKnowledgeCardsLogger.log({
      testId: "queue-resolved-lands-in-validation",
      cardId: siedentopfCard.id,
      queueId: siedentopfQ6.id,
      queueStatus: "resolved",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Resolved queue item targeting empty field warned; populated priorEvent validated.",
    });
  });
});

describe("verificationQueue.ts refusal throw sites coverage (am-muyh)", () => {
  const baseValidItem = {
    id: "q-test-1",
    question: "Was the formula verified?",
    cards: ["card-1"],
    sourceToConsult: "Proceedings 1905",
    landsIn: "proposition",
    status: "open",
  };

  test("validateVerificationQueueItem: (verificationQueue.ts:36) invalid-item rejects non-object input, accepts valid item object", () => {
    // Reject: non-object input
    assert.throws(
      () => validateVerificationQueueItem(null as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "invalid-item");
        assert.equal(err.path, "VerificationQueueItem");
        return true;
      },
    );
    assert.throws(
      () => validateVerificationQueueItem([] as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "invalid-item");
        return true;
      },
    );

    // Accept: valid object item
    const valid = validateVerificationQueueItem(baseValidItem);
    assert.equal(valid.id, "q-test-1");
  });

  test("validateVerificationQueueItem: (verificationQueue.ts:45) missing-id rejects empty or missing id, accepts non-empty id", () => {
    // Reject: missing/empty id
    assert.throws(
      () => validateVerificationQueueItem({ ...baseValidItem, id: "  " } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "missing-id");
        assert.equal(err.path, "VerificationQueueItem.id");
        return true;
      },
    );

    // Accept: valid non-empty id
    const valid = validateVerificationQueueItem({ ...baseValidItem, id: "q-valid-id" });
    assert.equal(valid.id, "q-valid-id");
  });

  test("validateVerificationQueueItem: (verificationQueue.ts:53) missing-question rejects empty or missing question, accepts non-empty question", () => {
    // Reject: missing/empty question
    assert.throws(
      () => validateVerificationQueueItem({ ...baseValidItem, question: "" } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "missing-question");
        assert.equal(err.path, "VerificationQueueItem.question");
        return true;
      },
    );

    // Accept: valid question
    const valid = validateVerificationQueueItem({
      ...baseValidItem,
      question: "What is the result?",
    });
    assert.equal(valid.question, "What is the result?");
  });

  test("validateVerificationQueueItem: (verificationQueue.ts:61) invalid-cards rejects non-array cards, accepts array of card ids", () => {
    // Reject: cards is not an array
    assert.throws(
      () => validateVerificationQueueItem({ ...baseValidItem, cards: "not-an-array" } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "invalid-cards");
        assert.equal(err.path, "VerificationQueueItem.cards");
        return true;
      },
    );

    // Accept: cards is a valid array
    const valid = validateVerificationQueueItem({
      ...baseValidItem,
      cards: ["card-1", "card-2"],
    });
    assert.deepEqual(valid.cards, ["card-1", "card-2"]);
  });

  test("validateVerificationQueueItem: (verificationQueue.ts:69) invalid-card-id rejects non-string or whitespace card id, accepts trimmed non-empty card id", () => {
    // Reject: card id is empty string or non-string
    assert.throws(
      () => validateVerificationQueueItem({ ...baseValidItem, cards: ["card-1", "   "] } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "invalid-card-id");
        assert.equal(err.path, "VerificationQueueItem.cards[1]");
        return true;
      },
    );

    // Accept: all card ids are non-empty strings
    const valid = validateVerificationQueueItem({
      ...baseValidItem,
      cards: [" card-alpha ", "card-beta"],
    });
    assert.deepEqual(valid.cards, ["card-alpha", "card-beta"]);
  });

  test("validateVerificationQueueItem: (verificationQueue.ts:79) missing-source-to-consult rejects empty sourceToConsult, accepts non-empty source", () => {
    // Reject: empty sourceToConsult
    assert.throws(
      () => validateVerificationQueueItem({ ...baseValidItem, sourceToConsult: " " } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "missing-source-to-consult");
        assert.equal(err.path, "VerificationQueueItem.sourceToConsult");
        return true;
      },
    );

    // Accept: valid sourceToConsult
    const valid = validateVerificationQueueItem({
      ...baseValidItem,
      sourceToConsult: "Archival Report 1905",
    });
    assert.equal(valid.sourceToConsult, "Archival Report 1905");
  });

  test("validateVerificationQueueItem: (verificationQueue.ts:87) missing-lands-in rejects empty landsIn, accepts non-empty landsIn", () => {
    // Reject: empty landsIn
    assert.throws(
      () => validateVerificationQueueItem({ ...baseValidItem, landsIn: "" } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "missing-lands-in");
        assert.equal(err.path, "VerificationQueueItem.landsIn");
        return true;
      },
    );

    // Accept: valid landsIn
    const valid = validateVerificationQueueItem({ ...baseValidItem, landsIn: "limits" });
    assert.equal(valid.landsIn, "limits");
  });

  test("validateVerificationQueueItem: (verificationQueue.ts:105) invalid-status rejects unadmitted status string, accepts open, resolved, or narrowed", () => {
    // Reject: invalid status
    assert.throws(
      () => validateVerificationQueueItem({ ...baseValidItem, status: "pending" } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "invalid-status");
        assert.equal(err.path, "VerificationQueueItem.status");
        return true;
      },
    );

    // Accept: valid statuses
    const openItem = validateVerificationQueueItem({ ...baseValidItem, status: "open" });
    assert.equal(openItem.status, "open");
    const resolvedItem = validateVerificationQueueItem({ ...baseValidItem, status: "resolved" });
    assert.equal(resolvedItem.status, "resolved");
    const narrowedItem = validateVerificationQueueItem({
      ...baseValidItem,
      status: "narrowed",
      explanation: "Historical record unverified.",
    });
    assert.equal(narrowedItem.status, "narrowed");
  });

  test("validateVerificationQueueFile: (verificationQueue.ts:141) invalid-queue-file rejects non-object raw file, accepts valid file object", () => {
    // Reject: non-object queue file
    assert.throws(
      () => validateVerificationQueueFile(null as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "invalid-queue-file");
        assert.equal(err.path, "VerificationQueueFile");
        return true;
      },
    );
    assert.throws(
      () => validateVerificationQueueFile([] as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "invalid-queue-file");
        return true;
      },
    );

    // Accept: valid queue file object
    const valid = validateVerificationQueueFile({ group: "brownian", items: [] });
    assert.equal(valid.group, "brownian");
    assert.deepEqual(valid.items, []);
  });

  test("validateVerificationQueueFile: (verificationQueue.ts:152) missing-items rejects non-array items property, accepts array of items", () => {
    // Reject: missing/non-array items
    assert.throws(
      () => validateVerificationQueueFile({ group: "brownian", items: "not-an-array" } as any),
      (err: unknown) => {
        assert.ok(err instanceof VerificationQueueSchemaError);
        assert.equal(err.code, "missing-items");
        assert.equal(err.path, "VerificationQueueFile.items");
        return true;
      },
    );

    // Accept: items is an array of valid queue items
    const valid = validateVerificationQueueFile({
      group: "brownian",
      items: [baseValidItem],
    });
    assert.equal(valid.items.length, 1);
    assert.equal(valid.items[0]?.id, "q-test-1");
  });
});
