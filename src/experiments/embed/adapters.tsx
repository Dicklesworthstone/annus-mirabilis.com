/** Server-only composition: select the REAL laboratory component and its existing example.
 * Literal imports keep the selected graph separate from the embed builder and ordinary
 * reading routes. No proxy evaluator, copied formula, fixture owner or generic fallback.
 */
import type { ReactNode } from "react";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import type { PreparedLq06Example } from "../lq06/session.ts";
import type { EmbeddableId } from "./catalogue.ts";

/** A prepared example that fails its own validation is a build defect. The embed says so and
 * points at the full laboratory, as a refusal should, instead of crashing the frame. */
function preparedExampleFailed(id: string): ReactNode {
  return (
    <p className="notice" role="alert">
      This laboratory&apos;s prepared example did not pass its own check, so it cannot be shown
      here. <a href={`/lab/${id}/`}>Open the full laboratory</a>.
    </p>
  );
}

export async function renderEmbeddedLaboratory(id: EmbeddableId): Promise<ReactNode> {
  switch (id) {
    case "bm-03": {
      const { ConfigurationLab } = await import("../../components/lab/bm03/ConfigurationLab.tsx");
      return <ConfigurationLab />;
    }
    case "lq-05": {
      const { IndependentConfigurationsLab } = await import(
        "../../components/lab/lq05/IndependentConfigurationsLab.tsx"
      );
      return <IndependentConfigurationsLab />;
    }
    case "lq-06": {
      const { CoefficientMatchEntry } = await import(
        "../../components/lab/lq06/CoefficientMatchEntry.tsx"
      );
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
      // A prepared example that fails its own validation is a build defect. The embed says so
      // and points at the full laboratory, as a refusal should, instead of crashing the frame.
      if (checked.kind !== "accepted")
        return (
          <p className="notice" role="alert">
            This laboratory&apos;s prepared example did not pass its own check, so it cannot be
            shown here. <a href="/lab/me-02/">Open the full laboratory</a>.
          </p>
        );
      return (
        <CoefficientComparison
          example={{ ...example, parameters: checked.data }}
          equations={equations.equations as readonly CompiledEquation[]}
        />
      );
    }
    case "sr-03": {
      const { RodSimultaneityLab } = await import("../../components/lab/RodSimultaneityLab.tsx");
      const { validateSr03Parameters } = await import("../sr03/parameters.ts");
      const { default: example } = await import("../../generated/sr03-example.json");
      const checked = validateSr03Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-03");
      return <RodSimultaneityLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-08": {
      const { FieldFrameChangeLab } = await import(
        "../../components/lab/sr08/FieldFrameChangeLab.tsx"
      );
      const { validateSr08Parameters } = await import("../sr08/parameters.ts");
      const { default: example } = await import("../../generated/sr08-example.json");
      const checked = validateSr08Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-08");
      return <FieldFrameChangeLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-09": {
      const { DopplerAberrationLab } = await import(
        "../../components/lab/sr09/DopplerAberrationLab.tsx"
      );
      const { validateSr09Parameters } = await import("../sr09/parameters.ts");
      const { default: example } = await import("../../generated/sr09-example.json");
      const checked = validateSr09Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-09");
      return <DopplerAberrationLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-10": {
      const { LightComplexLab } = await import("../../components/lab/sr10/LightComplexLab.tsx");
      const { validateSr10Parameters } = await import("../sr10/parameters.ts");
      const { default: example } = await import("../../generated/sr10-example.json");
      const checked = validateSr10Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-10");
      return <LightComplexLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-11": {
      const { MovingMirrorLab } = await import("../../components/lab/sr11/MovingMirrorLab.tsx");
      const { validateSr11Parameters } = await import("../sr11/parameters.ts");
      const { default: example } = await import("../../generated/sr11-example.json");
      const checked = validateSr11Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-11");
      return <MovingMirrorLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-12": {
      const { ChargeCurrentLab } = await import("../../components/lab/sr12/ChargeCurrentLab.tsx");
      const { validateSr12Parameters } = await import("../sr12/parameters.ts");
      const { default: example } = await import("../../generated/sr12-example.json");
      const checked = validateSr12Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-12");
      return <ChargeCurrentLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-13": {
      const { ElectronDynamicsLab } = await import(
        "../../components/lab/sr13/ElectronDynamicsLab.tsx"
      );
      const { validateSr13Parameters } = await import("../sr13/parameters.ts");
      const { default: example } = await import("../../generated/sr13-example.json");
      const checked = validateSr13Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-13");
      return <ElectronDynamicsLab example={{ ...example, parameters: checked.data }} />;
    }
    case "shelf-michelson-morley":
    case "shelf-fizeau":
    case "shelf-maxwell-galilean": {
      const { SHELF_DEFINITIONS } = await import("../shelfOptics/definition.ts");
      const { evaluateShelfOptics } = await import("../shelfOptics/evaluation.ts");
      const { ShelfOpticsLab } = await import(
        "../../components/lab/shelfOptics/ShelfOpticsLab.tsx"
      );
      const { Formula } = await import("../../components/edition/Formula.tsx");
      const example = evaluateShelfOptics(SHELF_DEFINITIONS[id].defaults);
      return (
        <>
          <p className="notice">
            Modern SI calibration and illustrative settings. This is not a verified historical
            dataset or a strict 1904-mode instrument. No FrankenSim WASM execution is claimed.
          </p>
          <ShelfOpticsLab
            example={example}
            laterEquation={<Formula latex={String.raw`u_{\mathrm{rel}}=\frac{c/n+v}{1+v/(nc)}`} />}
          />
        </>
      );
    }
    default: {
      // Every admitted id has a case above, so this is reached only by an address naming
      // something else. It refuses in words, with the way to the catalogue.
      const unknown: never = id;
      return (
        <p className="notice" role="alert">
          No embedded laboratory is available for &ldquo;{String(unknown)}&rdquo;.{" "}
          <a href="/instruments/">See every instrument</a>.
        </p>
      );
    }
  }
}
