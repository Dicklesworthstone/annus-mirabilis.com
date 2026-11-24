"use client";

import { useEffect, useId, useMemo } from "react";
import { EquationScope } from "../../../equations/EquationScope.tsx";
import { SemanticEquation } from "../../../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../../../equations/viewTypes.ts";
import type { ExecutionState } from "../../../experiments/provenance/executionState.ts";
import type { ExperimentView } from "../../../experiments/store/instanceStore.ts";
import equationPayload from "../../../generated/sr05-equations.json";
import { PinnedEquationDock } from "../../../reader/layout/PinnedEquationCompanion.tsx";
import {
  PinnedEquationProvider,
  usePinnedEquations,
} from "../../../reader/layout/PinnedEquationContext.tsx";

type ClockEquationProps = Readonly<{ view: ExperimentView; execution: ExecutionState }>;

/** Readers share their existing companion; a standalone laboratory owns its own equation dock. */
export function Sr05LiveEquation(props: ClockEquationProps) {
  const inherited = usePinnedEquations();
  return inherited ? (
    <ClockEquationContent {...props} />
  ) : (
    <PinnedEquationProvider>
      <ClockEquationContent {...props} />
      <PinnedEquationDock />
    </PinnedEquationProvider>
  );
}

/** The accepted platform-frame readings, from the same owner as the clock bars and tables. */
function ClockEquationContent({ view, execution }: ClockEquationProps) {
  const id = useId();
  const scope = `sr05-clock-${id}`;
  const pins = usePinnedEquations();
  const inertial = view.accepted?.parameters.worldlinePreset === "inertial";
  const slots = useMemo(
    () => [{ slot: "primary", experimentId: "sr-05", view, execution }],
    [view, execution],
  );

  // A pin retains its source context after the source card unmounts. Once the accepted trip
  // turns, this card's single-inertial-frame assumption no longer describes it. Remove only
  // this source's pin; a different equation pinned elsewhere in the reader is unaffected.
  useEffect(() => {
    const pin = pins?.getPinnedEquation();
    if (
      !inertial &&
      pin?.equation.id === "eq-model-sr-time-dilation" &&
      pin.context.scope === scope
    )
      pins?.unpinEquation();
  }, [inertial, pins, scope]);

  if (!view.accepted) return null;
  if (!inertial)
    return (
      <p className="fine" data-sr05-equation-domain="closed-trip">
        When the traveling clock turns, it has no single inertial rest frame for the whole trip. The
        readings above add its proper time along the trip. Choose a straight-line trip to explore
        the single-frame equation with live values.
      </p>
    );

  return (
    <section aria-label="Explore the accepted clock relation" data-sr05-live-equation>
      <p className="fine">
        These values come from the accepted trip in the platform frame: the platform&apos;s time
        between the two ticks, the moving clock&apos;s own elapsed time, and the factor set by its
        speed relative to the platform. Describing the trip from another observer&apos;s frame keeps
        this comparison unchanged.
      </p>
      <EquationScope
        slots={slots}
        scope={scope}
        scopeLabel="accepted trip in the platform frame"
        lessonTitles={equationPayload.foundationTitles}
      >
        {(equationPayload.equations as readonly CompiledEquation[]).map((equation) => (
          <SemanticEquation key={equation.id} equation={equation} />
        ))}
      </EquationScope>
    </section>
  );
}
