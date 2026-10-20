import { describe, expect, it } from "vitest";
import type { Automaton, StateNode } from "./model";
import { createConnectionRouter, withNewConnection } from "./connectionRouting";
import { edgeGeometry, R } from "./geometry";
import { curveSamples } from "./autoLayout";

const node = (id: string, x: number, y: number): StateNode => ({
  id,
  x,
  y,
  label: id,
  initial: false,
  final: false,
});
const a = node("a", 0, 0),
  b = node("b", 400, 0);
const graph = (nodes = [a, b]): Automaton => ({
  version: 1,
  title: "Routing",
  mode: "AFN",
  nodes,
  edges: [],
  notes: [],
});
const anchor = { x: R, y: 0 };

describe("prévia de conexão", () => {
  it("mantém reta uma conexão livre e usa o mesmo caminho ao salvar", () => {
    const doc = graph(),
      before = structuredClone(doc);
    const route = createConnectionRouter(doc)(a.id, b, anchor)!;
    expect(route.target).toBe(b.id);
    expect(route.edge.curve?.normal).toBe(0);
    expect(route.geometry.path).toBe(
      edgeGeometry(route.edge, withNewConnection(doc, route.edge)).path,
    );
    expect(doc).toEqual(before);
  });
  it("desvia de um estado no meio sem alterar sua posição", () => {
    const obstacle = node("c", 200, 0),
      doc = graph([a, b, obstacle]);
    const route = createConnectionRouter(doc)(a.id, b, anchor)!;
    const samples = curveSamples(route.edge, doc);
    expect(Math.abs(route.edge.curve!.normal)).toBeGreaterThan(70);
    expect(
      Math.min(
        ...samples.map((p) => Math.hypot(p.x - obstacle.x, p.y - obstacle.y)),
      ),
    ).toBeGreaterThan(R + 12);
    expect(doc.nodes[2]).toEqual(obstacle);
  });
  it("separa ida e volta e preserva o traçado anterior ao salvar", () => {
    const doc = graph();
    doc.edges.push({
      id: "return",
      source: b.id,
      target: a.id,
      symbols: ["0"],
      curve: { along: 0, normal: 0 },
    });
    const before = edgeGeometry(doc.edges[0], doc).path;
    const route = createConnectionRouter(doc)(a.id, b, anchor)!;
    expect(Math.abs(route.edge.curve!.normal)).toBeGreaterThan(0);
    const saved = withNewConnection(doc, route.edge);
    expect(edgeGeometry(saved.edges[0], saved).path).toBe(before);
    expect(edgeGeometry(route.edge, saved).path).toBe(route.geometry.path);
  });
  it("não muda uma curva implícita antiga ao acrescentar o sentido contrário", () => {
    const doc = graph();
    doc.edges.push({
      id: "return",
      source: b.id,
      target: a.id,
      symbols: ["0"],
    });
    const before = edgeGeometry(doc.edges[0], doc).path;
    const route = createConnectionRouter(doc)(a.id, b, anchor)!;
    const saved = withNewConnection(doc, route.edge);
    expect(edgeGeometry(saved.edges[0], saved).path).toBe(before);
    expect(doc.edges[0].curve).toBeUndefined();
  });
  it("contorna texto e tabela entre os estados", () => {
    const doc = graph();
    doc.notes.push({
      id: "note",
      x: 120,
      y: 0,
      text: "Texto de estudo",
      scale: 2,
    });
    doc.tables = [{ id: "table", x: 140, y: -70, cells: [["Estado"], ["a"]] }];
    const route = createConnectionRouter(doc)(a.id, b, anchor)!;
    expect(
      curveSamples(route.edge, doc)
        .filter((p) => p.x >= 128 && p.x <= 312)
        .every((p) => p.y < -82 || p.y > 66),
    ).toBe(true);
  });
  it("desvia também dos traços da canetinha", () => {
    const doc = graph();
    doc.strokes = [
      {
        id: "ink",
        x: 200,
        y: -35,
        color: "red",
        width: 8,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 70 },
        ],
      },
    ];
    const route = createConnectionRouter(doc)(a.id, b, anchor)!;
    expect(Math.abs(route.geometry.midpoint.y)).toBeGreaterThan(45);
  });
  it("mostra loop orientado pela âncora e o preserva ao soltar", () => {
    const doc = graph([a]);
    const route = createConnectionRouter(doc)(a.id, { x: 20, y: 0 }, anchor)!;
    expect(route.edge.loop?.angle).toBe(0);
    expect(route.geometry.path).toContain(" C ");
    expect(route.geometry.path).toBe(
      edgeGeometry(route.edge, withNewConnection(doc, route.edge)).path,
    );
  });
  it("afasta um loop de um estado vizinho", () => {
    const doc = graph([a, node("obstacle", 100, 0)]);
    const route = createConnectionRouter(doc)(a.id, { x: 20, y: 0 }, anchor)!;
    expect(route.edge.loop?.angle).not.toBe(0);
  });
  it("segue o ponteiro sem destino e não cria conexão com clique simples", () => {
    const route = createConnectionRouter(graph());
    expect(route(a.id, anchor, anchor)).toBeNull();
    const pointer = { x: 170, y: 140 },
      preview = route(a.id, pointer, anchor)!;
    expect(preview.target).toBeUndefined();
    expect(preview.geometry.end).toEqual(pointer);
  });
  it("reutiliza a transição já existente, incluindo a curva manual", () => {
    const doc = graph();
    const edge = {
      id: "old",
      source: a.id,
      target: b.id,
      symbols: ["x"],
      curve: { along: 30, normal: 250 },
    };
    doc.edges.push(edge);
    expect(createConnectionRouter(doc)(a.id, b, anchor)!.edge).toBe(edge);
  });
  it("permanece finita com estados sobrepostos", () => {
    const doc = graph([a, node("b", 0, 0)]);
    const route = createConnectionRouter(doc)(a.id, { x: 0, y: 0 }, anchor)!;
    expect(route.geometry.path).not.toMatch(/NaN|Infinity/);
  });
});
