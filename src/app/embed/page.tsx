import type { Metadata } from "next";
import { EmbedBuilder } from "../../components/embed/EmbedBuilder.tsx";
import { EMBED_INSTRUMENTS } from "../../experiments/embed/catalogue.ts";
import { embedPath } from "../../experiments/embed/contract.ts";

export const metadata: Metadata = {
  title: "Embed a laboratory",
  description:
    "Place a working Annus Mirabilis laboratory in a lesson or another page, retaining its attribution, assumptions and source context.",
  alternates: { canonical: "/embed/" },
  robots: { index: false, follow: true },
};
export default function EmbedIndex() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Share a working instrument</p>
        <h1>Bring a laboratory into a lesson.</h1>
        <p className="lead">
          Embed the actual laboratory, not a recording or a second implementation. Its controls,
          model limitations and links back to the argument stay with it.
        </p>
      </header>
      {/* The builder first: a teacher arrives to make an embed, and the terms below are what they
        check once they have one. */}
      <EmbedBuilder />
      <section className="reading">
        <h2>What an embed keeps, and what it leaves out</h2>
        <p>
          Each embed runs the same laboratory as the edition, starting from the same worked example.
          It adds no physics of its own, no historical data and no FrankenSim result. Changing a
          control recalculates inside that frame only.
        </p>
        <p>
          The link carries the instrument and the presentation options, and nothing else: no notes,
          predictions, uploaded data, applied settings or replay. To share saved settings, use the
          laboratory’s own share control.
        </p>
        <p>
          Your site or learning platform has to allow frames from this address. If it strips the
          frame, the link in the code still takes a reader to the laboratory.
        </p>
      </section>
      <section className="reading">
        <h2>Open an available embed directly</h2>
        <p>
          These links and every built worked example remain usable without the builder or
          JavaScript. Interactive controls require JavaScript.
        </p>
        <ul>
          {EMBED_INSTRUMENTS.map((item) => (
            <li key={item.id}>
              <a href={embedPath(item.id)}>{item.title}</a>
              {" · "}
              <a href={item.source}>Source context</a>
            </li>
          ))}
        </ul>
        <p>
          These are the laboratories that can be embedded so far. Every other instrument is in the{" "}
          <a href="/instruments/">full Instruments catalogue</a>.
        </p>
      </section>
    </>
  );
}
