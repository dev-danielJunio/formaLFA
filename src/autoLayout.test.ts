import { describe, expect, it } from "vitest";
import { autoLayout } from "./autoLayout";
import { clone, example } from "./model";
import { edgeGeometry } from "./geometry";
import { trace } from "./engine";
import { noteLayout, NOTE_TOP, resizeNote } from "./noteLayout";
import { parseProject, toSvg } from "./io";

describe("organização de autômatos importados", () => {
  it("separa estados coincidentes, inclui componentes isolados e mantém a semântica", () => {
    const doc = clone(example);
    doc.nodes.forEach((n) => {
      n.x = 0;
      n.y = 0;
    });
    doc.nodes.push({
      id: "isolado",
      label: "isolado",
      x: 0,
      y: 0,
      initial: false,
      final: false,
    });
    const result = autoLayout(doc);
    for (let i = 0; i < result.nodes.length; i++)
      for (let j = i + 1; j < result.nodes.length; j++)
        expect(
          Math.hypot(
            result.nodes[i].x - result.nodes[j].x,
            result.nodes[i].y - result.nodes[j].y,
          ),
        ).toBeGreaterThanOrEqual(200);
    expect(doc.nodes[0].x).toBe(0);
    for (const word of ["", "01", "101", "100", "111"])
      expect(trace(result, word)).toEqual(trace(doc, word));
    expect(autoLayout(doc)).toEqual(result);
  });
  it("separa curvas paralelas e reversas e seus rótulos", () => {
    const doc = clone(example);
    doc.mode = "AFN";
    doc.edges = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      source: i % 2 ? "q1" : "q0",
      target: i % 2 ? "q0" : "q1",
      symbols: [String(i)],
    }));
    const result = autoLayout(doc),
      geometries = result.edges.map((e) => edgeGeometry(e, result));
    expect(new Set(geometries.map((g) => g.path)).size).toBe(6);
    for (let i = 0; i < geometries.length; i++)
      for (let j = i + 1; j < geometries.length; j++)
        expect(
          Math.hypot(
            geometries[i].label.x - geometries[j].label.x,
            geometries[i].label.y - geometries[j].label.y,
          ),
        ).toBeGreaterThan(32);
    expect(parseProject(JSON.stringify(result))).toEqual(
      { ...JSON.parse(JSON.stringify(result)), mode: "AFD" },
    );
  });
  it("distribui loops no mesmo estado e afasta anotações", () => {
    const doc = clone(example);
    doc.edges = Array.from({ length: 4 }, (_, i) => ({
      id: `l${i}`,
      source: "q0",
      target: "q0",
      symbols: [String(i)],
    }));
    const result = autoLayout(doc);
    expect(new Set(result.edges.map((e) => e.loop?.angle)).size).toBe(4);
    const top = Math.min(
      ...result.edges.flatMap((e) =>
        edgeGeometry(e, result).bounds.map((p) => p.y),
      ),
    );
    for (const n of result.notes)
      expect(n.y + noteLayout(n.text).height).toBeLessThan(top);
  });
});

describe("redimensionamento de anotações", () => {
  it.each(["nw", "ne", "sw", "se"])(
    "mantém o canto oposto fixo ao arrastar %s",
    (corner) => {
      const note = {
        id: "n",
        text: "Anotação\nDuas linhas",
        x: 200,
        y: 140,
        scale: 1,
      };
      const size = noteLayout(note.text),
        w = size.width + 8,
        h = size.height + 8;
      const resized = resizeNote(
        note,
        { x: 0, y: 0 },
        {
          x: corner.endsWith("w") ? -40 : 40,
          y: corner.startsWith("n") ? -20 : 20,
        },
        corner,
      );
      const anchor = (n: typeof note) => ({
        x: n.x - 4 * n.scale + (corner.endsWith("w") ? w * n.scale : 0),
        y:
          n.y +
          (NOTE_TOP - 4) * n.scale +
          (corner.startsWith("n") ? h * n.scale : 0),
      });
      expect(resized.scale).toBeGreaterThan(1);
      expect(anchor(resized as typeof note).x).toBeCloseTo(anchor(note).x);
      expect(anchor(resized as typeof note).y).toBeCloseTo(anchor(note).y);
    },
  );
  it("limita o tamanho, preserva no JSON e exporta a fonte redimensionada", () => {
    const doc = clone(example);
    doc.notes[0].scale = 0.5;
    expect(parseProject(JSON.stringify(doc))).toEqual(doc);
    expect(toSvg(doc)).toContain('font-size="7"');
    expect(
      resizeNote(doc.notes[0], { x: 0, y: 0 }, { x: -9999, y: -9999 }, "se")
        .scale,
    ).toBe(0.5);
    doc.notes[0].scale = 0;
    expect(() => parseProject(JSON.stringify(doc))).toThrow(/Anotação/);
  });
});
