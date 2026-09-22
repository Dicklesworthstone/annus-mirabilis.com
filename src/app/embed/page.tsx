import type { Metadata } from "next";
import { EmbedBuilder } from "../../components/embed/EmbedBuilder.tsx";
import { EMBED_INSTRUMENTS } from "../../experiments/embed/catalogue.ts";
import { embedPath } from "../../experiments/embed/contract.ts";

export const metadata: Metadata = {
  title: "Embed a laboratory",
  description: "Place a working Annus Mirabilis laboratory in a lesson or another page, retaining its attribution, assumptions and source context.",
  alternates: { canonical: "/embed/" },
  robots: { index: false, follow: true },
};
export default function EmbedIndex() {
  return <>
    <header className="page-intro">
      <p className="eyebrow">Share a working instrument</p>
      <h1>Bring a laboratory into a lesson.</h1>
      <p className="lead">Embed the actual laboratory, not a recording or a second implementation. Its controls, model limitations and links back to the argument stay with it.</p>
    </header>
    <section className="reading">
      <h2>What the embed preserves</h2>
      <p>These adapters reuse the same host-calculation laboratories and built examples as the full edition. They do not supply new physics, reviewed historical data or FrankenSim WASM execution. A changed control starts a calculation in that frame only.</p>
      <p>The generated link contains the chosen instrument and presentation options. It does not contain notes, predictions, uploaded data, accepted parameters or a replay tape. Use the full laboratory’s own sharing controls for supported saved settings.</p>
      <p>Frame content is hosted by Annus Mirabilis. The supplied HTML targets its public hostname and works there only after a build containing these routes is published. Previewing here uses this build’s own origin. Publishing code to the repository does not itself deploy the application.</p>
      <p>Your publishing platform must allow iframes, and its security policy must allow this origin. When a platform strips the frame, retain the fallback link. An embed cannot override the host’s security policy.</p>
    </section>
    <EmbedBuilder />
    <section className="reading">
      <h2>Open an available embed directly</h2>
      <p>These links and every built worked example remain usable without the builder or JavaScript. Interactive controls require JavaScript.</p>
      <ul>{EMBED_INSTRUMENTS.map((item) => <li key={item.id}><a href={embedPath(item.id)}>{item.title}</a>{" · "}<a href={item.source}>Source context</a></li>)}</ul>
      <p>Only instruments with an explicit adapter are offered. Other instruments remain available in the <a href="/instruments/">full Instruments catalogue</a>.</p>
    </section>
  </>;
}
