import {
  Activity,
  Check,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { alphabet } from "../engine";
import { useEditor } from "../store";
import type { Simulation } from "../useSimulation";
export function Simulator({ sim }: { sim: Simulation }) {
  const { doc } = useEditor(),
    { frame } = sim,
    symbols = Array.from(sim.input),
    sigma = alphabet(doc),
    status = frame?.status;
  const label = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <div className="simulator-layout">
      <section className="simulation-input">
        <div className="side-title">
          <Activity size={19} />
          <h1>Simulação</h1>
          <span className="badge violet">PASSO A PASSO</span>
        </div>
        <p className="side-description">
          Acompanhe cada transição da sua palavra.
        </p>
        <label className="field-label" htmlFor="word">
          PALAVRA DE ENTRADA
        </label>
        <input
          id="word"
          className="word-input"
          value={sim.input}
          maxLength={500}
          onChange={(e) => sim.setInput(e.target.value)}
          placeholder="ε (palavra vazia)"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="field-hint">
          Alfabeto reconhecido:{" "}
          {sigma.length
            ? sigma.map((s) => <code key={s}>{s}</code>)
            : "nenhum símbolo"}{" "}
          · vazio = ε
        </p>
      </section>
      <section
        className="simulation-playback"
        aria-label="Controles e resultado"
      >
        <div className="tape" aria-label="Fita de entrada">
          {symbols.map((s, i) => (
            <span
              key={i}
              className={
                sim.started && i === frame?.index
                  ? "current"
                  : sim.started && i < (frame?.index ?? 0)
                    ? "read"
                    : ""
              }
              aria-current={
                sim.started && i === frame?.index ? "step" : undefined
              }
            >
              {s}
            </span>
          ))}
          <span
            className={`tape-end ${sim.started && frame?.index === symbols.length ? "current" : ""}`}
          >
            ↵
          </span>
        </div>
        <div className="tape-caption">
          <span>Fita de entrada</span>
          <span>
            {frame?.index ?? 0} de {symbols.length} símbolos
          </span>
        </div>
        <div className="player">
          <button
            title="Reiniciar"
            aria-label="Reiniciar simulação"
            onClick={sim.reset}
          >
            <RotateCcw size={18} />
          </button>
          <button
            title="Voltar um passo"
            aria-label="Voltar um passo"
            disabled={!sim.started}
            onClick={sim.back}
          >
            <SkipBack size={18} />
          </button>
          <button
            className="play"
            disabled={!!sim.errors.length}
            onClick={sim.toggle}
          >
            {sim.playing ? (
              <Pause size={18} />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
            {sim.playing ? "Pausar" : "Executar"}
          </button>
          <button
            title="Avançar um passo"
            aria-label="Avançar um passo"
            disabled={
              !!sim.errors.length || !!(frame && frame.status !== "running")
            }
            onClick={sim.next}
          >
            <SkipForward size={18} />
          </button>
        </div>
        <div className="speed">
          <label htmlFor="speed">Velocidade</label>
          <span>{sim.speed}×</span>
        </div>
        <input
          id="speed"
          type="range"
          min="0.5"
          max="2"
          step="0.5"
          value={sim.speed}
          onChange={(e) => sim.setSpeed(+e.target.value)}
        />
        <div
          key={status}
          className={`simulation-status ${status ?? ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="status-icon">
            {status === "accepted" ? (
              <Check size={16} />
            ) : status === "rejected" ? (
              <X size={16} />
            ) : (
              <Play size={16} />
            )}
          </span>
          <div>
            <strong>
              {sim.errors.length
                ? "Revise o autômato"
                : status === "accepted"
                  ? "ACEITO"
                  : status === "rejected"
                    ? "REJEITADO"
                    : sim.started
                      ? "Execução em andamento"
                      : "Tudo pronto para começar"}
            </strong>
            <p>
              {sim.errors.length
                ? sim.errors[0]
                : status === "accepted"
                  ? "A palavra terminou em um estado final."
                  : status === "rejected"
                    ? !frame?.active.length
                      ? "Nenhuma transição disponível."
                      : "A palavra terminou fora dos estados finais."
                    : sim.started
                      ? `Ativos: ${frame?.active.map(label).join(", ")}`
                      : "Execute ou avance um passo por vez."}
            </p>
          </div>
        </div>
      </section>
      <section className="simulation-summary" aria-label="Resumo do autômato">
        <div className="section-heading">EXPLORAR O AUTÔMATO</div>
        <div className="stat-row">
          <span>Estado inicial</span>
          <code>
            {doc.nodes
              .filter((n) => n.initial)
              .map((n) => n.label)
              .join(", ") || "Não definido"}
          </code>
        </div>
        <div className="stat-row">
          <span>Estados finais</span>
          <code>
            {doc.nodes
              .filter((n) => n.final)
              .map((n) => n.label)
              .join(", ") || "Nenhum"}
          </code>
        </div>
        <div className="stat-row">
          <span>Tipo</span>
          <span>
            {doc.mode === "AFD" ? "Determinístico" : "Não determinístico"}{" "}
            <span className="badge">{doc.mode}</span>
          </span>
        </div>
        {sim.started && (
          <div className="trace-list">
            <div className="section-heading">CAMINHO PERCORRIDO</div>
            {sim.frames.slice(0, sim.index + 1).map((f, i) => (
              <div key={i}>
                <span>{i === 0 ? "Início" : `Ler ${f.symbol}`}</span>
                <code>{f.active.map(label).join(", ") || "∅"}</code>
              </div>
            ))}
          </div>
        )}
        <div className="tip">
          <span>PEQUENAS DICAS, GRANDES IDEIAS</span>
          <p>
            {doc.mode === "AFD"
              ? "Um círculo duplo representa um estado final. Termine nele para aceitar a palavra."
              : "Um AFN pode estar em vários estados ao mesmo tempo. ε permite avançar sem consumir um símbolo."}
          </p>
          <div>
            <HelpCircle size={15} /> Aprender fazendo.
          </div>
        </div>
      </section>
    </div>
  );
}
