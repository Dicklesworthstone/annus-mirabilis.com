/**
 * Navigation through the inputs actually named by checked result routes.
 *
 * This is a projection, not a new proof graph. A source-order chain and a teaching
 * reconstruction remain separate even when they use the same formula. A shared
 * passage does not select an arbitrary result, and a specialised proof without an
 * authored DerivationChain still keeps all of its owner's assumptions and scope.
 */
import { premiseEdgesForGenealogy } from "../../equations/derivations/hooks.ts";
import type { DerivationChain, PremiseRef } from "../../equations/derivations/types.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { type Connection, loadConnections } from "../connections/connections.ts";
import { checkedResultChains } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "./resultCards.ts";
import type { CheckedResultSupport, ResultProofId } from "./supportDeclarations.ts";

export type DependencyRouteKind = "source-order" | "teaching";
export type DependencyEvidence = Readonly<{
  chainId: string;
  stepId: string | null;
  edgeType: PremiseRef["edgeType"];
}>;
export type ResultDependencyInput = Readonly<{
  ref: string;
  kind: "result" | "equation" | "passage" | "source";
  label: string;
  href: string;
  resultId: string | null;
  evidence: readonly DependencyEvidence[];
}>;
export type ResultDependencyRoute = Readonly<{
  kind: DependencyRouteKind;
  inputs: readonly ResultDependencyInput[];
}>;
export type ResultDependencyUse = Readonly<{
  resultId: string;
  title: string;
  href: string;
  kind: DependencyRouteKind;
}>;
export type CrossPaperUse = Readonly<{
  connectionId: string;
  direction: "input" | "use";
  label: string;
  text: string;
  title: string;
  href: string;
}>;
export type ResultDependency = Readonly<{
  resultId: string;
  title: string;
  href: string;
  argumentStatus: string;
  sourceHref: string;
  explanationHref: string;
  support: CheckedResultSupport | null;
  routes: readonly ResultDependencyRoute[];
  uses: readonly ResultDependencyUse[];
  crossPaper: readonly CrossPaperUse[];
}>;

type EquationAddress = Pick<EquationRecord, "id" | "paper" | "argument" | "title">;
type Inputs = Readonly<{
  paper: string;
  resultIds: readonly string[];
  /** All result records in this paper, including cards outside a section-local view. */
  records: readonly ResultCardRecord[];
  /** Already resolved through checkedSupportFor, not merely proof declarations from YAML. */
  supports: ReadonlyMap<string, CheckedResultSupport>;
  equations: ReadonlyMap<string, EquationAddress>;
  connections: readonly Connection[];
  relatedRecords: readonly ResultCardRecord[];
  /** The checked owner supplies these chains; specialised owners may have none. */
  chainsForProof?: ((id: ResultProofId) => readonly DerivationChain[]) | undefined;
}>;

const resultHref = (record: Pick<ResultCardRecord, "paper" | "id">): string =>
  `/papers/${record.paper}/view/results/#result-${record.id}`;
const passageHref = (paper: string, argument: string): string => `/papers/${paper}/#${argument}`;

function refuse(message: string): never {
  throw new ResultCardsError("result-dependencies-unresolved", message);
}

/** Only actual premise references can produce inputs; proximity and matching prose cannot. */
export function buildResultDependencies(input: Inputs): readonly ResultDependency[] {
  const { paper, records, supports, equations } = input;
  const byId = new Map(records.map((record) => [record.id, record]));
  if (
    byId.size !== records.length ||
    records.some((record) => record.paper !== paper) ||
    new Set(input.resultIds).size !== input.resultIds.length
  ) {
    refuse("Result dependency navigation needs unambiguous records from one paper.");
  }
  const chainsForProof = input.chainsForProof ?? checkedResultChains;
  const allRecords = [...records, ...input.relatedRecords];

  function resolveInput(
    record: ResultCardRecord,
    support: CheckedResultSupport,
    ref: string,
  ): Omit<ResultDependencyInput, "evidence"> | null {
    const concludedBy = records.filter(
      (candidate) =>
        candidate.support.kind === "checked-proof" && candidate.support.conclusion === ref,
    );
    const result = concludedBy.length === 1 ? concludedBy[0] : undefined;
    if (result && result.id !== record.id) {
      return {
        ref,
        kind: "result",
        label: result.title,
        href: resultHref(result),
        resultId: result.id,
      };
    }
    const equation = equations.get(ref);
    if (equation) {
      if (equation.id !== ref || equation.paper !== paper || !equation.argument) {
        refuse(`The premise ${ref} does not resolve to this paper's equation owner.`);
      }
      // SemanticEquation publishes data-equation-id, not an id. Its owning argument is the
      // real destination, where the reader can open that passage's equations without JS.
      return {
        ref,
        kind: "equation",
        label: equation.title,
        href: passageHref(paper, equation.argument),
        resultId: null,
      };
    }
    const argumentOwners = records.filter((candidate) => candidate.arguments.includes(ref));
    // Naming a passage does not identify every conclusion a card associates with it.
    // Even one card's argument remains a passage input, never an inferred result edge.
    if (argumentOwners.length > 0) {
      const label = support.assumptions.find((assumption) => assumption.id === ref)?.label;
      return {
        ref,
        kind: "passage",
        label: label ?? argumentOwners.map((owner) => owner.title).join("; "),
        href: passageHref(paper, ref),
        resultId: null,
      };
    }
    const printedOwner = records.find((candidate) =>
      candidate.printed.some((excerpt) => excerpt.anchor === ref),
    );
    if (printedOwner) {
      return {
        ref,
        kind: "source",
        label: `Printed premise for ${printedOwner.title}`,
        href: `/papers/${paper}/view/german/#${ref}`,
        resultId: null,
      };
    }
    if (ref.startsWith("eq-") || ref.startsWith("arg-")) {
      refuse(`The checked route for ${record.id} names an unresolved input ${ref}.`);
    }
    // Physical conditions, definitions and internal steps do not acquire invented source
    // anchors. The support owner retains their readable statements in assumptions and scope.
    return null;
  }

  const nodes = input.resultIds.map((resultId): ResultDependency => {
    const record = byId.get(resultId);
    if (!record) refuse(`Result dependency navigation has no result ${resultId}.`);
    const support = supports.get(resultId) ?? null;
    if (
      (record.support.kind === "checked-proof" &&
        (!support ||
          support.proofId !== record.support.proofId ||
          support.conclusion.equationId !== record.support.conclusion)) ||
      (record.support.kind === "no-checked-proof" && support)
    ) {
      refuse(`Result ${resultId} needs its own resolved support before showing a proof route.`);
    }
    const firstSource = record.printed[0];
    const firstArgument = record.arguments[0];
    if (!firstSource || !firstArgument) {
      refuse(`Result ${resultId} has no source or explanation destination.`);
    }
    const groups = new Map<DependencyRouteKind, Map<string, ResultDependencyInput>>();
    if (support) {
      for (const chain of chainsForProof(support.proofId)) {
        if (chain.routeKind === "modern-verification") continue;
        const references = [
          ...chain.entryAssumptions.map((premise) => ({
            ref: premise.ref,
            edgeType: premise.edgeType,
            stepId: null as string | null,
          })),
          ...premiseEdgesForGenealogy([chain]).map((edge) => ({
            ref: edge.from,
            edgeType: edge.edgeType,
            stepId: edge.to,
          })),
        ];
        for (const reference of references) {
          if (
            reference.edgeType !== "historical-derivation" &&
            reference.edgeType !== "pedagogical-reconstruction"
          ) {
            continue;
          }
          const resolved = resolveInput(record, support, reference.ref);
          if (!resolved) continue;
          const kind =
            chain.routeKind === "source-order" && reference.edgeType === "historical-derivation"
              ? "source-order"
              : "teaching";
          let group = groups.get(kind);
          if (!group) {
            group = new Map();
            groups.set(kind, group);
          }
          const evidence = {
            chainId: chain.id,
            stepId: reference.stepId,
            edgeType: reference.edgeType,
          };
          const previous = group.get(resolved.ref);
          group.set(resolved.ref, {
            ...resolved,
            evidence: [...(previous?.evidence ?? []), evidence],
          });
        }
      }
    }

    // Recorded uses are navigation beside the proof routes, not additional proof edges.
    // The registry distinguishes a borrowed result from a premise in its own wording.
    // A shared number, mathematical pattern or later synthesis supplies no such use.
    const crossPaper: CrossPaperUse[] = [];
    for (const connection of input.connections) {
      if (connection.kind !== "borrows" || !connection.uses) continue;
      const { from, to, text } = connection.uses;
      const isInput = to.paper === paper && to.result === resultId;
      const isUse = from.paper === paper && from.result === resultId;
      if (!isInput && !isUse) continue;
      const other = isInput ? from : to;
      const matches = allRecords.filter(
        (candidate) => candidate.paper === other.paper && candidate.id === other.result,
      );
      const target = matches[0];
      if (matches.length !== 1 || !target) {
        refuse(`Connection ${connection.id} has no unambiguous result destination.`);
      }
      crossPaper.push({
        connectionId: connection.id,
        direction: isInput ? "input" : "use",
        label: connection.label,
        text,
        title: target.title,
        href: resultHref(target),
      });
    }

    return {
      resultId,
      title: record.title,
      href: resultHref(record),
      argumentStatus: record.meanings.argumentStatus,
      sourceHref: `/papers/${paper}/view/german/#${firstSource.anchor}`,
      explanationHref: passageHref(paper, firstArgument),
      support,
      routes: [...groups].map(([kind, inputs]) => ({ kind, inputs: [...inputs.values()] })),
      uses: [],
      crossPaper,
    };
  });

  // Forward links are the inverse of these exact input links, not a second authored graph.
  return nodes.map((node) => {
    const uses = nodes.flatMap((target) =>
      target.routes.flatMap((route) =>
        route.inputs.some((premise) => premise.resultId === node.resultId)
          ? [
              {
                resultId: target.resultId,
                title: target.title,
                href: target.href,
                kind: route.kind,
              },
            ]
          : [],
      ),
    );
    return { ...node, uses };
  });
}

/** Build-time registry join. Only the resulting words and links reach the reader. */
export function resultDependenciesFor(
  paper: string,
  resultIds: readonly string[],
  supports: ReadonlyMap<string, CheckedResultSupport>,
  equations: ReadonlyMap<string, EquationAddress>,
  root: string = process.cwd(),
): readonly ResultDependency[] {
  const connections = loadConnections(root);
  const relatedPapers = new Set(
    connections
      .filter((connection) => connection.kind === "borrows" && connection.papers.includes(paper))
      .flatMap((connection) => connection.papers)
      .filter((other) => other !== paper),
  );
  function recordsFor(slug: string): readonly ResultCardRecord[] {
    const loaded = loadResultCards(root, slug);
    if (!loaded || loaded.problems.length > 0) {
      refuse(`Result dependency navigation cannot resolve ${slug}'s result records.`);
    }
    return loaded.cards;
  }
  return buildResultDependencies({
    paper,
    resultIds,
    records: recordsFor(paper),
    supports,
    equations,
    connections,
    relatedRecords: [...relatedPapers].flatMap(recordsFor),
  });
}
