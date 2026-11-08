import { DopplerAberrationLab } from "../../components/lab/sr09/DopplerAberrationLab.tsx";
import example from "../../generated/sr09-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr09Parameters } from "../sr09/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr09Parameters(example.parameters);

export default function Sr09ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="sr-09" />;
  return (
    <DopplerAberrationLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
