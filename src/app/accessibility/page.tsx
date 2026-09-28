import type { Metadata } from "next";
import "../../components/home/wideProse.css";
import "../about/about.css";
import { criteriaCounts } from "./criteriaCounts.ts";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "What this edition aims for, what has been checked and how, what has not been checked, the reading preferences it offers, and how to report a barrier. It does not yet claim conformance.",
};

const REPOSITORY = "https://github.com/Dicklesworthstone/annus-mirabilis.com";

/**
 * /accessibility/ (am-design-sources-about-zumd), in its pending state. The statement proper is
 * written from recorded testing rounds with disabled readers using their own tools
 * (am-a11y-disabled-reader-rounds-jkjr, a human gate). None has been recorded, so this page states
 * the target, says exactly what has been checked and by what means, says what has NOT been checked,
 * and claims no conformance.
 *
 * WHY THE COUNTS ARE READ RATHER THAN WRITTEN. A page that states how much has been checked is a
 * page whose numbers rot silently, and a reader cannot tell a stale figure from a current one. The
 * criteria counts come from `docs/accessibility/wcag-22-map.yaml` at build time
 * (./criteriaCounts.ts), and the page's own test re-derives them and asserts the rendered text
 * matches. A rule existing is still not the site meeting it, and the page says so in words next to
 * every number.
 *
 * NO REVIEW BANNER. D-2026-09-25-no-review-status-banners forbids stamping a review status on a
 * READING page, where a banner displaces the text a reader came for. This is not a reading page: it
 * is the statement about verification itself, and on it the unverified half is the substance rather
 * than a chip on top of something else. So the limits are written as prose in their own section.
 */
export default function AccessibilityPage() {
  const criteria = criteriaCounts();

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

      <section className="reading page-flush about-section" aria-labelledby="a11y-aim">
        <h2 id="a11y-aim">What the edition is trying to do for you</h2>
        <p>
          The test this site sets itself is not whether a page can be reached but whether you can do
          the thinking it exists for: compare the times two observers assign to the same pair of
          events, choose which statistic a set of displacements should be summarised by, change a
          parameter and see what follows, inspect where an energy balance closes, and read a
          derivation step by step. Every laboratory carries a way to take those actions without
          dragging, without telling colours apart, without sound, and without a drawing canvas. A
          long description of a picture is not the same thing as being able to interrogate it.
        </p>
        <p>
          The source German, the English translation, the explanations at four depths, every
          equation and every static worked example are in the page as it arrives. They do not wait
          on JavaScript, a fast connection, or a graphics processor.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="a11y-checked">
        <h2 id="a11y-checked">What has been checked</h2>
        <p>
          WCAG 2.2 is mapped criterion by criterion in the repository, at{" "}
          <a href={`${REPOSITORY}/blob/main/docs/accessibility/wcag-22-map.yaml`}>
            docs/accessibility/wcag-22-map.yaml
          </a>
          . It covers {criteria.total} criteria, {criteria.levelA} at level A and {criteria.levelAA}{" "}
          at level AA. Of those, {criteria.withRule} carry a rule, the check that enforces it and
          the person or bead that owns it, and {criteria.notApplicable} are recorded as not
          applicable with a reason and the change that would make them apply again. Nothing is left
          undisposed. A criterion having a rule is not the same as the site meeting it, and the map
          is a record of intent and machinery rather than a result.
        </p>
        <p>
          The automated checks that back those rules run as part of the ordinary test suite: 112
          tests across 17 files, none failing, measured on 28 September 2026 with{" "}
          <code>bun test src/testing/a11y/</code>. They cover the contrast of every text colour in
          both the light and the dark theme, the name each control gives a screen reader, keyboard
          operation and focus order, the colours an operating system can force, and the layout at
          every offered combination of line length, type size and paragraph spacing. They run in
          Chromium and in WebKit.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="a11y-unchecked">
        <h2 id="a11y-unchecked">What has not been checked</h2>
        <p>
          No round of testing with disabled readers, using their own tools, has been recorded. That
          is the test that counts, and until it happens the sentences above describe machinery
          rather than experience. The protocol for those rounds is written and waiting at{" "}
          <a href={`${REPOSITORY}/blob/main/docs/accessibility/manual-protocol.md`}>
            docs/accessibility/manual-protocol.md
          </a>
          ; the roles that would run them, an accessibility co-design facilitator and a real-device
          tester, are recorded as open and recruiting alongside the project&rsquo;s other
          independent review roles.
        </p>
        <p>
          Automated checks are not sufficient on their own and this page does not present them as
          though they were. A test can confirm that a control has a name; it cannot tell you whether
          the name is the right one, whether the order of the page makes sense on a fourth reading,
          or whether an instrument can be operated by someone who is tired. The W3C&rsquo;s
          supplemental guidance on cognitive accessibility is followed here as guidance, and no
          claim is made against it.
        </p>
        <p>
          Mathematics is the part most likely to fail you, and it is checked least by machine. Each
          equation carries a spoken form written by hand rather than generated, because generated
          speech is frequently wrong for physics notation, and those forms have been read against
          screen readers in automated runs but not yet by a person who depends on one.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="a11y-preferences">
        <h2 id="a11y-preferences">Reading preferences</h2>
        <p>
          The <i>Aa</i> button at the top of every page opens the reading preferences. Line length
          has three settings, type size four, paragraph spacing two, and contrast can be raised; the
          combinations offered are the ones tested at phone, tablet and desktop widths, and
          combinations that have not been tested are not offered. Reading-only stops anything that
          moves or loads by itself while keeping every explanation, equation and static worked
          example in place; it defers cost, and never removes content.
        </p>
        <p>
          Your choices are applied before the page first appears, so there is no flash of one layout
          replaced by another, and they stay in your browser rather than on a server. If your
          browser refuses to store them they last for the session and the page still works. What is
          stored, and how to clear it, is set out on <a href="/your-data/">what this site stores</a>
          .
        </p>
        <p>
          If your system asks for reduced motion, animation stops and the current state stays on
          screen rather than disappearing with it. Sound never starts on its own, and nothing on the
          site requires hearing.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="a11y-report">
        <h2 id="a11y-report">Reporting a barrier</h2>
        <p>
          If something here stops you, that is worth knowing about and it will be treated as a
          defect rather than a preference. Say what you were trying to do, the address of the page,
          and the browser and assistive technology you were using, through the{" "}
          <a href={`${REPOSITORY}/issues`}>project&rsquo;s issue tracker</a>. A report that names
          the action you could not complete is more useful than one that names a rule, though either
          is welcome.
        </p>
        <p>
          The edition and the reasoning behind it are described on <a href="/about/">about</a>, and
          the notation each paper uses, with the collisions called out, on{" "}
          <a href="/notation/">notation</a>.
        </p>
      </section>
    </div>
  );
}
