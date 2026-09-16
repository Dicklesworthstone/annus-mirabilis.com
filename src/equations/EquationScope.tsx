"use client";
import { createContext, type ReactNode, useContext, useState, useSyncExternalStore } from "react";
import type { LiveSlot } from "./live/values.ts";
import { createSelectionStore } from "./selectionStore.ts";

const Scope = createContext<Readonly<{
  store: ReturnType<typeof createSelectionStore>;
  slots: readonly LiveSlot[];
  editQuantity: ((id: string) => void) | null;
}> | null>(null);
export const useEquationScope = () => useContext(Scope);
export function EquationScope({
  children,
  slots = [],
  editQuantity = null,
}: {
  children: ReactNode;
  slots?: readonly LiveSlot[];
  editQuantity?: ((id: string) => void) | null;
}) {
  const [store] = useState(createSelectionStore),
    selected = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return (
    <Scope.Provider value={{ store, slots, editQuantity }}>
      <div
        className="equation-context"
        data-equation-context
        data-selected-quantity-id={selected?.quantityId ?? undefined}
        data-selected-node-id={selected?.nodeId ?? undefined}
      >
        {children}
      </div>
    </Scope.Provider>
  );
}
