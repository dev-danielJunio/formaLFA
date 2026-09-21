import { Check, Pause, Play, TriangleAlert, X } from "lucide-react";
import type { Simulation } from "../useSimulation";

export function QuickTest({ sim }: { sim: Simulation }) {
  const status = sim.frame?.status;
  const invalid = sim.errors.length > 0;
  return (
    <form
      className="quick-test"
      aria-label="Teste rápido"
      onSubmit={(event) => {
        event.preventDefault();
        sim.toggle();
      }}
    >
      <input
        aria-label="Palavra para teste rápido"
        title="Digite uma palavra. Campo vazio testa ε. Enter executa."
        placeholder="Palavra · vazio = ε"
        value={sim.input}
        onChange={(event) => sim.setInput(event.target.value)}
        maxLength={500}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className="quick-play"
        aria-label={
          sim.playing ? "Pausar teste rápido" : "Executar teste rápido"
        }
        title={`${sim.playing ? "Pausar" : "Executar"} teste rápido (Enter) · ${sim.speed}×`}
        disabled={invalid}
      >
        {sim.playing ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" />
        )}
      </button>
      <span
        className="quick-speed"
        aria-label={`Velocidade ${sim.speed} vezes`}
        title="Velocidade definida no painel Simular"
      >
        {sim.speed}×
      </span>
      <span
        className="quick-feedback"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {invalid ? (
          <span
            className="quick-result invalid"
            title={sim.errors.join(" ")}
            aria-label={sim.errors.join(" ")}
            tabIndex={0}
          >
            <TriangleAlert size={14} /> Revise o autômato
            <span className="quick-errors">{sim.errors.join(" ")}</span>
          </span>
        ) : status === "accepted" || status === "rejected" ? (
          <span className={`quick-result ${status}`}>
            {status === "accepted" ? <Check size={14} /> : <X size={14} />}
            {status === "accepted" ? "Aceito" : "Rejeitado"}
          </span>
        ) : null}
      </span>
    </form>
  );
}
