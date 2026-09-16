/**
 * Unit tests for precision-aware date intervals.
 *
 * Spec: am-cm-checks-structural-lq0
 */

import { describe, expect, it } from "bun:test";
import {
  compareDateIntervals,
  isDateNotAfter,
  lastDayOfMonth,
  parseDateInterval,
} from "./dateIntervals.ts";

describe("dateIntervals", () => {
  describe("lastDayOfMonth", () => {
    it("handles standard months and leap years", () => {
      expect(lastDayOfMonth(1905, 1)).toBe(31);
      expect(lastDayOfMonth(1905, 2)).toBe(28); // Non-leap year
      expect(lastDayOfMonth(1904, 2)).toBe(29); // Leap year 1904
      expect(lastDayOfMonth(2000, 2)).toBe(29); // Century leap year
      expect(lastDayOfMonth(1900, 2)).toBe(28); // Non-leap century
      expect(lastDayOfMonth(1905, 4)).toBe(30);
      expect(lastDayOfMonth(1905, 5)).toBe(31);
      expect(lastDayOfMonth(1905, 6)).toBe(30);
    });
  });

  describe("parseDateInterval", () => {
    it("parses day precision string", () => {
      const interval = parseDateInterval("1905-05-11");
      expect(interval).toEqual({
        earliest: "1905-05-11",
        latest: "1905-05-11",
        precision: "day",
      });
    });

    it("parses month precision string", () => {
      const may = parseDateInterval("1905-05");
      expect(may).toEqual({
        earliest: "1905-05-01",
        latest: "1905-05-31",
        precision: "month",
      });

      const febLeap = parseDateInterval("1904-02");
      expect(febLeap).toEqual({
        earliest: "1904-02-01",
        latest: "1904-02-29",
        precision: "month",
      });
    });

    it("parses year precision string", () => {
      const yr = parseDateInterval("1905");
      expect(yr).toEqual({
        earliest: "1905-01-01",
        latest: "1905-12-31",
        precision: "year",
      });
    });

    it("accepts existing PaperDate objects", () => {
      const pDate = {
        type: "received" as const,
        earliest: "1905-05-11",
        latest: "1905-05-11",
        precision: "day" as const,
        source: "Annalen",
        verifiedAt: "2026-01-01",
      };
      const interval = parseDateInterval(pDate);
      expect(interval.earliest).toBe("1905-05-11");
      expect(interval.latest).toBe("1905-05-11");
    });
  });

  describe("isDateNotAfter", () => {
    it("passes boundary equality on the exact same day", () => {
      expect(isDateNotAfter("1905-03-17", "1905-03-17")).toBe(true);
    });

    it("passes month-precision date-line 'Mai 1905' before or on receipt '11 May 1905'", () => {
      // Date-line earliest is 1905-05-01, receipt latest is 1905-05-11
      expect(isDateNotAfter("1905-05", "1905-05-11")).toBe(true);
    });

    it("fails genuinely inverted order: date-line 'Juni 1905' with receipt '11 May 1905'", () => {
      // Date-line earliest is 1905-06-01, receipt latest is 1905-05-11
      expect(isDateNotAfter("1905-06", "1905-05-11")).toBe(false);
    });

    it("fails day-precision received before date-line", () => {
      expect(isDateNotAfter("1905-03-17", "1905-03-16")).toBe(false);
      expect(isDateNotAfter("1905-03-16", "1905-03-17")).toBe(true);
    });

    it("passes year-precision date against day-precision date when year starts before or on day", () => {
      // 1905 (1905-01-01..1905-12-31) not after 1905-06-15 (1905-06-15..1905-06-15)
      // earliest 1905-01-01 <= latest 1905-06-15 -> true
      expect(isDateNotAfter("1905", "1905-06-15")).toBe(true);

      // 1906 (1906-01-01..1906-12-31) not after 1905-06-15 -> false
      expect(isDateNotAfter("1906", "1905-06-15")).toBe(false);
    });

    it("passes real dissertation dates and rejects swapped dates", () => {
      // Dissertation: dated 30 April 1905, submitted 20 July 1905
      const dated = "1905-04-30";
      const submitted = "1905-07-20";
      expect(isDateNotAfter(dated, submitted)).toBe(true);

      // Swapped: dated 20 July 1905, submitted 30 April 1905
      expect(isDateNotAfter(submitted, dated)).toBe(false);
    });
  });

  describe("compareDateIntervals", () => {
    it("returns detailed interval values and comparison outcome", () => {
      const res = compareDateIntervals("1905-05", "1905-05-11");
      expect(res.notAfter).toBe(true);
      expect(res.earliestX).toBe("1905-05-01");
      expect(res.latestX).toBe("1905-05-31");
      expect(res.earliestY).toBe("1905-05-11");
      expect(res.latestY).toBe("1905-05-11");
    });
  });
});
