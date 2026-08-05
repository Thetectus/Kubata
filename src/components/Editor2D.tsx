import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Line, Circle } from "react-konva";
import type Konva from "konva";
import { useProjectStore } from "../store/projectStore";
import { resolveBlockSpec } from "../lib/blocks";
import { generateFreeWallBlocks, generateWallBlocks, type OpeningsBySide, type WallBlockRect } from "../lib/wallBlocks";
import { WallBlockShape } from "./WallBlockShape";
import { snapPosition } from "../lib/snapping";
import { computeHiddenSegments, hiddenSegmentsForDivision, type HiddenSegment } from "../lib/adjacency";
import { nearestSideAndOffset } from "../lib/nearestWall";
import { collidingOpeningIds } from "../lib/collisions";
import { freeWallIsHorizontal, freeWallLengthM } from "../lib/openings";
import { totalCost, totalWallAreaM2 } from "../lib/materials";
import { ElementPalette } from "./ElementPalette";
import type { Division, FreeWall, Opening, OpeningType, WallSide } from "../types/project";

const PX_PER_METER = 30;
// Tamanho "médio" — igual ao da pré-visualização 3D, para os dois
// ecrãs serem consistentes por defeito, um por cima do outro.
const BASE_STAGE_WIDTH = 900;
const BASE_STAGE_HEIGHT = 620;
const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const SNAP_THRESHOLD_PX = 8;
const NOT_SELECTED_OPACITY = 0.32;
const BLOCK_FILL: Record<string, string> = {
  tijolo: "#c96f3c",
  bloco: "#b7b0a3",
};
const OPENING_FILL: Record<Opening["type"], string> = {
  porta: "#7c4a1e",
  janela: "#8fc7e8",
  balcao: "#d9a441",
};
const DEFAULT_OPENING_WIDTH_M: Record<OpeningType, number> = {
  porta: 0.9,
  janela: 1.2,
  balcao: 1.5,
};
const SIDE_PLUS_OFFSET = 16;

type ResizeSide = "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
const RESIZE_HANDLES: { side: ResizeSide; cursor: string }[] = [
  { side: "top-left", cursor: "nwse-resize" },
  { side: "top", cursor: "ns-resize" },
  { side: "top-right", cursor: "nesw-resize" },
  { side: "right", cursor: "ew-resize" },
  { side: "bottom-right", cursor: "nwse-resize" },
  { side: "bottom", cursor: "ns-resize" },
  { side: "bottom-left", cursor: "nesw-resize" },
  { side: "left", cursor: "ew-resize" },
];

function resizeHandlePosition(side: ResizeSide, widthPx: number, heightPx: number) {
  const midX = widthPx / 2;
  const midY = heightPx / 2;
  switch (side) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top":
      return { x: midX, y: 0 };
    case "top-right":
      return { x: widthPx, y: 0 };
    case "right":
      return { x: widthPx, y: midY };
    case "bottom-right":
      return { x: widthPx, y: heightPx };
    case "bottom":
      return { x: midX, y: heightPx };
    case "bottom-left":
      return { x: 0, y: heightPx };
    case "left":
      return { x: 0, y: midY };
  }
}

function freeWallGeometry(wall: FreeWall, thicknessPx: number) {
  const isHorizontal = freeWallIsHorizontal(wall);
  const lengthM = freeWallLengthM(wall);
  const lengthPx = lengthM * PX_PER_METER;
  const startX = Math.min(wall.x1, wall.x2);
  const startY = Math.min(wall.y1, wall.y2);
  const groupX = (isHorizontal ? startX * PX_PER_METER : wall.x1 * PX_PER_METER) - (isHorizontal ? 0 : thicknessPx / 2);
  const groupY = (isHorizontal ? wall.y1 * PX_PER_METER : startY * PX_PER_METER) - (isHorizontal ? thicknessPx / 2 : 0);
  return { isHorizontal, lengthM, lengthPx, groupX, groupY };
}

/** Distância (em metros) de um ponto ao segmento da parede livre, e a
 * fracção t (0..1) ao longo do comprimento — usado para "atrair" um
 * elemento largado perto de uma parede livre e calcular o offset certo. */
function pointToWallProjection(px: number, py: number, wall: FreeWall) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - wall.x1) * dx + (py - wall.y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = wall.x1 + t * dx;
  const projY = wall.y1 + t * dy;
  const distance = Math.hypot(px - projX, py - projY);
  return { distance, t };
}

const FREE_WALL_ATTACH_THRESHOLD_M = 0.4;

interface Editor2DProps {
  /** Quando true (ecrã inteiro), o canvas ocupa o espaço disponível em vez do tamanho fixo. */
  expanded?: boolean;
}

function openingsBySide(division: Division, hidden: HiddenSegment[]): OpeningsBySide {
  const grouped: OpeningsBySide = {};
  for (const o of division.openings) {
    const range = { offsetPx: o.offsetM * PX_PER_METER, widthPx: o.widthM * PX_PER_METER };
    (grouped[o.side] ??= []).push(range);
  }
  // paredes partilhadas com uma divisão vizinha encostada: não desenhar
  // (sem marcador — não é uma porta/janela, é só "a outra já desenha")
  for (const h of hidden) {
    const range = { offsetPx: h.startM * PX_PER_METER, widthPx: h.lengthM * PX_PER_METER };
    (grouped[h.side] ??= []).push(range);
  }
  return grouped;
}

function openingMarkerRect(o: Opening, widthPx: number, heightPx: number, thicknessPx: number) {
  const offsetPx = o.offsetM * PX_PER_METER;
  const widthOpeningPx = o.widthM * PX_PER_METER;
  switch (o.side) {
    case "top":
      return { x: offsetPx, y: 0, width: widthOpeningPx, height: thicknessPx };
    case "bottom":
      return { x: offsetPx, y: heightPx - thicknessPx, width: widthOpeningPx, height: thicknessPx };
    case "left":
      return { x: 0, y: offsetPx, width: thicknessPx, height: widthOpeningPx };
    case "right":
      return { x: widthPx - thicknessPx, y: offsetPx, width: thicknessPx, height: widthOpeningPx };
  }
}

function plusButtonPosition(side: WallSide, widthPx: number, heightPx: number) {
  switch (side) {
    case "top":
      return { x: widthPx / 2, y: -SIDE_PLUS_OFFSET };
    case "bottom":
      return { x: widthPx / 2, y: heightPx + SIDE_PLUS_OFFSET };
    case "left":
      return { x: -SIDE_PLUS_OFFSET, y: heightPx / 2 };
    case "right":
      return { x: widthPx + SIDE_PLUS_OFFSET, y: heightPx / 2 };
  }
}

export function Editor2D({ expanded = false }: Editor2DProps = {}) {
  const divisions = useProjectStore((s) => s.project.divisions);
  const selectedDivisionIds = useProjectStore((s) => s.selectedDivisionIds);
  const selectedOpeningId = useProjectStore((s) => s.selectedOpeningId);
  const updateDivision = useProjectStore((s) => s.updateDivision);
  const removeDivisions = useProjectStore((s) => s.removeDivisions);
  const selectDivision = useProjectStore((s) => s.selectDivision);
  const selectOpening = useProjectStore((s) => s.selectOpening);
  const addAdjacentDivision = useProjectStore((s) => s.addAdjacentDivision);
  const pasteDivisions = useProjectStore((s) => s.pasteDivisions);
  const addOpening = useProjectStore((s) => s.addOpening);
  const updateOpening = useProjectStore((s) => s.updateOpening);
  const selectAllDivisions = useProjectStore((s) => s.selectAllDivisions);
  const freeWalls = useProjectStore((s) => s.project.freeWalls);
  const materials = useProjectStore((s) => s.materials);
  const selectedFreeWallId = useProjectStore((s) => s.selectedFreeWallId);
  const addFreeWall = useProjectStore((s) => s.addFreeWall);
  const updateFreeWall = useProjectStore((s) => s.updateFreeWall);
  const removeFreeWall = useProjectStore((s) => s.removeFreeWall);
  const selectFreeWall = useProjectStore((s) => s.selectFreeWall);
  const addFreeWallOpening = useProjectStore((s) => s.addFreeWallOpening);
  const updateFreeWallOpening = useProjectStore((s) => s.updateFreeWallOpening);
  const [hoveredDivisionId, setHoveredDivisionId] = useState<string | null>(null);

  const clipboardRef = useRef<Division[]>([]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const state = useProjectStore.getState();
      const selectedIds = state.selectedDivisionIds;
      const mod = e.ctrlKey || e.metaKey;

      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedFreeWallId) {
        e.preventDefault();
        removeFreeWall(state.selectedFreeWallId);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        e.preventDefault();
        removeDivisions(selectedIds);
      } else if (mod && e.key.toLowerCase() === "c" && selectedIds.length > 0) {
        e.preventDefault();
        const idSet = new Set(selectedIds);
        clipboardRef.current = structuredClone(state.project.divisions.filter((d) => idSet.has(d.id)));
      } else if (mod && e.key.toLowerCase() === "v" && clipboardRef.current.length > 0) {
        e.preventDefault();
        pasteDivisions(clipboardRef.current);
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllDivisions();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        state.undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeDivisions, pasteDivisions, selectAllDivisions, removeFreeWall]);

  const prevBlockCounts = useRef<Map<string, number>>(new Map());
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 20, y: 20 });
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [stageSize, setStageSize] = useState({ width: BASE_STAGE_WIDTH, height: BASE_STAGE_HEIGHT });
  const STAGE_WIDTH = stageSize.width;
  const STAGE_HEIGHT = stageSize.height;

  useEffect(() => {
    function updateSize() {
      const containerWidth = containerRef.current?.clientWidth ?? BASE_STAGE_WIDTH;
      if (expanded) {
        const width = Math.max(BASE_STAGE_WIDTH, containerWidth - 4);
        const height = Math.max(BASE_STAGE_HEIGHT, window.innerHeight - 260);
        setStageSize({ width, height });
        return;
      }
      // fora do ecrã inteiro: nunca ultrapassa o tamanho base, mas encolhe
      // para caber em ecrãs mais estreitos (mantendo a proporção) — sem
      // isto o canvas ficava sempre a 900px fixos e desalinhado do resto
      // da página em janelas/telemóveis mais estreitos.
      const width = Math.max(280, Math.min(BASE_STAGE_WIDTH, containerWidth));
      const height = Math.round(width * (BASE_STAGE_HEIGHT / BASE_STAGE_WIDTH));
      setStageSize({ width, height });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [expanded]);

  // largar um elemento da paleta dentro de uma divisão adiciona a abertura
  // na parede mais próxima do ponto onde se largou
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }

    function onDrop(e: DragEvent) {
      e.preventDefault();
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const worldM = {
        x: (e.clientX - rect.left - view.x) / view.scale / PX_PER_METER,
        y: (e.clientY - rect.top - view.y) / view.scale / PX_PER_METER,
      };

      const isWall = e.dataTransfer?.getData("application/x-kubata-wall");
      const type = e.dataTransfer?.getData("application/x-kubata-opening") as OpeningType | "";

      // parede livre próxima do ponto: aberturas largadas perto de uma
      // parede livre ligam-se a ela, independentemente de estarem ou não
      // dentro de uma divisão (permite "conectar um balcão a uma parede nova")
      if (type) {
        let nearestWall: { wall: (typeof freeWalls)[number]; t: number; distance: number } | null = null;
        for (const w of freeWalls) {
          const { distance, t } = pointToWallProjection(worldM.x, worldM.y, w);
          if (distance <= FREE_WALL_ATTACH_THRESHOLD_M && (!nearestWall || distance < nearestWall.distance)) {
            nearestWall = { wall: w, t, distance };
          }
        }
        if (nearestWall) {
          const defaultWidth = DEFAULT_OPENING_WIDTH_M[type];
          const lengthM = freeWallLengthM(nearestWall.wall);
          const offsetM = Math.max(0, Math.min(nearestWall.t * lengthM - defaultWidth / 2, Math.max(0, lengthM - defaultWidth)));
          addFreeWallOpening(nearestWall.wall.id, { type, side: "top", offsetM: round1(offsetM), widthM: defaultWidth });
          selectFreeWall(nearestWall.wall.id);
          return;
        }
      }

      const target = divisions.find(
        (d) => worldM.x >= d.x && worldM.x <= d.x + d.width && worldM.y >= d.y && worldM.y <= d.y + d.height,
      );

      if (type && target) {
        const defaultWidth = DEFAULT_OPENING_WIDTH_M[type];
        if (type === "balcao") {
          // balcões podem ser largados livremente em qualquer ponto da
          // divisão, não só presos a uma parede — freeX/freeY é o canto
          // superior esquerdo do rectângulo (largar centra-o no ponto)
          const footprint = 1;
          const freeX = round1(Math.max(0, Math.min(worldM.x - target.x - footprint / 2, target.width - footprint)));
          const freeY = round1(Math.max(0, Math.min(worldM.y - target.y - footprint / 2, target.height - footprint)));
          addOpening(target.id, {
            type,
            side: "top",
            offsetM: 0,
            widthM: defaultWidth,
            freeX,
            freeY,
            freeWidthM: footprint,
            freeHeightM: footprint,
          });
        } else {
          const { side, offset } = nearestSideAndOffset(
            { x: worldM.x - target.x, y: worldM.y - target.y },
            target.width,
            target.height,
            defaultWidth,
          );
          addOpening(target.id, { type, side, offsetM: round1(offset), widthM: defaultWidth });
        }
        selectDivision(target.id);
        return;
      }

      if (isWall) {
        const half = 1.5;
        const x1 = Math.max(0, round1(worldM.x - half));
        addFreeWall(x1, round1(worldM.y), round1(x1 + half * 2), round1(worldM.y));
      }
    }

    const container_ = container;
    container_.addEventListener("dragover", onDragOver);
    container_.addEventListener("drop", onDrop);
    return () => {
      container_.removeEventListener("dragover", onDragOver);
      container_.removeEventListener("drop", onDrop);
    };
  }, [view, divisions, freeWalls, addOpening, selectDivision, addFreeWall, addFreeWallOpening, selectFreeWall]);

  const divisionsRender = useMemo(() => {
    const hidden = computeHiddenSegments(divisions);
    return divisions.map((d) => {
      const spec = resolveBlockSpec(d.blockSpecId, d.blockOverride);
      const widthPx = d.width * PX_PER_METER;
      const heightPx = d.height * PX_PER_METER;
      const hiddenForD = hiddenSegmentsForDivision(hidden, d.id);
      const blocks = generateWallBlocks(widthPx, heightPx, spec, PX_PER_METER, openingsBySide(d, hiddenForD), d.openWalls);
      const thicknessPx = Math.max(4, (spec.thicknessCm / 100) * PX_PER_METER);
      const colliding = collidingOpeningIds(d, hiddenForD);
      return { division: d, spec, widthPx, heightPx, blocks, thicknessPx, colliding };
    });
  }, [divisions]);

  useEffect(() => {
    const counts = prevBlockCounts.current;
    for (const { division, blocks } of divisionsRender) {
      counts.set(division.id, blocks.length);
    }
    const liveIds = new Set(divisionsRender.map((r) => r.division.id));
    for (const id of counts.keys()) if (!liveIds.has(id)) counts.delete(id);
  }, [divisionsRender]);

  const divisionCount = divisions.length;
  const prevDivisionCount = useRef(divisionCount);
  useEffect(() => {
    if (divisionCount > prevDivisionCount.current) {
      // uma divisão nova entrou: garante que fica visível em vez de cair fora da vista
      fitToView();
    }
    prevDivisionCount.current = divisionCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionCount]);

  function fitToView() {
    if (divisions.length === 0) {
      setView({ scale: 1, x: 20, y: 20 });
      return;
    }
    const minX = Math.min(...divisions.map((d) => d.x));
    const minY = Math.min(...divisions.map((d) => d.y));
    const maxX = Math.max(...divisions.map((d) => d.x + d.width));
    const maxY = Math.max(...divisions.map((d) => d.y + d.height));
    const contentWidth = Math.max(1, (maxX - minX) * PX_PER_METER);
    const contentHeight = Math.max(1, (maxY - minY) * PX_PER_METER);
    const padding = 40;
    const scale = clamp(
      Math.min((STAGE_WIDTH - padding) / contentWidth, (STAGE_HEIGHT - padding) / contentHeight),
      MIN_SCALE,
      MAX_SCALE,
    );
    // centra o conteúdo no espaço disponível (em vez de o encostar ao
    // canto superior esquerdo, que deixava vazio à direita/em baixo
    // sempre que a proporção do conteúdo não coincidia com a do stage)
    const offsetX = (STAGE_WIDTH - contentWidth * scale) / 2;
    const offsetY = (STAGE_HEIGHT - contentHeight * scale) / 2;
    setView({
      scale,
      x: offsetX - minX * PX_PER_METER * scale,
      y: offsetY - minY * PX_PER_METER * scale,
    });
  }

  function zoomBy(factor: number) {
    setView((v) => ({ ...v, scale: clamp(v.scale * factor, MIN_SCALE, MAX_SCALE) }));
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 0.9 : 1.1;
    const newScale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    const mousePointTo = {
      x: (pointer.x - view.x) / view.scale,
      y: (pointer.y - view.y) / view.scale,
    };
    setView({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }

  const totalArea = totalWallAreaM2(divisions, freeWalls);
  const grandTotal = totalCost(materials, totalArea);

  return (
    <div
      ref={containerRef}
      style={
        expanded
          ? { flex: "1 1 auto", minWidth: 0 }
          : { width: "100%", maxWidth: BASE_STAGE_WIDTH, minWidth: 0, boxSizing: "border-box" }
      }
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => zoomBy(1.2)} title="Aproximar">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} title="Afastar">
          −
        </button>
        <button type="button" onClick={fitToView}>
          Ajustar à vista
        </button>
        <span style={{ fontSize: 12, color: "var(--text)" }}>
          {Math.round(view.scale * 100)}% — arrasta o fundo para navegar, roda o rato para zoom
        </span>
        {selectedDivisionIds.length > 1 && (
          <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
            {selectedDivisionIds.length} divisões seleccionadas
          </span>
        )}
      </div>

      <div style={{ position: "relative", width: STAGE_WIDTH }}>
        <ElementPalette />
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            zIndex: 2,
            background: "var(--accent)",
            color: "#fff",
            padding: "7px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
            pointerEvents: "none",
          }}
        >
          Total da obra: {Math.round(grandTotal).toLocaleString("pt-PT")} Kz
        </div>
        <Stage
          ref={stageRef}
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          style={{ background: "#f5f2ec", borderRadius: 8 }}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onClick={(e) => {
            if (e.target === e.target.getStage()) {
              selectDivision(null);
            }
          }}
          onWheel={handleWheel}
        >
          <Layer>
            {divisionsRender.map(({ division: d, spec, widthPx, heightPx, blocks, thicknessPx, colliding }) => {
              const prevCount = prevBlockCounts.current.get(d.id) ?? 0;
              const selected = selectedDivisionIds.includes(d.id);
              const dimmed = selectedDivisionIds.length > 0 && !selected;
              const hovered = hoveredDivisionId === d.id;

              return (
                <Group
                  key={d.id}
                  x={d.x * PX_PER_METER}
                  y={d.y * PX_PER_METER}
                  opacity={dimmed ? NOT_SELECTED_OPACITY : 1}
                  draggable
                  onClick={(e) => selectDivision(d.id, e.evt.shiftKey)}
                  onTap={() => selectDivision(d.id)}
                  onMouseEnter={() => setHoveredDivisionId(d.id)}
                  onMouseLeave={() => setHoveredDivisionId((cur) => (cur === d.id ? null : cur))}
                  onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                    if (e.target !== e.currentTarget) return;
                    const others = divisions
                      .filter((o) => o.id !== d.id)
                      .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
                    const thresholdM = SNAP_THRESHOLD_PX / view.scale / PX_PER_METER;
                    const snap = snapPosition(
                      { x: e.target.x() / PX_PER_METER, y: e.target.y() / PX_PER_METER, width: d.width, height: d.height },
                      others,
                      thresholdM,
                    );
                    e.target.position({ x: snap.x * PX_PER_METER, y: snap.y * PX_PER_METER });
                    setGuides({ x: snap.guideX, y: snap.guideY });
                  }}
                  onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                    if (e.target !== e.currentTarget) return;
                    updateDivision(d.id, {
                      x: round1(e.target.x() / PX_PER_METER),
                      y: round1(e.target.y() / PX_PER_METER),
                    });
                    setGuides({});
                  }}
                >
                  <Rect
                    width={widthPx}
                    height={heightPx}
                    fill="#f0e6d6"
                    stroke={selected ? "#2563eb" : "transparent"}
                    strokeWidth={selected ? 2 : 0}
                    dash={selected ? [4, 3] : undefined}
                  />

                  {blocks.map((b: WallBlockRect, i: number) => (
                    <WallBlockShape
                      key={`${d.id}-${b.key}`}
                      x={b.x}
                      y={b.y}
                      width={b.width}
                      height={b.height}
                      fill={d.wallColor ?? BLOCK_FILL[spec.category]}
                      animate={i >= prevCount}
                      delayMs={Math.min(Math.max(i - prevCount, 0), 40) * 12}
                    />
                  ))}

                  {d.openings.map((o) => {
                    const isFree = o.freeX !== undefined && o.freeY !== undefined;
                    const openingSelected = o.id === selectedOpeningId;
                    const hasCollision = colliding.has(o.id);

                    if (isFree) {
                      const fwM = o.freeWidthM ?? 1;
                      const fhM = o.freeHeightM ?? 1;
                      const fx = o.freeX! * PX_PER_METER;
                      const fy = o.freeY! * PX_PER_METER;
                      const fwPx = fwM * PX_PER_METER;
                      const fhPx = fhM * PX_PER_METER;
                      return (
                        <Rect
                          key={o.id}
                          x={fx}
                          y={fy}
                          width={fwPx}
                          height={fhPx}
                          cornerRadius={3}
                          fill={OPENING_FILL[o.type]}
                          stroke={openingSelected ? "#ff3b8d" : "#3a2a1a"}
                          strokeWidth={openingSelected ? 2 : 0.5}
                          draggable
                          onMouseEnter={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "grab";
                          }}
                          onMouseLeave={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "default";
                          }}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            selectDivision(d.id);
                            selectOpening(o.id);
                          }}
                          onDragStart={(e) => {
                            e.cancelBubble = true;
                          }}
                          onDragEnd={(e) => {
                            e.cancelBubble = true;
                            const freeX = round1(Math.max(0, Math.min(e.target.x() / PX_PER_METER, d.width - fwM)));
                            const freeY = round1(Math.max(0, Math.min(e.target.y() / PX_PER_METER, d.height - fhM)));
                            updateOpening(d.id, o.id, { freeX, freeY });
                          }}
                        />
                      );
                    }

                    const r = openingMarkerRect(o, widthPx, heightPx, thicknessPx);
                    return (
                      <Rect
                        key={o.id}
                        x={r.x}
                        y={r.y}
                        width={r.width}
                        height={r.height}
                        fill={OPENING_FILL[o.type]}
                        stroke={hasCollision ? "#dc2626" : openingSelected ? "#ff3b8d" : "#3a2a1a"}
                        strokeWidth={hasCollision ? 2.5 : openingSelected ? 2 : 0.5}
                        dash={hasCollision ? [3, 2] : undefined}
                        draggable
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = "grab";
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = "default";
                        }}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          selectDivision(d.id);
                          selectOpening(o.id);
                        }}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const group = e.target.getParent();
                          const rel = group?.getRelativePointerPosition();
                          if (!rel) return;
                          const { side, offset } = nearestSideAndOffset(rel, widthPx, heightPx, o.widthM * PX_PER_METER);
                          const preview = openingMarkerRect({ ...o, side, offsetM: offset / PX_PER_METER }, widthPx, heightPx, thicknessPx);
                          e.target.position({ x: preview.x, y: preview.y });
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          const group = e.target.getParent();
                          const rel = group?.getRelativePointerPosition();
                          if (!rel) {
                            e.target.position({ x: r.x, y: r.y });
                            return;
                          }
                          const { side, offset } = nearestSideAndOffset(rel, widthPx, heightPx, o.widthM * PX_PER_METER);
                          updateOpening(d.id, o.id, { side, offsetM: round1(offset / PX_PER_METER) });
                        }}
                      />
                    );
                  })}

                  {/* alças de largura das aberturas: só quando seleccionada, uma em cada ponta */}
                  {d.openings
                    .filter((o) => o.id === selectedOpeningId && o.freeX === undefined)
                    .map((o) => {
                      const r = openingMarkerRect(o, widthPx, heightPx, thicknessPx);
                      const horizontal = o.side === "top" || o.side === "bottom";
                      const sideLenPx = horizontal ? widthPx : heightPx;
                      const handles = horizontal
                        ? [
                            { key: "start", x: r.x, y: r.y + r.height / 2, cursor: "ew-resize" },
                            { key: "end", x: r.x + r.width, y: r.y + r.height / 2, cursor: "ew-resize" },
                          ]
                        : [
                            { key: "start", x: r.x + r.width / 2, y: r.y, cursor: "ns-resize" },
                            { key: "end", x: r.x + r.width / 2, y: r.y + r.height, cursor: "ns-resize" },
                          ];
                      return handles.map((h) => (
                        <Rect
                          key={`${o.id}-${h.key}`}
                          x={h.x - 5}
                          y={h.y - 5}
                          width={10}
                          height={10}
                          fill="#ff3b8d"
                          cornerRadius={2}
                          onMouseEnter={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = h.cursor;
                          }}
                          onMouseLeave={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "default";
                          }}
                          onMouseDown={(e) => {
                            e.cancelBubble = true;
                            const startOffsetM = o.offsetM;
                            const startWidthM = o.widthM;
                            const stage = stageRef.current;
                            if (!stage) return;
                            const containerEl = stage.container();

                            function onMove(ev: MouseEvent) {
                              const rect = containerEl.getBoundingClientRect();
                              const worldPx = {
                                x: (ev.clientX - rect.left - view.x) / view.scale,
                                y: (ev.clientY - rect.top - view.y) / view.scale,
                              };
                              const rel = { x: worldPx.x - d.x * PX_PER_METER, y: worldPx.y - d.y * PX_PER_METER };
                              const alongPx = horizontal ? rel.x : rel.y;
                              let newOffsetM: number;
                              let newWidthM: number;
                              if (h.key === "start") {
                                const fixedEndM = (startOffsetM + startWidthM);
                                newOffsetM = Math.max(0, Math.min(alongPx / PX_PER_METER, fixedEndM - 0.2));
                                newWidthM = fixedEndM - newOffsetM;
                              } else {
                                newOffsetM = startOffsetM;
                                const maxWidthM = sideLenPx / PX_PER_METER - startOffsetM;
                                newWidthM = Math.max(0.2, Math.min(alongPx / PX_PER_METER - startOffsetM, maxWidthM));
                              }
                              updateOpening(d.id, o.id, { offsetM: round1(newOffsetM), widthM: round1(newWidthM) });
                            }
                            function onUp() {
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            }
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                        />
                      ));
                    })}

                  {/* alças do balcão livre: 4 cantos + 4 lados, tal como as divisões —
                      expande/encolhe em qualquer direcção */}
                  {d.openings
                    .filter((o) => o.id === selectedOpeningId && o.freeX !== undefined && o.freeY !== undefined)
                    .flatMap((o) => {
                      const fwM0 = o.freeWidthM ?? 1;
                      const fhM0 = o.freeHeightM ?? 1;
                      const fxPx = o.freeX! * PX_PER_METER;
                      const fyPx = o.freeY! * PX_PER_METER;
                      const fwPx = fwM0 * PX_PER_METER;
                      const fhPx = fhM0 * PX_PER_METER;
                      return RESIZE_HANDLES.map((h) => {
                        const pos = resizeHandlePosition(h.side, fwPx, fhPx);
                        return (
                          <Rect
                            key={`${o.id}-${h.side}`}
                            x={fxPx + pos.x - 5}
                            y={fyPx + pos.y - 5}
                            width={10}
                            height={10}
                            fill="#ff3b8d"
                            cornerRadius={2}
                            onMouseEnter={(e) => {
                              const stage = e.target.getStage();
                              if (stage) stage.container().style.cursor = h.cursor;
                            }}
                            onMouseLeave={(e) => {
                              const stage = e.target.getStage();
                              if (stage) stage.container().style.cursor = "default";
                            }}
                            onMouseDown={(e) => {
                              e.cancelBubble = true;
                              const stage = stageRef.current;
                              if (!stage) return;
                              const containerEl = stage.container();
                              const start = { freeX: o.freeX!, freeY: o.freeY!, freeWidthM: fwM0, freeHeightM: fhM0 };

                              function onMove(ev: MouseEvent) {
                                const rect = containerEl.getBoundingClientRect();
                                const worldPx = {
                                  x: (ev.clientX - rect.left - view.x) / view.scale,
                                  y: (ev.clientY - rect.top - view.y) / view.scale,
                                };
                                const rel = { x: worldPx.x - d.x * PX_PER_METER, y: worldPx.y - d.y * PX_PER_METER };
                                const relM = { x: rel.x / PX_PER_METER, y: rel.y / PX_PER_METER };
                                let freeX = start.freeX;
                                let freeY = start.freeY;
                                let freeWidthM = start.freeWidthM;
                                let freeHeightM = start.freeHeightM;
                                if (h.side.includes("left")) {
                                  const right = start.freeX + start.freeWidthM;
                                  freeX = Math.max(0, Math.min(relM.x, right - 0.2));
                                  freeWidthM = right - freeX;
                                }
                                if (h.side.includes("right")) {
                                  freeWidthM = Math.max(0.2, Math.min(relM.x - start.freeX, d.width - start.freeX));
                                }
                                if (h.side.includes("top")) {
                                  const bottom = start.freeY + start.freeHeightM;
                                  freeY = Math.max(0, Math.min(relM.y, bottom - 0.2));
                                  freeHeightM = bottom - freeY;
                                }
                                if (h.side.includes("bottom")) {
                                  freeHeightM = Math.max(0.2, Math.min(relM.y - start.freeY, d.height - start.freeY));
                                }
                                updateOpening(d.id, o.id, {
                                  freeX: round1(freeX),
                                  freeY: round1(freeY),
                                  freeWidthM: round1(freeWidthM),
                                  freeHeightM: round1(freeHeightM),
                                });
                              }
                              function onUp() {
                                window.removeEventListener("mousemove", onMove);
                                window.removeEventListener("mouseup", onUp);
                              }
                              window.addEventListener("mousemove", onMove);
                              window.addEventListener("mouseup", onUp);
                            }}
                          />
                        );
                      });
                    })}

                  <Text
                    text={`${d.label}\n${d.width}m × ${d.height}m`}
                    fontSize={12}
                    padding={6}
                    width={widthPx}
                    align="center"
                    listening={false}
                  />

                  {/* alças de redimensionar: 4 cantos + 4 lados, subtis — só bem visíveis ao passar o rato */}
                  {(selected || hovered) &&
                    RESIZE_HANDLES.map((h) => {
                      const pos = resizeHandlePosition(h.side, widthPx, heightPx);
                      return (
                        <Rect
                          key={h.side}
                          x={pos.x - 5}
                          y={pos.y - 5}
                          width={10}
                          height={10}
                          fill="#8a5a2b"
                          opacity={0.45}
                          cornerRadius={2}
                          onMouseEnter={(e) => {
                            e.target.opacity(0.95);
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = h.cursor;
                            e.target.getLayer()?.batchDraw();
                          }}
                          onMouseLeave={(e) => {
                            e.target.opacity(0.45);
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "default";
                            e.target.getLayer()?.batchDraw();
                          }}
                          onMouseDown={(e) => {
                            e.cancelBubble = true;
                            const stage = stageRef.current;
                            const p0 = stage?.getPointerPosition();
                            if (!stage || !p0) return;
                            const startWorldPx = { x: (p0.x - view.x) / view.scale, y: (p0.y - view.y) / view.scale };
                            const start = { x: d.x, y: d.y, width: d.width, height: d.height };
                            const containerEl = stage.container();

                            function onMove(ev: MouseEvent) {
                              const rect = containerEl.getBoundingClientRect();
                              const worldPx = {
                                x: (ev.clientX - rect.left - view.x) / view.scale,
                                y: (ev.clientY - rect.top - view.y) / view.scale,
                              };
                              const dxM = (worldPx.x - startWorldPx.x) / PX_PER_METER;
                              const dyM = (worldPx.y - startWorldPx.y) / PX_PER_METER;
                              let x = start.x;
                              let y = start.y;
                              let width = start.width;
                              let height = start.height;
                              if (h.side.includes("left")) {
                                width = start.width - dxM;
                                x = start.x + dxM;
                              }
                              if (h.side.includes("right")) {
                                width = start.width + dxM;
                              }
                              if (h.side.includes("top")) {
                                height = start.height - dyM;
                                y = start.y + dyM;
                              }
                              if (h.side.includes("bottom")) {
                                height = start.height + dyM;
                              }
                              if (width < 1) {
                                x = h.side.includes("left") ? start.x + start.width - 1 : start.x;
                                width = 1;
                              }
                              if (height < 1) {
                                y = h.side.includes("top") ? start.y + start.height - 1 : start.y;
                                height = 1;
                              }
                              updateDivision(d.id, { x: round1(x), y: round1(y), width: round1(width), height: round1(height) });
                            }
                            function onUp() {
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            }
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                        />
                      );
                    })}

                  {selected &&
                    selectedDivisionIds.length === 1 &&
                    (["top", "right", "bottom", "left"] as WallSide[]).map((side) => {
                      const pos = plusButtonPosition(side, widthPx, heightPx);
                      return (
                        <Group
                          key={side}
                          x={pos.x}
                          y={pos.y}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            addAdjacentDivision(d.id, side);
                          }}
                          onTap={(e) => {
                            e.cancelBubble = true;
                            addAdjacentDivision(d.id, side);
                          }}
                          onMouseEnter={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "pointer";
                          }}
                          onMouseLeave={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "default";
                          }}
                        >
                          <Circle radius={9} fill="#2563eb" stroke="#fff" strokeWidth={1} />
                          <Text text="+" fontSize={14} fill="#fff" x={-4} y={-7} listening={false} />
                        </Group>
                      );
                    })}
                </Group>
              );
            })}

            {freeWalls.map((w) => {
              const spec = resolveBlockSpec(w.blockSpecId, w.blockOverride);
              const thicknessPx = Math.max(4, (spec.thicknessCm / 100) * PX_PER_METER);
              const { isHorizontal, lengthPx, groupX, groupY } = freeWallGeometry(w, thicknessPx);
              const openingRanges = w.openings.map((o) => ({ offsetPx: o.offsetM * PX_PER_METER, widthPx: o.widthM * PX_PER_METER }));
              const blocks = generateFreeWallBlocks(lengthPx, spec, PX_PER_METER, openingRanges);
              const selected = w.id === selectedFreeWallId;

              return (
                <Group key={w.id} x={groupX} y={groupY}>
                  <Rect
                    x={isHorizontal ? 0 : -2}
                    y={isHorizontal ? -2 : 0}
                    width={isHorizontal ? lengthPx : thicknessPx + 4}
                    height={isHorizontal ? thicknessPx + 4 : lengthPx}
                    fill="transparent"
                    stroke={selected ? "#2563eb" : "transparent"}
                    strokeWidth={selected ? 2 : 0}
                    dash={selected ? [4, 3] : undefined}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      selectFreeWall(w.id);
                    }}
                  />
                  {blocks.map((b, i) => (
                    <WallBlockShape
                      key={`${w.id}-${b.key}`}
                      x={isHorizontal ? b.x : b.y}
                      y={isHorizontal ? b.y : b.x}
                      width={isHorizontal ? b.width : b.height}
                      height={isHorizontal ? b.height : b.width}
                      fill={w.wallColor ?? BLOCK_FILL[spec.category]}
                      animate={false}
                      delayMs={i * 4}
                    />
                  ))}

                  {w.openings.map((o) => {
                    const offsetPx = o.offsetM * PX_PER_METER;
                    const widthPx = o.widthM * PX_PER_METER;
                    const openingSelected = o.id === selectedOpeningId;
                    return (
                      <Rect
                        key={o.id}
                        x={isHorizontal ? offsetPx : 0}
                        y={isHorizontal ? 0 : offsetPx}
                        width={isHorizontal ? widthPx : thicknessPx}
                        height={isHorizontal ? thicknessPx : widthPx}
                        fill={OPENING_FILL[o.type]}
                        stroke={openingSelected ? "#ff3b8d" : "#3a2a1a"}
                        strokeWidth={openingSelected ? 2 : 0.5}
                        draggable
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = "grab";
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = "default";
                        }}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          selectFreeWall(w.id);
                          selectOpening(o.id);
                        }}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          const raw = isHorizontal ? e.target.x() : e.target.y();
                          const newOffsetM = round1(Math.max(0, Math.min(raw / PX_PER_METER, Math.max(0, freeWallLengthM(w) - o.widthM))));
                          updateFreeWallOpening(w.id, o.id, { offsetM: newOffsetM });
                        }}
                      />
                    );
                  })}

                  {/* alças de largura das aberturas da parede livre: só quando seleccionada */}
                  {w.openings
                    .filter((o) => o.id === selectedOpeningId)
                    .flatMap((o) => {
                      const offsetPx = o.offsetM * PX_PER_METER;
                      const widthPxO = o.widthM * PX_PER_METER;
                      const startPos = isHorizontal ? { x: offsetPx, y: thicknessPx / 2 } : { x: thicknessPx / 2, y: offsetPx };
                      const endPos = isHorizontal
                        ? { x: offsetPx + widthPxO, y: thicknessPx / 2 }
                        : { x: thicknessPx / 2, y: offsetPx + widthPxO };
                      return (["start", "end"] as const).map((which) => {
                        const pos = which === "start" ? startPos : endPos;
                        return (
                          <Rect
                            key={`${o.id}-${which}`}
                            x={pos.x - 5}
                            y={pos.y - 5}
                            width={10}
                            height={10}
                            fill="#ff3b8d"
                            cornerRadius={2}
                            onMouseEnter={(e) => {
                              const stage = e.target.getStage();
                              if (stage) stage.container().style.cursor = isHorizontal ? "ew-resize" : "ns-resize";
                            }}
                            onMouseLeave={(e) => {
                              const stage = e.target.getStage();
                              if (stage) stage.container().style.cursor = "default";
                            }}
                            onMouseDown={(e) => {
                              e.cancelBubble = true;
                              const startOffsetM = o.offsetM;
                              const startWidthM = o.widthM;
                              const stage = stageRef.current;
                              if (!stage) return;
                              const containerEl = stage.container();

                              function onMove(ev: MouseEvent) {
                                const rect = containerEl.getBoundingClientRect();
                                const worldPx = {
                                  x: (ev.clientX - rect.left - view.x) / view.scale,
                                  y: (ev.clientY - rect.top - view.y) / view.scale,
                                };
                                const rel = { x: worldPx.x - groupX, y: worldPx.y - groupY };
                                const alongPx = isHorizontal ? rel.x : rel.y;
                                const lengthM = freeWallLengthM(w);
                                let newOffsetM: number;
                                let newWidthM: number;
                                if (which === "start") {
                                  const fixedEndM = startOffsetM + startWidthM;
                                  newOffsetM = Math.max(0, Math.min(alongPx / PX_PER_METER, fixedEndM - 0.2));
                                  newWidthM = fixedEndM - newOffsetM;
                                } else {
                                  newOffsetM = startOffsetM;
                                  const maxWidthM = lengthM - startOffsetM;
                                  newWidthM = Math.max(0.2, Math.min(alongPx / PX_PER_METER - startOffsetM, maxWidthM));
                                }
                                updateFreeWallOpening(w.id, o.id, { offsetM: round1(newOffsetM), widthM: round1(newWidthM) });
                              }
                              function onUp() {
                                window.removeEventListener("mousemove", onMove);
                                window.removeEventListener("mouseup", onUp);
                              }
                              window.addEventListener("mousemove", onMove);
                              window.addEventListener("mouseup", onUp);
                            }}
                          />
                        );
                      });
                    })}

                  {selected &&
                    (["start", "end"] as const).map((which) => {
                      const pos = which === "start" ? { x: isHorizontal ? 0 : thicknessPx / 2, y: isHorizontal ? thicknessPx / 2 : 0 } : { x: isHorizontal ? lengthPx : thicknessPx / 2, y: isHorizontal ? thicknessPx / 2 : lengthPx };
                      return (
                        <Rect
                          key={which}
                          x={pos.x - 6}
                          y={pos.y - 6}
                          width={12}
                          height={12}
                          fill="#8a5a2b"
                          opacity={0.8}
                          cornerRadius={2}
                          onMouseEnter={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = isHorizontal ? "ew-resize" : "ns-resize";
                          }}
                          onMouseLeave={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "default";
                          }}
                          onMouseDown={(e) => {
                            e.cancelBubble = true;
                            const stage = stageRef.current;
                            const p0 = stage?.getPointerPosition();
                            if (!stage || !p0) return;
                            const startWorldPx = { x: (p0.x - view.x) / view.scale, y: (p0.y - view.y) / view.scale };
                            const start = { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 };
                            const containerEl = stage.container();

                            function onMove(ev: MouseEvent) {
                              const rect = containerEl.getBoundingClientRect();
                              const worldPx = {
                                x: (ev.clientX - rect.left - view.x) / view.scale,
                                y: (ev.clientY - rect.top - view.y) / view.scale,
                              };
                              const dxM = (worldPx.x - startWorldPx.x) / PX_PER_METER;
                              const dyM = (worldPx.y - startWorldPx.y) / PX_PER_METER;
                              const horizontal = Math.abs(dxM) >= Math.abs(dyM);
                              let patch: Partial<FreeWall>;
                              if (which === "start") {
                                patch = horizontal
                                  ? { x1: round1(start.x1 + dxM), y1: start.y2, y2: start.y2 }
                                  : { y1: round1(start.y1 + dyM), x1: start.x2, x2: start.x2 };
                              } else {
                                patch = horizontal
                                  ? { x2: round1(start.x2 + dxM), y2: start.y1, y1: start.y1 }
                                  : { y2: round1(start.y2 + dyM), x2: start.x1, x1: start.x1 };
                              }
                              const nx1 = patch.x1 ?? start.x1;
                              const ny1 = patch.y1 ?? start.y1;
                              const nx2 = patch.x2 ?? start.x2;
                              const ny2 = patch.y2 ?? start.y2;
                              if (Math.abs(nx2 - nx1) + Math.abs(ny2 - ny1) < 0.3) return;
                              updateFreeWall(w.id, patch);
                            }
                            function onUp() {
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            }
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                        />
                      );
                    })}
                </Group>
              );
            })}

            {guides.x !== undefined && (
              <Line
                points={[guides.x * PX_PER_METER, -2000, guides.x * PX_PER_METER, 4000]}
                stroke="#ff3b8d"
                strokeWidth={1 / view.scale}
                dash={[5, 4]}
                listening={false}
              />
            )}
            {guides.y !== undefined && (
              <Line
                points={[-2000, guides.y * PX_PER_METER, 4000, guides.y * PX_PER_METER]}
                stroke="#ff3b8d"
                strokeWidth={1 / view.scale}
                dash={[5, 4]}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>
      <p style={{ fontSize: 11, color: "var(--text)", marginTop: 4 }}>
        Shift+clique selecciona várias divisões · Delete apaga · Ctrl+C/Ctrl+V
        copia/cola · Ctrl+A selecciona todas · Ctrl+Z desfaz. Selecciona uma
        só para veres os botões "+" à volta (cria divisão igual encostada a
        esse lado).
      </p>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
