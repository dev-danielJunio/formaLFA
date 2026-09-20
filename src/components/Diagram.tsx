import { edgeGeometry, labelSize, R } from "../geometry";
import type { Automaton, Selection } from "../model";
import { noteLayout, NOTE_TOP } from "../noteLayout";
export function Diagram({
  doc,
  selection,
  active = [],
  traversed = [],
  interactive = false,
  pulse = 0,
  editingEdge,
  editingNote,
}: {
  doc: Automaton;
  selection?: Selection;
  active?: string[];
  traversed?: string[];
  interactive?: boolean;
  pulse?: number;
  editingEdge?: string;
  editingNote?: string;
}) {
  return (
    <>
      <defs>
        <marker
          id="arrow"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 0 0 L 8 4 L 0 8"
            fill="none"
            stroke="context-stroke"
            strokeWidth="1.6"
          />
        </marker>
      </defs>
      {doc.edges.map((e) => {
        const g = edgeGeometry(e, doc),
          selected = selection?.edges.includes(e.id),
          lit = traversed.includes(e.id);
        return (
          <g
            key={`${e.id}-${lit ? pulse : 0}`}
            data-edge={e.id}
            className={`edge ${selected ? "selected" : ""} ${lit ? "traversed" : ""}`}
          >
            <path
              className="edge-line"
              d={g.path}
              fill="none"
              markerEnd="url(#arrow)"
            />
            {interactive && (
              <path
                className="edge-hit"
                d={g.path}
                fill="none"
                stroke="transparent"
                strokeWidth="18"
              />
            )}
          </g>
        );
      })}
      {/* Labels are drawn after every line so even crossing edges cannot cover them. */}
      {doc.edges.map((edge) => {
        const g = edgeGeometry(edge, doc),
          size = labelSize(edge);
        return (
          <g
            key={edge.id}
            data-edge-label={edge.id}
            className="edge-label-group"
            transform={`translate(${g.label.x} ${g.label.y})`}
            visibility={editingEdge === edge.id ? "hidden" : undefined}
          >
            <rect
              className="edge-label-bg"
              x={-size.width / 2}
              y={-size.height / 2}
              width={size.width}
              height={size.height}
              rx={7}
            />
            <text className="edge-label" textAnchor="middle" dy="5">
              {edge.symbols.join(", ")}
            </text>
          </g>
        );
      })}
      {doc.notes.map((n) => (
        <g
          key={n.id}
          data-note={n.id}
          className={`note ${selection?.notes.includes(n.id) ? "selected" : ""}`}
          transform={`translate(${n.x} ${n.y}) scale(${n.scale ?? 1})`}
          visibility={editingNote === n.id ? "hidden" : undefined}
        >
          <rect
            x={-4}
            y={NOTE_TOP - 4}
            width={noteLayout(n.text).width + 8}
            height={noteLayout(n.text).height + 8}
            fill="transparent"
          />
          <foreignObject
            x={0}
            y={NOTE_TOP}
            {...noteLayout(n.text)}
            pointerEvents="none"
          >
            <div className="note-typography">{n.text}</div>
          </foreignObject>
          {interactive &&
            selection?.notes.includes(n.id) &&
            editingNote !== n.id &&
            (["nw", "ne", "sw", "se"] as const).map((corner) => (
              <rect
                key={corner}
                data-resize-note={n.id}
                data-corner={corner}
                className={`note-resize corner-${corner}`}
                x={
                  (corner.endsWith("e") ? noteLayout(n.text).width + 4 : -4) - 4
                }
                y={
                  (corner.startsWith("s")
                    ? NOTE_TOP + noteLayout(n.text).height + 4
                    : NOTE_TOP - 4) - 4
                }
                width={8}
                height={8}
              />
            ))}
        </g>
      ))}
      {doc.nodes.map((n) => (
        <g
          key={n.id}
          data-node={n.id}
          transform={`translate(${n.x} ${n.y})`}
          className={`state ${selection?.nodes.includes(n.id) ? "selected" : ""} ${active.includes(n.id) ? "active" : ""}`}
        >
          {n.initial && (
            <path
              className="initial-arrow"
              d={`M -77 0 H -${R + 5}`}
              markerEnd="url(#arrow)"
            />
          )}
          <circle className="state-halo" r={R + 8} />
          <circle className="state-body" r={R} />
          {n.final && <circle className="state-inner" r={R - 6} />}
          <text textAnchor="middle" dy="7">
            {n.label}
          </text>
          {interactive &&
            [
              [0, -R],
              [R, 0],
              [0, R],
              [-R, 0],
            ].map(([x, y], i) => (
              <circle
                key={i}
                data-anchor={n.id}
                className="anchor"
                cx={x}
                cy={y}
                r="6"
              />
            ))}
        </g>
      ))}
    </>
  );
}
