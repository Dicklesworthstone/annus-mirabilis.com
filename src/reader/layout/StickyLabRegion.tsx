import type { ReactNode } from "react";
import { ReadingOnlyKeepContent } from "../../a11y/readingSettings/KeepContent.tsx";

/**
 * The laboratory region always keeps the explanation and the static worked
 * case in the served markup (am-a11y-reading-only-6wwd). Reading-only must
 * not remove this region's headings, explanations, or worked case.
 */
export function StickyLabRegion({ children }: { children: ReactNode }) {
  return (
    <div data-sticky-lab="" className="reader-sticky-lab">
      <ReadingOnlyKeepContent
        explanation="Einstein's displacement argument: the typical distance grows with the square root of time, not with time itself. Every explanation stays on the page when reading-only is on."
        workedCase="For radius 0.5 μm, viscosity 1.35×10⁻³ Pa·s, and T = 290.15 K, the RMS displacement is about 0.8 μm in one second. This static worked case stays in the markup; loading the live ensemble does not replace it."
      />
      {children}
    </div>
  );
}
