import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { buildCardBacklinks, getCardBacklinks } from "./cardBacklinks.ts";
import { globalKnowledgeCardsLogger } from "./knowledgeCardsLogger.ts";

describe("am-disc-knowledge-cards-iw8j: card backlinks computation", () => {
  test("computes backlinks from journeys, desk objects, timeline entries, and world checks", () => {
    const start = Date.now();
    const backlinksMap = buildCardBacklinks({
      journeys: [
        {
          journeyId: "journey-brownian",
          stages: [
            { stageId: "stage-bm-01", premiseIds: ["fick-1855-diffusion", "stokes-1851-drag"] },
            { stageId: "stage-bm-02", premiseIds: ["fick-1855-diffusion"] },
          ],
        },
      ],
      deskObjects: [
        { objectId: "desk-microscope", premiseIds: ["siedentopf-1903-ultramicroscope"] },
      ],
      timelineEntries: [{ entryId: "tl-1855-fick", premiseIds: ["fick-1855-diffusion"] }],
      worldChecks: [{ checkId: "wc-brownian-rms", premiseIds: ["stokes-1851-drag"] }],
    });

    // Check fick-1855-diffusion
    const fickBacklinks = getCardBacklinks("fick-1855-diffusion", backlinksMap);
    assert.deepEqual(fickBacklinks.stageIds, ["stage-bm-01", "stage-bm-02"]);
    assert.deepEqual(fickBacklinks.timelineEntryIds, ["tl-1855-fick"]);
    assert.deepEqual(fickBacklinks.deskObjectIds, []);
    assert.deepEqual(fickBacklinks.worldCheckIds, []);

    // Check stokes-1851-drag
    const stokesBacklinks = getCardBacklinks("stokes-1851-drag", backlinksMap);
    assert.deepEqual(stokesBacklinks.stageIds, ["stage-bm-01"]);
    assert.deepEqual(stokesBacklinks.worldCheckIds, ["wc-brownian-rms"]);

    // Check siedentopf-1903-ultramicroscope
    const siedeBacklinks = getCardBacklinks("siedentopf-1903-ultramicroscope", backlinksMap);
    assert.deepEqual(siedeBacklinks.deskObjectIds, ["desk-microscope"]);

    // Check unreferenced card
    const emptyBacklinks = getCardBacklinks("unreferenced-card", backlinksMap);
    assert.deepEqual(emptyBacklinks.stageIds, []);
    assert.deepEqual(emptyBacklinks.deskObjectIds, []);
    assert.deepEqual(emptyBacklinks.timelineEntryIds, []);
    assert.deepEqual(emptyBacklinks.worldCheckIds, []);

    globalKnowledgeCardsLogger.log({
      testId: "backlinks-computation-all-sources",
      cardId: "fick-1855-diffusion",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Backlinks correctly inverted and computed across stages, desk objects, timeline, and world checks.",
    });
  });
});
