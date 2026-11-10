import type { ReactNode } from "react";
import { MASS_ENERGY_SHELF_CARDS } from "../../content/massEnergyShelf.ts";
import type { Stage } from "../../content/schemas/journey.ts";
import { AuthoredJourneyStage } from "../AuthoredJourneyStage.tsx";

/** Mass-energy keeps its original formula and exercise slots on the shared stage renderer. */
export function MassEnergyStage({
  stage,
  afterFirstParagraph,
  children,
}: Readonly<{
  stage: Stage;
  afterFirstParagraph?: ReactNode;
  children?: ReactNode;
}>) {
  return (
    <AuthoredJourneyStage
      stage={stage}
      shelf={MASS_ENERGY_SHELF_CARDS}
      afterFirstParagraph={afterFirstParagraph}
    >
      {children}
    </AuthoredJourneyStage>
  );
}
