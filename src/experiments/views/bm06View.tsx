import { BrownianLab } from "../../components/lab/BrownianLab.tsx";
import example from "../../generated/bm06-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import "./clarificationLabStyles.ts";

export default function Bm06ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <BrownianLab example={example} instanceId={instanceId} restoreFromLocation={false} readings />
  );
}
