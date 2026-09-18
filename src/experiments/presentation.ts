/**
 * Presentation context and quantity label resolution (am-inst-registry-dispatcher-66l0).
 *
 * "The `tour` presentation, requested by am-tours-infra-g518 for in-tour steps:
 *  - hides equation cards, show-the-code, and expanded model notes;
 *  - keeps the explanatory question, the R0 caption, predict mode, the accessible
 *    table, and the execution label;
 *  - renders no visible math node in the tour step region;
 *  - speaks in quantity names: views take every caption, axis label, legend entry,
 *    and accessible-table header from the presentation context's quantityLabel(quantityId),
 *    which returns the quantity registry's plain-word name (am-not-quantity-registry-2f7);
 *  - is a presentation-change: it never changes the owner, parameters, seed,
 *    snapshot identity, or any scientific state, and switching presentation
 *    sends no worker message."
 */

import { createContext, createElement, type ReactNode, useContext } from "react";
import { getQuantity } from "../content/quantities/registry.ts";
import { BROWNIAN_QUANTITIES } from "../equations/quantities.ts";

export type Presentation = "standard" | "tour";

export interface PresentationContextValue {
  readonly presentation: Presentation;
  readonly quantityLabel: (quantityId: string) => string | undefined;
}

/**
 * In standard mode, quantityLabel returns undefined so views retain their
 * mathematical / notation-aware symbols.
 * In tour mode, it returns the plain-word name from the canonical quantity registry.
 */
export function resolveQuantityLabel(
  quantityId: string,
  presentation: Presentation,
): string | undefined {
  if (presentation !== "tour") return undefined;
  try {
    const q = getQuantity(quantityId);
    return q.name;
  } catch {
    const fallback = BROWNIAN_QUANTITIES[quantityId];
    return fallback?.name;
  }
}

export const PresentationContext = createContext<PresentationContextValue>({
  presentation: "standard",
  quantityLabel: () => undefined,
});

export function usePresentation(): PresentationContextValue {
  return useContext(PresentationContext);
}

export interface PresentationProviderProps {
  readonly presentation?: Presentation | undefined;
  readonly children: ReactNode;
}

export function PresentationProvider({
  presentation = "standard",
  children,
}: PresentationProviderProps) {
  const value: PresentationContextValue = {
    presentation,
    quantityLabel: (quantityId: string) => resolveQuantityLabel(quantityId, presentation),
  };

  return createElement(PresentationContext.Provider, { value }, children);
}
