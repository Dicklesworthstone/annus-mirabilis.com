"use client";
import { createContext, type ReactNode, useContext, useState, useSyncExternalStore } from "react";
import type { LiveSlot } from "./live/values.ts";
import { createSelectionStore } from "./selectionStore.ts";

const Scope = createContext<Readonly<{
  store: ReturnType<typeof createSelectionStore>;
  slots: readonly LiveSlot[];
  editQuantity: ((id: string) => void) | null;
  scope?: string | undefined;
  scopeLabel?: string | undefined;
  /** Lesson titles by foundation id, so a prerequisite link can say which lesson it opens. */
  lessonTitles?: Readonly<Record<string, string>> | undefined;
}> | null>(null);
export const useEquationScope = () => useContext(Scope);
export function EquationScope({
  children,
  slots = [],
  editQuantity = null,
  scope,
  scopeLabel,
  lessonTitles,
}: {
  children: ReactNode;
  slots?: readonly LiveSlot[];
  editQuantity?: ((id: string) => void) | null;
  scope?: string | undefined;
  scopeLabel?: string | undefined;
  lessonTitles?: Readonly<Record<string, string>> | undefined;
}) {
  const [store] = useState(createSelectionStore),
    selected = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return (
    <Scope.Provider value={{ store, slots, editQuantity, scope, scopeLabel, lessonTitles }}>
      <div
        className="equation-context"
        data-equation-context
        data-equation-scope={scope ?? undefined}
        data-selected-quantity-id={selected?.quantityId ?? undefined}
        data-selected-node-id={selected?.nodeId ?? undefined}
      >
        {children}
      </div>
    </Scope.Provider>
  );
}
