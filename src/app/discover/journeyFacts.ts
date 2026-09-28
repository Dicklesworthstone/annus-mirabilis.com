/**
 * WHAT THE DOOR TO THE JOURNEYS KNOWS, READ FROM EACH JOURNEY'S OWN RECORD (dispatch 395).
 *
 * /discover/ is 3,849 characters in front of 231,484, and the four things a reader choosing among
 * reconstructions wants are all authored already, on the journey modules themselves:
 *
 *   - NAGGING_FACT, "the observation or contradiction that does not fit" (AGENTS.md's own name for
 *     it). It is the reason to read THIS journey rather than another, and it is the single most
 *     useful sentence the index can carry.
 *   - FIRST_HONEST_QUESTION, one sentence, second person.
 *   - DOORS, which carries `frontDoor` and `sideDoors`. AGENTS.md requires each journey to have a
 *     front door and at least one side door "that arrives at the same equation, and the site says
 *     so"; the records carry both, so the index can say how many side doors a journey has and
 *     that they arrive at the same result.
 *   - The forks, one exported record each, each with its own question.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT EXPOSE: the MOVE. Every journey names "the one
 * non-obvious step" and printing it on the index would spoil the thing the journey exists to walk
 * a reader up to. The index says a journey HAS a marked move and never which step it is. There is
 * no `move` field below, so the page cannot render one by accident.
 *
 * NOTHING HERE RANKS THE JOURNEYS. No difficulty, no level, no sort key; the order is the order
 * ROUTE_INDEX already holds, which is the order Annalen received the papers.
 */
import {
  DOORS as BM_DOORS,
  NAGGING_FACT as BM_FACT,
  FIRST_HONEST_QUESTION as BM_Q,
  FORK_EXNER,
  FORK_NAEGELI,
} from "../../discovery/brownian/journeyII.ts";
import {
  FORK_ENTROPY_ACCOUNT,
  FORK_ONE_LUMP,
  DOORS as LQ_DOORS,
  NAGGING_FACT as LQ_FACT,
  FIRST_HONEST_QUESTION as LQ_Q,
} from "../../discovery/lightQuanta/journeyI.ts";
import {
  FORK_FIELD_MASS,
  FORK_POINCARE,
  DOORS as ME_DOORS,
  NAGGING_FACT as ME_FACT,
  FIRST_HONEST_QUESTION as ME_Q,
} from "../../discovery/massEnergy/journeyIV.ts";
import {
  FORK_SOURCE_SPEED,
  FORK_UNDETECTED_ETHER,
  DOORS as SR_DOORS,
  NAGGING_FACT as SR_FACT,
  FIRST_HONEST_QUESTION as SR_Q,
} from "../../discovery/relativity/journeyIII.ts";

export type JourneyFacts = Readonly<{
  slug: string;
  /** The observation or contradiction that does not fit. */
  naggingFact: string;
  /** One sentence, second person. */
  firstQuestion: string;
  /** How many alternatives the route works far enough to show where they lead. */
  forks: number;
  /** Routes to the same result that are not the paper's own argument. */
  sideDoors: number;
  /** What the front door and the side doors both arrive at, in the journey's own words. */
  arrivesAt: string;
  /** The passage in the paper the route's own argument ends in. */
  frontDoorHref: string;
}>;

type Doors = Readonly<{
  frontDoor: Readonly<{ arrivesAtLabel: string; href: string }>;
  sideDoors: readonly unknown[];
}>;

function facts(
  slug: string,
  naggingFact: string,
  firstQuestion: string,
  forks: readonly unknown[],
  doors: Doors,
): JourneyFacts {
  return {
    slug,
    naggingFact,
    firstQuestion,
    forks: forks.length,
    sideDoors: doors.sideDoors.length,
    arrivesAt: doors.frontDoor.arrivesAtLabel,
    frontDoorHref: doors.frontDoor.href,
  };
}

export const JOURNEY_FACTS: readonly JourneyFacts[] = [
  facts("light-quanta", LQ_FACT, LQ_Q, [FORK_ENTROPY_ACCOUNT, FORK_ONE_LUMP], LQ_DOORS as Doors),
  facts("brownian-motion", BM_FACT, BM_Q, [FORK_EXNER, FORK_NAEGELI], BM_DOORS as Doors),
  facts(
    "special-relativity",
    SR_FACT,
    SR_Q,
    [FORK_SOURCE_SPEED, FORK_UNDETECTED_ETHER],
    SR_DOORS as Doors,
  ),
  facts("mass-energy", ME_FACT, ME_Q, [FORK_FIELD_MASS, FORK_POINCARE], ME_DOORS as Doors),
];

export function journeyFactsFor(slug: string): JourneyFacts | undefined {
  return JOURNEY_FACTS.find((entry) => entry.slug === slug);
}
