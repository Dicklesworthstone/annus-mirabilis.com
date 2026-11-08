import { CoefficientMatchLab } from "../../components/lab/lq06/CoefficientMatchLab.tsx";
import example from "../../generated/lq06-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import "./clarificationLabStyles.ts";

export default function Lq06ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <CoefficientMatchLab example={example} instanceId={instanceId} restoreFromLocation={false} />
  );
}
