import type { Automaton, InkStroke, Point, StudyTable } from "./model";
import { alphabet } from "./engine";

export const CELL_W = 160,
  CELL_H = 48,
  TABLE_TITLE = 28;
export const MAX_ROWS = 40,
  MAX_COLS = 12,
  MAX_POINTS = 4000;
export const PEN_COLORS = [
  ["Violeta", "#8b5cf6"],
  ["Azul", "#2563eb"],
  ["Verde", "#16a34a"],
  ["Vermelho", "#ef4444"],
  ["Laranja", "#f97316"],
  ["Preto", "#111827"],
  ["Branco", "#ffffff"],
] as const;
export function createTable(
  doc: Automaton,
  point: Point,
  id: string,
): StudyTable {
  const symbols = alphabet(doc);
  const header = [
    "Estado / conjunto",
    "ε-fecho",
    ...(symbols.length ? symbols : ["0", "1"]),
  ].slice(0, MAX_COLS);
  return {
    ...point,
    id,
    cells: [header, ...Array.from({ length: 3 }, () => header.map(() => ""))],
  };
}
export const tableSize = (t: StudyTable) => ({
  width: t.cells[0].length * CELL_W,
  height: TABLE_TITLE + t.cells.length * CELL_H,
});
export function cellLines(text: string): string[] {
  const chars = Array.from(text.replace(/\s+/g, " "));
  return chars.length <= 20
    ? [chars.join("")]
    : [
        chars.slice(0, 20).join(""),
        chars.slice(20, 39).join("") +
          (chars.length > 39 ? "…" : chars.slice(39, 40).join("")),
      ];
}
export function strokePath(s: InkStroke): string {
  return s.points.length === 1
    ? `M${s.points[0].x} ${s.points[0].y}l0.01 0`
    : s.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
}
export function studyBounds(
  doc: Pick<Automaton, "tables" | "strokes">,
): Point[] {
  return [
    ...(doc.tables ?? []).flatMap((t) => [
      t,
      { x: t.x + tableSize(t).width, y: t.y + tableSize(t).height },
    ]),
    ...(doc.strokes ?? []).flatMap((s) => {
      const xs = s.points.map((p) => p.x),
        ys = s.points.map((p) => p.y);
      return [
        {
          x: s.x + Math.min(...xs) - s.width,
          y: s.y + Math.min(...ys) - s.width,
        },
        {
          x: s.x + Math.max(...xs) + s.width,
          y: s.y + Math.max(...ys) + s.width,
        },
      ];
    }),
  ];
}
