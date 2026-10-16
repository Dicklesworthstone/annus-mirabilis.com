/**
 * UNLABELLED ANACHRONISM IN THE DISCOVERY WORKSPACE (am-cm-anachronism-lint-dl2).
 *
 * The discovery workspace is set at the end of 1904, and the plan's rule is that "unavailable
 * premises cannot enter a historical derivation invisibly". The epistemic checks already refuse a
 * discovery step that cites a post-1904 premise. This file covers the words AROUND the premises:
 * an honest premise list can still be narrated in hindsight vocabulary, and AGENTS.md's
 * anachronism-controls table prescribes a treatment for each temptation rather than a ban.
 *
 * SO EVERY RULE HERE IS A LICENCE, NOT A DENYLIST. The table says to "identify the phrase as
 * Ehrenfest's (1911)", not to avoid it, so a phrase is a finding only when its own attribution is
 * absent from the same string. "Ehrenfest named this the ultraviolet catastrophe in 1911" is
 * exactly what the table asks for and must pass; the bare phrase in a 1904 drawer must not.
 *
 * THE LICENCE IS SOUGHT IN THE SAME STRING, which is deliberately narrow. A reader meets one
 * sentence at a time, and an attribution three paragraphs away does not travel with the phrase
 * into a card, a stage title or an instrument's mode label. It is also the only scope a checker
 * can apply without a theory of which prose is adjacent to which.
 *
 * WHAT THIS FILE DOES NOT OWN. Premise date checks belong to am-cm-checks-epistemic-o7n; editorial
 * voice vocabulary (hype words, em dashes) belongs to the voice linter, whose 24 rule codes carry
 * none of these; and the editorial judgement calls that no matcher can settle are `flag`, with the
 * table's prescribed treatment as the repair, for a reviewer rather than a build.
 */

export type AnachronismSeverity = "error" | "flag";

export type AnachronismRule = Readonly<{
  /** Stable id, used in findings and in the tests that plant each rule. */
  id: string;
  /** The phrase as a reader would meet it. Anchored on word boundaries, never a bare substring. */
  pattern: RegExp;
  severity: AnachronismSeverity;
  /** What is wrong with the bare phrase, in one sentence. */
  problem: string;
  /** AGENTS.md's prescribed treatment, quoted closely enough to act on. */
  treatment: string;
  /**
   * Any one of these in the same string licenses the phrase. Empty for a `flag`, whose judgement
   * a matcher cannot make: a flag is reported wherever it matches and is never an error.
   */
  licences: readonly RegExp[];
}>;

/**
 * The dates are the licences that matter, so they are written as the year alone as well as the
 * name: an author who writes "Minkowski's 1908 diagram" and one who writes "a later geometric aid
 * (1908)" have both done what the table asks.
 */
export const ANACHRONISM_RULES: readonly AnachronismRule[] = Object.freeze([
  Object.freeze({
    id: "ultraviolet-catastrophe",
    pattern: /\bultraviolet catastrophe\b/i,
    severity: "error" as const,
    problem:
      "Ehrenfest coined the phrase in 1911, so in a 1904 drawer it narrates the difficulty in words nobody had.",
    treatment:
      "Identify the phrase as Ehrenfest's (1911), and distinguish the pre-1905 radiation difficulty from the later textbook narrative.",
    licences: [/\bEhrenfest\b/i, /\b1911\b/],
  }),
  Object.freeze({
    id: "photon",
    pattern: /\bphotons?\b/i,
    severity: "error" as const,
    problem:
      "The word is Lewis's (1926). The 1905 paper argues for radiation behaving as independent energy quanta, which is a weaker and different claim.",
    treatment:
      "Label modern vocabulary as modern, or write what the paper writes: a light quantum, or an energy quantum.",
    licences: [/\bmodern\b/i, /\blater\b/i, /\b19[2-9]\d\b/, /\bLewis\b/i],
  }),
  Object.freeze({
    id: "wavefunction",
    pattern: /\bwave ?functions?\b/i,
    severity: "error" as const,
    problem: "A wavefunction is Schrodinger's (1926) and supplies a theory the 1905 paper has not.",
    treatment:
      "Label modern vocabulary and theory; they may not supply hidden historical premises.",
    licences: [/\bmodern\b/i, /\blater\b/i, /\b19[2-9]\d\b/, /\bSchr(ö|o)dinger\b/i],
  }),
  Object.freeze({
    id: "bose-statistics",
    pattern: /\bBose(-|\s)?(Einstein\s)?statistics\b/i,
    severity: "error" as const,
    problem: "Bose statistics are 1924 and are not available to a reader reasoning in 1904.",
    treatment: "Label modern theory; it may not supply a hidden historical premise.",
    licences: [/\bmodern\b/i, /\blater\b/i, /\b19[2-9]\d\b/],
  }),
  Object.freeze({
    id: "spacetime-diagram",
    pattern: /\b(spacetime|space-time|Minkowski)\s+diagrams?\b/i,
    severity: "error" as const,
    problem:
      "The geometric picture is Minkowski's (1908), so presenting it as the paper's own presentation misdates the argument.",
    treatment:
      "Identify it as a later geometric aid (Minkowski 1908) and derive the source result without requiring it.",
    licences: [/\bMinkowski\b/i, /\b1908\b/, /\blater\b/i],
  }),
  Object.freeze({
    id: "train-and-embankment",
    pattern: /\btrain(\s+and\s+|\s*-\s*)embankment\b/i,
    severity: "error" as const,
    problem:
      "The lightning picture is Einstein's 1917 popular illustration of sections 1 and 2, not the 1905 argument.",
    treatment: "Label it as Einstein's 1917 popular illustration.",
    licences: [/\b1917\b/, /\bpopular\b/i, /\blater\b/i],
  }),
  Object.freeze({
    id: "langevin-equation",
    pattern: /\bLangevin\b/i,
    severity: "error" as const,
    problem:
      "Langevin's equation is 1908, so offering it as Einstein's derivation dates the method three years early.",
    treatment:
      "Offer it as a modern computational or mathematical lens dated 1908 and later, never as the paper's derivation.",
    licences: [/\b1908\b/, /\bmodern\b/i, /\blater\b/i],
  }),
  Object.freeze({
    id: "wiener-process",
    pattern: /\bWiener\s+process(es)?\b/i,
    severity: "error" as const,
    problem: "Wiener's construction is 1923 and is a later mathematical lens on the same motion.",
    treatment: "Offer it as a modern mathematical lens dated 1908 and later.",
    licences: [/\bmodern\b/i, /\blater\b/i, /\b19[2-9]\d\b/],
  }),

  /*
    THE JUDGEMENT CALLS. Each is a claim a matcher can notice and cannot settle, so each is a flag
    carrying the table's treatment, and none of them fails a build. A flag has no licences on
    purpose: there is no phrase an author can add that would make the matcher right.
  */
  Object.freeze({
    id: "light-is-not-a-wave",
    pattern: /\b(not\s+a\s+wave|disprov\w+\s+the\s+wave|refut\w+\s+the\s+wave)\b/i,
    severity: "flag" as const,
    problem:
      "The light paper's inference is restricted, and the wave description keeps its successes; 'proved light is not a wave' overstates both.",
    treatment:
      "Preserve the wave description's successes and the restricted inference of the light paper.",
    licences: [],
  }),
  Object.freeze({
    id: "everyone-rejected-atoms",
    pattern: /\b(everyone|nobody|no one)\b[^.]{0,60}\batoms?\b/i,
    severity: "flag" as const,
    problem:
      "There was real contemporary disagreement and existing molecular reasoning; a universal rejection is invented consensus.",
    treatment:
      "Represent real contemporary disagreement and existing molecular reasoning, not an invented consensus.",
    licences: [],
  }),
  Object.freeze({
    id: "michelson-morley-sole-cause",
    pattern: /\bMichelson(-|\s)?Morley\b/i,
    severity: "flag" as const,
    problem:
      "The paper refers to failed attempts to detect motion relative to the ether; what moved Einstein personally is a separate and weaker claim.",
    treatment:
      "Separate the paper's reference to failed ether-drift detection from claims about Einstein's personal path.",
    licences: [],
  }),
]);

export type AnachronismFinding = Readonly<{
  ruleId: string;
  severity: AnachronismSeverity;
  /** The text the rule matched, so a false positive is visible without re-running the matcher. */
  matched: string;
  problem: string;
  treatment: string;
}>;

/**
 * Every rule that fires on one reader-facing string.
 *
 * A rule with licences fires only when none of them appears in the same string; a flag fires
 * whenever it matches. The matched text is carried in the finding because a count alone cannot
 * show that a pattern caught the thing it was aimed at.
 */
export function checkAnachronism(text: string): readonly AnachronismFinding[] {
  /*
    AN IDENTIFIER IS NOT PROSE, and these rules are about prose.

    The first real run reported three findings and all three were ids: the shelf card
    `michelson-morley` and a `constraintRef` naming it. The rule's complaint is that a SENTENCE
    makes the experiment the documented cause of the paper, and a slug makes no claim at all --
    it is how the card is addressed. Reporting it would have sent a reviewer to rename content
    ids, which is the opposite of the repair the table prescribes.

    A reader-facing sentence has whitespace and an id does not, so that is the test. It is
    deliberately here rather than in the script: the domain of these rules is prose, and a second
    caller must not have to rediscover it.
  */
  if (!/\s/.test(text.trim())) return [];
  const findings: AnachronismFinding[] = [];
  for (const rule of ANACHRONISM_RULES) {
    const hit = rule.pattern.exec(text);
    if (!hit) continue;
    if (rule.licences.some((licence) => licence.test(text))) continue;
    findings.push({
      ruleId: rule.id,
      severity: rule.severity,
      matched: hit[0],
      problem: rule.problem,
      treatment: rule.treatment,
    });
  }
  return findings;
}
