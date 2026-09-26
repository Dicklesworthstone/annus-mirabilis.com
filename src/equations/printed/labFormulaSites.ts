/**
 * Every formula a lab page draws through LabFormula or LabInlineFormula (dispatch 274), read from
 * the pages' source with the TypeScript parser, so the build can give the labs' quantities their
 * colour slots and the inspector its facts, as it does for the reading faces' and the explanations'
 * inline formulas (build-equations.ts, inlineOwn).
 *
 * The parser reads the JSX, not the text: a formula quoted in a comment is not a site, and a
 * String.raw template keeps its backslashes as written. A site whose lab or latex is not a literal
 * cannot be read at build time, so it is refused by name (lab-formula-site-not-literal) rather than
 * left out of the slots in silence.
 *
 * Build-time only: it reads src/app/lab/<lab>/page.tsx from disk.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export type LabFormulaSite = Readonly<{
  lab: string;
  latex: string;
  display: boolean;
  /** Quoted as the paper prints it (LabFormula's `printed`). */
  printed: boolean;
  file: string;
  line: number;
}>;

export class LabFormulaSiteError extends Error {
  readonly code: "lab-formula-site-not-literal";
  constructor(code: "lab-formula-site-not-literal", message: string) {
    super(`${code}: ${message}`);
    this.name = "LabFormulaSiteError";
    this.code = code;
  }
}

const TAGS: Readonly<Record<string, boolean>> = { LabFormula: true, LabInlineFormula: false };

/** The literal text of an attribute's value, as the component receives it, or null. */
function literal(value: ts.JsxAttributeValue | undefined, source: ts.SourceFile): string | null {
  if (!value) return null;
  // A JSX attribute string passes its backslashes through as written.
  if (ts.isStringLiteral(value)) return value.getText(source).slice(1, -1);
  if (!ts.isJsxExpression(value) || !value.expression) return null;
  const expression = value.expression;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    return expression.text;
  if (
    ts.isTaggedTemplateExpression(expression) &&
    expression.tag.getText(source) === "String.raw" &&
    ts.isNoSubstitutionTemplateLiteral(expression.template)
  )
    return expression.template.getText(source).slice(1, -1);
  return null;
}

/** The sites of one page's source. */
export function labFormulaSitesOf(text: string, file: string): LabFormulaSite[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sites: LabFormulaSite[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(source);
      const display = TAGS[tag];
      if (display !== undefined) {
        const attributes = new Map<string, ts.JsxAttribute>();
        for (const property of node.attributes.properties)
          if (ts.isJsxAttribute(property)) attributes.set(property.name.getText(source), property);
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const lab = literal(attributes.get("lab")?.initializer, source);
        const latex = literal(attributes.get("latex")?.initializer, source);
        if (lab === null || latex === null)
          throw new LabFormulaSiteError(
            "lab-formula-site-not-literal",
            `${file}:${line}: <${tag}> needs a literal lab and latex for the build to read it.`,
          );
        const printedAttribute = attributes.get("printed");
        const printed =
          printedAttribute !== undefined &&
          (printedAttribute.initializer === undefined ||
            printedAttribute.initializer.getText(source) === "{true}");
        sites.push({ lab, latex, display, printed, file, line });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites;
}

/** Every lab page's sites, lab by lab in directory order. */
export function labFormulaSites(root = process.cwd()): LabFormulaSite[] {
  const dir = join(root, "src", "app", "lab");
  return readdirSync(dir)
    .sort()
    .flatMap((lab) => {
      const file = join("src", "app", "lab", lab, "page.tsx");
      return existsSync(join(root, file))
        ? labFormulaSitesOf(readFileSync(join(root, file), "utf8"), file)
        : [];
    });
}
