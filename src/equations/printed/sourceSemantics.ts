/** Build-time source algebra, exact dimensions and operation markup for the first complete paper. */
import { renderToString } from "katex";
import fractions from "../../../content/foundations/bridge-fractions-ratios.json";
import signs from "../../../content/foundations/bridge-negative-numbers-direction.json";
import fields from "../../../content/foundations/fields-waves.json";
import frames from "../../../content/foundations/frames-events.json";
import taylor from "../../../content/foundations/taylor-expansion.json";
import energy from "../../../content/foundations/work-energy.json";
import { checkDimensions } from "../../content/dimensions/check.ts";
import type { QuantityDescriptor } from "../../content/dimensions/unitSystems.ts";
import type { Quantity as RegisteredQuantity } from "../../content/schemas/argument.ts";
import { type Expression, nodeId, walk } from "../ast.ts";
import { wrapHtmlData } from "../latex/markers.ts";
import { renderLatex } from "../latex/render.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";
import { dimensionText } from "../termFacts.ts";
import { withQuantityIds } from "../termQuantities.ts";
import { type CheckedDisplay, type CompiledPrintedDisplay, FACE_KATEX } from "./displayTerms.ts";
import {
  MASS_ENERGY_ARITHMETIC,
  MASS_ENERGY_OPERATION_GUIDES,
  type OperationReading,
} from "./massEnergyOperations.ts";
import { parseSourceExpression, type SourceExpression, sourceNodes } from "./sourceExpression.ts";

export type PrintedOperation = OperationReading &
  Readonly<{
    id: string;
    path: string;
    kind: Expression["kind"];
    primary: boolean;
    foundationTitle: string;
    /** Physical occurrences, not all occurrences of a similarly named quantity. */
    termIds: readonly string[];
    dimension: string;
    dimensionExponents: readonly string[];
  }>;

export type PrintedSourceSemantics = Readonly<{
  kind: "validated-source-binding";
  rows: readonly Expression[];
  continuationRows: readonly number[];
  roundTrip: Readonly<{
    status: "identical" | "typography-exception";
    canonicalLatex: string;
    reason: string;
  }>;
  dimensionStatus: "consistent";
  dimension: string;
  context: string;
  premise: string;
  next: Readonly<{ href: string; label: string }>;
  operations: readonly PrintedOperation[];
}>;

export type PrintedOperationReading = Pick<
  PrintedSourceSemantics,
  "context" | "premise" | "next" | "operations" | "dimension"
>;

type SemanticsCode =
  | "printed-source-binding"
  | "printed-source-dimension"
  | "printed-source-operation"
  | "printed-source-marks";

export class SourceSemanticsError extends Error {
  constructor(
    readonly code: SemanticsCode,
    readonly display: string,
    message: string,
  ) {
    super(display + ": " + message);
    this.name = "SourceSemanticsError";
  }
}

const exponent = ({ num, den }: { num: number | bigint; den: number | bigint }) =>
  String(den) === "1" ? String(num) : String(num) + "/" + String(den);

/** Preserve the canonical registry's exact rational dimensions and explicit unsupported status. */
export function sourceDimensionRegistry(
  quantities: ReadonlyMap<string, RegisteredQuantity>,
): Record<string, QuantityDescriptor> {
  return Object.fromEntries(
    [...quantities].map(([id, q]) => [
      id,
      {
        id,
        dimension: q.dimension?.map(exponent) ?? [],
        dimensionStatus: q.dimensionStatus,
        ...(q.gaussianDimension ? { gaussianDimension: q.gaussianDimension.map(exponent) } : {}),
        ...(q.emuDimension ? { emuDimension: q.emuDimension.map(exponent) } : {}),
        ...(q.dimensionlessKind ? { dimensionlessKind: q.dimensionlessKind } : {}),
      },
    ]),
  );
}

/** Canonical AST output is measured BEFORE retaining source typography as an exception. */
export function canonicalSourceLatex(display: CheckedDisplay, parsed: SourceExpression): string {
  const registry: QuantityRegistry = Object.fromEntries(
    display.terms.map(({ quantityId, glyph }) => {
      const quantity: Quantity = {
        id: quantityId,
        name: quantityId,
        glyph,
        dimension: [],
        unit: "",
        displayUnit: "",
        displayPower: 0,
        semanticKind: "source-binding",
        role: "input",
        definition: "Glyph projection only; dimensions come from the canonical quantity registry.",
      };
      return [quantityId, quantity];
    }),
  );
  return parsed.rows
    .map(({ tree }) => renderLatex(tree, { registry, strictConcordance: false }))
    .join(" \\\\ ");
}

export type SourceMark = Readonly<{
  start: number;
  end: number;
  id: string;
  kind: "term" | "op";
  braced?: boolean | undefined;
}>;

/**
 * Splice trusted markers around complete parsed constructs. Nested spans are permitted, crossing
 * spans are not. Source bytes between markers are copied exactly, never rewritten or renamed.
 */
export function markSourceOperations(latex: string, marks: readonly SourceMark[]): string {
  const ordered = [...marks].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id),
  );
  const stack: SourceMark[] = [];
  const ids = new Set<string>();
  for (const mark of ordered) {
    while (stack.length && mark.start >= stack.at(-1)!.end) stack.pop();
    if (
      !Number.isSafeInteger(mark.start) ||
      !Number.isSafeInteger(mark.end) ||
      mark.start < 0 ||
      mark.end <= mark.start ||
      mark.end > latex.length ||
      (stack.length > 0 && mark.end > stack.at(-1)!.end) ||
      !/^[a-zA-Z0-9_.-]+$/.test(mark.id) ||
      ids.has(mark.id)
    )
      throw new SourceSemanticsError(
        "printed-source-marks",
        mark.id,
        "Operation markers must have unique safe ids and non-crossing source spans.",
      );
    ids.add(mark.id);
    stack.push(mark);
  }
  function draw(start: number, end: number, list: readonly SourceMark[]): string {
    let out = "";
    let at = start;
    for (let i = 0; i < list.length; i++) {
      const mark = list[i]!;
      const nested: SourceMark[] = [];
      while (list[i + 1] && list[i + 1]!.start >= mark.start && list[i + 1]!.end <= mark.end)
        nested.push(list[++i]!);
      const wrapped = wrapHtmlData(mark.kind, mark.id, draw(mark.start, mark.end, nested));
      out += latex.slice(at, mark.start) + (mark.braced ? "{" + wrapped + "}" : wrapped);
      at = mark.end;
    }
    return out + latex.slice(at, end);
  }
  return draw(0, latex.length, ordered);
}

const VISUAL_OPEN = '<span class="katex-html" aria-hidden="true">';
const DISPLAY_CLOSE = "</span></span>";

function visual(html: string): { start: number; end: number } | undefined {
  const start = html.indexOf(VISUAL_OPEN);
  return start >= 0 && html.endsWith(DISPLAY_CLOSE)
    ? { start, end: html.length - DISPLAY_CLOSE.length }
    : undefined;
}

/** Check the actual KaTeX output before replacing only the original display's visual span. */
export function mergeSourceOperationRendering(
  original: CompiledPrintedDisplay,
  markedHtml: string,
  marks: readonly Pick<SourceMark, "id" | "kind">[],
): string {
  for (const mark of marks)
    if (!markedHtml.includes("data-" + mark.kind + '="' + mark.id + '"'))
      throw new SourceSemanticsError(
        "printed-source-marks",
        original.display,
        "The visual rendering dropped " + mark.id + ".",
      );
  const oldVisual = visual(original.html);
  const newVisual = visual(markedHtml);
  if (!oldVisual || !newVisual)
    throw new SourceSemanticsError(
      "printed-source-marks",
      original.display,
      "The operation rendering must retain the original display structure.",
    );
  return (
    original.html.slice(0, oldVisual.start) +
    markedHtml.slice(newVisual.start, newVisual.end) +
    original.html.slice(oldVisual.end)
  );
}

const quantitiesIn = (tree: Expression): readonly string[] =>
  [...new Set(walk(tree).flatMap((n) => (n.kind === "symbol" ? [n.quantityId] : [])))].sort();

const FOUNDATION_TITLES = new Map(
  [fractions, signs, fields, frames, taylor, energy].map(({ id, title }) => [id, title]),
);

/**
 * The original printed-term compiler still verifies its exact MathML structure. Operation
 * wrappers group complete parsed constructs in the visual rendering only; the served MathML
 * and its TeX annotation are copied unchanged from that already checked original render.
 */
export function compilePrintedSourceSemantics(
  display: CheckedDisplay,
  original: CompiledPrintedDisplay,
  quantities: ReadonlyMap<string, RegisteredQuantity>,
): Readonly<{ html: string; semantics: PrintedSourceSemantics }> | undefined {
  if (display.paper !== "mass-energy") return undefined;
  const guide = MASS_ENERGY_OPERATION_GUIDES[display.display];
  if (!guide)
    throw new SourceSemanticsError(
      "printed-source-operation",
      display.display,
      "This mass-energy display has no authored operation guide.",
    );
  const parsed = parseSourceExpression(display);
  const nodes = sourceNodes(parsed);
  const printedTerms = nodes.flatMap(({ node }) =>
    node.tree.kind === "symbol" ? [node.tree] : [],
  );
  if (
    printedTerms.length !== display.terms.length ||
    new Set(printedTerms.map((term) => term.termId)).size !== printedTerms.length ||
    display.terms.some(
      (term) =>
        !printedTerms.some(
          (parsedTerm) =>
            parsedTerm.termId === term.termId && parsedTerm.quantityId === term.quantityId,
        ),
    )
  )
    throw new SourceSemanticsError(
      "printed-source-binding",
      display.display,
      "The semantic tree must bind every printed term exactly once to its checked quantity.",
    );
  for (const [path, reading] of Object.entries(guide.primary)) {
    const node = nodes.find((n) => n.path === path)?.node;
    if (
      !node ||
      node.tree.kind !== reading.kind ||
      quantitiesIn(node.tree).join("\u0000") !== [...reading.quantities].sort().join("\u0000")
    )
      throw new SourceSemanticsError(
        "printed-source-operation",
        display.display,
        "The authored operation no longer matches the source at " + path + ".",
      );
  }
  const registry = sourceDimensionRegistry(quantities);
  function dimensions(tree: Expression): { dimension: string; dimensionExponents: string[] } {
    const result = checkDimensions(tree, registry, { context: "gaussian-cgs" });
    if (result.status !== "consistent")
      throw new SourceSemanticsError(
        "printed-source-dimension",
        display.display,
        result.status + ": " + result.reason,
      );
    const dimensionExponents = result.dimension.map(exponent);
    return { dimension: dimensionText(dimensionExponents), dimensionExponents };
  }
  const rowDimensions = parsed.rows.map(({ tree }) => dimensions(tree));
  if (rowDimensions.some((d) => d.dimensionExponents.join(",") !== "2,1,-2,0,0,0"))
    throw new SourceSemanticsError(
      "printed-source-dimension",
      display.display,
      "The authored display expects energy in every equality.",
    );
  const operationMarks: SourceMark[] = [];
  const operations: PrintedOperation[] = nodes.flatMap(({ path, node }) => {
    if (!node.marker) return [];
    const id = nodeId(node.tree);
    const authored = guide.primary[path];
    const reading = authored ?? MASS_ENERGY_ARITHMETIC[node.tree.kind];
    const foundationTitle = reading ? FOUNDATION_TITLES.get(reading.foundation) : undefined;
    if (
      !id ||
      !reading ||
      !foundationTitle ||
      (node.tree.kind === "power" && (node.tree.exponent.num !== 2 || node.tree.exponent.den !== 1))
    )
      throw new SourceSemanticsError(
        "printed-source-operation",
        display.display,
        "No authored reading for the operation at " + path + ".",
      );
    operationMarks.push({ ...node.marker, id, kind: "op" });
    return [
      {
        id,
        path,
        kind: node.tree.kind,
        primary: authored !== undefined,
        foundationTitle,
        title: reading.title,
        does: reading.does,
        why: reading.why,
        foundation: reading.foundation,
        termIds: display.terms
          .filter((term) => term.start >= node.start && term.end <= node.end)
          .map((term) => term.termId),
        ...dimensions(node.tree),
      },
    ];
  });
  const marks: SourceMark[] = [
    ...operationMarks,
    ...display.terms.map(({ start, end, termId: id, braced }) => ({
      start,
      end,
      id,
      kind: "term" as const,
      braced,
    })),
  ];
  const allowed = new Map(marks.map((mark) => [mark.id, "data-" + mark.kind]));
  const markedHtml = renderToString(markSourceOperations(display.latex, marks), {
    ...FACE_KATEX,
    throwOnError: true,
    strict: (code: string) => (code === "htmlExtension" ? "ignore" : "warn"),
    trust: (context) => {
      if (context.command !== "\\htmlData") return false;
      const entries = Object.entries(context.attributes as Record<string, string>);
      const [only] = entries;
      return entries.length === 1 && only !== undefined && allowed.get(only[1]) === only[0];
    },
  });
  const html = withQuantityIds(
    mergeSourceOperationRendering(original, markedHtml, marks),
    original.terms,
  );
  const canonicalLatex = canonicalSourceLatex(display, parsed);
  return {
    html,
    semantics: {
      kind: "validated-source-binding",
      rows: parsed.rows.map(({ tree }) => tree),
      continuationRows: parsed.continuationRows,
      roundTrip: {
        status: canonicalLatex === display.latex ? "identical" : "typography-exception",
        canonicalLatex,
        reason:
          canonicalLatex === display.latex
            ? "The canonical AST renderer reproduces the printed display byte for byte."
            : "The AST renderer normalizes spacing, delimiters, powers, punctuation and aligned rows. The original source typography is retained with validated term and operation spans.",
      },
      dimensionStatus: "consistent",
      dimension: rowDimensions[0]!.dimension,
      context: guide.context,
      premise: guide.premise,
      next: guide.next,
      operations,
    },
  };
}
