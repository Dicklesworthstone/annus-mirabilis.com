import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { checkPublicationGate, UNVERIFIED_RESEARCH_MARKER } from "./publicationGate.ts";
import type { KnowledgeCard } from "./types.ts";

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
  });

  test("preview profile fails when citing an unverified card", () => {
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
  });

  test("draft profile permits unverified card with warning marker", () => {
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
  });

  test("verified cited card passes under all profiles without diagnostics", () => {
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
  });
});
