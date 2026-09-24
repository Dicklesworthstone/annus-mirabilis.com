"use client";
/**
 * The embedded laboratories, each in a chunk of its own.
 *
 * One route module, src/app/embed/lab/[experiment]/page.tsx, serves every embed, and Next puts
 * every client component its server graph imports into that route's first JavaScript, with
 * webpackMode "eager", even where the page renders only one. The adapter's `await import()` did
 * not split them: measured on live 211e9af4, every /embed/lab page loaded 44 scripts, 536,520
 * bytes gzip, where /lab/sr-09 loads 204 KB. React.lazy inside this client module makes each
 * laboratory an async chunk, fetched only by the embed that renders it.
 *
 * The rules are src/reader/lazyIslands.tsx's, for the same reasons: no <Suspense> of its own
 * (a boundary makes the export write the laboratory into a hidden segment, invisible without
 * JavaScript), and every stylesheet the laboratories reach is imported here, so Next links it in
 * the page's head instead of fetching it with the chunk. Tests render through
 * src/testing/exportMarkup.ts, since renderToStaticMarkup cannot wait for a chunk.
 */
import { type ComponentProps, lazy } from "react";
import type { BrownianLab } from "../../components/lab/BrownianLab.tsx";
import type { ConfigurationLab } from "../../components/lab/bm03/ConfigurationLab.tsx";
import type { CoefficientComparison } from "../../components/lab/CoefficientLab.tsx";
import type { DriftDiffusionLab } from "../../components/lab/DriftDiffusionLab.tsx";
import type { SpectrumLab } from "../../components/lab/lq03/SpectrumLab.tsx";
import type { EntropyWorkbenchLab } from "../../components/lab/lq04/EntropyWorkbenchLab.tsx";
import type { IndependentConfigurationsLab } from "../../components/lab/lq05/IndependentConfigurationsLab.tsx";
import type { CoefficientMatchEntry } from "../../components/lab/lq06/CoefficientMatchEntry.tsx";
import type { FluorescenceLab } from "../../components/lab/lq07/FluorescenceLab.tsx";
import type { PhotoelectricLab } from "../../components/lab/lq08/PhotoelectricLab.tsx";
import type { IonizationLab } from "../../components/lab/lq09/IonizationLab.tsx";
import type { MagnetConductorLab } from "../../components/lab/MagnetConductorLab.tsx";
import type { TwoLedgersLab } from "../../components/lab/me01/TwoLedgersLab.tsx";
import type { RodSimultaneityLab } from "../../components/lab/RodSimultaneityLab.tsx";
import type { ShelfOpticsLab } from "../../components/lab/shelfOptics/ShelfOpticsLab.tsx";
import type { ClockSyncLab } from "../../components/lab/sr01/ClockSyncLab.tsx";
import type { LorentzMapLab } from "../../components/lab/sr04/LorentzMapLab.tsx";
import type { FieldFrameChangeLab } from "../../components/lab/sr08/FieldFrameChangeLab.tsx";
import type { DopplerAberrationLab } from "../../components/lab/sr09/DopplerAberrationLab.tsx";
import type { LightComplexLab } from "../../components/lab/sr10/LightComplexLab.tsx";
import type { MovingMirrorLab } from "../../components/lab/sr11/MovingMirrorLab.tsx";
import type { ChargeCurrentLab } from "../../components/lab/sr12/ChargeCurrentLab.tsx";
import type { ElectronDynamicsLab } from "../../components/lab/sr13/ElectronDynamicsLab.tsx";
import type { TracerLab } from "../../components/lab/TracerLab.tsx";
import type { WaveDescriptionLab } from "../../components/lab/WaveDescriptionLab.tsx";
// The shared laboratory stylesheets first, so each laboratory's own rules come after the shell
// they refine.
import "../../components/lab/labShell.css";
import "../../components/lab/sci.css";
import "../../equations/equations.css";
import "../../experiments/labels/executionChrome.css";
import "../../components/lab/showTheCode.css";
import "../../components/lab/predict.css";
import "../../components/lab/framePair.css";
import "../../components/lab/bm03/bm03.css";
import "../../components/lab/coefficientLab.css";
import "../../components/lab/driftDiffusion.css";
import "../../components/lab/lq03/spectrum.css";
import "../../components/lab/lq05/independentConfigurationsLab.css";
import "../../components/lab/lq06/coefficientMatchLab.css";
import "../../components/lab/lq07/fluorescenceLab.css";
import "../../components/lab/lq08/photoelectricLab.css";
import "../../components/lab/lq09/ionizationLab.css";
import "../../components/lab/me01/me01.css";
import "../../components/lab/rodSimultaneityLab.css";
import "../../components/lab/sr08/sr08.css";
import "../../components/lab/sr11/sr11.css";
import "../../components/lab/sr12/sr12.css";
import "../../components/lab/sr13/sr13.css";
import "../../components/lab/waveDescriptionLab.css";

const BrownianLabChunk = lazy(() =>
  import("../../components/lab/BrownianLab.tsx").then((m) => ({ default: m.BrownianLab })),
);
const ChargeCurrentLabChunk = lazy(() =>
  import("../../components/lab/sr12/ChargeCurrentLab.tsx").then((m) => ({
    default: m.ChargeCurrentLab,
  })),
);
const ClockSyncLabChunk = lazy(() =>
  import("../../components/lab/sr01/ClockSyncLab.tsx").then((m) => ({ default: m.ClockSyncLab })),
);
const CoefficientComparisonChunk = lazy(() =>
  import("../../components/lab/CoefficientLab.tsx").then((m) => ({
    default: m.CoefficientComparison,
  })),
);
const CoefficientMatchEntryChunk = lazy(() =>
  import("../../components/lab/lq06/CoefficientMatchEntry.tsx").then((m) => ({
    default: m.CoefficientMatchEntry,
  })),
);
const ConfigurationLabChunk = lazy(() =>
  import("../../components/lab/bm03/ConfigurationLab.tsx").then((m) => ({
    default: m.ConfigurationLab,
  })),
);
const DopplerAberrationLabChunk = lazy(() =>
  import("../../components/lab/sr09/DopplerAberrationLab.tsx").then((m) => ({
    default: m.DopplerAberrationLab,
  })),
);
const DriftDiffusionLabChunk = lazy(() =>
  import("../../components/lab/DriftDiffusionLab.tsx").then((m) => ({
    default: m.DriftDiffusionLab,
  })),
);
const ElectronDynamicsLabChunk = lazy(() =>
  import("../../components/lab/sr13/ElectronDynamicsLab.tsx").then((m) => ({
    default: m.ElectronDynamicsLab,
  })),
);
const EntropyWorkbenchLabChunk = lazy(() =>
  import("../../components/lab/lq04/EntropyWorkbenchLab.tsx").then((m) => ({
    default: m.EntropyWorkbenchLab,
  })),
);
const FieldFrameChangeLabChunk = lazy(() =>
  import("../../components/lab/sr08/FieldFrameChangeLab.tsx").then((m) => ({
    default: m.FieldFrameChangeLab,
  })),
);
const FluorescenceLabChunk = lazy(() =>
  import("../../components/lab/lq07/FluorescenceLab.tsx").then((m) => ({
    default: m.FluorescenceLab,
  })),
);
const IndependentConfigurationsLabChunk = lazy(() =>
  import("../../components/lab/lq05/IndependentConfigurationsLab.tsx").then((m) => ({
    default: m.IndependentConfigurationsLab,
  })),
);
const IonizationLabChunk = lazy(() =>
  import("../../components/lab/lq09/IonizationLab.tsx").then((m) => ({ default: m.IonizationLab })),
);
const LightComplexLabChunk = lazy(() =>
  import("../../components/lab/sr10/LightComplexLab.tsx").then((m) => ({
    default: m.LightComplexLab,
  })),
);
const LorentzMapLabChunk = lazy(() =>
  import("../../components/lab/sr04/LorentzMapLab.tsx").then((m) => ({ default: m.LorentzMapLab })),
);
const MagnetConductorLabChunk = lazy(() =>
  import("../../components/lab/MagnetConductorLab.tsx").then((m) => ({
    default: m.MagnetConductorLab,
  })),
);
const MovingMirrorLabChunk = lazy(() =>
  import("../../components/lab/sr11/MovingMirrorLab.tsx").then((m) => ({
    default: m.MovingMirrorLab,
  })),
);
const PhotoelectricLabChunk = lazy(() =>
  import("../../components/lab/lq08/PhotoelectricLab.tsx").then((m) => ({
    default: m.PhotoelectricLab,
  })),
);
const RodSimultaneityLabChunk = lazy(() =>
  import("../../components/lab/RodSimultaneityLab.tsx").then((m) => ({
    default: m.RodSimultaneityLab,
  })),
);
const ShelfOpticsLabChunk = lazy(() =>
  import("../../components/lab/shelfOptics/ShelfOpticsLab.tsx").then((m) => ({
    default: m.ShelfOpticsLab,
  })),
);
const SpectrumLabChunk = lazy(() =>
  import("../../components/lab/lq03/SpectrumLab.tsx").then((m) => ({ default: m.SpectrumLab })),
);
const TracerLabChunk = lazy(() =>
  import("../../components/lab/TracerLab.tsx").then((m) => ({ default: m.TracerLab })),
);
const TwoLedgersLabChunk = lazy(() =>
  import("../../components/lab/me01/TwoLedgersLab.tsx").then((m) => ({ default: m.TwoLedgersLab })),
);
const WaveDescriptionLabChunk = lazy(() =>
  import("../../components/lab/WaveDescriptionLab.tsx").then((m) => ({
    default: m.WaveDescriptionLab,
  })),
);

export function LazyBrownianLab(props: ComponentProps<typeof BrownianLab>) {
  return <BrownianLabChunk {...props} />;
}

export function LazyChargeCurrentLab(props: ComponentProps<typeof ChargeCurrentLab>) {
  return <ChargeCurrentLabChunk {...props} />;
}

export function LazyClockSyncLab(props: ComponentProps<typeof ClockSyncLab>) {
  return <ClockSyncLabChunk {...props} />;
}

export function LazyCoefficientComparison(props: ComponentProps<typeof CoefficientComparison>) {
  return <CoefficientComparisonChunk {...props} />;
}

export function LazyCoefficientMatchEntry(props: ComponentProps<typeof CoefficientMatchEntry>) {
  return <CoefficientMatchEntryChunk {...props} />;
}

export function LazyConfigurationLab(props: ComponentProps<typeof ConfigurationLab>) {
  return <ConfigurationLabChunk {...props} />;
}

export function LazyDopplerAberrationLab(props: ComponentProps<typeof DopplerAberrationLab>) {
  return <DopplerAberrationLabChunk {...props} />;
}

export function LazyDriftDiffusionLab(props: ComponentProps<typeof DriftDiffusionLab>) {
  return <DriftDiffusionLabChunk {...props} />;
}

export function LazyElectronDynamicsLab(props: ComponentProps<typeof ElectronDynamicsLab>) {
  return <ElectronDynamicsLabChunk {...props} />;
}

export function LazyEntropyWorkbenchLab(props: ComponentProps<typeof EntropyWorkbenchLab>) {
  return <EntropyWorkbenchLabChunk {...props} />;
}

export function LazyFieldFrameChangeLab(props: ComponentProps<typeof FieldFrameChangeLab>) {
  return <FieldFrameChangeLabChunk {...props} />;
}

export function LazyFluorescenceLab(props: ComponentProps<typeof FluorescenceLab>) {
  return <FluorescenceLabChunk {...props} />;
}

export function LazyIndependentConfigurationsLab(
  props: ComponentProps<typeof IndependentConfigurationsLab>,
) {
  return <IndependentConfigurationsLabChunk {...props} />;
}

export function LazyIonizationLab(props: ComponentProps<typeof IonizationLab>) {
  return <IonizationLabChunk {...props} />;
}

export function LazyLightComplexLab(props: ComponentProps<typeof LightComplexLab>) {
  return <LightComplexLabChunk {...props} />;
}

export function LazyLorentzMapLab(props: ComponentProps<typeof LorentzMapLab>) {
  return <LorentzMapLabChunk {...props} />;
}

export function LazyMagnetConductorLab(props: ComponentProps<typeof MagnetConductorLab>) {
  return <MagnetConductorLabChunk {...props} />;
}

export function LazyMovingMirrorLab(props: ComponentProps<typeof MovingMirrorLab>) {
  return <MovingMirrorLabChunk {...props} />;
}

export function LazyPhotoelectricLab(props: ComponentProps<typeof PhotoelectricLab>) {
  return <PhotoelectricLabChunk {...props} />;
}

export function LazyRodSimultaneityLab(props: ComponentProps<typeof RodSimultaneityLab>) {
  return <RodSimultaneityLabChunk {...props} />;
}

export function LazyShelfOpticsLab(props: ComponentProps<typeof ShelfOpticsLab>) {
  return <ShelfOpticsLabChunk {...props} />;
}

export function LazySpectrumLab(props: ComponentProps<typeof SpectrumLab>) {
  return <SpectrumLabChunk {...props} />;
}

export function LazyTracerLab(props: ComponentProps<typeof TracerLab>) {
  return <TracerLabChunk {...props} />;
}

export function LazyTwoLedgersLab(props: ComponentProps<typeof TwoLedgersLab>) {
  return <TwoLedgersLabChunk {...props} />;
}

export function LazyWaveDescriptionLab(props: ComponentProps<typeof WaveDescriptionLab>) {
  return <WaveDescriptionLabChunk {...props} />;
}
