import { CameraLab } from "../../components/lab/CameraLab.tsx";
import example from "../../generated/bm08-example.json";
import { validateBm08Parameters } from "../bm08/parameters.ts";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";
import "../../app/lab/bm-08/camera.css";

const checked = validateBm08Parameters(example.parameters);

export default function Bm08ClarificationView({ instanceId }: ExperimentViewProps) {
  if (checked.kind !== "accepted") return <PreparedExampleNotice id="bm-08" />;
  return (
    <CameraLab
      example={{ ...example, parameters: checked.data }}
      instanceId={instanceId}
      restoreFromLocation={false}
    />
  );
}
