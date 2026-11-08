import { ChargeCurrentLab } from "../../components/lab/sr12/ChargeCurrentLab.tsx";
import example from "../../generated/sr12-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr12Parameters } from "../sr12/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr12Parameters(example.parameters);

export default function Sr12ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="sr-12" />;
  return (
    <ChargeCurrentLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
