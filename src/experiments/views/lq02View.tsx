import { ModeAllocationLab } from "../../components/lab/ModeAllocationLab.tsx";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { DEFAULT_LQ02_INPUTS } from "../lq02/session.ts";
import "./clarificationLabStyles.ts";

export default function Lq02ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <ModeAllocationLab
      example={DEFAULT_LQ02_INPUTS}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
