import { FieldFrameChangeLab } from "../../components/lab/sr08/FieldFrameChangeLab.tsx";
import example from "../../generated/sr08-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr08Parameters } from "../sr08/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr08Parameters(example.parameters);

export default function Sr08ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="sr-08" />;
  return (
    <FieldFrameChangeLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
