import type { ReactNode } from "react";
import { DiscoveryInvestigationProvider } from "../../../discovery/investigation/context.tsx";
import { INVESTIGATIONS } from "../../../discovery/investigation/specs.ts";

/** Keep the existing server-rendered route inside one instance-local investigation lifetime. */
export default function DiscoveryInvestigationLayout({ children }: { children: ReactNode }) {
  return (
    <DiscoveryInvestigationProvider key="brownian-motion" spec={INVESTIGATIONS["brownian-motion"]}>
      {children}
    </DiscoveryInvestigationProvider>
  );
}
