import { describe, expect, test } from "bun:test";
import { JOURNEY_CARDS } from "../cards/journeyCards.ts";
import {
  availableBeforeBoundary,
  compareTimelineEntries,
  formatTimelineDate,
  type TimelineDate,
  type TimelineEntry,
  timelineDateBound,
  timelineSpan,
} from "./model.ts";

function date(value: string, precision: TimelineDate["precision"]): TimelineDate {
  return { kind: "published", earliest: value, latest: value, precision };
}
function entry(id: string, when: TimelineDate): TimelineEntry {
  return {
    id,
    track: "long-arc",
    paper: "brownian-motion",
    date: when,
    title: id,
    summary: "A dated source.",
    sources: [],
    links: [],
    beforeBoundary: false,
  };
}

describe("timeline date precision", () => {
  test("a month or year never renders as an invented day", () => {
    expect(formatTimelineDate(date("1905", "year"))).toBe("1905");
    expect(formatTimelineDate(date("1905-05", "month"))).toBe("May 1905");
    expect(formatTimelineDate(date("1905-05-11", "day"))).toBe("11 May 1905");
    // Interval-form dates may carry explicit first/last days; those are still not publication days.
    expect(
      formatTimelineDate({
        kind: "published",
        earliest: "1905-05-01",
        latest: "1905-05-31",
        precision: "month",
      }),
    ).toBe("May 1905");
    expect(
      formatTimelineDate({
        kind: "published",
        earliest: "1728",
        latest: "1729",
        precision: "range",
      }),
    ).toBe("1728–1729");
  });

  test("ordering bounds encompass the whole stated month, including century leap rules", () => {
    expect(timelineDateBound(date("1905", "year"), "earliest")).toBe("1905-01-01");
    expect(timelineDateBound(date("1905", "year"), "latest")).toBe("1905-12-31");
    expect(timelineDateBound(date("1900-02", "month"), "latest")).toBe("1900-02-28");
    expect(timelineDateBound(date("1904-02", "month"), "latest")).toBe("1904-02-29");
    expect(timelineDateBound(date("2000-02", "month"), "latest")).toBe("2000-02-29");
  });

  test("a track span uses the latest interval end rather than the last sorted start", () => {
    const year = entry("year", date("1905", "year"));
    const day = entry("day", date("1905-06-09", "day"));
    const earlier = entry("earlier", date("1904-01", "month"));
    expect([day, year, earlier].sort(compareTimelineEntries).map((item) => item.id)).toEqual([
      "earlier",
      "year",
      "day",
    ]);
    expect(timelineSpan([day, year, earlier])).toBe("January 1904 to 1905");
    expect(timelineSpan([year])).toBe("1905");
  });
});

describe("the timeline's historical boundary", () => {
  const cards = JOURNEY_CARDS.flatMap((journey) => journey.cards);
  test("the earlier presentation, later publication, import and later evidence keep their roles", () => {
    const cases = [
      ["sutherland-1904-dunedin", true],
      ["sutherland-1905-phil-mag", false],
      ["einstein-1905-light-complex-transformation", false],
      ["millikan-1916-photoelectric-h", false],
    ] as const;
    for (const [id, expected] of cases) {
      const card = cards.find((candidate) => candidate.id === id);
      expect(card).toBeDefined();
      expect(availableBeforeBoundary(card as NonNullable<typeof card>)).toBe(expected);
    }
  });
});
