import { MovingClocksLab } from "../../components/lab/sr05/MovingClocksLab.tsx";
import example from "../../generated/sr05-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr05Parameters } from "../sr05/parameters.ts";
import { createSr05Session } from "../sr05/session.ts";
import { SR05_TAPE } from "../sr05/tape.ts";
import { createReaderCheckpointBinding } from "../store/readerCheckpoint.ts";
import { useRetainedSession } from "../store/retainedSession.tsx";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr05Parameters(example.parameters);
const prepared = checked.kind === "accepted" ? { ...example, parameters: checked.data } : null;

function PreparedView({
  instanceId,
  example,
}: {
  instanceId: string;
  example: NonNullable<typeof prepared>;
}) {
  const session = useRetainedSession(
    { experimentId: "sr-05", instanceId, sourceDigest: example.sourceDigest },
    (id) => createSr05Session(id, example),
    createReaderCheckpointBinding(SR05_TAPE),
  );
  return (
    <MovingClocksLab
      key={session.getSnapshot().accepted?.instanceId ?? instanceId}
      example={example}
      session={session}
      restoreFromLocation={false}
    />
  );
}

export default function Sr05ClarificationView({ instanceId }: ExperimentViewProps) {
  return prepared ? (
    <PreparedView instanceId={instanceId} example={prepared} />
  ) : (
    <PreparedExampleNotice id="sr-05" />
  );
}
