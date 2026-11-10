import type { ReactNode } from "react";
import { BROWNIAN_SHELF_CARDS } from "../../content/brownianShelf.ts";
import type { Stage } from "../../content/schemas/journey.ts";
import { AuthoredJourneyStage } from "../AuthoredJourneyStage.tsx";

/** Keep the existing equations, disclosures, exercises and source links beside their stage. */
export function BrownianStage({
  stage,
  children,
}: Readonly<{ stage: Stage; children?: ReactNode }>) {
  return (
    <AuthoredJourneyStage stage={stage} shelf={BROWNIAN_SHELF_CARDS} afterExplanation={children} />
  );
}
