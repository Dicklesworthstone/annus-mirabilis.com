/**
 * The undetermined common field factor and its normalization in Einstein's section 6.
 * Source operations use Gaussian dimensions and the printed v/V mixing factors. The
 * original psi/phi spellings survive; both here bind the section 6 field-scale quantity.
 */
import type { Expression } from "../ast.ts";
import type { OperationReading } from "./massEnergyOperations.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
type Axis = "x" | "y" | "z";
type FieldRow = Readonly<{
  glyph: string;
  axis: Axis;
  kind: "electric" | "magnetic";
  mix?: Readonly<{ glyph: string; axis: Axis; sign: "+" | "-" }>;
}>;
const FIELD = ["-1/2", "1/2", "-1", "0", "0", "0"];
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];
const SCALE = "fieldScaleFactorUnknown";
const SPEED = "frameSpeed";
const LIGHT = "speedOfLight";
const FACTOR = "lorentzFactor";
const APPLICATIONS = { functionQuantities: [SCALE] };
const ROWS: readonly FieldRow[] = [
  { glyph: "X", axis: "x", kind: "electric" },
  { glyph: "L", axis: "x", kind: "magnetic" },
  { glyph: "Y", axis: "y", kind: "electric", mix: { glyph: "N", axis: "z", sign: "-" } },
  { glyph: "M", axis: "y", kind: "magnetic", mix: { glyph: "Z", axis: "z", sign: "+" } },
  { glyph: "Z", axis: "z", kind: "electric", mix: { glyph: "M", axis: "y", sign: "+" } },
  { glyph: "N", axis: "z", kind: "magnetic", mix: { glyph: "Y", axis: "y", sign: "-" } },
];
const FIELD_INDICES = Object.fromEntries(
  ROWS.flatMap(({ glyph, axis }) => [
    [glyph, axis],
    [glyph + "'", axis],
  ]),
);

const FIELD_ROUTE = {
  href: "/papers/special-relativity/s6/#sr-field-derivation",
  label: "Follow the six field equations and the common-factor argument",
};
const FIELD_FRAME_PREMISE =
  "K and k describe the same field at the same event. The inertial system k moves at constant signed speed v along K's x axis, with parallel axes, positive light speed V and |v| < V. Einstein's beta is the Lorentz factor now called gamma. The printed Gaussian convention gives electric and magnetic fields the same dimensions; the transverse mixing factors are v/V. Writing these equations in SI requires a unit conversion as well as new symbol names.";
const NORMALIZATION =
  " The comparison assumes a local linear identification with one common real field factor. Inverse consistency and the stated spatial symmetry fix its square to one. The positive branch uses identity at rest and continuity on the connected subluminal interval. Matching the differential equations alone does not establish that physical identification.";

function primary(
  kind: Expression["kind"],
  quantities: readonly string[],
  reading: OperationReading,
  literalNumbers: readonly string[] = [],
): Primary {
  return {
    kind,
    quantities: [...new Set(quantities)],
    literalNumbers,
    constantNames: [],
    ...reading,
  };
}

function symbol(quantityId: string, symbolIndex?: Axis): Primary {
  return {
    ...primary("symbol", [quantityId], {
      title: symbolIndex ? "Keep this field's frame and component" : "Keep this quantity's role",
      does: symbolIndex
        ? "Retain the quantity and vector component named at this position in the source."
        : "Retain the stated speed or Lorentz factor at this position in the source.",
      why: symbolIndex
        ? "Equal units do not make two axes or two observer descriptions interchangeable. Each primed component belongs to k and each unprimed component to K."
        : "The signed frame speed v, positive light speed V and dimensionless factor beta have different roles. The field transformation keeps those roles distinct.",
      foundation: "frames-events",
    }),
    ...(symbolIndex === undefined ? {} : { symbolIndex }),
  };
}

function application(reversed = false): Primary {
  return primary("symbol", [SCALE, SPEED], {
    title: reversed
      ? "Evaluate the field scale for the reverse boost"
      : "Evaluate the common field scale at this speed",
    does: reversed
      ? "Read phi(-v) as the factor evaluated at the negative of v."
      : "Read psi(v), or the following phi(v), as the field factor evaluated at v.",
    why: "The parentheses supply the function's argument. The value is dimensionless and is not multiplied by the speed. Section 6's phi denotes the same field factor as its psi; section 3's coordinate scale has a separate meaning.",
    foundation: "functions-graphs",
  });
}

const speedRatio = primary("quotient", [SPEED, LIGHT], {
  title: "Use the signed speed ratio in the field mixture",
  does: "Divide v by V before multiplying the other field component.",
  why: "This ratio has no units. Its sign reverses when the boost reverses, while beta stays the same. The v/V form belongs to the paper's Gaussian field convention.",
  foundation: "unit-system-1905",
});

function fieldGuide(): RelativityOperationGuide {
  const readings: Record<string, Primary> = {};
  for (const [index, row] of ROWS.entries()) {
    const path = `row${index + 1}`;
    const stationary = row.kind + "FieldStationary";
    const moving = row.kind + "FieldMoving";
    const other = (row.kind === "electric" ? "magnetic" : "electric") + "FieldStationary";
    const dependencies = [
      stationary,
      SCALE,
      SPEED,
      ...(row.mix ? [other, FACTOR, SPEED, LIGHT] : []),
    ];
    readings[path] = primary("relation", [moving, ...dependencies], {
      title: `Describe the ${row.axis} component ${row.glyph}' in k`,
      does: row.mix
        ? `Combine ${row.glyph} ${row.mix.sign} (v/V) ${row.mix.glyph}, then multiply the whole combination by beta and the common psi(v).`
        : `Multiply the K component ${row.glyph} by the same common psi(v) as the other five components.`,
      why: row.mix
        ? "Electric and magnetic descriptions mix across directions transverse to the motion. The sign and the other field's axis are part of this transformation; dimensions alone cannot fix either."
        : "The differential-equation comparison still leaves a common normalization. The parallel component participates in that freedom too.",
      foundation: "fields-waves",
    });
    readings[path + ".left"] = symbol(moving, row.axis);
    readings[path + ".right"] = primary("product", dependencies, {
      title: "Keep the common normalization on the complete component",
      does: "Multiply the full transformed component by psi(v), including both terms in a transverse row.",
      why: "The same dimensionless factor accompanies all six components until the following inverse and symmetry arguments normalize it.",
      foundation: "bridge-fractions-ratios",
    });
    readings[path + ".right.args.0"] = application();
    readings[path + ".right.args.0.at"] = symbol(SPEED);
    if (!row.mix) {
      readings[path + ".right.args.1"] = symbol(stationary, row.axis);
      continue;
    }
    readings[path + ".right.args.1"] = symbol(FACTOR);
    const mixPath = path + ".right.args.2.argument";
    readings[mixPath] = primary("sum", [stationary, other, SPEED, LIGHT], {
      title: `Mix ${row.glyph} with the ${row.mix.axis} component ${row.mix.glyph}`,
      does: `${row.mix.sign === "+" ? "Add" : "Subtract"} (v/V) ${row.mix.glyph} ${row.mix.sign === "+" ? "to" : "from"} ${row.glyph}.`,
      why: `For this boost along x, ${row.glyph}' uses exactly the printed ${row.mix.sign} sign and the ${row.mix.axis} component of the other field. Both contributions have the same Gaussian field dimension.`,
      foundation: "fields-waves",
    });
    readings[mixPath + ".args.0"] = symbol(stationary, row.axis);
    let correction = mixPath + ".args.1";
    if (row.mix.sign === "-") {
      readings[correction] = primary("negate", [other, SPEED, LIGHT], {
        title: `Subtract the entire ${row.mix.glyph} contribution`,
        does: `Subtract the complete product (v/V) ${row.mix.glyph}.`,
        why: "The sign belongs to the chosen direction of the frame transformation. Reversing it while keeping v fixed would describe a different field.",
        foundation: "bridge-negative-numbers-direction",
      });
      correction += ".argument";
    }
    readings[correction] = primary("product", [other, SPEED, LIGHT], {
      title: `Weight the ${row.mix.glyph} field component by the boost speed`,
      does: `Multiply the ${row.mix.axis} component ${row.mix.glyph} by v/V.`,
      why: "The contribution vanishes at zero boost. It has the other field's Gaussian dimension, which matches the component it is combined with.",
      foundation: "unit-system-1905",
    });
    readings[correction + ".args.0"] = speedRatio;
    readings[correction + ".args.0.numerator"] = symbol(SPEED);
    readings[correction + ".args.0.denominator"] = symbol(LIGHT);
    readings[correction + ".args.1"] = symbol(other, row.mix.axis);
  }
  return {
    expectedRowDimensions: ROWS.map(() => FIELD),
    symbolIndices: FIELD_INDICES,
    allowAlignedColumns: true,
    ...APPLICATIONS,
    context:
      "Section 6 identifies the six transformed field components up to one common function psi(v).",
    premise:
      FIELD_FRAME_PREMISE +
      " A common dimensionless scale is still undetermined. Reading psi(v) as a function keeps this freedom explicit; assigning it the value one belongs to the subsequent normalization argument.",
    next: FIELD_ROUTE,
    primary: readings,
  };
}

const NORMALIZATION_BASE = {
  expectedRowDimensions: [DIMENSIONLESS],
  symbolIndices: {},
  ...APPLICATIONS,
  premise: FIELD_FRAME_PREMISE + NORMALIZATION,
  next: FIELD_ROUTE,
};

export const RELATIVITY_FIELD_GUIDES: Readonly<Record<string, RelativityOperationGuide>> = {
  "eq-s6-d5": fieldGuide(),
  "eq-s6-d6": {
    ...NORMALIZATION_BASE,
    context:
      "The printed phi now denotes section 6's field factor, written psi in the preceding component equations.",
    primary: {
      row1: primary(
        "relation",
        [SCALE, SPEED],
        {
          title: "A boost and its inverse restore the same field",
          does: "Set the product of the common factors at v and -v equal to one.",
          why: "With the admitted Lorentz mixing, the forward and inverse transformations cancel except for this product. This requires reciprocal factors and does not yet make each factor one.",
          foundation: "frames-events",
        },
        ["1"],
      ),
      "row1.left": primary("product", [SCALE, SPEED], {
        title: "Multiply the forward and reverse normalizations",
        does: "Multiply phi(v) by phi(-v).",
        why: "Each factor belongs to one direction of the same change of description. A nonzero factor can have a reciprocal without itself being one.",
        foundation: "bridge-fractions-ratios",
      }),
      "row1.left.args.0": application(),
      "row1.left.args.0.at": symbol(SPEED),
      "row1.left.args.1": application(true),
      "row1.left.args.1.at": primary("negate", [SPEED], {
        title: "Reverse the boost inside the factor's argument",
        does: "Evaluate the common scale at -v.",
        why: "The minus sign reverses the function's input. It does not negate the value of the function; that distinction matters when testing its symmetry.",
        foundation: "functions-graphs",
      }),
      "row1.left.args.1.at.argument": symbol(SPEED),
    },
  },
  "eq-s6-d7": {
    ...NORMALIZATION_BASE,
    context:
      "The source's spatial-symmetry argument makes the common field factor an even function of the signed boost speed.",
    primary: {
      row1: primary("relation", [SCALE, SPEED], {
        title: "Use the same field scale for opposite directions",
        does: "Set phi(v) equal to phi(-v).",
        why: "This equality uses the physical symmetry stated by the source, in addition to inverse consistency. Together the two relations give phi(v) squared equal to one; the sign still needs normalization at rest.",
        foundation: "frames-events",
      }),
      "row1.left": application(),
      "row1.left.at": symbol(SPEED),
      "row1.right": application(true),
      "row1.right.at": primary("negate", [SPEED], {
        title: "Compare the factor at the opposite speed",
        does: "Change the argument from v to -v while retaining the same field-scale function.",
        why: "An even function has equal values at opposite arguments. Evenness alone does not determine its value.",
        foundation: "functions-graphs",
      }),
      "row1.right.at.argument": symbol(SPEED),
    },
  },
  "eq-s6-d8": {
    ...NORMALIZATION_BASE,
    context:
      "The common field factor becomes one on the branch connected continuously to identical descriptions at rest.",
    primary: {
      row1: primary(
        "relation",
        [SCALE, SPEED],
        {
          title: "Normalize the common field factor to one",
          does: "Choose phi(v) = 1 throughout the connected interval |v| < V.",
          why: "The preceding inverse and symmetry conditions give a square of one. Identity at rest and continuity of a nonzero real factor select the positive branch; those conditions supply the sign choice.",
          foundation: "frames-events",
        },
        ["1"],
      ),
      "row1.left": application(),
      "row1.left.at": symbol(SPEED),
    },
  },
};
