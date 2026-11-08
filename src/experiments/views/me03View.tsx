import { BoundaryLedgerLab } from "../../components/lab/me03/BoundaryLedgerLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../me03/session.ts";
import "./clarificationLabStyles.ts";

const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };

export default function Me03ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <BoundaryLedgerLab example={example} instanceId={instanceId} restoreFromLocation={false} />
  );
}
