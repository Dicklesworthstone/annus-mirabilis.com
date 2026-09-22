/**
 * checkVoice: the shared editorial voice check (AGENTS.md "Editorial Voice"). Surfaces whose copy
 * is generated at runtime or lives outside compiled records call this directly in their own copy
 * tests instead of keeping a private vocabulary list — see content/editorial/voice-rules.yaml for
 * the one list per kind of vocabulary this module enforces.
 *
 * Documented callers (Requirement 5):
 * - The reading notebook (am-read-notebook-tde)
 * - The explanation replay (am-reason-explanation-replay-35ds)
 * - Chapter-end tasks and teach-back prompts (am-disc-ppe-teachback-wnp7)
 * - Capstone worksheets (am-disc-capstones-infra-3352)
 * - Tours (am-tours-infra-g518)
 * - Journey branches (am-disc-journey-framework-umbg)
 * - Countermodel workbench (am-reason-countermodel-workbench-t07q)
 * - Predict mode (am-inst-predict-mode-ti7m)
 * Every exception for these surfaces goes through content/editorial/voice-overrides.yaml.
 */

import type { MatchSource, VoiceFinding } from "./matchers.ts";
import {
  matchDataOnly,
  matchLiteralChars,
  matchOverclaim,
  matchPhraseListRule,
  matchRegexRule,
  matchStatusEnumLeak,
  matchTitleCase,
  matchWordListRule,
} from "./matchers.ts";
import type {
  DataOnlyRule,
  LiteralCharsRule,
  OverclaimRule,
  PhraseListRule,
  RegexRule,
  StatusEnumLeakRule,
  TitleCaseRule,
  VoiceContext,
  WordListRule,
} from "./rules.ts";
import { loadVoiceRules } from "./rules.ts";

export type { MatchSource, VoiceFinding } from "./matchers.ts";
export type { RuleId, Severity, VoiceContext, VoiceRules } from "./rules.ts";
export { KNOWN_CONTEXTS, loadVoiceRules, RULE_IDS, resetVoiceRulesCacheForTests } from "./rules.ts";

export interface CheckVoiceOptions {
  readonly context: VoiceContext;
  readonly source?: MatchSource;
}

/**
 * Scans one already-extracted piece of visitor-facing text (or accessible-name attribute value)
 * and returns every finding. German source blocks are never passed here; the caller decides what
 * is in scope. `source.layer` downgrades vocabulary/dash rules for a translation unit, and exempts
 * or downgrades rules for an attributed quotation (`source.attribution` names the source, e.g.
 * `"habicht-letter"` for the one phrase that passes outright).
 */
export function checkVoice(text: string, options: CheckVoiceOptions): VoiceFinding[] {
  const rules = loadVoiceRules();
  const context = options.context;
  const source: MatchSource = options.source ?? {};
  const findings: VoiceFinding[] = [];

  findings.push(
    ...matchLiteralChars(
      text,
      rules.rules["em-dash"] as LiteralCharsRule,
      "em-dash",
      context,
      source,
    ),
  );
  findings.push(
    ...matchRegexRule(text, rules.rules["ascii-dash"] as RegexRule, "ascii-dash", context, source),
  );
  findings.push(
    ...matchWordListRule(
      text,
      rules.rules["hype-word"] as WordListRule,
      "hype-word",
      context,
      source,
    ),
  );
  findings.push(
    ...matchWordListRule(text, rules.rules.unlock as WordListRule, "unlock", context, source),
  );
  findings.push(
    ...matchRegexRule(
      text,
      rules.rules["not-x-its-y"] as RegexRule,
      "not-x-its-y",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules.condescension as PhraseListRule,
      "condescension",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["effortless-promise"] as PhraseListRule,
      "effortless-promise",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["persona-label"] as PhraseListRule,
      "persona-label",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["level-assignment"] as PhraseListRule,
      "level-assignment",
      context,
      source,
    ),
  );
  findings.push(
    ...matchStatusEnumLeak(
      text,
      rules.rules["status-enum-leak"] as StatusEnumLeakRule,
      "status-enum-leak",
      context,
    ),
  );
  findings.push(
    ...matchWordListRule(text, rules.rules.theater as WordListRule, "theater", context, source),
  );
  findings.push(
    ...matchWordListRule(text, rules.rules.mockery as WordListRule, "mockery", context, source),
  );
  findings.push(
    ...matchOverclaim(text, rules.rules.overclaim as OverclaimRule, "overclaim", context, source),
  );
  findings.push(
    ...matchDataOnly(
      text,
      rules.rules["independence-claim"] as DataOnlyRule,
      "independence-claim",
      context,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["pedagogy-claim"] as PhraseListRule,
      "pedagogy-claim",
      context,
      source,
    ),
  );

  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["setup-reversal"] as PhraseListRule,
      "setup-reversal",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["negative-parallelism"] as PhraseListRule,
      "negative-parallelism",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["copula-avoidance"] as PhraseListRule,
      "copula-avoidance",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["significance-inflation"] as PhraseListRule,
      "significance-inflation",
      context,
      source,
    ),
  );
  findings.push(
    ...matchPhraseListRule(
      text,
      rules.rules["heres-why"] as PhraseListRule,
      "heres-why",
      context,
      source,
    ),
  );
  findings.push(
    ...matchRegexRule(
      text,
      rules.rules["unverified-count"] as RegexRule,
      "unverified-count",
      context,
      source,
    ),
  );
  findings.push(
    ...matchTitleCase(
      text,
      rules.rules["title-case-heading"] as TitleCaseRule,
      "title-case-heading",
      context,
      source,
    ),
  );

  return findings.sort((a, b) => a.index - b.index);
}

/** The four independence-claim phrases, exposed for am-dataset-independence-registry-3dfb without a second list. */
export function independenceClaimPhrases(): readonly string[] {
  const rules = loadVoiceRules();
  const rule = rules.rules["independence-claim"];
  return rule.kind === "data-only" ? rule.phrases : [];
}
