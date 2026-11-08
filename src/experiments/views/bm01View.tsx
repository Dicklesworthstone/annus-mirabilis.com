/** The reader owns the URL and instance; the laboratory owns its accepted scientific state. */
import { TracerLab } from "../../components/lab/TracerLab.tsx";
import example from "../../generated/bm01-example.json";
import { createBm01BrowserChannel } from "../bm01/browser.ts";
import { createBm01Session } from "../bm01/session.ts";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { useRetainedSession } from "../store/retainedSession.tsx";

import "./clarificationLabStyles.ts";

export default function Bm01ClarificationView({ instanceId }: ExperimentViewProps) {
  const session = useRetainedSession(
    { experimentId: "bm-01", instanceId, sourceDigest: example.sourceDigest },
    (retainedId) => createBm01Session(retainedId, example, createBm01BrowserChannel),
  );
  return (
    <TracerLab
      key={session.getSnapshot().accepted?.instanceId}
      example={example}
      instanceId={instanceId}
      session={session}
      linked={false}
    />
  );
}
