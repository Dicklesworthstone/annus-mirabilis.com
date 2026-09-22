/**
 * Two reference frames drawn as two panels: side by side when there is room, one above
 * the other when there is not.
 *
 * Several relativity instruments drew frame K and frame k as the two halves of ONE
 * 800-unit-wide SVG. An SVG scales as a whole, so on a 390px phone that drawing shrank to
 * about 0.36 of its size and every label with it: measured on 2026-09-22, sr-09, sr-10 and
 * sr-11 rendered their labels at 4.8px. Drawn as two SVGs, each frame keeps its own
 * coordinates (a panel's viewBox simply crops the half it shows, so no geometry moves)
 * and each can take the full width when the two are stacked.
 *
 * The switch is a container query on this wrapper, not a viewport query, because the same
 * plot sits in a narrow column on a tablet and a wide one on a phone.
 */

import type { ReactNode } from "react";
import "./framePair.css";

export function FramePair({ children }: { readonly children: ReactNode }) {
  return (
    <div className="frame-pair">
      <div className="frame-pair-panels">{children}</div>
    </div>
  );
}
