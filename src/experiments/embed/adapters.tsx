/** Server-only composition: select the REAL laboratory component and its existing example.
 * Literal imports keep the selected graph separate from the embed builder and ordinary
 * reading routes. No proxy evaluator, copied formula, fixture owner or generic fallback.
 */
import type { ReactNode } from "react";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import type { PreparedLq06Example } from "../lq06/session.ts";
import type { EmbeddableId } from "./catalogue.ts";

export async function renderEmbeddedLaboratory(id: EmbeddableId): Promise<ReactNode> {
  switch (id) {
    case "bm-03": {
      const { ConfigurationLab } = await import("../../components/lab/bm03/ConfigurationLab.tsx");
      return <ConfigurationLab />;
    }
    case "lq-05": {
      const { IndependentConfigurationsLab } = await import("../../components/lab/lq05/IndependentConfigurationsLab.tsx");
      return <IndependentConfigurationsLab />;
    }
    case "lq-06": {
      const { CoefficientMatchEntry } = await import("../../components/lab/lq06/CoefficientMatchEntry.tsx");
      const { default: example } = await import("../../generated/lq06-example.json");
      return <CoefficientMatchEntry example={example as unknown as PreparedLq06Example} />;
    }
    case "sr-04": {
      const { LorentzMapLab } = await import("../../components/lab/sr04/LorentzMapLab.tsx");
      return <LorentzMapLab />;
    }
    case "me-01": {
      const { TwoLedgersLab } = await import("../../components/lab/me01/TwoLedgersLab.tsx");
      return <TwoLedgersLab />;
    }
    case "me-02": {
      const { CoefficientComparison } = await import("../../components/lab/CoefficientLab.tsx");
      const { validateMe02Parameters } = await import("../me02/parameters.ts");
      const { default: example } = await import("../../generated/me02-example.json");
      const { default: equations } = await import("../../generated/mass-energy-equations.json");
      const checked = validateMe02Parameters(example.parameters);
      if (checked.kind !== "accepted") throw new Error("The prepared mass-energy coefficient parameters are invalid.");
      return <CoefficientComparison example={{ ...example, parameters: checked.data }} equations={equations.equations as readonly CompiledEquation[]} />;
    }
    case "shelf-michelson-morley":
    case "shelf-fizeau":
    case "shelf-maxwell-galilean": {
      const { SHELF_DEFINITIONS } = await import("../shelfOptics/definition.ts");
      const { evaluateShelfOptics } = await import("../shelfOptics/evaluation.ts");
      const { ShelfOpticsLab } = await import("../../components/lab/shelfOptics/ShelfOpticsLab.tsx");
      const { Formula } = await import("../../components/edition/Formula.tsx");
      const example = evaluateShelfOptics(SHELF_DEFINITIONS[id].defaults);
      return <>
        <p className="notice">Modern SI calibration and illustrative settings. This is not a verified historical dataset or a strict 1904-mode instrument. No FrankenSim WASM execution is claimed.</p>
        <ShelfOpticsLab example={example} laterEquation={<Formula latex={String.raw`u_{\mathrm{rel}}=\frac{c/n+v}{1+v/(nc)}`} />} />
      </>;
    }
    default: {
      const unknown: never = id;
      throw new Error(`No embedded laboratory adapter for ${String(unknown)}.`);
    }
  }
}
