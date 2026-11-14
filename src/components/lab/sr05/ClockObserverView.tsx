import type { WorldlinePreset } from "../../../experiments/sr05/definition.ts";
import {
  type ClockEventRow,
  clockEventName,
  clockEventRows,
} from "../../../experiments/sr05/observer.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { readablePowers } from "../presentation.ts";

function fmt(value: number): string {
  const [mantissa = "", exponent] = value.toPrecision(6).split("e");
  const digits = mantissa.includes(".")
    ? mantissa.replace(/0+$/u, "").replace(/\.$/u, "")
    : mantissa;
  return readablePowers(exponent === undefined ? digits : `${digits}e${exponent}`);
}

export function ClockObserverView({
  outputs,
  preset,
  beta,
  id,
}: Readonly<{
  outputs: readonly PublishedResult[];
  preset: WorldlinePreset;
  beta: number;
  id: string;
}>) {
  const rows = clockEventRows(outputs);
  if (!rows)
    return (
      <p className="notice">The named event comparison is unavailable in this accepted example.</p>
    );
  const circle = preset === "circle";
  return (
    <section
      aria-labelledby={`${id}-title`}
      data-testid="sr05-observer-view"
      data-observer-beta={beta}
    >
      <h3 id={`${id}-title`}>The same events in two descriptions</h3>
      <p>
        The platform is K. The second inertial frame, K′, moves at {fmt(beta)}c along K’s x axis.
        The origins coincide at departure, where both origin clocks read zero. Changing this
        observer assigns new coordinates to the same events; each clock keeps the reading it
        displayed there.
      </p>
      <div className="sr05-observer-plots">
        <EventPlot
          rows={rows}
          frame="platform"
          title="Platform coordinates K"
          titleId={`${id}-platform-plot`}
        />
        <EventPlot
          rows={rows}
          frame="observer"
          title={`Observer coordinates K′ at ${fmt(beta)}c`}
          titleId={`${id}-observer-plot`}
        />
      </div>
      <p className="fine">
        Squares mark the platform clock; circles mark the traveller. These x–t plots show named
        events, without joining them into a trajectory.{" "}
        {circle
          ? "The circular trip is one complete revolution in the x–y plane; its y coordinates are shown in the table. Overlapping x–t markers can be separated in y: at nonzero speed, only departure and completion are shared events. At zero speed the circle shrinks to one position."
          : "Both paths lie on the x axis, so every y coordinate is zero."}
      </p>
      <section
        className="sr05-event-table"
        aria-label="Coordinates and clock readings at the same events"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: this overflow region needs a tab stop for keyboard scrolling.
        tabIndex={0}
      >
        <table>
          <caption>
            Fixed events chosen at departure and at each quarter of the platform interval. Local
            clock readings are in seconds; coordinates use seconds and light-seconds.
          </caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Event phase in K
              </th>
              <th scope="col" rowSpan={2}>
                Clock
              </th>
              <th scope="col" rowSpan={2}>
                Own reading (s)
              </th>
              <th scope="colgroup" colSpan={circle ? 3 : 2}>
                Platform K
              </th>
              <th scope="colgroup" colSpan={circle ? 3 : 2}>
                Observer K′
              </th>
            </tr>
            <tr>
              <th scope="col">t (s)</th>
              <th scope="col">x (ls)</th>
              {circle && <th scope="col">y (ls)</th>}
              <th scope="col">t′ (s)</th>
              <th scope="col">x′ (ls)</th>
              {circle && <th scope="col">y′ (ls)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.marker.id}
                data-clock-event={row.marker.id}
                data-clock-id={row.marker.clockId}
              >
                <th scope="row">{clockEventName(row.marker, preset)}</th>
                <td>{row.marker.clockId === "sr05-platform-clock" ? "Platform" : "Traveller"}</td>
                <td data-event-reading>{fmt(row.reading)}</td>
                <td data-event-time-k>{fmt(row.platform.t)}</td>
                <td data-event-x-k>{fmt(row.platform.x)}</td>
                {circle && <td data-event-y-k>{fmt(row.platform.y)}</td>}
                <td data-event-time-observer>{fmt(row.observer.t)}</td>
                <td data-event-x-observer>{fmt(row.observer.x)}</td>
                {circle && <td data-event-y-observer>{fmt(row.observer.y)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p>
        Two rows chosen at the same platform time need not have the same observer time. They are
        records of fixed events, not a comparison of separated clocks at one K′ time. The y
        coordinate stays unchanged under this boost along x.{" "}
        {preset === "inertial"
          ? "At nonzero straight-trip speed, the final readings occur at different places; at zero speed the clocks stay together. This preset does not calculate a return comparison."
          : "At reunion the two clocks share one event in both descriptions, and their reading difference stays the same."}
      </p>
    </section>
  );
}

/** Plot only accepted coordinates. Both panels share the same coordinate-to-pixel scale. */
function EventPlot({
  rows,
  frame,
  title,
  titleId,
}: Readonly<{
  rows: readonly ClockEventRow[];
  frame: "platform" | "observer";
  title: string;
  titleId: string;
}>) {
  const all = rows.flatMap((row) => [row.platform, row.observer]);
  const maxTime = Math.max(...all.map((event) => event.t));
  const maxX = Math.max(maxTime / 2, ...all.map((event) => Math.abs(event.x)));
  const scale = Math.min(138 / maxX, 210 / maxTime);
  const x = (value: number) => 180 + value * scale;
  const y = (value: number) => 242 - value * scale;
  return (
    <figure className="sr05-event-plot">
      <svg viewBox="0 0 360 282" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {`${title}: fixed events with unchanged local clock readings. The table gives every coordinate.`}
        </title>
        <line x1={35} y1={242} x2={325} y2={242} className="sr05-event-axis" />
        <line x1={180} y1={242} x2={180} y2={20} className="sr05-event-axis" />
        <text x={185} y={17}>
          {frame === "platform" ? "t (s)" : "t′ (s)"}
        </text>
        <text x={276} y={275}>
          {frame === "platform" ? "x (ls)" : "x′ (ls)"}
        </text>
        <text x={174} y={258}>
          0
        </text>
        <text x={187} y={y(maxTime) - 5}>
          {fmt(maxTime)}
        </text>
        <text x={x(-maxX)} y={258}>
          {fmt(-maxX)}
        </text>
        <text x={x(maxX) - 10} y={258}>
          {fmt(maxX)}
        </text>
        {rows.map((row) =>
          row.marker.clockId === "sr05-platform-clock" ? (
            <rect
              key={row.marker.id}
              className="sr05-event-platform"
              x={x(row[frame].x) - 5}
              y={y(row[frame].t) - 5}
              width={10}
              height={10}
            />
          ) : (
            <circle
              key={row.marker.id}
              className="sr05-event-traveller"
              cx={x(row[frame].x)}
              cy={y(row[frame].t)}
              r={4}
            />
          ),
        )}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
}
