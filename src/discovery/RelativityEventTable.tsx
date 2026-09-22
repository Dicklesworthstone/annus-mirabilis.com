import type { relativityMeasurement } from "./specialRelativityInvestigation.ts";

/** Both projections of the same authored event pair; no numerical physics runs here. */
export function RelativityEventTable({
  example,
}: {
  example: ReturnType<typeof relativityMeasurement>;
}) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard (WCAG 2.1.1, am-bc6s).
    <section className="sr-event-table" aria-label={example.title} tabIndex={0}>
      <table>
        <caption>{example.title}. Authored arithmetic example, not an observation.</caption>
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Platform x (light-seconds)</th>
            <th scope="col">Platform t (seconds)</th>
            <th scope="col">Moving-frame x′ (light-seconds)</th>
            <th scope="col">Moving-frame t′ (seconds)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">A</th>
            <td>{example.eventA.x}</td>
            <td>{example.eventA.t}</td>
            <td>{example.eventA.xp}</td>
            <td>{example.eventA.tp}</td>
          </tr>
          <tr>
            <th scope="row">B</th>
            <td>{example.eventB.x}</td>
            <td>{example.eventB.t}</td>
            <td>{example.eventB.xp}</td>
            <td>{example.eventB.tp}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
