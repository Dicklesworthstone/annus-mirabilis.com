"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { EquationScope } from "../../../equations/EquationScope.tsx";
import { SemanticEquation } from "../../../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../../../equations/viewTypes.ts";
import { LQ08_MODEL } from "../../../experiments/lq08/definition.ts";
import type { Lq08ExperimentView } from "../../../experiments/lq08/session.ts";
import type { ExecutionState } from "../../../experiments/provenance/executionState.ts";
import equationPayload from "../../../generated/lq08-equations.json";
import { PinnedEquationDock } from "../../../reader/layout/PinnedEquationCompanion.tsx";
import {
  PinnedEquationProvider,
  usePinnedEquations,
} from "../../../reader/layout/PinnedEquationContext.tsx";

const COMPLETE_RELATIONS = ["eq-model-lq-photoelectric-maximum", "eq-model-lq-stopping-energy"];
const PARTIAL_RELATIONS = ["eq-model-lq-photoelectric-maximum-bound", "eq-model-lq-stopping-bound"];

type PhotoelectricEquationProps = Readonly<{ view: Lq08ExperimentView; execution: ExecutionState }>;

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
  const scope = `lq08-photoelectric-${id}`;
  const pins = usePinnedEquations();
  const partial = view.accepted?.parameters.transferModel === "partial";
  const [pinNotice, setPinNotice] = useState(false);
  const slots = useMemo(
    () => [{ slot: "primary", experimentId: "lq-08", view, execution }],
    [view, execution],
  );
  useEffect(() => {
    const pin = pins?.getPinnedEquation();
    const obsolete = partial ? COMPLETE_RELATIONS : PARTIAL_RELATIONS;
    if (pin?.context.scope === scope && obsolete.includes(pin.equation.id)) {
      pins?.unpinEquation();
      setPinNotice(true);
    }
  }, [partial, pins, scope]);

  if (!view.accepted) return null;

  const kineticEnergy = view.accepted.outputs.find(
    (output) => output.quantityId === "maxKineticEnergy",
  );
  const belowThreshold = kineticEnergy?.status === "not-applicable";
  const atThreshold = kineticEnergy?.status === "value" && kineticEnergy.value === 0;

  const visibleRelations = partial ? PARTIAL_RELATIONS : COMPLETE_RELATIONS;
  const equations = (equationPayload.equations as readonly CompiledEquation[]).filter(
    (equation) =>
      equation.id === "eq-model-lq-threshold-frequency" || visibleRelations.includes(equation.id),
  );
  return (
    <>
      {pinNotice && (
        <p className="fine" role="status" data-lq08-pin-change>
          The previous pinned relation used a different energy-transfer assumption and has been
          unpinned. Pin an equation below to follow the accepted settings.
        </p>
      )}
      <details
        data-lq08-live-equations
        data-constant-set-id={LQ08_MODEL.constantSetId}
        data-transfer-model={partial ? "partial" : "complete"}
      >
        <summary>Explore the equations at these settings</summary>
        <p className="fine">
          Each value below comes from the accepted apparatus calculation, using modern SI constants.
          The control gives escape work in electron volts; the energy equations show the same work
          in joules, converted by that calculation using its elementary charge. These are modern
          teaching relations. The printed 1905 notation and its numerical check remain separate.
        </p>
        {partial && (
          <p className="fine" data-lq08-partial-assumptions>
            The transferred share of a quantum is unknown. The energy budget supplies upper limits,
            not a largest energy or stopping potential that the apparatus is known to reach. The
            prescribed quantum efficiency still sets an ideal emission yield; it is not inferred
            from that unknown share.
          </p>
        )}
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
        ) : partial ? (
          <p className="fine" data-lq08-equation-domain="partial-bound">
            The left sides remain undetermined while the right sides use the accepted frequency,
            escape work and constants. The complete-transfer threshold below is only a necessary
            energy-budget lower frequency limit here; being above it does not guarantee emission.
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
          scope={scope}
          scopeLabel="accepted photoelectric apparatus settings"
          lessonTitles={equationPayload.foundationTitles}
        >
          {equations.map((equation) => (
            <SemanticEquation key={equation.id} equation={equation} />
          ))}
        </EquationScope>
      </details>
    </>
  );
}
