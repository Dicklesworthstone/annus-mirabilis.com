/**
 * Derivation route chooser, filtering, and stable ordering (am-eq-derivation-renderer-9gd7).
 *
 * Implements perspective-aware route selection (historical vs modern)
 * with strict fail-fast error handling for unknown route IDs.
 */

import type { DerivationChain, RouteKind } from "./types.ts";

export const ROUTE_ORDER_RANK: Readonly<Record<RouteKind, number>> = Object.freeze({
  "source-order": 0,
  discovery: 1,
  "pedagogical-reconstruction": 2,
  "modern-verification": 3,
});

/**
 * Returns a human-facing route label appropriate for the given route kind and perspective.
 */
export function getRouteLabel(routeKind: RouteKind, perspective: string = "historical"): string {
  switch (routeKind) {
    case "source-order":
      return "Original 1905 Derivation";
    case "discovery":
      return "A route you could take (Discovery)";
    case "pedagogical-reconstruction":
      return "A route you could take (Reconstruction)";
    case "modern-verification":
      return perspective === "modern" ? "Modern Verification Oracle (Later check)" : "Later check";
    default:
      return "Alternative Derivation";
  }
}

/**
 * Returns whether a derivation chain is allowed under the given perspective.
 *
 * In historical view:
 * - Chains with routeKind 'modern-verification' are excluded.
 * - Chains containing premise edges of type 'modern-verification-oracle' are excluded.
 *
 * In modern view:
 * - All chains including 'modern-verification' are admitted and labeled.
 */
export function isChainAllowedUnderPerspective(
  chain: DerivationChain,
  perspective: string = "historical",
): boolean {
  if (perspective === "modern") {
    return true;
  }

  if (chain.routeKind === "modern-verification") {
    return false;
  }

  // Check if any step contains modern-verification-oracle edge
  for (const step of chain.steps) {
    for (const pRef of step.premiseRefs) {
      if (pRef.edgeType === "modern-verification-oracle") {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filters and stably sorts derivation chains for a given perspective.
 * Stable ordering: source-order -> discovery -> pedagogical-reconstruction -> modern-verification.
 */
export function filterRoutesForPerspective(
  chains: readonly DerivationChain[],
  perspective: string = "historical",
): readonly DerivationChain[] {
  const allowed = chains.filter((c) => isChainAllowedUnderPerspective(c, perspective));

  return Object.freeze(
    [...allowed].sort((a, b) => {
      const rankA = ROUTE_ORDER_RANK[a.routeKind] ?? 99;
      const rankB = ROUTE_ORDER_RANK[b.routeKind] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.id.localeCompare(b.id);
    }),
  );
}

/**
 * Selects an active route from a set of chains for the given perspective.
 *
 * Throws explicitly if a specific routeId is requested that does not exist
 * or is not permitted under the active perspective (never falls back silently).
 */
export function selectRoute(
  chains: readonly DerivationChain[],
  requestedRouteId?: string | undefined,
  perspective: string = "historical",
): DerivationChain {
  const available = filterRoutesForPerspective(chains, perspective);

  if (available.length === 0) {
    throw new Error(`No available derivation routes for perspective "${perspective}".`);
  }

  if (requestedRouteId !== undefined) {
    const found = available.find(
      (c) => c.id === requestedRouteId || c.proofRouteId === requestedRouteId,
    );
    if (!found) {
      throw new Error(
        `Unknown route id "${requestedRouteId}" for perspective "${perspective}". Fails explicitly; no silent fallback.`,
      );
    }
    return found;
  }

  const first = available[0];
  if (!first) {
    throw new Error(`No available derivation routes for perspective "${perspective}".`);
  }
  return first;
}
