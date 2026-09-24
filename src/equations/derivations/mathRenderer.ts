/**
 * Static Math and LaTeX rendering for derivation step expressions (am-eq-derivation-renderer-9gd7).
 *
 * Converts Expression AST to KaTeX HTML+MathML with subexpression highlighting.
 */

import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { nodeId } from "../ast.ts";

/**
 * Converts a symbolic Expression tree to a formatted LaTeX string. With `layout` "terms", a
 * top-level sum is set one term per row (an authored break, types.ts StepLayout); a highlight on
 * the sum still boxes the whole of it.
 */
export function expressionToDerivationLatex(
  tree: Expression,
  highlightIds?: ReadonlySet<string>,
  annotate = false,
  layout?: "terms",
): string {
  const highlight = (n: Expression, s: string): string => {
    const id = nodeId(n);
    if (!id || !highlightIds?.has(id)) return s;
    return annotate ? `\\htmlData{expression-id=${id}}{\\boxed{${s}}}` : `\\mathbf{${s}}`;
  };
  const render = (n: Expression): string => {
    let s: string;
    switch (n.kind) {
      case "number": {
        const [m, e] = n.value.split("e");
        s = e === undefined ? n.value : `${m}\\times10^{${e}}`;
        break;
      }
      case "constant":
        s = "\\pi";
        break;
      case "symbol": {
        const name = n.termId || n.quantityId;
        if (name === "x_sum") {
          s = "x_{\\mathrm{sum}}";
        } else if (name === "x2") {
          s = "x^2";
        } else if (name === "Delta_i") {
          s = "\\Delta_i";
        } else if (name === "lambda_x") {
          s = "\\lambda_x";
        } else if (name === "k_B") {
          s = "k_B";
        } else if (name.startsWith("\\")) {
          s = name;
        } else if (name.includes("_")) {
          const [base, sub] = name.split("_");
          s = `${base}_{\\mathrm{${sub}}}`;
        } else {
          s = name;
        }

        if (n.scale && (n.scale.num !== 1 || n.scale.den !== 1)) {
          s = `\\frac{${n.scale.num}}{${n.scale.den}}\\left(${s}\\right)`;
        }
        break;
      }
      case "sum":
        s = n.args.map(render).join(" + ");
        break;
      case "product":
        s = n.args
          .map((x) =>
            ["sum", "relation", "negate"].includes(x.kind)
              ? `\\left(${render(x)}\\right)`
              : render(x),
          )
          .join("\\,");
        break;
      case "quotient":
        s = `\\frac{${render(n.numerator)}}{${render(n.denominator)}}`;
        break;
      case "power": {
        // The equation renderer's rule (latex/render.ts): an atomic base takes no brackets. The
        // missing-step panels printed <(A)^2> where the explorer beside them prints <A^2>. A sum,
        // a negative number, a scaled letter or a glyph with its own superscript keeps them.
        const base = render(n.base);
        const atomic =
          n.base.kind === "average" ||
          n.base.kind === "constant" ||
          (n.base.kind === "number" && /^\d+(\.\d+)?$/.test(n.base.value)) ||
          (n.base.kind === "symbol" &&
            (!n.base.scale || (n.base.scale.num === 1 && n.base.scale.den === 1)) &&
            !base.includes("^"));
        const exponent =
          n.exponent.den === 1 ? n.exponent.num : `\\frac{${n.exponent.num}}{${n.exponent.den}}`;
        s = `${atomic ? base : `\\left(${base}\\right)`}^{${exponent}}`;
        break;
      }
      case "root":
        s = `\\sqrt${n.degree === 2 ? "" : `[${n.degree}]`}{${render(n.radicand)}}`;
        break;
      case "negate":
        s = `-\\left(${render(n.argument)}\\right)`;
        break;
      case "group":
        s = `\\left(${render(n.argument)}\\right)`;
        break;
      case "average":
        s = `\\left\\langle ${render(n.argument)}\\right\\rangle`;
        break;
      case "function":
        s = `\\${n.name}\\left(${render(n.argument)}\\right)`;
        break;
      case "relation":
        s = `${render(n.left)} ${n.operator === "approx" ? "\\approx" : n.operator === "define" ? ":=" : "="} ${render(n.right)}`;
        break;
      case "derivative": {
        const d = n.partial ? "\\partial" : "\\mathrm{d}";
        const p = n.order === 1 ? "" : `^{${n.order}}`;
        s = `\\frac{${d}${p}\\left(${render(n.expression)}\\right)}{${d}${render(n.variable)}${p}}`;
        break;
      }
      case "integral":
        s = `\\int ${render(n.expression)}\\,\\mathrm{d}${render(n.variable)}`;
        break;
      case "indexedSum":
        s = `\\sum_{${n.index}=${render(n.from)}}^{${render(n.to)}} \\left(${render(n.expression)}\\right)`;
        break;
      case "limit":
        s = `\\lim_{${render(n.variable)} \\to ${render(n.approaches)}} \\left(${render(n.expression)}\\right)`;
        break;
      default:
        s = "\\dots";
    }

    return highlight(n, s);
  };

  if (layout === "terms" && tree.kind === "sum") {
    // A plus sign starting a row is still binary: {} before it keeps the spacing of one line.
    const rows = tree.args.map((a, i) => `&${i === 0 ? "" : "{}+"} ${render(a)}`);
    return highlight(tree, `\\begin{aligned}${rows.join(" \\\\ ")}\\end{aligned}`);
  }
  return render(tree);
}

/**
 * Renders an expression AST to KaTeX HTML + MathML markup string.
 */
export function renderExpressionMarkup(
  tree: Expression,
  highlightIds?: ReadonlySet<string>,
): { html: string; plainLatex: string } {
  const plainLatex = expressionToDerivationLatex(tree, highlightIds);

  try {
    const html = renderToString(plainLatex, {
      displayMode: true,
      output: "htmlAndMathml",
      throwOnError: false,
      strict: "warn",
      trust: false,
    });
    return { html, plainLatex };
  } catch {
    return {
      html: `<code class="math-fallback">${plainLatex}</code>`,
      plainLatex,
    };
  }
}
