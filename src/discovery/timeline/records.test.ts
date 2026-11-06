import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import { JOURNEY_CARDS } from "../cards/journeyCards.ts";
import { timelineDateBound } from "./model.ts";
import {
  assembleTimeline,
  knowledgeCardEntry,
  loadTimeline,
  paperDateEntry,
  TimelineContentError,
} from "./records.ts";

const timeline = loadTimeline();
const cards = JOURNEY_CARDS.flatMap(({ journey, cards: entries }) =>
  entries.map((card) => ({ journey, card })),
);

describe("the chronology reads its real source records", () => {
  test("every journey card has one event, its original claim and limits, and its source link", () => {
    expect(cards.length).toBeGreaterThan(0);
    for (const { journey, card } of cards) {
      const found = timeline.entries.filter((entry) => entry.id === card.id);
      expect(found).toHaveLength(1);
      const entry = found[0];
      expect(entry?.summary).toBe(card.proposition);
      expect(entry?.limits).toBe(card.limits);
      expect(entry?.date.earliest).toBe(card.date.earliest);
      expect(entry?.date.latest).toBe(card.date.latest);
      expect(entry?.date.precision).toBe(card.date.precision);
      expect(entry?.links.map((link) => link.href)).toContain(
        `/discover/${journey}/#card-${card.id}`,
      );
      expect(entry?.track).toBe(card.status === "later" ? "later-confirmations" : "long-arc");
    }
    console.info(
      `[timeline] ${timeline.entries.length} entries; ${cards.length} source cards examined across ${JOURNEY_CARDS.length} journeys`,
    );
  });

  test("later evidence is a separate, nonempty track and none of its cards enter the 1904 shelf", () => {
    const later = timeline.tracks.find((track) => track.id === "later-confirmations");
    expect(later?.entries.length).toBeGreaterThan(0);
    expect(later?.entries.every((entry) => entry.status === "later" && !entry.beforeBoundary)).toBe(
      true,
    );
    expect(
      timeline.tracks
        .filter((track) => track.id !== "later-confirmations")
        .flatMap((track) => track.entries)
        .every((entry) => entry.status !== "later"),
    ).toBe(true);
  });

  test("each track is chronological and its bounds include all its members", () => {
    for (const track of timeline.tracks) {
      expect(track.entries.length).toBeGreaterThan(0);
      const starts = track.entries.map((entry) => timelineDateBound(entry.date, "earliest"));
      expect(starts).toEqual([...starts].sort());
      expect(track.span.length).toBeGreaterThan(0);
    }
  });

  test("receipt, publication and manuscript dates remain separate entries", () => {
    const byId = new Map(timeline.entries.map((entry) => [entry.id, entry]));
    for (const { journey } of JOURNEY_CARDS) {
      expect(byId.get(`${journey}-date-line`)?.date.kind).toBe("date-line");
      expect(byId.get(`${journey}-received`)?.date.kind).toBe("received");
      expect(byId.get(`${journey}-issue-publication`)?.date.kind).toBe("issue-publication");
    }
    expect(byId.get("mass-energy-date-line")?.date.precision).toBe("month");
    expect(byId.get("mass-energy-received")?.date.earliest).toBe("1905-09-27");
    expect(byId.get("mass-energy-issue-publication")?.date.earliest).toBe("1905-11-21");
  });

  test("date fields, not card ids or prior events, place a source in time", () => {
    const microscope = timeline.entries.find(
      (entry) => entry.id === "siedentopf-1903-ultramicroscope",
    );
    expect(microscope?.date.earliest).toBe("1902-12-30");
    const fresnel = timeline.entries.find((entry) => entry.id === "fresnel-1826-diffraction");
    expect(fresnel?.date.earliest).toBe("1826");
    expect(fresnel?.date.kind).toBe("published");
    expect(fresnel?.priorEvent?.earliest).toBe("1818-07-29");
    expect(fresnel?.priorEvent?.kind).toBe("presented");
  });
});

describe("timeline source failures cannot silently erase or overstate a date", () => {
  test("timeline-missing-paper-dates refuses a source root with no receipts", () => {
    expect(() => loadTimeline(join(process.cwd(), "src", "discovery", "timeline"))).toThrow(
      expect.objectContaining({ code: "timeline-missing-paper-dates" }),
    );
  });

  test("timeline-unconfirmed-paper-day refuses an unconfirmed day but preserves a recorded month", () => {
    const receipt = loadProvenanceReceipts({ requireLocal: false }).receipts.find(
      (entry) => entry.receipt?.frontMatter.slug === "mass-energy",
    )?.receipt?.frontMatter;
    expect(receipt).toBeDefined();
    const source = receipt as NonNullable<typeof receipt>;
    const received = source.paper.dates.find((entry) => entry.type === "received");
    expect(received).toBeDefined();
    const day = received as NonNullable<typeof received>;
    for (const invalid of [
      { ...day, confirmedFromScan: false },
      { ...day, verifiedAt: "" },
    ]) {
      expect(() => paperDateEntry("mass-energy", source, invalid)).toThrow(
        expect.objectContaining({ code: "timeline-unconfirmed-paper-day" }),
      );
    }
    const month = source.paper.dates.find((entry) => entry.type === "date-line");
    expect(month).toBeDefined();
    expect(
      paperDateEntry("mass-energy", source, month as NonNullable<typeof month>).date.precision,
    ).toBe("month");
  });

  test("timeline-duplicate-anchor refuses two source events with the same public identity", () => {
    const item = cards[0] as (typeof cards)[number];
    const first = knowledgeCardEntry(item.card, item.journey);
    expect(() => assembleTimeline([first, first])).toThrow(
      expect.objectContaining({ code: "timeline-duplicate-anchor" }),
    );
    expect(() => assembleTimeline([first, first])).toThrow(TimelineContentError);
  });
});
