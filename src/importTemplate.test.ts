import { describe, it, expect } from "vitest";
import { importTemplateJson } from "./importTemplate";
import { parseProject } from "./io";
import { trace, validate } from "./engine";
import { useEditor } from "./store";

describe("modelo de importação para IA", () => {
  it("é JSON válido, importável e ignora apenas as instruções auxiliares", () => {
    expect(JSON.parse(importTemplateJson)._guia_para_ia.campos).toHaveProperty(
      "nodes",
    );
    const doc = parseProject(importTemplateJson);
    expect(doc).not.toHaveProperty("_guia_para_ia");
    expect(validate(doc)).toEqual([]);
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges[0].loop?.size).toBe(80);
    expect(doc.edges[1].curve?.normal).toBe(60);
  });
  it("o exemplo aceita exatamente palavras terminadas em 1", () => {
    const doc = parseProject(importTemplateJson);
    for (const word of ["", "0", "1", "01", "10", "101", "1010"]) {
      expect(trace(doc, word).at(-1)?.status).toBe(
        word.endsWith("1") ? "accepted" : "rejected",
      );
    }
  });
  it("aceita o BOM de arquivos UTF-8 e mantém o limite em bytes", () => {
    expect(parseProject("\uFEFF" + importTemplateJson).nodes).toHaveLength(2);
    expect(() => parseProject("é".repeat(1_000_001))).toThrow(/2 MB/);
  });
  it("não altera o documento ao validar e permite desfazer a importação", () => {
    const before = useEditor.getState().doc;
    const parsed = parseProject(importTemplateJson);
    expect(useEditor.getState().doc).toBe(before);
    useEditor.getState().replace(parsed);
    expect(useEditor.getState().doc.title).toBe(parsed.title);
    useEditor.getState().undo();
    expect(useEditor.getState().doc).toEqual(before);
  });
});
