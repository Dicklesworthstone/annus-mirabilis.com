import { Fragment } from "react";
import type { InstrumentWorkedCase, WorkedCaseCell, WorkedCaseRun } from "./types.ts";

function Runs({ runs }: { runs: readonly WorkedCaseRun[] }) {
  return runs.map((run, index) => {
    const key = String(index) + ":" + run.t;
    return run.s === "sup" ? (
      <sup key={key}>{run.t}</sup>
    ) : run.s === "sub" ? (
      <sub key={key}>{run.t}</sub>
    ) : (
      <Fragment key={key}>{run.t}</Fragment>
    );
  });
}

function Cells({
  cells,
  heading = false,
}: {
  cells: readonly WorkedCaseCell[];
  heading?: boolean;
}) {
  return cells.map((cell, index) => {
    const key = String(index) + ":" + cell.content.map((run) => run.t).join("");
    const span = { colSpan: cell.colSpan, rowSpan: cell.rowSpan };
    return cell.header || heading ? (
      <th key={key} scope={heading ? "col" : "row"} {...span}>
        <Runs runs={cell.content} />
      </th>
    ) : (
      <td key={key} {...span}>
        <Runs runs={cell.content} />
      </td>
    );
  });
}

export function WorkedCaseUnavailable({
  instrumentId,
  mode,
}: {
  instrumentId: string;
  mode: string | null;
}) {
  return (
    <p data-prepared-case-unavailable>
      {mode
        ? "A prepared worked example for this mode is not available in this edition."
        : "A prepared worked example is not available here in this edition."}{" "}
      <a href={"/lab/" + instrumentId + "/"}>Read the full laboratory and its worked examples</a>.
    </p>
  );
}

/** Fixed publication data only: a later live result can never relabel or overwrite this case. */
export function WorkedCase({
  record,
  instrumentId,
  mode,
}: {
  record: InstrumentWorkedCase | undefined;
  instrumentId: string;
  mode: string | null;
}) {
  const address = mode ? instrumentId + ":" + mode : instrumentId;
  if (record?.kind !== "prepared" || record.address !== address) {
    return <WorkedCaseUnavailable instrumentId={instrumentId} mode={mode} />;
  }
  const qualitative =
    record.tables.length === 0 &&
    record.statements.every((statement) => statement.kind === "qualitative");
  return (
    <div data-prepared-worked-case={address} data-example-origin={record.origin}>
      <p className="fine">
        {record.title}.{" "}
        {qualitative ? "Prepared qualitative reconstruction" : "Prepared model example"} using the
        default settings below.
        {record.mode ? " Mode: " + record.mode + "." : ""} This example stays fixed when you use the
        live experiment.
      </p>
      {record.notes.map((note) => (
        <p className="fine" key={note}>
          {note}
        </p>
      ))}
      <details>
        <summary>Settings used for this example</summary>
        <dl>
          {record.settings.map((setting) => (
            <Fragment key={setting.label + ":" + setting.value}>
              <dt>{setting.label}</dt>
              <dd>{setting.value}</dd>
            </Fragment>
          ))}
        </dl>
        {record.omittedSettings > 0 && (
          <p className="fine">
            The full laboratory lists {record.omittedSettings} further settings.
          </p>
        )}
      </details>
      {record.statements.map((statement, index) => (
        <p key={String(index)} data-prepared-statement={statement.kind}>
          <Runs runs={statement.content} />
        </p>
      ))}
      {record.omittedStatements > 0 && (
        <p className="fine">
          The full laboratory has {record.omittedStatements} further accepted readouts.
        </p>
      )}
      {record.tables.map((table, index) => (
        <Fragment key={String(index) + ":" + table.caption}>
          <section
            className="table-scroll"
            aria-label={table.caption}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: prepared tables can overflow at large type sizes and remain keyboard-scrollable without the live lab
            tabIndex={0}
          >
            <table>
              <caption>{table.caption}</caption>
              {table.headings.length > 0 && (
                <thead>
                  {table.headings.map((row, rowIndex) => (
                    <tr key={String(rowIndex)}>
                      <Cells cells={row} heading />
                    </tr>
                  ))}
                </thead>
              )}
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={String(rowIndex)}>
                    <Cells cells={row} />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {table.omittedRows > 0 && (
            <p className="fine">
              The full laboratory has {table.omittedRows} more rows in this table.
            </p>
          )}
        </Fragment>
      ))}
      {record.omittedTables > 0 && (
        <p className="fine">
          The full laboratory has {record.omittedTables} further result tables.
        </p>
      )}
      <p className="fine">
        Not modeled: {record.notModeled.map((item) => item.trim().replace(/\.$/, "")).join("; ")}.
      </p>
      <nav aria-label="Sources for the prepared example">
        <ul>
          {record.sources.map((source) => (
            <li key={source.href}>
              <a href={source.href}>{source.label}</a>
            </li>
          ))}
        </ul>
        <a href={"/lab/" + instrumentId + "/"}>Read the full laboratory</a>
      </nav>
    </div>
  );
}
