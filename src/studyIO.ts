import type { Automaton, InkStroke, StudyTable } from "./model";
import {
  CELL_W,
  CELL_H,
  TABLE_TITLE,
  MAX_ROWS,
  MAX_COLS,
  MAX_POINTS,
  cellLines,
  strokePath,
  tableSize,
} from "./studyTools";

export function parseStudyFields(
  data: { tables?: unknown; strokes?: unknown },
  ids: Set<string>,
): Pick<Automaton, "tables" | "strokes"> {
  const result: Pick<Automaton, "tables" | "strokes"> = {};
  const finite = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e6;
  const identity = (v: { id?: unknown; x?: unknown; y?: unknown } | null) => {
    if (
      !v ||
      typeof v.id !== "string" ||
      !v.id.length ||
      v.id.length > 120 ||
      ids.has(v.id) ||
      !finite(v.x) ||
      !finite(v.y)
    )
      throw new Error(
        "Identificador ou posição inválidos nos materiais de estudo.",
      );
    ids.add(v.id);
  };
  if (data.tables !== undefined) {
    if (!Array.isArray(data.tables) || data.tables.length > 100)
      throw new Error("Use até 100 tabelas.");
    result.tables = data.tables.map((t: StudyTable) => {
      identity(t);
      if (
        !Array.isArray(t.cells) ||
        t.cells.length < 2 ||
        t.cells.length > MAX_ROWS ||
        !Array.isArray(t.cells[0]) ||
        !t.cells[0].length ||
        t.cells[0].length > MAX_COLS ||
        t.cells.some(
          (row) =>
            !Array.isArray(row) ||
            row.length !== t.cells[0].length ||
            row.some((text) => typeof text !== "string" || text.length > 200),
        )
      )
        throw new Error(
          "Tabela inválida: use de 2 a 40 linhas, de 1 a 12 colunas e até 200 caracteres por célula.",
        );
      return {
        id: t.id,
        x: t.x,
        y: t.y,
        cells: t.cells.map((row) => [...row]),
      };
    });
  }
  if (data.strokes !== undefined) {
    if (!Array.isArray(data.strokes) || data.strokes.length > 2000)
      throw new Error("Use até 2000 traços.");
    result.strokes = data.strokes.map((s: InkStroke) => {
      identity(s);
      if (
        typeof s.color !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(s.color) ||
        !finite(s.width) ||
        s.width < 1 ||
        s.width > 12 ||
        !Array.isArray(s.points) ||
        !s.points.length ||
        s.points.length > MAX_POINTS ||
        s.points.some((p) => !p || !finite(p.x) || !finite(p.y))
      )
        throw new Error("Traço inválido: verifique cor, espessura e pontos.");
      return {
        id: s.id,
        x: s.x,
        y: s.y,
        color: s.color,
        width: s.width,
        points: s.points.map((p) => ({ x: p.x, y: p.y })),
      };
    });
  }
  return result;
}
export function studySvg(
  doc: Automaton,
  esc: (text: string) => string,
): string {
  return (
    (doc.tables ?? [])
      .map((t) => {
        const size = tableSize(t);
        return `<g transform="translate(${t.x} ${t.y})"><rect width="${size.width}" height="${size.height}" fill="white" stroke="#667085"/><text x="12" y="19" font-size="12">Tabela de conversão · AFN-ε → AFD</text>${t.cells
          .map((row, r) =>
            row
              .map(
                (v, c) =>
                  `<rect x="${c * CELL_W}" y="${TABLE_TITLE + r * CELL_H}" width="${CELL_W}" height="${CELL_H}" fill="${r ? "white" : "#ede9fe"}" stroke="#cbd5e1"/>${cellLines(
                    v,
                  )
                    .map(
                      (line, i) =>
                        `<text x="${c * CELL_W + 9}" y="${TABLE_TITLE + r * CELL_H + (cellLines(v).length > 1 ? 19 : 29) + i * 17}" font-size="13">${esc(line)}</text>`,
                    )
                    .join("")}`,
              )
              .join(""),
          )
          .join("")}</g>`;
      })
      .join("") +
    (doc.strokes ?? [])
      .map(
        (s) =>
          `<path transform="translate(${s.x} ${s.y})" d="${strokePath(s)}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
      .join("")
  );
}
export function drawStudy(ctx: CanvasRenderingContext2D, doc: Automaton) {
  ctx.save();
  ctx.textAlign = "left";
  ctx.lineWidth = 1;
  for (const t of doc.tables ?? []) {
    const size = tableSize(t);
    ctx.fillStyle = "white";
    ctx.fillRect(t.x, t.y, size.width, size.height);
    ctx.strokeStyle = "#667085";
    ctx.strokeRect(t.x, t.y, size.width, size.height);
    ctx.fillStyle = "#344054";
    ctx.font = "12px Arial";
    ctx.fillText("Tabela de conversão · AFN-ε → AFD", t.x + 12, t.y + 19);
    t.cells.forEach((row, r) =>
      row.forEach((v, c) => {
        const x = t.x + c * CELL_W,
          y = t.y + TABLE_TITLE + r * CELL_H;
        ctx.fillStyle = r ? "white" : "#ede9fe";
        ctx.fillRect(x, y, CELL_W, CELL_H);
        ctx.strokeStyle = "#cbd5e1";
        ctx.strokeRect(x, y, CELL_W, CELL_H);
        ctx.fillStyle = "#344054";
        ctx.font = "13px Arial";
        const lines = cellLines(v);
        lines.forEach((line, i) =>
          ctx.fillText(line, x + 9, y + (lines.length > 1 ? 19 : 29) + i * 17),
        );
      }),
    );
  }
  for (const s of doc.strokes ?? []) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(strokePath(s)));
    ctx.restore();
  }
  ctx.restore();
}
