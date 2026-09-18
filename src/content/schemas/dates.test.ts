import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { DateValidationError, validateChronology, validatePaperDate } from "./dates.ts";

describe("dates schema refusal throw sites (am-muyh)", () => {
  const validDay = {
    type: "received",
    precision: "day",
    earliest: "1905-05-11",
    latest: "1905-05-11",
    source: "Ann. Phys. 17 (1905)",
    verifiedAt: "2026-09-15",
  };

  test("dates: (dates.ts:49) invalid-date-record raised when date is not an object", () => {
    assert.throws(
      () => validatePaperDate(null),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "invalid-date-record");
        return true;
      },
    );

    // Accept valid date record
    const accepted = validatePaperDate(validDay);
    assert.equal(accepted.type, "received");
  });

  test("dates: (dates.ts:70) invalid-date-type raised when date type is not recognized", () => {
    assert.throws(
      () => validatePaperDate({ ...validDay, type: "unrecognized-date-type" }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "invalid-date-type");
        return true;
      },
    );

    // Accept valid types
    const accepted = validatePaperDate({ ...validDay, type: "date-line" });
    assert.equal(accepted.type, "date-line");
  });

  test("dates: (dates.ts:79) invalid-date-precision raised when precision is not recognized", () => {
    assert.throws(
      () => validatePaperDate({ ...validDay, precision: "second" }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "invalid-date-precision");
        return true;
      },
    );

    // Accept valid precision
    const accepted = validatePaperDate(validDay);
    assert.equal(accepted.precision, "day");
  });

  test("dates: (dates.ts:92) invalid-iso-date raised when earliest date format is not YYYY-MM-DD", () => {
    assert.throws(
      () => validatePaperDate({ ...validDay, earliest: "1905-05" }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "invalid-iso-date");
        return true;
      },
    );

    // Accept valid earliest
    const accepted = validatePaperDate(validDay);
    assert.equal(accepted.earliest, "1905-05-11");
  });

  test("dates: (dates.ts:100) invalid-iso-date raised when latest date format is not YYYY-MM-DD", () => {
    assert.throws(
      () => validatePaperDate({ ...validDay, latest: "May 11 1905" }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "invalid-iso-date");
        return true;
      },
    );

    // Accept valid latest
    const accepted = validatePaperDate(validDay);
    assert.equal(accepted.latest, "1905-05-11");
  });

  test("dates: (dates.ts:132) date-precision-interval-mismatch raised when month precision does not span entire month", () => {
    assert.throws(
      () =>
        validatePaperDate({
          ...validDay,
          precision: "month",
          earliest: "1905-05-01",
          latest: "1905-05-15",
        }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "date-precision-interval-mismatch");
        return true;
      },
    );

    // Accept full month interval
    const accepted = validatePaperDate({
      ...validDay,
      precision: "month",
      earliest: "1905-05-01",
      latest: "1905-05-31",
    });
    assert.equal(accepted.precision, "month");
  });

  test("dates: (dates.ts:141) date-precision-interval-mismatch raised when year precision does not span entire year", () => {
    assert.throws(
      () =>
        validatePaperDate({
          ...validDay,
          precision: "year",
          earliest: "1905-01-01",
          latest: "1905-06-30",
        }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "date-precision-interval-mismatch");
        return true;
      },
    );

    // Accept full year interval
    const accepted = validatePaperDate({
      ...validDay,
      precision: "year",
      earliest: "1905-01-01",
      latest: "1905-12-31",
    });
    assert.equal(accepted.precision, "year");
  });

  test("dates: (dates.ts:151) missing-date-source raised when source is empty or missing", () => {
    assert.throws(
      () => validatePaperDate({ ...validDay, source: "   " }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "missing-date-source");
        return true;
      },
    );

    // Accept valid source
    const accepted = validatePaperDate(validDay);
    assert.equal(accepted.source, "Ann. Phys. 17 (1905)");
  });

  test("dates: (dates.ts:160) missing-date-verified raised when verifiedAt is empty or missing", () => {
    assert.throws(
      () => validatePaperDate({ ...validDay, verifiedAt: "" }),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "missing-date-verified");
        return true;
      },
    );

    // Accept valid verifiedAt
    const accepted = validatePaperDate(validDay);
    assert.equal(accepted.verifiedAt, "2026-09-15");
  });

  test("dates: (dates.ts:188) chronology-received-before-dateline raised when received is before date-line", () => {
    const dateline = validatePaperDate({
      ...validDay,
      type: "date-line",
      earliest: "1905-05-15",
      latest: "1905-05-15",
    });
    const received = validatePaperDate({
      ...validDay,
      type: "received",
      earliest: "1905-05-10",
      latest: "1905-05-10",
    });
    assert.throws(
      () => validateChronology([dateline, received]),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "chronology-received-before-dateline");
        return true;
      },
    );

    // Accept monotonic chronology
    const earlyDateline = validatePaperDate({
      ...validDay,
      type: "date-line",
      earliest: "1905-05-01",
      latest: "1905-05-01",
    });
    assert.doesNotThrow(() => validateChronology([earlyDateline, received]));
  });

  test("dates: (dates.ts:199) chronology-published-before-received raised when publication is before received", () => {
    const received = validatePaperDate({
      ...validDay,
      type: "received",
      earliest: "1905-05-11",
      latest: "1905-05-11",
    });
    const published = validatePaperDate({
      ...validDay,
      type: "issue-publication",
      earliest: "1905-05-01",
      latest: "1905-05-01",
    });
    assert.throws(
      () => validateChronology([received, published]),
      (err) => {
        assert.ok(err instanceof DateValidationError);
        assert.equal(err.code, "chronology-published-before-received");
        return true;
      },
    );

    // Accept publication after received
    const validPub = validatePaperDate({
      ...validDay,
      type: "issue-publication",
      earliest: "1905-07-18",
      latest: "1905-07-18",
    });
    assert.doesNotThrow(() => validateChronology([received, validPub]));
  });
});
