/**
 * am-read-return-stack-oxa. The closed clarification-kind registry. Registering a kind is the
 * only way to add one (this bead's Considerations and Pitfalls): a feature that renders its own
 * overlay outside this registry breaks back, close-all, and the no-JavaScript path.
 *
 * This file also carries this bead's own two registrations, `instrument-view` and `term` --
 * the Technical Approach table assigns both to kinds.ts alongside the registry itself. `.ts`
 * (not `.tsx`) is kept by using `createElement` instead of JSX for the one component mount.
 */
import { createElement, type ReactNode } from "react";
import {
  type CatalogueId,
  catalogueLabel,
  parseCatalogueAddress,
  resolveCatalogueAddress,
} from "../../experiments/catalogue.ts";
import { ExperimentDispatch, type ViewLoaders } from "../../experiments/dispatch.tsx";

/**
 * `viewLoaders` is optional and specific to `instrument-view`'s render, threaded through here
 * rather than added as a second, kind-specific render entry point. No production loader map
 * exists yet (dispatch.tsx's own docblock: real view wiring is am-inst-lab-route-f8f3's scope),
 * so passing nothing here renders the dispatcher's own in-preparation surface, exactly as it does
 * for every currently-registered instrument; passing a fixture map is how
 * instrumentViewKind.integration.test.ts exercises the real dispatcher's mounted-view path.
 */
export type ClarificationRenderProps<Parsed> = Readonly<{
  parsed: Parsed;
  instanceId: string;
  viewLoaders?: ViewLoaders;
}>;

export interface ClarificationKindDefinition<Parsed = unknown> {
  readonly kind: string;
  /** Parses the id half of `kind:id` into the kind's own shape, or returns null/undefined to
   * refuse it. A refused id is never opened -- no partial state, no fallback. */
  readonly parseId: (raw: string) => Parsed | null | undefined;
  /** Mounts the clarification's content. Absent for a kind that never descends (`term`): it opens
   * inline against already-static content instead of mounting a new subtree. */
  readonly render?: ((props: ClarificationRenderProps<Parsed>) => ReactNode) | undefined;
  readonly staticHref: (parsed: Parsed) => string;
  readonly title: (parsed: Parsed) => string;
  /** False only for `term`: an ordinary open of this kind never pushes a stack frame or costs a
   * history entry. True for every other kind, including kinds this bead does not register. */
  readonly descends: boolean;
}

const registry = new Map<string, ClarificationKindDefinition<unknown>>();

/**
 * Adds `kind` to the closed registry. Registering the same kind twice throws: two beads racing
 * to own one kind name is exactly the defect this registry exists to catch, and it must fail
 * loudly in development rather than let the second registration silently win.
 */
export function registerClarificationKind<Parsed>(
  kind: string,
  definition: Omit<ClarificationKindDefinition<Parsed>, "kind">,
): void {
  if (!kind.trim()) throw new TypeError("A clarification kind needs a non-empty name.");
  if (registry.has(kind))
    throw new Error(
      `Clarification kind "${kind}" is already registered. Registering a kind is the only way to add one; each kind name is owned by exactly one bead.`,
    );
  registry.set(kind, { kind, ...definition } as ClarificationKindDefinition<unknown>);
}

export function getClarificationKind(kind: string): ClarificationKindDefinition | undefined {
  return registry.get(kind);
}

export function registeredClarificationKinds(): readonly string[] {
  return Object.freeze([...registry.keys()].sort());
}

/**
 * Test-only escape hatch. DANGEROUS in this repository's test runner: bun runs a suite's test
 * files in one shared process, so this module's top-level registrations (instrument-view, term)
 * run exactly once, the first time any file imports kinds.ts. Calling this mid-file wipes them
 * for every OTHER test file that shares the process afterward, with no way to re-run this
 * module's top-level code to restore them -- the same cross-test-pollution-via-shared-state
 * hazard BoldHarbor flagged 2026-09-16 for shared filesystem paths, just in memory instead. None
 * of this bead's own tests call it (they use additively-named test-only kinds instead, or the
 * real instrument-view/term kinds directly). Never called from production code.
 */
export function __resetClarificationKindsForTesting(): void {
  registry.clear();
}

// ---- instrument-view --------------------------------------------------------------------------
// Renders through the dispatcher (am-inst-registry-dispatcher-66l0). No second dispatcher and no
// fallback instrument here: parseId only checks address GRAMMAR (parseCatalogueAddress), never
// whether the instrument id is real, so a well-formed but unknown id still opens and lets
// ExperimentDispatch render its own explicit UnknownExperimentNotice -- exactly the acceptance
// criterion's "fails explicitly rather than showing another instrument," not a silent refusal to
// open. Only ill-formed grammar (which the kinds contract calls "an id that fails its parser") is
// refused at parseId and never opened at all.

export type InstrumentViewTarget = Readonly<{ raw: string }>;

function parseInstrumentViewId(raw: string): InstrumentViewTarget | null {
  try {
    parseCatalogueAddress(raw);
  } catch {
    return null;
  }
  return Object.freeze({ raw });
}

function instrumentViewHref(parsed: InstrumentViewTarget): string {
  const resolved = resolveCatalogueAddress(parsed.raw);
  if ("error" in resolved) return `/lab/${encodeURIComponent(parsed.raw)}`;
  return resolved.mode
    ? `/lab/${resolved.id}?mode=${encodeURIComponent(resolved.mode)}`
    : `/lab/${resolved.id}`;
}

function instrumentViewTitle(parsed: InstrumentViewTarget): string {
  const resolved = resolveCatalogueAddress(parsed.raw);
  return "error" in resolved ? parsed.raw : catalogueLabel(resolved.id as CatalogueId);
}

// ---- term ---------------------------------------------------------------------------------------
// A deep-link target only: an ordinary inline term click never pushes a frame (descends: false).
// No `render` -- the explanation is already in the static HTML of the equation card, which this
// bead does not import or render. Opening the deep link scrolls to it, sets the selection
// attribute am-eq-colorized-component-1z8 publishes, and expands the card; that side effect is
// focus.ts's job, driven by this kind's parsed { routeSlug, termId }, not a mounted subtree.

export type TermTarget = Readonly<{ routeSlug: string | null; termId: string }>;

const TERM_ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const ROUTE_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

function parseTermId(raw: string): TermTarget | null {
  const parts = raw.split("/");
  if (parts.length === 1) {
    const termId = parts[0] ?? "";
    return TERM_ID_PATTERN.test(termId) ? Object.freeze({ routeSlug: null, termId }) : null;
  }
  if (parts.length === 2) {
    const [routeSlug, termId] = parts as [string, string];
    return ROUTE_SLUG_PATTERN.test(routeSlug) && TERM_ID_PATTERN.test(termId)
      ? Object.freeze({ routeSlug, termId })
      : null;
  }
  return null;
}

function termStaticHref(parsed: TermTarget): string {
  return `#${parsed.routeSlug ? `${parsed.routeSlug}-${parsed.termId}` : parsed.termId}`;
}

function termTitle(parsed: TermTarget): string {
  return parsed.termId;
}

export function registerDefaultClarificationKinds(): void {
  if (!registry.has("instrument-view")) {
    registerClarificationKind<InstrumentViewTarget>("instrument-view", {
      parseId: parseInstrumentViewId,
      render: ({ parsed, instanceId, viewLoaders }) =>
        createElement(ExperimentDispatch, {
          id: parsed.raw,
          instanceId,
          ...(viewLoaders !== undefined ? { viewLoaders } : {}),
        }),
      staticHref: instrumentViewHref,
      title: instrumentViewTitle,
      descends: true,
    });
  }

  if (!registry.has("term")) {
    registerClarificationKind<TermTarget>("term", {
      parseId: parseTermId,
      staticHref: termStaticHref,
      title: termTitle,
      descends: false,
    });
  }
}

registerDefaultClarificationKinds();
