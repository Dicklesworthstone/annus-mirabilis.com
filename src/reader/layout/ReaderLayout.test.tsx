import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Companion } from "./Companion.tsx";
import { ReaderLayout } from "./ReaderLayout.tsx";
import { OverflowRegion, SplitTabs } from "./SplitTabs.tsx";

describe("ReaderLayout markup (am-read-page-anatomy-l0b)", () => {
  const html = renderToStaticMarkup(
    <ReaderLayout
      outline={<nav>Outline</nav>}
      companion={
        <Companion kind="explanation">
          <p>Margin notes for this passage.</p>
        </Companion>
      }
    >
      <article id="arg-bm-observable">
        <p>Zero average is not no movement.</p>
      </article>
    </ReaderLayout>,
  );

  it("holds a passage, a companion column, and a bottom sheet in the same HTML", () => {
    assert.match(html, /data-reader-anatomy/);
    assert.match(html, /data-reader-main/);
    assert.match(html, /arg-bm-observable/);
    assert.match(html, /data-reader-companion-column/);
    assert.match(html, /data-bottom-sheet/);
    assert.match(html, /Margin notes for this passage/);
  });

  it("renders no companion switch by default: a static export cannot serve ?companion=", () => {
    // Every such link reloaded the same page and dropped the reader's passage (Companion.tsx).
    assert.doesNotMatch(html, /\?companion=/);
  });

  it("a switchable companion renders all four kinds, the current one marked", () => {
    const switchable = renderToStaticMarkup(
      <Companion kind="laboratory" switchable>
        <p>Beside this passage.</p>
      </Companion>,
    );
    for (const kind of ["original", "explanation", "equation", "laboratory"])
      assert.match(switchable, new RegExp(`href="\\?companion=${kind}"`));
    assert.match(switchable, /aria-current="page"[^>]*>Laboratory</);
  });

  it("the bottom sheet is a details/summary, not a drag-only handle", () => {
    assert.match(html, /<details[^>]*data-bottom-sheet/);
    assert.match(html, /<summary>Notes and laboratory<\/summary>/);
    assert.equal(/onPointerMove|onDrag/.test(html), false);
  });
});

describe("SplitTabs and overflow regions", () => {
  it("split tabs keep the pane pair in the URL", () => {
    const html = renderToStaticMarkup(
      <SplitTabs panes={["source", "explanation"]} active="source" />,
    );
    assert.match(html, /role="tablist"/);
    assert.match(html, /href="\?view=split&amp;pane=source"/);
    assert.match(html, /aria-selected="true"/);
  });

  it("an authored multi-line equation is not wrapped in a scroll region", () => {
    const html = renderToStaticMarkup(
      <OverflowRegion authoredMultiline={true}>
        <span>row one</span>
      </OverflowRegion>,
    );
    assert.match(html, /reader-multiline-equation/);
    assert.equal(html.includes("reader-local-overflow"), false);
  });

  it("an equation without an authored form gets a keyboard-scrollable local region", () => {
    const html = renderToStaticMarkup(
      <OverflowRegion authoredMultiline={false}>
        <span>wide formula</span>
      </OverflowRegion>,
    );
    assert.match(html, /reader-local-overflow/);
    assert.match(html, /<section/);
    assert.match(html, /Scroll sideways from the keyboard/);
    assert.match(html, /data-overflow-affordance="true"/);
  });
});
