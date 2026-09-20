import { clone, type Automaton, type Edge, type Point } from "./model";
import { edgeGeometry, labelSize } from "./geometry";
import { noteLayout } from "./noteLayout";

// Deterministic breadth-first layers, then collision-scored Bézier routing.
// The automaton's IDs, symbols and acceptance semantics are never changed.
class PointIndex {
  private cells = new Map<string, Point[]>();
  add(p: Point) {
    const k = `${Math.floor(p.x / 100)},${Math.floor(p.y / 100)}`;
    const cell = this.cells.get(k) ?? [];
    cell.push(p);
    this.cells.set(k, cell);
  }
  near(p: Point, radius: number) {
    const points: Point[] = [];
    for (
      let x = Math.floor((p.x - radius) / 100);
      x <= Math.floor((p.x + radius) / 100);
      x++
    )
      for (
        let y = Math.floor((p.y - radius) / 100);
        y <= Math.floor((p.y + radius) / 100);
        y++
      )
        points.push(...(this.cells.get(`${x},${y}`) ?? []));
    return points;
  }
}
export function curveSamples(edge: Edge, doc: Automaton) {
  const g = edgeGeometry(edge, doc);
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24,
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
}
export function autoLayout(input: Automaton): Automaton {
  const doc = clone(input);
  if (!doc.nodes.length) return doc;
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const outgoing = new Map(doc.nodes.map((n) => [n.id, new Set<string>()]));
  for (const e of doc.edges)
    if (e.source !== e.target) outgoing.get(e.source)?.add(e.target);
  const levels = new Map<string, number>();
  let componentBase = 0;
  for (const root of [...doc.nodes.filter((n) => n.initial), ...doc.nodes]) {
    if (levels.has(root.id)) continue;
    levels.set(root.id, componentBase);
    const queue = [root.id];
    for (let i = 0; i < queue.length; i++)
      for (const next of outgoing.get(queue[i]) ?? []) {
        if (levels.has(next)) continue;
        levels.set(next, levels.get(queue[i])! + 1);
        queue.push(next);
      }
    componentBase = Math.max(...levels.values()) + 1;
  }
  const layers: string[][] = [];
  for (const n of doc.nodes) (layers[levels.get(n.id)!] ??= []).push(n.id);
  // Order each column by its neighbours in the previous column to reduce crossings.
  for (let sweep = 0; sweep < 3; sweep++)
    for (let i = 1; i < layers.length; i++) {
      const previous = new Map(layers[i - 1].map((id, index) => [id, index]));
      const score = (id: string) => {
        const parents = doc.edges.filter(
          (e) => e.target === id && previous.has(e.source),
        );
        return parents.length
          ? parents.reduce((s, e) => s + previous.get(e.source)!, 0) /
              parents.length
          : layers[i].indexOf(id);
      };
      const scores = new Map(layers[i].map((id) => [id, score(id)]));
      layers[i].sort((a, b) => scores.get(a)! - scores.get(b)!);
    }
  const maxLabel = Math.max(32, ...doc.edges.map((e) => labelSize(e).width));
  const spacingX = Math.max(320, maxLabel + 160),
    spacingY = 250;
  const maxRows = Math.max(...layers.map((l) => l.length));
  layers.forEach((layer, x) =>
    layer.forEach((id, y) =>
      Object.assign(byId.get(id)!, {
        x: 240 + x * spacingX,
        y: 260 + y * spacingY + ((maxRows - layer.length) * spacingY) / 2,
      }),
    ),
  );
  const nodePoints = new PointIndex(),
    paths = new PointIndex(),
    labels = new PointIndex();
  doc.nodes.forEach((n) => nodePoints.add(n));
  const lanes = new Map<string, number[]>(),
    loopCounts = new Map<string, number>();
  const loopTotals = new Map<string, number>();
  doc.edges
    .filter((e) => e.source === e.target)
    .forEach((e) =>
      loopTotals.set(e.source, (loopTotals.get(e.source) ?? 0) + 1),
    );
  for (const edge of doc.edges) {
    const a = byId.get(edge.source)!,
      b = byId.get(edge.target)!;
    const geometryDoc = { ...doc, nodes: a === b ? [a] : [a, b], edges: [] };
    const candidates: Edge[] = [];
    const key = JSON.stringify([edge.source, edge.target].sort());
    const sign = edge.source < edge.target ? 1 : -1;
    const used = lanes.get(key) ?? [];
    if (a === b) {
      const i = loopCounts.get(a.id) ?? 0,
        total = loopTotals.get(a.id)!;
      loopCounts.set(a.id, i + 1);
      const neighbours = new Set(
        doc.edges
          .filter(
            (e) =>
              e.source !== e.target && (e.source === a.id || e.target === a.id),
          )
          .map((e) => (e.source === a.id ? e.target : e.source)),
      );
      let dx = 0,
        dy = 0;
      for (const id of neighbours) {
        const n = byId.get(id)!;
        dx += n.x - a.x;
        dy += n.y - a.y;
      }
      const freeAngle =
        Math.hypot(dx, dy) < 1 ? -Math.PI / 2 : Math.atan2(-dy, -dx);
      const angle =
        total <= 4
          ? freeAngle + (i - (total - 1) / 2) * 0.85
          : freeAngle + ((i % 8) * Math.PI * 2) / Math.min(total, 8);
      for (const delta of [0, 0.18, -0.18])
        candidates.push({
          ...edge,
          curve: undefined,
          loop: { angle: angle + delta, size: 85 + Math.floor(i / 8) * 100 },
        });
    } else {
      // Shared endpoints get distinct lanes, including transitions in opposite directions.
      for (let i = 0; candidates.length < 18; i++) {
        const lane = i === 0 ? 0 : Math.ceil(i / 2) * 100 * (i % 2 ? 1 : -1);
        if (used.some((v) => Math.abs(v - lane) < 90)) continue;
        candidates.push({
          ...edge,
          loop: undefined,
          curve: { along: 0, normal: lane * sign },
        });
      }
    }
    let best = candidates[0],
      bestScore = Infinity;
    for (const candidate of candidates) {
      const g = edgeGeometry(candidate, geometryDoc),
        samples = curveSamples(candidate, geometryDoc);
      const halfWidth = labelSize(candidate).width / 2;
      let cost = Math.abs(candidate.curve?.normal ?? 0) * 0.12;
      for (const p of samples.slice(2, -2)) {
        for (const n of nodePoints.near(p, 60))
          if (n !== a && n !== b && Math.hypot(p.x - n.x, p.y - n.y) < 60)
            cost += 1000;
        for (const q of paths.near(p, 18))
          if (Math.hypot(p.x - q.x, p.y - q.y) < 18) cost += 18;
        for (const q of labels.near(p, maxLabel / 2 + 10))
          if (
            Math.abs(p.x - q.x) < maxLabel / 2 + 10 &&
            Math.abs(p.y - q.y) < 24
          )
            cost += 80;
      }
      for (const n of nodePoints.near(g.label, halfWidth + 60))
        if (
          Math.abs(n.x - g.label.x) < halfWidth + 48 &&
          Math.abs(n.y - g.label.y) < 60
        )
          cost += 2500;
      for (const q of labels.near(g.label, maxLabel + 20))
        if (
          Math.abs(q.x - g.label.x) < maxLabel + 20 &&
          Math.abs(q.y - g.label.y) < 48
        )
          cost += 3000;
      for (const q of paths.near(g.label, halfWidth + 15))
        if (
          Math.abs(q.x - g.label.x) < halfWidth + 12 &&
          Math.abs(q.y - g.label.y) < 25
        )
          cost += 100;
      if (cost < bestScore) {
        bestScore = cost;
        best = candidate;
      }
    }
    Object.assign(edge, { curve: best.curve, loop: best.loop });
    if (a !== b) {
      used.push(best.curve!.normal * sign);
      lanes.set(key, used);
    }
    curveSamples(edge, geometryDoc)
      .slice(2, -2)
      .forEach((p) => paths.add(p));
    labels.add(edgeGeometry(edge, geometryDoc).label);
  }
  // Keep free text in a separate margin instead of leaving it over newly placed states.
  const top = Math.min(
    ...doc.edges.flatMap((e) => edgeGeometry(e, doc).bounds.map((p) => p.y)),
    ...doc.nodes.map((n) => n.y - 50),
  );
  let bottom = top - 60;
  for (const note of [...doc.notes].reverse()) {
    const height = noteLayout(note.text).height * (note.scale ?? 1);
    note.x = 160;
    note.y = bottom - height + 18 * (note.scale ?? 1);
    bottom -= height + 24;
  }
  return doc;
}
