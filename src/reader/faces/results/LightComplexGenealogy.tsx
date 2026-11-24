import {
  lightComplexGenealogyFor,
  type LightComplexGenealogyStep,
} from "../../../content/results/lightComplexGenealogy.ts";
import type { CheckedResultSupport } from "../../../content/results/supportDeclarations.ts";
import "./lightComplexGenealogy.css";

function StepLinks({ step, label }: { step: LightComplexGenealogyStep; label: string }) {
  return (
    <p className="fine">
      <a href={step.href} aria-label={"Follow " + label}>
        Follow this step
      </a>
      {" · "}
      <a href={step.sourceHref} aria-label={"Find the printed source for " + label}>
        Find its source in the paper
      </a>
    </p>
  );
}

/** A static dependency route: every action is a real link, including without JavaScript. */
export function LightComplexGenealogy({ support }: { support: CheckedResultSupport }) {
  const route = lightComplexGenealogyFor(support);
  return (
    <section
      id="light-complex-genealogy"
      className="light-complex-genealogy"
      aria-labelledby="light-complex-genealogy-title"
      data-result-genealogy="sr-light-complex-energy"
    >
      <h3 id="light-complex-genealogy-title">From the light packet to the September paper</h3>
      <p>
        Trace one result through §§7–8. This teaching route uses modern notation: q is the
        frequency ratio between the two frames. The density and volume changes describe the
        same piece of light.
      </p>

      <div
        className="light-complex-genealogy-factors"
        role="group"
        aria-label="The two factors needed for energy"
      >
        <section data-genealogy-step={route.density.id}>
          <h4>First input: energy per unit volume</h4>
          <p>{route.density.summary}</p>
          <StepLinks step={route.density} label="the density transformation" />
        </section>
        <section data-genealogy-step={route.volume.id}>
          <h4>Second input: the volume of that light</h4>
          <p>{route.volume.summary}</p>
          <StepLinks step={route.volume} label="the packet-volume transformation" />
        </section>
      </div>

      <section
        className="light-complex-genealogy-combination"
        data-genealogy-step={route.combination.id}
      >
        <h4>Use both factors to obtain total energy</h4>
        <p>{route.combination.summary}</p>
        <p>
          The wave and moving-boundary transformations are inputs to this multiplication.
          Replacing the packet volume with a material body’s contraction would change the argument.
        </p>
        <StepLinks step={route.combination} label="the total-energy multiplication" />
      </section>

      <section data-genealogy-step={route.frequency.id}>
        <h4>Compare with the earlier frequency result</h4>
        <p>{route.frequency.summary}</p>
        <StepLinks step={route.frequency} label="the frequency comparison" />
      </section>

      <section className="light-complex-genealogy-import" data-genealogy-import="mass-energy">
        <h4>The derived formula used in September</h4>
        <p>{route.importedUse.text}</p>
        <p>
          <a href={route.importedUse.href}>Open the imported formula in the mass–energy paper</a>
        </p>
        <p>
          That paper also uses conservation in both frames and an unchanged energy offset.
          The light-energy formula is one input to its argument.
        </p>
        <p className="fine">
          <a href="/papers/mass-energy/view/results/#result-me-two-balances">
            Read the two energy balances and their premises
          </a>
          {" · "}
          <a href="/papers/mass-energy/view/results/#result-me-kinetic-energy-drop">
            Follow the subtraction with the unchanged offset
          </a>
        </p>
      </section>
    </section>
  );
}
