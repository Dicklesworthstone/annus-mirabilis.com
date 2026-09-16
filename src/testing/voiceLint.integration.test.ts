import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkVoice, type VoiceFinding } from "../content/checks/voice/index.ts";

function hasRule(findings: readonly VoiceFinding[], rule: string, severity?: string): boolean {
  return findings.some(
    (f) => f.rule === rule && (severity === undefined || f.severity === severity),
  );
}

describe("voiceLint integration - pedagogy-claim rules", () => {
  it("fails seeded 'discovery learning works better' in prose, ui, and feedback", () => {
    const findingsProse = checkVoice("Research proves discovery learning works better.", {
      context: "prose",
    });
    assert.equal(hasRule(findingsProse, "pedagogy-claim", "error"), true);

    const findingsUi = checkVoice("discovery learning works better", {
      context: "ui-label",
    });
    assert.equal(hasRule(findingsUi, "pedagogy-claim", "error"), true);
  });

  it("fails seeded 'productive struggle is essential' in prose and progress contexts", () => {
    const findingsProse = checkVoice(
      "We believe productive struggle is essential for comprehension.",
      {
        context: "prose",
      },
    );
    assert.equal(hasRule(findingsProse, "pedagogy-claim", "error"), true);

    const findingsProgress = checkVoice("productive struggle is essential", {
      context: "reader-progress",
    });
    assert.equal(hasRule(findingsProgress, "pedagogy-claim", "error"), true);
  });

  it("fails seeded 'direct instruction is more effective' across contexts", () => {
    const findingsProse = checkVoice("Studies show that direct instruction is more effective.", {
      context: "prose",
    });
    assert.equal(hasRule(findingsProse, "pedagogy-claim", "error"), true);

    const findingsFeedback = checkVoice("direct instruction is more effective", {
      context: "task-feedback",
    });
    assert.equal(hasRule(findingsFeedback, "pedagogy-claim", "error"), true);
  });

  it("fails other generic pedagogy overclaims", () => {
    const overclaims = [
      "discovery learning is generally superior",
      "discovery learning is superior",
      "discovery learning is best",
      "productive struggle is generally superior",
      "productive struggle is superior",
      "direct instruction is generally superior",
      "direct instruction is superior",
      "direct instruction is best",
      "minimal guidance is generally superior",
      "minimal guidance is superior",
      "minimal guidance is best",
      "minimal guidance is worthless",
    ];

    for (const phrase of overclaims) {
      const findings = checkVoice(`Some claim that ${phrase} for all readers.`, {
        context: "prose",
      });
      assert.equal(
        hasRule(findings, "pedagogy-claim", "error"),
        true,
        `Phrase "${phrase}" should be rejected by pedagogy-claim rule`,
      );
    }
  });

  it("passes approved per-stage empirical support phrasings", () => {
    const allowedPhrasings = [
      "for this argument, readers in these rounds needed this much support",
      "for this stage, readers consistently used the partial comparison",
      "for this derivation, readers in round 01 went straight to the explanation",
      "in our testing rounds on Brownian motion, readers resolved the obstacle using the worked example",
      "the default support level for this stage was adjusted based on round evidence",
    ];

    for (const text of allowedPhrasings) {
      const findings = checkVoice(text, { context: "prose" });
      assert.equal(
        hasRule(findings, "pedagogy-claim"),
        false,
        `Approved phrasing "${text}" should pass voice check`,
      );
    }
  });
});
