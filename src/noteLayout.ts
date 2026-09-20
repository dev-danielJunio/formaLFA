import type { Note, Point } from "./model";
export const NOTE_FONT = "14px ui-sans-serif, system-ui";
export const NOTE_LINE_HEIGHT = 24;
// Model coordinates retain the first line's original SVG baseline.
export const NOTE_TOP = -18;
let context: CanvasRenderingContext2D | null | undefined;
export function noteLayout(text: string) {
  if (context === undefined && typeof document !== "undefined") {
    context = document.createElement("canvas").getContext("2d");
  }
  if (context) context.font = NOTE_FONT;
  const lines = text.split("\n");
  return {
    width:
      Math.max(
        24,
        ...lines.map((line) =>
          Math.ceil(context?.measureText(line).width ?? line.length * 8),
        ),
      ) + 4,
    height: lines.length * NOTE_LINE_HEIGHT,
  };
}

export function resizeNote(
  note: Note,
  start: Point,
  point: Point,
  corner: string,
): Note {
  const size = noteLayout(note.text),
    w = size.width + 8,
    h = size.height + 8,
    scale = note.scale ?? 1;
  const west = corner.endsWith("w"),
    north = corner.startsWith("n");
  const delta =
    ((point.x - start.x) * (west ? -1 : 1) * w +
      (point.y - start.y) * (north ? -1 : 1) * h) /
    (w * w + h * h);
  const next = Math.max(0.5, Math.min(4, scale + delta));
  const anchorX = note.x - 4 * scale + (west ? w * scale : 0);
  const anchorY = note.y + (NOTE_TOP - 4) * scale + (north ? h * scale : 0);
  return {
    ...note,
    scale: next,
    x: anchorX - (west ? w * next : 0) + 4 * next,
    y: anchorY - (north ? h * next : 0) - (NOTE_TOP - 4) * next,
  };
}
