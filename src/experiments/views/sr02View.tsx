import { useMemo } from "react";
import { MagnetConductorLab } from "../../components/lab/MagnetConductorLab.tsx";
import example from "../../generated/sr02-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { encodeResult } from "../results/codec.ts";
import { validateSr02Parameters } from "../sr02/parameters.ts";
import { snapshotOutputs } from "../sr02/session.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

/** The declared apparatus address selects its own view without reading the paper's URL. */
export default function Sr02ClarificationView({ instanceId, mode }: ExperimentViewProps) {
  const prepared = useMemo(() => {
    const checked = validateSr02Parameters({
      ...example.parameters,
      mode: mode ?? example.parameters.mode,
    });
    if (checked.kind !== "accepted") return null;
    return {
      ...example,
      parameters: checked.data,
      results: mode ? snapshotOutputs(checked.data).map(encodeResult) : example.results,
    };
  }, [mode]);
  if (!prepared) return <PreparedExampleNotice id="sr-02" />;
  return (
    <MagnetConductorLab example={prepared} instanceId={instanceId} restoreFromLocation={false} />
  );
}
