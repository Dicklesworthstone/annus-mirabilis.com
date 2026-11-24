"use client";

import { useId, useMemo } from "react";
import { EquationScope } from "../../../equations/EquationScope.tsx";
import { SemanticEquation } from "../../../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../../../equations/viewTypes.ts";
import { LQ08_MODEL } from "../../../experiments/lq08/definition.ts";
import type { ExecutionState } from "../../../experiments/provenance/executionState.ts";
import type { ExperimentView } from "../../../experiments/store/instanceStore.ts";
import equationPayload from "../../../generated/lq08-equations.json";
import { PinnedEquationDock } from "../../../reader/layout/PinnedEquationCompanion.tsx";
import {
  PinnedEquationProvider,
  usePinnedEquations,
} from "../../../reader/layout/PinnedEquationContext.tsx";

type PhotoelectricEquationProps = Readonly<{ view: ExperimentView; execution: ExecutionState }>;

/** Embedded labs reuse the reader's companion; a standalone apparatus supplies its own dock. */
export function Lq08LiveEquations(props: PhotoelectricEquationProps) {
  const inherited = usePinnedEquations();
  return inherited ? (
    <PhotoelectricEquationContent {...props} />
  ) : (
    <PinnedEquationProvider>
      <PhotoelectricEquationContent {...props} />
      <PinnedEquationDock />
    </PinnedEquationProvider>
  );
}

/** Read the accepted owner's energies and constants. This surface performs no physics. */
function PhotoelectricEquationContent({ view, execution }: PhotoelectricEquationProps) {
  const id = useId();
  const slots = useMemo(
    () => [{ slot: "primary", experimentId: "lq-08", view, execution }],
    [view, execution],
  );
  if (!view.accepted) return null;

  const kineticEnergy = view.accepted.outputs.find(
    (output) => output.quantityId === "maxKineticEnergy",
  );
  const belowThreshold = kineticEnergy?.status === "not-applicable";
  const atThreshold = kineticEnergy?.status === "value" && kineticEnergy.value === 0;

  return (
    <details data-lq08-live-equations data-constant-set-id={LQ08_MODEL.constantSetId}>
      <summary>Explore the equations at these settings</summary>
      <p className="fine">
        Each value below comes from the accepted apparatus calculation, using modern SI constants.
        The control gives escape work in electron volts; the energy equations show the same work in
        joules, converted by that calculation using its elementary charge. These are modern teaching
        relations. The printed 1905 notation and its numerical check remain separate.
      </p>
      {belowThreshold ? (
        <p className="fine" data-lq08-equation-domain="below-threshold">
          Below the threshold, no electron escapes in this model. Its maximum kinetic energy and
          stopping potential are not applicable, rather than zero or negative. The threshold
          frequency remains defined, and increasing lamp power cannot pay the missing escape work.
        </p>
      ) : atThreshold ? (
        <p className="fine" data-lq08-equation-domain="threshold">
          At the threshold, a quantum exactly pays the escape work. The limiting maximum kinetic
          energy and stopping potential are zero; this equality does not guarantee a measurable
          current.
        </p>
      ) : (
        <p className="fine" data-lq08-equation-domain="energy-budget">
          The energy and stopping-potential relations describe the fastest escaping electron. Lamp
          power changes how many quanta arrive, while frequency sets each quantum's energy. The
          stopping potential is a nonnegative retarding magnitude; the signed collector potential
          control sets where the apparatus measures current.
        </p>
      )}
      <EquationScope
        slots={slots}
        scope={`lq08-photoelectric-${id}`}
        scopeLabel="accepted photoelectric apparatus settings"
        lessonTitles={equationPayload.foundationTitles}
      >
        {(equationPayload.equations as readonly CompiledEquation[]).map((equation) => (
          <SemanticEquation key={equation.id} equation={equation} />
        ))}
      </EquationScope>
    </details>
  );
}
