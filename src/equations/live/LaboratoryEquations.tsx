"use client";

import { useId, useMemo } from "react";
import type { ExecutionState } from "../../experiments/provenance/executionState.ts";
import type { RequestRefusal } from "../../experiments/results/refusals.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import { PinnedEquationDock } from "../../reader/layout/PinnedEquationCompanion.tsx";
import {
  PinnedEquationProvider,
  usePinnedEquations,
} from "../../reader/layout/PinnedEquationContext.tsx";
import { EquationScope } from "../EquationScope.tsx";
import { SemanticEquation } from "../SemanticEquation.tsx";
import type { CompiledEquation } from "../viewTypes.ts";
import type { LaboratoryEquationId } from "./laboratoryOutputs.ts";
import { projectLaboratoryEquationView } from "./laboratoryProjection.ts";

export type LaboratoryEquationsProps = Readonly<{
  experimentId: LaboratoryEquationId;
  view: ExperimentView;
  execution: ExecutionState;
  payload: Readonly<{
    equations: readonly CompiledEquation[];
    foundationTitles: Readonly<Record<string, string>>;
  }>;
  validationRefusal?: RequestRefusal | null;
  /** A malformed field is a form error, not a scientific refusal. */
  validationMessage?: string;
}>;

/** An embedded laboratory uses the reader's companion; a standalone one supplies its own. */
export function LaboratoryEquations(props: LaboratoryEquationsProps) {
  const inherited = usePinnedEquations();
  return inherited ? (
    <AcceptedEquations {...props} />
  ) : (
    <PinnedEquationProvider>
      <AcceptedEquations {...props} />
      <PinnedEquationDock />
    </PinnedEquationProvider>
  );
}

function AcceptedEquations({
  experimentId,
  view,
  execution,
  payload,
  validationRefusal,
  validationMessage,
}: LaboratoryEquationsProps) {
  const id = useId();
  const slots = useMemo(() => {
    const projected = projectLaboratoryEquationView(experimentId, view);
    // Form validation can refuse before the numerical owner receives a request. The source view
    // remains untouched; the equation and its pinned copy still describe those retained values.
    const equationView: ExperimentView =
      validationRefusal && !projected.pending
        ? { ...projected, status: "refused", refusal: validationRefusal }
        : projected;
    return [{ slot: "primary", experimentId, view: equationView, execution }];
  }, [experimentId, view, execution, validationRefusal]);

  return (
    <section
      id={`${id}-accepted-equations`}
      aria-label="Equations for the accepted trial"
      data-laboratory-equations={experimentId}
      data-paper={payload.equations[0]?.paper}
    >
      <h3>Equations for these settings</h3>
      <p className="fine">
        Select a symbol or an operation to explore its role. The values belong to the last applied
        settings, just as the plots and tables do.
      </p>
      {validationMessage && (
        <p className="notice" data-equation-validation>
          {validationMessage} These equation values still belong to the previous accepted settings.
        </p>
      )}
      <EquationScope
        slots={slots}
        scope={`${experimentId}-accepted-${id}`}
        scopeLabel="accepted laboratory settings"
        lessonTitles={payload.foundationTitles}
      >
        {payload.equations.map((equation) => (
          <SemanticEquation key={equation.id} equation={equation} />
        ))}
      </EquationScope>
    </section>
  );
}
