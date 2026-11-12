/** Reader placements use the same retained owner and controls as the full optical laboratories. */
import { ShelfOpticsLab } from "../../components/lab/shelfOptics/ShelfOpticsLab.tsx";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { SHELF_DEFINITIONS, type ShelfId } from "../shelfOptics/definition.ts";
import { evaluateShelfOptics } from "../shelfOptics/evaluation.ts";
import type { ShelfReport } from "../shelfOptics/state.ts";

import "./clarificationLabStyles.ts";
import "../../components/lab/shelfOptics/shelfOptics.css";

const examples: Readonly<Record<ShelfId, ShelfReport>> = {
  "shelf-michelson-morley": evaluateShelfOptics(
    SHELF_DEFINITIONS["shelf-michelson-morley"].defaults,
  ),
  "shelf-fizeau": evaluateShelfOptics(SHELF_DEFINITIONS["shelf-fizeau"].defaults),
  "shelf-maxwell-galilean": evaluateShelfOptics(
    SHELF_DEFINITIONS["shelf-maxwell-galilean"].defaults,
  ),
};

function ShelfClarification({
  instrumentId,
  instanceId,
}: {
  instrumentId: ShelfId;
  instanceId: string;
}) {
  return (
    <>
      <p className="lead">{SHELF_DEFINITIONS[instrumentId].question}</p>
      <ShelfOpticsLab example={examples[instrumentId]} instanceId={instanceId} />
      <p className="fine">
        These model comparisons use modern SI calibration and illustrative inputs.{" "}
        <a href={`/lab/${instrumentId}/`}>
          {instrumentId === "shelf-fizeau"
            ? "Open the full laboratory for historical observations, equations and sources"
            : "Open the full laboratory for equations and sources"}
        </a>
        .
      </p>
    </>
  );
}

export function ShelfMichelsonMorleyView({ instanceId }: ExperimentViewProps) {
  return <ShelfClarification instrumentId="shelf-michelson-morley" instanceId={instanceId} />;
}

export function ShelfFizeauView({ instanceId }: ExperimentViewProps) {
  return <ShelfClarification instrumentId="shelf-fizeau" instanceId={instanceId} />;
}

export function ShelfMaxwellGalileanView({ instanceId }: ExperimentViewProps) {
  return <ShelfClarification instrumentId="shelf-maxwell-galilean" instanceId={instanceId} />;
}
