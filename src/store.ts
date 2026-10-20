import { create } from "zustand";
import { detectAutomatonType } from "./automatonType";
import { normalizeStateLabel } from "./stateLabel";
import {
  clone,
  emptySelection,
  createEmptyAutomaton,
  uid,
  type Automaton,
  type Point,
  type Selection,
} from "./model";
type EditorStore = {
  doc: Automaton;
  past: Automaton[];
  future: Automaton[];
  selection: Selection;
  revision: number;
  commit: (edit: (doc: Automaton) => void) => void;
  replace: (doc: Automaton) => void;
  select: (selection: Selection) => void;
  undo: () => void;
  redo: () => void;
  removeSelected: () => void;
  addNode: (point: Point) => void;
  addNote: (point: Point) => void;
  setInitialNode: (id: string) => void;
};
// Only committed documents enter history. Pointer movement stays in Canvas local state.
export const useEditor = create<EditorStore>((set, get) => ({
  doc: createEmptyAutomaton(),
  past: [],
  future: [],
  selection: emptySelection(),
  revision: 0,
  commit: (edit) =>
    set((s) => {
      const next = clone(s.doc);
      edit(next);
      for (const node of next.nodes)
        node.label = normalizeStateLabel(node.label);
      next.mode = detectAutomatonType(next);
      if (JSON.stringify(next) === JSON.stringify(s.doc)) return s;
      return {
        doc: next,
        past: [...s.past, s.doc].slice(-100),
        future: [],
        revision: s.revision + 1,
      };
    }),
  replace: (doc) => {
    get().commit((d) =>
      Object.assign(d, clone(doc), {
        tables: clone(doc.tables ?? []),
        strokes: clone(doc.strokes ?? []),
      }),
    );
    set({ selection: emptySelection() });
  },
  select: (selection) => set({ selection }),
  setInitialNode: (id) => {
    if (!get().doc.nodes.some((node) => node.id === id)) return;
    get().commit((doc) => {
      for (const node of doc.nodes) node.initial = node.id === id;
    });
  },
  undo: () =>
    set((s) =>
      s.past.length
        ? {
            doc: s.past.at(-1)!,
            past: s.past.slice(0, -1),
            future: [s.doc, ...s.future],
            selection: emptySelection(),
            revision: s.revision + 1,
          }
        : s,
    ),
  redo: () =>
    set((s) =>
      s.future.length
        ? {
            doc: s.future[0],
            past: [...s.past, s.doc],
            future: s.future.slice(1),
            selection: emptySelection(),
            revision: s.revision + 1,
          }
        : s,
    ),
  addNode: (p) => {
    const id = uid();
    get().commit((d) => {
      let i = d.nodes.length;
      while (d.nodes.some((n) => normalizeStateLabel(n.label) === `Q${i}`)) i++;
      d.nodes.push({
        ...p,
        id,
        label: `Q${i}`,
        initial: d.nodes.length === 0,
        final: false,
      });
    });
    set({ selection: { ...emptySelection(), nodes: [id] } });
  },
  addNote: (p) => {
    const id = uid();
    get().commit((d) => {
      d.notes.push({ ...p, id, text: "Sua anotação aqui" });
    });
    set({ selection: { ...emptySelection(), notes: [id] } });
  },
  removeSelected: () => {
    const sel = get().selection;
    get().commit((d) => {
      d.nodes = d.nodes.filter((n) => !sel.nodes.includes(n.id));
      d.edges = d.edges.filter(
        (e) =>
          !sel.edges.includes(e.id) &&
          !sel.nodes.includes(e.source) &&
          !sel.nodes.includes(e.target),
      );
      d.notes = d.notes.filter((n) => !sel.notes.includes(n.id));
      d.tables = d.tables?.filter((t) => !sel.tables.includes(t.id));
      d.strokes = d.strokes?.filter((s) => !sel.strokes.includes(s.id));
    });
    set({ selection: emptySelection() });
  },
}));
