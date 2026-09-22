import type { Journey } from "../content/schemas/journey.ts";
import { Doors } from "./Doors.tsx";
import { ExerciseList } from "./ExerciseList.tsx";
import { Fork } from "./Fork.tsx";
import { MoveMarker } from "./MoveMarker.tsx";
import { PpeTask } from "./PpeTask.tsx";
import { SourceJump } from "./SourceJump.tsx";
import { Stage } from "./Stage.tsx";
import { WorldCheck } from "./WorldCheck.tsx";

export interface JourneyPageProps {
  readonly journey: Journey;
}

export function JourneyPage({ journey }: JourneyPageProps) {
  const {
    id,
    paper,
    completeness,
    pendingElements,
    admittedImports,
    shelf,
    naggingFact,
    firstHonestQuestion,
    stages,
    forks,
    move,
    worldChecks,
    sourceJumps,
    exercises,
    ppeTask,
    doors,
  } = journey;

  return (
    <article
      data-journey-id={id}
      data-theme="kramgasse-night"
      style={{
        maxWidth: "56rem",
        margin: "0 auto",
        padding: "2rem 1rem",
        color: "var(--ink)",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "2.5rem",
          paddingBottom: "2rem",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <p
          className="eyebrow"
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--accent)",
            margin: 0,
          }}
        >
          Discover · A route you could take
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: "2.25rem",
            fontWeight: "bold",
            lineHeight: 1.2,
            margin: 0,
            color: "var(--ink)",
          }}
        >
          {paper}
        </h1>

        {/* Partial Draft Banner */}
        {completeness === "partial" && pendingElements && pendingElements.length > 0 && (
          <aside
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              fontSize: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <span
              className="eyebrow"
              style={{
                fontWeight: "bold",
                color: "var(--accent)",
                letterSpacing: "0.05em",
                margin: 0,
              }}
            >
              Draft Journey · Pending Elements Declared
            </span>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                color: "var(--ink)",
              }}
            >
              {pendingElements.map((pe) => (
                <li
                  key={`${pe.ownerBead}-${pe.element}`}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {pe.element}:
                  </span>
                  <span>{pe.reason}</span>
                  <span
                    className="fine"
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.6875rem",
                    }}
                  >
                    ({pe.ownerBead})
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Nagging Fact */}
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "0.75rem",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.05em",
              fontWeight: 600,
              display: "block",
            }}
          >
            The Nagging Fact
          </span>
          <p
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "1.125rem",
              fontStyle: "italic",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            "{naggingFact}"
          </p>
        </div>

        {/* First Honest Question */}
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "0.75rem",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.05em",
              color: "var(--accent)",
              fontWeight: 600,
              display: "block",
            }}
          >
            The First Honest Question
          </span>
          <p
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "1.25rem",
              fontWeight: "bold",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {firstHonestQuestion}
          </p>
        </div>

        {/* The 1904 Shelf */}
        {shelf && shelf.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.5rem",
              paddingTop: "0.5rem",
              fontSize: "0.75rem",
            }}
          >
            <span className="fine" style={{ fontWeight: 600 }}>
              Available on the 1904 shelf:
            </span>
            {shelf.map((cardId) => (
              <a
                key={cardId}
                href={`#${cardId}`}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "0.25rem",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.75rem",
                  color: "var(--ink)",
                  textDecoration: "none",
                }}
              >
                #{cardId}
              </a>
            ))}
          </div>
        )}

        {/* Admitted Imports */}
        {admittedImports && admittedImports.length > 0 && (
          <div
            style={{
              padding: "0.875rem",
              borderRadius: "0.25rem",
              background: "var(--wash)",
              border: "1px solid var(--line)",
              fontSize: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <span
              className="eyebrow"
              style={{
                fontWeight: 600,
                letterSpacing: "0.05em",
                display: "block",
              }}
            >
              Admitted Cross-Paper Imports ({admittedImports.length})
            </span>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                color: "var(--ink)",
              }}
            >
              {admittedImports.map((imp) => (
                <li
                  key={imp.importId}
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.6875rem",
                  }}
                >
                  <span
                    style={{
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {imp.importId}
                  </span>
                  : <span>{imp.provenance}</span> (anchor: {imp.sourceAnchor})
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {/* Main Journey Stages and Interleaved Forks */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {stages.map((stage, index) => {
          const matchingForks = forks.filter((f) => f.afterStageId === stage.id);
          return (
            <div
              key={stage.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <Stage stage={stage} index={index} />
              {matchingForks.map((fork) => (
                <Fork key={fork.id} fork={fork} />
              ))}
            </div>
          );
        })}
      </div>

      {/* The Consequential Move */}
      {move && <MoveMarker move={move} />}

      {/* World Checks */}
      {worldChecks && worldChecks.length > 0 && (
        <section
          style={{
            margin: "2.5rem 0",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.25rem",
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontWeight: "bold",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            World checks · testing the consequences
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "1rem",
            }}
          >
            {worldChecks.map((check) => (
              <WorldCheck key={check.id} check={check} />
            ))}
          </div>
        </section>
      )}

      {/* Predict-Perturb-Explain Task */}
      {ppeTask && <PpeTask task={ppeTask} />}

      {/* Exercises */}
      {exercises && exercises.length > 0 && <ExerciseList exercises={exercises} />}

      {/* Where this enters the paper (Source Jumps) */}
      {sourceJumps && sourceJumps.length > 0 && (
        <section
          style={{
            margin: "2.5rem 0",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.25rem",
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontWeight: "bold",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Connecting to the 1905 Paper
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "1rem",
            }}
          >
            {sourceJumps.map((jump) => (
              <SourceJump key={jump.id} jump={jump} />
            ))}
          </div>
        </section>
      )}

      {/* Entry Portals (Doors) */}
      {doors && <Doors doors={doors} />}

      {/* Footer Navigation */}
      <footer
        style={{
          marginTop: "3.5rem",
          paddingTop: "2rem",
          borderTop: "1px solid var(--line)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          fontSize: "0.875rem",
        }}
      >
        <a
          href={`/papers/${id}/`}
          className="button"
          style={{
            background: "rgba(245, 158, 11, 0.2)",
            color: "var(--accent)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            fontWeight: 500,
            textDecoration: "none",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
          }}
        >
          Read the 1905 paper edition →
        </a>
        <div
          className="fine"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            fontSize: "0.75rem",
          }}
        >
          <a href="/foundations/" style={{ color: "inherit", textDecoration: "underline" }}>
            Explore foundations
          </a>
          <a href="/papers/" style={{ color: "inherit", textDecoration: "underline" }}>
            Paper catalogue
          </a>
        </div>
      </footer>
    </article>
  );
}
