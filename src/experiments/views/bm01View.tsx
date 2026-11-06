/** The reader owns the URL and instance; the laboratory owns its accepted scientific state. */
import { TracerLab } from "../../components/lab/TracerLab.tsx";
import example from "../../generated/bm01-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";

export default function Bm01ClarificationView({ instanceId }: ExperimentViewProps) {
  return <TracerLab example={example} instanceId={instanceId} linked={false} />;
}
