"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  createInvestigationStore,
  type InvestigationChange,
  type InvestigationSource,
  type InvestigationSpec,
  type InvestigationStore,
} from "./core.ts";
import { createInvestigationPersistence, type InvestigationKeepResult } from "./persistence.ts";

const InvestigationContext = createContext<InvestigationStore | null>(null);

/** What happened to the reader's copy on this device, in the words the workspace will use. */
export type InvestigationKeepStatus =
  | "idle"
  | "kept"
  | "restored"
  | "unavailable"
  | "quota"
  | "unreadable"
  | "protected"
  | "conflict";

const KeepStatusContext = createContext<InvestigationKeepStatus>("idle");

function keepStatus(result: InvestigationKeepResult): InvestigationKeepStatus {
  return result === "saved" ? "kept" : result === "unregistered" ? "unavailable" : result;
}

/** One private teaching lifetime per route. Children remain the existing server-rendered edition. */
export function DiscoveryInvestigationProvider({
  spec,
  children,
}: {
  spec: InvestigationSpec;
  children: ReactNode;
}) {
  const [core] = useState(() => createInvestigationStore(spec));
  const [keep, setKeep] = useState<InvestigationKeepStatus>("idle");
  const persistence = useRef<ReturnType<typeof createInvestigationPersistence> | null>(null);
  const [store] = useState<InvestigationStore>(() =>
    Object.freeze({
      ...core,
      restartConfirmed(): InvestigationChange {
        // Check before core clears the report. Checking from its subscriber would be too late
        // to preserve this tab's readings and download when the saved copy changed elsewhere.
        const cleared = persistence.current?.clear() ?? "unavailable";
        if (cleared === "session-only") {
          const restarted = core.restartConfirmed();
          if (!restarted.ok) return restarted;
          setKeep("unavailable");
          return {
            ok: true,
            message:
              "New investigation on this page. Storage is unavailable, so no saved copy was cleared. The laboratory itself is unchanged.",
          };
        }
        if (cleared !== "cleared") {
          setKeep(keepStatus(cleared));
          return {
            ok: false,
            message:
              cleared === "conflict"
                ? "The saved investigation changed in another tab or was cleared. This investigation and your typed explanation remain here. Download this tab before reloading to open the saved version."
                : cleared === "protected"
                  ? "The saved original is protected because it could not be opened safely. This investigation and your typed explanation remain here; download them before leaving."
                  : "The saved investigation could not be cleared because storage is unavailable. This investigation and your typed explanation remain here; download them before leaving.",
          };
        }
        return core.restartConfirmed();
      },
    }),
  );
  /**
   * Storage is touched here and nowhere on the store's path, which is what keeps `core.ts` free of
   * it. The effect, never render: a static export prerenders this component, and `readRaw` reads
   * `window.localStorage`.
   *
   * The subscription is registered AFTER the restore on purpose, so putting a kept investigation
   * back does not immediately write it out again.
   */
  useEffect(() => {
    if (!persistence.current) persistence.current = createInvestigationPersistence(spec.paper);
    const saved = persistence.current;
    const read = saved.initial;
    let last = store.getSnapshot().report;
    if (read.status === "ok" && read.report && !last) {
      if (store.restore(read.report).ok) {
        last = store.getSnapshot().report;
        setKeep("restored");
      } else {
        saved.protectOriginal();
        setKeep("protected");
      }
    } else if (read.status === "unreadable")
      setKeep(saved.check() === "protected" ? "protected" : "unreadable");
    else if (read.status === "unavailable") setKeep("unavailable");
    const unsubscribe = store.subscribe(() => {
      const report = store.getSnapshot().report;
      if (report === last) return;
      last = report;
      if (!report) {
        setKeep("idle");
        return;
      }
      setKeep(keepStatus(saved.save(report)));
    });
    function changed(event: StorageEvent) {
      if (event.key !== null && event.key !== saved.key) return;
      const status = saved.check();
      if (status !== "current") setKeep(status);
    }
    window.addEventListener("storage", changed);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", changed);
    };
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
