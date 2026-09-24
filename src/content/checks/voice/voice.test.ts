import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { validateVoiceRecords } from "./check.ts";
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
  it("an attributed quotation containing ascii dash is exempt", () => {
    const findings = checkVoice("This was a wave -- particle duality.", {
      context: "prose",
      source: { layer: "quotation", attribution: "lorentz-1904" },
    });
    assert.equal(has(findings, "ascii-dash"), false);
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
  it('legitimate scientific phrases "data points" and "data point" pass across contexts', () => {
    assert.equal(
      has(
        checkVoice("Perrin plotted 50 data points from the emulsion measurements.", {
          context: "prose",
        }),
        "theater",
      ),
      false,
    );
    assert.equal(
      has(
        checkVoice("Each data point was recorded at thirty-second intervals.", {
          context: "prose",
        }),
        "theater",
      ),
      false,
    );
    assert.equal(has(checkVoice("Toggle data points", { context: "ui-label" }), "theater"), false);
    assert.equal(
      has(
        checkVoice("Compare your curve to the experimental data points.", {
          context: "task-feedback",
        }),
        "theater",
      ),
      false,
    );
  });

  // am-a33s: the theater rule must let honest scientific "<technical> points" prose through while
  // still catching prose that dresses a reader's activity up as a game.
  it("am-a33s: technical points compounds pass in every context that scores theater as an error", () => {
    // The original false positive, verbatim from TableToPlotBuilder.tsx:81 before ef5e69a reworded it.
    assert.equal(
      has(checkVoice("Plot all data points", { context: "ui-label" }), "theater"),
      false,
    );
    assert.equal(
      has(checkVoice("connect the plot points", { context: "prose" }), "theater"),
      false,
    );
    assert.equal(
      has(checkVoice("sample points along the curve", { context: "prose" }), "theater"),
      false,
    );
    assert.equal(
      has(checkVoice("interpolate between grid points", { context: "prose" }), "theater"),
      false,
    );
    // Same compounds in the strict contexts, where a miss would be an error rather than a flag.
    assert.equal(
      has(checkVoice("Show the grid points", { context: "task-feedback" }), "theater"),
      false,
    );
    assert.equal(
      has(checkVoice("12 sample points recorded", { context: "reader-progress" }), "theater"),
      false,
    );
  });

  it("am-a33s planted negative: a '<any word> points' rule would pass these, so they must still fail", () => {
    // These are the exact shape of the allowlisted compounds: one word, then "points". A naive fix
    // that allowed any modifier before "points" would let every one of them through, which would
    // blind the rule to the gamification it exists to catch. The enumeration must keep them failing.
    for (const phrase of ["bonus points", "reward points", "experience points", "extra points"]) {
      assert.equal(
        has(checkVoice(phrase, { context: "task-feedback" }), "theater", "error"),
        true,
        `"${phrase}" is gamification vocabulary and must still be an error`,
      );
    }
  });

  it("am-a33s planted negative: the exemption is per occurrence, not per string", () => {
    // A naive fix that bailed out on any text containing an allowlisted phrase would pass this.
    // The scoring "points" must still be caught even when a legitimate compound sits beside it.
    const mixed = checkVoice("Earn 5 points for every 10 data points you plot.", {
      context: "task-feedback",
    });
    const theater = mixed.filter((f) => f.rule === "theater");
    assert.equal(theater.length, 1, "exactly the scoring occurrence is reported");
    assert.equal(theater[0]?.matchedText.toLowerCase(), "points");
    assert.equal(theater[0]?.severity, "error");
  });

  it("am-a33s planted negative: the rest of the theater vocabulary is untouched", () => {
    // Guards against a fix that widened the allowlist mechanism itself rather than this one word.
    assert.equal(has(checkVoice("points", { context: "ui-label" }), "theater", "error"), true);
    assert.equal(
      has(
        checkVoice("earn points for each passage", { context: "task-feedback" }),
        "theater",
        "error",
      ),
      true,
    );
    assert.equal(has(checkVoice("a streak of three", { context: "prose" }), "theater"), true);
    assert.equal(
      has(checkVoice("Your score so far", { context: "reader-progress" }), "theater", "error"),
      true,
    );
    assert.equal(has(checkVoice("climb the leaderboard", { context: "prose" }), "theater"), true);
  });
  it('gamification "points" fails in task-feedback and reader-progress, flags in prose', () => {
    const feedback = checkVoice("You earned 10 points!", { context: "task-feedback" });
    assert.equal(has(feedback, "theater", "error"), true);

    const progress = checkVoice("Total points: 150", { context: "reader-progress" });
    assert.equal(has(progress, "theater", "error"), true);

    const prose = checkVoice("Earn points by answering questions.", { context: "prose" });
    assert.equal(has(prose, "theater", "flag"), true);
  });
  it("a sentence containing both gamification points and scientific data points flags only the gamification term", () => {
    const findings = checkVoice("Earn 10 points for plotting the experimental data points.", {
      context: "task-feedback",
    });
    const theaterFindings = findings.filter((f) => f.rule === "theater");
    assert.equal(theaterFindings.length, 1);
    assert.equal(theaterFindings[0]?.matchedText.toLowerCase(), "points");
    assert.equal(theaterFindings[0]?.index, 8);
    assert.equal(theaterFindings[0]?.severity, "error");
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
    // The negation exemption is scoped to one sentence: a denial in the previous
    // sentence does not license a verdict in this one.
    "It was not obvious at the time. Perrin proved it in 1909",
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
    // The sentences that took verify-content red in CI run 35481561814. Each one denies
    // proof, which is the distinction the rule exists to protect.
    "This relation is assumed, not proved by conservation.",
    "Treat localized energy transfer as an additional hypothesis, not as something proved by drawing separate dots.",
    "The equality was never proved for the general case",
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

describe("pedagogy-claim", () => {
  it("fails seeded 'discovery learning works better'", () => {
    const findings = checkVoice("Studies show that discovery learning works better for physics.", {
      context: "prose",
    });
    assert.equal(has(findings, "pedagogy-claim", "error"), true);
  });

  it("fails seeded 'productive struggle is essential'", () => {
    const findings = checkVoice("We believe productive struggle is essential for true mastery.", {
      context: "prose",
    });
    assert.equal(has(findings, "pedagogy-claim", "error"), true);
  });

  it("fails seeded 'direct instruction is more effective'", () => {
    const findings = checkVoice("In all cases direct instruction is more effective.", {
      context: "prose",
    });
    assert.equal(has(findings, "pedagogy-claim", "error"), true);
  });

  it("passes per-stage support phrasing", () => {
    const findings1 = checkVoice(
      "for this argument, readers in these rounds needed this much support",
      {
        context: "prose",
      },
    );
    assert.equal(has(findings1, "pedagogy-claim"), false);

    const findings2 = checkVoice(
      "for this stage, readers consistently used the partial comparison",
      {
        context: "prose",
      },
    );
    assert.equal(has(findings2, "pedagogy-claim"), false);
  });
});

describe("translation layer and German source block policy (AC2)", () => {
  it("a translation unit rendering offenbar as 'evidently' passes and 'clearly' produces a flag, not an error", () => {
    const passing = checkVoice("It evidently follows from the kinetic theory.", {
      context: "prose",
      source: { layer: "translation" },
    });
    assert.equal(has(passing, "condescension"), false);
    assert.equal(passing.length, 0);

    const flagged = checkVoice("It clearly follows from the kinetic theory.", {
      context: "prose",
      source: { layer: "translation" },
    });
    assert.equal(has(flagged, "condescension", "flag"), true);
    assert.equal(has(flagged, "condescension", "error"), false);
  });

  it("a translation unit with 'pivotal' produces a flag, not an error", () => {
    const flagged = checkVoice("This was a pivotal result for the foundation.", {
      context: "prose",
      source: { layer: "translation" },
    });
    assert.equal(has(flagged, "hype-word", "flag"), true);
    assert.equal(has(flagged, "hype-word", "error"), false);
  });

  it("German source blocks and lang=de records are never scanned", () => {
    const reports: CheckReportItem[] = [];
    const mockContext: CheckContext = {
      records: new Map<string, unknown>([
        [
          "source-ap-17-549-p01",
          {
            id: "source-ap-17-549-p01",
            kind: "source-block",
            lang: "de",
            text: "Eine sehr revolutionäre Betrachtung, pivotal and clearly so.",
          },
        ],
        [
          "german-transcription-01",
          {
            id: "german-transcription-01",
            kind: "reviewed-transcription",
            lang: "de",
            body: "Der Begriff ist revolutionär — zweifellos.",
          },
        ],
      ]),
      files: [],
      indexes: {},
      report: (item: CheckReportItem) => {
        reports.push(item);
      },
    };

    validateVoiceRecords(mockContext);
    assert.equal(reports.length, 0, "German source blocks must produce zero diagnostics");

    // Planted comparison: an English prose record fails on the same words
    const failingReports: CheckReportItem[] = [];
    const englishContext: CheckContext = {
      records: new Map<string, unknown>([
        [
          "reading-bm-p01",
          {
            id: "reading-bm-p01",
            kind: "reading",
            lang: "en",
            body: "This is a pivotal and revolutionary idea — clearly so.",
          },
        ],
      ]),
      files: [],
      indexes: {},
      report: (item: CheckReportItem) => {
        failingReports.push(item);
      },
    };

    validateVoiceRecords(englishContext);
    assert.ok(failingReports.length >= 3, "English record must produce voice errors");
    assert.ok(failingReports.some((r) => r.rule === "hype-word"));
    assert.ok(failingReports.some((r) => r.rule === "em-dash"));
    assert.ok(failingReports.some((r) => r.rule === "condescension"));
  });
});

/**
 * The de-slop rules, added on the owner's directive of 2026-09-22. Every rule here carries BOTH
 * negatives, which is the model D-2026-09-19-theater-points-compounds sets: real slop it must
 * catch, and real technical prose it must NOT flag. The must-not-flag cases are not invented —
 * each one is a sentence this edition legitimately needs, and several are drawn from the papers
 * themselves (p. 907 of ap-17-891 says that (X, Y, Z) REPRESENTS the vector of the electric
 * force, which is why "represents" can never join a copula-avoidance list here).
 */
describe("de-slop rules", () => {
  const DESLOP = new Set([
    "setup-reversal",
    "negative-parallelism",
    "copula-avoidance",
    "significance-inflation",
    "heres-why",
    "unverified-count",
  ]);
  const deslopFindings = (text: string, context: "prose" | "ui-label" = "prose") =>
    checkVoice(text, { context }).filter((f) => DESLOP.has(f.rule));

  it("catches the hero copy the owner objected to, by rule and by name", () => {
    // The literal string that shipped on the homepage until 2026-09-22.
    const findings = deslopFindings("A different way to ask why.");
    assert.ok(has(findings, "significance-inflation", "error"), "hero must fail");
  });

  it("catches each de-slop pattern at error severity", () => {
    for (const [rule, text] of [
      ["setup-reversal", "Einstein's papers were unreadable. Until now."],
      ["negative-parallelism", "This isn't just a website about physics."],
      ["copula-avoidance", "The ledger serves as a diplomatic transcription."],
      ["significance-inflation", "A transformative reimagining of the 1905 papers."],
      ["heres-why", "Here's why it matters."],
    ] as const) {
      assert.ok(has(deslopFindings(text), rule, "error"), `${rule} must fail on: ${text}`);
    }
  });

  it("does NOT flag the technical prose a physics edition needs", () => {
    for (const text of [
      // "transform" and "transformation" are the subject of sections 3 and 6; only
      // "transformative" is inflation, and the phrase matcher's letter boundaries keep them apart.
      "Transform the energy and volume of a finite light complex",
      "Apply the transformation equations found in section 3.",
      // The verbs deliberately excluded from copula-avoidance.
      "(X, Y, Z) represents the vector of the electric force.",
      "The viscous drag acts as a restoring influence on the particle.",
      "A diffusion law emerges as the limit of independent steps.",
      "Each printed page corresponds to one ANNALEN-PAGE marker.",
      // Deictic "here", and the measured correlative, are ordinary exposition.
      "Here the observer measures the interval between two events.",
      "The result is not only exact but also independent of the frame.",
    ]) {
      assert.deepEqual(rulesOf(deslopFindings(text)), [], `must stay quiet on: ${text}`);
    }
  });

  it("unverified-count catches the false heading that shipped, and the two counts beside it", () => {
    // Built against the real defect: "Six laboratories and a reading path" was contradicted by
    // its own next paragraph, which enumerated five, while eight bm-* routes exist.
    assert.ok(has(deslopFindings("Six laboratories and a reading path"), "unverified-count"));
    const inherited = deslopFindings("six explanatory passages and thirteen foundation lessons");
    assert.equal(
      inherited.filter((f) => f.rule === "unverified-count").length,
      2,
      "both inherited counts must be caught, not just the first",
    );
  });

  it("unverified-count leaves numerals, fixed facts and domain counts alone", () => {
    for (const text of [
      // Digits are never touched: every measured quantity in this edition is one.
      "Ann. Phys. (4) 17, 549-560 (1905), pages 549 to 560",
      "The displacement is 0.8 micrometres in one second.",
      "See section 3 for the transformation equations.",
      // Four is fixed by the subject and cannot drift as the edition grows.
      "Einstein's four papers of 1905",
      // The noun must follow the numeral, not merely appear later in the clause.
      "A laboratory for six particles",
      "six months after the laboratory opened",
      // Measured false positives that cost "routes" and "experiments" their place in the rule.
      "These are two accounts of one emission, not two experiments.",
      "The two routes to D agree.",
    ]) {
      assert.deepEqual(
        deslopFindings(text).filter((f) => f.rule === "unverified-count"),
        [],
        `unverified-count must stay quiet on: ${text}`,
      );
    }
  });

  it("a translation of Einstein is downgraded, never hard-failed", () => {
    // The boundary in code: source and translation layers are not ours to restyle, so an
    // error becomes a flag rather than failing a gate on his words.
    const findings = checkVoice("A different way to state the result is available.", {
      context: "prose",
      source: { layer: "translation" },
    }).filter((f) => DESLOP.has(f.rule));
    assert.ok(has(findings, "significance-inflation", "flag"));
    assert.ok(!has(findings, "significance-inflation", "error"));
  });

  it("each regex rule states its own repair, and ascii-dash keeps the one it always had", () => {
    const count = deslopFindings("Six laboratories").find((f) => f.rule === "unverified-count");
    assert.match(count?.suggestion ?? "", /Verify the count/);
    const dash = checkVoice("a -- b", { context: "prose" }).find((f) => f.rule === "ascii-dash");
    assert.match(dash?.suggestion ?? "", /Restructure without a joining dash/);
  });
});

/**
 * am-gzxs: "points" is gated on the scoring construction, not on an enumeration of modifier
 * compounds. The must-go-quiet cases below are REAL CORPUS TEXT, quoted from the three records
 * the orchestrator read in full, not invented fixtures — the third is Einstein's statistical
 * mechanics, and it has no modifier noun at all, which is why no compound enumeration could
 * ever have reached it. The must-still-fire cases are the five positive controls
 * D-2026-09-19-theater-points-compounds recorded; they stay red under this change by
 * construction, and the plants below prove it.
 */
describe("theater: points is gated on the scoring construction (am-gzxs)", () => {
  const theaterOf = (
    text: string,
    context: "prose" | "ui-label" | "task-feedback" | "reader-progress" = "prose",
  ) => checkVoice(text, { context }).filter((f) => f.rule === "theater");

  it("stops flagging the kinetic theory of gases", () => {
    for (const text of [
      // content/quantities/radiation.yaml:155
      "The number of independently movable points in a gas model, paper 1 section 5's kinetic-theory analogy.",
      // content/equations/brownian-motion/eq-model-bm-apparent-speed.json:113
      "Lines joining recorded points are a rendering convention, not a velocity measurement.",
      // content/experiments/tapes/the-locked-positions.yaml — Einstein's own statistical mechanics.
      "the probability is (V/V0)^n only when the points are independent",
    ]) {
      assert.deepEqual(theaterOf(text), [], `must stay quiet on corpus text: ${text.slice(0, 60)}`);
    }
  });

  it("still catches gamification in prose, where no modifier noun exists to enumerate", () => {
    // The capability the compound enumeration never had: the verb carries the construction.
    for (const text of [
      "Collect points as you read.",
      "You have lost points on that attempt.",
      "Earn points by answering questions.",
    ]) {
      assert.ok(theaterOf(text).length > 0, `must still flag: ${text}`);
    }
  });

  it("a scoring context still reports a bare points, and still exempts the technical compounds", () => {
    // This is why the allowlist is still required after the change rather than removed: a
    // surface whose purpose is reporting a reader's standing treats a bare "points" as a score.
    assert.ok(has(theaterOf("points", "ui-label"), "theater", "error"));
    assert.deepEqual(theaterOf("Plot all data points", "ui-label"), []);
    assert.deepEqual(theaterOf("Show the grid points", "task-feedback"), []);
    assert.deepEqual(theaterOf("12 sample points recorded", "reader-progress"), []);
  });

  it("the token bound is load-bearing: one scoring verb does not condemn a later ordinary noun", () => {
    // NOT "Earn 5 points for every 10 data points you plot." — that sentence is suppressed twice
    // over, because "data points" is allowlisted, so widening the bound leaves it green and the
    // test would prove nothing about the bound. Verified by planting: bound 3 -> 50 on that
    // sentence changed no assertion. The second occurrence here is "recorded points", which the
    // allowlist does NOT name, so only the token bound can keep it quiet. PROSE, deliberately:
    // a scoring context adds the score-display construction (a numeral just before the word),
    // so there "5 points" fires on its own and the bound cannot be observed. Both wrong
    // versions of this test were written and planted against before this one.
    const mixed = theaterOf("Earn 5 points and then mark the recorded points on the plot.");
    assert.equal(mixed.length, 1, "only the scoring occurrence is reported");
    assert.equal(mixed[0]?.index, 7);
  });

  it("a scoring sentence does not leak into the next one", () => {
    // The backwards search stops at the sentence boundary, so the verb in the first sentence
    // cannot reach the ordinary noun in the second.
    const findings = theaterOf(
      "You can earn a badge here. The points are independent in this model.",
    );
    assert.deepEqual(
      findings.filter((f) => f.matchedText.toLowerCase() === "points"),
      [],
      "the scoring verb in the first sentence must not reach the noun in the second",
    );
    // "badge" is theater vocabulary in its own right and must still be reported, which is what
    // makes this a test of the sentence boundary rather than of the rule being switched off.
    assert.ok(findings.some((f) => f.matchedText.toLowerCase() === "badge"));
  });
});

/**
 * Dispatch 148: in a scoring context "points" used to fire on every bare occurrence, and a
 * record's `title` resolves to ui-label, so five light-quanta equation titles were errors:
 * "Number of independent points", "Entropy change of the points", "How many independent points
 * the radiation behaves like". Those are Einstein's moving points in the volume v0. The gate now
 * asks whether the occurrence is a SCORE: a scoring verb before it, a scoring word after it, or
 * (only where the surface reports a reader's standing) a score display. The physics cases are
 * checked in every context, because ui-label is where they misfired.
 */
describe("theater: points is a score only in a scoring construction (dispatch 148)", () => {
  const CONTEXTS = ["prose", "ui-label", "task-feedback", "reader-progress"] as const;
  const theaterOf = (text: string, context: (typeof CONTEXTS)[number] = "prose") =>
    checkVoice(text, { context }).filter((f) => f.rule === "theater");
  const pointsOf = (text: string, context: (typeof CONTEXTS)[number] = "prose") =>
    theaterOf(text, context).filter((f) => /^points?$/iu.test(f.matchedText));

  it("Einstein's moving points are not a score, in any context", () => {
    for (const text of [
      "The probability that all n moving points are in v",
      "Points of the volume v0 are equally likely to be found anywhere in it.",
      "Number of independent points",
      "Entropy change of the points",
      "How many independent points the radiation behaves like",
      "A material point moves with the velocity v.",
      // content/editorial/readings-owners/am-sr-08-field-frame-change-5ibt.yaml, the R3 margin
      // on section 6: an idiom for "become pointless", which the scoring verb "lose" reaches.
      "says that questions about the seat of the electromotive force in unipolar machines lose their point.",
      "There are n points in total, and each is independent of the others.",
    ]) {
      for (const context of CONTEXTS) {
        assert.deepEqual(pointsOf(text, context), [], `${context}: ${text}`);
      }
    }
  });

  it("a scoring construction is still a score, plural or singular, wherever it stands", () => {
    for (const context of CONTEXTS) {
      assert.equal(
        pointsOf("Earn 10 points for a correct prediction", context).length,
        1,
        `${context}: a scoring verb before the word`,
      );
      assert.equal(
        pointsOf("Earn 1 point for a correct prediction", context).length,
        1,
        `${context}: the singular`,
      );
      assert.equal(
        pointsOf("Points are awarded for each correct prediction.", context).length,
        1,
        `${context}: at a sentence start, a scoring word after a copula`,
      );
      assert.equal(
        pointsOf("Your points total is 40.", context).length,
        1,
        `${context}: a points total`,
      );
    }
  });

  it("a score display fires where the surface reports standing, and only there", () => {
    for (const context of ["ui-label", "task-feedback", "reader-progress"] as const) {
      for (const text of ["Points", "150 points", "Points: 150", "You have 1 point"]) {
        assert.equal(pointsOf(text, context).length, 1, `${context}: ${text}`);
      }
    }
    // In prose a numeral before "points" is a count, as in a paper's "20 points".
    assert.deepEqual(pointsOf("The plate records 20 points on the curve."), []);
  });

  it("the allowlist is what keeps a technical compound quiet when a scoring word reaches it", () => {
    // Measured under dispatch 148: with the allowlist removed, no other assertion in this file,
    // contexts.test.ts or componentText.test.ts goes red, because the gate now reads the
    // construction. This is the case left for it: "total" and ": 150" both make a score of the
    // occurrence, and only the compound says the points are data.
    assert.deepEqual(pointsOf("Total data points: 150", "reader-progress"), []);
    assert.deepEqual(pointsOf("Show 12 extra grid points", "ui-label"), []);
  });
});

/**
 * Negated theater vocabulary is a disclaimer, not an instance (am-gzxs follow-up).
 *
 * The must-go-quiet cases are the four REAL findings the rule produced at HEAD 81d6ec70 -
 * every one of its remaining output, quoted from the files - not invented fixtures. The
 * must-still-fire half is what stops this being a blinding: the gamification vocabulary the
 * rule exists for, and the mark vocabulary the exemption is deliberately scoped away from.
 */
describe("theater: a negated noun is a disclaimer (am-gzxs follow-up)", () => {
  const theaterOf = (
    text: string,
    context: "prose" | "ui-label" | "task-feedback" | "reader-progress" = "prose",
  ) => checkVoice(text, { context }).filter((f) => f.rule === "theater");

  it("stops reporting the site's own refusals of theater", () => {
    for (const text of [
      "No score, timer or answer gate is used.", // MassEnergyArgumentWorkbench.tsx:155
      "Largest cumulative-probability gap, not a visual fit score", // WalkLab.tsx:472
      "The composition below is the model, not a score.", // sr06/VelocityCompositionLab.tsx:139
      "must be tested at slow speed, not certified by the easier large-number example", // entrance-mass-energy.json:22
    ]) {
      assert.deepEqual(
        theaterOf(text),
        [],
        `a refusal must not be reported as an instance: ${text.slice(0, 50)}`,
      );
    }
  });

  it("still reports theater that is asserted rather than refused", () => {
    // Without these the change reads as a blinding. The rule's whole vocabulary still fires.
    assert.ok(theaterOf("Your score so far", "reader-progress").length > 0);
    assert.ok(theaterOf("climb the leaderboard").length > 0);
    assert.ok(theaterOf("a streak of three").length > 0);
    assert.ok(theaterOf("Earn points by answering questions.").length > 0);
    assert.ok(theaterOf("Collect a badge for each chapter.").length > 0);
  });

  it("the exemption is scoped to nouns: a negated VERDICT still grades", () => {
    // The boundary that makes this a scoping change rather than a relaxation. "no badge" is a
    // promise the site keeps; "your answer is not wrong" marks the attempt just as "wrong" does.
    for (const text of ["Your answer is not wrong.", "not wrong", "That is not correct."]) {
      assert.ok(
        theaterOf(text, "task-feedback").length > 0,
        `mark vocabulary must survive negation: ${text}`,
      );
    }
  });

  it("PINS THE KNOWN LEAK: a window cannot tell noun-negation from verb-negation", () => {
    // "Do not lose your score" is gamification and IS exempted, because the marker sits within
    // the window and nothing short of parsing can tell what it attaches to. Recorded here rather
    // than left to be discovered: the shape occurs zero times in src and content today, checked
    // before shipping. If it ever appears, this test is where the cost was written down.
    assert.deepEqual(
      theaterOf("Do not lose your score.", "task-feedback"),
      [],
      "if this starts failing, the leak has been closed and the comment above is stale",
    );
  });
});

/**
 * am-edit-voice-lint-trmf: a typed enum field is data, not prose.
 *
 * Asserted as BEHAVIOUR rather than as membership. `expect(EXCLUDED_FIELDS.has("x")).toBe(true)`
 * would be a test that the code does what the code does; what matters is that the same string is
 * ignored in the enum field and still caught in a prose one, because the exclusion is meant to
 * narrow the population and not to blind the rule.
 */
describe("status-enum-leak: a typed enum field is data, not prose", () => {
  const scan = (record: Record<string, unknown>) => {
    const reports: CheckReportItem[] = [];
    validateVoiceRecords({
      records: new Map<string, unknown>([
        ["constant-set-probe", { id: "constant-set-probe", ...record }],
      ]),
      files: [],
      indexes: {},
      report: (item: CheckReportItem) => reports.push(item),
    } as CheckContext);
    return reports.filter((r) => r.rule === "status-enum-leak");
  };

  it("gasConstantProvenance carrying a registered status id is not a leak", () => {
    // The real shape of content/quantities/constant-sets/modern-codata-2022.yaml.
    assert.deepEqual(scan({ kind: "constant-set", gasConstantProvenance: "not-applicable" }), []);
  });

  it("the SAME string in a prose field is still a leak", () => {
    // The negative that stops this being a blinding: only the named field is exempt.
    assert.ok(
      scan({ kind: "constant-set", precisionNote: "This entry is not-applicable here." }).length >
        0,
      "an enum id in prose must still be reported",
    );
  });
});

/**
 * Title Case headings (am-edit-voice-lint-trmf). The gate that makes 04dffb1b permanent: before
 * it, four browser tests incidentally pinned capitalisation - wrongly, as Title Case - and
 * cca97b8e made them case-blind, leaving the standard unenforced.
 *
 * THE SCOPING IS THE DESIGN. A first attempt discriminated on construction alone, with a
 * heading-SHAPE test standing in for knowing the string was a heading. Measured across the tree
 * it produced 293 findings: button labels, legends, telemetry captions and, fatally, bibliography
 * entries - including "A. Einstein, Zur Elektrodynamik bewegter Körper", a printed German title.
 * A rule that flags Einstein's own title is a boundary violation wearing a lint's clothes.
 * componentText.ts now marks h1-h6, content records never carry that marker, and the same corpus
 * gives 69 findings, all real headings.
 */
describe("title-case-heading (am-edit-voice-lint-trmf)", () => {
  const heading = (text: string) =>
    checkVoice(text, { context: "prose", source: { element: "heading" } }).filter(
      (f) => f.rule === "title-case-heading",
    );
  const notHeading = (text: string) =>
    checkVoice(text, { context: "prose" }).filter((f) => f.rule === "title-case-heading");

  it("flags real Title Case headings from this corpus", () => {
    for (const t of [
      "Independent Configurations and the Gas Analogy",
      "The Two Historical Deviation Cases",
      "Page Map & Content Concordance",
      "Spacetime Event Diagram",
      "Discovery Mode: Predict Before Calculating",
      "Stokes’s Rule and the Single-Quantum Energy Budget",
    ]) {
      assert.equal(heading(t).length, 1, `must flag: ${t}`);
    }
  });

  it("leaves real sentence-case headings alone", () => {
    for (const t of [
      "Mean quantum energy over a Wien spectrum",
      "§2: the relativity of simultaneity",
      "The physical argument in Section 3",
      "Why the applied force drops out",
      "The entropy volume laws placed side by side",
    ]) {
      assert.deepEqual(heading(t), [], `must stay quiet: ${t}`);
    }
  });

  it("a heading whose capitals are all names is not a style choice", () => {
    // These three pass on the token-count floor rather than on the proper-noun list - each has
    // fewer than minContentWords once the first word is dropped. Kept because they are real
    // shapes, but the case BELOW is the one that drives the exception.
    for (const t of ["Einstein 1905 §7", "Maxwell-Hertz equations", "Wien and Planck"]) {
      assert.deepEqual(heading(t), [], `proper nouns are not Title Case: ${t}`);
    }
  });

  it("the proper-noun exception is load-bearing, and this is the case that proves it", () => {
    // MEASURED: emptying properNouns leaves the whole-tree count at 69, unchanged, so the list
    // decides nothing on today's corpus and its value is prospective. An exception nothing drives
    // is decoration, and decoration that looks like protection is worse than none - so the rule
    // gets a case where the list alone is the difference. Here all three content words are
    // capitalised, but two of them are names, leaving one non-proper capital and no violation.
    // With the list emptied this string flags.
    assert.deepEqual(heading("The Einstein Wien Comparison"), []);
    // And the same shape with one more ordinary capital IS Title Case.
    assert.equal(heading("The Einstein Wien Comparison Table").length, 1);
  });

  it("THE BOUNDARY: a citation or a printed German title is unreachable, not allowlisted", () => {
    // These are the strings the unscoped first attempt flagged. They reach checkVoice from
    // content records, which never carry the heading marker, so no list has to protect them.
    for (const t of [
      "A. Einstein, Zur Elektrodynamik bewegter Körper",
      "R. A. Millikan, A Direct Photoelectric Determination of Planck's h",
      "Physical Review, Ser. 2, Vol. 7, No. 3, pp. 355-389",
    ]) {
      assert.deepEqual(notHeading(t), [], `a record field is not a heading: ${t}`);
    }
  });

  it("the same Title Case string is flagged as a heading and ignored as a label", () => {
    // The scoping stated as a contrast, so it cannot pass because the rule is off entirely.
    const t = "Accepted Laboratory Telemetry Snapshot";
    assert.equal(heading(t).length, 1);
    assert.deepEqual(notHeading(t), []);
  });

  it("a translated or quoted heading is never judged for case", () => {
    for (const layer of ["translation", "quotation"] as const) {
      assert.deepEqual(
        checkVoice("The Two Historical Deviation Cases", {
          context: "prose",
          source: { element: "heading", layer, attribution: "some-source" },
        }).filter((f) => f.rule === "title-case-heading"),
        [],
      );
    }
  });
});
