import type { Automaton, Edge } from "./model";
export type Frame = {
  index: number;
  active: string[];
  edges: string[];
  status: "running" | "accepted" | "rejected";
  symbol?: string;
};
export const alphabet = (doc: Automaton) =>
  [
    ...new Set(doc.edges.flatMap((e) => e.symbols).filter((s) => s !== "ε")),
  ].sort();
export function validate(doc: Automaton): string[] {
  const errors: string[] = [];
  if (!doc.nodes.length) errors.push("Adicione ao menos um estado.");
  if (doc.nodes.filter((n) => n.initial).length !== 1)
    errors.push("Defina exatamente um estado inicial.");
  const ids = new Set(doc.nodes.map((n) => n.id));
  for (const e of doc.edges) {
    if (!ids.has(e.source) || !ids.has(e.target))
      errors.push("Há uma transição com estado inexistente.");
    if (!e.symbols.length || e.symbols.some((s) => Array.from(s).length !== 1))
      errors.push("Use símbolos de um caractere, separados por vírgula.");
  }
  // The graph determines determinism. A stale imported mode never blocks a
  // valid ε-transition or branch; trace already tracks all possible states.
  return [...new Set(errors)];
}
// ε-closure: a visited set makes epsilon cycles finite, including self-loops.
export function closure(seeds: string[], edges: Edge[]) {
  const active = new Set(seeds),
    traversed = new Set<string>(),
    queue = [...seeds];
  for (let i = 0; i < queue.length; i++)
    for (const e of edges) {
      if (e.source === queue[i] && e.symbols.includes("ε")) {
        traversed.add(e.id);
        if (!active.has(e.target)) {
          active.add(e.target);
          queue.push(e.target);
        }
      }
    }
  return { active: [...active], edges: [...traversed] };
}
export function trace(doc: Automaton, input: string): Frame[] {
  const errors = validate(doc);
  if (errors.length) throw new Error(errors.join(" "));
  const symbols = Array.from(input),
    first = closure(
      doc.nodes.filter((n) => n.initial).map((n) => n.id),
      doc.edges,
    );
  const status = (active: string[], end: boolean): Frame["status"] =>
    !active.length
      ? "rejected"
      : end
        ? doc.nodes.some((n) => n.final && active.includes(n.id))
          ? "accepted"
          : "rejected"
        : "running";
  const frames: Frame[] = [
    { index: 0, ...first, status: status(first.active, symbols.length === 0) },
  ];
  for (let index = 0; index < symbols.length; index++) {
    const prev = frames.at(-1)!;
    if (prev.status !== "running") break;
    const used = doc.edges.filter(
      (e) =>
        prev.active.includes(e.source) && e.symbols.includes(symbols[index]),
    );
    const next = closure([...new Set(used.map((e) => e.target))], doc.edges);
    frames.push({
      index: index + 1,
      active: next.active,
      edges: [...new Set([...used.map((e) => e.id), ...next.edges])],
      symbol: symbols[index],
      status: status(next.active, index === symbols.length - 1),
    });
  }
  return frames;
}
