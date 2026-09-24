import type { Metadata } from "next";
import "../../components/home/wideProse.css";
import "../about/about.css";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "What this edition aims for, what has been checked and how, the reading preferences it offers, and how to report a barrier. It does not yet claim conformance.",
};

const REPOSITORY = "https://github.com/Dicklesworthstone/annus-mirabilis.com";

/**
 * /accessibility/ (am-design-sources-about-zumd), in its pending state. The statement proper is
 * written from recorded testing rounds with disabled readers using their own tools
 * (am-a11y-disabled-reader-rounds-jkjr, a human gate). None has been recorded, so this page states
 * the target, says exactly what has been checked and by what means, and claims no conformance.
 * docs/accessibility/wcag-22-map.yaml maps every criterion to a rule and a check; a rule existing
 * is not the site meeting it, so its counts are not shown here as if they were.
 */
export default function AccessibilityPage() {
  return (
    <div>
      <header className="page-intro page-flush">
        <p className="eyebrow">Accessibility</p>
        <h1>Reading this edition your way</h1>
        <p className="lead">
          The edition is built to be read and used from a keyboard, with a screen reader, without
          colour and without JavaScript, and it aims at WCAG 2.2 level AA. It does not yet claim to
          meet it.
        </p>
      </header>

      <section className="reading page-flush about-section" aria-labelledby="a11y-checked">
        <h2 id="a11y-checked">What has been checked</h2>
        <p>
          The contrast of every text colour, in both the light and the dark theme, is checked by the
          site&rsquo;s own tests. Keyboard operation, and the high-contrast colours an operating
          system can impose, have been checked by hand in Chromium; the names a screen reader
          announces, in Chromium and WebKit.
        </p>
        <p>
          No round of testing with disabled readers, using their own tools, has been recorded yet.
          That is the test that counts, and this page will carry what it finds, barriers included.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="a11y-preferences">
        <h2 id="a11y-preferences">Reading preferences</h2>
        <p>
          The <i>Aa</i> button at the top of every page sets the line length, the type size, the
          contrast and the paragraph spacing, and Reading-only keeps every explanation and worked
          example while stopping anything that moves or loads by itself. The choices stay in your
          browser and apply before the page first appears.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="a11y-report">
        <h2 id="a11y-report">Reporting a barrier</h2>
        <p>
          If something on the site stops you, say what you were trying to do, the page, and the
          browser and assistive technology you use, through the{" "}
          <a href={`${REPOSITORY}/issues`}>project&rsquo;s issue tracker</a>.
        </p>
      </section>
    </div>
  );
}
