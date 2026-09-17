import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { validateCardCitation } from "./cardRules.ts";
import type { KnowledgeCard } from "./types.ts";

describe("am-disc-knowledge-cards-iw8j: admission gate and priorEvent inertia", () => {
  test("Rule 13: priorEvent is inert to admission; a card with date 1906 and priorEvent 1904 is refused naming 1906", () => {
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
  });

  test("Dunedin fixture card (presented 1904, available) is admitted to 1904 stage", () => {
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
  });

  test("Phil. Mag. fixture card (published 1905, parallel-work) is refused without acknowledgment and admitted with it", () => {
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
  });
});
