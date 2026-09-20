import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, FileJson, X } from "lucide-react";
import { download, parseProject } from "../io";
import { importTemplateJson } from "../importTemplate";
import type { Automaton } from "../model";
import { autoLayout } from "../autoLayout";

export function ImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (doc: Automaton) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const readId = useRef(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [reading, setReading] = useState(false);
  const [organize, setOrganize] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  useLayoutEffect(() => {
    dialog.current?.showModal();
    return () => {
      readId.current++;
    };
  }, []);
  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return parseProject(text);
    } catch {
      return null;
    }
  }, [text]);
  return (
    <dialog
      ref={dialog}
      className="modal import-modal"
      aria-labelledby="import-title"
      onCancel={onClose}
    >
      <div className="modal-heading">
        <h2 id="import-title">Importar autômato</h2>
        <button aria-label="Fechar importação" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <p>
        Abra um arquivo ou cole o JSON gerado pela sua IA. O projeto atual será
        substituído; Ctrl + Z restaura o anterior.
      </p>
      <section className="import-template" aria-labelledby="template-title">
        <h3 id="template-title">Gere seu autômato com uma IA</h3>
        <p>
          Baixe o modelo e envie à IA junto com o enunciado. Ele inclui um
          exemplo pronto para importar, a descrição de cada campo e as regras de
          AFD/AFN.
        </p>
        <button
          className="outline"
          onClick={() => {
            download(
              new Blob([importTemplateJson], {
                type: "application/json;charset=utf-8",
              }),
              "modelo-automato-forma.json",
            );
            setDownloaded(true);
          }}
        >
          <Download size={16} /> Baixar modelo JSON para IA
        </button>
        {downloaded && (
          <span role="status" className="field-hint">
            Download do modelo iniciado.
          </span>
        )}
      </section>
      <input
        ref={file}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Arquivo JSON do autômato"
        onChange={async (event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (!chosen) return;
          const id = ++readId.current;
          setError("");
          setReading(true);
          try {
            if (chosen.size > 2_000_000)
              throw new Error("O arquivo excede 2 MB.");
            const contents = await chosen.text();
            if (id !== readId.current) return;
            setText(contents);
            setFilename(chosen.name);
          } catch (err) {
            if (id === readId.current) setError((err as Error).message);
          } finally {
            if (id === readId.current) setReading(false);
          }
        }}
      />
      <div className="import-file-row">
        <button
          className="outline"
          onClick={() => file.current?.click()}
          disabled={reading}
        >
          <FileJson size={16} />{" "}
          {reading ? "Lendo arquivo…" : "Escolher arquivo JSON"}
        </button>
        <span>{filename || "Até 2 MB"}</span>
      </div>
      <label htmlFor="import-json">Ou cole o JSON aqui</label>
      <textarea
        id="import-json"
        value={text}
        spellCheck={false}
        disabled={reading}
        placeholder={'{ "version": 1, "title": "Meu autômato", ... }'}
        onChange={(event) => {
          setText(event.target.value);
          setFilename("");
          setError("");
        }}
        aria-invalid={!!error}
        aria-describedby={error ? "import-error" : undefined}
      />
      {preview && (
        <p className="import-summary">
          {preview.title} · {preview.mode} · {preview.nodes.length} estados ·{" "}
          {preview.edges.length} transições · {preview.notes.length} anotações
        </p>
      )}
      {error && (
        <p id="import-error" className="error-text" role="alert">
          {error}
        </p>
      )}
      <label className="check-row">
        <input
          type="checkbox"
          checked={organize}
          onChange={(e) => setOrganize(e.target.checked)}
        />{" "}
        Organizar estados e separar transições automaticamente
      </label>
      <div className="modal-actions">
        <button onClick={onClose}>Cancelar</button>
        <button
          className="primary"
          disabled={!text.trim() || reading}
          onClick={() => {
            try {
              const project = parseProject(text);
              onImport(organize ? autoLayout(project) : project);
            } catch (err) {
              setError(
                err instanceof SyntaxError
                  ? "JSON inválido. Confira aspas, vírgulas e chaves. Cole somente o JSON, sem marcações de código."
                  : (err as Error).message,
              );
            }
          }}
        >
          Importar autômato
        </button>
      </div>
    </dialog>
  );
}
