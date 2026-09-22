"use client";

import { HeldFixedToggle } from "./HeldFixedToggle.tsx";
import type { HeadingLevel } from "./headingLevel.ts";
import { LogarithmProductTable } from "./LogarithmProductTable.tsx";
import { NudgeSensitivityDemo } from "./NudgeSensitivityDemo.tsx";
import { RepeatedProportionalTable } from "./RepeatedProportionalTable.tsx";
import { TableToPlotBuilder } from "./TableToPlotBuilder.tsx";
import { TaylorBinomialExtension } from "./TaylorBinomialExtension.tsx";

export interface FoundationConstructionProps {
  readonly foundationId: string;
  /** Depth of the construction's own title: the depth of the lesson part it sits beside. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Dispatcher component that renders the appropriate interactive construction
 * or extension for a given foundation node ID.
 */
export function FoundationConstruction({
  foundationId,
  headingLevel = 3,
}: FoundationConstructionProps) {
  const cleanId = foundationId.replace(/^foundation:/, "");

  switch (cleanId) {
    case "functions-graphs":
      return <TableToPlotBuilder headingLevel={headingLevel} />;
    case "derivatives":
      return <NudgeSensitivityDemo headingLevel={headingLevel} />;
    case "partial-derivatives":
      return <HeldFixedToggle headingLevel={headingLevel} />;
    case "exponentials":
      return <RepeatedProportionalTable headingLevel={headingLevel} />;
    case "logarithms":
      return <LogarithmProductTable headingLevel={headingLevel} />;
    case "taylor-expansion":
      return <TaylorBinomialExtension headingLevel={headingLevel} />;
    default:
      return null;
  }
}
