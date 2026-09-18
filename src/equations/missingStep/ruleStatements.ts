import { ruleInWords } from "../derivations/a11yText.ts";
import type { RuleApplication } from "../derivations/types.ts";
/** Reader-facing expansions of canonical rule ids, not a second rule registry. */
export function missingStepRuleStatement(rule: RuleApplication): string {
  if (rule.kind === "registered-identity") {
    if (rule.params.identityId === "linearity-of-average") return "Linearity of averaging: average the sum by adding the averages. Independence is not required for this move.";
    if (rule.params.identityId === "independent-zero-mean-product-vanishes") return "For independent, zero-mean quantities, the mean of their product is the product of their means, hence zero.";
  }
  return `${ruleInWords(rule.kind)}: use the stated equality without changing its assumptions.`;
}
