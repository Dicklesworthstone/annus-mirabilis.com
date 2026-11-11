import { LightThreadLab } from "../../components/lab/lightThread/LightThreadLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import "./clarificationLabStyles.ts";

/** The same cross-paper owner, scoped to this passage and independent of the paper's URL. */
export default function LightThreadClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <LightThreadLab
      sourceDigest={labDigests["light-thread"]}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
