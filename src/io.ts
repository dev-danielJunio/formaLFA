import type { Automaton } from "./model";
export function parseProject(text: string): Automaton {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error("O arquivo excede 2 MB.");
  const d = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (
    !d ||
    d.version !== 1 ||
    typeof d.title !== "string" ||
    d.title.length > 120 ||
    !["AFD", "AFN"].includes(d.mode) ||
    !Array.isArray(d.nodes) ||
    !Array.isArray(d.edges) ||
    !Array.isArray(d.notes)
  )
    throw new Error("Formato de projeto inválido.");
  if (d.nodes.length > 500 || d.edges.length > 3000 || d.notes.length > 500)
    throw new Error("O projeto excede os limites deste MVP.");
  const str = (x: unknown, max = 120): x is string =>
    typeof x === "string" && x.length > 0 && x.length <= max;
  const pos = (n: Record<string, unknown>) =>
    typeof n.x === "number" &&
    typeof n.y === "number" &&
    Number.isFinite(n.x) &&
    Number.isFinite(n.y) &&
    Math.abs(n.x) < 1e6 &&
    Math.abs(n.y) < 1e6;
  const ids = new Set<string>();
  for (const item of [...d.nodes, ...d.edges, ...d.notes]) {
    if (!item || !str(item.id) || ids.has(item.id))
      throw new Error("Identificadores inválidos ou duplicados.");
    ids.add(item.id);
  }
  for (const n of d.nodes)
    if (
      !pos(n) ||
      !str(n.label, 30) ||
      typeof n.initial !== "boolean" ||
      typeof n.final !== "boolean"
    )
      throw new Error("Estado inválido.");
  const nodes = new Set(d.nodes.map((n: { id: string }) => n.id));
  for (const e of d.edges)
    if (
      !nodes.has(e.source) ||
      !nodes.has(e.target) ||
      !Array.isArray(e.symbols) ||
      !e.symbols.length ||
      e.symbols.length > 100 ||
      e.symbols.some(
        (s: unknown) => typeof s !== "string" || Array.from(s).length !== 1,
      ) ||
      new Set(e.symbols).size !== e.symbols.length
    )
      throw new Error("Transição inválida.");
  const finite = (value: unknown) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) < 1e6;
  for (const edge of d.edges) {
    if (
      edge.curve !== undefined &&
      (!edge.curve || !finite(edge.curve.along) || !finite(edge.curve.normal))
    )
      throw new Error("Curvatura inválida.");
    if (
      edge.loop !== undefined &&
      (!edge.loop ||
        !finite(edge.loop.angle) ||
        !finite(edge.loop.size) ||
        edge.loop.size < 35 ||
        edge.loop.size > 1500)
    )
      throw new Error("Loop inválido.");
  }
  for (const n of d.notes)
    if (
      !pos(n) ||
      typeof n.text !== "string" ||
      n.text.length > 4000 ||
      (n.scale !== undefined &&
        (typeof n.scale !== "number" ||
          !Number.isFinite(n.scale) ||
          n.scale < 0.5 ||
          n.scale > 4))
    )
      throw new Error("Anotação inválida.");
  // Pick known fields: never merge arbitrary imported keys into application state.
  return {
    version: 1,
    title: d.title,
    mode: d.mode,
    nodes: d.nodes.map((n: Automaton["nodes"][number]) => ({
      id: n.id,
      label: n.label,
      x: n.x,
      y: n.y,
      initial: n.initial,
      final: n.final,
    })),
    edges: d.edges.map((e: Automaton["edges"][number]) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      symbols: e.symbols,
      ...(e.curve
        ? { curve: { along: e.curve.along, normal: e.curve.normal } }
        : {}),
      ...(e.loop ? { loop: { angle: e.loop.angle, size: e.loop.size } } : {}),
    })),
    notes: d.notes.map((n: Automaton["notes"][number]) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      text: n.text,
      ...(n.scale !== undefined ? { scale: n.scale } : {}),
    })),
  };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
import { edgeGeometry, labelSize } from "./geometry";
export function toSvg(doc: Automaton) {
  const pts = [
    ...doc.edges.flatMap((edge) => edgeGeometry(edge, doc).bounds),
    ...doc.nodes.flatMap((n) => [
      { x: n.x - 100, y: n.y - 130 },
      { x: n.x + 100, y: n.y + 160 },
    ]),
    ...doc.notes.flatMap((n) => [
      { x: n.x - 10 * (n.scale ?? 1), y: n.y - 25 * (n.scale ?? 1) },
      {
        x:
          n.x +
          Math.max(
            ...n.text
              .split("\n")
              .map((t) => Array.from(t).length * 9 * (n.scale ?? 1)),
            80,
          ),
        y: n.y + n.text.split("\n").length * 24 * (n.scale ?? 1),
      },
    ]),
  ];
  const x = Math.min(0, ...pts.map((p) => p.x)) - 30,
    y = Math.min(0, ...pts.map((p) => p.y)) - 30,
    w = Math.max(300, ...pts.map((p) => p.x)) - x + 30,
    h = Math.max(200, ...pts.map((p) => p.y)) - y + 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8" fill="none" stroke="#667085" stroke-width="1.6"/></marker></defs><g font-family="Arial,sans-serif" fill="#344054">${doc.edges
    .map((e) => {
      const g = edgeGeometry(e, doc);
      return `<path d="${g.path}" fill="none" stroke="#667085" stroke-width="1.7" marker-end="url(#arrow)"/>`;
    })
    .join("")}${doc.edges
    .map((edge) => {
      const g = edgeGeometry(edge, doc),
        size = labelSize(edge);
      return `<rect x="${g.label.x - size.width / 2}" y="${g.label.y - size.height / 2}" width="${size.width}" height="${size.height}" rx="7" fill="white"/><text x="${g.label.x}" y="${g.label.y + 5}" text-anchor="middle" font-family="monospace" font-size="15">${esc(edge.symbols.join(", "))}</text>`;
    })
    .join(
      "",
    )}${doc.nodes.map((n) => `<g transform="translate(${n.x} ${n.y})">${n.initial ? '<path d="M-77 0H-39" fill="none" stroke="#667085" stroke-width="1.7" marker-end="url(#arrow)"/>' : ""}<circle r="34" fill="white" stroke="#667085" stroke-width="1.8"/>${n.final ? '<circle r="28" fill="none" stroke="#667085" stroke-width="1.8"/>' : ""}<text text-anchor="middle" dy="7" font-size="22">${esc(n.label)}</text></g>`).join("")}${doc.notes
    .map(
      (n) =>
        `<text x="${n.x}" y="${n.y}" font-size="${14 * (n.scale ?? 1)}">${n.text
          .split("\n")
          .map(
            (line, i) =>
              `<tspan x="${n.x}" dy="${i ? 24 * (n.scale ?? 1) : 0}">${esc(line)}</tspan>`,
          )
          .join("")}</text>`,
    )
    .join("")}</g></svg>`;
}
export async function exportProject(
  doc: Automaton,
  format: "json" | "svg" | "png",
) {
  if (format === "json") {
    download(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
      "forma-automato.json",
    );
    return;
  }
  const svg = toSvg(doc);
  if (format === "svg") {
    download(new Blob([svg], { type: "image/svg+xml" }), "forma-automato.svg");
    return;
  }
  // Rasterize the same geometry directly: no image loading or external resources.
  const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
  const [x, y, w, h] = xml.documentElement
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);
  const scale = Math.min(2, 8192 / w, 8192 / h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não oferece exportação PNG.");
  ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
  ctx.strokeStyle = "#667085";
  ctx.fillStyle = "#344054";
  ctx.lineWidth = 1.7;
  function arrow(ex: number, ey: number, px: number, py: number) {
    const angle = Math.atan2(ey - py, ex - px);
    ctx!.beginPath();
    ctx!.moveTo(
      ex - 8 * Math.cos(angle - 0.45),
      ey - 8 * Math.sin(angle - 0.45),
    );
    ctx!.lineTo(ex, ey);
    ctx!.lineTo(
      ex - 8 * Math.cos(angle + 0.45),
      ey - 8 * Math.sin(angle + 0.45),
    );
    ctx!.stroke();
  }
  ctx.font = "15px Arial";
  ctx.textAlign = "center";
  for (const edge of doc.edges) {
    const g = edgeGeometry(edge, doc);
    ctx.stroke(new Path2D(g.path));
    const nums = g.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
    arrow(nums.at(-2)!, nums.at(-1)!, nums.at(-4)!, nums.at(-3)!);
  }
  ctx.font = "15px monospace";
  for (const edge of doc.edges) {
    const g = edgeGeometry(edge, doc),
      size = labelSize(edge);
    ctx.fillStyle = "white";
    ctx.fillRect(
      g.label.x - size.width / 2,
      g.label.y - size.height / 2,
      size.width,
      size.height,
    );
    ctx.fillStyle = "#344054";
    ctx.fillText(edge.symbols.join(", "), g.label.x, g.label.y + 5);
  }
  for (const n of doc.nodes) {
    if (n.initial) {
      ctx.beginPath();
      ctx.moveTo(n.x - 77, n.y);
      ctx.lineTo(n.x - 39, n.y);
      ctx.stroke();
      arrow(n.x - 39, n.y, n.x - 77, n.y);
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, 34, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.stroke();
    if (n.final) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#344054";
    ctx.font = "22px Arial";
    ctx.fillText(n.label, n.x, n.y + 7);
  }
  ctx.textAlign = "left";
  ctx.font = "14px Arial";
  for (const note of doc.notes) {
    ctx.font = `${14 * (note.scale ?? 1)}px Arial`;
    note.text
      .split("\n")
      .forEach((line, i) =>
        ctx.fillText(line, note.x, note.y + i * 24 * (note.scale ?? 1)),
      );
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error("O navegador não concluiu o PNG. Exporte como SVG.")),
      10000,
    );
    canvas.toBlob((b) => {
      clearTimeout(timer);
      b ? resolve(b) : reject(new Error("Falha ao gerar PNG."));
    }, "image/png");
  });
  download(blob, "forma-automato.png");
}
