export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Annalen der Physik · 1905</p>
        <h1>Einstein&rsquo;s four papers of 1905</h1>
        <p className="lead">
          An interactive critical edition of the four papers Einstein sent to Annalen der Physik in
          1905, with his dissertation as a companion. The edition is in preparation. What is
          finished is listed below, and what is missing is named rather than summarised.
        </p>
        <div className="actions">
          <a className="button" href="/discover/brownian-motion/">
            Open the Brownian motion journey
          </a>
          <a href="/papers/brownian-motion/">Read the Brownian motion paper</a>
          <a href="/papers/light-quanta/#entry-light-quanta">Read the light-quanta paper</a>
          <a href="/papers/special-relativity/#entry-special-relativity">
            Read the special relativity paper
          </a>
        </div>
      </section>
      <section className="feature-row">
        <div>
          <p className="eyebrow">Available now · Brownian motion</p>
          <h2>Six laboratories and a reading path</h2>
        </div>
        <div>
          <p>
            The tracer ensemble records reproducible synthetic paths. The random-step laboratory
            shows how different step laws approach diffusion, and the spreading laboratory covers
            interval probabilities and the diffusion equation. The inference laboratory estimates a
            hidden molecular number, names the inputs it does not have, and tests the uncertainty
            across repeated trials. The camera laboratory separates physical wandering from exposure
            blur, localization error, and stage drift.
          </p>
          <p>
            The reading path links these instruments to six explanatory passages and thirteen
            foundation lessons. You can open a missing step, change the level of detail, and return
            without restarting the trial you had running.
          </p>
          <p>
            <a href="/papers/brownian-motion/">Open the reading path for Brownian motion</a>
          </p>
          <p>
            The worked example stays readable with JavaScript off. The interactive calculation
            starts only when you ask for it.
          </p>
          <p>
            <a href="/lab/bm-01/">Open the tracer ensemble</a>
          </p>
          <p>
            <a href="/lab/bm-05/">Build diffusion from independent steps</a>
          </p>
          <p>
            <a href="/lab/bm-07/">Estimate a hidden molecular number</a>
          </p>
          <p>
            <a href="/lab/bm-08/">Change the camera and the inference</a>
          </p>
          <p>
            <a href="/lab/bm-06/">Open the spreading laboratory</a>
          </p>
          <p>
            <a href="/lab/lq-01/">Compare wave interference with spherical spreading</a>
          </p>
          <p>
            <a href="/lab/me-02/">Trace inertia from a drop in energy of motion</a>
          </p>
          <p>
            <a href="/lab/sr-02/">Compare both descriptions of the magnet and conductor</a>
          </p>
          <p>
            <a href="/lab/sr-03/">Measure moving rods, simultaneity, and causal order</a>
          </p>
          <p>
            <a href="/lab/sr-09/">Compare Doppler and aberration with the medium formulae</a>
          </p>
          <p>
            <a href="/lab/sr-10/">Transform the energy and volume of a finite light complex</a>
          </p>
          <p>
            <a href="/lab/sr-13/">Examine electron dynamics under both force conventions</a>
          </p>
          <p>
            <a href="/lab/lq-06/">Match radiation entropy to gas entropy</a>
          </p>
        </div>
      </section>
      <section className="reading">
        <h2>What the interface keeps separate</h2>
        <p>
          A calculated curve is a calculated curve, and the interface says so where the number
          appears: an experimental observation carries a citation, a numerical instability carries
          its stability condition, and a modern constant carries the constant set it came from. None
          of these distinctions is left to a footnote.
        </p>
        <p>
          The German source ledgers and the aligned English translation are still in preparation.
          The reader currently presents explanations written for this edition, not reviewed source
          text, and it says so on every face that has no source yet.
        </p>
        <p>
          <a href="/papers/">See the paper catalogue</a>
        </p>
      </section>
    </>
  );
}
