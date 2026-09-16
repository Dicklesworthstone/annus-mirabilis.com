/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/specClauses.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Extracted predicate-to-phrase mechanism and clause interface.
 * - Removed patent-specific claim clause tables (generalized for result weave in am-read-result-weave-jex).
 */

export interface ResultPredicateClause {
  readonly id: string;
  readonly phrase: string;
  readonly active: boolean;
  readonly tone: "held" | "broken" | "live";
  readonly caption: string;
}

export type ClausePredicateFn = (
  params: Record<string, number | boolean | string>,
) => ResultPredicateClause[];

export class ResultClauseRegistry {
  private predicates = new Map<string, ClausePredicateFn>();

  register(experimentId: string, predicate: ClausePredicateFn): void {
    this.predicates.set(experimentId, predicate);
  }

  evaluate(
    experimentId: string,
    params: Record<string, number | boolean | string>,
  ): ResultPredicateClause[] {
    const fn = this.predicates.get(experimentId);
    if (!fn) return [];
    return fn(params);
  }
}

export const globalResultClauseRegistry = new ResultClauseRegistry();

export function evaluateResultClauses(
  experimentId: string,
  params: Record<string, number | boolean | string>,
  registry: ResultClauseRegistry = globalResultClauseRegistry,
): ResultPredicateClause[] {
  return registry.evaluate(experimentId, params);
}
