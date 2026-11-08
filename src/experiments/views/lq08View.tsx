import { PhotoelectricLab } from "../../components/lab/lq08/PhotoelectricLab.tsx";
import example from "../../generated/lq08-example.json";
import millikan from "../../generated/lq08-millikan-overlay.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import type { MillikanOverlayResult } from "../lq08/millikan.ts";
import { createLq08Session } from "../lq08/session.ts";
import { LQ08_TAPE } from "../lq08/tape.ts";
import { createReaderCheckpointBinding } from "../store/readerCheckpoint.ts";
import { useRetainedSession } from "../store/retainedSession.tsx";

import "./clarificationLabStyles.ts";

export default function Lq08ClarificationView({ instanceId }: ExperimentViewProps) {
  const session = useRetainedSession(
    { experimentId: "lq-08", instanceId, sourceDigest: example.sourceDigest },
    (id) => createLq08Session(id, example),
    createReaderCheckpointBinding(LQ08_TAPE),
  );
  return (
    <PhotoelectricLab
      key={session.getSnapshot().accepted?.instanceId ?? instanceId}
      example={example}
      millikan={millikan as MillikanOverlayResult}
      session={session}
      linked={false}
    />
  );
}
