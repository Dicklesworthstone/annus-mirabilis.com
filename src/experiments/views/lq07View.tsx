import { FluorescenceLab } from "../../components/lab/lq07/FluorescenceLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { LQ07_DEFAULTS } from "../lq07/definition.ts";
import { evaluateLq07, type PreparedLq07Example } from "../lq07/session.ts";
import "./clarificationLabStyles.ts";

const evaluated = evaluateLq07(LQ07_DEFAULTS);
const example: PreparedLq07Example = {
  sourceDigest: labDigests["lq-07"],
  parameters: LQ07_DEFAULTS,
  results: evaluated.outputs.map(
    (output) =>
      `${output.quantityId}=${output.status === "value" ? String(output.value) : output.status}`,
  ),
  stepIndex: 1,
  simulationTime: 1,
};

export default function Lq07ClarificationView({ instanceId }: ExperimentViewProps) {
  return <FluorescenceLab example={example} instanceId={instanceId} restoreFromLocation={false} />;
}
