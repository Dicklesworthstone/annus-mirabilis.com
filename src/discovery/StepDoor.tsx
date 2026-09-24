import type { ReactNode } from "react";
import "./stepDoor.css";

/**
 * Where a step of a discovery route sends the reader to do something: an instrument, the passage
 * of the paper that makes the same move, the foundation lesson that explains it, or the route's
 * investigation.
 *
 * These were plain links in their own paragraphs, set like any link in the prose and 17 to 19px
 * tall, so a reader skimming a step could not tell that there was something to operate. A door
 * names what it opens above the words of the link, and the whole door is the target.
 *
 * The href type admits only those four destinations, so the label is total by construction: a
 * door to anywhere else does not typecheck.
 */
export type StepDoorHref =
  | `/lab/${string}`
  | `/papers/${string}`
  | `/foundations/${string}/`
  | `/discover/${string}/investigate/`;

function kindOf(href: StepDoorHref): string {
  if (href.startsWith("/lab/")) return "Instrument";
  if (href.startsWith("/papers/")) return "In the paper";
  if (href.startsWith("/foundations/")) return "Lesson";
  return "Investigation";
}

export function StepDoor({ href, children }: { href: StepDoorHref; children: ReactNode }) {
  return (
    <p className="step-door">
      <a href={href}>
        <span className="step-door-kind">{kindOf(href)}</span>
        <span className="step-door-text">{children}</span>
        <span className="step-door-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </p>
  );
}

/** One step's doors, stacked, each as wide as its own words. */
export function StepDoors({ children }: { children: ReactNode }) {
  return <div className="step-doors">{children}</div>;
}
