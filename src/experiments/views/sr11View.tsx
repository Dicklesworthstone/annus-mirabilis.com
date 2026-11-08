import { MovingMirrorLab } from "../../components/lab/sr11/MovingMirrorLab.tsx";
import example from "../../generated/sr11-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr11Parameters } from "../sr11/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr11Parameters(example.parameters);

export default function Sr11ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="sr-11" />;
  return (
    <MovingMirrorLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
