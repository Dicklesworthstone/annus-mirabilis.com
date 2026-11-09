import { DriftDiffusionLab } from "../../components/lab/DriftDiffusionLab.tsx";
import example from "../../generated/bm04-example.json";
import { validateBm04Parameters } from "../bm04/parameters.ts";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateBm04Parameters(example.parameters);

export default function Bm04ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="bm-04" />;
  return (
    <DriftDiffusionLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
