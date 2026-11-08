import { OsmoticPartitionLab } from "../../components/lab/OsmoticPartitionLab.tsx";
import { DEFAULT_BM02_INPUTS } from "../bm02/session.ts";
import type { ExperimentViewProps } from "../dispatch.tsx";
import "./clarificationLabStyles.ts";

export default function Bm02ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <OsmoticPartitionLab
      example={DEFAULT_BM02_INPUTS}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
