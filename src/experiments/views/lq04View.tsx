import { EntropyWorkbenchLab } from "../../components/lab/lq04/EntropyWorkbenchLab.tsx";
import example from "../../generated/lq04-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import "./clarificationLabStyles.ts";

export default function Lq04ClarificationView({ instanceId }: ExperimentViewProps) {
  return (
    <EntropyWorkbenchLab
      example={example}
      instanceId={instanceId}
      restoreFromLocation={false}
      highlightPaper
    />
  );
}
