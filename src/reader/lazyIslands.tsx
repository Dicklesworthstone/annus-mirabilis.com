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
 * fetched only when a page renders it. Measured on a build of 7b2ba7b1: the four paper routes
 * load 186,233 (SR), 177,787 (LQ), 189,088 (ME) and 180,793 (BM) bytes brotli of JavaScript
 * through hydration, lazy chunks included.
 *
 * NO SUSPENSE BOUNDARY OF ITS OWN, ON PURPOSE. 8ce94625 wrapped each island in <Suspense>, and
 * the build showed what that does: React wrote every island out of line, into
 * <div hidden id="S:0">, for a script to move into place. With JavaScript off, all four first
 * encounters were in the HTML and invisible (Playwright, JavaScript disabled: no client rects,
 * hidden ancestor S:0, 4 of 4 paper routes). Without a boundary of its own an island suspends the
 * page's shell, since nothing above <main> is a boundary (app/layout.tsx), so the export waits
 * for it and writes it inline: the same build then had no outlined segment on any of its 366
 * pages. next/dynamic does the same for ssr: true (lazy-dynamic/loadable.js renders no Suspense
 * then). The cost is on the client, where hydration waits for the page's own island chunks.
 * A <Suspense> around a call site, or in a layout above <main>, brings the hidden segments back;
 * a built page containing <div hidden id="S: is the symptom.
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
 * TESTS. renderToStaticMarkup cannot wait for a chunk. A test that needs an island's markup
 * renders the component itself, or the page through src/testing/exportMarkup.ts. That shows the
 * markup but not where Next puts it: in Bun the Suspense-wrapped islands came out inline while
 * the Next build outlined them, so only a built page shows an island is visible without script.
 */
import { type ComponentProps, lazy } from "react";
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
  return <Brownian {...props} />;
}

export function LazyClockFirstEncounter(props: ComponentProps<typeof ClockFirstEncounter>) {
  return <Clock {...props} />;
}

export function LazyLightQuantaFirstEncounter(
  props: ComponentProps<typeof LightQuantaFirstEncounter>,
) {
  return <LightQuanta {...props} />;
}

export function LazyMassEnergyFirstEncounter(
  props: ComponentProps<typeof MassEnergyFirstEncounter>,
) {
  return <MassEnergy {...props} />;
}

export function LazyLowSpeedExplorer(props: ComponentProps<typeof LowSpeedExplorer>) {
  return <LowSpeed {...props} />;
}

export function LazyLinearProofExplorer(props: ComponentProps<typeof LinearProofExplorer>) {
  return <LinearProof {...props} />;
}
