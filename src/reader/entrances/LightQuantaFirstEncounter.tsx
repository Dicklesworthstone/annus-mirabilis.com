"use client";

import { useEffect, useId, useState } from "react";
import type { EntranceRecord } from "../../content/entrances/entranceRecord.ts";
import {
  partName,
  requireTokenExample,
  TOKEN_INITIAL,
  TOKEN_WORKED_EXAMPLES,
  type TokenExample,
} from "./lightQuantaExample.ts";
import "./countingEntrance.css";

/**
 * No tabIndex on the table container. Measured against the built site at every authored
 * setup, including the widest one the controls reach (four tokens, three parts), it never
 * overflows: 320px 288/288 and 1280px 780/780 scrollWidth over clientWidth.
 * `encounter-table` is not one of the AUDITED_SCROLL_CLASSES in
 * src/testing/a11y/scrollableRegions.test.ts, so this is a removal that satisfies both
 * that ratchet and a11y/noNoninteractiveTabindex (am-6iz4).
 *
 * A plain div, not a named section: the table renders nine times with one label, which made
 * nine landmarks of the same name (axe landmark-unique). Each table's caption names it.
 */
function OutcomeTable({ example }: { example: TokenExample }) {
  return (
    <div className="encounter-table">
      <table>
        <caption>
          {example.favorable} of {example.total} equally likely arrangements put every token in the
          left part.
        </caption>
        <thead>
          <tr>
            <th scope="col">Arrangement</th>
            <th scope="col">Where each labeled token lands</th>
            <th scope="col">All left?</th>
          </tr>
        </thead>
        <tbody>
          {example.arrangements.map((row, i) => (
            <tr key={`arrangement-${row.parts.join("-")}`}>
              <th scope="row">{i + 1}</th>
              <td>
                {row.parts
                  .map((part, token) => `${token + 1}: ${partName(part, example.setup.parts)}`)
                  .join(", ")}
              </td>
              <td>{row.allLeft ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shared content for a paper entrance or an editorially approved journey embed. */
export function LightQuantaFirstEncounter({ record }: { record: EntranceRecord }) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [example, setExample] = useState(TOKEN_INITIAL);
  const [placement, setPlacement] = useState(0);
  useEffect(() => {
    setReady(true);
  }, []);
  const row = example.arrangements[placement] ?? example.arrangements[0]!;
  function change(tokens: number, parts: number, locked: boolean) {
    setExample(requireTokenExample({ tokens, parts, locked }));
    setPlacement(0);
  }
  return (
    <section
      id="entry-light-quanta"
      tabIndex={-1}
      className="reader-passage counting-entrance"
      data-encounter-id={record.id}
      aria-labelledby={`${id}-title`}
    >
      <p className="eyebrow">First encounter · No algebra required</p>
      <h2 id={`${id}-title`}>{record.question}</h2>
      <p>{record.story}</p>
      <p className="notice">
        Authored counting examples, not measurements or movies of motion. Parts have equal size and
        no part is favored.
      </p>
      <h3>Try changing one thing</h3>
      <fieldset disabled={!ready}>
        <legend>One box, one set of choices</legend>
        <label htmlFor={`${id}-tokens`}>Tokens</label>{" "}
        <select
          id={`${id}-tokens`}
          value={example.setup.tokens}
          onChange={(event) =>
            change(Number(event.target.value), example.setup.parts, example.setup.locked)
          }
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>{" "}
        <label htmlFor={`${id}-parts`}>Equal parts</label>{" "}
        <select
          id={`${id}-parts`}
          value={example.setup.parts}
          onChange={(event) =>
            change(example.setup.tokens, Number(event.target.value), example.setup.locked)
          }
        >
          <option value={2}>Two</option>
          <option value={3}>Three</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={example.setup.locked}
            onChange={(event) =>
              change(example.setup.tokens, example.setup.parts, event.target.checked)
            }
          />
          Keep all tokens in the same part
        </label>
      </fieldset>
      <p role="status" aria-live="polite" aria-atomic="true" data-count-summary>
        {example.setup.tokens} tokens, {example.setup.parts} equal parts,{" "}
        {example.setup.locked ? "one shared choice" : "each token chooses independently"}:{" "}
        {example.favorable} of {example.total} arrangements put all tokens in the left part.
      </p>
      <figure>
        <svg
          viewBox="0 0 320 150"
          role="img"
          aria-label={`Arrangement ${placement + 1}. ${row.parts.map((part, i) => `Token ${i + 1} in the ${partName(part, example.setup.parts)} part`).join(". ")}`}
        >
          {/*
            Keyed on the part's printed name rather than its ordinal. The names
            are what the diagram and its aria-label call these boxes, so they are
            the identity a reader would use, and they are unique within a setup.
          */}
          {Array.from({ length: example.setup.parts }, (_, part) => (
            <g key={partName(part, example.setup.parts)}>
              <rect
                x={5 + (part * 310) / example.setup.parts}
                y={5}
                width={310 / example.setup.parts}
                height={130}
                fill="none"
                stroke="currentColor"
              />
              <text x={5 + ((part + 0.5) * 310) / example.setup.parts} y={26} textAnchor="middle">
                {partName(part, example.setup.parts)}
              </text>
            </g>
          ))}
          {/*
            The index is this token's identity, not a stand-in for one: the
            circle is labeled `token + 1`, the aria-label calls it "Token n",
            and the caption says the labels are what distinguish tokens. A
            composite key would dress the same ordinal up as something else.
            noArrayIndexKey is refused for this file in biome.json, and
            formatterExclusions.test.ts fails if this site stops existing.
          */}
          {row.parts.map((part, token) => (
            <g key={token}>
              <circle
                cx={5 + ((part + 0.5) * 310) / example.setup.parts + (token % 2 ? 20 : -20)}
                cy={60 + Math.floor(token / 2) * 40}
                r={14}
                fill="none"
                stroke="currentColor"
              />
              <text
                x={5 + ((part + 0.5) * 310) / example.setup.parts + (token % 2 ? 20 : -20)}
                y={65 + Math.floor(token / 2) * 40}
                textAnchor="middle"
              >
                {token + 1}
              </text>
            </g>
          ))}
        </svg>
        <figcaption>
          Arrangement {placement + 1} of {example.total}. Labels distinguish tokens. Positions
          within a part are drawn only to keep the labels readable.
        </figcaption>
      </figure>
      <div className="actions">
        <button
          type="button"
          disabled={!ready || placement === 0}
          onClick={() => setPlacement((i) => i - 1)}
        >
          Previous arrangement
        </button>
        <button
          type="button"
          disabled={!ready || placement === example.total - 1}
          onClick={() => setPlacement((i) => i + 1)}
        >
          Next arrangement
        </button>
      </div>
      <OutcomeTable example={example} />
      <p>
        <a data-current-token-lab href={example.labHref}>
          Load this exact setup in the counting laboratory →
        </a>
      </p>
      <p className="fine">
        In the laboratory, choose Apply settings to calculate the loaded setup. Until then its
        prepared example stays visible.
      </p>
      <h3>Read every example without using the controls</h3>
      <p>
        For three or four tokens, try counting the arrangements before opening the table. No
        prediction is required.
      </p>
      {TOKEN_WORKED_EXAMPLES.map((item) => (
        <details
          key={`${item.setup.tokens}-${item.setup.parts}-${item.setup.locked ? "locked" : "free"}`}
          data-token-worked
        >
          <summary>
            {/* One token is neither independent nor kept together - the two series start from
                the same case - and "1 independent tokens" was the only thing it could say. */}
            {item.setup.tokens === 1
              ? "1 token"
              : `${item.setup.tokens} ${item.setup.locked ? "tokens kept together" : "independent tokens"}`}{" "}
            in {item.setup.parts} equal parts
          </summary>
          <OutcomeTable example={item} />
        </details>
      ))}
      <p>
        In two equal parts, each extra independent token halves the chance again. In three equal
        parts, each extra independent token divides it by three. Ten tokens always kept together
        still have just one shared choice.
      </p>
      <p>
        <strong>Counting tokens is not evidence that light is made of dots.</strong> The same count
        can help us recognize a pattern without proving what causes it.
      </p>
      <details>
        <summary>What is getting in the way?</summary>
        {record.helpEntries.map((entry) => (
          <section key={entry.obstacle}>
            <h4>{entry.obstacle}</h4>
            <p>{entry.clarification}</p>
          </section>
        ))}
      </details>
      <section className="entrance-bridge" aria-labelledby={`${id}-bridge`}>
        <h3 id={`${id}-bridge`}>Next: why this counting pattern matters</h3>
        <p>
          Physicists keep a bookkeeping number called entropy. It goes up by the same step each time
          the number of arrangements is multiplied by the same factor.
        </p>
        <p>{record.bridge.newSkill}</p>
        <p>{record.bridge.whyUsefulHere}</p>
        <p>
          This is an “as if” comparison in one restricted setting, not a general proof about light.
          The radiation calculation comes first in section 4; the interpretation follows in section
          6.
        </p>
        <p>
          <a
            href="/foundations/bridge-fractions-ratios/"
            data-foundation="bridge-fractions-ratios"
            data-return-caption="Back to the first encounter: the chance that all tokens sit in the left part."
          >
            More guidance: reading a fraction of the possibilities →
          </a>
        </p>
        <p>
          <a href={TOKEN_INITIAL.labHref}>Show the two-token example in the instrument →</a>
        </p>
        <p>
          <a href="/papers/light-quanta/s5/#arg-lq-independent-configurations">
            Continue to the section 5 counting argument →
          </a>
        </p>
        <p>
          <a href="/papers/light-quanta/s6/#arg-lq-entropy-correspondence">
            Then inspect the section 6 “as if” inference →
          </a>
        </p>
        <p className="fine">Both links lead to our explanation of those sections.</p>
      </section>
    </section>
  );
}
