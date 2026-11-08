import { TwoLedgersLab } from "../../components/lab/me01/TwoLedgersLab.tsx";
import labDigests from "../../generated/lab-source-digests.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../me01/session.ts";

const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-01"] };

import "./clarificationLabStyles.ts";

export default function Me01ClarificationView({ instanceId }: ExperimentViewProps) {
  return <TwoLedgersLab example={example} instanceId={instanceId} restoreFromLocation={false} />;
}
