import { describe, expect, it } from "bun:test";
import { ParticipantCodeError, parseParticipantCode } from "./participantCodes.ts";

describe("parseParticipantCode", () => {
  it("parses valid participant codes across all papers and routes", () => {
    const code1 = "brownian-motion-nonvisual-20260916-01";
    const res1 = parseParticipantCode(code1);
    expect(res1.paper).toBe("brownian-motion");
    expect(res1.route).toBe("nonvisual");
    expect(res1.date).toBe("2026-09-16");
    expect(res1.rawDate).toBe("20260916");
    expect(res1.sequence).toBe(1);

    const code2 = "special-relativity-full-derivation-20270412-12";
    const res2 = parseParticipantCode(code2);
    expect(res2.paper).toBe("special-relativity");
    expect(res2.route).toBe("full-derivation");
    expect(res2.date).toBe("2027-04-12");
    expect(res2.sequence).toBe(12);

    const code3 = "light-quanta-no-algebra-20261001-05";
    const res3 = parseParticipantCode(code3);
    expect(res3.paper).toBe("light-quanta");
    expect(res3.route).toBe("no-algebra");
    expect(res3.date).toBe("2026-10-01");
    expect(res3.sequence).toBe(5);

    const code4 = "mass-energy-low-cost-phone-20261120-3";
    const res4 = parseParticipantCode(code4);
    expect(res4.paper).toBe("mass-energy");
    expect(res4.route).toBe("low-cost-phone");
    expect(res4.date).toBe("2026-11-20");
    expect(res4.sequence).toBe(3);
  });

  it("fails on non-string or empty code", () => {
    expect(() => parseParticipantCode("" as unknown as string)).toThrow(ParticipantCodeError);
    expect(() => parseParticipantCode(null as unknown as string)).toThrow(ParticipantCodeError);
  });

  it("fails on unknown paper slug", () => {
    expect(() => parseParticipantCode("general-relativity-nonvisual-20260916-01")).toThrow(
      ParticipantCodeError,
    );
  });

  it("fails on unknown route id", () => {
    expect(() => parseParticipantCode("brownian-motion-speed-reading-20260916-01")).toThrow(
      ParticipantCodeError,
    );
  });

  it("fails on invalid date format or calendar numbers", () => {
    // 2027-04-12-3 with hyphens in date instead of YYYYMMDD
    expect(() => parseParticipantCode("brownian-motion-nonvisual-2027-04-12-3")).toThrow(
      ParticipantCodeError,
    );
    // Invalid month
    expect(() => parseParticipantCode("brownian-motion-nonvisual-20261301-01")).toThrow(
      ParticipantCodeError,
    );
    // Invalid day
    expect(() => parseParticipantCode("brownian-motion-nonvisual-20260232-01")).toThrow(
      ParticipantCodeError,
    );
  });
});
