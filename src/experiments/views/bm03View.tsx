import { ConfigurationLab } from "../../components/lab/bm03/ConfigurationLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import { BM03_DEFAULTS } from "../bm03/definition.ts";
import { evaluateBm03 } from "../bm03/session.ts";
import type { ExperimentViewProps } from "../dispatch.tsx";
import "./clarificationLabStyles.ts";

const example = {
  parameters: BM03_DEFAULTS,
  evaluation: evaluateBm03(BM03_DEFAULTS),
  sourceDigest: labDigests["bm-03"],
};

export default function Bm03ClarificationView({ instanceId }: ExperimentViewProps) {
  return <ConfigurationLab example={example} instanceId={instanceId} restoreFromLocation={false} />;
}
