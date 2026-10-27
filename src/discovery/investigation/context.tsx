"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { createStorageContext } from "../../platform/storage/store.ts";
import {
  createInvestigationStore,
  type InvestigationSource,
  type InvestigationSpec,
  type InvestigationStore,
} from "./core.ts";
import {
  clearStoredInvestigation,
  readStoredInvestigation,
  saveStoredInvestigation,
} from "./persistence.ts";

const InvestigationContext = createContext<InvestigationStore | null>(null);

/** What happened to the reader's copy on this device, in the words the workspace will use. */
export type InvestigationKeepStatus =
  | "idle"
  | "kept"
  | "restored"
  | "unavailable"
  | "quota"
  | "unreadable";

const KeepStatusContext = createContext<InvestigationKeepStatus>("idle");

/** One private teaching lifetime per route. Children remain the existing server-rendered edition. */
export function DiscoveryInvestigationProvider({
  spec,
  children,
}: {
  spec: InvestigationSpec;
  children: ReactNode;
}) {
  const [store] = useState(() => createInvestigationStore(spec));
  const [keep, setKeep] = useState<InvestigationKeepStatus>("idle");
  /**
   * Storage is touched here and nowhere on the store's path, which is what keeps `core.ts` free of
   * it. The effect, never render: a static export prerenders this component, and `readRaw` reads
   * `window.localStorage`.
   *
   * The subscription is registered AFTER the restore on purpose, so putting a kept investigation
   * back does not immediately write it out again.
   */
  useEffect(() => {
    const context = createStorageContext();
    const read = readStoredInvestigation(spec.paper, context);
    let last = store.getSnapshot().report;
    if (read.status === "ok" && read.report) {
      if (store.restore(read.report).ok) {
        last = store.getSnapshot().report;
        setKeep("restored");
      }
    } else if (read.status === "unreadable") setKeep("unreadable");
    else if (read.status === "unavailable") setKeep("unavailable");
    return store.subscribe(() => {
      const report = store.getSnapshot().report;
      if (report === last) return;
      last = report;
      if (!report) {
        clearStoredInvestigation(spec.paper, context);
        setKeep("idle");
        return;
      }
      const status = saveStoredInvestigation(spec.paper, report, context);
      setKeep(status === "saved" ? "kept" : status === "quota" ? "quota" : "unavailable");
    });
  }, [store, spec.paper]);
  return (
    <InvestigationContext.Provider value={store}>
      <KeepStatusContext.Provider value={keep}>{children}</KeepStatusContext.Provider>
    </InvestigationContext.Provider>
  );
}
export const useDiscoveryInvestigation = () => useContext(InvestigationContext);
export const useInvestigationKeepStatus = () => useContext(KeepStatusContext);

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
