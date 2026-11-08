import { LightComplexLab } from "../../components/lab/sr10/LightComplexLab.tsx";
import example from "../../generated/sr10-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr10Parameters } from "../sr10/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr10Parameters(example.parameters);

export default function Sr10ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="sr-10" />;
  return (
    <LightComplexLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
