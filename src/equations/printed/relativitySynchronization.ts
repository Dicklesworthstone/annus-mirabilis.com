/**
 * The clock convention and moving-rod light paths in sections 1 and 2.
 * Every clock event keeps its own index even though all readings share the same time quantity.
 * The readings explain the printed operations; they neither measure a one-way light speed nor
 * replace the stationary-frame closing rates with speeds measured in the moving rod's frame.
 */
import type { Expression } from "../ast.ts";
import type { OperationReading } from "./massEnergyOperations.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
type ClockEvent = "a0" | "b" | "a1";

const CLOCK = "coordinateTimeStationary";
const TIME = ["0", "0", "1", "0", "0", "0"];
const SPEED = ["1", "0", "-1", "0", "0", "0"];
const EVENT_NAMES: Readonly<Record<ClockEvent, string>> = {
  a0: "A's departure reading t_A",
  b: "B's reflection reading t_B",
  a1: "A's return reading t'_A",
};
const SYNCHRONIZATION = {
  href: "/papers/special-relativity/s1/#sr-synchronization-derivation",
  label: "Choose the clock rule and follow the midpoint assignment",
};
const MOVING_ROD = {
  href: "/lab/sr-01/",
  label: "Compare the outward and return signal times in the moving-rod ledger",
};
const RESTING_PREMISE =
  "A and B are at rest in one inertial system, with clocks running at the same rate. A emits a light signal, B reflects it, and A receives it. The readings t_A and t'_A belong to A at departure and return; the prime marks the later event, not a different frame. The reading t_B belongs to B at reflection. The round-trip duration is positive.";
const MOVING_PREMISE =
  "The rod's endpoints A and B move at constant signed speed v along the resting system's x axis, with B ahead of A. The positive r_AB is their separation measured at one resting-system time, not the rod's proper length. The displayed clock readings use that system's synchronized coordinate time. Light travels at speed V > 0 in that system and |v| < V. Reflection is immediate. V - v and V + v are closing rates in this description, not light speeds measured by an observer riding the rod.";

function primary(
  kind: Expression["kind"],
  quantities: readonly string[],
  reading: OperationReading,
  literalNumbers: readonly string[] = [],
): Primary {
  return { kind, quantities, literalNumbers, constantNames: [], ...reading };
}

/** A source occurrence has a role even when another occurrence has the same dimension and owner. */
function symbol(quantityId: string, symbolIndex?: ClockEvent): Primary {
  return {
    ...primary("symbol", [quantityId], {
      title: symbolIndex ? "Keep the named clock event" : "Keep the stated physical quantity",
      does: symbolIndex
        ? "Use " + EVENT_NAMES[symbolIndex] + " at this position in the expression."
        : "Use this quantity in the frame and role stated beside the formula.",
      why: "Interchanging quantities or clock events can preserve the units while changing the physical relation.",
      foundation: "frames-events",
    }),
    ...(symbolIndex ? { symbolIndex } : {}),
  };
}

function interval(
  path: string,
  later: ClockEvent,
  earlier: ClockEvent,
  reading: OperationReading,
): Readonly<Record<string, Primary>> {
  return {
    [path]: primary("sum", [CLOCK], reading),
    [path + ".args.0"]: symbol(CLOCK, later),
    [path + ".args.1"]: primary("negate", [CLOCK], {
      title: "Subtract " + EVENT_NAMES[earlier],
      does: "Subtract the earlier reading from " + EVENT_NAMES[later] + ".",
      why: "The difference is an elapsed coordinate-time interval. Adding the readings would make the result depend on the arbitrary choice of clock zero.",
      foundation: "bridge-negative-numbers-direction",
    }),
    [path + ".args.1.argument"]: symbol(CLOCK, earlier),
  };
}

const OUTWARD: OperationReading = {
  title: "Read the outward interval",
  does: "Subtract t_A at departure from t_B at reflection.",
  why: "These are readings at two different places. Interpreting their difference requires a common clock convention; A's round-trip observation alone does not set B's clock.",
  foundation: "frames-events",
};
const RETURN: OperationReading = {
  title: "Read the return interval",
  does: "Subtract t_B at reflection from t'_A at reception.",
  why: "The return reading belongs to A again. The prime labels that event and does not turn this into a moving-frame time.",
  foundation: "frames-events",
};

export const RELATIVITY_SYNCHRONIZATION_GUIDES: Readonly<Record<string, RelativityOperationGuide>> =
  {
    "eq-s1-d1": {
      expectedRowDimensions: [TIME],
      symbolIndices: { t_A: "a0", t_B: "b", "t'_A": "a1" },
      context: "Section 1 defines when the clocks at A and B count as synchronized.",
      premise:
        RESTING_PREMISE +
        " Equal outward and return durations are the adopted synchronization convention. The equality sets B's reading; it is not an independent measurement of either one-way travel time.",
      next: SYNCHRONIZATION,
      primary: {
        row1: primary("relation", [CLOCK], {
          title: "Adopt equal time for the two light legs",
          does: "Require t_B - t_A to equal t'_A - t_B.",
          why: "This is the definition being adopted. It assigns the reflection the midpoint of A's departure and return readings, without changing the observed round-trip duration.",
          foundation: "bridge-equals-sign-relationship",
        }),
        ...interval("row1.left", "b", "a0", OUTWARD),
        ...interval("row1.right", "a1", "b", RETURN),
      },
    },
    "eq-s1-d2": {
      expectedRowDimensions: [SPEED],
      symbolIndices: { t_A: "a0", "t'_A": "a1" },
      context: "Section 1 relates the round-trip light speed to a measured distance and one clock.",
      premise:
        RESTING_PREMISE +
        " The distance AB is the independently measured positive separation of the resting stations. The two legs each span that distance. Only A's clock supplies the elapsed round-trip time in this formula.",
      next: SYNCHRONIZATION,
      primary: {
        row1: primary(
          "relation",
          ["eventSeparationSpatial", CLOCK, "speedOfLight"],
          {
            title: "State the round-trip speed",
            does: "Identify twice AB divided by A's return-minus-departure interval with V.",
            why: "Distance divided by duration is a speed. This round-trip relation uses one clock and does not separately time the outward and return paths.",
            foundation: "frames-events",
          },
          ["2"],
        ),
        "row1.left": primary(
          "quotient",
          ["eventSeparationSpatial", CLOCK],
          {
            title: "Divide the complete path by its elapsed time",
            does: "Divide 2 AB by the entire difference t'_A - t_A.",
            why: "The denominator is positive for a completed light round trip. Moving a term outside the denominator would change the speed and its units.",
            foundation: "bridge-fractions-ratios",
          },
          ["2"],
        ),
        "row1.left.numerator": primary(
          "product",
          ["eventSeparationSpatial"],
          {
            title: "Count both legs of the path",
            does: "Multiply the stationary separation AB by two.",
            why: "The signal crosses AB once on its way to B and once on its return to A. The factor two belongs to the path length, not to a second clock measurement.",
            foundation: "bridge-fractions-ratios",
          },
          ["2"],
        ),
        "row1.left.numerator.args.1": symbol("eventSeparationSpatial"),
        ...interval("row1.left.denominator", "a1", "a0", {
          title: "Use A's elapsed round-trip time",
          does: "Subtract A's departure reading t_A from its return reading t'_A.",
          why: "Both readings come from one clock at the same resting station. Shifting that clock's zero changes both readings equally and leaves the interval unchanged.",
          foundation: "frames-events",
        }),
        "row1.right": symbol("speedOfLight"),
      },
    },
    "eq-s2-d2": {
      expectedRowDimensions: [TIME],
      symbolIndices: { t_A: "a0", t_B: "b" },
      context: "Section 2 follows the outward signal toward the moving rod's front end.",
      premise: MOVING_PREMISE,
      next: MOVING_ROD,
      primary: {
        row1: primary(
          "relation",
          [CLOCK, "lengthMeasuredStationary", "speedOfLight", "frameSpeed"],
          {
            title: "Time the outward chase in the resting system",
            does: "Set the departure-to-reflection interval equal to r_AB divided by V - v.",
            why: "In this description the signal gains on B at the closing rate V - v. For positive v, B moves away and this leg lasts longer than r_AB/V.",
            foundation: "frames-events",
          },
        ),
        ...interval("row1.left", "b", "a0", OUTWARD),
        "row1.right": primary(
          "quotient",
          ["lengthMeasuredStationary", "speedOfLight", "frameSpeed"],
          {
            title: "Divide the initial gap by its closing rate",
            does: "Divide the stationary-system rod length r_AB by the full difference V - v.",
            why: "Length divided by speed gives time. The light still has speed V in this system; V - v describes how fast the gap to B closes, not a transformed light speed.",
            foundation: "bridge-fractions-ratios",
          },
        ),
        "row1.right.numerator": symbol("lengthMeasuredStationary"),
        "row1.right.denominator": primary("sum", ["speedOfLight", "frameSpeed"], {
          title: "Allow for the front end's motion",
          does: "Subtract the signed rod speed v from V.",
          why: "For |v| < V the gap closes. Positive v reduces the closing rate and lengthens this leg; reversing v reverses that effect. At v = V the outward signal cannot catch B.",
          foundation: "frames-events",
        }),
        "row1.right.denominator.args.0": symbol("speedOfLight"),
        "row1.right.denominator.args.1": primary("negate", ["frameSpeed"], {
          title: "Subtract the rod's contribution to the separation",
          does: "Subtract v from the light's positive propagation speed V.",
          why: "With B ahead of A, positive rod motion carries the target away from the outbound signal. Replacing the minus sign with a plus sign describes the other light leg.",
          foundation: "bridge-negative-numbers-direction",
        }),
        "row1.right.denominator.args.1.argument": symbol("frameSpeed"),
      },
    },
    "eq-s2-d3": {
      expectedRowDimensions: [TIME],
      symbolIndices: { t_B: "b", "t'_A": "a1" },
      context: "Section 2 follows the reflected signal back toward the moving rod's rear end.",
      premise: MOVING_PREMISE,
      next: MOVING_ROD,
      primary: {
        row1: primary(
          "relation",
          [CLOCK, "lengthMeasuredStationary", "speedOfLight", "frameSpeed"],
          {
            title: "Time the return approach in the resting system",
            does: "Set the reflection-to-return interval equal to r_AB divided by V + v.",
            why: "For positive v the returning light and A approach each other, so this leg is shorter than the outward one. Their inequality concerns these coordinate-time intervals, not a change of the light speed.",
            foundation: "frames-events",
          },
        ),
        ...interval("row1.left", "a1", "b", RETURN),
        "row1.right": primary(
          "quotient",
          ["lengthMeasuredStationary", "speedOfLight", "frameSpeed"],
          {
            title: "Divide the return gap by its closing rate",
            does: "Divide r_AB by the full sum V + v.",
            why: "At reflection the uniformly translating endpoints still have stationary-system separation r_AB. The reflected signal moves toward decreasing x while A moves at signed speed v.",
            foundation: "bridge-fractions-ratios",
          },
        ),
        "row1.right.numerator": symbol("lengthMeasuredStationary"),
        "row1.right.denominator": primary("sum", ["speedOfLight", "frameSpeed"], {
          title: "Combine the approach of the signal and the rear end",
          does: "Add v to V for the return closing rate.",
          why: "When v is positive the gap shrinks from both ends, so its closing rate can exceed V without light exceeding V. At v = 0 both legs take r_AB/V; reversing v exchanges which leg is longer.",
          foundation: "frames-events",
        }),
        "row1.right.denominator.args.0": symbol("speedOfLight"),
        "row1.right.denominator.args.1": symbol("frameSpeed"),
      },
    },
  };
