/**
 * Every laboratory refuses a setting outside the modelDomain its manifest declares (dispatch 134).
 *
 * The ranges come from content/experiments/<id>.yaml through scripts/generate-model-domains.mjs, so a
 * range is written once, in the manifest. BM-01 accepted T = 1e300 K beside a manifest declaring
 * 273-330 K, and one of its curves silently stopped drawing; a sweep found 90 of 148 declared numeric
 * domains that no validator checked.
 *
 * A refusal here is typed outside-model-domain (a model limit, not malformed input). Its
 * details.requirements names the setting and the range as the page shows them, and the manifest's
 * reason, which every laboratory already displays.
 */
import { MODEL_DOMAINS } from "../../generated/model-domains.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { exponentialParts } from "../../units/scientific.ts";
import { makeRefusal } from "../results/refusals.ts";

export type DeclaredDomain = Readonly<{
  label: string;
  displayUnit: string;
  min?: number;
  minInclusive?: boolean;
  max?: number;
  maxInclusive?: boolean;
  reason: string;
}>;

/**
 * How the page shows a setting, where it differs from the manifest: the label a reader sees, the
 * unit of the input box, and the factor from the stored value to the number typed there (BM-01's
 * viscosity is stored in Pa·s and typed in mPa·s: scale 1000).
 */
export type DomainDisplay = Readonly<{ label?: string; unit?: string; scale?: number }>;

const DECLARED: Readonly<Record<string, Readonly<Record<string, DeclaredDomain>>>> = MODEL_DOMAINS;

export function declaredDomains(labId: string): Readonly<Record<string, DeclaredDomain>> {
  return DECLARED[labId] ?? {};
}

export function insideDeclaredDomain(domain: DeclaredDomain, value: number): boolean {
  const { min, max } = domain;
  if (min !== undefined && (domain.minInclusive === false ? value <= min : value < min))
    return false;
  if (max !== undefined && (domain.maxInclusive === false ? value >= max : value > max))
    return false;
  return true;
}

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "−": "⁻",
};

/** A bound as the page writes numbers: plain between 10⁻³ and 10⁶, else a power of ten. */
function numberText(value: number): string {
  const rounded = Number(value.toPrecision(6));
  const size = Math.abs(rounded);
  if (size === 0 || (size >= 1e-3 && size < 1e6)) return String(rounded).replace(/^-/, "−");
  const parts = exponentialParts(rounded);
  if (parts.kind === "plain") return parts.text;
  const exponent = [...parts.exponent].map((ch) => SUPERSCRIPT[ch] ?? ch).join("");
  return `${parts.mantissa} × 10${exponent}`;
}

/**
 * A manifest's ASCII unit as the page writes it: "um" reads μm, "m^3" m³, "mPa s" mPa·s, "deg" °,
 * "lambda" wavelengths. A pure number ("", "1", "dimensionless") takes no unit.
 */
const UNIT_TEXT: Readonly<Record<string, string>> = {
  "1": "",
  dimensionless: "",
  um: "μm",
  um3: "μm³",
  uW: "μW",
  "m2/s": "m²/s",
  "m^3": "m³",
  "C/m^3": "C/m³",
  "A/m^2": "A/m²",
  "mPa s": "mPa·s",
  "Pa s": "Pa·s",
  deg: "°",
  lambda: "wavelengths",
};

export function unitText(unit: string): string {
  return UNIT_TEXT[unit] ?? unit;
}

/** "from 273 to 330 K", "at least 0 J", "greater than 0 and at most 5 μm". */
export function rangeText(domain: DeclaredDomain, display: DomainDisplay = {}): string {
  const scale = display.scale ?? 1;
  const unit = display.unit ?? unitText(domain.displayUnit);
  const tail = !unit ? "" : unit === "°" ? unit : ` ${unit}`;
  const lo = domain.min === undefined ? undefined : numberText(domain.min * scale);
  const hi = domain.max === undefined ? undefined : numberText(domain.max * scale);
  const openLo = domain.minInclusive === false;
  const openHi = domain.maxInclusive === false;
  if (lo !== undefined && hi !== undefined) {
    if (!openLo && !openHi) return `from ${lo} to ${hi}${tail}`;
    return `${openLo ? "greater than" : "at least"} ${lo} and ${openHi ? "less than" : "at most"} ${hi}${tail}`;
  }
  if (lo !== undefined) return `${openLo ? "greater than" : "at least"} ${lo}${tail}`;
  return `${openHi ? "less than" : "at most"} ${hi}${tail}`;
}

/** First words of manifest reasons that are names or symbols, so keep their capital after a colon. */
const KEEPS_CAPITAL = new Set(["Newtonian", "Monte", "Stokes", "Wien", "Planck", "Boltzmann"]);

/** The reader's sentence for one setting outside its declared domain. */
export function domainRequirement(domain: DeclaredDomain, display: DomainDisplay = {}): string {
  const label = display.label ?? domain.label;
  const reason = domain.reason.trim().replace(/\.$/, "");
  const first = reason.split(/[\s,-]/, 1)[0] ?? "";
  // A one-letter first word is a symbol ("H must be...", "L must be...") unless it is the article.
  const keep = (first.length === 1 && first !== "A") || KEEPS_CAPITAL.has(first);
  const because = reason
    ? `: ${keep ? reason : `${reason.charAt(0).toLowerCase()}${reason.slice(1)}`}`
    : "";
  return `${label} must be ${rangeText(domain, display)} in this model${because}.`;
}

/**
 * The first numeric setting of `params` outside its lab's declared domain, as a typed
 * outside-model-domain refusal; undefined when every declared setting is inside. Settings the lab
 * does not store as numbers are left to the lab's own checks.
 */
export function refuseOutsideDeclaredDomain(
  labId: string,
  params: Readonly<Record<string, unknown>>,
  display: Readonly<Record<string, DomainDisplay>> = {},
): Computation<never> | undefined {
  for (const [parameterId, domain] of Object.entries(declaredDomains(labId))) {
    const value = params[parameterId];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (insideDeclaredDomain(domain, value)) continue;
    return {
      kind: "refused",
      refusal: makeRefusal(
        "outside-model-domain",
        { parameterIds: [parameterId] },
        { details: { requirements: domainRequirement(domain, display[parameterId]) } },
      ),
    };
  }
  return undefined;
}
