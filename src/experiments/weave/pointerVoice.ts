/**
 * Pointer-text voice rules (am-read-result-weave-jex). Pure, checkable functions -- not an
 * integration with any editorial voice-lint tool, since no such plugin API is known to exist in
 * this repository at the time of writing (a scan for am-edit-voice-lint-trmf turned up nothing to
 * call into). validateWeavePredicate does not enforce these; a manifest build step or a future
 * lint pass can call checkPointerVoice directly.
 */
import type { AgreementCondition, WeaveCondition, WeaveMeaning, WeavePredicate } from "./types.ts";

export type PointerVoiceViolation = Readonly<{
  rule: string;
  message: string;
}>;

// Every meaning: the pointer describes what the instrument is currently showing, never a
// completed verdict. "Is now true", "correct", "proved" and "verified" claim a settled fact the
// weave never asserts.
const OVERCLAIM_PATTERN = /\bis now (true|correct)\b|\bproved\b|\bproven\b|\bverified\b/i;

// outside-selected-domain: forbidden because they claim agreement precisely where the predicate
// exists to say the model has left its domain.
const AGREEMENT_LANGUAGE_PATTERN = /\bagrees?\b|\bmatches?\b|\bconfirms?\b|\bas predicted\b/i;

function hasAgreementCondition(
  conditions: readonly WeaveCondition[],
): AgreementCondition | undefined {
  return conditions.find((c): c is AgreementCondition => c.kind === "agreement");
}

/**
 * agreement-within-stated-bound needs its pointer to name what stands behind the bound: for a
 * statistical agreement (an AgreementCondition with a bound tied to a sample count), the bead
 * requires bound + significance + sample size + seed; for a purely deterministic comparison (no
 * agreement condition at all, e.g. bm06-s4-grid-agreement's threshold-only declaration) it needs
 * only bound + quantity naming.
 */
function checkAgreementPointer(predicate: WeavePredicate): PointerVoiceViolation[] {
  const violations: PointerVoiceViolation[] = [];
  const agreement = hasAgreementCondition(predicate.conditions);
  const text = predicate.pointerText;
  if (agreement) {
    const needsAll = [
      { name: "a bound", pattern: /\bbound\b/i },
      { name: "a significance level", pattern: /significance|\balpha\b|\bα\b/i },
      { name: "a sample size", pattern: /sample size|\bn\s*=|\bW\s*=/i },
      { name: "a seed", pattern: /\bseed\b/i },
    ];
    for (const need of needsAll) {
      if (!need.pattern.test(text)) {
        violations.push({
          rule: "weave-voice-agreement-underspecified",
          message: `Predicate "${predicate.id}" is a statistical agreement pointer and must name ${need.name}, but its pointerText does not.`,
        });
      }
    }
  } else {
    if (!/\bbound\b|\btolerance\b/i.test(text)) {
      violations.push({
        rule: "weave-voice-agreement-underspecified",
        message: `Predicate "${predicate.id}" is a deterministic agreement pointer and must name its bound or tolerance, but its pointerText does not.`,
      });
    }
  }
  return violations;
}

export function checkPointerVoice(predicate: WeavePredicate): readonly PointerVoiceViolation[] {
  const violations: PointerVoiceViolation[] = [];
  const text = predicate.pointerText;

  if (OVERCLAIM_PATTERN.test(text)) {
    violations.push({
      rule: "weave-voice-overclaim",
      message: `Predicate "${predicate.id}" pointerText claims a settled verdict ("is now true/correct", "proved", "verified"); the weave only points, it never verdicts.`,
    });
  }

  if (predicate.meaning === "outside-selected-domain" && AGREEMENT_LANGUAGE_PATTERN.test(text)) {
    violations.push({
      rule: "weave-voice-outside-domain-claims-agreement",
      message: `Predicate "${predicate.id}" has meaning outside-selected-domain but its pointerText uses agreement language ("agrees", "matches", "confirms", "as predicted").`,
    });
  }

  if (predicate.meaning === "agreement-within-stated-bound") {
    violations.push(...checkAgreementPointer(predicate));
  }

  return violations;
}

export function pointerVoiceOk(predicate: WeavePredicate): boolean {
  return checkPointerVoice(predicate).length === 0;
}

export const POINTER_VOICE_MEANINGS: readonly WeaveMeaning[] = [
  "assumption-active",
  "quantity-compared",
  "agreement-within-stated-bound",
  "outside-selected-domain",
];
