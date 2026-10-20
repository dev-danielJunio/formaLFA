import { SlidersHorizontal, Trash2 } from "lucide-react";
import { useEditor } from "../store";
import { TransitionSymbolsInput } from "./TransitionSymbolsInput";
import { automaticTypeHint } from "../automatonType";
import { uppercaseStateInput } from "../stateLabel";
export function Inspector() {
  const { doc, selection, commit, removeSelected } = useEditor(),
    count = Object.values(selection).reduce((sum, ids) => sum + ids.length, 0);
  const node =
    selection.nodes.length === 1
      ? doc.nodes.find((n) => n.id === selection.nodes[0])
      : undefined;
  const note =
    selection.notes.length === 1
      ? doc.notes.find((n) => n.id === selection.notes[0])
      : undefined;
  const edge =
    selection.edges.length === 1
      ? doc.edges.find((n) => n.id === selection.edges[0])
      : undefined;
  return (
    <div className="inspector">
      <section className="inspector-project">
        <div className="side-title">
          <SlidersHorizontal size={19} />
          <h1>Propriedades</h1>
        </div>
        <p className="side-description">Ajuste os detalhes do seu autômato.</p>
        <label className="field-label" htmlFor="project-name">
          NOME DO PROJETO
        </label>
        <input
          id="project-name"
          key={doc.title}
          defaultValue={doc.title}
          maxLength={120}
          onBlur={(e) =>
            commit((d) => {
              d.title = e.target.value.trim() || "Autômato sem título";
            })
          }
        />
        <div className="field-label">TIPO DE AUTÔMATO</div>
        <div className="automatic-type" role="status" title={automaticTypeHint}>
          <strong>{doc.mode}</strong>
          <span>Identificado automaticamente</span>
        </div>
        <p className="field-hint">{automaticTypeHint}</p>
      </section>
      <section className="inspector-selection">
        <div className="section-heading">
          {count
            ? `${count} ELEMENTO(S) SELECIONADO(S)`
            : "SELECIONE UM ELEMENTO"}
        </div>
        {node && (
          <>
            <label className="field-label" htmlFor="state-name">
              NOME DO ESTADO
            </label>
            <input
              id="state-name"
              key={node.id + node.label}
              maxLength={30}
              defaultValue={node.label}
              onChange={(e) => {
                if (!(e.nativeEvent as InputEvent).isComposing)
                  uppercaseStateInput(e.currentTarget);
              }}
              onCompositionEnd={(e) => uppercaseStateInput(e.currentTarget)}
              onBlur={(e) =>
                commit((d) => {
                  d.nodes.find((n) => n.id === node.id)!.label =
                    e.target.value.trim() || node.label;
                })
              }
            />
            <label className="check-row">
              <input
                type="checkbox"
                checked={node.initial}
                onChange={(e) =>
                  commit((d) => {
                    for (const n of d.nodes)
                      n.initial = n.id === node.id ? e.target.checked : false;
                  })
                }
              />{" "}
              Estado inicial
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={node.final}
                onChange={(e) =>
                  commit((d) => {
                    d.nodes.find((n) => n.id === node.id)!.final =
                      e.target.checked;
                  })
                }
              />{" "}
              Estado final (círculo duplo)
            </label>
          </>
        )}
        {edge && (
          <>
            <label className="field-label" htmlFor="edge-symbols">
              SÍMBOLOS DA TRANSIÇÃO
            </label>
            <TransitionSymbolsInput
              key={edge.id + edge.symbols.join(",")}
              initialValue={edge.symbols.join(", ")}
              onConfirm={(symbols) =>
                commit((d) => {
                  const target = d.edges.find((x) => x.id === edge.id);
                  if (target) target.symbols = symbols;
                })
              }
              onCancel={() => {}}
            />
            <p className="field-hint">
              Separe por vírgula: 0, 1. Usar ε identifica o autômato como AFN.
              <br />
              Enter ou clique fora para confirmar.
            </p>
          </>
        )}
        {note && (
          <>
            <p className="field-hint">
              Dê dois cliques na anotação para editar o texto no canvas. Arraste
              para movê-la.
            </p>
          </>
        )}
        {selection.tables.length > 0 && (
          <p className="field-hint">
            Dê dois cliques em uma célula para preencher. Arraste a tabela para
            mover; use os botões sobre ela para ajustar linhas e colunas.
          </p>
        )}
        {selection.strokes.length > 0 && (
          <p className="field-hint">
            Arraste o traço para mover. Delete exclui; Ctrl+Z desfaz.
          </p>
        )}
        {count > 0 ? (
          <button className="danger-button" onClick={removeSelected}>
            <Trash2 size={16} /> Excluir seleção
          </button>
        ) : (
          <p className="inspector-empty">
            Clique em um estado, transição ou anotação no canvas para editar.
          </p>
        )}
      </section>
      <div className="tip">
        <span>SELEÇÃO E MOVIMENTO</span>
        <p>
          Arraste no fundo para selecionar em grupo. Depois, arraste um estado
          selecionado para mover o conjunto.
        </p>
        <div>Ctrl + clique adiciona à seleção.</div>
      </div>
    </div>
  );
}
