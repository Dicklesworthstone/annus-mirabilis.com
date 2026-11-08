import { IndependentConfigurationsLab } from "../../components/lab/lq05/IndependentConfigurationsLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { LQ05_DEFAULTS } from "../lq05/definition.ts";
import { evaluateLq05, type PreparedLq05Example } from "../lq05/session.ts";
import "./clarificationLabStyles.ts";

const evaluated = evaluateLq05(LQ05_DEFAULTS);
const example: PreparedLq05Example = {
  sourceDigest: labDigests["lq-05"],
  parameters: LQ05_DEFAULTS,
  results: evaluated.outputs.map(
    (output) =>
      `${output.quantityId}=${output.status === "value" ? String(output.value) : output.status}`,
  ),
  stepIndex: 1,
  simulationTime: 1,
};

export default function Lq05ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <IndependentConfigurationsLab
      example={example}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
