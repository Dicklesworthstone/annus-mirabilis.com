import type { RequestRefusal } from "./refusals.ts";

/** The sentence a reader is shown for a refusal: the validator's specific requirement when it gave
 * one in details.requirements, otherwise the code's registered message. It lives apart from
 * refusals.ts because every diffusion kernel imports that module, and show-the-code pins each
 * kernel's whole import graph: a lab helper added there drifted seven closure pins. */
export function refusalSentence(refusal: Pick<RequestRefusal, "message" | "details">): string {
  const requirement = refusal.details?.requirements;
  return typeof requirement === "string" && requirement.trim() ? requirement : refusal.message;
}

/** Units that are not read aloud after "in": a count takes a whole number, and a pure number or a
 * normalized amplitude takes a number alone. */
const UNITS_READ_ALOUD: Readonly<Record<string, string | null>> = {
  count: null,
  norm: null,
  ratio: null,
  "×": null,
  λ: "wavelengths",
  rad: "radians",
  s: "seconds",
  ms: "milliseconds",
};

/** The sentence a lab's draft parser shows when a typed field is not a number: the page's label,
 * then what to enter, in the unit the field is entered in. */
export function enterNumberSentence(label: string, unit: string): string {
  if (unit === "count") return `${label}: enter a whole number.`;
  // A wavelength entered in units of the wavelength is a plain number; "in wavelengths" would be circular.
  if (unit === "λ" && /^wavelength/i.test(label)) return `${label}: enter a number.`;
  const spoken = unit in UNITS_READ_ALOUD ? UNITS_READ_ALOUD[unit] : unit;
  return spoken === null || spoken === undefined
    ? `${label}: enter a number.`
    : `${label}: enter a number, in ${spoken}.`;
}
