import { ElectronDynamicsLab } from "../../components/lab/sr13/ElectronDynamicsLab.tsx";
import example from "../../generated/sr13-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr13Parameters } from "../sr13/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr13Parameters(example.parameters);

export default function Sr13ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="sr-13" />;
  return (
    <ElectronDynamicsLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
