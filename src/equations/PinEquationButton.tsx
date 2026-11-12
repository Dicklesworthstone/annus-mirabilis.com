"use client";
import { useEffect, useId, useSyncExternalStore } from "react";
import { usePinnedEquations } from "../reader/layout/PinnedEquationContext.tsx";
import type { PinnedEquationStore } from "../reader/layout/pinnedEquationStore.ts";
import type { EquationScopeValue } from "./EquationScope.tsx";
import type { CompiledEquation } from "./viewTypes.ts";

export function displayedEquationForm(equation: CompiledEquation, element: HTMLElement) {
  return equation.notationForm?.state === "printed" &&
    element.closest("[data-reader-root]") &&
    element.ownerDocument.documentElement.dataset.notation !== "modern"
    ? "printed"
    : "modern";
}

export function sourceAnchorFor(element: HTMLElement): string {
  return element.closest<HTMLElement>("[data-unit][id], article[id], section[id]")?.id ?? "";
}

function AvailablePin({
  equation,
  context,
  ready,
  store,
}: {
  equation: CompiledEquation;
  context: EquationScopeValue;
  ready: boolean;
  store: PinnedEquationStore;
}) {
  const sourceId = useId();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const own = state.pinned?.sourceId === sourceId;
  useEffect(() => {
    store.updateContext(sourceId, context);
  }, [store, sourceId, context]);
  if (!ready) return null;
  return (
    <button
      type="button"
      className="secondary"
      data-pin-equation={equation.id}
      disabled={!ready}
      aria-pressed={own}
      aria-label={`${own ? "Show pinned equation" : "Pin this equation"}: ${equation.title}`}
      onClick={(event) => {
        if (own) {
          store.showPinned(true);
          return;
        }
        const source = event.currentTarget;
        store.pinEquation({
          equation,
          context,
          sourceId,
          formId: displayedEquationForm(equation, source),
          sourceAnchor: sourceAnchorFor(source),
          returnElement: source,
        });
      }}
    >
      {own ? "Show pinned equation" : "Pin this equation"}
    </button>
  );
}

/** No pin control is offered on a surface without a companion owner. */
export function PinEquationButton(props: {
  equation: CompiledEquation;
  context: EquationScopeValue;
  ready: boolean;
}) {
  const store = usePinnedEquations();
  return store ? <AvailablePin {...props} store={store} /> : null;
}
