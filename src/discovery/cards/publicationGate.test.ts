import assert from "node:assert/strict";
import test, { describe } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CardDetail } from "./CardDetail.tsx";
import { globalKnowledgeCardsLogger } from "./knowledgeCardsLogger.ts";
import { checkPublicationGate, UNVERIFIED_RESEARCH_MARKER } from "./publicationGate.ts";
import type { KnowledgeCard, VerificationQueueItem } from "./types.ts";
import { crossValidateQueueWithCards } from "./verificationQueue.ts";

describe("am-disc-knowledge-cards-iw8j: publication gate verification", () => {
  const verifiedCard: KnowledgeCard = {
    id: "verified-card-1",
    proposition: "A verified proposition.",
    status: "available",
    sources: ["Source"],
    date: {
      earliest: "1903",
      latest: "1903",
      precision: "year",
      latestYear: 1903,
      eventKind: "published",
    },
    verification: {
      verifiedBy: "Agent",
      verifierKind: "agent",
      date: "2026-09-01",
      method: "library scan",
      evidenceLocator: "https://example.com/scan",
    },
  };

  const unverifiedCard: KnowledgeCard = {
    id: "unverified-card-1",
    proposition: "An unverified proposition.",
    status: "available",
    sources: ["Source"],
    date: {
      earliest: "1903",
      latest: "1903",
      precision: "year",
      latestYear: 1903,
      eventKind: "published",
    },
  };

  const cardsMap = new Map([
    [verifiedCard.id, verifiedCard],
    [unverifiedCard.id, unverifiedCard],
  ]);

  test("production profile fails when citing an unverified card", () => {
    const start = Date.now();
    const citations = [
      {
        cardId: "unverified-card-1",
        citedBy: "stage-bm-01",
        sourceType: "journey-stage" as const,
      },
    ];

    const result = checkPublicationGate(cardsMap, citations, "production");
    assert.equal(result.ok, false);
    const error = result.diagnostics.find((d) => d.rule === "card-unverified-in-production");
    assert.ok(error, "Production build must fail on unverified card");
    assert.equal(error?.severity, "error");
    assert.ok(error?.message.includes("Publication Gate Refusal"));

    globalKnowledgeCardsLogger.log({
      testId: "gate-production-fails-unverified",
      cardId: "unverified-card-1",
      stageId: "stage-bm-01",
      rule: "card-unverified-in-production",
      buildProfile: "production",
      verified: false,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Production profile rejected unverified card.",
    });
  });

  test("preview profile fails when citing an unverified card", () => {
    const start = Date.now();
    const citations = [
      {
        cardId: "unverified-card-1",
        citedBy: "stage-bm-01",
        sourceType: "journey-stage" as const,
      },
    ];

    const result = checkPublicationGate(cardsMap, citations, "preview");
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((d) => d.rule === "card-unverified-in-production"));

    globalKnowledgeCardsLogger.log({
      testId: "gate-preview-fails-unverified",
      cardId: "unverified-card-1",
      stageId: "stage-bm-01",
      rule: "card-unverified-in-production",
      buildProfile: "preview",
      verified: false,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Preview profile rejected unverified card.",
    });
  });

  test("draft profile permits unverified card with warning marker", () => {
    const start = Date.now();
    const citations = [
      {
        cardId: "unverified-card-1",
        citedBy: "stage-bm-01",
        sourceType: "journey-stage" as const,
      },
    ];

    const result = checkPublicationGate(cardsMap, citations, "draft");
    assert.equal(result.ok, true, "Draft profile should pass with warning");
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.severity, "warning");
    assert.ok(result.diagnostics[0]?.message.includes(UNVERIFIED_RESEARCH_MARKER));

    globalKnowledgeCardsLogger.log({
      testId: "gate-draft-permits-unverified-with-marker",
      cardId: "unverified-card-1",
      stageId: "stage-bm-01",
      rule: "card-unverified-in-production",
      buildProfile: "draft",
      verified: false,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Draft profile permitted unverified card with research marker.",
    });
  });

  test("verified cited card passes under all profiles without diagnostics and HTML contains no marker", () => {
    const start = Date.now();
    const citations = [
      {
        cardId: "verified-card-1",
        citedBy: "stage-bm-01",
        sourceType: "journey-stage" as const,
      },
    ];

    const prodResult = checkPublicationGate(cardsMap, citations, "production");
    assert.equal(prodResult.ok, true);
    assert.equal(prodResult.diagnostics.length, 0);

    const prevResult = checkPublicationGate(cardsMap, citations, "preview");
    assert.equal(prevResult.ok, true);
    assert.equal(prevResult.diagnostics.length, 0);

    const draftResult = checkPublicationGate(cardsMap, citations, "draft");
    assert.equal(draftResult.ok, true);
    assert.equal(draftResult.diagnostics.length, 0);

    // Assert that production-rendered HTML of verified card has NO unverified marker text
    const html = renderToStaticMarkup(React.createElement(CardDetail, { card: verifiedCard }));
    assert.ok(!html.includes(UNVERIFIED_RESEARCH_MARKER), "Verified card HTML must not contain unverified marker");

    globalKnowledgeCardsLogger.log({
      testId: "gate-verified-passes-all-profiles-no-marker",
      cardId: "verified-card-1",
      stageId: "stage-bm-01",
      buildProfile: "production",
      verified: true,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Verified card passed all profiles and emitted zero unverified markers.",
    });
  });

  test("card blocked by rule 9 fails production build through publication gate", () => {
    const start = Date.now();
    // Card has verification record, but an open queue item exists -> rule 9 violation
    const openQueueItem: VerificationQueueItem = {
      id: "q-open-blocking",
      question: "Unresolved primary source question.",
      cards: [verifiedCard.id],
      sourceToConsult: "Original manuscript",
      landsIn: "limits",
      status: "open",
    };

    const rule9Diags = crossValidateQueueWithCards([openQueueItem], cardsMap);
    assert.ok(
      rule9Diags.some((d) => d.rule === "card-open-queue-blocks-verification"),
      "Rule 9 must block card from carrying verification when queue item is open",
    );

    // If verification is stripped due to open queue item, publication gate fails production build
    const cardWithoutVerification: KnowledgeCard = {
      ...verifiedCard,
      verification: undefined,
      verifier: undefined,
    };
    const updatedCardsMap = new Map([[cardWithoutVerification.id, cardWithoutVerification]]);

    const prodResult = checkPublicationGate(
      updatedCardsMap,
      [{ cardId: cardWithoutVerification.id, citedBy: "stage-bm-01", sourceType: "journey-stage" }],
      "production",
    );
    assert.equal(prodResult.ok, false, "Card blocked by rule 9 must fail production publication gate");

    globalKnowledgeCardsLogger.log({
      testId: "gate-rule-9-blocks-production",
      cardId: verifiedCard.id,
      queueId: "q-open-blocking",
      queueStatus: "open",
      buildProfile: "production",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Open queue item prevented verification, failing production publication gate.",
    });
  });
});
