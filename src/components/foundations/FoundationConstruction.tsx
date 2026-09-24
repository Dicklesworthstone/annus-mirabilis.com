"use client";

import { BoostTable } from "./BoostTable.tsx";
import { foundationConstructionId } from "./constructionIds.ts";
import { HeldFixedToggle } from "./HeldFixedToggle.tsx";
import type { HeadingLevel } from "./headingLevel.ts";
import { LogarithmProductTable } from "./LogarithmProductTable.tsx";
import { MagnitudeScale } from "./MagnitudeScale.tsx";
import { NudgeSensitivityDemo } from "./NudgeSensitivityDemo.tsx";
import { RapidityAdder } from "./RapidityAdder.tsx";
import { RepeatedIntervals } from "./RepeatedIntervals.tsx";
import { RepeatedProportionalTable } from "./RepeatedProportionalTable.tsx";
import { ScalingTable } from "./ScalingTable.tsx";
import { TableToPlotBuilder } from "./TableToPlotBuilder.tsx";
import { TaylorBinomialExtension } from "./TaylorBinomialExtension.tsx";
import { TurnedAxes } from "./TurnedAxes.tsx";
import { UnitCancellationTable } from "./UnitCancellationTable.tsx";
import { UnitConversionCalculator } from "./UnitConversionCalculator.tsx";

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
  // Typed by the server-readable list (constructionIds.ts), so each case must be one of its ids
  // and a construction cannot be added here without being added there.
  const id = foundationConstructionId(foundationId);
  if (id === null) return null;
  switch (id) {
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
    case "unit-system-1905":
      return <UnitConversionCalculator headingLevel={headingLevel} />;
    case "ratios-scaling":
      return <ScalingTable headingLevel={headingLevel} />;
    case "orders-of-magnitude":
      return <MagnitudeScale headingLevel={headingLevel} />;
    case "quantities-units":
      return <UnitCancellationTable headingLevel={headingLevel} />;
    case "error-and-inference":
      return <RepeatedIntervals headingLevel={headingLevel} />;
    case "matrices-linear-maps":
      return <BoostTable headingLevel={headingLevel} />;
    case "hyperbolic-functions-rapidity":
      return <RapidityAdder headingLevel={headingLevel} />;
    case "vectors-components":
      return <TurnedAxes headingLevel={headingLevel} />;
  }
}
