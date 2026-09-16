import { describe, expect, it } from "bun:test";
import { normalizePrintedLabel } from "../content/ids.ts";
import { TestLogger, newRunIdentity } from "./log/logger.ts";

describe("Printed Label Normalization (normalizePrintedLabel)", () => {
  const logger = new TestLogger("content-ids", newRunIdentity());

  it("normalizes standard printed labels according to §22.5", () => {
    const cases: Array<[string, string]> = [
      ["(7)", "7"],
      ["(7a)", "7a"],
      ["(1')", "1p"],
      ["(1'')", "1pp"],
      ["(2′)", "2p"],
      ["(2″)", "2pp"],
      ["(II)", "roman-2"],
      ["(IIa)", "roman-2a"],
      ["(II')", "roman-2p"],
      ["(II′)", "roman-2p"],
      ["[12]", "12"],
      ["(IV)", "roman-4"],
      ["(Xb)", "roman-10b"],
    ];

    for (const [input, expected] of cases) {
      const actual = normalizePrintedLabel(input);
      expect(actual).toBe(expected);
      logger.log({
        testId: `label-norm-${input}`,
        beadId: "am-cm-id-scheme-8bn",
        expected,
        actual,
        comparisonKind: "bitwise",
        outcome: "passed",
        extra: { input, rule: "printed-label-normalization" },
      });
    }
  });

  it("distinguishes and normalizes typographic prime (2′) and ASCII prime (2')", () => {
    const ascii = normalizePrintedLabel("(2')");
    const typo = normalizePrintedLabel("(2′)");
    expect(ascii).toBe("2p");
    expect(typo).toBe("2p");
  });
});
