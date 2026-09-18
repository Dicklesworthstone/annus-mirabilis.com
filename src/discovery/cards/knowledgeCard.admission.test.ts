import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { validateCardCitation } from "./cardRules.ts";
import { globalKnowledgeCardsLogger } from "./knowledgeCardsLogger.ts";
import type { KnowledgeCard } from "./types.ts";

describe("am-disc-knowledge-cards-iw8j: admission gate and priorEvent inertia", () => {
  test("Rule 13: priorEvent is inert to admission; a card with date 1906 and priorEvent 1904 is refused naming 1906", () => {
    const start = Date.now();
    const card1906: KnowledgeCard = {
      id: "theoretical-presented-1904-published-1906",
      proposition: "Theoretical derivation presented in 1904 but not published until 1906.",
      status: "available",
      sources: ["Proceedings 1906"],
      date: {
        earliest: "1906",
        latest: "1906",
        precision: "year",
        latestYear: 1906,
        eventKind: "published",
      },
      priorEvent: {
        eventKind: "presented",
        earliest: "1904-05",
        latest: "1904-05",
        precision: "month",
      },
      admittedStages: ["stage-bm-diffusion"],
    };

    const diags = validateCardCitation(card1906, {
      stageId: "stage-bm-diffusion",
      journeyId: "journey-brownian",
    });

    const refusal = diags.find((d) => d.rule === "shelf-date-violation");
    assert.ok(refusal, "Must refuse a 1906 publication despite a 1904 priorEvent");
    assert.ok(
      refusal?.message.includes("1906"),
      "Diagnostic must name 1906 (the availability date)",
    );

    globalKnowledgeCardsLogger.log({
      testId: "rule-13-prior-event-inert-to-admission",
      cardId: card1906.id,
      stageId: "stage-bm-diffusion",
      rule: "shelf-date-violation",
      latestYear: 1906,
      priorEventKind: "presented",
      priorEventLatest: "1904-05",
      outcome: "refusal",
      durationMs: Date.now() - start,
      message: "priorEvent confirmed inert to admission; 1906 card refused naming 1906.",
    });
  });

  test("AC 10: test seeds a card whose priorEvent is 1903 and whose date is 1906 and asserts that a stage citing it is still refused", () => {
    const start = Date.now();
    const card1903Prior1906Date: KnowledgeCard = {
      id: "experimental-observed-1903-published-1906",
      proposition: "Observation made in 1903 but published in 1906.",
      status: "available",
      sources: ["Annalen 1906"],
      date: {
        earliest: "1906",
        latest: "1906",
        precision: "year",
        latestYear: 1906,
        eventKind: "published",
      },
      priorEvent: {
        eventKind: "performed",
        earliest: "1903",
        latest: "1903",
        precision: "year",
      },
      admittedStages: ["stage-bm-diffusion"],
    };

    const diags = validateCardCitation(card1903Prior1906Date, {
      stageId: "stage-bm-diffusion",
      journeyId: "journey-brownian",
    });

    const refusal = diags.find((d) => d.rule === "shelf-date-violation");
    assert.ok(refusal, "Must refuse a 1906 publication despite a 1903 priorEvent");
    assert.ok(
      refusal?.message.includes("1906"),
      "Diagnostic must name 1906 (the availability date)",
    );

    globalKnowledgeCardsLogger.log({
      testId: "ac10-prior-event-1903-date-1906-refused",
      cardId: card1903Prior1906Date.id,
      stageId: "stage-bm-diffusion",
      rule: "shelf-date-violation",
      latestYear: 1906,
      priorEventKind: "performed",
      priorEventLatest: "1903",
      outcome: "refusal",
      durationMs: Date.now() - start,
      message: "priorEvent 1903 inert to admission; 1906 card refused naming 1906.",
    });
  });

  test("AC 8: fixture card with 1904 presented and 1906 published unified vs split refusal", () => {
    const start = Date.now();
    // 1. Single card with date = 1906 publication and priorEvent = 1904 presentation
    const unifiedCard: KnowledgeCard = {
      id: "presented-1904-published-1906-unified",
      proposition: "Theoretical concept presented 1904, published 1906.",
      status: "available",
      sources: ["Annalen 1906"],
      date: {
        earliest: "1906",
        latest: "1906",
        precision: "year",
        latestYear: 1906,
        eventKind: "published",
      },
      priorEvent: {
        eventKind: "presented",
        earliest: "1904",
        latest: "1904",
        precision: "year",
      },
      admittedStages: ["stage-bm-diffusion"],
    };

    assert.equal(unifiedCard.date.latestYear, 1906);
    const unifiedDiags = validateCardCitation(unifiedCard, {
      stageId: "stage-bm-diffusion",
      journeyId: "journey-brownian",
    });
    const unifiedRefusal = unifiedDiags.find((d) => d.rule === "shelf-date-violation");
    assert.ok(unifiedRefusal, "Unified card must be refused by shelf-date-violation");
    assert.ok(unifiedRefusal?.message.includes("1906"));

    // 2. Split cards: the publication card still has latestYear 1906 and is refused
    const splitPubCard: KnowledgeCard = {
      id: "presented-1904-published-1906-split-pub",
      proposition: "Theoretical concept published 1906.",
      status: "parallel-work",
      parallelWorkBasis: "Published 1906, after 1905 paper submission and publication.",
      sources: ["Annalen 1906"],
      date: {
        earliest: "1906",
        latest: "1906",
        precision: "year",
        latestYear: 1906,
        eventKind: "published",
      },
      relatedCardId: "presented-1904-published-1906-split-pres",
      admittedStages: ["stage-bm-diffusion"],
    };

    const splitPubDiags = validateCardCitation(splitPubCard, {
      stageId: "stage-bm-diffusion",
      journeyId: "journey-brownian",
      // unacknowledged parallel work -> refused
      parallelWorkAcknowledged: false,
    });
    assert.ok(
      splitPubDiags.some(
        (d) => d.rule === "shelf-date-violation" || d.rule === "card-parallel-work-unacknowledged",
      ),
      "Split publication card must not bypass availability checks",
    );

    globalKnowledgeCardsLogger.log({
      testId: "ac8-unified-and-split-presentation-publication-refusal",
      cardId: unifiedCard.id,
      stageId: "stage-bm-diffusion",
      rule: "shelf-date-violation",
      latestYear: 1906,
      outcome: "refusal",
      durationMs: Date.now() - start,
      message: "Unified and split cards with 1906 publication correctly refused.",
    });
  });

  test("Dunedin fixture card (presented 1904, available) is admitted to 1904 stage", () => {
    const start = Date.now();
    const dunedinCard: KnowledgeCard = {
      id: "sutherland-1904-dunedin",
      proposition: "Diffusion coefficient formula presented in Dunedin, Jan 1904.",
      status: "available",
      sources: ["AAAS Dunedin Meeting (1904)"],
      date: {
        earliest: "1904-01",
        latest: "1904-01",
        precision: "month",
        latestYear: 1904,
        eventKind: "presented",
      },
      admittedStages: ["stage-sutherland"],
    };

    const diags = validateCardCitation(dunedinCard, {
      stageId: "stage-sutherland",
      journeyId: "journey-brownian",
    });
    assert.equal(diags.length, 0, "Dunedin 1904 card must be admitted cleanly");

    globalKnowledgeCardsLogger.log({
      testId: "dunedin-1904-fixture-admitted",
      cardId: dunedinCard.id,
      stageId: "stage-sutherland",
      status: "available",
      latestYear: 1904,
      eventKind: "presented",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Dunedin 1904 presentation card admitted cleanly to 1904 stage.",
    });
  });

  test("Phil. Mag. fixture card (published 1905, parallel-work) is refused without acknowledgment and admitted with it", () => {
    const start = Date.now();
    const philMagCard: KnowledgeCard = {
      id: "sutherland-1905-phil-mag",
      proposition: "Diffusion formula with slip correction in Phil. Mag.",
      status: "parallel-work",
      parallelWorkBasis: "Published June 1905.",
      sources: ["Phil. Mag. 9, 781 (1905)"],
      date: {
        earliest: "1905-06",
        latest: "1905-06",
        precision: "month",
        latestYear: 1905,
        eventKind: "published",
      },
      admittedStages: ["stage-sutherland"],
    };

    // Unacknowledged -> refused
    const unackDiags = validateCardCitation(philMagCard, {
      stageId: "stage-sutherland",
      journeyId: "journey-brownian",
      parallelWorkAcknowledged: false,
    });
    assert.ok(
      unackDiags.some((d) => d.rule === "card-parallel-work-unacknowledged"),
      "Must refuse unacknowledged parallel work",
    );

    // Acknowledged -> admitted
    const ackDiags = validateCardCitation(philMagCard, {
      stageId: "stage-sutherland",
      journeyId: "journey-brownian",
      parallelWorkAcknowledged: true,
    });
    assert.equal(ackDiags.length, 0, "Must admit acknowledged parallel work");

    globalKnowledgeCardsLogger.log({
      testId: "phil-mag-1905-parallel-work-admission",
      cardId: philMagCard.id,
      stageId: "stage-sutherland",
      status: "parallel-work",
      latestYear: 1905,
      eventKind: "published",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Phil. Mag. 1905 parallel work refused without acknowledgment and admitted with it.",
    });
  });
});
