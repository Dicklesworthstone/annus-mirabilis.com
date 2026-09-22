import type { ReactNode } from "react";
import "./detail.css";

export type CaptionReadingSet = Readonly<{
  r0: string;
  r1: string;
  r2: string;
  r3: string;
  r3Citations?: readonly string[];
}>;

export type CaptionReadingUnitProps = Readonly<{
  id: string;
  readings: CaptionReadingSet;
  title?: string;
  children?: ReactNode;
}>;

/**
 * am-read-detail-axis-sfc. Renders an instrument caption unit with the four-reading
 * structure matching paragraph and equation reading units:
 * - container carrying id and data-unit={id}
 * - R0 (data-reading="0", hidden)
 * - R1 (data-reading="1", visible by default)
 * - R2 (data-reading="2", hidden)
 * - R3 (data-reading="3", hidden, modern margin)
 */
export function CaptionReadingUnit({ id, readings, title, children }: CaptionReadingUnitProps) {
  return (
    <figure id={id} data-unit={id} className="caption-reading-unit">
      {children}
      {title ? <figcaption className="caption-title">{title}</figcaption> : null}
      <div data-reading="0" hidden className="reading-version">
        <p>{readings.r0}</p>
      </div>
      <div data-reading="1" className="reading-version">
        <p>{readings.r1}</p>
      </div>
      <div data-reading="2" hidden className="reading-version">
        <p>{readings.r2}</p>
      </div>
      <aside className="modern-margin callout-limit" data-reading="3" hidden>
        <p>{readings.r3}</p>
      </aside>
    </figure>
  );
}
