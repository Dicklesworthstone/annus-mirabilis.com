import data from "../../generated/instrument-worked-cases.json";
import { findWorkedCase, type InstrumentWorkedCaseIndex } from "./types.ts";
import { WorkedCase } from "./WorkedCase.tsx";

/** The generator emits bounded, presentation-only records, not full prepared snapshots. */
const index = data as InstrumentWorkedCaseIndex;

export default function PreparedWorkedCase({
  instrumentId,
  mode,
}: {
  instrumentId: string;
  mode: string | null;
}) {
  const address = mode ? instrumentId + ":" + mode : instrumentId;
  return (
    <WorkedCase record={findWorkedCase(index, address)} instrumentId={instrumentId} mode={mode} />
  );
}
