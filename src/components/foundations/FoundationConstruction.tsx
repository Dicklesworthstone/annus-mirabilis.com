"use client";

import { HeldFixedToggle } from "./HeldFixedToggle.tsx";
import { LogarithmProductTable } from "./LogarithmProductTable.tsx";
import { NudgeSensitivityDemo } from "./NudgeSensitivityDemo.tsx";
import { RepeatedProportionalTable } from "./RepeatedProportionalTable.tsx";
import { TableToPlotBuilder } from "./TableToPlotBuilder.tsx";
import { TaylorBinomialExtension } from "./TaylorBinomialExtension.tsx";

export interface FoundationConstructionProps {
  readonly foundationId: string;
}

/**
 * Dispatcher component that renders the appropriate interactive construction
 * or extension for a given foundation node ID.
 */
export function FoundationConstruction({ foundationId }: FoundationConstructionProps) {
  const cleanId = foundationId.replace(/^foundation:/, "");

  switch (cleanId) {
    case "functions-graphs":
      return <TableToPlotBuilder />;
    case "derivatives":
      return <NudgeSensitivityDemo />;
    case "partial-derivatives":
      return <HeldFixedToggle />;
    case "exponentials":
      return <RepeatedProportionalTable />;
    case "logarithms":
      return <LogarithmProductTable />;
    case "taylor-expansion":
      return <TaylorBinomialExtension />;
    default:
      return null;
  }
}
