import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkVoice, independenceClaimPhrases } from "./index.ts";

describe("independence-claim vocabulary", () => {
  it("the parsed independence-claim context lists exactly the four phrases of requirement 3", () => {
    assert.deepEqual(
      new Set(independenceClaimPhrases()),
      new Set(["independent", "independently", "separate determinations", "agree independently"]),
    );
    assert.equal(independenceClaimPhrases().length, 4);
  });

  it('checkVoice(text, { context: "independence-claim" }) returns them for a fixture readout', () => {
    const readout =
      "The radius and molecular number are independent determinations that agree independently.";
    const findings = checkVoice(readout, { context: "independence-claim" });
    const matched = findings
      .filter((f) => f.rule === "independence-claim")
      .map((f) => f.matchedText.toLowerCase());
    assert.ok(matched.includes("independent"));
    assert.ok(matched.includes("agree independently"));
    for (const f of findings) {
      assert.equal(f.severity, "info");
    }
  });
});
