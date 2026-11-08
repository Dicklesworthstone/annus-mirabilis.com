import { VelocityCompositionLab } from "../../components/lab/sr06/VelocityCompositionLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../sr06/session.ts";
import "./clarificationLabStyles.ts";
import "../../app/lab/sr-06/composition.css";

const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["sr-06"] };

export default function Sr06ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <VelocityCompositionLab example={example} instanceId={instanceId} restoreFromLocation={false} />
  );
}
