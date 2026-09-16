import type { ReactElement } from "react";
import { formatPlaybackRate, validateRepresentationScale } from "./scale.ts";
import type { RepresentationScale } from "./types.ts";

export interface TimeLegendProps {
  readonly scale: RepresentationScale;
  readonly className?: string;
}

/**
 * Time legend display (am-inst-2d-view-kit-u75r).
 * Renders elapsed simulation time and honest playback rate badge.
 */
export function TimeLegend({ scale, className = "time-legend" }: TimeLegendProps): ReactElement {
  validateRepresentationScale(scale);

  const { value, unit, quantityId } = scale.simulatedElapsedTime;
  const rateText = formatPlaybackRate(scale.playbackMultiplier);
  const isTrueRate = scale.playbackMultiplier === 1;

  return (
    <div
      className={className}
      data-playback-multiplier={scale.playbackMultiplier}
      data-quantity-id={quantityId}
    >
      <span className="time-value">{`t = ${value.toFixed(2)} ${unit}`}</span>
      <span className={`time-rate-badge ${isTrueRate ? "is-true-rate" : "is-scaled-rate"}`}>
        {` (${rateText})`}
      </span>
    </div>
  );
}
