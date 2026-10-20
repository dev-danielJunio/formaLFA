import { beforeEach, describe, expect, it } from "vitest";
import { detectAutomatonType } from "./automatonType";
import { clone, emptySelection, example } from "./model";
import { parseProject } from "./io";
import { useEditor } from "./store";
import { trace } from "./engine";

describe("identificação automática", () => {
  beforeEach(() =>
    useEditor.setState({
      doc: clone(example),
      past: [],
      future: [],
      selection: emptySelection(),
      revision: 0,
    }),
  );
  it("reconhece AFD completo, parcial e sem transições", () => {
    expect(detectAutomatonType(example)).toBe("AFD");
    expect(detectAutomatonType({ edges: example.edges.slice(0, 2) })).toBe(
      "AFD",
    );
    expect(detectAutomatonType({ edges: [] })).toBe("AFD");
  });
  it("reconhece AFN por epsilon mesmo em um loop", () => {
    const doc = clone(example);
    doc.edges[0].symbols = ["ε"];
    expect(detectAutomatonType(doc)).toBe("AFN");
  });
  it("detecta destinos distintos para o mesmo símbolo, incluindo Unicode", () => {
    expect(
      detectAutomatonType({
        edges: [
          { id: "a", source: "s", target: "x", symbols: ["0", "😀"] },
          { id: "b", source: "s", target: "y", symbols: ["😀"] },
        ],
      }),
    ).toBe("AFN");
  });
  it("não confunde símbolos múltiplos, origens diferentes ou arestas duplicadas com não determinismo", () => {
    expect(
      detectAutomatonType({
        edges: [
          { id: "a", source: "s", target: "x", symbols: ["0", "1"] },
          { id: "b", source: "s", target: "x", symbols: ["1"] },
          { id: "c", source: "x", target: "s", symbols: ["0", "1"] },
        ],
      }),
    ).toBe("AFD");
  });
  it("troca AFD → AFN → AFD em uma ação por edição e acompanha undo/redo", () => {
    const store = useEditor.getState();
    store.commit((d) => {
      d.edges.push({
        id: "branch",
        source: "q0",
        target: "q2",
        symbols: ["0"],
      });
    });
    expect(useEditor.getState().doc.mode).toBe("AFN");
    expect(useEditor.getState().past).toHaveLength(1);
    expect(trace(useEditor.getState().doc, "0").at(-1)?.status).toBe(
      "accepted",
    );
    store.undo();
    expect(useEditor.getState().doc.mode).toBe("AFD");
    store.redo();
    expect(useEditor.getState().doc.mode).toBe("AFN");
    store.select({ ...emptySelection(), edges: ["branch"] });
    store.removeSelected();
    expect(useEditor.getState().doc.mode).toBe("AFD");
  });
  it("recalcula o tipo ao editar símbolos e remover estados", () => {
    const store = useEditor.getState();
    store.commit((d) => {
      d.edges[0].symbols = ["ε"];
    });
    expect(useEditor.getState().doc.mode).toBe("AFN");
    store.commit((d) => {
      d.edges[0].symbols = ["1"];
    });
    expect(useEditor.getState().doc.mode).toBe("AFD");
    store.commit((d) => {
      d.edges[0].symbols = ["ε"];
    });
    store.select({ ...emptySelection(), nodes: ["q0"] });
    store.removeSelected();
    expect(useEditor.getState().doc.mode).toBe("AFD");
  });
  it("corrige tipos antigos na importação e aceita JSON sem mode", () => {
    const doc = clone(example);
    doc.edges[0].symbols = ["ε"];
    expect(parseProject(JSON.stringify(doc)).mode).toBe("AFN");
    expect(parseProject(JSON.stringify({ ...example, mode: "AFN" })).mode).toBe(
      "AFD",
    );
    expect(parseProject(JSON.stringify({ ...doc, mode: undefined })).mode).toBe(
      "AFN",
    );
    useEditor.getState().replace(doc);
    expect(useEditor.getState().doc.mode).toBe("AFN");
  });
});
