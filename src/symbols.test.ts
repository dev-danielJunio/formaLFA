import { describe, expect, it } from "vitest";
import { parseSymbols } from "./symbols";
import { trace } from "./engine";
import { clone, example } from "./model";

describe("símbolos separados por vírgula", () => {
  it.each(["0,1", "0, 1", " 0 , 1 "])(
    "aceita %s como dois símbolos",
    (value) => {
      expect(parseSymbols(value)).toEqual(["0", "1"]);
    },
  );
  it("aceita letras e elimina duplicatas", () => {
    expect(parseSymbols("a,b,a")).toEqual(["a", "b"]);
  });
  it.each(["1, 0", "1 , 0", "1,\u00a00"])(
    "normaliza espaços em %s e simula ambos os símbolos",
    (value) => {
      const doc = clone(example);
      doc.edges = [
        {
          id: "both",
          source: "q0",
          target: "q2",
          symbols: parseSymbols(value),
        },
      ];
      expect(doc.edges[0].symbols).toEqual(["1", "0"]);
      expect(trace(doc, "1").at(-1)?.status).toBe("accepted");
      expect(trace(doc, "0").at(-1)?.status).toBe("accepted");
    },
  );
  it("explica entradas incompletas ao confirmar", () => {
    expect(() => parseSymbols("0,")).toThrow(/depois de cada vírgula/);
    expect(() => parseSymbols("ab")).toThrow(/Separe/);
  });
  it("permite epsilon sem escolher o tipo manualmente", () => {
    expect(parseSymbols("ε,a")).toEqual(["ε", "a"]);
  });
  it("o simulador reconhece cada símbolo da mesma transição", () => {
    const doc = clone(example);
    doc.edges = [
      {
        id: "both",
        source: "q0",
        target: "q2",
        symbols: parseSymbols("0,1"),
      },
    ];
    expect(trace(doc, "0").at(-1)?.status).toBe("accepted");
    expect(trace(doc, "1").at(-1)?.status).toBe("accepted");
    expect(trace(doc, "2").at(-1)?.status).toBe("rejected");
  });
});
