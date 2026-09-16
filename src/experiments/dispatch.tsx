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
import type { CatalogueId } from "./catalogue.ts";
import { resolveCatalogueAddress } from "./catalogue.ts";
import type { OwnerBinding } from "./owners.ts";
import { registryEntry } from "./registry.ts";
import { InPreparationNotice } from "./states/InPreparationNotice.tsx";
import { UnknownExperimentNotice } from "./states/UnknownExperimentNotice.tsx";

export interface ExperimentViewProps {
  readonly instanceId: string;
  readonly mode: string | null;
  readonly presentation: "standard" | "tour";
}

export type ViewLoader = () => Promise<{ default: ComponentType<ExperimentViewProps> }>;
export type ViewLoaders = Readonly<Partial<Record<CatalogueId, ViewLoader>>>;

export type ExperimentDispatchState =
  | Readonly<{ kind: "unknown"; requestedId: string; reason: string }>
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
      view: ViewLoader | undefined;
      question: string | undefined;
    }>;

/** Pure resolution: no rendering, no React, so registry.test.ts can assert it without a DOM. */
export function resolveExperimentDispatch(
  rawId: string,
  viewLoaders: ViewLoaders = {},
): ExperimentDispatchState {
  const resolved = resolveCatalogueAddress(rawId);
  if ("error" in resolved) {
    return { kind: "unknown", requestedId: rawId, reason: resolved.error };
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
  };
}

export interface ExperimentDispatchProps {
  readonly id: string;
  readonly instanceId: string;
  readonly presentation?: "standard" | "tour";
  readonly viewLoaders?: ViewLoaders;
  readonly sourceHref?: string;
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
}: ExperimentDispatchProps) {
  const state = resolveExperimentDispatch(id, viewLoaders);

  if (state.kind === "unknown") {
    return <UnknownExperimentNotice requestedId={state.requestedId} sourceHref={sourceHref} />;
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
  if (!state.view) {
    // Registered (a real owner exists) but no live view has been wired
    // into this call yet. Rendered as the same in-preparation surface: a
    // reader can never tell "no manifest" from "no view module" apart, and
    // neither should show a number.
    return <InPreparationNotice id={address} question={state.question} sourceHref={sourceHref} />;
  }

  const LazyView = lazy(state.view);
  return (
    <div data-instrument-id={address}>
      <Suspense fallback={<InPreparationNotice id={address} sourceHref={sourceHref} />}>
        <LazyView instanceId={instanceId} mode={state.mode} presentation={presentation} />
      </Suspense>
    </div>
  );
}
