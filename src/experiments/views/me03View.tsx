import { BoundaryLedgerLab } from "../../components/lab/me03/BoundaryLedgerLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { createMe03Session, DEFAULT_PREPARED_EXAMPLE } from "../me03/session.ts";
import { useRetainedSession } from "../store/retainedSession.tsx";
import "./clarificationLabStyles.ts";

const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };

export default function Me03ClarificationView({ instanceId }: ExperimentViewProps) {
  const session = useRetainedSession(
    { experimentId: "me-03", instanceId, sourceDigest: example.sourceDigest },
    (retainedId) => createMe03Session(retainedId, example.parameters),
  );
  return (
    <BoundaryLedgerLab
      key={session.getSnapshot().accepted?.instanceId}
      example={example}
      instanceId={instanceId}
      session={session}
      restoreFromLocation={false}
    />
  );
}
