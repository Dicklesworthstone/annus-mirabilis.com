import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  checkDuplicateCards,
  validateCardCitation,
  validateCardIntrinsicRules,
} from "./cardRules.ts";
import type { KnowledgeCard } from "./types.ts";

describe("am-disc-knowledge-cards-iw8j: card rules enforcement", () => {
  test("Rule 1 & Planted Negative: available card dated 1905 cited by a stage fails with shelf-date-violation", () => {
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
  });

  test("Rule 1: parallel-work card requires parallelWorkAcknowledged on citing stage", () => {
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
  });

  test("Rule 1 & Rule 6: admittedImport constraints across journeys and desk", () => {
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
  });

  test("Rule 4: later card cited on shelf, desk, or as stage premise is refused", () => {
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
  });

  test("Rule 2: permission in both directions (admittedStages validation)", () => {
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
  });

  test("Rule 5: Einstein knowledge claims require citations and flag prose in proposition", () => {
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
  });

  test("Rule 7: Date consistency checks and year constraints", () => {
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
  });

  test("Rule 8: duplicate cards detection with merge suggestion", () => {
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
  });
});
