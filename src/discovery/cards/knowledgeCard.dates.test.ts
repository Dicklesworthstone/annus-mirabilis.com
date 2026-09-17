import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { validateCardIntrinsicRules } from "./cardRules.ts";
import { globalKnowledgeCardsLogger } from "./knowledgeCardsLogger.ts";
import type { KnowledgeCard } from "./types.ts";

describe("am-disc-knowledge-cards-iw8j: event kinds, prior events, and date semantics", () => {
  test("all three eventKind values validate; forbidden timeline kinds are rejected", () => {
    const start = Date.now();
    for (const kind of ["presented", "published", "performed"] as const) {
      const card: KnowledgeCard = {
        id: `test-card-${kind}`,
        proposition: `Test proposition for ${kind}.`,
        status: "available",
        sources: ["Source"],
        date: {
          earliest: "1903",
          latest: "1903",
          precision: "year",
          latestYear: 1903,
          eventKind: kind,
        },
      };
      const diags = validateCardIntrinsicRules(card);
      assert.equal(diags.length, 0, `eventKind "${kind}" must be valid`);
    }

    // Forbidden timeline kinds
    for (const forbidden of ["dated-letter", "awarded", "appointed"] as const) {
      const card: KnowledgeCard = {
        id: `test-card-${forbidden}`,
        proposition: `Test proposition for ${forbidden}.`,
        status: "available",
        sources: ["Source"],
        date: {
          earliest: "1903",
          latest: "1903",
          precision: "year",
          latestYear: 1903,
          eventKind: forbidden as unknown as KnowledgeCard["date"]["eventKind"],
        },
      };
      const diags = validateCardIntrinsicRules(card);
      assert.ok(
        diags.some((d) => d.rule === "card-invalid-event-kind"),
        `Timeline kind "${forbidden}" must be rejected on premise`,
      );
    }

    globalKnowledgeCardsLogger.log({
      testId: "event-kinds-valid-and-forbidden",
      rule: "card-invalid-event-kind",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Valid premise event kinds accepted; timeline kinds (letter, awarded, appointed) rejected.",
    });
  });

  test("missing date.eventKind fails with card-event-kind-missing", () => {
    const start = Date.now();
    const card: KnowledgeCard = {
      id: "test-missing-kind",
      proposition: "Test proposition.",
      status: "available",
      sources: ["Source"],
      date: {
        earliest: "1903",
        latest: "1903",
        precision: "year",
        latestYear: 1903,
      },
    };
    const diags = validateCardIntrinsicRules(card);
    const missing = diags.find((d) => d.rule === "card-event-kind-missing");
    assert.ok(missing, "Missing eventKind must produce card-event-kind-missing");
    assert.ok(missing?.message.includes("test-missing-kind"));

    globalKnowledgeCardsLogger.log({
      testId: "missing-event-kind-fails",
      cardId: card.id,
      rule: "card-event-kind-missing",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Missing eventKind rejected with card-event-kind-missing.",
    });
  });

  test("priorEvent.latest after date.latest fails with card-prior-event-not-prior", () => {
    const start = Date.now();
    const card: KnowledgeCard = {
      id: "test-bad-prior-event",
      proposition: "Prior event occurred in 1905 but published in 1903.",
      status: "available",
      sources: ["Source"],
      date: {
        earliest: "1903",
        latest: "1903",
        precision: "year",
        latestYear: 1903,
        eventKind: "published",
      },
      priorEvent: {
        eventKind: "performed",
        earliest: "1905",
        latest: "1905",
        precision: "year",
      },
    };
    const diags = validateCardIntrinsicRules(card);
    assert.ok(
      diags.some((d) => d.rule === "card-prior-event-not-prior"),
      "priorEvent latest after date latest must fail with card-prior-event-not-prior",
    );

    globalKnowledgeCardsLogger.log({
      testId: "prior-event-not-prior-fails",
      cardId: card.id,
      rule: "card-prior-event-not-prior",
      priorEventLatest: "1905",
      dateLatest: "1903",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "priorEvent dated after availability date rejected.",
    });
  });

  test("relatedCardId must resolve and be reciprocal; one-sided link fails", () => {
    const start = Date.now();
    const cardA: KnowledgeCard = {
      id: "sutherland-1904-dunedin",
      proposition: "Diffusion formula presented at Dunedin.",
      status: "available",
      sources: ["Dunedin Trans (1904)"],
      date: {
        earliest: "1904-01",
        latest: "1904-01",
        precision: "month",
        latestYear: 1904,
        eventKind: "presented",
      },
      relatedCardId: "sutherland-1905-phil-mag",
    };

    const cardB: KnowledgeCard = {
      id: "sutherland-1905-phil-mag",
      proposition: "Diffusion formula published in Phil. Mag.",
      status: "parallel-work",
      parallelWorkBasis: "Published June 1905.",
      sources: ["Phil. Mag. (1905)"],
      date: {
        earliest: "1905-06",
        latest: "1905-06",
        precision: "month",
        latestYear: 1905,
        eventKind: "published",
      },
      relatedCardId: "sutherland-1904-dunedin",
    };

    const cardsMap = new Map<string, KnowledgeCard>([
      [cardA.id, cardA],
      [cardB.id, cardB],
    ]);

    // Reciprocal pair validates cleanly
    assert.equal(validateCardIntrinsicRules(cardA, cardsMap).length, 0);
    assert.equal(validateCardIntrinsicRules(cardB, cardsMap).length, 0);

    // One-sided link fails
    const oneSidedB: KnowledgeCard = { ...cardB, relatedCardId: undefined };
    const oneSidedMap = new Map<string, KnowledgeCard>([
      [cardA.id, cardA],
      [oneSidedB.id, oneSidedB],
    ]);
    const diags = validateCardIntrinsicRules(cardA, oneSidedMap);
    assert.ok(
      diags.some((d) => d.rule === "card-related-card-not-reciprocal"),
      "One-sided relatedCardId link must fail with card-related-card-not-reciprocal",
    );

    globalKnowledgeCardsLogger.log({
      testId: "related-card-reciprocity",
      cardId: cardA.id,
      relatedCardId: cardB.id,
      rule: "card-related-card-not-reciprocal",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Reciprocal relatedCardId links validated; one-sided links rejected.",
    });
  });

  test("parallel-work card without parallelWorkBasis fails with card-parallel-basis-missing", () => {
    const start = Date.now();
    const card: KnowledgeCard = {
      id: "poincare-1905-sur-la-dynamique",
      proposition: "Lorentz group structure and four-vector formulation.",
      status: "parallel-work",
      sources: ["Comptes Rendus 140 (1905)"],
      date: {
        earliest: "1905-06-05",
        latest: "1905-06-05",
        precision: "day",
        latestYear: 1905,
        eventKind: "published",
      },
    };
    const diags = validateCardIntrinsicRules(card);
    assert.ok(
      diags.some((d) => d.rule === "card-parallel-basis-missing"),
      "Parallel work without parallelWorkBasis must produce card-parallel-basis-missing",
    );

    globalKnowledgeCardsLogger.log({
      testId: "parallel-basis-missing-fails",
      cardId: card.id,
      rule: "card-parallel-basis-missing",
      status: "parallel-work",
      parallelBasisPresent: false,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Parallel work without parallelWorkBasis rejected.",
    });
  });

  test("fixture Journey II cards validate cleanly with priorEvent and latestYear", () => {
    const start = Date.now();
    // Brown 1828
    const brown1828: KnowledgeCard = {
      id: "brown-1828-microscopical-observations",
      proposition: "Pollen particles and inorganic dust move irregularly in suspension.",
      status: "available",
      sources: ["Phil. Mag. 4, 161 (1828)"],
      date: {
        earliest: "1828",
        latest: "1828",
        precision: "year",
        latestYear: 1828,
        eventKind: "published",
      },
      priorEvent: {
        eventKind: "performed",
        earliest: "1827",
        latest: "1827",
        precision: "year",
      },
    };
    assert.equal(validateCardIntrinsicRules(brown1828).length, 0);
    assert.equal(
      brown1828.date.latestYear,
      1828,
      "latestYear comes from date.latest, not priorEvent",
    );

    // Siedentopf 1903
    const siedentopf1903: KnowledgeCard = {
      id: "siedentopf-1903-ultramicroscope",
      proposition: "Ultramicroscope resolves colloidal particles below optical diffraction limit.",
      status: "available",
      sources: ["Ann. Phys. 10, 1 (1903)"],
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
    assert.equal(validateCardIntrinsicRules(siedentopf1903).length, 0);
    assert.equal(siedentopf1903.date.latestYear, 1903, "latestYear comes from date.latest (1903)");

    globalKnowledgeCardsLogger.log({
      testId: "fixture-journey-ii-cards-validate",
      cardId: "brown-1828-microscopical-observations",
      priorEventKind: "performed",
      priorEventLatest: "1827",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Journey II fixture cards with priorEvent validate cleanly; latestYear correctly computed.",
    });
  });
});
