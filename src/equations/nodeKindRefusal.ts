/**
 * What an out-of-domain expression node kind does when it reaches a traversal (am-ghr8,
 * acceptance criteria 2 and 5).
 *
 * This repository carries TWO expression models: src/equations/ast.ts, which the LaTeX renderer
 * is typed against, and src/equations/tree/types.ts, which the authoring fixtures use and which
 * declares eleven kinds the renderer's union does not have. Which model the renderer is REQUIRED
 * to accept is an owner decision and is still open. What does not depend on that decision is how
 * the boundary behaves when the two are crossed anyway: it must refuse in a way that says what
 * happened, rather than returning undefined and letting the caller dereference it.
 *
 * Before this module, each children() was a switch with no default branch. TypeScript is happy
 * with that, because each switch is exhaustive over its OWN union, so neither function is
 * defective in isolation. At runtime a foreign node simply fell off the end and the function
 * returned undefined, and the first caller to touch the result raised
 * "undefined is not an object (evaluating 'children(root).flatMap')" - a TypeError that names
 * the instrument rather than the input, points at ast.ts rather than at the matrix node that
 * caused it, and does not say which equation was being rendered. Eight such outcomes are pinned
 * in src/equations/latex/allFixtures.goldens.json.
 *
 * TWO THINGS ARE DELIBERATE HERE.
 *
 * `node: never` is the exhaustiveness assertion criterion 5 asks for, and it is why the default
 * branch is worth more than the refusal alone: adding a kind to either Expression union without
 * giving it a case stops the argument being `never` and FAILS TO COMPILE. The refusal below is
 * the runtime half, for input that was never typechecked against the union in the first place;
 * the compile error is the half that catches the mistake a contributor can actually make.
 *
 * The refusal names the KIND but not the EQUATION, because children() has no equation in scope
 * and inventing a plausible id would be worse than omitting it. The renderer knows the id and
 * adds it through namingEquation() below, so the message a reader or a golden file sees carries
 * both. That split is the reason this is a module and not two copies of a throw.
 */

import { ContentError } from "../content/compiler/json.ts";

/** The refusal's identity. Kebab-case and first argument, per the am-p465 ruling. */
export const UNSUPPORTED_NODE_KIND = "equation-node-kind-unsupported";

/**
 * Refuse a node whose kind is outside the model being traversed.
 *
 * @param node The node, typed `never` so that an unhandled union member fails to compile.
 * @param model The traversal's own module path, which is the model whose union was violated.
 */
export function unsupportedNodeKind(node: never, model: string): never {
  const kind = (node as { kind?: unknown } | null | undefined)?.kind;
  const named = typeof kind === "string" && kind.length > 0 ? `"${kind}"` : "with no kind field";
  // The code is written as a LITERAL here and compared against the exported constant by this
  // module's test, rather than passed as the constant. A refusal whose code can only be read by
  // resolving an identifier is invisible to the refusal scanner, which reports the site as a bare
  // throw: that is how this line was first written and the bare-throw ratchet caught it.
  throw new ContentError(
    "equation-node-kind-unsupported",
    model,
    `Expression node kind ${named} is outside the expression model of ${model}, so it cannot be traversed or rendered.`,
  );
}

/**
 * Add the equation's identity to an unsupported-kind refusal raised beneath a renderer.
 *
 * Any other error passes through untouched: this is enrichment at a boundary that happens to
 * know one more fact, not a catch-all that would swallow unrelated failures.
 */
export function namingEquation(err: unknown, equationId: string): unknown {
  if (err instanceof ContentError && err.code === UNSUPPORTED_NODE_KIND)
    return new ContentError(err.code, err.path, `Equation "${equationId}": ${err.message}`);
  return err;
}
