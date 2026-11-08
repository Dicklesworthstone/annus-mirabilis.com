import { RodSimultaneityLab } from "../../components/lab/RodSimultaneityLab.tsx";
import example from "../../generated/sr03-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr03Parameters } from "../sr03/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr03Parameters(example.parameters);

export default function Sr03ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="sr-03" />;
  return (
    <RodSimultaneityLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
