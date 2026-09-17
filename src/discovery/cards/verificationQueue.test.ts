import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { KnowledgeCard, VerificationQueueItem } from "./types.ts";
import {
  crossValidateQueueWithCards,
  VerificationQueueSchemaError,
  validateVerificationQueueFile,
  validateVerificationQueueItem,
} from "./verificationQueue.ts";

describe("am-disc-knowledge-cards-iw8j: verification queue validation", () => {
  test("validates a well-formed queue item and file", () => {
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
  });

  test("Rule 9: card with an open queue item cannot carry a verification record", () => {
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
  });

  test("narrowed queue item without explanation is rejected", () => {
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
  });

  test("queue item naming an unknown card is reported as error", () => {
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
  });

  test("queue item with no cards is accepted when landsIn names a receiving bead", () => {
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
  });

  test("resolved entry targeting empty card field yields warning; targeting populated priorEvent passes", () => {
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
  });
});
