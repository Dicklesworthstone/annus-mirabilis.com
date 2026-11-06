import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { parseAnchor } from "../../content/anchors.ts";
import { JOURNEY_SHELVES } from "../cards/journeyCards.ts";
import type { KnowledgeCard } from "../cards/types.ts";
import {
  DEFAULT_DESK_FILTER,
  DESK_EXPERIMENT_IDS,
  DESK_OBJECT_IDS,
  DESK_QUESTIONS,
  type DeskFilterEntry,
  deskCatalogue,
  deskFilterEntry,
  matchesDeskFilter,
} from "./model.ts";
import { loadDesk, parseDesk } from "./records.ts";

const desk = loadDesk();

describe("the authored five-object desk", () => {
  test("each object resolves through the site's existing object anchor grammar", () => {
    for (const id of DESK_OBJECT_IDS) {
      expect(parseAnchor(id)).toEqual({
        ok: true,
        value: { kind: "object", fragment: `#${id}`, targetId: id },
      });
    }
  });

  test("every object answers all three questions and resolves its foundations and experiments", () => {
    expect(desk.objects.map((object) => object.id)).toEqual(DESK_OBJECT_IDS);
    expect(DESK_QUESTIONS).toHaveLength(3);
    expect(desk.reconstruction).toContain("reconstruction for learning");
    for (const object of desk.objects) {
      expect(object.responses).toHaveLength(3);
      expect(new Set(object.responses).size).toBe(3);
      for (const response of object.responses) expect(response.trim().length).toBeGreaterThan(0);
      expect(object.cardIds.length).toBeGreaterThan(0);
      expect(object.unresolved.trim().length).toBeGreaterThan(0);
      expect(JOURNEY_SHELVES.some((shelf) => shelf.journey === object.journey)).toBe(true);
      for (const slug of object.foundations)
        expect(desk.foundationTitles.get(slug)?.length).toBeGreaterThan(0);
      for (const id of object.experiments) expect(DESK_EXPERIMENT_IDS).toContain(id);
    }
    expect(new Set(desk.objects.flatMap((object) => object.experiments))).toEqual(
      new Set(DESK_EXPERIMENT_IDS),
    );
  });

  test("omitting or adding a response fails instead of leaving a question unanswered", () => {
    const raw = load(readFileSync("content/arguments/desk-1904.yaml", "utf8")) as {
      objects: { responses: string[] }[];
    };
    for (const count of [2, 4]) {
      const changed = structuredClone(raw);
      const first = changed.objects[0];
      expect(first).toBeDefined();
      if (!first) continue;
      first.responses =
        count === 2 ? first.responses.slice(0, 2) : [...first.responses, "An extra response."];
      expect(() => parseDesk(changed)).toThrow("needs all three responses");
    }
    const missingObject = structuredClone(raw);
    missingObject.objects.pop();
    expect(() => parseDesk(missingObject)).toThrow("exactly five objects");
  });
});

describe("the desk's historical catalogue boundary", () => {
  test("all 39 eligible source cards appear once, with an object and their actual journey", () => {
    const eligible = JOURNEY_SHELVES.flatMap((shelf) => shelf.shelf)
      .filter((card) => !card.admittedImport && card.status !== "later")
      .map((card) => card.id);
    const actual = desk.catalogue.map((entry) => entry.card.id);
    expect(actual).toHaveLength(39);
    expect(new Set(actual).size).toBe(39);
    expect([...actual].sort()).toEqual([...new Set(eligible)].sort());
    for (const entry of desk.catalogue) {
      expect(entry.objectIds.length).toBeGreaterThan(0);
      expect(entry.objectIds).toEqual(
        desk.objects
          .filter((object) => object.cardIds.includes(entry.card.id))
          .map((object) => object.id),
      );
      expect(entry.journeys).toEqual(
        JOURNEY_SHELVES.filter((shelf) =>
          shelf.shelf.some((card) => card.id === entry.card.id),
        ).map((shelf) => shelf.journey),
      );
      if (entry.card.status === "available")
        expect(entry.card.date.latestYear).toBeLessThanOrEqual(1904);
    }
    expect(
      desk.catalogue
        .filter((entry) => entry.card.status === "parallel-work")
        .map((entry) => entry.card.id),
    ).toEqual(["sutherland-1905-phil-mag"]);
  });

  test("admitted imports and later evidence never enter the desk's premise list", () => {
    const ids = new Set(desk.catalogue.map((entry) => entry.card.id));
    const excluded = JOURNEY_SHELVES.flatMap((shelf) => [
      ...shelf.shelf,
      ...shelf.laterEvidence,
    ]).filter((card) => card.admittedImport || card.status === "later");
    expect(excluded.length).toBeGreaterThan(0);
    for (const card of excluded) expect(ids.has(card.id)).toBe(false);
    expect(ids.has("einstein-1905-light-complex-transformation")).toBe(false);
    expect(ids.has("perrin-1909-molecular-reality")).toBe(false);
    expect(ids.has("millikan-1916-photoelectric-h")).toBe(false);
  });

  test("a duplicate source merges its journey, while a conflicting version is rejected", () => {
    const card = desk.catalogue[0]?.card;
    expect(card).toBeDefined();
    if (!card) return;
    const copy = { journey: "another-journey", shelf: [card], laterEvidence: [] };
    const merged = deskCatalogue([...JOURNEY_SHELVES, copy], desk.objects);
    expect(merged).toHaveLength(39);
    expect(merged.find((entry) => entry.card.id === card.id)?.journeys).toContain(
      "another-journey",
    );
    const conflicting = {
      ...copy,
      shelf: [{ ...card, proposition: "A different assertion under the same identity." }],
    };
    expect(() => deskCatalogue([...JOURNEY_SHELVES, conflicting], desk.objects)).toThrow(
      "conflicting cards",
    );
  });

  test("a late unflagged source and a missing object mapping fail at the content boundary", () => {
    const first = desk.catalogue[0]?.card;
    expect(first).toBeDefined();
    if (!first) return;
    const afterCutoff: KnowledgeCard = {
      ...first,
      id: "fixture-after-cutoff",
      status: "available",
      date: {
        earliest: "1905",
        latest: "1905",
        precision: "year",
        latestYear: 1905,
        eventKind: "published",
      },
    };
    expect(() =>
      deskCatalogue(
        [
          ...JOURNEY_SHELVES,
          {
            journey: "fixture",
            shelf: [afterCutoff],
            laterEvidence: [],
          },
        ],
        desk.objects,
      ),
    ).toThrow("available-after-cutoff");
    const withoutMapping = desk.objects.map((object) => ({
      ...object,
      cardIds: object.cardIds.filter((id) => id !== first.id),
    }));
    expect(() => deskCatalogue(JOURNEY_SHELVES, withoutMapping)).toThrow("belongs to no object");
    const missingCard = desk.objects.map((object, index) =>
      index === 0 ? { ...object, cardIds: [...object.cardIds, "fixture-missing-card"] } : object,
    );
    expect(() => deskCatalogue(JOURNEY_SHELVES, missingCard)).toThrow(
      "unknown, later or imported card",
    );
  });
});

describe("inclusive object, availability and date filters", () => {
  const range: DeskFilterEntry = {
    id: "range-source",
    objectIds: ["object-microscope", "object-spectrum"],
    status: "available",
    earliestYear: 1900,
    latestYear: 1903,
  };
  test("a date-range source matches either endpoint without inventing a publication day", () => {
    for (const year of ["1900", "1901", "1903"])
      expect(matchesDeskFilter(range, { ...DEFAULT_DESK_FILTER, from: year, to: year })).toBe(true);
    expect(matchesDeskFilter(range, { ...DEFAULT_DESK_FILTER, to: "1899" })).toBe(false);
    expect(matchesDeskFilter(range, { ...DEFAULT_DESK_FILTER, from: "1904" })).toBe(false);
    expect(matchesDeskFilter(range, { ...DEFAULT_DESK_FILTER, from: "1903", to: "1900" })).toBe(
      false,
    );
    expect(matchesDeskFilter(range, DEFAULT_DESK_FILTER)).toBe(true);
  });

  test("object and historical status combine with the date interval", () => {
    expect(matchesDeskFilter(range, { ...DEFAULT_DESK_FILTER, object: "object-spectrum" })).toBe(
      true,
    );
    expect(matchesDeskFilter(range, { ...DEFAULT_DESK_FILTER, object: "object-clocks" })).toBe(
      false,
    );
    expect(matchesDeskFilter(range, { ...DEFAULT_DESK_FILTER, status: "parallel-work" })).toBe(
      false,
    );
    const selection = desk.catalogue.map(deskFilterEntry).filter((entry) =>
      matchesDeskFilter(entry, {
        object: "object-microscope",
        status: "all",
        from: "1904",
        to: "1905",
      }),
    );
    expect(selection.map((entry) => entry.id)).toEqual([
      "sutherland-1904-dunedin",
      "sutherland-1905-phil-mag",
    ]);
  });
});
