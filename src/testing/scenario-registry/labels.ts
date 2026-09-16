/** Plain-language labels for scenario kinds. Datasets are not scenarios. */

export const SCENARIO_KIND_LABELS = Object.freeze({
  "historical-fixture": "Historical fixture: reproduces what Einstein printed",
  "modern-golden": "Modern golden scenario: checked with modern constants",
  identity: "Identity",
  discrimination: "Comparison of two accounts at a stated observation",
  adversarial:
    "Adversarial fixture: a plausible wrong result that must fail for the intended reason",
  "historical-measurement": "Historical measurement",
} as const);

export function scenarioKindLabel(
  kind: keyof typeof SCENARIO_KIND_LABELS,
  constantSetId: string,
  options: { correctedMisprint?: boolean } = {},
): string {
  const base = SCENARIO_KIND_LABELS[kind];
  const misprint = options.correctedMisprint
    ? " using the corrected reading of a suspected misprint"
    : "";
  return `${base}${misprint} (constant set ${constantSetId}).`;
}
