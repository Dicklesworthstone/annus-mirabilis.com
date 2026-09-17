import type { ReactNode } from "react";

export function StickyLabRegion({ children }: { children: ReactNode }) {
  return (
    <div data-sticky-lab="" className="reader-sticky-lab">
      {children}
    </div>
  );
}
