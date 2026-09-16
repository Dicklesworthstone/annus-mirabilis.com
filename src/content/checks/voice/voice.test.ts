import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkVoice, type VoiceFinding } from "./index.ts";

function rulesOf(findings: readonly VoiceFinding[]): string[] {
  return findings.map((f) => f.rule);
}

function has(findings: readonly VoiceFinding[], rule: string, severity?: string): boolean {
  return findings.some(
    (f) => f.rule === rule && (severity === undefined || f.severity === severity),
  );
}

describe("em-dash", () => {
  it("an em dash fails", () => {
    const findings = checkVoice("The result — surprising at first — follows directly.", {
      context: "prose",
    });
    assert.equal(has(findings, "em-dash", "error"), true);
  });
  it("an en dash in a page range passes", () => {
    const findings = checkVoice("Ann. Phys. (4) 17, 132–148.", { context: "prose" });
    assert.equal(has(findings, "em-dash"), false);
    assert.equal(has(findings, "ascii-dash"), false);
  });
  it("an em dash inside an attributed quotation is exempt", () => {
    const findings = checkVoice("The result — surprising — follows.", {
      context: "prose",
      source: { layer: "quotation", attribution: "some-secondary-source" },
    });
    assert.equal(has(findings, "em-dash"), false);
  });
  it("a translation unit downgrades em-dash to a flag", () => {
    const findings = checkVoice("The result — surprising — follows.", {
      context: "prose",
      source: { layer: "translation" },
    });
    assert.equal(has(findings, "em-dash", "flag"), true);
    assert.equal(has(findings, "em-dash", "error"), false);
  });
});

describe("ascii-dash", () => {
  it('"--profile" inside a code span passes', () => {
    const findings = checkVoice("Run it with `--profile` enabled.", { context: "prose" });
    assert.equal(has(findings, "ascii-dash"), false);
  });
  it('"wave -- particle" in prose fails', () => {
    const findings = checkVoice("This is a wave -- particle duality.", { context: "prose" });
    assert.equal(has(findings, "ascii-dash", "error"), true);
  });
});

describe("hype-word", () => {
  it('"a pivotal result" fails', () => {
    const findings = checkVoice("This was a pivotal result for the field.", { context: "prose" });
    assert.equal(has(findings, "hype-word", "error"), true);
  });
  it("REVOLUTIONARY (any case) fails", () => {
    const findings = checkVoice("A REVOLUTIONARY idea.", { context: "prose" });
    assert.equal(has(findings, "hype-word", "error"), true);
  });
  it('Habicht "sehr revolutionär" attributed passes outright', () => {
    const findings = checkVoice('Einstein called it "sehr revolutionär" in his letter.', {
      context: "prose",
      source: { layer: "quotation", attribution: "habicht-letter" },
    });
    assert.equal(has(findings, "hype-word"), false);
  });
  it("the same word unattributed fails", () => {
    const findings = checkVoice('He called it "sehr revolutionär".', { context: "prose" });
    assert.equal(has(findings, "hype-word", "error"), true);
  });
  it("a quotation from a secondary source downgrades hype-word to a flag", () => {
    const findings = checkVoice("The reviewer called it a pivotal moment.", {
      context: "prose",
      source: { layer: "quotation", attribution: "some-secondary-source" },
    });
    assert.equal(has(findings, "hype-word", "flag"), true);
    assert.equal(has(findings, "hype-word", "error"), false);
  });
});

describe("unlock", () => {
  it('a button label "Unlock the derivation" fails', () => {
    const findings = checkVoice("Unlock the derivation", { context: "ui-label" });
    assert.equal(has(findings, "unlock", "error"), true);
  });
});

describe("condescension", () => {
  it('"This clearly shows" fails', () => {
    const findings = checkVoice("This clearly shows the effect.", { context: "prose" });
    assert.equal(has(findings, "condescension", "error"), true);
  });
  it('"trivially" fails', () => {
    const findings = checkVoice("It trivially follows that D is finite.", { context: "prose" });
    assert.equal(has(findings, "condescension", "error"), true);
  });
});

describe("not-x-its-y", () => {
  it("flags \"it's not X, it's Y\" pattern", () => {
    const findings = checkVoice("it's not momentum, it's energy", { context: "prose" });
    assert.equal(has(findings, "not-x-its-y", "flag"), true);
  });
});

describe("effortless-promise", () => {
  it('flags "master in minutes"', () => {
    const findings = checkVoice("master in minutes the relativity principle", { context: "prose" });
    assert.equal(has(findings, "effortless-promise", "flag"), true);
  });
});

describe("status-enum-leak", () => {
  it('"Status: underdetermined" fails', () => {
    const findings = checkVoice("Status: underdetermined", { context: "prose" });
    assert.equal(has(findings, "status-enum-leak", "error"), true);
  });
  it("underdetermined embedded in ordinary prose is a flag, not an error", () => {
    const findings = checkVoice("the radius is underdetermined by the diffusivity alone", {
      context: "prose",
    });
    assert.equal(has(findings, "status-enum-leak", "flag"), true);
    assert.equal(has(findings, "status-enum-leak", "error"), false);
  });
  it('"the data do not determine a unique value" passes (no leaked id)', () => {
    const findings = checkVoice("the data do not determine a unique value", { context: "prose" });
    assert.equal(has(findings, "status-enum-leak"), false);
  });
  it("a caption containing ftcs-unstable fails", () => {
    const findings = checkVoice("Refused: ftcs-unstable", { context: "prose" });
    assert.equal(has(findings, "status-enum-leak", "error"), true);
  });
  it('"the superseded request" passes (ordinary word, not matched)', () => {
    const findings = checkVoice("the superseded request was dropped", { context: "prose" });
    assert.equal(has(findings, "status-enum-leak"), false);
  });
  it("one case per refusal group: initial registry (invalid-parameter)", () => {
    assert.equal(
      has(
        checkVoice("Refusal code: invalid-parameter", { context: "prose" }),
        "status-enum-leak",
        "error",
      ),
      true,
    );
  });
  it("one case per refusal group: tape compatibility (tape-constant-set-mismatch)", () => {
    assert.equal(
      has(
        checkVoice("tape-constant-set-mismatch", { context: "prose" }),
        "status-enum-leak",
        "error",
      ),
      true,
    );
  });
  it("one case per refusal group: diffusion numerical (drift-cfl-exceeded)", () => {
    assert.equal(
      has(checkVoice("drift-cfl-exceeded", { context: "prose" }), "status-enum-leak", "error"),
      true,
    );
  });
  it("one case per refusal group: quantile-not-converged", () => {
    assert.equal(
      has(checkVoice("quantile-not-converged", { context: "prose" }), "status-enum-leak", "error"),
      true,
    );
  });
  it("ordinary-language replacements all pass", () => {
    const replacements = [
      "this request is outside the model's range",
      "this recording was made with different constants",
      "this time step is too large for the method",
      "the interval could not be computed",
    ];
    for (const text of replacements) {
      assert.equal(has(checkVoice(text, { context: "prose" }), "status-enum-leak"), false);
    }
  });
});

describe("persona-label", () => {
  it('a button "Physician mode" fails', () => {
    assert.equal(
      has(checkVoice("Physician mode", { context: "ui-label" }), "persona-label", "error"),
      true,
    );
  });
  it('"a programmer might picture a loop" in prose does not trigger persona-label error', () => {
    const findings = checkVoice("a programmer might picture a loop here", { context: "prose" });
    assert.equal(rulesOf(findings).includes("persona-label"), false);
  });
});

describe("level-assignment", () => {
  it('"Choose your level" fails', () => {
    assert.equal(
      has(
        checkVoice("Choose your level to begin.", { context: "prose" }),
        "level-assignment",
        "error",
      ),
      true,
    );
  });
});

describe("theater", () => {
  it('"Your streak: 3 days" flags in prose and fails in reader-progress', () => {
    const prose = checkVoice("Your streak: 3 days", { context: "prose" });
    assert.equal(has(prose, "theater", "flag"), true);
    const progress = checkVoice("Your streak: 3 days", { context: "reader-progress" });
    assert.equal(has(progress, "theater", "error"), true);
  });
  it("task-feedback mark words fail: Correct!, Your score: 3 of 5, checkmark", () => {
    assert.equal(
      has(checkVoice("Correct!", { context: "task-feedback" }), "theater", "error"),
      true,
    );
    assert.equal(
      has(checkVoice("Your score: 3 of 5", { context: "task-feedback" }), "theater", "error"),
      true,
    );
    assert.equal(has(checkVoice("✓", { context: "task-feedback" }), "theater", "error"), true);
  });
  it("mark words in prose pass: the correct value, Einstein's 1911 correction", () => {
    assert.equal(has(checkVoice("the correct value of N", { context: "prose" }), "theater"), false);
    assert.equal(
      has(checkVoice("Einstein's 1911 correction", { context: "prose" }), "theater"),
      false,
    );
  });
  it('in reader-progress, "75% complete" fails and "step 3 of 7" passes', () => {
    assert.equal(
      has(checkVoice("75% complete", { context: "reader-progress" }), "theater", "error"),
      true,
    );
    assert.equal(has(checkVoice("step 3 of 7", { context: "reader-progress" }), "theater"), false);
  });
});

describe("mockery", () => {
  it('journey-branch: "Nägeli\'s naive objection" fails', () => {
    assert.equal(
      has(
        checkVoice("Nägeli's naive objection", { context: "journey-branch" }),
        "mockery",
        "error",
      ),
      true,
    );
  });
  it('prose: "the naive estimate of D" passes (allowlisted statistical phrase)', () => {
    assert.equal(
      has(checkVoice("the naive estimate of D", { context: "prose" }), "mockery"),
      false,
    );
  });
});

describe("overclaim", () => {
  const failing = [
    "the first decisive proof of relativity",
    "finally proved",
    "confirmed Einstein's theory",
    "vindicated",
    "settled the question",
    "Millikan proved that light is quantised",
    "the Michelson–Morley result caused the 1905 paper",
  ];
  for (const text of failing) {
    it(`"${text}" fails in prose`, () => {
      assert.equal(has(checkVoice(text, { context: "prose" }), "overclaim", "error"), true);
    });
  }

  const passing = [
    "Millikan's 1916 measurement matched the predicted slope",
    "the theorem is proved in section 3",
    "Einstein cites the failed attempts to detect motion relative to the ether",
    "a signal could travel from the first of these events to the second",
  ];
  for (const text of passing) {
    it(`"${text}" passes`, () => {
      assert.equal(has(checkVoice(text, { context: "prose" }), "overclaim"), false);
    });
  }

  it('"finally proved" inside an attributed quotation passes, and in journey-branch it is a flag', () => {
    const quoted = checkVoice("finally proved", {
      context: "prose",
      source: { layer: "quotation", attribution: "secondary-source" },
    });
    assert.equal(has(quoted, "overclaim"), false);
    const branch = checkVoice("finally proved", { context: "journey-branch" });
    assert.equal(has(branch, "overclaim", "flag"), true);
    assert.equal(has(branch, "overclaim", "error"), false);
  });
});

describe("checkVoice matches the gate step for the same text and context", () => {
  it('checkVoice("Your streak: 3 days", { context: "reader-progress" }) returns one theater error', () => {
    const findings = checkVoice("Your streak: 3 days", { context: "reader-progress" });
    const theaterFindings = findings.filter((f) => f.rule === "theater");
    assert.equal(theaterFindings.length, 1);
    assert.equal(theaterFindings[0]?.severity, "error");
    assert.equal(theaterFindings[0]?.matchedText.toLowerCase(), "streak");
  });
});

describe("task-feedback planted negatives (predict-mode / exercise-checker)", () => {
  it('a predict-prompt separatingAssumption containing "You guessed wrong" fails theater in task-feedback', () => {
    const findings = checkVoice("You guessed wrong about the drift direction.", {
      context: "task-feedback",
    });
    assert.equal(has(findings, "theater", "error"), true);
  });
  it('an exercise-checker scope note containing "Wrong!" fails theater in task-feedback', () => {
    const findings = checkVoice("Wrong! That is outside the model's range.", {
      context: "task-feedback",
    });
    assert.equal(has(findings, "theater", "error"), true);
  });
  it("the ordinary-language replacements pass", () => {
    assert.equal(
      has(
        checkVoice("this request is outside the model's range", { context: "task-feedback" }),
        "theater",
      ),
      false,
    );
    assert.equal(
      has(
        checkVoice("a steady drift would give the same first point", { context: "task-feedback" }),
        "theater",
      ),
      false,
    );
  });
});

describe("independence-claim", () => {
  it("returns matches for the four vocabulary phrases as informational findings", () => {
    const findings = checkVoice("These two determinations agree independently.", {
      context: "independence-claim",
    });
    assert.equal(has(findings, "independence-claim", "info"), true);
  });
});
