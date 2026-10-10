/**
 * SWIFT COMPUTES NO DISPLAYED PHYSICAL QUANTITY (am-tny4).
 *
 * The app chapter's first rule: "Swift never computes, caches, or formats a displayed physical
 * quantity, and never authors reader-facing scientific text. Numbers come from the edition's
 * runtime; words come from compiled records." am-tny4 measured that the rule has NO GATE among the
 * fifteen `apple-*` steps, though a scan then found 0 substantive violations. This is the guard,
 * added while the family is clean, which is the only time a floor of zero can be set honestly.
 *
 * WHICH HALF OF THE RULE THIS ANSWERS, because it is not both. It answers COMPUTES, CACHES and
 * FORMATS: a unit in a string literal, a float formatter, a quantity formatter, or arithmetic on a
 * physics-named binding. It does NOT answer "never authors reader-facing scientific text", which
 * needs a reading rather than a pattern -- a Swift literal holding scientific prose is a judgement,
 * and the voice lint over compiled records is where prose is judged. `findings` says so in its own
 * output rather than leaving the gap to be inferred.
 *
 * THE RULES WERE CHOSEN FROM THE POPULATION, not invented. Measured 2026-10-10 over the 54 Swift
 * files: zero occurrences of `String(format:`, `NumberFormatter`, `MeasurementFormatter`,
 * `Measurement<`, `sqrt(`, `pow(`, and zero of any unit token below. What the sources DO contain is
 * two formatters, and both are allowed by name with a reason: `ByteCountFormatter` formats the
 * bytes of a reader's stored data, which is storage and not physics, and `printFormatter` is
 * UIKit's print formatter rather than a number formatter. `Double` appears in presentation settings
 * (type scale, line measure) and in bridge payloads, which carry a value they do not compute.
 *
 * COMMENTS ARE BLANKED BEFORE MATCHING, for the reason AGENTS.md gives: text that DESCRIBES a
 * forbidden construct is not the construct, and the densest prose about one is the comment
 * explaining why it is forbidden -- this file's own docblock names `MeasurementFormatter` four
 * times. Bodies are blanked rather than deleted so every line number still reports.
 */

/** A unit token that cannot plausibly be anything else in a Swift source. */
export const PHYSICAL_UNIT_TOKENS: readonly string[] = [
  "μm",
  "µm", // U+00B5 MICRO SIGN as well as U+03BC GREEK SMALL LETTER MU: they look identical
  "m²",
  "m³",
  "Pa·s",
  "mPa",
  "THz",
  "eV",
  "J/K",
  "m/s",
  "km/s",
  "s⁻¹",
  "μm²",
  "µm²",
];

/** Formatters and types that turn a value into a displayed quantity. */
export const QUANTITY_FORMATTERS: readonly string[] = [
  "NumberFormatter",
  "MeasurementFormatter",
  "Measurement<",
  "FloatingPointFormatStyle",
  "formatted(.number",
];

/**
 * Formatters that are allowed, each with the reason it is not a physical quantity. A name here is
 * matched EXACTLY, so `ByteCountFormatter` cannot shelter `MyByteCountFormatter`.
 */
export const ALLOWED_FORMATTERS: Readonly<Record<string, string>> = {
  ByteCountFormatter:
    "formats the bytes of a reader's stored data, which is storage rather than a physical quantity",
  printFormatter: "UIKit's print formatter, which lays out a page and formats no number",
};

/** Physics vocabulary whose arithmetic belongs to the edition's runtime, never to Swift. */
export const PHYSICS_IDENTIFIERS: readonly string[] = [
  "diffusion",
  "diffusivity",
  "viscosity",
  "lorentz",
  "gamma",
  "velocity",
  "frequency",
  "wavelength",
  "entropy",
  "temperature",
  "displacement",
  "momentum",
  "stoppingPotential",
  "workFunction",
  "avogadro",
  "boltzmann",
];

export type SwiftPhysicsFinding = Readonly<{
  file: string;
  line: number;
  kind: "unit-literal" | "float-format" | "quantity-formatter" | "physics-arithmetic";
  detail: string;
}>;

/**
 * Blanks Swift comments, keeping every byte position.
 *
 * Swift's block comments NEST, unlike C's, so the depth is counted rather than matched once. String
 * literals are skipped so a `//` inside a URL is not read as a comment opener -- the defect the
 * shared TypeScript blanker was repaired for -- and `"""` multiline literals are handled, because
 * an unterminated scan through one would blank the rest of the file and report a clean source
 * forever.
 */
export function blankSwiftComments(source: string): string {
  const out = [...source];
  let i = 0;
  let depth = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (depth > 0) {
      if (two === "/*") {
        depth += 1;
        i += 2;
        continue;
      }
      if (two === "*/") {
        depth -= 1;
        i += 2;
        continue;
      }
      if (source[i] !== "\n") out[i] = " ";
      i += 1;
      continue;
    }
    if (two === "/*") {
      depth = 1;
      out[i] = " ";
      out[i + 1] = " ";
      i += 2;
      continue;
    }
    if (two === "//") {
      while (i < source.length && source[i] !== "\n") {
        out[i] = " ";
        i += 1;
      }
      continue;
    }
    if (source.slice(i, i + 3) === '"""') {
      i += 3;
      while (i < source.length && source.slice(i, i + 3) !== '"""') i += 1;
      i += 3;
      continue;
    }
    if (source[i] === '"') {
      i += 1;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

/**
 * Whether `unit` appears as a unit rather than as letters inside a word.
 *
 * THIS GATE COMMITTED AGENTS.md's CANONICAL ERROR BEFORE IT SHIPPED, which is why the check is a
 * function with a name. A bare `line.includes("eV")` reported three findings on the app's clean
 * sources: "CFBundl(eV)ersion", "bridg(eV)ersion" and "ContentUnavailabl(eV)iew" -- the same shape
 * as the `grep -ciE "MIT"` that matched `Emit` and credited a file with a licence header it did not
 * have. An unanchored token fails toward whatever text is commonest near the thing being measured,
 * and in a Swift source that is camel case.
 *
 * So a unit must be bounded by a non-letter on each side. `m²` and `s⁻¹` end in a non-letter
 * already; `eV`, `mPa` and `THz` are the ones that need it.
 */
export function unitAppears(line: string, unit: string): boolean {
  const letter = /\p{L}/u;
  let from = 0;
  for (;;) {
    const at = line.indexOf(unit, from);
    if (at === -1) return false;
    const before = at === 0 ? "" : (line[at - 1] ?? "");
    const after = line[at + unit.length] ?? "";
    if (!letter.test(before) && !letter.test(after)) return true;
    from = at + 1;
  }
}

const FLOAT_FORMAT = /String\s*\(\s*format\s*:\s*"[^"]*%[-+ 0#]*[\d.]*(?:f|e|E|g|G)/;
const ARITHMETIC = /[*/]|\bsqrt\s*\(|\bpow\s*\(/;

/** Every way a Swift source can compute, cache or format a displayed physical quantity. */
export function swiftPhysicsFindings(file: string, source: string): readonly SwiftPhysicsFinding[] {
  const findings: SwiftPhysicsFinding[] = [];
  const lines = blankSwiftComments(source).split("\n");
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    for (const unit of PHYSICAL_UNIT_TOKENS)
      if (line.includes(`"`) && unitAppears(line, unit))
        findings.push({
          file,
          line: lineNumber,
          kind: "unit-literal",
          detail: `a string literal carries the unit "${unit}"; a displayed quantity's unit comes from the edition's runtime`,
        });
    if (FLOAT_FORMAT.test(line))
      findings.push({
        file,
        line: lineNumber,
        kind: "float-format",
        detail: "String(format:) with a floating-point specifier formats a number for display",
      });
    for (const formatter of QUANTITY_FORMATTERS)
      if (line.includes(formatter))
        findings.push({
          file,
          line: lineNumber,
          kind: "quantity-formatter",
          detail: `${formatter} turns a value into a displayed quantity`,
        });
    const lowered = line.toLowerCase();
    if (ARITHMETIC.test(line))
      for (const name of PHYSICS_IDENTIFIERS)
        if (lowered.includes(name.toLowerCase())) {
          findings.push({
            file,
            line: lineNumber,
            kind: "physics-arithmetic",
            detail: `arithmetic on "${name}", which the edition's runtime owns`,
          });
          break;
        }
  });
  return findings;
}
