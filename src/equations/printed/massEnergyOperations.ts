/**
 * Authored explanations for the operations in the seven printed mass-energy displays.
 * These explain the source algebra. They do not replace it with the modern model's expressions,
 * import a rest-energy premise, or treat a dimensional check as a proof of a physical law.
 */
import type { Expression } from "../ast.ts";

export type OperationReading = Readonly<{
  title: string;
  does: string;
  why: string;
  foundation: string;
}>;

type PrimaryReading = OperationReading &
  Readonly<{
    kind: Expression["kind"];
    quantities: readonly string[];
    /** Independently authored operands when a reading relies on an exact coefficient. */
    literalNumbers?: readonly string[];
    constantNames?: readonly string[];
  }>;

export type MassEnergyOperationGuide = Readonly<{
  context: string;
  premise: string;
  next: Readonly<{ href: string; label: string }>;
  primary: Readonly<Record<string, PrimaryReading>>;
}>;

const LEDGER = {
  href: "/papers/mass-energy/#me-ledger-derivation",
  label: "Follow the checked subtraction and unchanged-offset argument",
};
const LOW_SPEED = {
  href: "/papers/mass-energy/#me-low-speed-derivation",
  label: "Follow the checked low-speed expansion and coefficient comparison",
};

/** Basic mathematical roles, authored once and shown beside the display-specific premise. */
export const MASS_ENERGY_ARITHMETIC: Readonly<
  Partial<Record<Expression["kind"], OperationReading>>
> = {
  relation: {
    title: "Read the equality",
    does: "The left and right expressions have the same value under the assumptions stated for this display.",
    why: "An equality relates complete expressions. Its physical justification comes from the paper's premise or the preceding step, not from the equals sign itself.",
    foundation: "work-energy",
  },
  sum: {
    title: "Add the signed contributions",
    does: "Combine the contributions with the signs printed between them. A minus sign subtracts the complete following term.",
    why: "Only contributions with matching dimensions can be added or subtracted. Matching dimensions alone do not establish the physical relation.",
    foundation: "bridge-negative-numbers-direction",
  },
  negate: {
    title: "Subtract this contribution",
    does: "The minus sign reverses the sign of its whole argument, including a grouped difference.",
    why: "Subtracting a difference reverses both signs inside it. Keeping the group intact prevents losing the second sign.",
    foundation: "bridge-negative-numbers-direction",
  },
  product: {
    title: "Multiply the factors",
    does: "Adjacent factors are multiplied. A fraction or a bracketed expression remains one complete factor.",
    why: "The dimensions of multiplied factors combine. No value for an unknown body energy is supplied by multiplication.",
    foundation: "bridge-fractions-ratios",
  },
  quotient: {
    title: "Divide by the denominator",
    does: "Divide the complete numerator by the complete denominator.",
    why: "The denominator must be nonzero. A speed-dependent denominator here is used only for an observer speed whose magnitude is below V.",
    foundation: "bridge-fractions-ratios",
  },
  root: {
    title: "Take the positive square root",
    does: "Take the positive square root of one minus the squared speed ratio.",
    why: "For an observer speed with magnitude below V, the radicand is positive. The root is dimensionless because v and V have the same dimension.",
    foundation: "frames-events",
  },
  power: {
    title: "Square this expression",
    does: "Multiply the complete base by itself. If the base is a grouped ratio, both numerator and denominator belong to the square.",
    why: "Squaring doubles every dimensional exponent. This operation does not change the meaning or frame of a quantity.",
    foundation: "bridge-fractions-ratios",
  },
  group: {
    title: "Keep the group together",
    does: "The delimiters make the enclosed expression one operand of the surrounding operation.",
    why: "A minus sign, power or factor outside the delimiters applies to the complete group.",
    foundation: "bridge-negative-numbers-direction",
  },
  function: {
    title: "Take the cosine of the angle",
    does: "The cosine gives the directional factor for the angle in the frame stated by the source.",
    why: "Opposite light directions have opposite cosines. Equal pulse energies are a separate condition needed for their angular contributions to cancel.",
    foundation: "fields-waves",
  },
};

export const MASS_ENERGY_OPERATION_GUIDES: Readonly<Record<string, MassEnergyOperationGuide>> = {
  "eq-s0-d1": {
    context: "The energy of one light complex changes when described from the moving system.",
    premise:
      "This light-energy transformation is imported from section 8 of the relativity paper. Here phi is the propagation angle in the stationary system, and the magnitude of v is below V.",
    next: {
      href: "/papers/mass-energy/#arg-me-import",
      label: "Read the imported light-energy premise",
    },
    primary: {
      "row1.right.args.1.denominator": {
        kind: "root",
        quantities: ["frameSpeed", "speedOfLight"],
        title: "The speed-dependent denominator",
        does: "The square root divides the direction-dependent numerator. At zero observer speed it equals one; increasing the speed's magnitude makes it smaller.",
        why: "The ratio v/V is dimensionless and has magnitude below one. The positive square root is therefore real and nonzero.",
        foundation: "frames-events",
      },
      "row1.right.args.1.numerator": {
        kind: "sum",
        quantities: ["frameSpeed", "speedOfLight", "propagationAngleStationary"],
        title: "The stationary-system direction factor",
        does: "One minus v/V times cosine phi distinguishes light travelling toward and away from the moving system's direction.",
        why: "Phi is the angle the source assigns in the stationary system. Replacing it with an angle measured in the moving system would change the transformation.",
        foundation: "fields-waves",
      },
    },
  },
  "eq-s0-d2": {
    context:
      "The body's rest-frame energy before emission equals its remaining energy plus the emitted light energy.",
    premise:
      "The two opposite pulses each carry L/2 in the body's rest frame. Their symmetry leaves the body at rest in this frame.",
    next: LEDGER,
    primary: {
      "row1.right.args.1.argument": {
        kind: "sum",
        quantities: ["emittedEnergyRestFrame"],
        title: "Two equal pulses make L",
        does: "Add L/2 and L/2 to recover the total emitted energy L.",
        why: "This uses equal pulse energies in this one frame and energy conservation. Neither E zero nor E one is assigned a value such as mass times V squared.",
        foundation: "work-energy",
      },
    },
  },
  "eq-s0-d3": {
    context: "The same two-pulse emission is accounted for in the moving system.",
    premise:
      "Apply the imported light-energy transformation to equal pulses in opposite directions, using the same observer speed for both.",
    next: LEDGER,
    primary: {
      "row1.right.args.1.argument": {
        kind: "sum",
        quantities: ["emittedEnergyRestFrame", "frameSpeed", "speedOfLight", "emissionAngle"],
        title: "Cancel the opposite angular contributions",
        does: "The two fractions have the same denominator and equal L/2 factors. Their minus and plus angular contributions cancel when the pulse energies are added.",
        why: "The cancellation requires equal energies and opposite directions in the body's rest frame. Here phi is the emission angle, unlike the propagation-angle binding in the earlier quoted display.",
        foundation: "fields-waves",
      },
      "row2.right.args.1": {
        kind: "quotient",
        quantities: ["emittedEnergyRestFrame", "frameSpeed", "speedOfLight"],
        title: "The total light energy in the moving account",
        does: "After the angular terms cancel, divide L by the common square root. The continuation line retains H zero as its left side.",
        why: "This is the transformed energy of the emitted light. It supplies no absolute energy for the body and does not yet identify a mass change.",
        foundation: "frames-events",
      },
    },
  },
  "eq-s0-d4": {
    context: "Subtract the two complete energy accounts and regroup before and after the emission.",
    premise:
      "The rest and moving descriptions concern the same body and the same emission at one fixed observer speed.",
    next: LEDGER,
    primary: {
      "row1.left": {
        kind: "sum",
        quantities: [
          "bodyEnergyMovingBefore",
          "bodyEnergyRestBefore",
          "bodyEnergyMovingAfter",
          "bodyEnergyRestAfter",
        ],
        title: "Subtract the after-emission frame difference",
        does: "Take H zero minus E zero, then subtract the whole difference H one minus E one. The outer minus also reverses the sign of minus E one.",
        why: "This follows from subtraction and regrouping of the two conservation accounts. Identifying these frame differences with kinetic energy still needs the next premise.",
        foundation: "bridge-negative-numbers-direction",
      },
    },
  },
  "eq-s0-d5": {
    context:
      "The paper relates each frame-energy difference to kinetic energy plus an additive offset.",
    premise:
      "The same C is used before and after emission. Its invariance is an additional physical premise, not a consequence of the preceding subtraction.",
    next: LEDGER,
    primary: {
      "row1.right": {
        kind: "sum",
        quantities: ["kineticEnergyBefore", "additiveEnergyConstant"],
        title: "K zero plus the unchanged offset",
        does: "The pre-emission frame difference is identified as kinetic energy K zero plus C.",
        why: "C fixes the relative additive energy reference. The argument requires this same offset in the second line; it does not choose C to be zero.",
        foundation: "work-energy",
      },
      "row2.right": {
        kind: "sum",
        quantities: ["kineticEnergyAfter", "additiveEnergyConstant"],
        title: "K one plus that same offset",
        does: "The post-emission frame difference is identified as kinetic energy K one plus the same C.",
        why: "If the offset changed during emission, its difference would remain in the subtraction. Cancellation is conditional on the stated unchanged-offset premise.",
        foundation: "work-energy",
      },
    },
  },
  "eq-s0-d6": {
    context:
      "With the unchanged offset cancelled, the two energy accounts determine a kinetic-energy decrease.",
    premise:
      "Use the same C before and after and keep the observer speed fixed. This is the exact finite-speed expression under those premises.",
    next: LOW_SPEED,
    primary: {
      "row1.left": {
        kind: "sum",
        quantities: ["kineticEnergyBefore", "kineticEnergyAfter"],
        title: "The kinetic energy lost by the body",
        does: "K zero minus K one is before minus after: the decrease in kinetic energy at the same observer speed.",
        why: "Substituting both K plus C expressions into the preceding display cancels the common C. Different before and after offsets would not cancel.",
        foundation: "work-energy",
      },
      "row1.right.args.1.argument": {
        kind: "sum",
        quantities: ["frameSpeed", "speedOfLight"],
        title: "The excess over the rest-frame light energy",
        does: "Subtract one from the reciprocal square root, then multiply this excess factor by L.",
        why: "The factor vanishes at zero observer speed. Interpreting its low-speed coefficient as a mass decrease needs the subsequent expansion and kinetic-energy comparison.",
        foundation: "frames-events",
      },
    },
  },
  "eq-s0-d7": {
    context: "Keep the term quadratic in observer speed from the preceding exact energy decrease.",
    premise:
      "The paper neglects fourth and higher powers of v/V. The printed equality is read within that approximation, not as the exact finite-speed law.",
    next: LOW_SPEED,
    primary: {
      "row1.right.args.0": {
        kind: "quotient",
        quantities: ["emittedEnergyRestFrame", "speedOfLight"],
        title: "The coefficient L divided by V squared",
        does: "Dividing the emitted energy L by V squared gives the coefficient multiplying v squared over two.",
        why: "This coefficient has the dimension of mass. Identifying it as the mass decrease additionally uses the Newtonian low-speed kinetic-energy form; dimensions alone cannot make that identification.",
        foundation: "work-energy",
      },
      "row1.right": {
        kind: "product",
        quantities: ["emittedEnergyRestFrame", "speedOfLight", "frameSpeed"],
        title: "The retained quadratic term",
        does: "Multiply L/V squared by v squared over two to obtain the leading low-speed kinetic-energy decrease.",
        why: "The omitted terms begin at fourth order in v/V. This product does not assert an exact mass-energy formula for arbitrary finite observer speed.",
        foundation: "taylor-expansion",
      },
    },
  },
};
