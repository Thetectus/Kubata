import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useProjectStore } from "../store/projectStore";
import { resolveBlockSpec } from "../lib/blocks";
import { generateWallBlocks, type WallBlockRect } from "../lib/wallBlocks";
import { WallBlockShape } from "./WallBlockShape";

const PX_PER_METER = 30;
const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 460;
const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const BLOCK_FILL: Record<string, string> = {
  tijolo: "#c96f3c",
  bloco: "#b7b0a3",
};

export function Editor2D() {
  const divisions = useProjectStore((s) => s.project.divisions);
  const selectedDivisionId = useProjectStore((s) => s.selectedDivisionId);
  const updateDivision = useProjectStore((s) => s.updateDivision);
  const selectDivision = useProjectStore((s) => s.selectDivision);

  const prevBlockCounts = useRef<Map<string, number>>(new Map());
  const stageRef = useRef<Konva.Stage>(null);
  const [view, setView] = useState({ scale: 1, x: 20, y: 20 });

  const divisionsRender = useMemo(
    () =>
      divisions.map((d) => {
        const spec = resolveBlockSpec(d.blockSpecId, d.blockOverride);
        const widthPx = d.width * PX_PER_METER;
        const heightPx = d.height * PX_PER_METER;
        const blocks = generateWallBlocks(widthPx, heightPx, spec, PX_PER_METER);
        return { division: d, spec, widthPx, heightPx, blocks };
      }),
    [divisions],
  );

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
    setView({
      scale,
      x: padding / 2 - minX * PX_PER_METER * scale,
      y: padding / 2 - minY * PX_PER_METER * scale,
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

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button type="button" onClick={() => zoomBy(1.2)} title="Aproximar">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} title="Afastar">
          −
        </button>
        <button type="button" onClick={fitToView}>
          Ajustar à vista
        </button>
        <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>
          {Math.round(view.scale * 100)}% — arrasta o fundo para navegar, roda o rato para zoom
        </span>
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
        onWheel={handleWheel}
      >
        <Layer>
          {divisionsRender.map(({ division: d, spec, widthPx, heightPx, blocks }) => {
            const prevCount = prevBlockCounts.current.get(d.id) ?? 0;
            const selected = d.id === selectedDivisionId;

            return (
              <Group
                key={d.id}
                x={d.x * PX_PER_METER}
                y={d.y * PX_PER_METER}
                draggable
                onClick={() => selectDivision(d.id)}
                onTap={() => selectDivision(d.id)}
                onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                  updateDivision(d.id, {
                    x: round1(e.target.x() / PX_PER_METER),
                    y: round1(e.target.y() / PX_PER_METER),
                  });
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
                    fill={BLOCK_FILL[spec.category]}
                    animate={i >= prevCount}
                    delayMs={Math.min(Math.max(i - prevCount, 0), 40) * 12}
                  />
                ))}

                <Text
                  text={`${d.label}\n${d.width}m × ${d.height}m`}
                  fontSize={12}
                  padding={6}
                  width={widthPx}
                  align="center"
                />

                {/* alça de redimensionar: canto inferior direito */}
                <Rect
                  x={widthPx - 8}
                  y={heightPx - 8}
                  width={16}
                  height={16}
                  fill="#8a5a2b"
                  draggable
                  onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                    const newWidthPx = Math.max(1 * PX_PER_METER, e.target.x() + 8);
                    const newHeightPx = Math.max(1 * PX_PER_METER, e.target.y() + 8);
                    updateDivision(d.id, {
                      width: round1(newWidthPx / PX_PER_METER),
                      height: round1(newHeightPx / PX_PER_METER),
                    });
                    e.target.position({ x: newWidthPx - 8, y: newHeightPx - 8 });
                  }}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
