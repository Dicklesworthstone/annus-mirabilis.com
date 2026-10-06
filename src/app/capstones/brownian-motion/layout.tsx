import type { ReactNode } from "react";
import { CapstoneWorkspace } from "../../../discovery/capstone/CapstoneWorkspace.tsx";

export default function CapstoneLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <CapstoneWorkspace paper="brownian-motion">{children}</CapstoneWorkspace>;
}
