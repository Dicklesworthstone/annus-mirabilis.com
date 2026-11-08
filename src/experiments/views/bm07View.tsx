import { InferenceLab } from "../../components/lab/InferenceLab.tsx";
import example from "../../generated/bm07-example.json";
import { validateBm07Parameters } from "../bm07/parameters.ts";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";
import "../../app/lab/bm-07/inference.css";

const checked = validateBm07Parameters(example.parameters);

export default function Bm07ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="bm-07" />;
  return (
    <InferenceLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
