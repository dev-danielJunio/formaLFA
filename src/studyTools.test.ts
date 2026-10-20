import { beforeEach, describe, expect, it } from "vitest";
import { clone, emptySelection, example, type Automaton } from "./model";
import { createTable, studyBounds } from "./studyTools";
import { parseProject, toSvg } from "./io";
import { trace } from "./engine";
import { useEditor } from "./store";

const project = (): Automaton => ({ ...clone(example), tables: [createTable(example, {x:900,y:400}, "table1")], strokes: [{id:"ink1",x:100,y:500,color:"#2563eb",width:7,points:[{x:0,y:0},{x:100,y:50}]}] });
describe("tabelas e canetinha", () => {
  beforeEach(() => useEditor.setState({doc:clone(example),past:[],future:[],selection:emptySelection(),revision:0}));
  it("cria cabeçalhos pelo alfabeto, sem compartilhar linhas", () => {
    const table = createTable(example,{x:1,y:2},"t");
    expect(table.cells[0]).toEqual(["Estado / conjunto","ε-fecho","0","1"]);
    table.cells[1][0]="A={q0,q1}";
    expect(table.cells[2][0]).toBe("");
  });
  it("preserva células, cor, espessura e posições no JSON sem mudar a simulação", () => {
    const doc=project();doc.tables![0].cells[1][0]="A = {q0, q1}";
    expect(parseProject(JSON.stringify(doc))).toEqual(doc);
    expect(trace(doc,"1001")).toEqual(trace(example,"1001"));
    expect(parseProject(JSON.stringify(example)).tables).toBeUndefined();
  });
  it("valida tabelas retangulares e IDs globais", () => {
    const doc=project();doc.tables![0].cells[1].pop();
    expect(()=>parseProject(JSON.stringify(doc))).toThrow(/Tabela inválida/);
    const duplicate=project();duplicate.strokes![0].id="q0";
    expect(()=>parseProject(JSON.stringify(duplicate))).toThrow(/Identificador/);
  });
  it("recusa traços sem pontos, cores externas, espessura ou coordenadas inválidas", () => {
    for(const patch of [{points:[]},{color:"url(https://example.com)"},{width:0},{width:13},{points:[{x:1e7,y:0}]}]) {
      const doc=project();Object.assign(doc.strokes![0],patch);
      expect(()=>parseProject(JSON.stringify(doc))).toThrow(/Traço inválido/);
    }
  });
  it("inclui materiais e texto escapado na exportação SVG e nos limites", () => {
    const doc=project();doc.tables![0].cells[1][0]="<b>&";
    const svg=toSvg(doc);
    expect(svg).toContain("&lt;b&gt;&amp;");
    expect(svg).toContain('stroke="#2563eb" stroke-width="7"');
    expect(studyBounds(doc)).toContainEqual({x:1540,y:620});
    expect(studyBounds(doc)).toContainEqual({x:207,y:557});
  });
  it("exclusão, undo e redo preservam materiais e autômato", () => {
    useEditor.getState().replace(project());
    const before=clone(useEditor.getState().doc);
    useEditor.getState().select({...emptySelection(),tables:["table1"],strokes:["ink1"]});
    useEditor.getState().removeSelected();
    expect(useEditor.getState().doc.tables).toEqual([]);
    expect(useEditor.getState().doc.strokes).toEqual([]);
    expect(useEditor.getState().doc.nodes).toEqual(example.nodes);
    useEditor.getState().undo();expect(useEditor.getState().doc).toEqual(before);
    useEditor.getState().redo();expect(useEditor.getState().doc.tables).toEqual([]);
  });
  it("abrir projeto antigo limpa materiais anteriores e pode ser desfeito", () => {
    useEditor.getState().replace(project());useEditor.getState().replace(example);
    expect(useEditor.getState().doc.strokes).toEqual([]);
    expect(useEditor.getState().doc.tables).toEqual([]);
    useEditor.getState().undo();expect(useEditor.getState().doc.tables).toHaveLength(1);
  });
});
