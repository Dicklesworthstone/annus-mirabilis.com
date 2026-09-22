/**
 * Loads and validates content/editorial/voice-rules.yaml, the one list and one override
 * mechanism per kind of vocabulary (AGENTS.md "Editorial Voice"). Reuses the project's single
 * strict YAML parser (src/content/provenance/yaml.ts) rather than a second implementation.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseYaml } from "../../provenance/yaml.ts";

export type VoiceContext =
  | "prose"
  | "ui-label"
  | "task-feedback"
  | "reader-progress"
  | "journey-branch"
  | "countermodel-cell"
  | "independence-claim";

export const KNOWN_CONTEXTS: readonly VoiceContext[] = [
  "prose",
  "ui-label",
  "task-feedback",
  "reader-progress",
  "journey-branch",
  "countermodel-cell",
  "independence-claim",
];

export type Severity = "error" | "flag" | "info";

export interface LiteralCharsRule {
  readonly kind: "literal-chars";
  readonly description: string;
  readonly chars: readonly string[];
  readonly defaultSeverity: Severity;
  readonly quotationExempt?: boolean;
  readonly translationSeverity?: Severity;
}

export interface RegexRule {
  readonly kind: "regex";
  readonly description: string;
  readonly pattern: string;
  readonly defaultSeverity: Severity;
  /**
   * Repair text shown with the finding. Optional so `ascii-dash`, the only regex rule that
   * predates this field, keeps the wording it always had; every regex rule added after it
   * states its own, because one rule's repair advice is wrong for another's defect.
   */
  readonly repair?: string;
  readonly quotationExempt?: boolean;
  readonly codeSpanExempt?: boolean;
  readonly translationSeverity?: Severity;
}

export interface WordListRule {
  readonly kind: "word-list";
  readonly description: string;
  readonly words: readonly string[];
  readonly markWords?: readonly string[];
  readonly markWordsProseExempt?: boolean;
  readonly allowlist?: readonly string[];
  readonly defaultSeverity?: Severity;
  readonly severityByContext?: Readonly<Partial<Record<VoiceContext | "default", Severity>>>;
  readonly quotationDowngrade?: Severity;
  readonly exception?: {
    readonly attribution: string;
    readonly phrase: string;
    readonly passesOutright: boolean;
  };
}

export interface PhraseListRule {
  readonly kind: "phrase-list";
  readonly description: string;
  readonly phrases: readonly string[];
  readonly defaultSeverity?: Severity;
  readonly severityByContext?: Readonly<Partial<Record<VoiceContext | "default", Severity>>>;
}

export interface StatusEnumLeakRule {
  readonly kind: "status-enum-leak";
  readonly description: string;
  readonly defaultSeverity: Severity;
  readonly singleWordProseSeverity: Severity;
  readonly ids: {
    readonly statuses: readonly string[];
    readonly executionOutcomes: readonly string[];
    readonly refusalCodes: readonly string[];
    readonly donorLabels: readonly string[];
  };
}

export interface OverclaimRule {
  readonly kind: "overclaim";
  readonly description: string;
  readonly phrases: readonly string[];
  readonly provedAllowlistNearWords: readonly string[];
  readonly quotationExempt?: boolean;
  readonly severityByContext: Readonly<Partial<Record<VoiceContext | "default", Severity>>>;
}

export interface DataOnlyRule {
  readonly kind: "data-only";
  readonly description: string;
  readonly phrases: readonly string[];
}

export type VoiceRule =
  | LiteralCharsRule
  | RegexRule
  | WordListRule
  | PhraseListRule
  | StatusEnumLeakRule
  | OverclaimRule
  | DataOnlyRule;

export type RuleId =
  | "em-dash"
  | "ascii-dash"
  | "hype-word"
  | "unlock"
  | "not-x-its-y"
  | "condescension"
  | "effortless-promise"
  | "persona-label"
  | "level-assignment"
  | "status-enum-leak"
  | "theater"
  | "mockery"
  | "overclaim"
  | "independence-claim"
  | "pedagogy-claim"
  | "setup-reversal"
  | "negative-parallelism"
  | "copula-avoidance"
  | "significance-inflation"
  | "heres-why"
  | "unverified-count";

export const RULE_IDS: readonly RuleId[] = [
  "em-dash",
  "ascii-dash",
  "hype-word",
  "unlock",
  "not-x-its-y",
  "condescension",
  "effortless-promise",
  "persona-label",
  "level-assignment",
  "status-enum-leak",
  "theater",
  "mockery",
  "overclaim",
  "independence-claim",
  "pedagogy-claim",
  "setup-reversal",
  "negative-parallelism",
  "copula-avoidance",
  "significance-inflation",
  "heres-why",
  "unverified-count",
];

export interface VoiceRules {
  readonly contexts: { readonly default: VoiceContext; readonly known: readonly VoiceContext[] };
  readonly rules: Readonly<Record<RuleId, VoiceRule>>;
}

export class VoiceRulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceRulesError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown, where: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new VoiceRulesError(`${where} must be an array of strings.`);
  }
  return value;
}

/** Validates the raw parsed YAML into a typed VoiceRules, failing loudly on any structural drift. */
export function validateVoiceRules(raw: unknown): VoiceRules {
  if (!isRecord(raw)) throw new VoiceRulesError("voice-rules.yaml must parse to a mapping.");
  const contextsRaw = raw.contexts;
  if (!isRecord(contextsRaw) || typeof contextsRaw.default !== "string") {
    throw new VoiceRulesError('voice-rules.yaml must declare "contexts.default".');
  }
  const known = asStringArray(contextsRaw.known, "contexts.known") as readonly VoiceContext[];
  const rulesRaw = raw.rules;
  if (!isRecord(rulesRaw)) throw new VoiceRulesError('voice-rules.yaml must declare "rules".');

  for (const id of RULE_IDS) {
    if (!isRecord(rulesRaw[id]))
      throw new VoiceRulesError(`voice-rules.yaml is missing the "${id}" rule.`);
  }
  for (const id of Object.keys(rulesRaw)) {
    if (!(RULE_IDS as readonly string[]).includes(id)) {
      throw new VoiceRulesError(`voice-rules.yaml declares an unknown rule "${id}".`);
    }
  }

  const statusEnum = rulesRaw["status-enum-leak"] as Record<string, unknown>;
  const idsRaw = statusEnum.ids;
  if (!isRecord(idsRaw)) throw new VoiceRulesError('"status-enum-leak" must declare "ids".');
  const statusEnumLeak: StatusEnumLeakRule = {
    kind: "status-enum-leak",
    description: String(statusEnum.description ?? ""),
    defaultSeverity: (statusEnum.defaultSeverity as Severity) ?? "error",
    singleWordProseSeverity: (statusEnum.singleWordProseSeverity as Severity) ?? "flag",
    ids: {
      statuses: asStringArray(idsRaw.statuses, "status-enum-leak.ids.statuses"),
      executionOutcomes: asStringArray(
        idsRaw.executionOutcomes,
        "status-enum-leak.ids.executionOutcomes",
      ),
      refusalCodes: asStringArray(idsRaw.refusalCodes, "status-enum-leak.ids.refusalCodes"),
      donorLabels: asStringArray(idsRaw.donorLabels, "status-enum-leak.ids.donorLabels"),
    },
  };

  return Object.freeze({
    contexts: Object.freeze({
      default: contextsRaw.default as VoiceContext,
      known: Object.freeze(known),
    }),
    rules: Object.freeze({
      ...rulesRaw,
      "status-enum-leak": statusEnumLeak,
    }) as Readonly<Record<RuleId, VoiceRule>>,
  });
}

const DEFAULT_RULES_PATH = path.join(process.cwd(), "content", "editorial", "voice-rules.yaml");

let cached: VoiceRules | undefined;

/** Loads and validates the rules file. Cached per process; pass `filePath` to bypass the cache (tests). */
export function loadVoiceRules(filePath: string = DEFAULT_RULES_PATH): VoiceRules {
  if (filePath === DEFAULT_RULES_PATH && cached) return cached;
  const text = readFileSync(filePath, "utf8");
  const parsed = parseYaml(text);
  const validated = validateVoiceRules(parsed);
  if (filePath === DEFAULT_RULES_PATH) cached = validated;
  return validated;
}

export function resetVoiceRulesCacheForTests(): void {
  cached = undefined;
}
