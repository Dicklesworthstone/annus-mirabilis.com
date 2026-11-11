import { WalkLab } from "../../components/lab/WalkLab.tsx";
import example from "../../generated/bm05-example.json";
import { validateBm05Parameters } from "../bm05/parameters.ts";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";
import "../../app/lab/bm-05/walks.css";

const checked = validateBm05Parameters(example.parameters);

export default function Bm05ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="bm-05" />;
  return (
    <WalkLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
      highlightPaper
    />
  );
}
