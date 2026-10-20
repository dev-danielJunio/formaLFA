import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Moon,
  Sun,
  Workflow,
  X,
} from "lucide-react";
import { useEditor } from "./store";
import { Canvas } from "./components/Canvas";
import { Simulator } from "./components/Simulator";
import { QuickTest } from "./components/QuickTest";
import { Inspector } from "./components/Inspector";
import { useSimulation } from "./useSimulation";
import { exportProject } from "./io";
import { ImportDialog } from "./components/ImportDialog";
import { clone, createEmptyAutomaton, emptySelection, example } from "./model";
import { automaticTypeHint } from "./automatonType";
export default function App() {
  const { doc, replace, undo, redo, removeSelected, select } = useEditor(),
    sim = useSimulation();
  const [tab, setTab] = useState<"simulation" | "properties">("simulation"),
    [menu, setMenu] = useState(false),
    [fullscreen, setFullscreen] = useState(false),
    [panelOpen, setPanelOpen] = useState(true),
    [testsHidden, setTestsHidden] = useState(false),
    [dark, setDark] = useState(() => {
      try {
        return localStorage.getItem("forma-theme") === "dark";
      } catch {
        return false;
      }
    }),
    [toast, setToast] = useState(""),
    [help, setHelp] = useState(false),
    [importing, setImporting] = useState(false),
    [fitRequest, setFitRequest] = useState(0);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const openProperties = () => {
    setTestsHidden(false);
    setTab("properties");
    setPanelOpen(true);
  };
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("forma-theme", dark ? "dark" : "light");
    } catch {
      /* Preferences remain usable without storage. */
    }
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (help) helpDialog.current?.showModal();
    else helpDialog.current?.close();
  }, [help]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
      if (e.key === "Escape" && fullscreen) {
        e.preventDefault();
        setFullscreen(false);
        return;
      }
      if (
        document.querySelector("dialog[open]") ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod && !e.altKey && !e.repeat && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setMenu(false);
        setFullscreen((value) => !value);
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        select({
          nodes: doc.nodes.map((n) => n.id),
          edges: doc.edges.map((e) => e.id),
          notes: doc.notes.map((n) => n.id),
          tables: (doc.tables ?? []).map((t) => t.id),
          strokes: (doc.strokes ?? []).map((s) => s.id),
        });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        select(emptySelection());
        setMenu(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [doc, undo, redo, select, removeSelected, fullscreen]);
  const exportAs = async (format: "json" | "svg" | "png") => {
    setMenu(false);
    try {
      await exportProject(doc, format);
      setToast(`Arquivo ${format.toUpperCase()} exportado.`);
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  return (
    <div
      className={`app${fullscreen ? " is-fullscreen" : ""}${!panelOpen || testsHidden ? " panel-collapsed" : ""}`}
    >
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => e.preventDefault()}
          aria-label="Forma"
        >
          <span className="brand-mark">
            <Workflow size={22} />
          </span>
          forma
          <span className="brand-divider" />
        </a>
        <button
          className="document-title"
          title="Editar propriedades do projeto"
          onClick={openProperties}
        >
          {doc.title}
          <ChevronDown size={15} />
        </button>
        <span className="local-badge">Laboratório de autômatos</span>
        <div className="header-actions">
          <button aria-label="Ajuda e atalhos" onClick={() => setHelp(true)}>
            <HelpCircle size={18} />
          </button>
          <button
            aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="export-wrap">
            <button
              className="outline"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <ArrowDownToLine size={16} /> Exportar
            </button>
            {menu && (
              <>
                <div className="menu-dismiss" onClick={() => setMenu(false)} />
                <div className="export-menu">
                  {(["png", "svg", "json"] as const).map((f) => (
                    <button key={f} onClick={() => exportAs(f)}>
                      {f.toUpperCase()}
                      <span>
                        {f === "png"
                          ? "Imagem transparente"
                          : f === "svg"
                            ? "Vetor editável"
                            : "Salvar projeto"}
                      </span>
                    </button>
                  ))}
                  <hr />
                  <button
                    onClick={() => {
                      setImporting(true);
                      setMenu(false);
                    }}
                  >
                    <FolderOpen size={15} /> Abrir JSON
                  </button>
                  <button
                    onClick={() => {
                      replace(createEmptyAutomaton());
                      setMenu(false);
                      openProperties();
                      setToast("Novo projeto. Ctrl+Z restaura o anterior.");
                    }}
                  >
                    <FilePlus2 size={15} /> Novo projeto
                  </button>
                  <button
                    onClick={() => {
                      replace(clone(example));
                      setMenu(false);
                      setTab("simulation");
                    }}
                  >
                    Carregar exemplo
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            className="outline"
            aria-label="Importar JSON"
            onClick={() => setImporting(true)}
          >
            <FolderOpen size={16} /> Importar
          </button>
          <div className="avatar">F</div>
        </div>
      </header>
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImport={(project) => {
            replace(project);
            setFitRequest((n) => n + 1);
            setImporting(false);
            setTab("simulation");
            setToast(
              "Autômato importado. Ctrl + Z restaura o projeto anterior.",
            );
          }}
        />
      )}
      <main className="workspace">
        <section
          className={`editor result-${sim.highlight ? (sim.frame?.status ?? "idle") : "idle"}`}
        >
          <div className="editor-bar">
            <span className="file-icon">
              <Workflow size={18} />
            </span>
            <strong>Editor de autômatos</strong>
            <span
              className="badge"
              title={automaticTypeHint}
              role="status"
              aria-label={`Tipo identificado automaticamente: ${doc.mode}`}
            >
              {doc.mode}
            </span>
            <div className="bar-right">
              <span>{doc.nodes.length} estados</span>
              <span>·</span>
              <span>{doc.edges.length} transições</span>
            </div>
          </div>
          <Canvas
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((value) => !value)}
            quickTest={
              testsHidden ? null : (
                <QuickTest sim={sim} onHide={() => setTestsHidden(true)} />
              )
            }
            testsHidden={testsHidden}
            onToggleTests={() => setTestsHidden((hidden) => !hidden)}
            fitRequest={fitRequest}
            pulse={sim.index}
            active={sim.highlight ? (sim.frame?.active ?? []) : []}
            traversed={sim.highlight ? (sim.frame?.edges ?? []) : []}
            onSelection={() => setTab("properties")}
          />
        </section>
        <section
          className="bottom-panel"
          aria-label="Simulação e propriedades"
          hidden={testsHidden}
        >
          <div className="panel-heading">
            <div
              className="side-tabs"
              role="tablist"
              aria-label="Painel inferior"
            >
              <button
                role="tab"
                aria-selected={tab === "simulation"}
                onClick={() => {
                  setTab("simulation");
                  setPanelOpen(true);
                }}
              >
                Simular
              </button>
              <button
                role="tab"
                aria-selected={tab === "properties"}
                onClick={openProperties}
              >
                Propriedades
              </button>
            </div>
            <button
              className="panel-toggle"
              aria-expanded={panelOpen}
              aria-controls="panel-content"
              onClick={() => setPanelOpen((value) => !value)}
            >
              {panelOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              {panelOpen ? "Recolher painel" : "Abrir painel"}
            </button>
          </div>
          <div id="panel-content" hidden={!panelOpen}>
            {tab === "simulation" ? <Simulator sim={sim} /> : <Inspector />}
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <span>
          <span className="tiny-logo">ƒ</span> Um espaço para pensar em
          possibilidades.
        </span>
        <span>
          Projetos salvos por JSON <i /> AFD & AFN
        </span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        className="modal help-modal"
        ref={helpDialog}
        onCancel={() => setHelp(false)}
        aria-labelledby="help-title"
      >
        <div className="modal-heading">
          <h2 id="help-title">Seu primeiro autômato</h2>
          <button aria-label="Fechar ajuda" onClick={() => setHelp(false)}>
            <X size={18} />
          </button>
        </div>
        <ol>
          <li>
            Selecione Tabela e clique no quadro. Dê dois cliques nas células
            para preencher; selecione a tabela para adicionar ou remover linhas
            e colunas.
          </li>
          <li>
            Selecione Canetinha para escrever à mão livre. Escolha a cor e a
            espessura no painel da caneta. Clique novamente no ícone para voltar
            a selecionar.
          </li>
          <li>
            Dê dois cliques no fundo para criar um estado. Para inserir uma
            anotação, escolha Texto e clique uma vez no fundo.
          </li>
          <li>
            Passe o mouse sobre um estado e arraste uma âncora até outro. Volte
            ao mesmo estado para criar um loop.
          </li>
          <li>
            Dê dois cliques em um estado para torná-lo de aceitação (círculo
            duplo). Repita para voltar ao normal. Para definir o inicial, clique
            com o botão direito no estado e escolha Definir como estado inicial.
          </li>
          <li>
            Abra Simular, escreva a palavra e execute. Campo vazio testa ε.
          </li>
        </ol>
        <p>
          Arraste uma linha para mudar sua curvatura. Nos loops, arraste para
          girar ou aumentar o arco. Clique no símbolo para editá-lo.
        </p>
        <p>
          Clique com o botão direito em um elemento para editar ou excluir. Em
          telas de toque, mantenha o dedo sobre o estado para abrir o menu.
        </p>
        <p>
          Com um único estado selecionado e o foco no quadro, comece a digitar
          para substituir seu nome. Enter ou clique fora confirma; Esc cancela.
        </p>
        <p>
          Texto desativa automaticamente ao abrir a anotação para digitar.
          Clique fora para salvar; Enter quebra a linha. Clique na anotação para
          selecionar, arraste para mover e use as alças dos cantos para aumentar
          ou diminuir o texto. Dois cliques reabrem a edição.
        </p>
        <p>
          Arraste no fundo com o botão esquerdo para selecionar em grupo. Ctrl +
          clique altera a seleção. Segure o botão direito e arraste para mover o
          quadro temporariamente; solte para voltar à ferramenta anterior. Um
          clique direito sem arrastar abre o menu do elemento. Role a roda do
          mouse sobre o quadro para aproximar ou afastar o zoom em torno do
          cursor.
        </p>
        <div className="shortcut-row">
          <kbd>F</kbd> Tela cheia <kbd>Esc</kbd> Sair da tela cheia
        </div>
        <p>
          Use a barra flutuante para testar com Enter ou Play. Recolha o painel
          inferior para ampliar o quadro; reabra as abas para ver os passos ou
          as propriedades.
        </p>
        <div className="shortcut-row">
          <kbd>Ctrl Z</kbd> Desfazer <kbd>Ctrl Y</kbd> Refazer
        </div>
        <div className="shortcut-row">
          <kbd>Ctrl A</kbd> Selecionar tudo <kbd>Delete / Backspace</kbd>{" "}
          Excluir
        </div>
        <p>
          Use Exportar → JSON para salvar e Abrir JSON para continuar depois.
          Este MVP não tem conta ou sincronização em nuvem.
        </p>
      </dialog>
    </div>
  );
}
