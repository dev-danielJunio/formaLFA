import type { Automaton } from "./model";

export function detectAutomatonType(
  doc: Pick<Automaton, "edges">,
): Automaton["mode"] {
  const destinations = new Map<string, Map<string, string>>();
  for (const edge of doc.edges) {
    const symbols = destinations.get(edge.source) ?? new Map<string, string>();
    destinations.set(edge.source, symbols);
    for (const symbol of edge.symbols) {
      if (symbol === "ε") return "AFN";
      const previous = symbols.get(symbol);
      if (previous !== undefined && previous !== edge.target) return "AFN";
      symbols.set(symbol, edge.target);
    }
  }
  // Missing transitions mean rejection (a partial DFA), not nondeterminism.
  return "AFD";
}

export const automaticTypeHint =
  "Identificação automática: ε ou mais de um destino para o mesmo símbolo em um estado indica AFN. Caso contrário, AFD. Transições ausentes são permitidas (AFD parcial) e rejeitam a palavra.";
