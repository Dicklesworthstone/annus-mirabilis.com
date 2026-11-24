/**
 * One bounded result genealogy: the checked light-complex route in relativity §8
 * and the derived result the September paper explicitly imports.
 *
 * The summaries and links come from the live derivation. The cross-paper use comes
 * from the connections registry. A title or a similarly named formula cannot stand
 * in for either relationship. This is not a genealogy of the whole paper.
 */
import { srLightComplexDerivation } from "../../equations/derivations/srLightComplex.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";
import { type Connection, loadConnections } from "../connections/connections.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport } from "./supportDeclarations.ts";

export type LightComplexGenealogyStep = Readonly<{
  id: string;
  summary: string;
  href: string;
  sourceHref: string;
}>;

export type LightComplexGenealogy = Readonly<{
  density: LightComplexGenealogyStep;
  volume: LightComplexGenealogyStep;
  combination: LightComplexGenealogyStep;
  frequency: LightComplexGenealogyStep;
  importedUse: Readonly<{ text: string; href: string }>;
}>;

const ROUTE = "/papers/special-relativity/s8/";

function refuse(message: string): never {
  throw new ResultCardsError("result-genealogy-unresolved", message);
}

/** Accept only the already checked support projected for the real light-energy result. */
export function buildLightComplexGenealogy(
  support: CheckedResultSupport,
  connections: readonly Connection[],
  chain: DerivationChain = srLightComplexDerivation,
): LightComplexGenealogy {
  if (
    support.proofId !== "sr-light-complex-energy" ||
    support.conclusion.equationId !== "eq-model-sr-light-energy" ||
    chain.id !== srLightComplexDerivation.id ||
    chain.target !== srLightComplexDerivation.target
  ) {
    refuse("The light-energy genealogy requires its checked light-complex route and conclusion.");
  }
  const report = verifyChain(chain, { isPublicationGate: true });
  if (
    !report.passed ||
    !report.isPublicationReady ||
    report.stepReports.length !== chain.steps.length ||
    report.stepReports.length === 0 ||
    report.stepReports.some((step) => step.verificationStatus !== "verified")
  ) {
    refuse("The light-energy genealogy cannot publish a route with an unchecked or failed step.");
  }

  const step = (id: string, requiredPremise?: string): LightComplexGenealogyStep => {
    const matches = chain.steps.filter((candidate) => candidate.id === id);
    const found = matches[0];
    if (
      matches.length !== 1 ||
      !found ||
      !found.sourceAnchor ||
      !found.reasons.r0.trim() ||
      (requiredPremise &&
        !found.premiseRefs.some(
          (premise) =>
            premise.ref === requiredPremise &&
            premise.edgeType !== "cross-reference" &&
            premise.edgeType !== "modern-verification-oracle",
        ))
    ) {
      refuse("The light-energy genealogy has no supported step " + id + ".");
    }
    return {
      id: found.id,
      summary: found.reasons.r0,
      href: ROUTE + "#" + found.id,
      sourceHref: ROUTE + "#" + found.sourceAnchor,
    };
  };

  const importedUses = connections.filter(
    (connection) =>
      connection.kind === "borrows" &&
      connection.uses?.from.paper === "special-relativity" &&
      connection.uses.from.result === "sr-light-complex-energy" &&
      connection.uses.to.paper === "mass-energy" &&
      connection.uses.to.result === "me-light-energy-transformation",
  );
  const importedUse = importedUses[0]?.uses;
  if (importedUses.length !== 1 || !importedUse) {
    refuse(
      "The light-energy genealogy needs the recorded September import of this derived result.",
    );
  }
  return {
    density: step("sr-light-complex-density-factor", "eq-model-sr-light-density"),
    volume: step("sr-light-complex-moving-volume", "eq-model-sr-light-volume"),
    combination: step(
      "sr-light-complex-combine-factors",
      "sr-light-complex-positive-q-subluminal-domain",
    ),
    frequency: step("sr-light-complex-same-frequency-factor", "eq-model-sr-doppler-ratio"),
    importedUse: {
      text: importedUse.text,
      href: "/papers/" + importedUse.to.paper + "/view/results/#result-" + importedUse.to.result,
    },
  };
}

/** Build-time join; no physics checker or connection registry is sent to the browser. */
export function lightComplexGenealogyFor(
  support: CheckedResultSupport,
  root: string = process.cwd(),
): LightComplexGenealogy {
  return buildLightComplexGenealogy(support, loadConnections(root));
}
