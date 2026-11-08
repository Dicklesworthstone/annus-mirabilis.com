import { useState } from "react";
import { PhotoelectricLab } from "../../components/lab/lq08/PhotoelectricLab.tsx";
import example from "../../generated/lq08-example.json";
import millikan from "../../generated/lq08-millikan-overlay.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import type { MillikanOverlayResult } from "../lq08/millikan.ts";
import { createLq08Session } from "../lq08/session.ts";

import "./clarificationLabStyles.ts";

export default function Lq08ClarificationView({ instanceId }: ExperimentViewProps) {
  const [session] = useState(() => createLq08Session(instanceId, example));
  return (
    <PhotoelectricLab
      example={example}
      millikan={millikan as MillikanOverlayResult}
      session={session}
      linked={false}
    />
  );
}
