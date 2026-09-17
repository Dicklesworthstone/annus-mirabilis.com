/**
 * Tests for precision-aware date formatting and chronological comparison.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compareDates, DatePrecisionError, formatDate, formatDateStrict } from "./dates.ts";
import type { PaperDate } from "./schemas/dates.ts";

const yearDate: PaperDate = {
  type: "date-line",
  earliest: "1905-01-01",
  latest: "1905-12-31",
  precision: "year",
  source: "s",
  verifiedAt: "2026-09-15",
};

const monthDate: PaperDate = {
  type: "date-line",
  earliest: "1905-05-01",
  latest: "1905-05-31",
  precision: "month",
  source: "s",
  verifiedAt: "2026-09-15",
};

const dayDate: PaperDate = {
  type: "received",
  earliest: "1905-05-11",
  latest: "1905-05-11",
  precision: "day",
  source: "s",
  verifiedAt: "2026-09-15",
};

test("formatDate: never returns a string finer than the stored precision", () => {
  assert.equal(formatDate(yearDate), "1905");
  assert.equal(formatDate(yearDate, "day"), "1905");
  assert.equal(formatDate(yearDate, "month"), "1905");

  assert.equal(formatDate(monthDate), "May 1905");
  assert.equal(formatDate(monthDate, "day"), "May 1905");
  assert.equal(formatDate(monthDate, "year"), "1905");

  assert.equal(formatDate(dayDate), "11 May 1905");
  assert.equal(formatDate(dayDate, "month"), "May 1905");
  assert.equal(formatDate(dayDate, "year"), "1905");
});

test("formatDateStrict: fails when asked for finer precision than is stored", () => {
  assert.throws(() => formatDateStrict(yearDate, "month"), DatePrecisionError);
  assert.throws(() => formatDateStrict(yearDate, "day"), DatePrecisionError);
  assert.throws(() => formatDateStrict(monthDate, "day"), DatePrecisionError);

  assert.equal(formatDateStrict(yearDate, "year"), "1905");
  assert.equal(formatDateStrict(monthDate, "month"), "May 1905");
  assert.equal(formatDateStrict(dayDate, "day"), "11 May 1905");

  // Coarser-than-stored requests are always fine, never a fabrication.
  assert.equal(formatDateStrict(dayDate, "year"), "1905");
});

test("compareDates: disjoint intervals compare definitely in both directions", () => {
  const june1905: PaperDate = {
    type: "date-line",
    earliest: "1905-06-01",
    latest: "1905-06-30",
    precision: "month",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  assert.equal(compareDates(dayDate, june1905), -1);
  assert.equal(compareDates(june1905, dayDate), 1);
});

test("compareDates: nested and overlapping intervals are indeterminate, not an arbitrary sign", () => {
  // The Habicht interval (all of May 1905) against the 11 May 1905 receipt: neither is
  // contained in the other's precision, so there is genuinely no established order.
  assert.equal(compareDates(monthDate, dayDate), "indeterminate");
  assert.equal(compareDates(dayDate, monthDate), "indeterminate");

  // A 1904 year-precision date and a 3 January 1904 day-precision date: this is the exact bug
  // that storing a bare "1904-01-01" instant would have hidden by looking like a definite order.
  const year1904: PaperDate = {
    type: "date-line",
    earliest: "1904-01-01",
    latest: "1904-12-31",
    precision: "year",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  const jan3_1904: PaperDate = {
    type: "received",
    earliest: "1904-01-03",
    latest: "1904-01-03",
    precision: "day",
    source: "s",
    verifiedAt: "2026-09-15",
  };
  assert.equal(compareDates(year1904, jan3_1904), "indeterminate");
});

test("compareDates: identical intervals compare equal", () => {
  const copy: PaperDate = { ...dayDate };
  assert.equal(compareDates(dayDate, copy), 0);
});
