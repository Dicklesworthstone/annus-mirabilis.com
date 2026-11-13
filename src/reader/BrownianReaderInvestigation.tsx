import type { ReactNode } from "react";
import { PPE_TASK } from "../discovery/brownian/journeyII.ts";
import { DiscoveryInvestigationProvider } from "../discovery/investigation/context.tsx";
import { INVESTIGATIONS } from "../discovery/investigation/specs.ts";
import { PpeTask } from "../discovery/PpeTask.tsx";

/** The chapter and Discover share the authored task and the existing private investigation. */
export function BrownianReaderInvestigation({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return active ? (
    <DiscoveryInvestigationProvider spec={INVESTIGATIONS["brownian-motion"]}>
      {children}
    </DiscoveryInvestigationProvider>
  ) : (
    children
  );
}

/** Placed after the final passage of §5; this is the journey's record, never a copied prompt. */
export function BrownianChapterPractice() {
  return (
    <>
      <PpeTask task={PPE_TASK} />
      <p className="fine">
        <a href={`#${INVESTIGATIONS["brownian-motion"].laboratoryAnchor}`}>
          Open the tracer ensemble in this reading
        </a>{" "}
        to try the change. Your saved investigation also opens in{" "}
        <a href={`/discover/brownian-motion/#${PPE_TASK.promptId}`}>the discovery journey</a> and{" "}
        <a href="/notebook/">your notebook</a>.
      </p>
    </>
  );
}
