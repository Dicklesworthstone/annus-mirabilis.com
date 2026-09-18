import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  checkDuplicateCards,
  checkVerificationQueueRule,
  validateCardCitation,
  validateCardIntrinsicRules,
} from "./cardRules.ts";
import { globalKnowledgeCardsLogger } from "./knowledgeCardsLogger.ts";
import type { KnowledgeCard, VerificationQueueItem } from "./types.ts";

describe("am-disc-knowledge-cards-iw8j: card rules enforcement", () => {
  test("Rule 1 & Planted Negative: available card dated 1905 cited by a stage fails with shelf-date-violation", () => {
    const start = Date.now();
    const card1905: KnowledgeCard = {
      id: "test-1905-late-paper",
      proposition: "Some claim published after 1904 cutoff.",
      status: "available",
      sources: ["Some Journal 1905"],
      date: {
        earliest: "1905",
        latest: "1905",
        precision: "year",
        latestYear: 1905,
        eventKind: "published",
      },
      admittedStages: ["stage-1"],
    };

    const diagnostics = validateCardCitation(card1905, {
      stageId: "stage-1",
      journeyId: "journey-brownian",
    });

    const refusal = diagnostics.find((d) => d.rule === "shelf-date-violation");
    assert.ok(refusal, "Must yield typed refusal shelf-date-violation for available 1905 premise");
    assert.equal(refusal?.severity, "refusal");
    assert.ok(refusal?.message.includes("1905"));

    globalKnowledgeCardsLogger.log({
      testId: "rule-1-planted-negative-shelf-date-violation",
      cardId: card1905.id,
      stageId: "stage-1",
      rule: "shelf-date-violation",
      status: "available",
      latestYear: 1905,
      outcome: "refusal",
      durationMs: Date.now() - start,
      message: "Available 1905 premise cited by stage refused by shelf-date-violation.",
    });
  });

  test("Rule 1: parallel-work card requires parallelWorkAcknowledged on citing stage", () => {
    const start = Date.now();
    const parallelCard: KnowledgeCard = {
      id: "sutherland-1905-phil-mag",
      proposition: "Diffusion formula with slip correction in Phil. Mag. June 1905.",
      status: "parallel-work",
      parallelWorkBasis: "Published June 1905 between Einstein submission and publication.",
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
    const diagWithoutAck = validateCardCitation(parallelCard, {
      stageId: "stage-sutherland",
      journeyId: "journey-brownian",
      parallelWorkAcknowledged: false,
    });
    const refusal = diagWithoutAck.find((d) => d.rule === "card-parallel-work-unacknowledged");
    assert.ok(refusal, "Unacknowledged parallel work must be refused");

    // Acknowledged -> accepted
    const diagWithAck = validateCardCitation(parallelCard, {
      stageId: "stage-sutherland",
      journeyId: "journey-brownian",
      parallelWorkAcknowledged: true,
    });
    assert.equal(diagWithAck.length, 0, "Acknowledged parallel work must be admitted cleanly");

    globalKnowledgeCardsLogger.log({
      testId: "rule-1-parallel-work-acknowledgment",
      cardId: parallelCard.id,
      stageId: "stage-sutherland",
      rule: "card-parallel-work-unacknowledged",
      status: "parallel-work",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Parallel work admitted only with explicit parallelWorkAcknowledged.",
    });
  });

  test("Rule 1 & Rule 6: admittedImport constraints across journeys and desk", () => {
    const start = Date.now();
    const importCard: KnowledgeCard = {
      id: "abraham-1905-light-energy",
      proposition: "Section 8 light energy transformation.",
      status: "available",
      admittedImport: {
        declaringJourney: "journey-mass-energy",
        sourceKey: "sr-sec-8",
      },
      sources: ["Ann. Phys. 17, 891 (1905)"],
      date: {
        earliest: "1905-09",
        latest: "1905-09",
        precision: "month",
        latestYear: 1905,
        eventKind: "published",
      },
      admittedStages: ["stage-me-import"],
    };

    // Accepted in declared journey with import declared
    const okDiag = validateCardCitation(importCard, {
      stageId: "stage-me-import",
      journeyId: "journey-mass-energy",
      journeyAdmittedImports: ["abraham-1905-light-energy"],
    });
    assert.equal(okDiag.length, 0);

    // Rejected when cited in a different journey
    const wrongJourneyDiag = validateCardCitation(importCard, {
      stageId: "stage-me-import",
      journeyId: "journey-brownian",
      journeyAdmittedImports: ["abraham-1905-light-energy"],
    });
    assert.ok(
      wrongJourneyDiag.some((d) => d.rule === "card-admitted-import-invalid-journey"),
      "Must reject import in undeclaring journey",
    );

    // Rejected when declared journey omits it from admittedImports
    const omittedDiag = validateCardCitation(importCard, {
      stageId: "stage-me-import",
      journeyId: "journey-mass-energy",
      journeyAdmittedImports: [],
    });
    assert.ok(
      omittedDiag.some((d) => d.rule === "card-admitted-import-undeclared"),
      "Must reject when journey does not declare import",
    );

    // Rejected on 1904 desk
    const deskDiag = validateCardCitation(importCard, {
      stageId: "desk-object-1",
      isDesk: true,
    });
    assert.ok(
      deskDiag.some((d) => d.rule === "card-admitted-import-desk-forbidden"),
      "Must refuse 1905 admitted import on strictly 1904 desk",
    );

    globalKnowledgeCardsLogger.log({
      testId: "rule-1-rule-6-admitted-import-journey-desk-isolation",
      cardId: importCard.id,
      admittedImport: "journey-mass-energy",
      rule: "card-admitted-import-desk-forbidden",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Admitted 1905 import scoped strictly to declaring journey and excluded from 1904 desk.",
    });
  });

  test("Rule 4: later card cited on shelf, desk, or as stage premise is refused", () => {
    const start = Date.now();
    const laterCard: KnowledgeCard = {
      id: "perrin-1909-sedimentation",
      proposition: "Experimental confirmation of Avogadro number via sedimentation.",
      status: "later",
      sources: ["Ann. Chim. Phys. 18 (1909)"],
      date: {
        earliest: "1909",
        latest: "1909",
        precision: "year",
        latestYear: 1909,
        eventKind: "published",
      },
      admittedStages: ["stage-world-check"],
    };

    const shelfDiag = validateCardCitation(laterCard, {
      stageId: "stage-world-check",
      isShelf: true,
    });
    assert.ok(
      shelfDiag.some((d) => d.rule === "card-later-on-shelf"),
      "Later card must be rejected on 1904 shelf",
    );

    const stageDiag = validateCardCitation(laterCard, {
      stageId: "stage-world-check",
    });
    assert.ok(
      stageDiag.some((d) => d.rule === "card-later-on-shelf"),
      "Later card must be rejected as a 1904 stage premise",
    );

    globalKnowledgeCardsLogger.log({
      testId: "rule-4-later-cards-excluded-from-shelves",
      cardId: laterCard.id,
      status: "later",
      rule: "card-later-on-shelf",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Later confirmation cards refused on 1904 shelf, desk, and stage premises.",
    });
  });

  test("Rule 2: permission in both directions (admittedStages validation)", () => {
    const start = Date.now();
    const card: KnowledgeCard = {
      id: "fick-1855-diffusion",
      proposition: "Macroscopic diffusion equation.",
      status: "available",
      sources: ["Pogg. Ann. 94 (1855)"],
      date: {
        earliest: "1855",
        latest: "1855",
        precision: "year",
        latestYear: 1855,
        eventKind: "published",
      },
      admittedStages: ["stage-bm-diffusion"],
    };

    // Stage not listed in card.admittedStages -> error
    const missingDiag = validateCardCitation(card, {
      stageId: "stage-bm-unlisted",
    });
    assert.ok(
      missingDiag.some((d) => d.rule === "card-missing-citing-stage"),
      "Must fail when stage is missing from card.admittedStages",
    );

    // Unknown stage in admittedStages -> error
    const knownStages = new Set(["stage-bm-other"]);
    const unknownStageDiag = validateCardCitation(
      card,
      { stageId: "stage-bm-diffusion" },
      knownStages,
    );
    assert.ok(
      unknownStageDiag.some((d) => d.rule === "card-unknown-admitted-stage"),
      "Must fail when card lists a stage unknown to the corpus",
    );

    globalKnowledgeCardsLogger.log({
      testId: "rule-2-permission-both-directions",
      cardId: card.id,
      rule: "card-missing-citing-stage",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Bidirectional stage citation permissions enforced.",
    });
  });

  test("Rule 5: Einstein knowledge claims require citations and flag prose in proposition", () => {
    const start = Date.now();
    const cardWithMissingCit: KnowledgeCard = {
      id: "planck-1900-quanta",
      proposition: "Blackbody distribution formula with energy quanta.",
      status: "available",
      sources: ["Ann. Phys. 4 (1900)"],
      date: {
        earliest: "1900",
        latest: "1900",
        precision: "year",
        latestYear: 1900,
        eventKind: "published",
      },
      claimsEinsteinKnew: true,
      einsteinKnowledgeEvidence: [],
    };
    const missingDiag = validateCardIntrinsicRules(cardWithMissingCit);
    assert.ok(
      missingDiag.some((d) => d.rule === "card-einstein-knowledge-missing-citation"),
      "Must fail when claimsEinsteinKnew is true without citations",
    );

    const cardWithProse: KnowledgeCard = {
      id: "lorentz-1904-local-time",
      proposition: "Einstein knew the Lorentz transformation from the 1904 paper.",
      status: "available",
      sources: ["Proc. Acad. Sci. Amsterdam 6 (1904)"],
      date: {
        earliest: "1904",
        latest: "1904",
        precision: "year",
        latestYear: 1904,
        eventKind: "published",
      },
    };
    const proseDiag = validateCardIntrinsicRules(cardWithProse);
    assert.ok(
      proseDiag.some((d) => d.rule === "card-einstein-knowledge-in-proposition"),
      "Must flag proposition prose claiming Einstein knew",
    );

    globalKnowledgeCardsLogger.log({
      testId: "rule-5-einstein-knowledge-evidence-and-prose-flag",
      cardId: cardWithMissingCit.id,
      rule: "card-einstein-knowledge-missing-citation",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Einstein knowledge claims require explicit evidence citations; prose claims flagged.",
    });
  });

  test("Rule 7: Date consistency checks and year constraints", () => {
    const start = Date.now();
    // earliest after latest
    const badRange: KnowledgeCard = {
      id: "bad-date-card-1",
      proposition: "Bad date range.",
      status: "available",
      sources: ["Journal"],
      date: {
        earliest: "1904",
        latest: "1902",
        precision: "year",
        latestYear: 1902,
        eventKind: "published",
      },
    };
    assert.ok(
      validateCardIntrinsicRules(badRange).some(
        (d) => d.rule === "card-date-earliest-after-latest",
      ),
    );

    // latestYear mismatch
    const badYear: KnowledgeCard = {
      id: "bad-date-card-2",
      proposition: "Mismatch latestYear.",
      status: "available",
      sources: ["Journal"],
      date: {
        earliest: "1903",
        latest: "1903",
        precision: "year",
        latestYear: 1904,
        eventKind: "published",
      },
    };
    assert.ok(
      validateCardIntrinsicRules(badYear).some((d) => d.rule === "card-latest-year-mismatch"),
    );

    // parallel-work with year < 1905
    const earlyParallel: KnowledgeCard = {
      id: "early-parallel-card",
      proposition: "Parallel work claimed in 1903.",
      status: "parallel-work",
      parallelWorkBasis: "Some reason.",
      sources: ["Journal"],
      date: {
        earliest: "1903",
        latest: "1903",
        precision: "year",
        latestYear: 1903,
        eventKind: "published",
      },
    };
    assert.ok(
      validateCardIntrinsicRules(earlyParallel).some(
        (d) => d.rule === "card-parallel-work-too-early",
      ),
    );

    globalKnowledgeCardsLogger.log({
      testId: "rule-7-date-consistency-and-year-constraints",
      rule: "card-date-earliest-after-latest",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Date consistency, earliest <= latest, latestYear matching, and parallel >= 1905 enforced.",
    });
  });

  test("Rule 8: duplicate cards detection with merge suggestion", () => {
    const start = Date.now();
    const cardA: KnowledgeCard = {
      id: "maxwell-1860-equipartition-a",
      proposition: "In thermal equilibrium mean kinetic energy is 3/2 k_B T.",
      status: "available",
      sources: [{ title: "Phil. Mag. 19", locator: "p. 19" }],
      date: {
        earliest: "1860",
        latest: "1860",
        precision: "year",
        latestYear: 1860,
        eventKind: "published",
      },
    };

    const cardB: KnowledgeCard = {
      id: "maxwell-1860-equipartition-b",
      proposition: "In thermal equilibrium, mean kinetic energy is 3/2 k_B T!",
      status: "available",
      sources: [{ title: "Phil. Mag. 19", locator: "p. 19" }],
      date: {
        earliest: "1860",
        latest: "1860",
        precision: "year",
        latestYear: 1860,
        eventKind: "published",
      },
    };

    const dupeDiag = checkDuplicateCards([cardA, cardB]);
    assert.equal(dupeDiag.length, 1);
    assert.equal(dupeDiag[0]?.rule, "card-duplicate-premise");
    assert.ok(dupeDiag[0]?.repair?.includes("Merge"));

    globalKnowledgeCardsLogger.log({
      testId: "rule-8-duplicate-cards-detection",
      cardId: cardB.id,
      rule: "card-duplicate-premise",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Duplicate cards detected by primary source key and normalized proposition with merge suggestion.",
    });
  });

  describe("card-available-year-exceeded (cardRules.ts:92)", () => {
    test("reject: (cardRules.ts:92) available card without admittedImport exceeding 1904 yields card-available-year-exceeded", () => {
      const card: KnowledgeCard = {
        id: "card-future-available",
        proposition: "A claim from 1906 marked available without import flag.",
        status: "available",
        sources: ["Annalen 1906"],
        date: {
          earliest: "1906",
          latest: "1906",
          precision: "year",
          latestYear: 1906,
          eventKind: "published",
        },
      };
      const diags = validateCardIntrinsicRules(card);
      const refusal = diags.find((d) => d.rule === "card-available-year-exceeded");
      assert.ok(refusal, "Must yield card-available-year-exceeded for available card > 1904");
      assert.equal(refusal?.severity, "error");
    });

    test("accept: available card with year <= 1904 produces no card-available-year-exceeded diagnostic", () => {
      const card: KnowledgeCard = {
        id: "card-past-available",
        proposition: "A claim from 1904 marked available.",
        status: "available",
        sources: ["Annalen 1904"],
        date: {
          earliest: "1904",
          latest: "1904",
          precision: "year",
          latestYear: 1904,
          eventKind: "published",
        },
      };
      const diags = validateCardIntrinsicRules(card);
      const refusal = diags.find((d) => d.rule === "card-available-year-exceeded");
      assert.equal(refusal, undefined);
    });
  });

  describe("card-available-year-exceeded (cardRules.ts:100)", () => {
    test("reject: (cardRules.ts:100) admittedImport card with latestYear != 1905 yields card-available-year-exceeded", () => {
      const card: KnowledgeCard = {
        id: "card-admitted-not-1905",
        proposition: "Admitted import card with non-1905 year.",
        status: "available",
        admittedImport: true,
        sources: ["Annalen 1904"],
        date: {
          earliest: "1904",
          latest: "1904",
          precision: "year",
          latestYear: 1904,
          eventKind: "published",
        },
      };
      const diags = validateCardIntrinsicRules(card);
      const refusal = diags.find((d) => d.rule === "card-available-year-exceeded");
      assert.ok(refusal, "Must yield card-available-year-exceeded for admittedImport !== 1905");
      assert.equal(refusal?.severity, "error");
    });

    test("accept: admittedImport card with latestYear === 1905 produces no card-available-year-exceeded diagnostic", () => {
      const card: KnowledgeCard = {
        id: "card-admitted-1905",
        proposition: "Admitted import card with 1905 year.",
        status: "available",
        admittedImport: true,
        sources: ["Annalen 1905"],
        date: {
          earliest: "1905",
          latest: "1905",
          precision: "year",
          latestYear: 1905,
          eventKind: "published",
        },
      };
      const diags = validateCardIntrinsicRules(card);
      const refusal = diags.find((d) => d.rule === "card-available-year-exceeded");
      assert.equal(refusal, undefined);
    });
  });

  describe("card-related-card-not-found (cardRules.ts:137)", () => {
    test("reject: (cardRules.ts:137) missing relatedCardId in allCardsMap yields card-related-card-not-found", () => {
      const card: KnowledgeCard = {
        id: "card-with-dangling-ref",
        proposition: "Card referencing non-existent card.",
        status: "available",
        relatedCardId: "card-does-not-exist",
        sources: ["Annalen 1900"],
        date: {
          earliest: "1900",
          latest: "1900",
          precision: "year",
          latestYear: 1900,
          eventKind: "published",
        },
      };
      const allCardsMap = new Map<string, KnowledgeCard>([[card.id, card]]);
      const diags = validateCardIntrinsicRules(card, allCardsMap);
      const refusal = diags.find((d) => d.rule === "card-related-card-not-found");
      assert.ok(refusal, "Must yield card-related-card-not-found for missing related card");
      assert.equal(refusal?.severity, "error");
    });

    test("accept: existing reciprocal relatedCardId produces no card-related-card-not-found diagnostic", () => {
      const cardA: KnowledgeCard = {
        id: "card-reciprocal-a",
        proposition: "Card A pointing to Card B.",
        status: "available",
        relatedCardId: "card-reciprocal-b",
        sources: ["Annalen 1900"],
        date: {
          earliest: "1900",
          latest: "1900",
          precision: "year",
          latestYear: 1900,
          eventKind: "published",
        },
      };
      const cardB: KnowledgeCard = {
        id: "card-reciprocal-b",
        proposition: "Card B pointing to Card A.",
        status: "available",
        relatedCardId: "card-reciprocal-a",
        sources: ["Annalen 1900"],
        date: {
          earliest: "1900",
          latest: "1900",
          precision: "year",
          latestYear: 1900,
          eventKind: "published",
        },
      };
      const allCardsMap = new Map<string, KnowledgeCard>([
        [cardA.id, cardA],
        [cardB.id, cardB],
      ]);
      const diags = validateCardIntrinsicRules(cardA, allCardsMap);
      const refusal = diags.find((d) => d.rule === "card-related-card-not-found");
      assert.equal(refusal, undefined);
    });
  });

  describe("card-open-queue-blocks-verification (cardRules.ts:406)", () => {
    test("reject: (cardRules.ts:406) verified card with open verification queue item yields card-open-queue-blocks-verification", () => {
      const card: KnowledgeCard = {
        id: "card-verified-with-open-q",
        proposition: "Verified card that still has an open question.",
        status: "available",
        verifier: "historical-record",
        sources: ["Annalen 1900"],
        date: {
          earliest: "1900",
          latest: "1900",
          precision: "year",
          latestYear: 1900,
          eventKind: "published",
        },
      };
      const openQueueItem: VerificationQueueItem = {
        id: "q-open-item",
        question: "Did Perrin or Einstein verify this in 1905?",
        cards: [card.id],
        sourceToConsult: "Perrin (1909)",
        landsIn: "limits",
        status: "open",
      };
      const diags = checkVerificationQueueRule(card, [openQueueItem]);
      const refusal = diags.find((d) => d.rule === "card-open-queue-blocks-verification");
      assert.ok(refusal, "Must yield card-open-queue-blocks-verification");
      assert.equal(refusal?.severity, "error");
    });

    test("accept: verified card with resolved queue item produces no open-queue diagnostic", () => {
      const card: KnowledgeCard = {
        id: "card-verified-resolved",
        proposition: "Verified card with resolved question.",
        status: "available",
        verifier: "historical-record",
        sources: ["Annalen 1900"],
        date: {
          earliest: "1900",
          latest: "1900",
          precision: "year",
          latestYear: 1900,
          eventKind: "published",
        },
      };
      const resolvedQueueItem: VerificationQueueItem = {
        id: "q-resolved-item",
        question: "Did Perrin verify this?",
        cards: [card.id],
        sourceToConsult: "Perrin (1909)",
        landsIn: "limits",
        status: "resolved",
      };
      const diags = checkVerificationQueueRule(card, [resolvedQueueItem]);
      const refusal = diags.find((d) => d.rule === "card-open-queue-blocks-verification");
      assert.equal(refusal, undefined);
    });
  });
});
