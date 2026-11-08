import { FieldEquationsLab } from "../../components/lab/sr07/FieldEquationsLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../sr07/session.ts";
import "./clarificationLabStyles.ts";
import "../../app/lab/sr-07/equations.css";

const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["sr-07"] };

export default function Sr07ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <FieldEquationsLab example={example} instanceId={instanceId} restoreFromLocation={false} />
  );
}
