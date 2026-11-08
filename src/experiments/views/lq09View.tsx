import { IonizationLab } from "../../components/lab/lq09/IonizationLab.tsx";
import example from "../../generated/lq09-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import "./clarificationLabStyles.ts";

export default function Lq09ClarificationView({ instanceId }: ExperimentViewProps) {
  return <IonizationLab example={example} instanceId={instanceId} restoreFromLocation={false} />;
}
