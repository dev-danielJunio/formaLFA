import { describe, expect, it } from "vitest";
import { clone, example } from "./model";
import { edgeGeometry, labelSize, reshapeEdge } from "./geometry";
import { parseProject, toSvg } from "./io";

describe("curvas editáveis", () => {
  it("mantém curva finita e rótulo afastado com estados sobrepostos", () => {
    const doc = clone(example);
    doc.nodes[1].x = doc.nodes[0].x;
    doc.nodes[1].y = doc.nodes[0].y;
    const edge = reshapeEdge(doc.edges[1], doc, {
      x: doc.nodes[0].x,
      y: doc.nodes[0].y - 100,
    });
    const g = edgeGeometry(edge, doc);
    expect(g.path).not.toMatch(/NaN|Infinity/);
    expect(
      Math.hypot(g.label.x - g.midpoint.x, g.label.y - g.midpoint.y),
    ).toBeGreaterThan(14);
    expect(edge.curve?.normal).toBe(-100);
  });
  it("usa Bézier quadrática e permite endireitar pelo ponto de controle", () => {
    const edge = example.edges[1];
    const curved = reshapeEdge(edge, example, { x: 320, y: 400 });
    expect(curved.curve?.normal).toBe(120);
    expect(edgeGeometry(curved, example).path).toContain(" Q ");
    expect(reshapeEdge(curved, example, { x: 320, y: 282 }).curve?.normal).toBe(
      0,
    );
  });
  it("movimento coletivo preserva curvatura e acompanha os estados", () => {
    const edge = { ...example.edges[1], curve: { along: 15, normal: 80 } };
    const before = edgeGeometry(edge, example);
    const moved = clone(example);
    moved.nodes.forEach((n) => {
      n.x += 50;
      n.y -= 30;
    });
    const after = edgeGeometry(edge, moved);
    expect(after.control.x - before.control.x).toBeCloseTo(50);
    expect(after.control.y - before.control.y).toBeCloseTo(-30);
  });
  it("afasta o rótulo pela normal inclusive em transição vertical", () => {
    const doc = clone(example);
    doc.nodes[1].x = doc.nodes[0].x;
    doc.nodes[1].y += 250;
    const edge = {
      ...doc.edges[1],
      symbols: ["a", "b"],
      curve: { along: 0, normal: 0 },
    };
    const g = edgeGeometry(edge, doc),
      size = labelSize(edge);
    const tangent = { x: g.end.x - g.start.x, y: g.end.y - g.start.y };
    expect(tangent.x * g.normal.x + tangent.y * g.normal.y).toBeCloseTo(0);
    expect(Math.abs(g.label.x - g.midpoint.x)).toBeGreaterThan(size.width / 2);
  });
  it("altera ângulo e tamanho do loop sem atravessar o centro", () => {
    const edge = example.edges[0],
      node = example.nodes[0];
    const adjusted = reshapeEdge(edge, example, { x: node.x + 220, y: node.y });
    expect(adjusted.loop?.angle).toBeCloseTo(0);
    expect(adjusted.loop!.size).toBeGreaterThan(80);
    const g = edgeGeometry(adjusted, example);
    expect(g.midpoint.x).toBeCloseTo(node.x + 220);
    expect(Math.hypot(g.start.x - node.x, g.start.y - node.y)).toBeCloseTo(34);
  });
  it("exporta curvas e loops sem perder a geometria no JSON", () => {
    const doc = clone(example);
    doc.edges[1].curve = { along: 35, normal: -500 };
    doc.edges[0].loop = { angle: 0, size: 200 };
    expect(parseProject(JSON.stringify(doc))).toEqual(doc);
    const svg = toSvg(doc);
    expect(svg).toContain(edgeGeometry(doc.edges[1], doc).path);
    expect(svg).toContain('fill="white"');
    const values = svg
      .match(/viewBox="([^"]+)"/)![1]
      .split(" ")
      .map(Number);
    expect(values[1]).toBeLessThan(-200);
  });
  it("rejeita geometria inválida de arquivos importados", () => {
    const doc = clone(example);
    doc.edges[0].loop = { angle: 0, size: -20 };
    expect(() => parseProject(JSON.stringify(doc))).toThrow(/Loop inválido/);
    delete doc.edges[0].loop;
    doc.edges[1].curve = { along: NaN, normal: 0 };
    expect(() => parseProject(JSON.stringify(doc))).toThrow(
      /Curvatura inválida/,
    );
  });
});
