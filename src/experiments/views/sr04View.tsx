import { LorentzMapLab } from "../../components/lab/sr04/LorentzMapLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { SR04_DEFAULTS } from "../sr04/definition.ts";
import { evaluateSr04 } from "../sr04/session.ts";
import "./clarificationLabStyles.ts";

const example = {
  parameters: SR04_DEFAULTS,
  evaluation: evaluateSr04(SR04_DEFAULTS),
  sourceDigest: labDigests["sr-04"],
};

export default function Sr04ClarificationView({ instanceId }: ExperimentViewProps) {
  return <LorentzMapLab example={example} instanceId={instanceId} restoreFromLocation={false} />;
}
