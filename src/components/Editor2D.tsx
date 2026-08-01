import { useEffect, useMemo, useRef } from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useProjectStore } from "../store/projectStore";
import { resolveBlockSpec } from "../lib/blocks";
import { generateWallBlocks, type WallBlockRect } from "../lib/wallBlocks";
import { WallBlockShape } from "./WallBlockShape";

const PX_PER_METER = 30;
const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 420;
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

  return (
    <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT} style={{ background: "#f5f2ec", borderRadius: 8 }}>
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
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
