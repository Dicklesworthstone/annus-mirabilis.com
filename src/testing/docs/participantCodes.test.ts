import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ParticipantCodeError, parseParticipantCode } from "./participantCodes.ts";

describe("parseParticipantCode", () => {
  it("parses valid participant codes across all papers and routes", () => {
    const code1 = "brownian-motion-nonvisual-20260916-01";
    const res1 = parseParticipantCode(code1);
    assert.equal(res1.paper, "brownian-motion");
    assert.equal(res1.route, "nonvisual");
    assert.equal(res1.date, "2026-09-16");
    assert.equal(res1.rawDate, "20260916");
    assert.equal(res1.sequence, 1);

    const code2 = "special-relativity-full-derivation-20270412-12";
    const res2 = parseParticipantCode(code2);
    assert.equal(res2.paper, "special-relativity");
    assert.equal(res2.route, "full-derivation");
    assert.equal(res2.date, "2027-04-12");
    assert.equal(res2.sequence, 12);

    const code3 = "light-quanta-no-algebra-20261001-05";
    const res3 = parseParticipantCode(code3);
    assert.equal(res3.paper, "light-quanta");
    assert.equal(res3.route, "no-algebra");
    assert.equal(res3.date, "2026-10-01");
    assert.equal(res3.sequence, 5);

    const code4 = "mass-energy-low-cost-phone-20261120-3";
    const res4 = parseParticipantCode(code4);
    assert.equal(res4.paper, "mass-energy");
    assert.equal(res4.route, "low-cost-phone");
    assert.equal(res4.date, "2026-11-20");
    assert.equal(res4.sequence, 3);
  });

  it("fails on non-string or empty code", () => {
    assert.throws(() => parseParticipantCode("" as unknown as string), ParticipantCodeError);
    assert.throws(() => parseParticipantCode(null as unknown as string), ParticipantCodeError);
  });

  it("fails on unknown paper slug", () => {
    assert.throws(
      () => parseParticipantCode("general-relativity-nonvisual-20260916-01"),
      ParticipantCodeError,
    );
  });

  it("fails on unknown route id", () => {
    assert.throws(
      () => parseParticipantCode("brownian-motion-speed-reading-20260916-01"),
      ParticipantCodeError,
    );
  });

  it("fails on invalid date format or calendar numbers", () => {
    // 2027-04-12-3 with hyphens in date instead of YYYYMMDD
    assert.throws(
      () => parseParticipantCode("brownian-motion-nonvisual-2027-04-12-3"),
      ParticipantCodeError,
    );
    // Invalid month
    assert.throws(
      () => parseParticipantCode("brownian-motion-nonvisual-20261301-01"),
      ParticipantCodeError,
    );
    // Invalid day
    assert.throws(
      () => parseParticipantCode("brownian-motion-nonvisual-20260232-01"),
      ParticipantCodeError,
    );
  });
});
