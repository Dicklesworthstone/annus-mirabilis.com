import { CoefficientLab } from "../../components/lab/CoefficientLab.tsx";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import equations from "../../generated/mass-energy-equations.json";
import example from "../../generated/me02-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateMe02Parameters } from "../me02/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateMe02Parameters(example.parameters);

export default function Me02ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="me-02" />;
  return (
    <CoefficientLab
      example={{ ...example, parameters: checked.data }}
      equations={equations.equations as readonly CompiledEquation[]}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
