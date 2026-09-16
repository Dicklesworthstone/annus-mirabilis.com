export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Annalen der Physik · 1905</p>
        <h1>
          Four papers.
          <br />A different way
          <br />
          to ask <em>why.</em>
        </h1>
        <p className="lead">
          Read an argument, change a quantity, and see exactly what follows. Annus Mirabilis is
          becoming an interactive critical edition of Einstein’s four 1905 papers.
        </p>
        <div className="actions">
          <a className="button" href="/discover/brownian-motion/">
            Begin with a wandering particle →
          </a>
          <a href="/papers/brownian-motion/">Read the displacement argument</a>
        </div>
      </section>
      <section className="feature-row">
        <div>
          <p className="eyebrow">Available now · Brownian motion</p>
          <h2>
            When each path is uncertain,
            <br />
            what can still be predictable?
          </h2>
        </div>
        <div>
          <p>
            The tracer ensemble records reproducible synthetic paths; the random-step laboratory
            shows how different step laws approach diffusion; the spreading laboratory explores
            interval probabilities and the diffusion equation. The inference laboratory turns the
            question around: estimate a hidden molecular number, identify the missing inputs, and
            test uncertainty across hypothetical repetitions. The camera laboratory then separates
            physical wandering from exposure blur, localization error, and stage drift.
          </p>
          <p>
            The reading path connects these instruments to six explanatory passages and thirteen
            foundation lessons. Open a missing step, change the level of detail, and return without
            restarting the embedded trial.
          </p>
          <p>
            <a href="/papers/brownian-motion/">Read, investigate, and return to the argument →</a>
          </p>
          <p>
            The worked example remains readable with JavaScript off. The interactive calculation
            starts only when you ask for it.
          </p>
          <a href="/lab/bm-01/">Open the tracer ensemble →</a>
          <p>
            <a href="/lab/bm-05/">Build diffusion from independent steps →</a>
          </p>
          <p>
            <a href="/lab/bm-07/">Infer a hidden molecular number—and test the uncertainty →</a>
          </p>
          <p>
            <a href="/lab/bm-08/">Keep the particle; change the camera and the inference →</a>
          </p>
          <p>
            <a href="/lab/bm-06/">Open the spreading laboratory →</a>
          </p>
          <p>
            <a href="/lab/lq-01/">Interrogate wave interference and spherical energy spreading →</a>
          </p>
          <p>
            <a href="/lab/me-02/">Ask what a drop in energy of motion says about inertia →</a>
          </p>
          <p>
            <a href="/lab/sr-02/">Compare both descriptions of the magnet and conductor →</a>
          </p>
          <p>
            <a href="/lab/sr-03/">Measure moving rods, simultaneity, and causal order →</a>
          </p>
          <p>
            <a href="/lab/sr-09/">
              Watch Doppler and aberration diverge from the medium formulae →
            </a>
          </p>
          <p>
            <a href="/lab/sr-10/">
              Transform the energy and volume of a finite light complex →
            </a>
          </p>
          <p>
            <a href="/lab/lq-06/">
              Match radiation entropy to gas entropy and derive the light quantum →
            </a>
          </p>
        </div>
      </section>
      <section className="reading">
        <h2>Keep the distinctions that matter</h2>
        <p>
          A calculated curve is not an experimental observation. A numerical instability is not a
          physical impossibility. A modern constant is not a verified historical transcription.
          Those distinctions are part of the interface, not qualifications left in a footnote.
        </p>
        <p>
          The German source ledgers and aligned English translation are still in preparation. The
          available reader presents original explanations, not reviewed source text. This preview
          does not substitute a summary for the promised edition.
        </p>
        <a href="/papers/">See the four-paper catalogue →</a>
      </section>
    </>
  );
}
