import { ME01_DEFAULTS } from "../experiments/me01/definition.ts";
import { encodeMe01Settings } from "../experiments/me01/permalink.ts";
import type { ArgumentAssessment } from "./massEnergyArgument.ts";

/** Only a step actually supported in this order can supply a premise to the laboratory. */
export function argumentLedgerHandoff(assessment: ArgumentAssessment) {
  const supported = new Set(
    assessment.steps.filter((step) => step.status === "supported").map((step) => step.id),
  );
  if (!supported.has("retain-offset")) return null;
  const substitution = assessment.steps.find((step) => step.id === "kinetic-drop");
  const fixed = supported.has("unchanged-offset") && !substitution?.missing.includes("unchanged-offset");
  const query = encodeMe01Settings({
    ...ME01_DEFAULTS,
    step: "premise-kinetic",
    notation: "modern",
    offsetDisplay: "offsets",
    premise: fixed ? "unchanged" : "relaxed",
    cancelAdditiveConstant: fixed,
  });
  return {
    href: `/lab/me-01/${query}`,
    label: fixed
      ? "Test the balances with the offset held fixed"
      : "Test the balances with the offset left free",
  };
}
