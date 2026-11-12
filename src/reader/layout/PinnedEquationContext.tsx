"use client";
import { createContext, type ReactNode, useContext, useState } from "react";
import { createPinnedEquationStore, type PinnedEquationStore } from "./pinnedEquationStore.ts";

const Pins = createContext<PinnedEquationStore | null>(null);
export const usePinnedEquations = () => useContext(Pins);

/** A client context can surround server-rendered passages without importing their content. */
export function PinnedEquationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPinnedEquationStore);
  return <Pins.Provider value={store}>{children}</Pins.Provider>;
}
