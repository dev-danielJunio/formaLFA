export type Point = { x: number; y: number };
export type StateNode = Point & {
  id: string;
  label: string;
  initial: boolean;
  final: boolean;
};
export type Edge = {
  id: string;
  source: string;
  target: string;
  symbols: string[];
  /** Control point offsets in the source→target coordinate system. */
  curve?: { along: number; normal: number };
  loop?: { angle: number; size: number };
};
export type Note = Point & { id: string; text: string; scale?: number };
export type Automaton = {
  version: 1;
  title: string;
  mode: "AFD" | "AFN";
  nodes: StateNode[];
  edges: Edge[];
  notes: Note[];
};
export type Selection = { nodes: string[]; edges: string[]; notes: string[] };
export const emptySelection = (): Selection => ({
  nodes: [],
  edges: [],
  notes: [],
});
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => structuredClone(value);
export const example: Automaton = {
  version: 1,
  title: "Palavras que terminam em 01",
  mode: "AFD",
  nodes: [
    { id: "q0", label: "q₀", x: 200, y: 280, initial: true, final: false },
    { id: "q1", label: "q₁", x: 440, y: 280, initial: false, final: false },
    { id: "q2", label: "q₂", x: 680, y: 280, initial: false, final: true },
  ],
  edges: [
    { id: "e0", source: "q0", target: "q0", symbols: ["1"] },
    { id: "e1", source: "q0", target: "q1", symbols: ["0"] },
    { id: "e2", source: "q1", target: "q1", symbols: ["0"] },
    { id: "e3", source: "q1", target: "q2", symbols: ["1"] },
    { id: "e4", source: "q2", target: "q1", symbols: ["0"] },
    { id: "e5", source: "q2", target: "q0", symbols: ["1"] },
  ],
  notes: [
    { id: "n0", x: 140, y: 105, text: "Uma palavra. Muitas possibilidades." },
    {
      id: "n1",
      x: 140,
      y: 140,
      text: "Σ = {0, 1}  ·  L = { w ∈ {0,1}* | w termina em 01 }",
    },
  ],
};
