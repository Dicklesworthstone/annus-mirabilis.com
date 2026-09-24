"use client";
/**
 * The paper pages' client islands, each in a chunk of its own.
 *
 * WHY. One route module, src/app/papers/[paper]/page.tsx, renders all four papers, and Next
 * puts every client component that module's server graph imports into the route's first
 * JavaScript whether or not the page renders it: next-flight-client-entry-loader imports each
 * one with webpackMode "eager". So every paper page downloaded every paper's first encounter,
 * both mass-energy explorers and all six foundation constructions. Measured on live on
 * 2026-09-23, each of the four paper routes loaded the same 20 scripts, 232,912 bytes brotli
 * without the nomodule polyfills, against the 204,800-byte initial-route budget. One chunk,
 * 34,925 bytes, held the clock, light-quanta and mass-energy entrances and both explorers.
 *
 * HOW. A component imported through React.lazy from a client module becomes an async chunk,
 * fetched only when a page renders it. The server still renders every island in full: the
 * static export waits for all Suspense boundaries (continueFizzStream awaits allReady), and
 * React then writes a finished boundary in place, so a reader without JavaScript gets the same
 * HTML. On the client each island has its own Suspense boundary, so hydration keeps the
 * server's HTML until that island's chunk arrives and the rest of the page does not wait for it.
 *
 * CSS STAYS IN THE PAGE'S HEAD. A stylesheet imported only inside a lazy chunk is fetched with
 * that chunk, by script: a reader without JavaScript would get the island's markup unstyled, and
 * everyone else would see it unstyled until the chunk arrived. So this module, which the page
 * imports eagerly, imports each island's stylesheet itself; Next then links it in the page's head
 * as before. The islands keep their own imports so each stays whole on its own.
 *
 * The foundation constructions have their own wrapper (LazyFoundationConstruction.tsx) so that a
 * foundation page, which renders one, does not take on the entrances' stylesheets.
 *
 * TESTS. renderToStaticMarkup cannot wait for a chunk: on a cold module it renders the fallback,
 * which is nothing. A test that needs an island's markup renders the component itself, or
 * renders the page the way the export does, with renderToReadableStream and allReady.
 */
import { type ComponentProps, lazy, Suspense } from "react";
import type { LinearProofExplorer } from "../equations/derivations/LinearProofExplorer.tsx";
import type { LowSpeedExplorer } from "../equations/derivations/LowSpeedExplorer.tsx";
import type { BrownianFirstEncounter } from "./entrances/BrownianFirstEncounter.tsx";
import type { ClockFirstEncounter } from "./entrances/ClockFirstEncounter.tsx";
import type { LightQuantaFirstEncounter } from "./entrances/LightQuantaFirstEncounter.tsx";
import type { MassEnergyFirstEncounter } from "./entrances/MassEnergyFirstEncounter.tsx";
import "./entrances/countingEntrance.css";
import "./entrances/massEnergyEntrance.css";
import "../equations/derivations/linearProof.css";

const Brownian = lazy(() =>
  import("./entrances/BrownianFirstEncounter.tsx").then((m) => ({
    default: m.BrownianFirstEncounter,
  })),
);
const Clock = lazy(() =>
  import("./entrances/ClockFirstEncounter.tsx").then((m) => ({ default: m.ClockFirstEncounter })),
);
const LightQuanta = lazy(() =>
  import("./entrances/LightQuantaFirstEncounter.tsx").then((m) => ({
    default: m.LightQuantaFirstEncounter,
  })),
);
const MassEnergy = lazy(() =>
  import("./entrances/MassEnergyFirstEncounter.tsx").then((m) => ({
    default: m.MassEnergyFirstEncounter,
  })),
);
const LowSpeed = lazy(() =>
  import("../equations/derivations/LowSpeedExplorer.tsx").then((m) => ({
    default: m.LowSpeedExplorer,
  })),
);
const LinearProof = lazy(() =>
  import("../equations/derivations/LinearProofExplorer.tsx").then((m) => ({
    default: m.LinearProofExplorer,
  })),
);

export function LazyBrownianFirstEncounter(props: ComponentProps<typeof BrownianFirstEncounter>) {
  return (
    <Suspense fallback={null}>
      <Brownian {...props} />
    </Suspense>
  );
}

export function LazyClockFirstEncounter(props: ComponentProps<typeof ClockFirstEncounter>) {
  return (
    <Suspense fallback={null}>
      <Clock {...props} />
    </Suspense>
  );
}

export function LazyLightQuantaFirstEncounter(
  props: ComponentProps<typeof LightQuantaFirstEncounter>,
) {
  return (
    <Suspense fallback={null}>
      <LightQuanta {...props} />
    </Suspense>
  );
}

export function LazyMassEnergyFirstEncounter(
  props: ComponentProps<typeof MassEnergyFirstEncounter>,
) {
  return (
    <Suspense fallback={null}>
      <MassEnergy {...props} />
    </Suspense>
  );
}

export function LazyLowSpeedExplorer(props: ComponentProps<typeof LowSpeedExplorer>) {
  return (
    <Suspense fallback={null}>
      <LowSpeed {...props} />
    </Suspense>
  );
}

export function LazyLinearProofExplorer(props: ComponentProps<typeof LinearProofExplorer>) {
  return (
    <Suspense fallback={null}>
      <LinearProof {...props} />
    </Suspense>
  );
}
