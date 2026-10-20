import type { Automaton, Edge, Point } from "./model";
export const R = 34;
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
const unit = (p: Point): Point => {
  const length = Math.hypot(p.x, p.y);
  return length < 0.001 ? { x: 1, y: 0 } : mul(p, 1 / length);
};
export function labelSize(edge: Edge) {
  return {
    width: Math.max(32, Array.from(edge.symbols.join(", ")).length * 9 + 16),
    height: 28,
  };
}
export function edgeGeometry(edge: Edge, doc: Automaton, targetRadius = R + 3) {
  const a = doc.nodes.find((n) => n.id === edge.source)!,
    b = doc.nodes.find((n) => n.id === edge.target)!;
  let start: Point,
    end: Point,
    control: Point,
    control2: Point | undefined,
    midpoint: Point,
    normal: Point,
    path: string;
  if (a.id === b.id) {
    const angle = edge.loop?.angle ?? -Math.PI / 2,
      size = edge.loop?.size ?? 80;
    const outward = { x: Math.cos(angle), y: Math.sin(angle) },
      side = { x: -outward.y, y: outward.x };
    start = add(
      a,
      add(mul(outward, R * Math.cos(0.7)), mul(side, -R * Math.sin(0.7))),
    );
    end = add(
      a,
      add(mul(outward, R * Math.cos(0.7)), mul(side, R * Math.sin(0.7))),
    );
    control = add(a, add(mul(outward, R + size * 1.2), mul(side, -size * 0.9)));
    control2 = add(a, add(mul(outward, R + size * 1.2), mul(side, size * 0.9)));
    midpoint = mul(add(add(start, end), mul(add(control, control2), 3)), 1 / 8);
    normal = outward;
    path = `M ${start.x} ${start.y} C ${control.x} ${control.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
  } else {
    const axis = unit({ x: b.x - a.x, y: b.y - a.y }),
      perp = { x: -axis.y, y: axis.x },
      middle = mul(add(a, b), 0.5);
    const paired = doc.edges.some(
      (e) => e.source === b.id && e.target === a.id,
    );
    const bend = paired ? 55 : Math.hypot(b.x - a.x, b.y - a.y) > 300 ? 150 : 0;
    control = add(
      middle,
      add(
        mul(axis, edge.curve?.along ?? 0),
        mul(perp, edge.curve?.normal ?? bend),
      ),
    );
    const toward = (p: Point, fallback: Point, radius = R + 3) => {
      let v = { x: control.x - p.x, y: control.y - p.y };
      if (Math.hypot(v.x, v.y) < 0.001) v = fallback;
      return add(p, mul(unit(v), radius));
    };
    start = toward(a, axis);
    end = toward(b, mul(axis, -1), targetRadius);
    midpoint = mul(add(add(start, end), mul(control, 2)), 0.25);
    // B'(1/2) = end - start. Offset along its normal, away from the bow.
    const tangent = unit({ x: end.x - start.x, y: end.y - start.y });
    normal = { x: -tangent.y, y: tangent.x };
    const bow = { x: control.x - middle.x, y: control.y - middle.y };
    if (
      Math.abs(edge.curve?.normal ?? bend) < 0.001
        ? normal.y > 0 || (Math.abs(normal.y) < 0.001 && normal.x < 0)
        : normal.x * bow.x + normal.y * bow.y < 0
    )
      normal = mul(normal, -1);
    path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  const dimensions = labelSize(edge);
  const clearance =
    8 +
    (Math.abs(normal.x) * dimensions.width) / 2 +
    (Math.abs(normal.y) * dimensions.height) / 2;
  const label = add(midpoint, mul(normal, clearance));
  const bounds = [
    start,
    control,
    ...(control2 ? [control2] : []),
    end,
    { x: label.x - dimensions.width / 2, y: label.y - dimensions.height / 2 },
    { x: label.x + dimensions.width / 2, y: label.y + dimensions.height / 2 },
  ];
  return {
    path,
    label,
    start,
    end,
    control,
    control2,
    midpoint,
    normal,
    bounds,
    handle: control2 ? midpoint : control,
  };
}
export function reshapeEdge(edge: Edge, doc: Automaton, handle: Point): Edge {
  const a = doc.nodes.find((n) => n.id === edge.source)!,
    b = doc.nodes.find((n) => n.id === edge.target)!;
  if (a.id === b.id) {
    const dx = handle.x - a.x,
      dy = handle.y - a.y;
    const distance = Math.hypot(dx, dy);
    return {
      ...edge,
      loop: {
        angle:
          distance < 1
            ? (edge.loop?.angle ?? -Math.PI / 2)
            : Math.atan2(dy, dx),
        size: Math.max(
          35,
          Math.min(
            1500,
            (distance - ((R * Math.cos(0.7)) / 4 + R * 0.75)) / 0.9,
          ),
        ),
      },
    };
  }
  const axis = unit({ x: b.x - a.x, y: b.y - a.y }),
    dx = handle.x - (a.x + b.x) / 2,
    dy = handle.y - (a.y + b.y) / 2;
  const normal = -dx * axis.y + dy * axis.x;
  return {
    ...edge,
    curve: {
      along: dx * axis.x + dy * axis.y,
      normal: Math.abs(normal) < 8 ? 0 : normal,
    },
  };
}
