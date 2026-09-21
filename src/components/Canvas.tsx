import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Hand,
  Grab,
  Maximize,
  Expand,
  Minimize,
  Minus,
  Plus,
  Redo2,
  Type,
  Undo2,
} from "lucide-react";
import { useEditor } from "../store";
import {
  emptySelection,
  uid,
  type Automaton,
  type Edge,
  type Note,
  type Point,
  type Selection,
} from "../model";
import { Diagram } from "./Diagram";
import { edgeGeometry, labelSize, reshapeEdge, R } from "../geometry";
import { TransitionSymbolsInput } from "./TransitionSymbolsInput";
import { StateContextMenu, StateNameInput } from "./StateContextMenu";
import { NoteInput } from "./NoteInput";
import { NOTE_TOP, noteLayout, resizeNote } from "../noteLayout";
import { curveSamples } from "../autoLayout";
export type Tool = "select" | "note" | "pan";
type Gesture =
  | {
      kind: "resize";
      start: Point;
      base: Note;
      note: Note;
      corner: string;
      moved: boolean;
    }
  | {
      kind: "curve";
      start: Point;
      base: Edge;
      edge: Edge;
      handle: Point;
      moved: boolean;
    }
  | { kind: "move"; start: Point; delta: Point; selection: Selection }
  | { kind: "connect"; source: string; start: Point; end: Point }
  | { kind: "marquee"; start: Point; end: Point; additive: boolean }
  | { kind: "insert-note"; start: Point }
  | { kind: "pan"; start: Point; origin: Point };
export function Canvas({
  active,
  traversed,
  onSelection,
  pulse,
  fitRequest = 0,
  fullscreen,
  onToggleFullscreen,
  quickTest,
}: {
  pulse: number;
  active: string[];
  traversed: string[];
  onSelection: () => void;
  fitRequest?: number;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  quickTest: ReactNode;
}) {
  const {
    doc,
    selection,
    select,
    commit,
    addNode,
    undo,
    redo,
    past,
    future,
    removeSelected,
  } = useEditor();
  const [editingNote, setEditingNote] = useState<{
    note: Note;
    document: Automaton;
  } | null>(null);
  const currentNote = editingNote?.document === doc ? editingNote.note : null;
  const beginNoteEditing = (note: Note) => {
    setTool("select");
    setEditingNote({ note, document: doc });
    select({
      ...emptySelection(),
      notes: doc.notes.some((n) => n.id === note.id) ? [note.id] : [],
    });
  };
  const finishNoteEditing = (text: string) => {
    if (!currentNote) return;
    commit((d) => {
      const existing = d.notes.find((n) => n.id === currentNote.id);
      if (!text.trim())
        d.notes = d.notes.filter((n) => n.id !== currentNote.id);
      else if (existing) existing.text = text;
      else d.notes.push({ ...currentNote, text });
    });
    select(emptySelection());
    setEditingNote(null);
  };
  const [editing, setEditing] = useState<{
    edge: Edge;
    document: Automaton;
  } | null>(null);
  // A document change (undo/import/delete) invalidates any unfinished label.
  const currentEdit = editing?.document === doc ? editing : null;
  const beginEditing = (edge: Edge) => {
    setEditing({ edge, document: doc });
    select({
      ...emptySelection(),
      edges: doc.edges.some((e) => e.id === edge.id) ? [edge.id] : [],
    });
  };
  const finishEditing = (symbols: string[]) => {
    if (!currentEdit) return;
    const edge = currentEdit.edge;
    commit((d) => {
      const existing = d.edges.find((e) => e.id === edge.id);
      if (existing) existing.symbols = symbols;
      else d.edges.push({ ...edge, symbols });
    });
    select({ ...emptySelection(), edges: [edge.id] });
    setEditing(null);
  };
  const [context, setContext] = useState<{
    id: string;
    kind: keyof Selection;
    x: number;
    y: number;
    document: Automaton;
  } | null>(null);
  const [renaming, setRenaming] = useState<{
    nodeId: string;
    document: Automaton;
  } | null>(null);
  const currentContext = context?.document === doc ? context : null;
  const renameNode =
    renaming?.document === doc
      ? doc.nodes.find((n) => n.id === renaming.nodeId)
      : undefined;
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEdgeClick = useRef<string | null>(null);
  const rightPress = useRef<{
    start: Point;
    moved: boolean;
    target?: { kind: keyof Selection; id: string };
  } | null>(null);
  const cancelLongPress = () => {
    if (longPress.current !== null) clearTimeout(longPress.current);
    longPress.current = null;
  };
  useEffect(() => () => cancelLongPress(), []);
  const openContext = (
    kind: keyof Selection,
    id: string,
    clientX: number,
    clientY: number,
  ) => {
    const bounds = svg.current!.parentElement!.getBoundingClientRect();
    select({ ...emptySelection(), [kind]: [id] });
    setContext({
      id,
      kind,
      document: doc,
      x: Math.max(8, Math.min(clientX - bounds.left, bounds.width - 188)),
      y: Math.max(8, Math.min(clientY - bounds.top, bounds.height - 104)),
    });
  };
  const svg = useRef<SVGSVGElement>(null),
    gesture = useRef<Gesture | null>(null),
    [draft, setDraft] = useState<Gesture | null>(null);
  const gridId = useId();
  const [viewport, setViewport] = useState({
    width: 900,
    height: 570,
    clientWidth: 900,
  });
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const logicalWidth = Math.max(900, width);
      setViewport({
        width: logicalWidth,
        height: (height * logicalWidth) / width,
        clientWidth: width,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [tool, setTool] = useState<Tool>("select"),
    [zoom, setZoom] = useState(1),
    [origin, setOrigin] = useState({ x: 0, y: 0 }),
    [snap, setSnap] = useState(true),
    [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const local = (x: number, y: number): Point => {
    const p = new DOMPoint(x, y).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const clear = () => {
    cancelLongPress();
    gesture.current = null;
    setDraft(null);
    setGuides({});
  };
  useEffect(() => {
    clear();
  }, [doc]);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", clear);
    };
  }, []);
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    // An outside click first commits the focused label through its blur event.
    if (currentEdit || renameNode || currentNote) return;
    if (gesture.current || ![0, 1, 2].includes(e.button)) return;
    rightPress.current = null;
    const target = e.target as Element,
      p = local(e.clientX, e.clientY),
      anchor = target.closest("[data-anchor]")?.getAttribute("data-anchor"),
      node = target.closest("[data-node]")?.getAttribute("data-node"),
      note = target.closest("[data-note]")?.getAttribute("data-note"),
      edge =
        target.closest("[data-edge]")?.getAttribute("data-edge") ??
        target.closest("[data-edge-label]")?.getAttribute("data-edge-label");
    lastEdgeClick.current = edge ?? null;
    // Navigation takes priority over editing, including on labels and anchors.
    if (
      e.button === 1 ||
      e.button === 2 ||
      (tool === "pan" && e.button === 0)
    ) {
      e.preventDefault();
      cancelLongPress();
      setContext(null);
      if (e.button === 2)
        rightPress.current = {
          start: { x: e.clientX, y: e.clientY },
          moved: false,
          target: node
            ? { kind: "nodes", id: node }
            : note
              ? { kind: "notes", id: note }
              : edge
                ? { kind: "edges", id: edge }
                : undefined,
        };
      gesture.current = {
        kind: "pan",
        start: { x: e.clientX, y: e.clientY },
        origin,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraft(gesture.current);
      return;
    }
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    // Outside navigation mode, labels edit symbols instead of bending curves.
    if (
      edge &&
      target.closest("[data-edge-label]") &&
      e.button === 0 &&
      !additive
    ) {
      e.preventDefault();
      beginEditing(doc.edges.find((item) => item.id === edge)!);
      return;
    }
    const resize = target.closest("[data-resize-note]");
    if (resize && e.button === 0) {
      const base = doc.notes.find(
        (n) => n.id === resize.getAttribute("data-resize-note"),
      )!;
      gesture.current = {
        kind: "resize",
        start: p,
        base,
        note: base,
        corner: resize.getAttribute("data-corner")!,
        moved: false,
      };
    } else if (anchor && e.button === 0) {
      gesture.current = { kind: "connect", source: anchor, start: p, end: p };
    } else if ((node || note) && e.button === 0) {
      const key = node ? "nodes" : "notes",
        id = (node || note)!;
      let selected = selection;
      if (additive) {
        selected = {
          ...selection,
          [key]: selection[key].includes(id)
            ? selection[key].filter((x) => x !== id)
            : [...selection[key], id],
        };
        select(selected);
        if (!selected[key].includes(id)) return;
      } else if (!selection[key].includes(id)) {
        selected = { ...emptySelection(), [key]: [id] };
        select(selected);
      }
      onSelection();
      gesture.current = {
        kind: "move",
        start: p,
        delta: { x: 0, y: 0 },
        selection: selected,
      };
    } else if (edge && e.button === 0) {
      select(
        additive
          ? {
              ...selection,
              edges: selection.edges.includes(edge)
                ? selection.edges.filter((x) => x !== edge)
                : [...selection.edges, edge],
            }
          : { ...emptySelection(), edges: [edge] },
      );
      onSelection();
      if (additive || target.closest("[data-edge-label]")) return;
      const base = doc.edges.find((item) => item.id === edge)!;
      gesture.current = {
        kind: "curve",
        start: p,
        base,
        edge: base,
        handle: edgeGeometry(base, doc).handle,
        moved: false,
      };
    } else if (tool === "note" && e.button === 0) {
      select(emptySelection());
      gesture.current = { kind: "insert-note", start: p };
    } else {
      gesture.current = { kind: "marquee", start: p, end: p, additive };
      if (!additive) select(emptySelection());
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft(gesture.current);
    if (e.pointerType === "touch" && (node || note) && !anchor && !resize) {
      const element = e.currentTarget,
        pointerId = e.pointerId,
        clientX = e.clientX,
        clientY = e.clientY;
      longPress.current = setTimeout(() => {
        gesture.current = null;
        setDraft(null);
        setGuides({});
        openContext(
          node ? "nodes" : "notes",
          (node || note)!,
          clientX,
          clientY,
        );
        if (element.hasPointerCapture(pointerId))
          element.releasePointerCapture(pointerId);
      }, 550);
    }
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "insert-note") return;
    const p = local(e.clientX, e.clientY);
    if (g.kind === "resize") {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3 / zoom)
        return;
      gesture.current = {
        ...g,
        moved: true,
        note: resizeNote(g.base, g.start, p, g.corner),
      };
      setDraft(gesture.current);
      return;
    }
    if ("start" in g && Math.hypot(p.x - g.start.x, p.y - g.start.y) > 6 / zoom)
      cancelLongPress();
    if (g.kind === "curve") {
      const dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      if (Math.hypot(dx, dy) < 3 / zoom && !g.moved) return;
      const gain = g.base.source === g.base.target ? 1 : 2;
      gesture.current = {
        ...g,
        moved: true,
        edge: reshapeEdge(g.base, doc, {
          x: g.handle.x + dx * gain,
          y: g.handle.y + dy * gain,
        }),
      };
      setDraft(gesture.current);
      return;
    }
    if (g.kind === "pan") {
      if (
        rightPress.current &&
        Math.hypot(
          e.clientX - rightPress.current.start.x,
          e.clientY - rightPress.current.start.y,
        ) > 3
      )
        rightPress.current.moved = true;
      const scale = svg.current!.getScreenCTM()?.a || 1;
      setOrigin({
        x: g.origin.x - (e.clientX - g.start.x) / scale,
        y: g.origin.y - (e.clientY - g.start.y) / scale,
      });
      return;
    }
    if (g.kind === "move") {
      let dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      if (!g.delta.x && !g.delta.y && Math.hypot(dx, dy) < 3 / zoom) return;
      const first =
        doc.nodes.find((n) => g.selection.nodes.includes(n.id)) ||
        doc.notes.find((n) => g.selection.notes.includes(n.id));
      let gx: number | undefined, gy: number | undefined;
      if (first && snap && g.selection.nodes.length > 0) {
        const x = first.x + dx,
          y = first.y + dy;
        const others = doc.nodes.filter(
          (n) => !g.selection.nodes.includes(n.id),
        );
        gx = others.find((n) => Math.abs(n.x - x) < 7 / zoom)?.x;
        gy = others.find((n) => Math.abs(n.y - y) < 7 / zoom)?.y;
        dx = (gx ?? Math.round(x / 20) * 20) - first.x;
        dy = (gy ?? Math.round(y / 20) * 20) - first.y;
      }
      gesture.current = { ...g, delta: { x: dx, y: dy } };
      setGuides({ x: gx, y: gy });
    } else gesture.current = { ...g, end: p };
    setDraft(gesture.current);
  };
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    cancelLongPress();
    const g = gesture.current;
    if (!g) return;
    const p = local(e.clientX, e.clientY);
    if (g.kind === "resize") {
      if (g.moved)
        commit((d) => {
          const note = d.notes.find((n) => n.id === g.note.id);
          if (note) Object.assign(note, g.note);
        });
    } else if (g.kind === "curve") {
      if (g.moved)
        commit((d) => {
          const edge = d.edges.find((edge) => edge.id === g.edge.id);
          if (edge) {
            edge.curve = g.edge.curve;
            edge.loop = g.edge.loop;
          }
        });
    } else if (g.kind === "connect") {
      // Pointer capture keeps events on the SVG. Hit-test coordinates, not event.target.
      const target = [...doc.nodes]
        .reverse()
        .find((n) => Math.hypot(n.x - p.x, n.y - p.y) < R + 12);
      if (target && Math.hypot(p.x - g.start.x, p.y - g.start.y) > 7)
        beginEditing(
          doc.edges.find(
            (edge) => edge.source === g.source && edge.target === target.id,
          ) ?? { id: uid(), source: g.source, target: target.id, symbols: [] },
        );
    } else if (g.kind === "move" && (g.delta.x || g.delta.y))
      commit((d) => {
        for (const n of d.nodes)
          if (g.selection.nodes.includes(n.id)) {
            n.x += g.delta.x;
            n.y += g.delta.y;
          }
        for (const n of d.notes)
          if (g.selection.notes.includes(n.id)) {
            n.x += g.delta.x;
            n.y += g.delta.y;
          }
      });
    else if (
      g.kind === "insert-note" &&
      Math.hypot(p.x - g.start.x, p.y - g.start.y) < 4 / zoom
    ) {
      beginNoteEditing({ ...g.start, id: uid(), text: "" });
    } else if (g.kind === "pan" && e.button === 2) {
      const press = rightPress.current;
      if (
        press?.target &&
        !press.moved &&
        Math.hypot(e.clientX - press.start.x, e.clientY - press.start.y) <= 3
      ) {
        openContext(press.target.kind, press.target.id, e.clientX, e.clientY);
      }
    } else if (g.kind === "marquee") {
      const minX = Math.min(g.start.x, p.x),
        maxX = Math.max(g.start.x, p.x),
        minY = Math.min(g.start.y, p.y),
        maxY = Math.max(g.start.y, p.y),
        inside = (p: Point) =>
          p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
      const nodes = doc.nodes
        .filter(
          (n) =>
            inside({ x: n.x - R, y: n.y - R }) &&
            inside({ x: n.x + R, y: n.y + R }),
        )
        .map((n) => n.id);
      // Include complete rendered edge bounds, not just endpoints (curves can leave the box).
      const edges = doc.edges
        .filter((edge) => {
          const element = Array.from(
            svg.current!.querySelectorAll<SVGGElement>("[data-edge]"),
          ).find((el) => el.dataset.edge === edge.id);
          if (!element) return false;
          const line = element.querySelector<SVGPathElement>(".edge-line");
          // Ignore editing guides; labels now live above all edge paths.
          if (!line) return false;
          const b = line.getBBox(),
            { label } = edgeGeometry(edge, doc),
            size = labelSize(edge);
          return (
            inside({ x: b.x, y: b.y }) &&
            inside({ x: b.x + b.width, y: b.y + b.height }) &&
            inside({
              x: label.x - size.width / 2,
              y: label.y - size.height / 2,
            }) &&
            inside({
              x: label.x + size.width / 2,
              y: label.y + size.height / 2,
            })
          );
        })
        .map((e) => e.id);
      const notes = doc.notes.filter((n) => inside(n)).map((n) => n.id),
        base = g.additive ? selection : emptySelection();
      select({
        nodes: [...new Set([...base.nodes, ...nodes])],
        edges: [...new Set([...base.edges, ...edges])],
        notes: [...new Set([...base.notes, ...notes])],
      });
    }
    clear();
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const positioned =
    draft?.kind === "resize"
      ? {
          ...doc,
          notes: doc.notes.map((n) =>
            n.id === draft.note.id ? draft.note : n,
          ),
        }
      : draft?.kind === "curve"
        ? {
            ...doc,
            edges: doc.edges.map((edge) =>
              edge.id === draft.edge.id ? draft.edge : edge,
            ),
          }
        : draft?.kind === "move"
          ? {
              ...doc,
              nodes: doc.nodes.map((n) =>
                draft.selection.nodes.includes(n.id)
                  ? { ...n, x: n.x + draft.delta.x, y: n.y + draft.delta.y }
                  : n,
              ),
              notes: doc.notes.map((n) =>
                draft.selection.notes.includes(n.id)
                  ? { ...n, x: n.x + draft.delta.x, y: n.y + draft.delta.y }
                  : n,
              ),
            }
          : doc;
  const visible =
    currentEdit && !doc.edges.some((edge) => edge.id === currentEdit.edge.id)
      ? { ...positioned, edges: [...positioned.edges, currentEdit.edge] }
      : positioned;
  const editPosition = currentEdit
    ? edgeGeometry(currentEdit.edge, visible).label
    : null;
  const zoomTo = (next: number) => {
    const z = Math.max(0.35, Math.min(2.5, next));
    setOrigin((o) => ({
      x: o.x + viewport.width / (2 * zoom) - viewport.width / (2 * z),
      y: o.y + viewport.height / (2 * zoom) - viewport.height / (2 * z),
    }));
    setZoom(z);
  };
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (
        (event.target as Element).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (!event.deltaY) return;
      event.preventDefault();
      // Keep pointer-captured gestures in one coordinate system until release.
      if (gesture.current) return;
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1;
      const delta = Math.max(-100, Math.min(100, event.deltaY * unit));
      const next = Math.max(
        0.35,
        Math.min(2.5, zoom * Math.exp(-delta * 0.0015)),
      );
      if (next === zoom) return;
      const anchor = local(event.clientX, event.clientY);
      setOrigin({
        x: anchor.x - ((anchor.x - origin.x) * zoom) / next,
        y: anchor.y - ((anchor.y - origin.y) * zoom) / next,
      });
      setZoom(next);
    };
    // React wheel listeners are passive; a native listener prevents page scroll.
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [zoom, origin]);
  const fit = () => {
    const points = [
      ...doc.nodes.flatMap((n) => [
        { x: n.x - 90, y: n.y - 50 },
        { x: n.x + 50, y: n.y + 50 },
      ]),
      ...doc.edges.flatMap((e) => [
        ...curveSamples(e, doc),
        ...edgeGeometry(e, doc).bounds.slice(-2),
      ]),
      ...doc.notes.flatMap((n) => {
        const size = noteLayout(n.text),
          s = n.scale ?? 1;
        return [
          { x: n.x, y: n.y + NOTE_TOP * s },
          { x: n.x + size.width * s, y: n.y + (NOTE_TOP + size.height) * s },
        ];
      }),
    ];
    if (!points.length) {
      setZoom(1);
      setOrigin({ x: 0, y: 0 });
      return;
    }
    const minX = Math.min(...points.map((p) => p.x)) - 60,
      maxX = Math.max(...points.map((p) => p.x)) + 60;
    const minY = Math.min(...points.map((p) => p.y)) - 60,
      maxY = Math.max(...points.map((p) => p.y)) + 60;
    setZoom(
      Math.min(
        1.5,
        viewport.width / (maxX - minX),
        viewport.height / (maxY - minY),
      ),
    );
    const z = Math.min(
      1.5,
      viewport.width / (maxX - minX),
      viewport.height / (maxY - minY),
    );
    setOrigin({
      x: (minX + maxX) / 2 - viewport.width / (2 * z),
      y: (minY + maxY) / 2 - viewport.height / (2 * z),
    });
  };
  const fitted = useRef(0);
  useEffect(() => {
    if (fitRequest && fitted.current !== fitRequest) {
      fitted.current = fitRequest;
      fit();
    }
  }, [fitRequest, viewport.width, viewport.height, doc]);
  const displayedTool = draft?.kind === "pan" ? "pan" : tool;
  return (
    <>
      <div className="tools" role="toolbar" aria-label="Ferramentas do canvas">
        {(
          [
            ["note", Type, "Texto"],
            ["pan", draft?.kind === "pan" ? Grab : Hand, "Arrastar quadro"],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            aria-label={label}
            title={label}
            aria-pressed={displayedTool === key}
            className={displayedTool === key ? "active" : ""}
            onClick={() => {
              setTool(tool === key ? "select" : key);
              select(emptySelection());
            }}
          >
            <Icon size={20} />
          </button>
        ))}
        <span />
        <button
          aria-label="Desfazer"
          title="Desfazer (Ctrl+Z)"
          disabled={!past.length}
          onClick={undo}
        >
          <Undo2 size={19} />
        </button>
        <button
          aria-label="Refazer"
          title="Refazer (Ctrl+Y)"
          disabled={!future.length}
          onClick={redo}
        >
          <Redo2 size={19} />
        </button>
      </div>
      <div className="canvas-wrap">
        <svg
          ref={svg}
          className={`canvas tool-${displayedTool}${draft?.kind === "pan" ? " is-panning" : ""}`}
          aria-label="Canvas de autômatos"
          viewBox={`${origin.x} ${origin.y} ${viewport.width / zoom} ${viewport.height / zoom}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={clear}
          onLostPointerCapture={clear}
          onContextMenu={(e) => {
            e.preventDefault();
            // Mouse context menus are handled on release, after detecting a pan.
            if (rightPress.current) return;
            cancelLongPress();
            const target = e.target as Element;
            const note = target
              .closest("[data-note]")
              ?.getAttribute("data-note");
            const edge =
              target
                .closest("[data-edge-label]")
                ?.getAttribute("data-edge-label") ??
              target.closest("[data-edge]")?.getAttribute("data-edge");
            if (note || edge) {
              clear();
              openContext(
                note ? "notes" : "edges",
                (note || edge)!,
                e.clientX,
                e.clientY,
              );
              return;
            }
            const p = local(e.clientX, e.clientY);
            const node = [...doc.nodes]
              .reverse()
              .find((n) => Math.hypot(n.x - p.x, n.y - p.y) <= R + 8);
            if (node) {
              clear();
              openContext("nodes", node.id, e.clientX, e.clientY);
            }
          }}
          onDoubleClick={(e) => {
            if (tool === "pan" || currentEdit || currentNote || renameNode)
              return;
            const t = e.target as Element;
            const point = local(e.clientX, e.clientY);
            const edgeId =
              t.closest("[data-edge]")?.getAttribute("data-edge") ??
              t.closest("[data-edge-label]")?.getAttribute("data-edge-label") ??
              lastEdgeClick.current;
            const edge = doc.edges.find((edge) => edge.id === edgeId);
            // Pointer capture retargets click/dblclick to the SVG after a node
            // gesture. Resolve by coordinates too, just as we do for connections.
            const nodeId =
              t.closest("[data-node]")?.getAttribute("data-node") ??
              [...doc.nodes]
                .reverse()
                .find(
                  (node) =>
                    Math.hypot(node.x - point.x, node.y - point.y) <= R + 8,
                )?.id;
            const noteHit = Array.from(
              svg.current!.querySelectorAll<SVGGElement>("[data-note]"),
            ).find((element) => {
              const bounds = element.getBoundingClientRect();
              return (
                e.clientX >= bounds.left &&
                e.clientX <= bounds.right &&
                e.clientY >= bounds.top &&
                e.clientY <= bounds.bottom
              );
            });
            if (edge) beginEditing(edge);
            else if (nodeId) {
              commit((d) => {
                const node = d.nodes.find((node) => node.id === nodeId);
                if (node) node.final = !node.final;
              });
            } else if (t.closest("[data-note]") || noteHit) {
              const id =
                t.closest("[data-note]")?.getAttribute("data-note") ??
                noteHit?.dataset.note;
              const note = doc.notes.find((n) => n.id === id);
              if (note) beginNoteEditing(note);
            } else {
              if (tool === "note")
                beginNoteEditing({ ...point, id: uid(), text: "" });
              else {
                setTool("select");
                addNode(point);
                onSelection();
              }
            }
          }}
        >
          <defs>
            <pattern
              id={gridId}
              x="-10"
              y="-10"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="10" cy="10" r="0.8" fill="var(--dot)" />
            </pattern>
          </defs>
          <rect
            className="canvas-grid"
            x={origin.x}
            y={origin.y}
            width={viewport.width / zoom}
            height={viewport.height / zoom}
            fill={`url(#${gridId})`}
            pointerEvents="none"
          />
          <Diagram
            doc={visible}
            selection={selection}
            active={active}
            traversed={traversed}
            pulse={pulse}
            editingEdge={currentEdit?.edge.id}
            editingNote={currentNote?.id}
            interactive
          />
          {guides.x !== undefined && (
            <line
              className="snap-guide"
              x1={guides.x}
              x2={guides.x}
              y1={origin.y}
              y2={origin.y + viewport.height / zoom}
            />
          )}{" "}
          {guides.y !== undefined && (
            <line
              className="snap-guide"
              y1={guides.y}
              y2={guides.y}
              x1={origin.x}
              x2={origin.x + viewport.width / zoom}
            />
          )}
          {draft?.kind === "connect" && (
            <path
              className="connection-draft"
              d={`M${draft.start.x} ${draft.start.y} Q${(draft.start.x + draft.end.x) / 2} ${Math.min(draft.start.y, draft.end.y) - 40} ${draft.end.x} ${draft.end.y}`}
              markerEnd="url(#arrow)"
            />
          )}
          {draft?.kind === "marquee" && (
            <rect
              className="marquee"
              x={Math.min(draft.start.x, draft.end.x)}
              y={Math.min(draft.start.y, draft.end.y)}
              width={Math.abs(draft.end.x - draft.start.x)}
              height={Math.abs(draft.end.y - draft.start.y)}
            />
          )}
          {renameNode && (
            <foreignObject
              x={renameNode.x - 140}
              y={renameNode.y - 18}
              width={280}
              height={100}
              className="edge-input-overlay"
            >
              <StateNameInput
                key={renameNode.id}
                name={renameNode.label}
                onCancel={() => setRenaming(null)}
                onConfirm={(name) => {
                  commit((d) => {
                    const node = d.nodes.find((n) => n.id === renameNode.id);
                    if (node) node.label = name;
                  });
                  setRenaming(null);
                }}
              />
            </foreignObject>
          )}
          {currentEdit && editPosition && (
            <foreignObject
              x={editPosition.x - 140}
              y={editPosition.y - 18}
              width={280}
              height={105}
              className="edge-input-overlay"
            >
              <TransitionSymbolsInput
                key={currentEdit.edge.id}
                initialValue={currentEdit.edge.symbols.join(", ")}
                mode={doc.mode}
                inline
                onConfirm={finishEditing}
                onCancel={() => setEditing(null)}
              />
            </foreignObject>
          )}
        </svg>
        {currentNote && (
          <NoteInput
            key={currentNote.id}
            text={currentNote.text}
            left={
              (((currentNote.x - origin.x) * viewport.clientWidth) /
                viewport.width) *
              zoom
            }
            top={
              (((currentNote.y +
                NOTE_TOP * (currentNote.scale ?? 1) -
                origin.y) *
                viewport.clientWidth) /
                viewport.width) *
              zoom
            }
            scale={
              (viewport.clientWidth / viewport.width) *
              zoom *
              (currentNote.scale ?? 1)
            }
            onConfirm={finishNoteEditing}
            onCancel={() => setEditingNote(null)}
          />
        )}
        {currentContext && (
          <StateContextMenu
            x={currentContext.x}
            y={currentContext.y}
            onClose={() => setContext(null)}
            label={
              currentContext.kind === "nodes"
                ? "Opções do estado"
                : currentContext.kind === "notes"
                  ? "Opções da anotação"
                  : "Opções da transição"
            }
            editLabel={
              currentContext.kind === "nodes"
                ? "Renomear"
                : currentContext.kind === "notes"
                  ? "Editar texto"
                  : "Editar símbolos"
            }
            onRename={() => {
              if (currentContext.kind === "nodes")
                setRenaming({ nodeId: currentContext.id, document: doc });
              if (currentContext.kind === "notes")
                beginNoteEditing(
                  doc.notes.find((n) => n.id === currentContext.id)!,
                );
              if (currentContext.kind === "edges")
                beginEditing(
                  doc.edges.find((n) => n.id === currentContext.id)!,
                );
              setContext(null);
            }}
            onDelete={() => {
              select({
                ...emptySelection(),
                [currentContext.kind]: [currentContext.id],
              });
              removeSelected();
              setContext(null);
            }}
          />
        )}
        <div className="canvas-hint">
          <span>
            {displayedTool === "pan"
              ? "Arraste para mover o quadro"
              : tool === "note"
                ? "Clique: inserir texto"
                : "Duplo clique: estado"}
          </span>
          <i />
          <span>
            {displayedTool === "pan"
              ? "Clique na mão para voltar a editar"
              : "Arraste uma âncora: conectar"}
          </span>
        </div>
        <div className="zoom-controls">
          <button aria-label="Diminuir zoom" onClick={() => zoomTo(zoom - 0.1)}>
            <Minus size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Aumentar zoom" onClick={() => zoomTo(zoom + 0.1)}>
            <Plus size={16} />
          </button>
          <i />
          <button aria-label="Enquadrar autômato" onClick={fit}>
            <Maximize size={16} />
          </button>
          <i />
          <button
            className="fullscreen-toggle"
            aria-label={fullscreen ? "Sair da Tela Cheia" : "Tela cheia"}
            aria-pressed={fullscreen}
            title={fullscreen ? "Sair da Tela Cheia (Esc)" : "Tela cheia (F)"}
            onClick={onToggleFullscreen}
          >
            {fullscreen ? <Minimize size={16} /> : <Expand size={16} />}
            {fullscreen && <span>Sair da Tela Cheia</span>}
          </button>
        </div>
        {quickTest}
      </div>
      <div className="editor-footer">
        <button
          className="snap-toggle"
          aria-pressed={snap}
          onClick={() => setSnap(!snap)}
        >
          <span className={snap ? "snap-on" : ""}>⊞</span> Alinhamento{" "}
          {snap ? "ativado" : "desativado"}
        </button>
        <span>
          SVG · Vetorial <span className="footer-dot">•</span>{" "}
          {selection.nodes.length +
            selection.edges.length +
            selection.notes.length || "Nenhum"}{" "}
          selecionado(s)
        </span>
      </div>
    </>
  );
}
