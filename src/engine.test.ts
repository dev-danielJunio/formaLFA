import { describe, it, expect, beforeEach } from "vitest";
import { trace, validate, closure } from "./engine";
import { clone, example, emptySelection, type Automaton } from "./model";
import { parseProject, toSvg } from "./io";
import { useEditor } from "./store";
describe("matemática de autômatos", () => {
  it("reconhece todas as palavras binárias até comprimento 7 pelo sufixo", () => {
    for (let size = 0; size <= 7; size++)
      for (let n = 0; n < 2 ** size; n++) {
        const word = size ? n.toString(2).padStart(size, "0") : "";
        expect(trace(example, word).at(-1)!.status, word).toBe(
          word.endsWith("01") ? "accepted" : "rejected",
        );
      }
  });
  it("rejeita imediatamente símbolo sem transição", () => {
    const frames = trace(example, "2");
    expect(frames.at(-1)).toMatchObject({
      index: 1,
      active: [],
      status: "rejected",
    });
  });
  it("preserva estados anteriores sem mutação", () => {
    const original = JSON.stringify(example),
      f = trace(example, "01");
    expect(f.map((x) => x.active)).toEqual([["q0"], ["q1"], ["q2"]]);
    expect(JSON.stringify(example)).toBe(original);
  });
  const nfa = (): Automaton => ({
    version: 1,
    title: "epsilon",
    mode: "AFN",
    nodes: [
      { id: "a", label: "a", x: 0, y: 0, initial: true, final: false },
      { id: "b", label: "b", x: 100, y: 0, initial: false, final: false },
      { id: "c", label: "c", x: 200, y: 0, initial: false, final: true },
    ],
    notes: [],
    edges: [
      { id: "ab", source: "a", target: "b", symbols: ["ε"] },
      { id: "ba", source: "b", target: "a", symbols: ["ε"] },
      { id: "bb", source: "b", target: "b", symbols: ["x"] },
      { id: "bc", source: "b", target: "c", symbols: ["x"] },
    ],
  });
  it("termina em ciclos epsilon e mantém ramos concorrentes", () => {
    const d = nfa();
    expect(closure(["a"], d.edges).active).toEqual(["a", "b"]);
    const f = trace(d, "x");
    expect(new Set(f[1].active)).toEqual(new Set(["a", "b", "c"]));
    expect(f.at(-1)!.status).toBe("accepted");
  });
  it("aceita vazio via fecho epsilon e após consumir o último símbolo", () => {
    const d = nfa();
    d.edges.push({ id: "epsilon", source: "b", target: "c", symbols: ["ε"] });
    expect(trace(d, "")[0].status).toBe("accepted");
    expect(trace(d, "x").at(-1)!.status).toBe("accepted");
  });
  it("processa símbolos Unicode por code point", () => {
    const d = nfa();
    d.edges = d.edges.map((e) => ({
      ...e,
      symbols: e.symbols.map((s) => (s === "x" ? "😀" : s)),
    }));
    expect(trace(d, "😀")).toHaveLength(2);
    expect(trace(d, "😀").at(-1)!.status).toBe("accepted");
  });
  it("processa ramificação e epsilon mesmo com tipo declarado desatualizado", () => {
    const d = clone(example);
    d.edges.push({
      id: "bad",
      source: "q0",
      target: "q2",
      symbols: ["0", "ε"],
    });
    expect(validate(d)).toHaveLength(0);
    expect(trace(d, "0").at(-1)?.status).toBe("accepted");
  });
  it("exige exatamente um estado inicial", () => {
    const d = clone(example);
    d.nodes[1].initial = true;
    expect(() => trace(d, "")).toThrow(/inicial/);
  });
});
describe("histórico transacional", () => {
  it("troca o estado inicial em uma ação reversível", () => {
    const s = useEditor.getState();
    s.setInitialNode("q2");
    expect(
      useEditor
        .getState()
        .doc.nodes.filter((n) => n.initial)
        .map((n) => n.id),
    ).toEqual(["q2"]);
    expect(useEditor.getState().past).toHaveLength(1);
    s.undo();
    expect(
      useEditor
        .getState()
        .doc.nodes.filter((n) => n.initial)
        .map((n) => n.id),
    ).toEqual(["q0"]);
    s.redo();
    expect(
      useEditor
        .getState()
        .doc.nodes.filter((n) => n.initial)
        .map((n) => n.id),
    ).toEqual(["q2"]);
  });
  it("não altera o projeto ao escolher o inicial atual ou um ID inexistente", () => {
    const s = useEditor.getState();
    s.setInitialNode("q0");
    s.setInitialNode("inexistente");
    expect(useEditor.getState().past).toHaveLength(0);
    expect(useEditor.getState().doc).toEqual(example);
  });
  beforeEach(() =>
    useEditor.setState({
      doc: clone(example),
      past: [],
      future: [],
      selection: emptySelection(),
      revision: 0,
    }),
  );
  it("movimento em grupo é uma ação reversível e redo restaura o documento", () => {
    const original = clone(useEditor.getState().doc);
    useEditor.getState().commit((d) => {
      d.nodes.forEach((n) => (n.x += 20));
    });
    const moved = clone(useEditor.getState().doc);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().doc).toEqual(original);
    useEditor.getState().redo();
    expect(useEditor.getState().doc).toEqual(moved);
  });
  it("nova ação invalida redo e no-op não cresce histórico", () => {
    const s = useEditor.getState();
    s.commit(() => {});
    expect(useEditor.getState().past).toHaveLength(0);
    s.addNode({ x: 0, y: 0 });
    s.undo();
    s.addNote({ x: 0, y: 0 });
    expect(useEditor.getState().future).toHaveLength(0);
  });
  it("exclusão remove arestas incidentes e undo restaura tudo", () => {
    const s = useEditor.getState();
    s.select({ nodes: ["q1"], edges: [], notes: [], tables: [], strokes: [] });
    s.removeSelected();
    expect(
      useEditor
        .getState()
        .doc.edges.every((e) => e.source !== "q1" && e.target !== "q1"),
    ).toBe(true);
    s.undo();
    expect(useEditor.getState().doc).toEqual(example);
  });
});
describe("arquivos", () => {
  it("round trip JSON preserva projeto", () =>
    expect(parseProject(JSON.stringify(example))).toEqual(example));
  it("rejeita referência quebrada e IDs duplicados", () => {
    const d = clone(example);
    d.edges[0].target = "missing";
    expect(() => parseProject(JSON.stringify(d))).toThrow();
    d.edges = example.edges;
    d.nodes[1].id = "q0";
    expect(() => parseProject(JSON.stringify(d))).toThrow();
  });
  it("SVG escapa conteúdo e omite grid e seleção", () => {
    const d = clone(example);
    d.nodes[0].label = "<script>";
    const svg = toSvg(d);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("class=");
    expect(svg).not.toContain("<pattern");
  });
});
