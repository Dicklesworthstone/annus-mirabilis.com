"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createInvestigationStore,
  type InvestigationSource,
  type InvestigationSpec,
  type InvestigationStore,
} from "./core.ts";

const InvestigationContext = createContext<InvestigationStore | null>(null);

/** One private teaching lifetime per route. Children remain the existing server-rendered edition. */
export function DiscoveryInvestigationProvider({
  spec,
  children,
}: {
  spec: InvestigationSpec;
  children: ReactNode;
}) {
  const [store] = useState(() => createInvestigationStore(spec));
  return <InvestigationContext.Provider value={store}>{children}</InvestigationContext.Provider>;
}
export const useDiscoveryInvestigation = () => useContext(InvestigationContext);

/** Connect to the lab's actual session, not a formatted DOM reading or a second evaluator. */
export function useInvestigationWitness(
  experimentId: string,
  session: InvestigationSource,
  sourceDigest: string,
): void {
  const store = useDiscoveryInvestigation();
  useEffect(() => {
    if (!store || store.spec.experimentId !== experimentId) return;
    return store.connect(session, sourceDigest);
  }, [store, experimentId, session, sourceDigest]);
}

/** A same-page round trip between the existing controls and the reader's private investigation. */
export function InvestigationLabLink({ experimentId }: { experimentId: string }) {
  const store = useDiscoveryInvestigation();
  if (!store || store.spec.experimentId !== experimentId) return null;
  return (
    <p id={store.spec.laboratoryAnchor} className="fine">
      <a href={`#${store.spec.promptId}`}>
        Record a prediction and compare this laboratory's accepted readings
      </a>
    </p>
  );
}
