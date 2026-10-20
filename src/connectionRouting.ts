import type { Automaton, Edge, Point } from "./model";
import { edgeGeometry, labelSize, R, reshapeEdge } from "./geometry";
import { curveSamples } from "./autoLayout";
import { noteLayout, NOTE_TOP } from "./noteLayout";
import { tableSize } from "./studyTools";

type Box = { left: number; top: number; right: number; bottom: number };
type Segment = { a: Point; b: Point; bounds: Box };
const box = (p: Point, width: number, height: number): Box => ({
  left: p.x,
  top: p.y,
  right: p.x + width,
  bottom: p.y + height,
});
const pad = (b: Box, n: number): Box => ({
  left: b.left - n,
  top: b.top - n,
  right: b.right + n,
  bottom: b.bottom + n,
});
const overlaps = (a: Box, b: Box) =>
  a.left <= b.right &&
  a.right >= b.left &&
  a.top <= b.bottom &&
  a.bottom >= b.top;
const segment = (a: Point, b: Point): Segment => ({
  a,
  b,
  bounds: {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  },
});
const segments = (points: Point[]) =>
  points.slice(1).map((p, i) => segment(points[i], p));
const pointDistance = (p: Point, s: Segment) => {
  const dx = s.b.x - s.a.x,
    dy = s.b.y - s.a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - s.a.x - t * dx, p.y - s.a.y - t * dy);
};
const cross = (a: Point, b: Point, p: Point) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const intersects = (a: Segment, b: Segment) =>
  overlaps(a.bounds, b.bounds) &&
  cross(a.a, a.b, b.a) * cross(a.a, a.b, b.b) <= 0 &&
  cross(b.a, b.b, a.a) * cross(b.a, b.b, a.b) <= 0;
const distance = (a: Segment, b: Segment) =>
  intersects(a, b)
    ? 0
    : Math.min(
        pointDistance(a.a, b),
        pointDistance(a.b, b),
        pointDistance(b.a, a),
        pointDistance(b.b, a),
      );
const hitsBox = (s: Segment, b: Box) => {
  if (!overlaps(s.bounds, b)) return false;
  const inside = (p: Point) =>
    p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
  if (inside(s.a) || inside(s.b)) return true;
  const corners = [
    { x: b.left, y: b.top },
    { x: b.right, y: b.top },
    { x: b.right, y: b.bottom },
    { x: b.left, y: b.bottom },
  ];
  return corners.some((p, i) =>
    intersects(s, segment(p, corners[(i + 1) % 4])),
  );
};

// Adding a reverse edge must not reroute the old edge as a side effect of its
// legacy implicit bend. Freeze that geometry before inserting the new edge.
export function withNewConnection(doc: Automaton, edge: Edge): Automaton {
  return {
    ...doc,
    edges: [
      ...doc.edges.map((old) =>
        !old.curve &&
        old.source !== old.target &&
        old.source === edge.target &&
        old.target === edge.source
          ? reshapeEdge(old, doc, edgeGeometry(old, doc).control)
          : old,
      ),
      edge,
    ],
  };
}

// Cache obstacle geometry once per document, not on each pointer movement.
export function createConnectionRouter(doc: Automaton) {
  const boxes: Box[] = [
    ...doc.notes.map((n) => {
      const size = noteLayout(n.text),
        scale = n.scale ?? 1;
      return pad(
        box(
          { x: n.x, y: n.y + NOTE_TOP * scale },
          size.width * scale,
          size.height * scale,
        ),
        10,
      );
    }),
    ...(doc.tables ?? []).map((t) =>
      pad(box(t, tableSize(t).width, tableSize(t).height), 12),
    ),
    ...doc.edges.map((e) => {
      const p = edgeGeometry(e, doc).label,
        size = labelSize(e);
      return pad(
        box(
          { x: p.x - size.width / 2, y: p.y - size.height / 2 },
          size.width,
          size.height,
        ),
        8,
      );
    }),
  ];
  const paths = doc.edges.flatMap((e) => segments(curveSamples(e, doc)));
  const ink = (doc.strokes ?? []).flatMap((s) => {
    const points = s.points.map((p) => ({ x: p.x + s.x, y: p.y + s.y }));
    return (
      points.length === 1 ? [segment(points[0], points[0])] : segments(points)
    ).map((line) => ({ line, clearance: s.width / 2 + 8 }));
  });
  const initialArrows = doc.nodes
    .filter((n) => n.initial)
    .map((n) => segment({ x: n.x - 77, y: n.y }, { x: n.x - R - 5, y: n.y }));
  return (source: string, pointer: Point, anchor: Point) => {
    const a = doc.nodes.find((n) => n.id === source);
    if (!a || Math.hypot(pointer.x - anchor.x, pointer.y - anchor.y) < 7)
      return null;
    const target = [...doc.nodes]
      .reverse()
      .find((n) => Math.hypot(n.x - pointer.x, n.y - pointer.y) < R + 12);
    const existing =
      target &&
      doc.edges.find((e) => e.source === source && e.target === target.id);
    if (existing)
      return {
        edge: existing,
        target: target.id,
        geometry: edgeGeometry(existing, doc),
      };
    // The temporary endpoint has zero radius so the unsnapped arrow follows the pointer.
    let temporaryId = "connection-pointer";
    while (doc.nodes.some((n) => n.id === temporaryId)) temporaryId += "-";
    const b = target ?? {
      ...pointer,
      id: temporaryId,
      label: "",
      initial: false,
      final: false,
    };
    const geometryDoc: Automaton = {
      ...doc,
      nodes: a === b ? [a] : [a, b],
      edges: [],
    };
    const base: Edge = {
      id: "connection-preview",
      source,
      target: b.id,
      symbols: [],
    };
    const candidates: Edge[] = [];
    if (a === b) {
      const preferred = Math.atan2(anchor.y - a.y, anchor.x - a.x);
      for (const size of [75, 115, 175, 260])
        for (const turn of [0, -1, 1, -2, 2, -3, 3, 4])
          candidates.push({
            ...base,
            loop: { angle: preferred + (turn * Math.PI) / 4, size },
          });
    } else {
      candidates.push({ ...base, curve: { along: 0, normal: 0 } });
      for (const bend of [70, 140, 230, 350, 520, 760, 1100, 1600, 2400])
        for (const sign of [-1, 1])
          candidates.push({
            ...base,
            curve: { along: 0, normal: bend * sign },
          });
    }
    let best = candidates[0],
      bestCost = Infinity;
    for (const candidate of candidates) {
      const g = edgeGeometry(candidate, geometryDoc, target ? R + 3 : 0);
      // Sample the actual preview geometry, including the free pointer endpoint.
      const points = Array.from({ length: 33 }, (_, i) => {
        const t = i / 32,
          u = 1 - t;
        return g.control2
          ? {
              x:
                u ** 3 * g.start.x +
                3 * u * u * t * g.control.x +
                3 * u * t * t * g.control2.x +
                t ** 3 * g.end.x,
              y:
                u ** 3 * g.start.y +
                3 * u * u * t * g.control.y +
                3 * u * t * t * g.control2.y +
                t ** 3 * g.end.y,
            }
          : {
              x: u * u * g.start.x + 2 * u * t * g.control.x + t * t * g.end.x,
              y: u * u * g.start.y + 2 * u * t * g.control.y + t * t * g.end.y,
            };
      });
      let cost =
        Math.abs(candidate.curve?.normal ?? 0) * 0.12 +
        (candidate.loop?.size ?? 0) * 0.1;
      const route = segments(points);
      for (const line of route) {
        for (const n of doc.nodes)
          if (
            n.id !== source &&
            n.id !== b.id &&
            pointDistance(n, line) < R + 14
          )
            cost += 10000;
        for (const obstacle of boxes) if (hitsBox(line, obstacle)) cost += 3000;
        for (const old of paths)
          if (
            overlaps(pad(line.bounds, 14), old.bounds) &&
            distance(line, old) < 14
          )
            cost += 90;
        for (const old of initialArrows)
          if (
            overlaps(pad(line.bounds, 12), old.bounds) &&
            distance(line, old) < 12
          )
            cost += 200;
        for (const { line: old, clearance } of ink)
          if (
            overlaps(pad(line.bounds, clearance), old.bounds) &&
            distance(line, old) < clearance
          )
            cost += 200;
      }
      if (target) {
        const label = pad(
          box({ x: g.label.x - 16, y: g.label.y - 14 }, 32, 28),
          8,
        );
        for (const n of doc.nodes)
          if (overlaps(label, box({ x: n.x - R, y: n.y - R }, R * 2, R * 2)))
            cost += 12000;
        for (const obstacle of boxes)
          if (overlaps(label, obstacle)) cost += 6000;
        for (const old of paths) if (hitsBox(old, label)) cost += 1000;
      }
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
      if (cost === 0) break;
    }
    return {
      edge: best,
      target: target?.id,
      geometry: edgeGeometry(best, geometryDoc, target ? R + 3 : 0),
    };
  };
}
