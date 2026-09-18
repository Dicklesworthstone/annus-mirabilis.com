/**
 * The dispatcher (am-inst-registry-dispatcher-66l0): resolves a requested
 * address to exactly one of three states and renders accordingly. There is
 * no default case and no fallback instrument — the donor bug this project
 * replaces ("Unknown experiment ids fail explicitly instead of showing a
 * plausible wrong model", AGENTS.md).
 *
 * View loading is dependency-injected (`ViewLoaders`), not a hard-coded
 * global map: no live, store-subscribing view component exists yet for any
 * real instrument (the five registered ids currently render through
 * pre-generated static `*Comparison` components in `src/components/lab/`,
 * a different, static-example rendering path owned by the existing
 * `/lab/bm-0N` routes, not by this dispatcher). Real view wiring is
 * `am-inst-lab-route-f8f3`'s scope. Until then, this module's own
 * correctness is proven with fixture loaders, exactly as this bead's Test
 * Plan specifies ("dispatch.test.tsx, using a compiled fixture manifest").
 *
 * `React.lazy` code-splits its loader the same way `next/dynamic` does,
 * but runs during SSR unless the caller also skips server rendering; the
 * bead requires `ssr: false` for Canvas/WebGL views specifically, which
 * only `next/dynamic` (a Next.js API) can express. Real integration must
 * wrap loaders destined for such views in `next/dynamic({ ssr: false })`
 * rather than passing them to this dispatcher directly with `React.lazy`
 * semantics assumed; that decision belongs to the caller that owns the
 * real views, not to this generic module.
 */

import { type ComponentType, lazy, Suspense } from "react";
import { ReadingOnlyKeepContent } from "../a11y/readingSettings/KeepContent.tsx";
import { ReadingOnlyView } from "../a11y/readingSettings/ReadingOnlyView.tsx";
import type { CatalogueAddressErrorCode, CatalogueId } from "./catalogue.ts";
import { resolveCatalogueAddress } from "./catalogue.ts";
import type { OwnerBinding } from "./owners.ts";
import { type Presentation, PresentationProvider } from "./presentation.ts";
import { registryEntry } from "./registry.ts";
import { AvailableInFullReadingNotice } from "./states/AvailableInFullReadingNotice.tsx";
import { InPreparationNotice } from "./states/InPreparationNotice.tsx";
import { UnknownExperimentNotice } from "./states/UnknownExperimentNotice.tsx";

export interface ExperimentViewProps {
  readonly instanceId: string;
  readonly mode: string | null;
  readonly presentation: Presentation;
}

export type ViewLoader = () => Promise<{ default: ComponentType<ExperimentViewProps> }>;

export interface ViewModeLoaders {
  readonly webgl?: ViewLoader | undefined;
  readonly fallback2d?: ViewLoader | undefined;
}

export type ViewLoaderEntry = ViewLoader | ViewModeLoaders;
export type ViewLoaders = Readonly<Partial<Record<CatalogueId, ViewLoaderEntry>>>;

export type ExperimentDispatchState =
  | Readonly<{
      kind: "unknown";
      requestedId: string;
      reason: string;
      refusalCode: CatalogueAddressErrorCode;
    }>
  | Readonly<{
      kind: "in-preparation";
      id: CatalogueId;
      mode: string | null;
      question: string | undefined;
    }>
  | Readonly<{
      kind: "registered";
      id: CatalogueId;
      mode: string | null;
      owner: OwnerBinding;
      view: ViewLoaderEntry | undefined;
      question: string | undefined;
      cannotHonorTour?: boolean | undefined;
    }>;

function checkWebGlContext(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

/** Pure resolution: no rendering, no React, so registry.test.ts can assert it without a DOM. */
export function resolveExperimentDispatch(
  rawId: string,
  viewLoaders: ViewLoaders = {},
): ExperimentDispatchState {
  const resolved = resolveCatalogueAddress(rawId);
  if ("error" in resolved) {
    return {
      kind: "unknown",
      requestedId: rawId,
      reason: resolved.error,
      refusalCode: resolved.code,
    };
  }
  const entry = registryEntry(resolved.id);
  if (entry.status === "in-preparation") {
    return { kind: "in-preparation", id: entry.id, mode: resolved.mode, question: entry.question };
  }
  if (!entry.owner) {
    // registry.ts's buildEntry already throws MissingOwnerError for a
    // registered id with no binding, so REGISTRY can never actually hold
    // this shape; this is a typed-unreachable guard, not a real branch.
    throw new Error(`Unreachable: registered id ${entry.id} has no owner binding.`);
  }
  return {
    kind: "registered",
    id: entry.id,
    mode: resolved.mode,
    owner: entry.owner,
    view: viewLoaders[entry.id],
    question: entry.question,
    cannotHonorTour: entry.cannotHonorTour,
  };
}

export interface ExperimentDispatchProps {
  readonly id: string;
  readonly instanceId: string;
  readonly presentation?: Presentation | undefined;
  readonly viewLoaders?: ViewLoaders | undefined;
  readonly sourceHref?: string | undefined;
  /** When true, the live view waits for "Load this experiment". Static case stays. */
  readonly readingOnly?: boolean | undefined;
  /** When true, device is unsupported (e.g. worker failed, bound exceeded). */
  readonly unavailable?: boolean | undefined;
  /** Injected WebGL availability override for testing/emulation. */
  readonly hasWebGl?: boolean | undefined;
  /** Callback when WebGL is unavailable and a 2D fallback is chosen. */
  readonly onLog?: ((event: string, detail?: unknown) => void) | undefined;
  /** Callback when environment is unsupported (e.g. only WebGL declared but missing). */
  readonly onEnvironmentUnsupported?: ((detail: string) => void) | undefined;
  /** Injected declaration that instrument cannot honor tour presentation. */
  readonly cannotHonorTour?: boolean | undefined;
}

/**
 * `data-instrument-id` carries the mounted address exactly: the catalogue
 * id for the default mode, or the mode address when a registered mode is
 * mounted (requirement "The root's address"). It is never written for the
 * unknown state, which has no valid address to report.
 */
export function ExperimentDispatch({
  id,
  instanceId,
  presentation = "standard",
  viewLoaders = {},
  sourceHref,
  readingOnly,
  unavailable,
  hasWebGl,
  onLog,
  onEnvironmentUnsupported,
  cannotHonorTour: cannotHonorTourProp,
}: ExperimentDispatchProps) {
  const state = resolveExperimentDispatch(id, viewLoaders);

  if (state.kind === "unknown") {
    return (
      <UnknownExperimentNotice
        requestedId={state.requestedId}
        refusalCode={state.refusalCode}
        sourceHref={sourceHref}
      />
    );
  }

  if (state.kind === "in-preparation") {
    return (
      <InPreparationNotice
        id={state.mode ? `${state.id}:${state.mode}` : state.id}
        question={state.question}
        sourceHref={sourceHref}
      />
    );
  }

  const address = state.mode ? `${state.id}:${state.mode}` : state.id;

  // Unavailable on device (requirement: static worked example, no view loaded, no worker messages)
  if (unavailable) {
    return (
      <div data-instrument-id={address} data-execution-label="unavailable">
        <ReadingOnlyKeepContent
          explanation={
            state.question ??
            "This instrument answers a stated question with an owned, tested response."
          }
          workedCase="The static worked case stays in the page when reading-only is on. Loading the experiment does not remove it."
        />
      </div>
    );
  }

  // Tour presentation compatibility check
  const cannotHonor = cannotHonorTourProp ?? state.cannotHonorTour ?? false;
  if (presentation === "tour" && cannotHonor) {
    return <AvailableInFullReadingNotice id={address} sourceHref={sourceHref} />;
  }

  if (!state.view) {
    // Registered (a real owner exists) but no live view has been wired
    // into this call yet. Rendered as the same in-preparation surface: a
    // reader can never tell "no manifest" from "no view module" apart, and
    // neither should show a number.
    return <InPreparationNotice id={address} question={state.question} sourceHref={sourceHref} />;
  }

  // Resolve view loader (direct ViewLoader or WebGL/2D mode structure)
  let activeLoader: ViewLoader | undefined;
  if (typeof state.view === "function") {
    activeLoader = state.view;
  } else {
    const webGlAvailable = hasWebGl ?? checkWebGlContext();
    if (webGlAvailable && state.view.webgl) {
      activeLoader = state.view.webgl;
    } else if (!webGlAvailable && state.view.fallback2d) {
      onLog?.("webgl-unavailable");
      activeLoader = state.view.fallback2d;
    } else if (!webGlAvailable && state.view.webgl && !state.view.fallback2d) {
      // Missing WebGL context and mode declares only WebGL view
      onEnvironmentUnsupported?.("webgl-unavailable");
      return (
        <div data-instrument-id={address} data-execution-label="unavailable">
          <ReadingOnlyKeepContent
            explanation={
              state.question ??
              "This instrument answers a stated question with an owned, tested response."
            }
            workedCase="The static worked case stays in the page when reading-only is on. Loading the experiment does not remove it."
          />
        </div>
      );
    } else {
      activeLoader = state.view.fallback2d ?? state.view.webgl;
    }
  }

  if (!activeLoader) {
    return <InPreparationNotice id={address} question={state.question} sourceHref={sourceHref} />;
  }

  const LazyView = lazy(activeLoader);
  return (
    <div data-instrument-id={address}>
      <ReadingOnlyKeepContent
        explanation={
          state.question ??
          "This instrument answers a stated question with an owned, tested response."
        }
        workedCase="The static worked case stays in the page when reading-only is on. Loading the experiment does not remove it."
      />
      <ReadingOnlyView {...(readingOnly !== undefined ? { readingOnly } : {})}>
        <PresentationProvider presentation={presentation}>
          <Suspense fallback={<InPreparationNotice id={address} sourceHref={sourceHref} />}>
            <LazyView instanceId={instanceId} mode={state.mode} presentation={presentation} />
          </Suspense>
        </PresentationProvider>
      </ReadingOnlyView>
    </div>
  );
}
