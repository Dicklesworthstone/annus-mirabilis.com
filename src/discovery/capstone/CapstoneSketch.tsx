"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import {
  readSketch,
  SKETCH_LIMITS,
  type SketchPoint,
  sketchPath,
  type WorksheetSketch,
} from "./worksheetSketch.ts";

type PointerStroke = {
  pointerId: number;
  basis: string;
  points: SketchPoint[];
};

/** A private drawing, never executable SVG or a scientific calculation. */
export function CapstoneSketch({
  sketch,
  onChange,
}: Readonly<{
  sketch: WorksheetSketch;
  /** False means the whole worksheet could not admit the change; retain an unfinished stroke. */
  onChange(next: WorksheetSketch): boolean;
}>) {
  const prefix = useId();
  const latest = useRef({ sketch, onChange });
  latest.current = { sketch, onChange };
  const pointer = useRef<PointerStroke | null>(null);
  const [draft, setDraft] = useState<readonly SketchPoint[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState("");
  const [clearing, setClearing] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const keyboardLine = useRef<string | null>(null);
  const [lineOpen, setLineOpen] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  const totalPoints = (value: WorksheetSketch) =>
    value.strokes.reduce((total, stroke) => total + stroke.length, 0);
  function change(next: WorksheetSketch): boolean {
    if (!readSketch(next)) {
      setNotice("The drawing has reached its size limit. Your existing work is unchanged.");
      return false;
    }
    if (!latest.current.onChange(next)) return false;
    latest.current = { ...latest.current, sketch: next };
    setNotice("");
    setClearing(false);
    return true;
  }

  function finishPointer(explicit = false): boolean {
    const stroke = pointer.current;
    if (!stroke || (stroke.pointerId === -1 && !explicit)) return false;
    const current = latest.current.sketch;
    if (!explicit && JSON.stringify(current.strokes) !== stroke.basis) {
      setNotice(
        "The worksheet changed while this stroke was being drawn. Keep or discard the unfinished stroke before drawing again.",
      );
      pointer.current = { ...stroke, pointerId: -1 };
      return false;
    }
    if (!change({ ...current, strokes: [...current.strokes, [...stroke.points]] })) {
      setNotice(
        "This stroke has not been added to the worksheet. Export your work or shorten another answer, then retry keeping the stroke.",
      );
      pointer.current = { ...stroke, pointerId: -1 };
      return false;
    }
    pointer.current = null;
    setDraft([]);
    setNotice("Stroke kept in this worksheet. Its saving status is shown above.");
    return true;
  }

  const finishRef = useRef(finishPointer);
  finishRef.current = finishPointer;
  useEffect(() => {
    // A tab switch or print must not omit a stroke still held by a pointer. The worksheet store
    // writes synchronously; it retains a local copy and reports a refusal if durable saving fails.
    const finish = () => finishRef.current();
    const hidden = () => {
      if (document.visibilityState === "hidden") finish();
    };
    window.addEventListener("pagehide", finish);
    window.addEventListener("beforeprint", finish);
    window.addEventListener("blur", finish);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", finish);
      window.removeEventListener("beforeprint", finish);
      window.removeEventListener("blur", finish);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  function pointAt(event: ReactPointerEvent<SVGSVGElement>): SketchPoint | null {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.round(
        Math.max(
          0,
          Math.min(
            SKETCH_LIMITS.width,
            ((event.clientX - rect.left) / rect.width) * SKETCH_LIMITS.width,
          ),
        ),
      ),
      y: Math.round(
        Math.max(
          0,
          Math.min(
            SKETCH_LIMITS.height,
            ((event.clientY - rect.top) / rect.height) * SKETCH_LIMITS.height,
          ),
        ),
      ),
    };
  }

  function startPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (!enabled || !event.isPrimary || event.button !== 0 || pointer.current) return;
    const point = pointAt(event);
    if (!point) return;
    const current = latest.current.sketch;
    if (
      current.strokes.length >= SKETCH_LIMITS.strokes ||
      totalPoints(current) >= SKETCH_LIMITS.points
    ) {
      setNotice("The drawing is full. Undo a stroke to make room; your existing drawing is kept.");
      return;
    }
    event.preventDefault();
    keyboardLine.current = null;
    setLineOpen(false);
    pointer.current = {
      pointerId: event.pointerId,
      basis: JSON.stringify(current.strokes),
      points: [point],
    };
    setDraft([point]);
    setNotice("Release the pointer to keep this stroke.");
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // A pointer may have ended before capture. Its draft remains available to keep explicitly.
    }
  }

  function extendPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const stroke = pointer.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    const point = pointAt(event);
    const previous = stroke.points.at(-1);
    if (!point || (previous?.x === point.x && previous.y === point.y)) return;
    if (
      stroke.points.length >= SKETCH_LIMITS.pointsPerStroke ||
      totalPoints(latest.current.sketch) + stroke.points.length >= SKETCH_LIMITS.points
    ) {
      if (finishPointer())
        setNotice(
          "This stroke reached the drawing limit and was kept. Undo a stroke to make more room.",
        );
      return;
    }
    stroke.points.push(point);
    setDraft([...stroke.points]);
  }

  function finishEvent(event: ReactPointerEvent<SVGSVGElement>) {
    if (pointer.current?.pointerId !== event.pointerId) return;
    extendPointer(event);
    finishPointer();
  }

  function keyboardPoint(): SketchPoint {
    return {
      x: Math.round((position.x / 100) * SKETCH_LIMITS.width),
      y: Math.round((position.y / 100) * SKETCH_LIMITS.height),
    };
  }

  function startKeyboard() {
    if (pointer.current) return;
    const current = latest.current.sketch;
    if (
      current.strokes.length >= SKETCH_LIMITS.strokes ||
      totalPoints(current) >= SKETCH_LIMITS.points
    ) {
      setNotice("The drawing is full. Undo a stroke to make room; your existing drawing is kept.");
      return;
    }
    const points = [keyboardPoint()];
    if (!change({ ...current, strokes: [...current.strokes, points] })) return;
    keyboardLine.current = JSON.stringify([...current.strokes, points]);
    setLineOpen(true);
    setNotice(
      "Line started at the chosen position. Move the position controls and add the next point.",
    );
  }

  function addKeyboardPoint() {
    const current = latest.current.sketch;
    const held = keyboardLine.current;
    const last = current.strokes.at(-1);
    if (!held || !last || held !== JSON.stringify(current.strokes)) {
      keyboardLine.current = null;
      setLineOpen(false);
      setNotice("The drawing changed. Start a new line to add points to this version.");
      return;
    }
    const point = keyboardPoint();
    if (last.at(-1)?.x === point.x && last.at(-1)?.y === point.y) {
      setNotice("Choose a different position for the next point.");
      return;
    }
    if (
      last.length >= SKETCH_LIMITS.pointsPerStroke ||
      totalPoints(current) >= SKETCH_LIMITS.points
    ) {
      setNotice("This line has reached the drawing limit. Finish the line or undo a stroke.");
      return;
    }
    const points = [...last, point];
    if (!change({ ...current, strokes: [...current.strokes.slice(0, -1), points] })) return;
    keyboardLine.current = JSON.stringify([...current.strokes.slice(0, -1), points]);
    setNotice("Point added to the line. Its saving status is shown above.");
  }

  const cursor = keyboardPoint();
  const description = sketch.description.trim() || "No description provided.";
  return (
    <section className="capstone-sketch" aria-labelledby={`${prefix}-heading`}>
      <h4 id={`${prefix}-heading`}>An optional drawing</h4>
      <p>
        Explain an arrangement, a path or a relationship in a drawing. You can also describe it in
        words. Both stay with this private worksheet, its snapshots and its export.
      </p>
      <div className="capstone-controls capstone-toolbar">
        <button
          type="button"
          aria-pressed={enabled}
          onClick={() => {
            finishPointer();
            setEnabled(!enabled);
          }}
        >
          {enabled ? "Stop pointer drawing" : "Enable pointer drawing"}
        </button>
        <button
          type="button"
          disabled={sketch.strokes.length === 0 || draft.length > 0}
          onClick={() => {
            if (
              change({
                ...latest.current.sketch,
                strokes: latest.current.sketch.strokes.slice(0, -1),
              })
            ) {
              keyboardLine.current = null;
              setLineOpen(false);
              setNotice("Last stroke removed. Your description is unchanged.");
            }
          }}
        >
          Undo last stroke
        </button>
        <button
          type="button"
          disabled={sketch.strokes.length === 0 || draft.length > 0}
          onClick={() => setClearing(true)}
        >
          Clear drawing strokes
        </button>
      </div>
      {clearing && (
        <div className="capstone-controls">
          <p>
            Remove this drawing's strokes? Your written description and other answers will stay.
          </p>
          <button
            type="button"
            onClick={() => {
              if (change({ ...latest.current.sketch, strokes: [] })) {
                keyboardLine.current = null;
                setLineOpen(false);
                setNotice("Drawing strokes cleared. Your description is unchanged.");
              }
            }}
          >
            Confirm clear drawing strokes
          </button>
          <button type="button" onClick={() => setClearing(false)}>
            Keep the drawing
          </button>
        </div>
      )}
      <p className="capstone-controls" id={`${prefix}-help`}>
        Enable pointer drawing to use a mouse, pen or touch. Turn it off to scroll over the drawing
        on a phone. Keyboard drawing controls are below.
      </p>
      <svg
        className="capstone-sketch-surface"
        data-drawing-enabled={enabled}
        viewBox={`0 0 ${SKETCH_LIMITS.width} ${SKETCH_LIMITS.height}`}
        role="img"
        aria-labelledby={`${prefix}-picture-title ${prefix}-picture-description`}
        aria-describedby={`${prefix}-help`}
        onPointerDown={startPointer}
        onPointerMove={extendPointer}
        onPointerUp={finishEvent}
        onPointerCancel={(event) => {
          if (pointer.current?.pointerId === event.pointerId) finishPointer();
        }}
        onLostPointerCapture={(event) => {
          if (pointer.current?.pointerId === event.pointerId) finishPointer();
        }}
      >
        <title id={`${prefix}-picture-title`}>Your capstone drawing</title>
        <desc id={`${prefix}-picture-description`}>{description}</desc>
        <path d={sketchPath(sketch.strokes)} className="capstone-sketch-ink" />
        {draft.length > 0 && <path d={sketchPath([draft])} className="capstone-sketch-ink" />}
        {showCursor && (
          <g className="capstone-sketch-cursor">
            <path d={`M ${cursor.x - 10} ${cursor.y} h 20 M ${cursor.x} ${cursor.y - 10} v 20`} />
            <circle cx={cursor.x} cy={cursor.y} r={8} />
          </g>
        )}
      </svg>
      <p className="capstone-controls" role="status" aria-live="polite">
        {notice}
      </p>
      {draft.length > 0 && (
        <div className="capstone-controls capstone-toolbar">
          <button type="button" onClick={() => finishPointer(true)}>
            Keep unfinished stroke
          </button>
          <button
            type="button"
            onClick={() => {
              pointer.current = null;
              setDraft([]);
              setNotice("Unfinished stroke discarded. The saved drawing is unchanged.");
            }}
          >
            Discard unfinished stroke
          </button>
        </div>
      )}
      <details
        className="capstone-controls"
        onToggle={(event) => setShowCursor(event.currentTarget.open)}
      >
        <summary>Draw with a keyboard</summary>
        <p>
          Choose a position, start a line, then choose another position and add a point. Each point
          is kept immediately. Finishing a line lets you start a separate one.
        </p>
        <label htmlFor={`${prefix}-x`}>Horizontal position, from the left</label>
        <input
          id={`${prefix}-x`}
          type="range"
          min="0"
          max="100"
          step="1"
          value={position.x}
          aria-valuetext={`${position.x} percent from the left`}
          onChange={(event) => setPosition({ ...position, x: Number(event.currentTarget.value) })}
        />
        <output htmlFor={`${prefix}-x`}>{position.x}% from the left</output>
        <label htmlFor={`${prefix}-y`}>Vertical position, from the top</label>
        <input
          id={`${prefix}-y`}
          type="range"
          min="0"
          max="100"
          step="1"
          value={position.y}
          aria-valuetext={`${position.y} percent from the top`}
          onChange={(event) => setPosition({ ...position, y: Number(event.currentTarget.value) })}
        />
        <output htmlFor={`${prefix}-y`}>{position.y}% from the top</output>
        <div className="capstone-toolbar">
          <button type="button" disabled={lineOpen || draft.length > 0} onClick={startKeyboard}>
            Start a line here
          </button>
          <button type="button" disabled={!lineOpen || draft.length > 0} onClick={addKeyboardPoint}>
            Add this point to the line
          </button>
          <button
            type="button"
            disabled={!lineOpen}
            onClick={() => {
              keyboardLine.current = null;
              setLineOpen(false);
              setNotice("Line finished. You can start another line at a different position.");
            }}
          >
            Finish this line
          </button>
        </div>
      </details>
      <label className="capstone-controls" htmlFor={`${prefix}-description`}>
        Describe your drawing, or use words instead
      </label>
      <textarea
        className="capstone-controls"
        id={`${prefix}-description`}
        rows={4}
        maxLength={SKETCH_LIMITS.description}
        value={sketch.description}
        onChange={(event) =>
          change({ ...latest.current.sketch, description: event.currentTarget.value })
        }
      />
      <p className="capstone-print-text">Drawing description: {description}</p>
      <p className="capstone-controls">
        The drawing is optional. A drawing without a description is kept and labelled as such.
      </p>
    </section>
  );
}
