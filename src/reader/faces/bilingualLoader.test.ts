import { afterEach, describe, expect, test } from "bun:test";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import {
  type BilingualEdition,
  loadBilingualEdition,
  setBilingualEditionTestOverride,
} from "./bilingualLoader.ts";

describe("bilingualLoader", () => {
  afterEach(() => {
    setBilingualEditionTestOverride(null);
  });

  test("live condition: returns null for brownian-motion because manifest has units: []", async () => {
    const edition = await loadBilingualEdition("brownian-motion");
    expect(edition).toBeNull();
  });

  test("returns null for nonexistent paper slug", async () => {
    const edition = await loadBilingualEdition("nonexistent-paper");
    expect(edition).toBeNull();
  });

  test("respects test override when provided and returns full edition", async () => {
    const fixtureEdition: BilingualEdition = {
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignment: FIXTURE_BROWNIAN_ALIGNMENT,
      editorialNotes: FIXTURE_EDITORIAL_NOTES,
      reviewRecords: FIXTURE_REVIEW_RECORDS,
    };

    setBilingualEditionTestOverride((paperId) =>
      paperId === "brownian-motion" ? fixtureEdition : null,
    );

    const edition = await loadBilingualEdition("brownian-motion");
    expect(edition).not.toBeNull();
    expect(edition?.paper.slug).toBe("brownian-motion");
    expect(edition?.blocks.length).toBeGreaterThan(0);
    expect(edition?.units.length).toBeGreaterThan(0);
  });

  test("resetting test override restores live filesystem resolution", async () => {
    setBilingualEditionTestOverride(() => ({
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
    }));

    expect(await loadBilingualEdition("brownian-motion")).not.toBeNull();

    setBilingualEditionTestOverride(null);
    expect(await loadBilingualEdition("brownian-motion")).toBeNull();
  });
});
