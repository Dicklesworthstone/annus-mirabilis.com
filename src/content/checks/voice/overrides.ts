/**
 * content/editorial/voice-overrides.yaml: reviewed exceptions to the voice rules. An override
 * without a reason or a reviewer is itself an error (an unreviewed exception is not an
 * exception); an override whose matched text no longer occurs in its target is flagged stale,
 * because the text it was written for has since changed or moved.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseYaml } from "../../provenance/yaml.ts";
import type { RuleId } from "./rules.ts";

export interface VoiceOverrideEntry {
  readonly target: string;
  readonly rule: RuleId;
  readonly matchedText: string;
  readonly reason: string;
  readonly reviewer: string;
  readonly date: string;
}

export class OverrideValidationError extends Error {
  readonly target: string;
  constructor(message: string, target: string) {
    super(message);
    this.name = "OverrideValidationError";
    this.target = target;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string, target: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OverrideValidationError(
      `Override for "${target}" is missing a non-empty "${field}".`,
      target,
    );
  }
  return value;
}

export function validateOverrideEntry(raw: unknown): VoiceOverrideEntry {
  if (!isRecord(raw))
    throw new OverrideValidationError("Override entry must be a mapping.", String(raw));
  const target = requireNonEmptyString(raw.target, "target", String(raw.target ?? "<unknown>"));
  const rule = requireNonEmptyString(raw.rule, "rule", target) as RuleId;
  const matchedText = requireNonEmptyString(raw.matchedText, "matchedText", target);
  // reason and reviewer are the two fields whose absence makes an override itself an error.
  const reason = requireNonEmptyString(raw.reason, "reason", target);
  const reviewer = requireNonEmptyString(raw.reviewer, "reviewer", target);
  const date = requireNonEmptyString(raw.date, "date", target);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new OverrideValidationError(
      `Override for "${target}" has a malformed date "${date}"; expected YYYY-MM-DD.`,
      target,
    );
  }
  return { target, rule, matchedText, reason, reviewer, date };
}

const DEFAULT_OVERRIDES_PATH = path.join(
  process.cwd(),
  "content",
  "editorial",
  "voice-overrides.yaml",
);

export function loadVoiceOverrides(
  filePath: string = DEFAULT_OVERRIDES_PATH,
): readonly VoiceOverrideEntry[] {
  const text = readFileSync(filePath, "utf8");
  const parsed = parseYaml(text);
  if (!isRecord(parsed) || !Array.isArray(parsed.overrides)) {
    throw new OverrideValidationError(
      'voice-overrides.yaml must declare an "overrides" list.',
      filePath,
    );
  }
  return parsed.overrides.map(validateOverrideEntry);
}

export interface StaleOverride {
  readonly entry: VoiceOverrideEntry;
  readonly reason: "matched-text-not-found";
}

/**
 * Flags an override whose `matchedText` no longer occurs in its target's current text.
 * `lookupText` resolves a target (record id or file path) to its current text, or `undefined`
 * when the target cannot be resolved (which is reported separately by the caller, not as
 * staleness — a missing target is a stronger problem than a stale match).
 */
export function findStaleOverrides(
  overrides: readonly VoiceOverrideEntry[],
  lookupText: (target: string) => string | undefined,
): readonly StaleOverride[] {
  const stale: StaleOverride[] = [];
  for (const entry of overrides) {
    const currentText = lookupText(entry.target);
    if (currentText !== undefined && !currentText.includes(entry.matchedText)) {
      stale.push({ entry, reason: "matched-text-not-found" });
    }
  }
  return stale;
}
