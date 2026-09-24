import type { Metadata } from "next";
import { ConnectionMap } from "./ConnectionMap.tsx";

export const metadata: Metadata = {
  title: "Connections among the four papers",
  description:
    "Follow the light thread, the energy transformation that joins relativity to mass–energy, and the shared use of counting in the light and Brownian papers.",
  alternates: { canonical: "/connections/" },
};

export default function ConnectionsPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Four papers · Different kinds of connection</p>
        <h1>What crosses the paper boundary?</h1>
        <p className="lead">
          The same constants, the same counting arguments and the same light pulse turn up in more
          than one of the four papers. The map says which kind of connection each one is, from a
          premise one paper borrows from another to a link physicists drew decades later. The first
          is evidence of how the papers depend on each other; the last is a resemblance.
        </p>
      </header>
      <ConnectionMap />
      {/* The sections follow the map's rows, from evidence to resemblance: a borrowed result, two
          routes to one number, a shared piece of mathematics, a link drawn later. They used to run
          in another order, so the map's first row was the page's third section and its last row
          the first. */}
      <section className="reading page-flush" id="energy-transformation">
        <p className="eyebrow">Uses a result</p>
        <h2>The energy transformation that leaves the relativity paper</h2>
        <p>
          Relativity §8 supplies the light-energy transformation used in the September paper. The
          two opposite emissions can have unequal energies in a moving frame; comparing the two
          body-energy ledgers removes unknown internal energies. The quantum hypothesis is not
          needed for this step.
        </p>
        <p>
          <a href="/papers/special-relativity/#s8">Relativity §8</a> ·{" "}
          <a href="/lab/sr-10">Finite light complex</a> ·{" "}
          <a href="/papers/mass-energy/">Mass–energy paper</a> ·{" "}
          <a href="/lab/me-01">Two energy ledgers</a>
        </p>
      </section>
      <section className="reading page-flush" id="molecular-number">
        <p className="eyebrow">Separate routes to one number · Companion preview</p>
        <h2>What information lets you infer a molecular number?</h2>
        <p>
          Compare the radiation-constant calculation with Brownian displacement and a joint
          viscosity–diffusion inversion. Remove the independent tracer radius to expose what the
          displacement data cannot identify, or change the viscosity coefficient while holding the
          observations fixed. Historical reconstruction, illustrative inputs, and modern exact
          definitions stay visibly distinct.
        </p>
        <p>
          <a className="button" href="/lab/avogadro-lab">
            Open the three-method comparison
          </a>
        </p>
      </section>
      <section className="reading page-flush" id="counting">
        <p className="eyebrow">Shares a mathematical pattern</p>
        <h2>Counting possibilities without solving every motion</h2>
        <p>
          The light-quanta paper compares the volume dependence of dilute radiation entropy with
          independent configurations. The Brownian paper’s statistical-mechanical argument obtains a
          volume factor and an osmotic pressure. Independence, logarithms, and volume dependence
          connect the reasoning; they do not make light and suspended particles the same mechanism.
        </p>
        <p>
          <a href="/papers/light-quanta/#s5">Light quanta §5</a> ·{" "}
          <a href="/lab/lq-05">Independent configurations</a> ·{" "}
          <a href="/papers/brownian-motion/#s2">Brownian motion §2</a> ·{" "}
          <a href="/lab/bm-03">Configuration integral</a>
        </p>
      </section>
      <section className="reading page-flush" id="light-thread">
        <p className="eyebrow">Later modern synthesis</p>
        <h2>Light as the instrument</h2>
        <p>
          Compare a pulse’s quantum-energy scale, its energy and frequency in another frame, and the
          system boundary needed to discuss inertia. The interactive light thread keeps the pulse
          fixed when only the observer changes.
        </p>
        <p>
          <a className="button" href="/lab/light-thread">
            Open the light-thread laboratory
          </a>
        </p>
      </section>
      <section className="reading page-flush">
        <h2>Keep the direction of inference visible</h2>
        <p>
          Following a connection never substitutes for reading the argument that supplies it. In
          particular, using E = hν in a modern comparison is not evidence that the September paper
          assumed photons, and a simulator that enforces a transformation law is not an experiment
          testing that law.
        </p>
        <p>
          <a href="/">Return to the four papers</a>
        </p>
      </section>
    </>
  );
}
