import { WaveDescriptionLab } from "../../components/lab/WaveDescriptionLab.tsx";
import example from "../../generated/lq01-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateLq01Parameters } from "../lq01/parameters.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateLq01Parameters(example.parameters);

export default function Lq01ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="lq-01" />;
  return (
    <WaveDescriptionLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
