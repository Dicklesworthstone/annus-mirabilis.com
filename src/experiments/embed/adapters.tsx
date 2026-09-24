/** Server-only composition: select the REAL laboratory component and its existing example.
 * Each laboratory is reached through lazyEmbeddedLabs.tsx, so an embed loads its own laboratory's
 * code and no other's. No proxy evaluator, copied formula, fixture owner or generic fallback.
 */
import type { ReactNode } from "react";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import type { PreparedLq06Example } from "../lq06/session.ts";
import type { PreparedLq07Example } from "../lq07/session.ts";
import type { EmbeddableId } from "./catalogue.ts";
import {
  LazyBrownianLab,
  LazyChargeCurrentLab,
  LazyClockSyncLab,
  LazyCoefficientComparison,
  LazyCoefficientMatchEntry,
  LazyConfigurationLab,
  LazyDopplerAberrationLab,
  LazyDriftDiffusionLab,
  LazyElectronDynamicsLab,
  LazyEntropyWorkbenchLab,
  LazyFieldFrameChangeLab,
  LazyFluorescenceLab,
  LazyIndependentConfigurationsLab,
  LazyIonizationLab,
  LazyLightComplexLab,
  LazyLorentzMapLab,
  LazyMagnetConductorLab,
  LazyMovingMirrorLab,
  LazyPhotoelectricLab,
  LazyRodSimultaneityLab,
  LazyShelfOpticsLab,
  LazySpectrumLab,
  LazyTracerLab,
  LazyTwoLedgersLab,
  LazyWaveDescriptionLab,
} from "./lazyEmbeddedLabs.tsx";

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
      return <LazyConfigurationLab />;
    }
    case "lq-05": {
      return <LazyIndependentConfigurationsLab />;
    }
    case "lq-06": {
      const { default: example } = await import("../../generated/lq06-example.json");
      return <LazyCoefficientMatchEntry example={example as unknown as PreparedLq06Example} />;
    }
    case "sr-04": {
      return <LazyLorentzMapLab />;
    }
    case "me-01": {
      return <LazyTwoLedgersLab />;
    }
    case "me-02": {
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
        <LazyCoefficientComparison
          example={{ ...example, parameters: checked.data }}
          equations={equations.equations as readonly CompiledEquation[]}
        />
      );
    }
    case "bm-01": {
      const { default: example } = await import("../../generated/bm01-example.json");
      return <LazyTracerLab example={example} />;
    }
    case "bm-04": {
      const { validateBm04Parameters } = await import("../bm04/parameters.ts");
      const { default: example } = await import("../../generated/bm04-example.json");
      const checked = validateBm04Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("bm-04");
      return <LazyDriftDiffusionLab example={{ ...example, parameters: checked.data }} />;
    }
    case "bm-06": {
      const { default: example } = await import("../../generated/bm06-example.json");
      return <LazyBrownianLab example={example} readings />;
    }
    case "lq-01": {
      const { validateLq01Parameters } = await import("../lq01/parameters.ts");
      const { default: example } = await import("../../generated/lq01-example.json");
      const checked = validateLq01Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("lq-01");
      return <LazyWaveDescriptionLab example={{ ...example, parameters: checked.data }} />;
    }
    case "lq-03": {
      const { LQ03_DEFAULTS } = await import("../lq03/definition.ts");
      const { evaluateLq03 } = await import("../lq03/session.ts");
      const example = {
        parameters: LQ03_DEFAULTS,
        evaluation: evaluateLq03(LQ03_DEFAULTS),
        sourceDigest: "src/physics/reference/radiation.ts",
      };
      return <LazySpectrumLab example={example} />;
    }
    case "lq-04": {
      const { default: example } = await import("../../generated/lq04-example.json");
      return <LazyEntropyWorkbenchLab example={example} />;
    }
    case "lq-07": {
      const { LQ07_DEFAULTS } = await import("../lq07/definition.ts");
      const { evaluateLq07 } = await import("../lq07/session.ts");
      const evalResult = evaluateLq07(LQ07_DEFAULTS);
      const example: PreparedLq07Example = {
        sourceDigest: "src/physics/reference/photoelectric.ts",
        parameters: LQ07_DEFAULTS,
        results: evalResult.outputs.map(
          (o) => `${o.quantityId}=${o.status === "value" ? String(o.value) : o.status}`,
        ),
        stepIndex: 1,
        simulationTime: 1.0,
      };
      return <LazyFluorescenceLab example={example} />;
    }
    case "lq-08": {
      const { default: example } = await import("../../generated/lq08-example.json");
      return <LazyPhotoelectricLab example={example} />;
    }
    case "lq-09": {
      const { default: example } = await import("../../generated/lq09-example.json");
      return <LazyIonizationLab example={example} />;
    }
    case "sr-01": {
      const { DEFAULT_PREPARED_EXAMPLE } = await import("../sr01/session.ts");
      return <LazyClockSyncLab example={DEFAULT_PREPARED_EXAMPLE} />;
    }
    case "sr-02": {
      const { validateSr02Parameters } = await import("../sr02/parameters.ts");
      const { default: example } = await import("../../generated/sr02-example.json");
      const checked = validateSr02Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-02");
      return <LazyMagnetConductorLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-03": {
      const { validateSr03Parameters } = await import("../sr03/parameters.ts");
      const { default: example } = await import("../../generated/sr03-example.json");
      const checked = validateSr03Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-03");
      return <LazyRodSimultaneityLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-08": {
      const { validateSr08Parameters } = await import("../sr08/parameters.ts");
      const { default: example } = await import("../../generated/sr08-example.json");
      const checked = validateSr08Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-08");
      return <LazyFieldFrameChangeLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-09": {
      const { validateSr09Parameters } = await import("../sr09/parameters.ts");
      const { default: example } = await import("../../generated/sr09-example.json");
      const checked = validateSr09Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-09");
      return <LazyDopplerAberrationLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-10": {
      const { validateSr10Parameters } = await import("../sr10/parameters.ts");
      const { default: example } = await import("../../generated/sr10-example.json");
      const checked = validateSr10Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-10");
      return <LazyLightComplexLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-11": {
      const { validateSr11Parameters } = await import("../sr11/parameters.ts");
      const { default: example } = await import("../../generated/sr11-example.json");
      const checked = validateSr11Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-11");
      return <LazyMovingMirrorLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-12": {
      const { validateSr12Parameters } = await import("../sr12/parameters.ts");
      const { default: example } = await import("../../generated/sr12-example.json");
      const checked = validateSr12Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-12");
      return <LazyChargeCurrentLab example={{ ...example, parameters: checked.data }} />;
    }
    case "sr-13": {
      const { validateSr13Parameters } = await import("../sr13/parameters.ts");
      const { default: example } = await import("../../generated/sr13-example.json");
      const checked = validateSr13Parameters(example.parameters);
      if (checked.kind !== "accepted") return preparedExampleFailed("sr-13");
      return <LazyElectronDynamicsLab example={{ ...example, parameters: checked.data }} />;
    }
    case "shelf-michelson-morley":
    case "shelf-fizeau":
    case "shelf-maxwell-galilean": {
      const { SHELF_DEFINITIONS } = await import("../shelfOptics/definition.ts");
      const { evaluateShelfOptics } = await import("../shelfOptics/evaluation.ts");
      const { Formula } = await import("../../components/edition/Formula.tsx");
      const example = evaluateShelfOptics(SHELF_DEFINITIONS[id].defaults);
      return (
        <>
          <p className="notice">
            Modern SI calibration and illustrative settings. This is not a verified historical
            dataset or a strict 1904-mode instrument. No FrankenSim WASM execution is claimed.
          </p>
          <LazyShelfOpticsLab
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
