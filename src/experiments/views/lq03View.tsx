import { SpectrumLab } from "../../components/lab/lq03/SpectrumLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { LQ03_DEFAULTS } from "../lq03/definition.ts";
import { evaluateLq03 } from "../lq03/session.ts";
import "./clarificationLabStyles.ts";
import "../../components/lab/lq03/spectrum.css";

const example = {
  parameters: LQ03_DEFAULTS,
  evaluation: evaluateLq03(LQ03_DEFAULTS),
  sourceDigest: labDigests["lq-03"],
};

export default function Lq03ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <SpectrumLab
      example={example}
      instanceId={instanceId}
      restoreFromLocation={false}
      highlightPaper
    />
  );
}
