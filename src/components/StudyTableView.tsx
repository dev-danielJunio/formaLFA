import { useLayoutEffect, useRef, useState } from "react";
import type { StudyTable } from "../model";
import {
  CELL_H,
  CELL_W,
  TABLE_TITLE,
  MAX_ROWS,
  MAX_COLS,
  cellLines,
  tableSize,
} from "../studyTools";

export function StudyTableView({
  table,
  selected,
  editing,
  onSave,
  onCancel,
  onResize,
}: {
  table: StudyTable;
  selected: boolean;
  editing?: { row: number; col: number };
  onSave: (text: string) => void;
  onCancel: () => void;
  onResize: (rows: number, cols: number) => void;
}) {
  const { width, height } = tableSize(table);
  return (
    <g
      data-table={table.id}
      className={`study-table ${selected ? "selected" : ""}`}
      transform={`translate(${table.x} ${table.y})`}
    >
      <rect className="table-frame" width={width} height={height} rx={6} />
      <text className="table-title" x={12} y={19}>
        Tabela de conversão · AFN-ε → AFD
      </text>
      {table.cells.map((row, r) =>
        row.map((value, c) => (
          <g
            key={`${r}-${c}`}
            data-table-cell={`${r},${c}`}
            transform={`translate(${c * CELL_W} ${TABLE_TITLE + r * CELL_H})`}
          >
            <rect
              className={r === 0 ? "table-cell table-header" : "table-cell"}
              width={CELL_W}
              height={CELL_H}
            />
            <title>{value || "Duplo clique para preencher"}</title>
            {editing?.row === r && editing.col === c ? (
              <foreignObject width={CELL_W} height={CELL_H}>
                <CellInput
                  key={`${table.id}-${r}-${c}`}
                  text={value}
                  onSave={onSave}
                  onCancel={onCancel}
                />
              </foreignObject>
            ) : (
              <text
                className="table-cell-text"
                x={9}
                y={cellLines(value).length > 1 ? 19 : 29}
              >
                {cellLines(value).map((line, i) => (
                  <tspan key={i} x={9} dy={i ? 17 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        )),
      )}
      {selected && !editing && (
        <foreignObject x={0} y={-39} width={width} height={36}>
          <div
            className="table-actions"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              disabled={table.cells.length >= MAX_ROWS}
              onClick={() => onResize(1, 0)}
            >
              + Linha
            </button>
            <button
              disabled={table.cells.length <= 2}
              onClick={() => onResize(-1, 0)}
              title="Remover última linha"
            >
              − Linha
            </button>
            <button
              disabled={table.cells[0].length >= MAX_COLS}
              onClick={() => onResize(0, 1)}
            >
              + Coluna
            </button>
            <button
              disabled={table.cells[0].length <= 1}
              onClick={() => onResize(0, -1)}
              title="Remover última coluna"
            >
              − Coluna
            </button>
          </div>
        </foreignObject>
      )}
    </g>
  );
}
function CellInput({
  text,
  onSave,
  onCancel,
}: {
  text: string;
  onSave: (s: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(text),
    ref = useRef<HTMLInputElement>(null),
    done = useRef(false);
  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.select();
  }, []);
  const save = () => {
    if (!done.current) {
      done.current = true;
      onSave(value);
    }
  };
  return (
    <input
      ref={ref}
      className="table-cell-input"
      aria-label="Conteúdo da célula"
      value={value}
      maxLength={200}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          done.current = true;
          onCancel();
        }
      }}
    />
  );
}
