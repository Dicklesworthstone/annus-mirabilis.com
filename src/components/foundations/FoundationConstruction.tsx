"use client";

import { AddingInStrips } from "./AddingInStrips.tsx";
import { BalancedAccount } from "./BalancedAccount.tsx";
import { BellAndItsWidths } from "./BellAndItsWidths.tsx";
import { BoostTable } from "./BoostTable.tsx";
import { ConfigurationCounter } from "./ConfigurationCounter.tsx";
import { CountingThePlaces } from "./CountingThePlaces.tsx";
import { CrossingABoundary } from "./CrossingABoundary.tsx";
import {
  CONSTRUCTIONS_WITH_CONTROLS,
  type FoundationConstructionId,
  foundationConstructionId,
} from "./constructionIds.ts";
import { DescriptionOrWorld } from "./DescriptionOrWorld.tsx";
import { EnergyLedger } from "./EnergyLedger.tsx";
import { EntropyTemperatureCheck } from "./EntropyTemperatureCheck.tsx";
import { FourCellsTwiceTheSide } from "./FourCellsTwiceTheSide.tsx";
import { FourOutcomes } from "./FourOutcomes.tsx";
import { HeightIsNotProbability } from "./HeightIsNotProbability.tsx";
import { HeldFixedToggle } from "./HeldFixedToggle.tsx";
import type { HeadingLevel } from "./headingLevel.ts";
import { LogarithmProductTable } from "./LogarithmProductTable.tsx";
import { MagnitudeScale } from "./MagnitudeScale.tsx";
import { NudgeSensitivityDemo } from "./NudgeSensitivityDemo.tsx";
import { OsmoticTable } from "./OsmoticTable.tsx";
import { PeakAndDip } from "./PeakAndDip.tsx";
import { PourAndShare } from "./PourAndShare.tsx";
import { ProductsView } from "./ProductsView.tsx";
import { RapidityAdder } from "./RapidityAdder.tsx";
import { ReadingAGraph } from "./ReadingAGraph.tsx";
import { RepeatedIntervals } from "./RepeatedIntervals.tsx";
import { RepeatedProportionalTable } from "./RepeatedProportionalTable.tsx";
import { SameShareTwice } from "./SameShareTwice.tsx";
import { ScalingTable } from "./ScalingTable.tsx";
import { SecantsToATangent } from "./SecantsToATangent.tsx";
import { SignedRuler } from "./SignedRuler.tsx";
import { SinkingSpheres } from "./SinkingSpheres.tsx";
import { SpeedSpread } from "./SpeedSpread.tsx";
import { SquareAndItsCorner } from "./SquareAndItsCorner.tsx";
import { StepsAndSpread } from "./StepsAndSpread.tsx";
import { TableToPlotBuilder } from "./TableToPlotBuilder.tsx";
import { TaylorBinomialExtension } from "./TaylorBinomialExtension.tsx";
import { ThreeAverages } from "./ThreeAverages.tsx";
import { TurnedAxes } from "./TurnedAxes.tsx";
import { TwoClocksOneFlash } from "./TwoClocksOneFlash.tsx";
import { TwoCurves } from "./TwoCurves.tsx";
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
  const id = foundationConstructionId(foundationId);
  if (id === null) return null;
  const construction = constructionFor(id, headingLevel);
  if (!CONSTRUCTIONS_WITH_CONTROLS.includes(id)) return construction;
  // Without JavaScript the controls change nothing. Measured on live at 01478983: 19 of the 22
  // constructions on lesson pages showed controls that did nothing, and none said so.
  return (
    <>
      <noscript>
        <p className="notice">
          JavaScript is off, so the controls below cannot change anything. The construction shows
          its first setting, and its closing paragraph, “What it shows, in words”, describes the
          rest.
        </p>
      </noscript>
      {construction}
    </>
  );
}

function constructionFor(id: FoundationConstructionId, headingLevel: HeadingLevel) {
  // Typed by the server-readable list (constructionIds.ts), so each case must be one of its ids
  // and a construction cannot be added here without being added there.
  switch (id) {
    case "functions-graphs":
      return <TableToPlotBuilder headingLevel={headingLevel} />;
    case "derivatives":
      // Two sections, as taylor-expansion has since dc9c979b: the curve its own sentence points at,
      // then the nudge readout that was already here. Safe in the dialog since 4bd6681a.
      return (
        <>
          <SecantsToATangent headingLevel={headingLevel} />
          <NudgeSensitivityDemo headingLevel={headingLevel} />
        </>
      );
    case "partial-derivatives":
      return <HeldFixedToggle headingLevel={headingLevel} />;
    case "exponentials":
      return <RepeatedProportionalTable headingLevel={headingLevel} />;
    case "logarithms":
      return <LogarithmProductTable headingLevel={headingLevel} />;
    case "taylor-expansion":
      // Two sections for one lesson: the square its opening sentence tells the reader to picture,
      // then the binomial extension that was already here. loadLessonBody mounts every section of
      // a lesson's dispatch since 4bd6681a, which is what makes a fragment safe in the dialog.
      return (
        <>
          <SquareAndItsCorner headingLevel={headingLevel} />
          <TaylorBinomialExtension headingLevel={headingLevel} />
        </>
      );
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
    case "dot-cross-products":
      return <ProductsView headingLevel={headingLevel} />;
    case "conservation-symmetry":
      return <DescriptionOrWorld headingLevel={headingLevel} />;
    case "two-measurements-two-unknowns":
      return <TwoCurves headingLevel={headingLevel} />;
    case "entropy-multiplicity":
      return <ConfigurationCounter headingLevel={headingLevel} />;
    case "work-energy":
      return <EnergyLedger headingLevel={headingLevel} />;
    case "entropy-temperature":
      return <EntropyTemperatureCheck headingLevel={headingLevel} />;
    case "viscosity-stokes-drag":
      return <SinkingSpheres headingLevel={headingLevel} />;
    case "temperature-thermal-energy":
      return <SpeedSpread headingLevel={headingLevel} />;
    case "free-energy-osmotic-pressure":
      return <OsmoticTable headingLevel={headingLevel} />;
    case "bridge-a-graph":
      return <ReadingAGraph headingLevel={headingLevel} />;
    case "bridge-sum-average":
      return <PourAndShare headingLevel={headingLevel} />;
    case "bridge-negative-numbers-direction":
      return <SignedRuler headingLevel={headingLevel} />;
    case "bridge-fractions-ratios":
      return <SameShareTwice headingLevel={headingLevel} />;
    case "bridge-scientific-notation-units":
      return <CountingThePlaces headingLevel={headingLevel} />;
    case "bridge-equals-sign-relationship":
      return <BalancedAccount headingLevel={headingLevel} />;
    case "bridge-probability-notation":
      return <FourOutcomes headingLevel={headingLevel} />;
    case "bridge-squaring-square-roots":
      return <FourCellsTwiceTheSide headingLevel={headingLevel} />;
    case "flux-continuity":
      return <CrossingABoundary headingLevel={headingLevel} />;
    case "diffusion-equation":
      return <PeakAndDip headingLevel={headingLevel} />;
    case "random-walks":
      return <StepsAndSpread headingLevel={headingLevel} />;
    case "gaussian-distributions":
      return <BellAndItsWidths headingLevel={headingLevel} />;
    case "distributions":
      return <HeightIsNotProbability headingLevel={headingLevel} />;
    case "integration":
      return <AddingInStrips headingLevel={headingLevel} />;
    case "frames-events":
      return <TwoClocksOneFlash headingLevel={headingLevel} />;
    case "mean-variance-rms":
      return <ThreeAverages headingLevel={headingLevel} />;
  }
}
